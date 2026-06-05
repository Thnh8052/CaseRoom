using System.Collections.Concurrent;
using CaseRoom.Api.Content;
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
            var defaultCase = GameContentCatalog.AvailableCases.First();
            session.SelectedCase = defaultCase;
            session.SelectedCaseId = defaultCase.Id;
            session.BriefingText = defaultCase.BriefingText;

            GameContentCatalog.SeedDefaultClues(session);

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
    public PlayerState AddOrUpdatePlayer(string sessionId, string playerId, string playerName, string connectionId)
    {
        var session = GetOrCreateSession(sessionId);
        lock (session)
        {
            if (!string.IsNullOrEmpty(playerId) && session.Players.TryGetValue(playerId, out var existing))
            {
                existing.ConnectionId = connectionId;
                existing.Name = string.IsNullOrWhiteSpace(playerName) ? existing.Name : playerName.Trim();
                _gameConnections[connectionId] = (session.Id, existing.Id);

                session.HostPlayerId ??= existing.Id;

                return existing;
            }

            var player = new PlayerState
            {
                Id = string.IsNullOrWhiteSpace(playerId) ? Guid.NewGuid().ToString("N") : playerId,
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

            var compatibleCases = GameContentCatalog.AvailableCases
                .Where(c => c.SupportedModes.Contains(parsedMode.ToString()))
                .ToList();

            if (compatibleCases.Count == 0)
            {
                error = "No cases support this mode.";
                return false;
            }

            session.SelectedMode = parsedMode;

            // Đổi Mode -> Reset Sẵn sàng của tất cả mọi người
            foreach (var p in session.Players.Values)
            {
                p.IsReady = false;
            }

            // Fallback tự động chọn case tương thích nếu case hiện tại không còn hợp lệ
            if (session.SelectedCase != null && !session.SelectedCase.SupportedModes.Contains(parsedMode.ToString()))
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

    public bool TrySetAppearance(
        string sessionId,
        string playerId,
        CharacterAppearance appearance,
        out string? error)
    {
        error = null;
        var session = GetOrCreateSession(sessionId);

        lock (session)
        {
            if (!session.Players.TryGetValue(playerId, out var player))
            {
                error = "Player not found in session.";
                return false;
            }
            player.Appearance = appearance;
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
                error = "Chỉ có thể bắt đầu Briefing từ Lobby.";
                return false;
            }

            if (session.SelectedCase == null)
            {
                error = "Vui lòng chọn Vụ án trước.";
                return false;
            }

            if (session.Players.Count < 4)
            {
                error = "Cần ít nhất 4 người chơi để bắt đầu vụ án.";
                return false;
            }

            if (session.Players.Values.Any(p => !p.IsReady))
            {
                error = "Tất cả người chơi phải bấm Sẵn sàng.";
                return false;
            }

            session.Phase = GamePhase.Briefing;
            
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

            // Nếu Mode là PlayerMurderer hoặc EveryoneHasSecrets, gán Random 1 người làm Murderer
            if (session.SelectedMode == GameMode.PlayerMurderer || session.SelectedMode == GameMode.EveryoneHasSecrets)
            {
                var random = new Random();
                var playersList = session.Players.Values.ToList();
                if (playersList.Count > 0)
                {
                    var murderer = playersList[random.Next(playersList.Count)];
                    murderer.Role = "Murderer";
                    // Những người khác vẫn là Detective
                    foreach(var p in playersList.Where(x => x.Id != murderer.Id))
                    {
                        p.Role = "Detective";
                    }
                }
            }

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

            var nextCase = GameContentCatalog.AvailableCases.FirstOrDefault(c =>
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

            // Đổi Case -> Reset Sẵn sàng của tất cả mọi người
            foreach (var p in session.Players.Values)
            {
                p.IsReady = false;
            }

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
        return GameContentCatalog.AvailableCases;
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

    public bool TryCompleteInspection(string sessionId, string playerId, string objectId, out string? resultMessage, out ClueDto? unlockedClue, out string? error)
    {
        error = null;
        resultMessage = null;
        unlockedClue = null;

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
                error = "You can only inspect objects during Exploration phase.";
                return false;
            }

            if (player.CurrentObjectId != objectId)
            {
                error = "You must be at the object to inspect it.";
                return false;
            }

            // Lấy manh mối nếu còn (Exclusive Clue)
            if (session.AvailableClues.TryGetValue(objectId, out var clues) && clues.Count > 0)
            {
                unlockedClue = clues[0];
                clues.RemoveAt(0); // Pop clue (người khác không lấy được nữa)
                player.UnlockedClues.Add(unlockedClue);
                resultMessage = "Bạn đã tìm thấy một manh mối mới!";
            }
            else
            {
                resultMessage = "Bạn không tìm thấy điều gì khả nghi ở đây (Hoặc ai đó đã lấy đi manh mối rồi).";
            }

            return true;
        }
    }

    public bool TryTamperClue(string sessionId, string playerId, string clueId, string fakeText, out string? error)
    {
        error = null;
        var session = GetOrCreateSession(sessionId);
        lock (session)
        {
            if (!session.Players.TryGetValue(playerId, out var player))
            {
                error = "Player not found.";
                return false;
            }

            if (player.Role != "Murderer")
            {
                error = "Only the Murderer can tamper with clues.";
                return false;
            }

            var clueIndex = player.UnlockedClues.FindIndex(c => c.Id == clueId);
            if (clueIndex == -1)
            {
                error = "You do not own this clue.";
                return false;
            }

            var clue = player.UnlockedClues[clueIndex];
            
            if (!clue.IsTamperable)
            {
                error = "This clue cannot be tampered with.";
                return false;
            }

            if (clue.TamperCount >= clue.MaxTamperLimit)
            {
                error = "You have reached the maximum tamper limit for this clue.";
                return false;
            }

            // Update clue
            player.UnlockedClues[clueIndex] = clue with 
            { 
                FakeDescription = fakeText, 
                TamperCount = clue.TamperCount + 1 
            };

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

    public bool TryToggleReady(string sessionId, string playerId, out bool isReady, out string? error)
    {
        isReady = false;
        error = null;

        var session = GetOrCreateSession(sessionId);

        lock (session)
        {
            if (session.Phase is not GamePhase.Lobby)
            {
                error = "Chỉ có thể đổi trạng thái sẵn sàng ở Lobby.";
                return false;
            }

            if (!session.Players.TryGetValue(playerId, out var player))
            {
                error = "Player not found.";
                return false;
            }

            player.IsReady = !player.IsReady;
            isReady = player.IsReady;
            return true;
        }
    }

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
