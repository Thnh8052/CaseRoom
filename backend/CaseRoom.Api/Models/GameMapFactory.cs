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
                new[] { "study", "kitchen" }
            ),
            new(
                "study",
                "Phòng Làm Việc",
                0,
                0,
                new[]
                {
                    new MapObjectDto("desk_study", "Bàn Làm Việc", 500, 350, 250, 150),
                    new MapObjectDto("bookshelf_study", "Kệ Sách Lớn", 80, 100, 200, 400),
                    new MapObjectDto("safe_study", "Két Sắt Bí Mật", 950, 400, 100, 100),
                    new MapObjectDto("trash_bin_study", "Thùng Rác", 850, 500, 80, 80)
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
