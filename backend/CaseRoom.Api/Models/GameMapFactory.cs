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
                new[] { "study", "kitchen" },
                Exits: new[]
                {
                    // Cửa sang Study: bên phải bản đồ
                    new ExitDto("study",    ZoneCX: 1260, ZoneCY: 360, ZoneW: 40, ZoneH: 160),
                    // Cửa sang Kitchen: phía dưới bản đồ
                    new ExitDto("kitchen",  ZoneCX: 640,  ZoneCY: 700, ZoneW: 200, ZoneH: 40)
                }
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
                new[] { "briefing", "hallway" },
                Exits: new[]
                {
                    // Cửa về Briefing: bên trái
                    new ExitDto("briefing", ZoneCX: 20,   ZoneCY: 360, ZoneW: 40, ZoneH: 160),
                    // Cửa sang Hallway: phía dưới
                    new ExitDto("hallway",  ZoneCX: 640,  ZoneCY: 700, ZoneW: 200, ZoneH: 40)
                }
            ),
            new(
                "kitchen",
                "Kitchen",
                0,
                0,
                new[]
                {
                    new MapObjectDto("sink",      "Sink",      150, 250),
                    new MapObjectDto("fridge",    "Fridge",    600, 150),
                    new MapObjectDto("trash_bin", "Trash Bin", 650, 350)
                },
                new[] { "briefing", "hallway" },
                Exits: new[]
                {
                    // Cửa về Briefing: phía trên
                    new ExitDto("briefing", ZoneCX: 640,  ZoneCY: 20,  ZoneW: 200, ZoneH: 40),
                    // Cửa sang Hallway: bên phải
                    new ExitDto("hallway",  ZoneCX: 1260, ZoneCY: 360, ZoneW: 40,  ZoneH: 160)
                }
            ),
            new(
                "hallway",
                "Hallway",
                0,
                0,
                new[]
                {
                    new MapObjectDto("painting",    "Old Painting", 360, 150),
                    new MapObjectDto("locked_door", "Locked Door",  360, 350)
                },
                new[] { "study", "kitchen" },
                Exits: new[]
                {
                    // Cửa về Kitchen: bên trái
                    new ExitDto("kitchen",  ZoneCX: 20,   ZoneCY: 360, ZoneW: 40,  ZoneH: 160),
                    // Cửa về Study: phía trên
                    new ExitDto("study",  ZoneCX: 640, ZoneCY: 20, ZoneW: 200,  ZoneH: 40)
                }
            )
        };
    }
}
