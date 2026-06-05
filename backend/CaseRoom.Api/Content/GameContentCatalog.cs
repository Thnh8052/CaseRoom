using CaseRoom.Api.Models;

namespace CaseRoom.Api.Content;

public static class GameContentCatalog
{
    public static readonly IReadOnlyList<CaseSummaryDto> AvailableCases =
    [
        new(
            "blackwood_manor",
            "Blackwood Manor",
            "A classic mansion murder mystery. The victim was found in a locked room during a stormy night.",
            "Easy",
            25,
            "Welcome to Blackwood Manor. Last night, during a violent storm, the owner of the manor was found dead inside a locked study. Search the rooms, question the witnesses, and uncover who is lying.",
            ["NpcMurderer", "PlayerMurderer"],
            "Sự thật vụ án: Nạn nhân bị ám sát bởi con trai của mình vì tranh chấp tài sản. Hung thủ đã tẩm thuốc độc vào rượu, sau đó tạo hiện trường giả là tự sát trong phòng kín bằng cách khóa cửa từ bên trong rồi leo ra ngoài bằng cửa sổ."
        ),
        new(
            "midnight_train",
            "The Midnight Train",
            "A passenger disappears during a midnight train ride, leaving behind only a torn ticket and a blood-stained glove.",
            "Medium",
            30,
            "The Midnight Train left the city at 11:40 PM. Before it reached the next station, one passenger vanished. Find out what happened before the train arrives.",
            ["NpcMurderer"],
            "Sự thật vụ án: Hành khách không hề biến mất mà đã bị sát hại bởi người soát vé do phát hiện ra đường dây buôn lậu. Thi thể bị giấu dưới gầm toa chứa hàng."
        ),
        new(
            "gallery_after_dark",
            "Gallery After Dark",
            "A private art exhibition turns deadly after the lights go out and a priceless painting disappears.",
            "Medium",
            30,
            "Tonight's private exhibition was supposed to reveal a lost masterpiece. But when the lights went out, the painting vanished, and the curator was found unconscious.",
            ["NpcMurderer", "EveryoneHasSecrets"],
            "Sự thật vụ án: Bức tranh không bị đánh cắp mà chính người giám tuyển (curator) đã dàn cảnh tự đánh ngất mình để giấu bức tranh thật đi và bán ra chợ đen, hòng chuộc lợi."
        )
    ];

    public static void SeedDefaultClues(GameSessionState session)
    {
        // Độc quyền: ai lấy trước được trước.
        session.AvailableClues["desk"] =
        [
            new("clue_1", "Mảnh giấy cháy dở", "Có chữ 'gặp ở nhà kho' trên mẩu giấy.", "desk")
        ];

        session.AvailableClues["bookshelf"] =
        [
            new("clue_2", "Cuốn sách rỗng", "Bên trong cuốn sách bị khoét rỗng có một chiếc chìa khóa gỉ.", "bookshelf")
        ];

        session.AvailableClues["fridge"] =
        [
            new("clue_3", "Vết máu mờ", "Có một vết máu mờ nhạt ở tay nắm cửa tủ lạnh.", "fridge")
        ];

        session.AvailableClues["case_board"] =
        [
            new("clue_4", "Ghi chú nợ nần", "Ghi chú: Nạn nhân đang nợ 8 tỷ VND của thế giới ngầm.", "case_board")
        ];
    }
}
