namespace CaseRoom.Api.Models;

#region Data Transfer Objects (DTOs)
// Các DTO này dùng để gửi qua mạng (SignalR) nên chỉ chứa các trường đọc được (ReadOnly).
// Giúp giảm băng thông và bảo vệ dữ liệu gốc trên Server.

public sealed record MapRoomDto(
    string Id,
    string Name,
    int X,
    int Y,
    IReadOnlyList<MapObjectDto> Objects,
    IReadOnlyList<string> ConnectedRoomIds
);

public sealed record MapObjectDto(
    string Id,
    string Name,
    int X,
    int Y
);

public sealed record PlayerDto(
    string Id,
    string Name,
    string CurrentRoomId,
    string? CurrentObjectId,
    bool IsTalking
);

/// <summary>
/// Chứa toàn bộ trạng thái mà Client được phép nhìn thấy tại một thời điểm.
/// Đặc biệt quan trọng: Mảng Players chỉ chứa những người trong cùng một phòng (Fog of War).
/// </summary>
public sealed record SessionSnapshotDto(
    string SessionId,
    IReadOnlyList<MapRoomDto> Rooms,
    IReadOnlyList<PlayerDto> Players
);
#endregion

#region Server States (Mutable)
// Các Class này là trạng thái gốc nằm trên RAM của Server.
// Chúng có thể bị sửa đổi (Mutable) thông qua GameStateStore.

public sealed class PlayerState
{
    public required string Id { get; init; }
    public required string Name { get; init; }
    public required string ConnectionId { get; set; }
    public string CurrentRoomId { get; set; } = "briefing";
    public string? CurrentObjectId { get; set; }
    public bool IsTalking { get; set; }

    public PlayerDto ToDto() => new(
        Id,
        Name,
        CurrentRoomId,
        CurrentObjectId,
        IsTalking
    );
}

/// <summary>
/// Trạng thái của một phiên chơi (Session).
/// Mọi thao tác ghi/xóa vào Session này ĐỀU PHẢI DÙNG `lock (session)` để tránh lỗi đa luồng.
/// </summary>
public sealed class GameSessionState
{
    public required string Id { get; init; }
    
    // Bản đồ (Topology) được nạp mặc định cho mọi Session.
    public List<MapRoomDto> Rooms { get; } = CreateDefaultRooms();
    
    // Danh sách người chơi trong Session.
    public Dictionary<string, PlayerState> Players { get; } = new();

    /// <summary>
    /// Sinh ra Snapshot dành riêng cho một người chơi.
    /// Nó sẽ tự động lọc ra những người khác nằm ngoài tầm nhìn (khác phòng).
    /// </summary>
    public SessionSnapshotDto ToSnapshotForPlayer(string playerId)
    {
        var currentRoomId = Players.TryGetValue(playerId, out var self)
            ? self.CurrentRoomId
            : "briefing";

        return ToSnapshotForRoom(currentRoomId);
    }

    /// <summary>
    /// Sinh ra Snapshot dành cho những người đứng trong một căn phòng cụ thể.
    /// </summary>
    public SessionSnapshotDto ToSnapshotForRoom(string roomId) => new(
        Id,
        Rooms,
        Players.Values
            .Where(p => p.CurrentRoomId == roomId) // LUẬT BẢO MẬT KHÔNG GIAN (Fog of War)
            .Select(p => p.ToDto())
            .ToList()
    );

    #region Topology (Bản đồ)
    /// <summary>
    /// Khởi tạo dữ liệu bản đồ cứng (Hardcode) với 4 căn phòng.
    /// Các phòng được nối với nhau qua ConnectedRoomIds (VD: briefing nối với library và kitchen).
    /// </summary>
    private static List<MapRoomDto> CreateDefaultRooms()
    {
        return new List<MapRoomDto>
        {
            new(
                "briefing",
                "Briefing Room",
                420,
                120,
                new[]
                {
                    new MapObjectDto("briefing_table", "Briefing Table", 420, 150),
                    new MapObjectDto("case_board", "Case Board", 520, 130),
                    new MapObjectDto("npc_spot", "NPC Speaker", 320, 130)
                },
                new[] { "library", "kitchen" }
            ),
            new(
                "library",
                "Library",
                220,
                330,
                new[]
                {
                    new MapObjectDto("bookshelf", "Bookshelf", 170, 330),
                    new MapObjectDto("desk", "Desk", 250, 360),
                    new MapObjectDto("fireplace", "Fireplace", 310, 300)
                },
                new[] { "briefing", "hallway" }
            ),
            new(
                "kitchen",
                "Kitchen",
                610,
                330,
                new[]
                {
                    new MapObjectDto("sink", "Sink", 560, 340),
                    new MapObjectDto("fridge", "Fridge", 650, 300),
                    new MapObjectDto("trash_bin", "Trash Bin", 690, 370)
                },
                new[] { "briefing", "hallway" }
            ),
            new(
                "hallway",
                "Hallway",
                420,
                500,
                new[]
                {
                    new MapObjectDto("painting", "Old Painting", 370, 500),
                    new MapObjectDto("locked_door", "Locked Door", 470, 500)
                },
                new[] { "library", "kitchen" }
            )
        };
    }
    #endregion
}
#endregion
