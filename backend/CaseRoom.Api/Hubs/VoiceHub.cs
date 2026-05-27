using CaseRoom.Api.Services;
using Microsoft.AspNetCore.SignalR;

namespace CaseRoom.Api.Hubs;

/// <summary>
/// Máy chủ Báo hiệu (Signaling Server) cho WebRTC.
/// Tách biệt hoàn toàn với GameHub để không làm lag luồng xử lý game.
/// Lưu ý: VoiceHub KHÔNG truyền tải Media (Audio), nó chỉ truyền các bản tin SDP (Offer/Answer) và ICE Candidates để Client tự kết nối P2P với nhau.
/// </summary>
public sealed class VoiceHub(GameStateStore store) : Hub
{
    /// <summary>
    /// Đăng ký kết nối Voice. Được gọi ngay sau khi GameHub JoinSession thành công.
    /// </summary>
    public async Task RegisterVoice(string sessionId, string playerId)
    {
        if (!store.TryGetPlayer(sessionId, playerId, out var player) || player is null)
        {
            await Clients.Caller.SendAsync("VoiceError", "Player not found in session.");
            return;
        }

        var normalizedSessionId = store.GetOrCreateSession(sessionId).Id;
        
        // Liên kết ConnectionId hiện tại với PlayerId để sử dụng cho WebRTC Signaling
        store.RegisterVoiceConnection(playerId, Context.ConnectionId);

        var oldRoom = store.SetVoiceRoom(Context.ConnectionId, normalizedSessionId, player.CurrentRoomId);
        
        // Thoát nhóm Voice của phòng cũ (nếu có)
        if (oldRoom is not null)
        {
            await Groups.RemoveFromGroupAsync(Context.ConnectionId, HubGroupNames.VoiceGroup(oldRoom.Value.SessionId, oldRoom.Value.RoomId));
            await BroadcastVoicePeers(oldRoom.Value.SessionId, oldRoom.Value.RoomId);
        }

        // Vào nhóm Voice của phòng mới
        await Groups.AddToGroupAsync(Context.ConnectionId, HubGroupNames.VoiceGroup(normalizedSessionId, player.CurrentRoomId));
        
        // Cập nhật danh sách "những người nghe thấy bạn" cho toàn bộ phòng
        await BroadcastVoicePeers(normalizedSessionId, player.CurrentRoomId);
    }

    /// <summary>
    /// Chuyển đổi kênh Voice khi người chơi di chuyển sang phòng khác.
    /// Được Frontend gọi thủ công khi nhận được sự kiện "VoiceRoomShouldRefresh" từ GameHub.
    /// </summary>
    public async Task RefreshVoiceRoom(string sessionId, string playerId)
    {
        if (!store.TryGetPlayer(sessionId, playerId, out var player) || player is null)
        {
            await Clients.Caller.SendAsync("VoiceError", "Player not found in session.");
            return;
        }

        var normalizedSessionId = store.GetOrCreateSession(sessionId).Id;
        var oldRoom = store.SetVoiceRoom(Context.ConnectionId, normalizedSessionId, player.CurrentRoomId);
        if (oldRoom is not null)
        {
            await Groups.RemoveFromGroupAsync(Context.ConnectionId, HubGroupNames.VoiceGroup(oldRoom.Value.SessionId, oldRoom.Value.RoomId));
            await BroadcastVoicePeers(oldRoom.Value.SessionId, oldRoom.Value.RoomId);
        }

        await Groups.AddToGroupAsync(Context.ConnectionId, HubGroupNames.VoiceGroup(normalizedSessionId, player.CurrentRoomId));
        await BroadcastVoicePeers(normalizedSessionId, player.CurrentRoomId);
    }

    /// <summary>
    /// Sự kiện Push-to-Talk (Bắt đầu nói).
    /// </summary>
    public async Task StartTalking()
    {
        var playerId = store.GetVoicePlayerIdByConnection(Context.ConnectionId);
        if (playerId is null) return;

        var room = store.GetVoiceRoom(Context.ConnectionId);
        if (room is null) return;

        if (!store.TryGetPlayer(room.Value.SessionId, playerId, out var player) || player is null) return;

        store.SetTalking(room.Value.SessionId, playerId, true);
        await Clients.Group(HubGroupNames.VoiceGroup(room.Value.SessionId, player.CurrentRoomId))
            .SendAsync("PlayerStartedTalking", playerId);
    }

