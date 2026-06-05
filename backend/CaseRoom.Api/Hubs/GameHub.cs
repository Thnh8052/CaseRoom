using CaseRoom.Api.Models;
using CaseRoom.Api.Services;
using Microsoft.AspNetCore.SignalR;


namespace CaseRoom.Api.Hubs;

/// <summary>
/// Quản lý dữ liệu JSON nhẹ (trạng thái phòng, toạ độ, di chuyển).
/// Tách rời khỏi VoiceHub để đảm bảo luồng Game luôn mượt mà kể cả khi mạng đàm thoại bị lag.
/// </summary>
public sealed class GameHub(GameStateStore store, DeepSeekAiService aiService) : Hub
{
    /// <summary>
    /// Được gọi khi người chơi bấm nút Join.
    /// Khởi tạo dữ liệu người chơi và đưa vào các nhóm Broadcast phù hợp.
    /// </summary>
    public async Task<object> JoinSession(string sessionId, string playerId, string playerName)
    {
        var player = store.AddOrUpdatePlayer(sessionId, playerId, playerName, Context.ConnectionId);
        var normalizedSessionId = store.GetOrCreateSession(sessionId).Id;

        // Đưa người chơi vào nhóm của toàn Session
        await Groups.AddToGroupAsync(Context.ConnectionId, HubGroupNames.GameGroup(normalizedSessionId));
        // Đưa người chơi vào nhóm của căn phòng cụ thể (Vd: "briefing")
        await Groups.AddToGroupAsync(Context.ConnectionId, HubGroupNames.RoomGroup(normalizedSessionId, player.CurrentRoomId));

        // Thông báo cho những người ĐANG Ở TRONG PHÒNG ĐÓ biết có người mới vào
        await BroadcastRoomOccupants(normalizedSessionId, player.CurrentRoomId);

        // Trả về Snapshot tuân thủ Fog of War (Chỉ thấy những người cùng phòng)
        return new
        {
            player = player.ToDto(player.Id),
            snapshot = store.GetVisibleSnapshotForPlayer(normalizedSessionId, player.Id)
        };
    }

    /// <summary>
    /// Stream câu trả lời của AI theo thời gian thực về Client.
    /// </summary>
    public async IAsyncEnumerable<string> StreamAskDetectiveAi(string question, [System.Runtime.CompilerServices.EnumeratorCancellation] CancellationToken cancellationToken)
    {
        var conn = store.GetGameConnection(Context.ConnectionId);
        if (conn == null) yield break;

        var player = store.GetCallerPlayer(Context.ConnectionId);
        if (player == null) yield break;

        var session = store.GetOrCreateSession(conn.Value.SessionId);

        var clues = player.UnlockedClues;

        var responseStream = aiService.StreamAskDetectiveAiAsync(question, session.BriefingText, session.SelectedCase?.SecretSolution ?? "", clues, cancellationToken);
        
        await foreach (var chunk in responseStream)
        {
            yield return chunk;
        }
    }

    /// <summary>
    /// Lấy danh sách toàn bộ các vụ án đang có sẵn để Host có thể chọn.
    /// </summary>
    public IReadOnlyList<CaseSummaryDto> GetAvailableCases()
    {
        return store.GetAvailableCases();
    }

    public async Task SelectMode(string mode)
    {
        var conn = store.GetGameConnection(Context.ConnectionId);
        if (conn == null) return;

        if (!store.TrySelectMode(
                conn.Value.SessionId,
                conn.Value.PlayerId,
                mode,
                out var setupInfo,
                out var error))
        {
            await Clients.Caller.SendAsync("GameError", error);
            return;
        }

        await Clients.Group(HubGroupNames.GameGroup(conn.Value.SessionId))
            .SendAsync("GameSetupChanged", setupInfo);

        // Phát Broadcast cho phòng briefing để mọi người thấy Ready state bị reset
        await BroadcastRoomOccupants(conn.Value.SessionId, "briefing");
    }

