namespace CaseRoom.Api.Models;

// Các DTO này dùng để gửi qua mạng (SignalR) nên chỉ chứa các trường đọc được (ReadOnly).
// Giúp giảm băng thông và bảo vệ dữ liệu gốc trên Server.

public sealed record MapRoomDto(
    string Id,
    string Name,
    int X,
    int Y,
    IReadOnlyList<MapObjectDto> Objects,
    IReadOnlyList<string> ConnectedRoomIds,
    IReadOnlyList<ItemDto>? FloorItems = null,
    IReadOnlyList<ExitDto>? Exits = null
);

/// <summary>
/// Mô tả một vùng cửa ra (Exit Zone) trên bản đồ.
/// Khi avatar chạm vào zone này, sẽ tự động teleport sang phòng TargetRoomId.
/// </summary>
public sealed record ExitDto(
    string TargetRoomId,
    /// <summary>Vị trí X (tỉ lệ 0-1280) của tâm zone cửa</summary>
    int ZoneCX,
    /// <summary>Vị trí Y (tỉ lệ 0-720) của tâm zone cửa</summary>
    int ZoneCY,
    /// <summary>Chiều rộng zone cửa</summary>
    int ZoneW = 80,
    /// <summary>Chiều cao zone cửa</summary>
    int ZoneH = 80
);

public sealed record MapObjectDto(
    string Id,
    string Name,
    int X,
    int Y,
    int? Width = null,
    int? Height = null
);

public sealed record ItemDto(
    string Id,
    string Name,
    string Description,
    string Type, // "Key", "Fuse", "Weapon", etc.
    double X = 0,
    double Y = 0
);

public sealed record CharacterAppearance(
    string AvatarColor,
    string OutfitColor,
    string HairColor,
    string Accessory,
    string Height,
    string Race
);

public sealed record ClueDto(
    string Id,
    string Title,
    string Description,
    string SourceObjectId,
    string? FakeDescription = null,
    bool IsTamperable = true, // Tạm thời set true cho dễ test
    int TamperCount = 0,
    int MaxTamperLimit = 2
);

public sealed record PlayerStateDto(
    string Id,
    string Name,
    string CurrentRoomId,
    string? CurrentObjectId,
    double X,
    double Y,
    bool IsReady,
    bool IsTalking,
    string Role,
    CharacterAppearance Appearance,
    IReadOnlyList<ItemDto> Inventory
);

public sealed record PlayerDto(
    string Id,
    string Name,
    string CurrentRoomId,
    string? CurrentObjectId,
    double X,
    double Y,
    bool IsReady,
    bool IsTalking,
    CharacterAppearance Appearance,
    string Role,
    IReadOnlyList<ItemDto> Inventory
);

public enum GamePhase
{
    Lobby,
    Briefing,
    Exploration,
    Discussion,
    FinalVote,
    Ended
}

public enum GameMode
{
    SinglePlayer,
    NpcMurderer,
    PlayerMurderer,
    EveryoneHasSecrets
}

/// <summary>
/// DTO chứa thông tin tóm tắt của một vụ án (hiển thị ở màn hình Lobby).
/// </summary>
public sealed record CaseSummaryDto(
    string Id,
    string Title,
    string Summary,
    string Difficulty,
    int EstimatedMinutes,
    string BriefingText,
    IReadOnlyList<string> SupportedModes,
    [property: System.Text.Json.Serialization.JsonIgnore] string SecretSolution = ""
);

/// <summary>
/// DTO chứa thông tin setup game, dùng để báo cho Client khi Host đổi Mode hoặc Case.
/// </summary>
public sealed record GameSetupInfo(
    string SelectedMode,
    CaseSummaryDto? SelectedCase,
    string BriefingText
);

/// <summary>
/// Chứa toàn bộ trạng thái mà Client được phép nhìn thấy tại một thời điểm.
/// Đặc biệt quan trọng: Mảng Players chỉ chứa những người trong cùng một phòng (Fog of War).
/// </summary>
public sealed record SessionSnapshotDto(
    string SessionId,
    string Phase,
    string? HostPlayerId,
    string SelectedMode,
    CaseSummaryDto? SelectedCase,
    string BriefingText,
    IReadOnlyList<MapRoomDto> Rooms,
    IReadOnlyList<PlayerDto> Players,
    IReadOnlyList<ClueDto> MyClues
);
