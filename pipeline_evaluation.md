# Đánh giá Pipeline CaseRoom (V2.0 - V4.0)

Tôi đã đọc toàn bộ file `caseroom_project_pipeline_updated.txt` của bạn. Đây thực sự là một bộ Game Design Document (GDD) **xuất sắc**! Ý tưởng rất có chiều sâu, kết hợp cực kỳ mượt mà giữa Social Deduction cổ điển và công nghệ AI hiện đại.

Dưới đây là nhận xét, bổ sung ý tưởng và phân loại độ khó cho các tính năng sắp tới.

## 1. Nhận xét & Đóng góp ý tưởng

- **V2.1 - V2.3 (Puzzle & Notebook)**: Việc click vào object không ra manh mối ngay mà cần một mini-puzzle + progress bar là *cực kỳ thông minh*. Nó tạo ra "độ trễ" (tension) trong game. 
    - *Ý tưởng thêm:* Nên có **Global Timer (Đồng hồ đếm ngược)**. VD: "Bạn có 15 phút trước khi cảnh sát đến". Nếu có thời gian giới hạn, việc người chơi bỏ thời gian giải mã Puzzle sẽ tạo áp lực và có tính chiến thuật cao hơn (giải puzzle hay chạy đi hỏi cung NPC?).
- **V2.4 (Internal AI)**: Ý tưởng chỉ feed cho AI những manh mối (clues) mà người chơi *đã mở khóa* là **Perfect (Hoàn hảo)**. Nó giải quyết triệt để vấn đề AI bị "ảo giác" (hallucinate) hoặc làm lộ (spoil) hung thủ sớm.
- **V2.5 (NPC Witness/Appearance)**: Quá hay! Việc NPC nói "Tôi thấy một người cao mặc áo tối màu" thay vì "Tôi thấy Player 2" mang lại đúng tinh thần suy luận phá án. 
    - *Ý tưởng thêm:* Khi người chơi tìm thấy manh mối như áo mưa, găng tay dính máu... hệ thống nên cho phép người chơi **thay đổi Temporary State** (mặc áo mưa vào để đi gây án).

## 2. Phân loại độ khó (Difficulty Sorting)

Dưới đây là mức độ khó của các tính năng tính từ thời điểm hiện tại:

### Mức độ 1: Dễ (Tiếp tục code UI/State thông thường)
- **V1.6 Character Setup Basic**: Chỉ đơn thuần là form chọn màu sắc/quần áo và lưu vào Backend.
- **V2.1 Investigation Progress Bar**: Thêm UI loading bar, lock thao tác trong 3s, sau đó hiển thị Modal.

### Mức độ 2: Trung bình (Cần thiết kế Data logic chuẩn)
- **V2.2 & V2.3 Puzzle UI & Notebook**: Hiển thị popup Quiz (Trắc nghiệm, Mở két sắt). Cần Backend validate đáp án đúng và nhả manh mối bí mật vào túi (Private Notebook) của người chơi.

### Mức độ 3: Khó (Xử lý State phức tạp)
- **V3.2 & V3.3 Player Murderer / Secret Mode**: Đây là Asymmetrical Gameplay (Gameplay bất đối xứng). Bạn phải thiết kế code sao cho Murderer có thể *Tamper (Xóa dấu vết)* bằng một Progress bar, và phải có hệ thống ghi nhận sự kiện ngầm mà không bị client khác hack đọc được.
- **V2.5 NPC Perception System**: Cực kỳ phức tạp về logic toán học. Làm sao để tính điểm: `(Ánh sáng phòng + Khoảng cách + NPC Quality) -> Tỷ lệ nhìn rõ % -> Chuỗi Text mô tả`. Cần engine sinh text riêng.

### Mức độ 4: Rất Khó & Tiềm ẩn rủi ro (AI Integration)
- **V2.4 Internal AI**: Việc viết Prompt sao cho LLM nhập vai hoàn hảo, không bị "jailbreak", phân tích logic chính xác dựa trên danh sách clue là rất khó. Ngoài ra việc kết nối tới Ollama/Cloud AI cho nhiều người chơi cùng lúc đòi hỏi xử lý Async/Queue chuẩn trên Backend để không làm nghẽn SignalR.

---

## 3. Lộ trình thực hiện tiếp theo (Next Steps Roadmap)

Vì chúng ta đã hoàn thành xuất sắc **V1.5.1, V1.5.2 và V1.5.3 (Ready System)**, lộ trình code lý tưởng nhất theo đúng thứ tự ưu tiên bây giờ sẽ là:

> [!IMPORTANT]
> **Bước 1: V1.6 - Cấu hình Nhân vật (Character Setup)**
> Chèn một bước nhỏ vào trong Lobby (bên dưới phần chọn Vụ án) để người chơi có thể chọn *Tên, Màu áo, Màu tóc*. Đây là nền tảng bắt buộc để sau này NPC có cái để nhận dạng.

> **Bước 2: V2.1 - Hệ thống Khám xét (Investigation Bar)**
> Sửa lại nút click đồ vật. Khi click vào `Case Board`, hiện 1 thanh Progress Bar 3s. Nếu thành công -> Hiện lên một Modal (Popup) báo "Đang code Puzzle".

> **Bước 3: V2.2 & V2.3 - Giải đố & Túi manh mối (Puzzle & Notebook)**
> Đắp giao diện câu hỏi Trắc nghiệm vào Modal. Trả lời đúng -> Hiện manh mối -> Lưu manh mối vào Notebook góc màn hình.

Bạn có đồng ý chúng ta đi theo lộ trình này không? Nếu có, tôi sẽ bắt tay vào code ngay **V1.6 (Cấu hình Nhân vật ở Lobby)**!
