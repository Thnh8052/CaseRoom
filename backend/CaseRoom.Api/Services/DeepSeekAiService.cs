using System.Net.Http;
using System.Net.Http.Headers;
using System.Runtime.CompilerServices;
using System.Text;
using System.Text.Json;
using CaseRoom.Api.Models;
using Microsoft.Extensions.Configuration;

namespace CaseRoom.Api.Services;

public sealed class DeepSeekAiService
{
    private readonly HttpClient _httpClient;
    private readonly string _modelName;
    private readonly string _apiKey;
    
    public DeepSeekAiService(HttpClient httpClient, IConfiguration configuration)
    {
        _httpClient = httpClient;
        _httpClient.BaseAddress = new Uri(configuration["DeepSeek:BaseUrl"] ?? "https://api.deepseek.com");
        _modelName = configuration["DeepSeek:Model"] ?? "deepseek-v4-flash";
        _apiKey = configuration["DeepSeek:ApiKey"] ?? string.Empty;

        if (!string.IsNullOrEmpty(_apiKey))
        {
            _httpClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", _apiKey);
        }
    }

    public async IAsyncEnumerable<string> StreamAskDetectiveAiAsync(
        string question, 
        string briefingText,
        string secretSolution,
        IReadOnlyList<ClueDto> clues, 
        [EnumeratorCancellation] CancellationToken cancellationToken = default)
    {
        var systemPrompt = "Bạn là Trợ lý AI của Thám tử trong trò chơi CaseRoom. " +
                           "Nhiệm vụ của bạn là phân tích các manh mối mà thám tử cung cấp và trả lời câu hỏi để gợi ý cho người chơi.\n" +
                           "--- NGỮ CẢNH VỤ ÁN ---\n" +
                           $"{briefingText}\n\n" +
                           "--- SỰ THẬT VỤ ÁN (CHỈ DÀNH CHO BẠN, KHÔNG SPOIL TRỰC TIẾP) ---\n" +
                           $"{secretSolution}\n\n" +
                           "--- MANH MỐI NGƯỜI CHƠI ĐANG CÓ ---\n" +
                           (clues.Count > 0 ? string.Join("\n", clues.Select(c => $"- {c.Title}: {c.Description}")) : "Chưa có manh mối nào.") + "\n\n" +
                           "--- QUY TẮC ---\n" +
                           "1. Dựa vào Sự thật vụ án để định hướng người chơi, tuyệt đối KHÔNG tự nói ra hung thủ hay toàn bộ sự thật nếu người chơi chưa tìm đủ manh mối hoặc chưa tự suy luận ra.\n" +
                           "2. KHÔNG bịa đặt thêm chứng cứ hay thông tin không có trong sự thật hoặc manh mối.\n" +
                           "3. Trả lời bằng tiếng Việt, xưng 'tôi', gọi người chơi là 'thám tử'. Ngắn gọn, súc tích.\n" +
                           "4. Định dạng văn bản dễ nhìn.";

        var requestBody = new
        {
            model = _modelName,
            messages = new[]
            {
                new { role = "system", content = systemPrompt },
                new { role = "user", content = question }
            },
            stream = true
        };

        // Sử dụng đường dẫn tuyệt đối /v1/chat/completions để đảm bảo nó chạy đúng dù BaseUrl có cấu hình thế nào
        var request = new HttpRequestMessage(HttpMethod.Post, "https://api.deepseek.com/v1/chat/completions")
        {
            Content = new StringContent(JsonSerializer.Serialize(requestBody), Encoding.UTF8, "application/json")
        };

        using var response = await _httpClient.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, cancellationToken);
        
        if (!response.IsSuccessStatusCode)
        {
            var errorBody = await response.Content.ReadAsStringAsync(cancellationToken);
            yield return $"[Lỗi từ AI Server] {response.StatusCode}: {errorBody}";
            yield break;
        }

        using var stream = await response.Content.ReadAsStreamAsync(cancellationToken);
        using var reader = new StreamReader(stream);

        while (!cancellationToken.IsCancellationRequested)
        {
            var line = await reader.ReadLineAsync(cancellationToken);
            if (line == null) break;
            if (string.IsNullOrWhiteSpace(line)) continue;

            // Dữ liệu từ OpenAI / DeepSeek API thường có prefix "data: "
            if (line.StartsWith("data: "))
            {
                var data = line.Substring(6);
                if (data == "[DONE]") break;

                string? chunk = null;
                try
                {
                    using var jsonDoc = JsonDocument.Parse(data);
                    if (jsonDoc.RootElement.TryGetProperty("choices", out var choicesArray) &&
                        choicesArray.GetArrayLength() > 0 &&
                        choicesArray[0].TryGetProperty("delta", out var deltaObj) &&
                        deltaObj.TryGetProperty("content", out var contentProp))
                    {
                        chunk = contentProp.GetString();
                    }
                }
                catch (JsonException)
                {
                    // Bỏ qua lỗi parse JSON nếu bị cắt
                }

                if (!string.IsNullOrEmpty(chunk))
                {
                    yield return chunk;
                }
            }
        }
    }
}