    /// <summary>
    /// Host chọn một vụ án. Nếu thành công, phát Broadcast cho cả phòng.
    /// </summary>
    public async Task SelectCase(string caseId)
    {
        var conn = store.GetGameConnection(Context.ConnectionId);
        if (conn == null) return;

        if (!store.TrySelectCase(conn.Value.SessionId, conn.Value.PlayerId, caseId, out var setupInfo, out var error))
        {
            await Clients.Caller.SendAsync("GameError", error);
            return;
        }

        // Báo cho toàn bộ Session biết Case/Setup đã được thay đổi
        await Clients.Group(HubGroupNames.GameGroup(conn.Value.SessionId))
            .SendAsync("GameSetupChanged", setupInfo);

        // Phát Broadcast để update lại danh sách player (Ready state reset)
        await BroadcastRoomOccupants(conn.Value.SessionId, "briefing");
    }

    /// <summary>
    /// Lấy lại trạng thái snapshot hiện tại (Dùng khi Client bị mất đồng bộ).
    /// </summary>
    public object? GetSnapshot()
    {
        var conn = store.GetGameConnection(Context.ConnectionId);
        if (conn == null) return null;

        return store.GetVisibleSnapshotForPlayer(conn.Value.SessionId, conn.Value.PlayerId);
    }

    /// <summary>
    /// Bật/tắt trạng thái Sẵn sàng của người chơi trong Lobby.
    /// </summary>
    public async Task ToggleReady()
    {
        var conn = store.GetGameConnection(Context.ConnectionId);
        if (conn == null) return;

        if (!store.TryToggleReady(conn.Value.SessionId, conn.Value.PlayerId, out var isReady, out var error))
        {
            await Clients.Caller.SendAsync("GameError", error);
            return;
        }

        // Cập nhật lại danh sách player trong Lobby (mặc định ở briefing room)
        await BroadcastRoomOccupants(conn.Value.SessionId, "briefing");
    }

    public async Task SetAppearance(CharacterAppearance appearance)
    {
        var conn = store.GetGameConnection(Context.ConnectionId);
        if (conn == null) return;

        if (!store.TrySetAppearance(conn.Value.SessionId, conn.Value.PlayerId, appearance, out var error))
        {
            await Clients.Caller.SendAsync("GameError", error);
            return;
        }

        // Báo cho mọi người trong phòng biết ngoại hình đã thay đổi
        await BroadcastRoomOccupants(conn.Value.SessionId, store.GetOrCreateSession(conn.Value.SessionId).Players[conn.Value.PlayerId].CurrentRoomId);
    }

    /// <summary>
    /// Chuyển người chơi từ phòng này sang phòng khác.
    /// </summary>
    public async Task<object?> MoveToRoom(string targetRoomId)
    {
        var conn = store.GetGameConnection(Context.ConnectionId);
        if (conn == null) return null;
        var normalizedSessionId = conn.Value.SessionId;

        // 1. Kiểm tra logic di chuyển (Topology: phòng có nối với nhau không?)
        if (!store.TryMovePlayer(normalizedSessionId, conn.Value.PlayerId, targetRoomId, out var player, out var oldRoomId, out var newRoomId, out var error))
        {
            await Clients.Caller.SendAsync("GameError", error);
            return null;
        }

        // 2. Chuyển kênh Broadcast
        if (oldRoomId is not null)
        {
            await Groups.RemoveFromGroupAsync(Context.ConnectionId, HubGroupNames.RoomGroup(normalizedSessionId, oldRoomId));
        }
        await Groups.AddToGroupAsync(Context.ConnectionId, HubGroupNames.RoomGroup(normalizedSessionId, newRoomId!));

        // 3. Thông báo cho người ở phòng cũ (người này vừa biến mất)
        if (oldRoomId is not null && oldRoomId != newRoomId)
        {
            await BroadcastRoomOccupants(normalizedSessionId, oldRoomId);
        }

        // 4. Thông báo cho người ở phòng mới (người này vừa xuất hiện)
        await BroadcastRoomOccupants(normalizedSessionId, newRoomId!);
        
        // 5. Ra lệnh cho Client tự động kết nối lại kênh Voice sang phòng mới
        await Clients.Caller.SendAsync("VoiceRoomShouldRefresh", new { playerId = player!.Id });

        return new
        {
            player,
            snapshot = store.GetVisibleSnapshotForPlayer(normalizedSessionId, player.Id)
        };
    }

