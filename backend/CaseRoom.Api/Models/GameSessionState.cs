namespace CaseRoom.Api.Models;

/// <summary>
/// Trạng thái của một phiên chơi (Session).
/// Mọi thao tác ghi/xóa vào Session này ĐỀU PHẢI DÙNG `lock (session)` để tránh lỗi đa luồng.
/// </summary>
public sealed class GameSessionState
{
    public required string Id { get; init; }

    // Bản đồ (Topology) được nạp mặc định cho mọi Session.
    public List<MapRoomDto> Rooms { get; } = GameMapFactory.CreateDefaultRooms();

    // Danh sách người chơi trong Session.
    public Dictionary<string, PlayerState> Players { get; } = new();

    // Danh sách manh mối còn lại cho mỗi Object trong phòng (ObjectId -> List of clues)
    public Dictionary<string, List<ClueDto>> AvailableClues { get; } = new();

    // Danh sách vật phẩm có thể lấy từ mỗi Object trong phòng (ObjectId -> List of items)
    public Dictionary<string, List<ItemDto>> AvailableItems { get; } = new();

    // Danh sách vật phẩm bị rớt trên sàn của mỗi phòng (RoomId -> List of items)
    public Dictionary<string, List<ItemDto>> FloorItems { get; } = new();

    public GamePhase Phase { get; set; } = GamePhase.Lobby;

    public string? HostPlayerId { get; set; }

    public GameMode SelectedMode { get; set; } = GameMode.NpcMurderer;

    // Thông tin về vụ án hiện tại đang được chọn (Chỉ Host mới có quyền đổi ở Lobby).
    public string SelectedCaseId { get; set; } = "blackwood_manor";

    public string SelectedCaseTitle { get; set; } = "The Mystery of Blackwood Manor";

    public CaseSummaryDto? SelectedCase { get; set; }

    public string BriefingText { get; set; } =
        "Welcome to Blackwood Manor. A murder happened last night. " +
        "You are here to investigate. Listen carefully, search the rooms, " +
        "question the witnesses, and find the truth.";

    /// <summary>
    /// Sinh ra Snapshot dành riêng cho một người chơi.
    /// Nó sẽ tự động lọc ra những người khác nằm ngoài tầm nhìn (khác phòng).
    /// </summary>
    public SessionSnapshotDto ToSnapshotForPlayer(string playerId)
    {
        var currentRoomId = Players.TryGetValue(playerId, out var self)
            ? self.CurrentRoomId
            : "briefing";

        return ToSnapshotForRoom(currentRoomId, playerId);
    }

    /// <summary>
    /// Sinh ra Snapshot dành cho những người đứng trong một căn phòng cụ thể.
    /// </summary>
    public SessionSnapshotDto ToSnapshotForRoom(string roomId, string? targetPlayerId = null)
    {
        var myClues = targetPlayerId != null && Players.TryGetValue(targetPlayerId, out var targetPlayer)
            ? targetPlayer.UnlockedClues
            : new List<ClueDto>();

        var mappedRooms = Rooms.Select(r => 
            FloorItems.TryGetValue(r.Id, out var items) 
                ? r with { FloorItems = items } 
                : r with { FloorItems = new List<ItemDto>() }
        ).ToList();

        return new(
            Id,
            Phase.ToString(),
            HostPlayerId,
            SelectedMode.ToString(),
            SelectedCase,
            BriefingText,
            mappedRooms,
            Players.Values
                .Where(p => p.CurrentRoomId == roomId)
                .Select(p => p.ToDto(targetPlayerId ?? ""))
                .ToList(),
            myClues
        );
    }
}
