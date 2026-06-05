namespace CaseRoom.Api.Models;

public static class GameMapFactory
{
    /// <summary>
    /// Khởi tạo dữ liệu bản đồ cứng (Hardcode) với 4 căn phòng.
    /// Các phòng được nối với nhau qua ConnectedRoomIds (VD: briefing nối với library và kitchen).
    /// </summary>
    public static List<MapRoomDto> CreateDefaultRooms()
    {
        return new List<MapRoomDto>
        {
            new(
                "briefing",
                "Briefing Room",
                0,
                0,
                new[]
                {
                    new MapObjectDto("briefing_table", "Briefing Table", 640, 500, 610, 332),
                    new MapObjectDto("case_board", "Case Board", 1065, 120, 225, 225),
                    new MapObjectDto("npc_spot", "NPC Speaker", 180, 250, 180, 252)
                },
                new[] { "library", "kitchen" }
            ),
            new(
                "library",
                "Library",
                0,
                0,
                new[]
                {
                    new MapObjectDto("bookshelf", "Bookshelf", 150, 200), // Left
                    new MapObjectDto("desk", "Desk", 360, 250), // Center
                    new MapObjectDto("fireplace", "Fireplace", 550, 150) // Top right
                },
                new[] { "briefing", "hallway" }
            ),
            new(
                "kitchen",
                "Kitchen",
                0,
                0,
                new[]
                {
                    new MapObjectDto("sink", "Sink", 150, 250), // Left
                    new MapObjectDto("fridge", "Fridge", 600, 150), // Right
                    new MapObjectDto("trash_bin", "Trash Bin", 650, 350) // Bottom right
                },
                new[] { "briefing", "hallway" }
            ),
            new(
                "hallway",
                "Hallway",
                0,
                0,
                new[]
                {
                    new MapObjectDto("painting", "Old Painting", 360, 150), // Top center
                    new MapObjectDto("locked_door", "Locked Door", 360, 350) // Bottom center
                },
                new[] { "library", "kitchen" }
            )
        };
    }
}
