using System.Collections.Concurrent;
using CaseRoom.Api.Models;

namespace CaseRoom.Api.Services;

/// <summary>
/// Quản lý toàn bộ trạng thái in-memory của game và voice.
/// Được đăng ký dưới dạng Singleton trong Program.cs.
/// Kết hợp ConcurrentDictionary (cho truy cập O(1) đa luồng ở vòng ngoài)
/// và lock() (cho các giao dịch toàn vẹn dữ liệu vòng trong).
/// </summary>
public sealed class GameStateStore
{
    #region Data Structures
    // Lưu trữ danh sách Session
    private readonly ConcurrentDictionary<string, GameSessionState> _sessions = new(StringComparer.OrdinalIgnoreCase);
    
    // Ánh xạ ConnectionId của GameHub sang PlayerId
    private readonly ConcurrentDictionary<string, (string SessionId, string PlayerId)> _gameConnections = new();
    
    // Ánh xạ ConnectionId của VoiceHub sang PlayerId và ngược lại
    private readonly ConcurrentDictionary<string, string> _voiceConnectionsByPlayerId = new(StringComparer.OrdinalIgnoreCase);
    private readonly ConcurrentDictionary<string, string> _playerIdByVoiceConnection = new();
    private readonly ConcurrentDictionary<string, (string SessionId, string RoomId)> _voiceRoomByConnection = new();
    #endregion

    #region Core & Sessions
    /// <summary>
    /// Lấy Session hiện tại hoặc tạo mới nếu chưa tồn tại.
    /// Thread-safe nhờ ConcurrentDictionary.GetOrAdd.
    /// </summary>
    public GameSessionState GetOrCreateSession(string sessionId)
    {
        sessionId = NormalizeSessionId(sessionId);
        return _sessions.GetOrAdd(sessionId, id => new GameSessionState { Id = id });
    }

    private static string NormalizeSessionId(string sessionId)
    {
        return string.IsNullOrWhiteSpace(sessionId)
            ? "default"
            : sessionId.Trim().ToLowerInvariant();
    }
    #endregion

    #region Game State (Thread-Safe with Fine-grained Locking)
    /// <summary>
    /// Thêm người chơi mới hoặc cập nhật người chơi cũ khi họ bị mất kết nối và join lại.
    /// Sử dụng lock(session) để đảm bảo không bị lỗi Race Condition khi nhiều người join cùng lúc.
    /// </summary>
    public PlayerState AddOrUpdatePlayer(string sessionId, string playerName, string connectionId)
    {
        var session = GetOrCreateSession(sessionId);
        lock (session)
        {
            var existing = session.Players.Values.FirstOrDefault(p =>
                string.Equals(p.Name, playerName, StringComparison.OrdinalIgnoreCase));

            if (existing is not null)
            {
                existing.ConnectionId = connectionId;
                _gameConnections[connectionId] = (session.Id, existing.Id);
                return existing;
            }

            var player = new PlayerState
            {
                Id = Guid.NewGuid().ToString("N"),
                Name = string.IsNullOrWhiteSpace(playerName) ? "Detective" : playerName.Trim(),
                ConnectionId = connectionId,
                CurrentRoomId = "briefing" // Phòng mặc định khi mới vào
            };

            session.Players[player.Id] = player;
            _gameConnections[connectionId] = (session.Id, player.Id);
            return player;
        }
    }

    /// <summary>
    /// Lấy Snapshot nhưng bị giới hạn bởi Fog of War (Chỉ thấy những người ở cùng phòng với playerId).
    /// </summary>
    public SessionSnapshotDto GetVisibleSnapshotForPlayer(string sessionId, string playerId)
    {
        var session = GetOrCreateSession(sessionId);
        lock (session)
        {
            return session.ToSnapshotForPlayer(playerId);
        }
    }

    /// <summary>
    /// Lấy Snapshot toàn bộ những vật thể và người chơi đang đứng trong một phòng cụ thể.
    /// </summary>
    public SessionSnapshotDto GetVisibleSnapshotForRoom(string sessionId, string roomId)
    {
        var session = GetOrCreateSession(sessionId);
        lock (session)
        {
            return session.ToSnapshotForRoom(roomId);
        }
    }

    public IReadOnlyList<PlayerDto> GetPlayersInRoom(string sessionId, string roomId)
    {
        var session = GetOrCreateSession(sessionId);
        lock (session)
        {
            return session.Players.Values
                .Where(p => p.CurrentRoomId == roomId)
                .Select(p => p.ToDto())
                .ToList();
        }
    }

    /// <summary>
    /// Xử lý logic di chuyển phòng, tuân thủ nguyên tắc Đồ thị (Topology).
    /// Chỉ được phép di chuyển nếu 2 phòng có nối với nhau (ConnectedRoomIds).
    /// </summary>
    public bool TryMovePlayer(
        string sessionId,
        string playerId,
        string targetRoomId,
        out PlayerDto? playerDto,
        out string? oldRoomId,
        out string? newRoomId,
        out string? error)
    {
        playerDto = null;
        oldRoomId = null;
        newRoomId = null;
        error = null;
        var session = GetOrCreateSession(sessionId);

        lock (session)
        {
            if (!session.Players.TryGetValue(playerId, out var player))
            {
                error = "Player not found.";
                return false;
            }

            var currentRoom = session.Rooms.FirstOrDefault(r => r.Id == player.CurrentRoomId);
            var targetRoom = session.Rooms.FirstOrDefault(r => r.Id == targetRoomId);
            if (targetRoom is null)
            {
                error = "Target room does not exist.";
                return false;
            }

            // Kiểm tra ràng buộc di chuyển
            if (currentRoom is not null && currentRoom.Id != targetRoom.Id && !currentRoom.ConnectedRoomIds.Contains(targetRoom.Id))
            {
                error = $"Room '{targetRoom.Name}' is not connected to current room.";
                return false;
            }

            oldRoomId = player.CurrentRoomId;
            player.CurrentRoomId = targetRoom.Id;
            player.CurrentObjectId = null; // Huỷ tương tác với đồ vật ở phòng cũ
            playerDto = player.ToDto();
            newRoomId = targetRoom.Id;
            return true;
        }
    }