    /// <summary>
    /// Tương tác với một đồ vật trong phòng.
    /// </summary>
    public async Task InteractObject(string objectId)
    {
        var conn = store.GetGameConnection(Context.ConnectionId);
        if (conn == null) return;
        var normalizedSessionId = conn.Value.SessionId;

        if (!store.TryInteractObject(normalizedSessionId, conn.Value.PlayerId, objectId, out _, out var roomId, out var error))
        {
            await Clients.Caller.SendAsync("GameError", error);
            return;
        }

        // Thông báo cho những người cùng phòng thấy bạn vừa thao tác
        await BroadcastRoomOccupants(normalizedSessionId, roomId!);
    }

    public async Task CompleteInspection(string objectId)
    {
        var conn = store.GetGameConnection(Context.ConnectionId);
        if (conn == null) return;
        var normalizedSessionId = conn.Value.SessionId;

        if (!store.TryCompleteInspection(normalizedSessionId, conn.Value.PlayerId, objectId, out var result, out var unlockedClue, out var acquiredItem, out var error))
        {
            await Clients.Caller.SendAsync("GameError", error);
            return;
        }

        // Gửi thông báo text kết quả
        await Clients.Caller.SendAsync("ReceiveInspectionResult", new { objectId, result });
        
        var hasNewData = false;
        
        if (unlockedClue != null)
        {
            await Clients.Caller.SendAsync("ClueUnlocked", unlockedClue);
            hasNewData = true;
        }
        
        if (acquiredItem != null)
        {
            await Clients.Caller.SendAsync("ItemAcquired", acquiredItem);
            hasNewData = true;
        }
        
        if (hasNewData)
        {
            var session = store.GetOrCreateSession(normalizedSessionId);
            var snapshot = session.ToSnapshotForPlayer(conn.Value.PlayerId);
            await Clients.Caller.SendAsync("GameSnapshot", snapshot);
        }

        var player = store.GetCallerPlayer(Context.ConnectionId);
        if (player?.CurrentRoomId != null)
        {
            await Clients.Group(HubGroupNames.RoomGroup(normalizedSessionId, player.CurrentRoomId))
                .SendAsync("PlayerCancelledInspection", conn.Value.PlayerId);
        }
    }

public async Task TamperClue(string clueId, string fakeText)
{
    var conn = store.GetGameConnection(Context.ConnectionId);
    if (conn == null) return;
    var normalizedSessionId = conn.Value.SessionId;

    if (!store.TryTamperClue(normalizedSessionId, conn.Value.PlayerId, clueId, fakeText, out var error))
    {
        await Clients.Caller.SendAsync("GameError", error);
        return;
    }

    var session = store.GetOrCreateSession(normalizedSessionId);
    var snapshot = session.ToSnapshotForPlayer(conn.Value.PlayerId);
    await Clients.Caller.SendAsync("GameSnapshot", snapshot);
}

public async Task DropItem(string itemId)
{
    var conn = store.GetGameConnection(Context.ConnectionId);
    var player = store.GetCallerPlayer(Context.ConnectionId);
    if (conn == null || player?.CurrentRoomId == null) return;

    if (!store.TryDropItem(conn.Value.SessionId, conn.Value.PlayerId, itemId, out var error))
    {
        await Clients.Caller.SendAsync("GameError", error);
        return;
    }

    await BroadcastRoomOccupants(conn.Value.SessionId, player.CurrentRoomId);
}

public async Task PickupFloorItem(string itemId)
{
    var conn = store.GetGameConnection(Context.ConnectionId);
    var player = store.GetCallerPlayer(Context.ConnectionId);
    if (conn == null || player?.CurrentRoomId == null) return;

    if (!store.TryPickupFloorItem(conn.Value.SessionId, conn.Value.PlayerId, itemId, out var error))
    {
        await Clients.Caller.SendAsync("GameError", error);
        return;
    }

    await BroadcastRoomOccupants(conn.Value.SessionId, player.CurrentRoomId);
}

public async Task GiveItem(string targetPlayerId, string itemId)
{
    var conn = store.GetGameConnection(Context.ConnectionId);
    var player = store.GetCallerPlayer(Context.ConnectionId);
    if (conn == null || player?.CurrentRoomId == null) return;

    if (!store.TryGiveItem(conn.Value.SessionId, conn.Value.PlayerId, targetPlayerId, itemId, out var error))
    {
        await Clients.Caller.SendAsync("GameError", error);
        return;
    }

    // Refresh for both sender and receiver (and everyone in room to see the items change if needed)
    await BroadcastRoomOccupants(conn.Value.SessionId, player.CurrentRoomId);
}

public async Task ShareClue(string targetPlayerId, string clueId)
{
    var conn = store.GetGameConnection(Context.ConnectionId);
    var player = store.GetCallerPlayer(Context.ConnectionId);
    if (conn == null || player?.CurrentRoomId == null) return;

    if (!store.TryShareClue(conn.Value.SessionId, conn.Value.PlayerId, targetPlayerId, clueId, out var error))
    {
        await Clients.Caller.SendAsync("GameError", error);
        return;
    }

    // Gửi snapshot mới cho người nhận clue để họ thấy clue trong sổ
    var session = store.GetOrCreateSession(conn.Value.SessionId);
    var targetSnapshot = session.ToSnapshotForPlayer(targetPlayerId);
    
    // Cần tìm ConnectionId của targetPlayer để send
    // (Ở đây, vì thiết kế hiện tại không lưu ngược PlayerId -> Game ConnectionId nên 
    // tạm thời Broadcast toàn bộ những người trong phòng để họ lấy lại snapshot).
    await BroadcastRoomOccupants(conn.Value.SessionId, player.CurrentRoomId);
}

public async Task StartInspection(string objectId)
{
    var conn = store.GetGameConnection(Context.ConnectionId);
    var player = store.GetCallerPlayer(Context.ConnectionId);
    if (conn == null || player?.CurrentRoomId == null) return;

    await Clients.Group(HubGroupNames.RoomGroup(conn.Value.SessionId, player.CurrentRoomId))
        .SendAsync("PlayerStartedInspection", conn.Value.PlayerId, objectId);
}

public async Task CancelInspection(string objectId)
{
    var conn = store.GetGameConnection(Context.ConnectionId);
    var player = store.GetCallerPlayer(Context.ConnectionId);
    if (conn == null || player?.CurrentRoomId == null) return;

    await Clients.Group(HubGroupNames.RoomGroup(conn.Value.SessionId, player.CurrentRoomId))
        .SendAsync("PlayerCancelledInspection", conn.Value.PlayerId);
}

