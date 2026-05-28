using System.Collections.Concurrent;
using CaseRoom.Api.Models;


namespace CaseRoom.Api.Services;

/// <summary>
/// Quản lý toàn bộ trạng thái in-memory của game và voice.
/// Được đăng ký dưới dạng Singleton trong Program.cs.
/// Kết hợp ConcurrentDictionary (cho truy cập O(1) đa luồng ở vòng ngoài)
/// và lock() (cho các giao dịch toàn vẹn dữ liệu vòng trong).
/// </summary>
public sealed record PlayerRoomMove(
    string PlayerId,
    string ConnectionId,
    string OldRoomId,
    string NewRoomId
);

public sealed record GamePhaseInfo(
    string Phase,
    string? HostPlayerId,
    string BriefingText
);
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
    
    // Danh sách các vụ án có sẵn (Hardcode tạm thời cho V1.5)
    private static readonly IReadOnlyList<CaseSummaryDto> AvailableCases =
    [
    new(
        "blackwood_manor",
        "Blackwood Manor",
        "A classic mansion murder mystery. The victim was found in a locked room during a stormy night.",
        "Easy",
        25,
        "Welcome to Blackwood Manor. Last night, during a violent storm, the owner of the manor was found dead inside a locked study. Search the rooms, question the witnesses, and uncover who is lying.",
        ["NpcMurderer", "PlayerMurderer"]
    ),
    new(
        "midnight_train",
        "The Midnight Train",
        "A passenger disappears during a midnight train ride, leaving behind only a torn ticket and a blood-stained glove.",
        "Medium",
        30,
        "The Midnight Train left the city at 11:40 PM. Before it reached the next station, one passenger vanished. Find out what happened before the train arrives.",
        ["NpcMurderer"]
    ),
    new(
        "gallery_after_dark",
        "Gallery After Dark",
        "A private art exhibition turns deadly after the lights go out and a priceless painting disappears.",
        "Medium",
        30,
        "Tonight's private exhibition was supposed to reveal a lost masterpiece. But when the lights went out, the painting vanished, and the curator was found unconscious.",
        ["NpcMurderer", "EveryoneHasSecrets"]
    )
    ];
    #endregion

    #region Core & Sessions
    /// <summary>
    /// Lấy Session hiện tại hoặc tạo mới nếu chưa tồn tại.
    /// Thread-safe nhờ ConcurrentDictionary.GetOrAdd.
    /// </summary>
    public GameSessionState GetOrCreateSession(string sessionId)
    {
        sessionId = NormalizeSessionId(sessionId);

        return _sessions.GetOrAdd(sessionId, id =>
        {
        var session = new GameSessionState { Id = id };
        var defaultCase = AvailableCases.First();
        session.SelectedCase = defaultCase;
        session.SelectedCaseId = defaultCase.Id;
        session.BriefingText = defaultCase.BriefingText;
        return session;
    });
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

                session.HostPlayerId ??= existing.Id;

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

            session.HostPlayerId ??= player.Id;

            return player;
        }
    }

    public GamePhaseInfo GetPhaseInfo(string sessionId)
    {
        var session = GetOrCreateSession(sessionId);
        lock (session)
        {
            return new GamePhaseInfo(
                session.Phase.ToString(),
                session.HostPlayerId,
                session.BriefingText
            );
        }
    }
    public bool TrySelectMode(
        string sessionId,
        string playerId,
        string mode,
        out GameSetupInfo? setupInfo,
        out string? error)
    {
        setupInfo = null;
        error = null;

        if (!Enum.TryParse<GameMode>(mode, ignoreCase: true, out var parsedMode))
        {
            error = "Invalid game mode.";
            return false;
        }

        var session = GetOrCreateSession(sessionId);

        lock (session)
        {
            if (session.HostPlayerId != playerId)
            {
                error = "Only the host can select game mode.";
                return false;
            }

            if (session.Phase is not GamePhase.Lobby)
            {
                error = "Game mode can only be changed in Lobby phase.";
                return false;
            }

            session.SelectedMode = parsedMode;

            var compatibleCases = AvailableCases
                .Where(c => c.SupportedModes.Contains(parsedMode.ToString()))
                .ToList();

            if (compatibleCases.Count == 0)
            {
                error = "No cases support this mode.";
                return false;
            }

            if (session.SelectedCase is null ||
                !session.SelectedCase.SupportedModes.Contains(parsedMode.ToString()))
            {
                session.SelectedCase = compatibleCases[0];
                session.SelectedCaseId = compatibleCases[0].Id;
                session.BriefingText = compatibleCases[0].BriefingText;
            }

            setupInfo = new GameSetupInfo(
                session.SelectedMode.ToString(),
                session.SelectedCase,
                session.BriefingText
            );

            return true;
        }
    }
        public bool TryStartBriefing(
        string sessionId,
        string playerId,
        out IReadOnlyList<PlayerRoomMove> movedPlayers,
        out GamePhaseInfo? phaseInfo,
        out string? error)
    {
        movedPlayers = Array.Empty<PlayerRoomMove>();
        phaseInfo = null;
        error = null;

        var session = GetOrCreateSession(sessionId);

        lock (session)
        {
            if (session.HostPlayerId != playerId)
            {
                error = "Only the host can start briefing.";
                return false;
            }

            if (session.Phase is not GamePhase.Lobby)
            {
                error = $"Cannot start briefing from phase {session.Phase}.";
                return false;
            }

            session.Phase = GamePhase.Briefing;
            
            if (session.SelectedCase is null)
            {
                error = "Please select a case before starting briefing.";
                return false;
            }

            var moves = new List<PlayerRoomMove>();

            foreach (var player in session.Players.Values)
            {
                var oldRoomId = player.CurrentRoomId;

                player.CurrentRoomId = "briefing";
                player.CurrentObjectId = null;

                moves.Add(new PlayerRoomMove(
                    player.Id,
                    player.ConnectionId,
                    oldRoomId,
                    player.CurrentRoomId
                ));
            }

            movedPlayers = moves;
            phaseInfo = new GamePhaseInfo(
                session.Phase.ToString(),
                session.HostPlayerId,
                session.BriefingText
            );

            return true;
        }
    }

    public bool TryStartExploration(
        string sessionId,
        string playerId,
        out GamePhaseInfo? phaseInfo,
        out string? error)
    {
        phaseInfo = null;
        error = null;

        var session = GetOrCreateSession(sessionId);

        lock (session)
        {
            if (session.HostPlayerId != playerId)
            {
                error = "Only the host can start exploration.";
                return false;
            }

            if (session.Phase is not GamePhase.Briefing)
            {
                error = $"Cannot start exploration from phase {session.Phase}.";
                return false;
            }

            session.Phase = GamePhase.Exploration;

            phaseInfo = new GamePhaseInfo(
                session.Phase.ToString(),
                session.HostPlayerId,
                session.BriefingText
            );

            return true;
        }
    }
    /// <summary>
    /// Thay đổi vụ án hiện tại. Chỉ Host mới có quyền làm việc này và chỉ được phép khi đang ở Lobby.
    /// </summary>
    public bool TrySelectCase(
        string sessionId,
        string playerId,
        string caseId,
        out GameSetupInfo? setupInfo,
        out string? error)
    {
        setupInfo = null;
        error = null;

        var session = GetOrCreateSession(sessionId);

        lock (session)
        {
            if (session.HostPlayerId != playerId)
            {
                error = "Only the host can select a case.";
                return false;
            }

            if (session.Phase is not GamePhase.Lobby)
            {
                error = "Case can only be changed in Lobby phase.";
                return false;
            }

            var nextCase = AvailableCases.FirstOrDefault(c =>
                string.Equals(c.Id, caseId, StringComparison.OrdinalIgnoreCase));

            if (nextCase is null)
            {
                error = "Case not found.";
                return false;
            }

            if (!nextCase.SupportedModes.Contains(session.SelectedMode.ToString()))
            {
                error = $"This case does not support {session.SelectedMode} mode.";
                return false;
            }

            session.SelectedCaseId = nextCase.Id;
            session.SelectedCase = nextCase;
            session.BriefingText = nextCase.BriefingText;

            setupInfo = new GameSetupInfo(
                session.SelectedMode.ToString(),
                session.SelectedCase,
                session.BriefingText
            );
            return true;
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

    public IReadOnlyList<CaseSummaryDto> GetAvailableCases()
    {
        return AvailableCases;
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
            if (session.Phase is not GamePhase.Exploration)
            {
                error = "You can only move during Exploration phase.";
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
            if (session.Phase is not GamePhase.Exploration)
            {
                error = "You can only interact with objects during Exploration phase.";
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
    /// Nếu người thoát là Host, tự động chuyển quyền Host cho người kế tiếp.
    /// </summary>
    public (string SessionId, string PlayerId, string RoomId, bool HostChanged)? RemoveGameConnection(string connectionId)
    {
        if (!_gameConnections.TryRemove(connectionId, out var tuple))
        {
            return null;
        }

        var roomId = "briefing";
        var hostChanged = false;

        if (_sessions.TryGetValue(tuple.SessionId, out var session))
        {
            lock (session)
            {
                if (session.Players.TryGetValue(tuple.PlayerId, out var player) && player.ConnectionId == connectionId)
                {
                    roomId = player.CurrentRoomId;
                    session.Players.Remove(tuple.PlayerId);

                    // Chuyển quyền Host nếu Host vừa thoát
                    if (session.HostPlayerId == tuple.PlayerId)
                    {
                        session.HostPlayerId = session.Players.Keys.FirstOrDefault();
                        hostChanged = true;
                    }
                }
            }
        }

        return (tuple.SessionId, tuple.PlayerId, roomId, hostChanged);
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