    public bool TryInteractObject(string sessionId, string playerId, string objectId, out PlayerDto? playerDto, out string? roomId, out string? error)
    {
        playerDto = null;
        roomId = null;
        error = null;
        var session = GetOrCreateSession(sessionId);

        lock (session)
        {
            if (!session.Players.TryGetValue(playerId, out var player))
            {
                error = "Player not found.";
                return false;
            }

            var room = session.Rooms.FirstOrDefault(r => r.Id == player.CurrentRoomId);
            if (room is null || !room.Objects.Any(o => o.Id == objectId))
            {
                error = "Object is not in current room.";
                return false;
            }

            player.CurrentObjectId = objectId;
            playerDto = player.ToDto();
            roomId = room.Id;
            return true;
        }
    }

    public bool TryGetPlayer(string sessionId, string playerId, out PlayerState? player)
    {
        player = null;
        var session = GetOrCreateSession(sessionId);
        lock (session)
        {
            return session.Players.TryGetValue(playerId, out player);
        }
    }

    public void SetTalking(string sessionId, string playerId, bool isTalking)
    {
        var session = GetOrCreateSession(sessionId);
        lock (session)
        {
            if (session.Players.TryGetValue(playerId, out var player))
            {
                player.IsTalking = isTalking;
            }
        }
    }

    /// <summary>
    /// Tìm kiếm thông tin PlayerId và SessionId từ Game Connection Id của SignalR.
    /// Giúp che giấu PlayerId khỏi Client (Client không cần phải truyền PlayerId).
    /// </summary>
    public (string SessionId, string PlayerId)? GetGameConnection(string connectionId)
    {
        return _gameConnections.TryGetValue(connectionId, out var tuple) ? tuple : null;
    }

    /// <summary>
    /// Lấy toàn bộ trạng thái của người chơi đang gọi hàm dựa trên ConnectionId.
    /// Thread-safe nhờ việc lock đúng session tương ứng.
    /// </summary>
    public PlayerState? GetCallerPlayer(string connectionId)
    {
        if (_gameConnections.TryGetValue(connectionId, out var tuple))
        {
            var session = GetOrCreateSession(tuple.SessionId);
            lock (session)
            {
                if (session.Players.TryGetValue(tuple.PlayerId, out var player))
                {
                    return player;
                }
            }
        }
        return null;
    }

    /// <summary>
    /// Xóa thông tin kết nối GameHub khi người dùng ngắt mạng.
    /// </summary>
    public (string SessionId, string PlayerId, string RoomId)? RemoveGameConnection(string connectionId)
    {
        if (!_gameConnections.TryRemove(connectionId, out var tuple))
        {
            return null;
        }

        var roomId = "briefing";
        if (_sessions.TryGetValue(tuple.SessionId, out var session))
        {
            lock (session)
            {
                if (session.Players.TryGetValue(tuple.PlayerId, out var player) && player.ConnectionId == connectionId)
                {
                    roomId = player.CurrentRoomId;
                    session.Players.Remove(tuple.PlayerId);
                }
            }
        }

        return (tuple.SessionId, tuple.PlayerId, roomId);
    }
    #endregion

    #region Voice Connections (O(1) ConcurrentLookups)
    // Các thao tác này không cần lock session vì chỉ cập nhật các ConcurrentDictionary toàn cục.

    public void RegisterVoiceConnection(string playerId, string connectionId)
    {
        _voiceConnectionsByPlayerId[playerId] = connectionId;
        _playerIdByVoiceConnection[connectionId] = playerId;
    }

    public string? GetVoiceConnectionForPlayer(string playerId)
    {
        return _voiceConnectionsByPlayerId.TryGetValue(playerId, out var connectionId)
            ? connectionId
            : null;
    }

    public string? GetVoicePlayerIdByConnection(string connectionId)
    {
        return _playerIdByVoiceConnection.TryGetValue(connectionId, out var playerId)
            ? playerId
            : null;
    }

    public (string SessionId, string RoomId)? SetVoiceRoom(string connectionId, string sessionId, string roomId)
    {
        _voiceRoomByConnection.TryGetValue(connectionId, out var old);
        _voiceRoomByConnection[connectionId] = (NormalizeSessionId(sessionId), roomId);
        return old == default ? null : old;
    }

    public (string SessionId, string RoomId)? GetVoiceRoom(string connectionId)
    {
        return _voiceRoomByConnection.TryGetValue(connectionId, out var room) ? room : null;
    }

    public string? RemoveVoiceConnection(string connectionId)
    {
        if (!_playerIdByVoiceConnection.TryRemove(connectionId, out var playerId))
        {
            return null;
        }

        _voiceConnectionsByPlayerId.TryRemove(playerId, out _);
        _voiceRoomByConnection.TryRemove(connectionId, out _);
        return playerId;
    }
    #endregion
}
