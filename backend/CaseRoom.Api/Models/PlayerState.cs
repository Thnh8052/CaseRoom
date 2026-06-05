namespace CaseRoom.Api.Models;

// Trạng thái mutable gốc của một người chơi trong server memory.
public sealed class PlayerState
{
    public required string Id { get; init; }
    public required string Name { get; set; }
    public required string ConnectionId { get; set; }
    public string CurrentRoomId { get; set; } = "briefing";
    public string? CurrentObjectId { get; set; }
    public double X { get; set; } = 640; // Default center X
    public double Y { get; set; } = 360; // Default center Y
    public bool IsReady { get; set; }
    public bool IsTalking { get; set; }
    public string Role { get; set; } = "Detective";
    public CharacterAppearance Appearance { get; set; } = new("#38bdf8", "Casual", "Black", "None", "Medium", "Human");
    public List<ClueDto> UnlockedClues { get; } = new();
    public List<ItemDto> Inventory { get; } = new();

    public PlayerDto ToDto(string observerId = "") => new(
        Id,
        Name,
        CurrentRoomId,
        CurrentObjectId,
        X,
        Y,
        IsReady,
        IsTalking,
        Appearance,
        Id == observerId ? Role : "Unknown", // Chỉ hiện Role thật cho chính người chơi đó
        Inventory
    );
}