    /// <summary>
    /// Xử lý khi người chơi đột ngột rớt mạng (Tắt tab, mất internet).
    /// </summary>
    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        var removed = store.RemoveGameConnection(Context.ConnectionId);
        if (removed is not null)
        {
            await Groups.RemoveFromGroupAsync(Context.ConnectionId, HubGroupNames.RoomGroup(removed.Value.SessionId, removed.Value.RoomId));
            
            // Báo cho những người trong phòng biết người này đã offline
            await BroadcastRoomOccupants(removed.Value.SessionId, removed.Value.RoomId);

            // Nếu người thoát là Host, báo cho cả server cập nhật lại Host mới
            if (removed.Value.HostChanged)
            {
                var phaseInfo = store.GetPhaseInfo(removed.Value.SessionId);
                await Clients.Group(HubGroupNames.GameGroup(removed.Value.SessionId))
                    .SendAsync("GamePhaseChanged", phaseInfo);
            }
        }

        await base.OnDisconnectedAsync(exception);
    }

    /// <summary>
    /// Hàm helper để gửi danh sách người chơi mới nhất cho một nhóm phòng cụ thể.
    /// </summary>
    private Task BroadcastRoomOccupants(string sessionId, string roomId)
    {
        var players = store.GetPlayersInRoom(sessionId, roomId);
        var session = store.GetOrCreateSession(sessionId);
        var floorItems = session.FloorItems.TryGetValue(roomId, out var items) ? items : new List<ItemDto>();
        return Clients.Group(HubGroupNames.RoomGroup(sessionId, roomId)).SendAsync("RoomOccupantsChanged", new
        {
            roomId,
            players,
            floorItems
        });
    }

    public async Task StartBriefing()
{
    var conn = store.GetGameConnection(Context.ConnectionId);
    if (conn == null) return;

    if (!store.TryStartBriefing(
            conn.Value.SessionId,
            conn.Value.PlayerId,
            out var movedPlayers,
            out var phaseInfo,
            out var error))
    {
        await Clients.Caller.SendAsync("GameError", error);
        return;
    }

    var affectedRooms = movedPlayers
        .SelectMany(m => new[] { m.OldRoomId, m.NewRoomId })
        .Distinct()
        .ToList();

    foreach (var move in movedPlayers)
    {
        if (move.OldRoomId != move.NewRoomId)
        {
            await Groups.RemoveFromGroupAsync(
                move.ConnectionId,
                HubGroupNames.RoomGroup(conn.Value.SessionId, move.OldRoomId)
            );

            await Groups.AddToGroupAsync(
                move.ConnectionId,
                HubGroupNames.RoomGroup(conn.Value.SessionId, move.NewRoomId)
            );
        }

        await Clients.Client(move.ConnectionId).SendAsync(
            "VoiceRoomShouldRefresh",
            new { playerId = move.PlayerId }
        );
    }

    await Clients.Group(HubGroupNames.GameGroup(conn.Value.SessionId))
        .SendAsync("GamePhaseChanged", phaseInfo);

    foreach (var roomId in affectedRooms)
    {
        await BroadcastRoomOccupants(conn.Value.SessionId, roomId);
    }
}

    public async Task StartExploration()
    {
        var conn = store.GetGameConnection(Context.ConnectionId);
        if (conn == null) return;

        if (!store.TryStartExploration(
                conn.Value.SessionId,
                conn.Value.PlayerId,
                out var phaseInfo,
                out var error))
        {
            await Clients.Caller.SendAsync("GameError", error);
            return;
        }

        await Clients.Group(HubGroupNames.GameGroup(conn.Value.SessionId))
            .SendAsync("GamePhaseChanged", phaseInfo);

        // Gửi Snapshot mới (chứa Role) cho từng người chơi vì áp dụng Fog of War
        var session = store.GetOrCreateSession(conn.Value.SessionId);
        foreach (var p in session.Players.Values)
        {
            var snapshot = session.ToSnapshotForPlayer(p.Id);
            await Clients.Client(p.ConnectionId).SendAsync("GameSnapshot", snapshot);
        }
    }
    public async Task UpdatePosition(double x, double y)
    {
        var conn = store.GetGameConnection(Context.ConnectionId);
        var player = store.GetCallerPlayer(Context.ConnectionId);
        if (conn == null || player == null) return;

        store.UpdatePlayerPosition(conn.Value.SessionId, player.Id, x, y);

        // Broadcast tới mọi người trong phòng
        await Clients.Group(HubGroupNames.RoomGroup(conn.Value.SessionId, player.CurrentRoomId))
            .SendAsync("PlayerMoved", player.Id, x, y);
    }
}