    /// <summary>
    /// Sự kiện Push-to-Talk (Ngừng nói).
    /// </summary>
    public async Task StopTalking()
    {
        var playerId = store.GetVoicePlayerIdByConnection(Context.ConnectionId);
        if (playerId is null) return;

        var room = store.GetVoiceRoom(Context.ConnectionId);
        if (room is null) return;

        if (!store.TryGetPlayer(room.Value.SessionId, playerId, out var player) || player is null) return;

        store.SetTalking(room.Value.SessionId, playerId, false);
        await Clients.Group(HubGroupNames.VoiceGroup(room.Value.SessionId, player.CurrentRoomId))
            .SendAsync("PlayerStoppedTalking", playerId);
    }

    #region WebRTC Signaling
    // Ba hàm dưới đây hoàn toàn là luồng chuyển tiếp thư tay (Relay) cho WebRTC P2P Mesh
    
    public Task SendOffer(string targetPlayerId, object offer)
    {
        var targetConnectionId = store.GetVoiceConnectionForPlayer(targetPlayerId);
        if (targetConnectionId is null || !IsInSameRoom(targetConnectionId)) return Task.CompletedTask;
        
        return Clients.Client(targetConnectionId).SendAsync("ReceiveOffer", new { fromPlayerId = GetCallerPlayerId(), offer });
    }

    public Task SendAnswer(string targetPlayerId, object answer)
    {
        var targetConnectionId = store.GetVoiceConnectionForPlayer(targetPlayerId);
        if (targetConnectionId is null || !IsInSameRoom(targetConnectionId)) return Task.CompletedTask;
        
        return Clients.Client(targetConnectionId).SendAsync("ReceiveAnswer", new { fromPlayerId = GetCallerPlayerId(), answer });
    }

    public Task SendIceCandidate(string targetPlayerId, object candidate)
    {
        var targetConnectionId = store.GetVoiceConnectionForPlayer(targetPlayerId);
        if (targetConnectionId is null || !IsInSameRoom(targetConnectionId)) return Task.CompletedTask;
        
        return Clients.Client(targetConnectionId).SendAsync("ReceiveIceCandidate", new { fromPlayerId = GetCallerPlayerId(), candidate });
    }
    
    /// <summary>
    /// Kiểm tra bảo mật: Hai người chơi có đang đứng chung một phòng hay không?
    /// Chống lại việc Hacker giả mạo gói tin WebRTC gửi sang phòng khác.
    /// </summary>
    private bool IsInSameRoom(string targetConnectionId)
    {
        var callerRoom = store.GetVoiceRoom(Context.ConnectionId);
        var targetRoom = store.GetVoiceRoom(targetConnectionId);
        return callerRoom is not null && targetRoom is not null &&
               callerRoom.Value.SessionId == targetRoom.Value.SessionId &&
               callerRoom.Value.RoomId == targetRoom.Value.RoomId;
    }
    #endregion

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        var oldRoom = store.GetVoiceRoom(Context.ConnectionId);
        var playerId = store.RemoveVoiceConnection(Context.ConnectionId);
        
        if (playerId is not null && oldRoom is not null)
        {
            await Groups.RemoveFromGroupAsync(Context.ConnectionId, HubGroupNames.VoiceGroup(oldRoom.Value.SessionId, oldRoom.Value.RoomId));
            await Clients.Group(HubGroupNames.VoiceGroup(oldRoom.Value.SessionId, oldRoom.Value.RoomId)).SendAsync("VoicePeerDisconnected", playerId);
            await BroadcastVoicePeers(oldRoom.Value.SessionId, oldRoom.Value.RoomId);
        }

        await base.OnDisconnectedAsync(exception);
    }

    private async Task BroadcastVoicePeers(string sessionId, string roomId)
    {
        var players = store.GetPlayersInRoom(sessionId, roomId)
            .Select(p => new { p.Id, p.Name, p.CurrentRoomId }) // Chỉ lấy thông tin cơ bản
            .ToList();

        await Clients.Group(HubGroupNames.VoiceGroup(sessionId, roomId)).SendAsync("VoicePeersChanged", players);
    }

    private string? GetCallerPlayerId() => store.GetVoicePlayerIdByConnection(Context.ConnectionId);
}
