using CaseRoom.Api.Services;
using Microsoft.AspNetCore.SignalR;

namespace CaseRoom.Api.Hubs;

/// <summary>
/// Quản lý dữ liệu JSON nhẹ (trạng thái phòng, toạ độ, di chuyển).
/// Tách rời khỏi VoiceHub để đảm bảo luồng Game luôn mượt mà kể cả khi mạng đàm thoại bị lag.
/// </summary>
public sealed class GameHub(GameStateStore store) : Hub
{
    /// <summary>
    /// Được gọi khi người chơi bấm nút Join.
    /// Khởi tạo dữ liệu người chơi và đưa vào các nhóm Broadcast phù hợp.
    /// </summary>
    public async Task<object> JoinSession(string sessionId, string playerName)
    {
        var player = store.AddOrUpdatePlayer(sessionId, playerName, Context.ConnectionId);
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
            player = player.ToDto(),
            snapshot = store.GetVisibleSnapshotForPlayer(normalizedSessionId, player.Id)
        };
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
        }

        await base.OnDisconnectedAsync(exception);
    }

    /// <summary>
    /// Hàm helper để gửi danh sách người chơi mới nhất cho một nhóm phòng cụ thể.
    /// </summary>
    private Task BroadcastRoomOccupants(string sessionId, string roomId)
    {
        var players = store.GetPlayersInRoom(sessionId, roomId);
        return Clients.Group(HubGroupNames.RoomGroup(sessionId, roomId)).SendAsync("RoomOccupantsChanged", new
        {
            roomId,
            players
        });
    }
}
