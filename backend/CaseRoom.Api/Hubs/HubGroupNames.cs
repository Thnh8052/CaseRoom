namespace CaseRoom.Api.Hubs;

/// <summary>
/// Quản lý việc tạo tên định danh (Group Name) cho các SignalR Groups.
/// Tách rời logic này giúp GameHub và VoiceHub đồng bộ cách gọi tên phòng.
/// </summary>
public static class HubGroupNames
{
    /// <summary>
    /// Nhóm dành cho toàn bộ người chơi trong một Session.
    /// Dùng khi muốn gửi thông báo chung (VD: Game Over, Bắt đầu game).
    /// </summary>
    public static string GameGroup(string sessionId) 
        => $"game:{Normalize(sessionId)}";

    /// <summary>
    /// Nhóm dành riêng cho những người đứng cùng một phòng (Room) trong một Session.
    /// Chỉ những ai ở trong nhóm này mới nhận được toạ độ và thông tin của nhau (Nguyên tắc Fog of War).
    /// </summary>
    public static string RoomGroup(string sessionId, string roomId) 
        => $"game:{Normalize(sessionId)}:room:{roomId}";

    /// <summary>
    /// Nhóm dành riêng cho kết nối Voice (WebRTC Signaling) của những người ở cùng phòng.
    /// Phân tách khỏi GameGroup để tránh bị quá tải dữ liệu.
    /// </summary>
    public static string VoiceGroup(string sessionId, string roomId) 
        => $"voice:{Normalize(sessionId)}:{roomId}";

    private static string Normalize(string id) 
        => id.Trim().ToLowerInvariant();
}
