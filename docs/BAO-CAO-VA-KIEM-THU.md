# Giải thích đồ án và cách đo

## Capacitor đóng vai trò gì?

Game được viết bằng React + TypeScript cho menu, Canvas 2D cho hình ảnh và JavaScript cho luật chiến đấu. Capacitor đưa bundle web đã build vào Android WebView, cung cấp cầu nối native cho Google/Facebook, orientation và trạng thái app. Nó không chuyển game thành Unity hay biên dịch mọi JavaScript thành mã Android native.

Frontend web và Android đều kết nối cùng Node.js + Socket.IO backend. Server chỉ nhận nút bấm, tự tính hitbox/máu/kết quả; client không gửi số thắng hoặc sát thương tùy ý. Firebase xác thực danh tính; SQLite lưu thành tích; phòng và trận đang đánh nằm trong RAM. Backend restart thì phòng cũ mất nhưng thành tích đã lưu còn trong volume.

Local CPU: input → engine tại thiết bị → renderer. Không cần đường mạng nên dùng để tách ảnh hưởng WebView khỏi mạng.
Online: input → server (60 bước/giây) → snapshot (30 lần/giây) → client dự đoán ngắn tối đa 100 ms và làm mượt vị trí. Đây chưa phải rollback netcode. Mạng chậm vẫn gây sửa vị trí hoặc phản hồi chậm; dùng RTT để phân biệt với chậm render.

## Vì sao phức tạp hơn game rắn?

Có trạng thái đứng/chạy/nhảy/lăn/đỡ/tấn công/choáng; frame khởi động, frame đánh trúng, frame hồi chiêu; hitbox theo khoảng cách/hướng; đạn; nhiều nút đồng thời; nối combo; phá đỡ; năng lượng; nhiều hiệp; AI 3 mức và đồng bộ realtime đa nền tảng. Đây là tải mô phỏng, render, input và mạng phù hợp để so sánh web với WebView.

## Kịch bản đo có thể lặp lại

Dùng **cùng điện thoại** so sánh Chrome và APK release. Đóng app nền, giữ độ sáng/độ phân giải/cấu hình giống nhau; ghi model, Android, Chrome/WebView, loại mạng, nhiệt độ tương đối và mức pin. Tránh dùng bản debug để kết luận cuối cùng. Warm-up 30 giây rồi đo 2 phút; lặp 3 lần mỗi kịch bản.

| Kịch bản | Việc thực hiện | Cần quan sát |
|---|---|---|
| Training | Di chuyển, nhảy, đánh, tung kỹ năng liên tục | FPS, P95, cảm ứng đa ngón |
| CPU khó | Cùng cặp nhân vật, chơi hết trận | AI + hiệu ứng + thời gian khung hình |
| Online LAN | Web vs Android, cùng Wi-Fi | FPS, RTT, hit/máu/kết quả hai bên |
| Online tunnel | Hai mạng khác nhau, cùng backend | RTT, giật do mạng, cảnh báo mất kết nối |
| Gián đoạn | Thu nhỏ app, tắt Wi-Fi, rời trận | Nút không kẹt, kết quả forfeit, vào lại phòng |
| Offline | Tắt mạng sau khi đã cài APK | CPU/luyện tập hoạt động; online báo lỗi rõ |

Bảng ghi kết quả (điền số đo thật, không bịa số):

| Thiết bị | Nền tảng | Kịch bản | FPS | P95 ms | RTT ms | Ghi chú |
|---|---|---|---|---|---|---|
| ... | Chrome | Training | | | không áp dụng | |
| ... | APK release | Training | | | không áp dụng | |
| ... | Chrome | CPU khó | | | không áp dụng | |
| ... | APK release | CPU khó | | | không áp dụng | |
| ... | APK release | Online tunnel | | | | |

Overlay cập nhật mỗi giây: FPS tính từ requestAnimationFrame; P95 từ tối đa 600 khoảng thời gian khung hình gần nhất (khoảng 10 giây ở 60 Hz); RTT là khứ hồi Socket.IO ping đo khoảng 1,5 giây/lần. Đây là chỉ báo frontend, không phải GPU profiling hoặc input-to-photon chính xác. Khi tab bị ẩn hoặc ứng dụng bị OS giới hạn, số đo có thể khác. 60 FPS tương đương khoảng 16,7 ms/frame; P95 lớn báo hiệu khung hình chậm ở đuôi phân bố. Không suy ra latency chỉ từ FPS.

## Các câu hỏi có thể gặp

**Tại sao không Unity?** Mục tiêu là đánh giá tái sử dụng web sang app qua Capacitor; chọn Canvas cho cùng một renderer và cùng luật game để so sánh.

**Nhiều nút có chứng minh hiệu năng không?** Không tự đủ. Cần workload cụ thể, nhiều hành động đồng thời, hiệu ứng/hitbox và phép đo có điều kiện kiểm soát.

**Làm sao web và app chơi cùng?** Cùng protocol socket và một server authoritative. Nền tảng frontend khác nhau nhưng ID phòng và game state chung.

**Vì sao máy lag mà FPS vẫn cao?** Có thể RTT hoặc jitter mạng cao; màn hình vẫn vẽ nhanh nhưng dữ liệu đối thủ đến chậm. Ngược lại CPU local lag chỉ ra vấn đề render/mô phỏng/WebView.

**Có gian lận không?** Client không quyết định sát thương hay kết quả; server xác minh token, giới hạn phòng/input và ghi điểm. Chưa có chống bot chuyên sâu hoặc chống DDoS; đây là bản đồ án một server.

**Mất mạng có nối lại trận được không?** Bản này kết thúc trận theo quy tắc rời phòng và cho đối thủ thắng. Không tuyên bố đã có resume/rollback.

**Phát hành mọi lúc được không?** Chỉ khi backend luôn hoạt động. Quick Tunnel miễn phí đổi URL khi khởi động; laptop tắt thì online không hoạt động. Địa chỉ server đổi được trong app.

**Điểm hạn chế và hướng mở rộng?** Cần thử nhiều thiết bị thật, cải thiện hoạt ảnh và cân bằng bộ chiêu; thêm rollback/reconnect có kiểm soát, đo jitter/drop, test tải nhiều phòng, domain ổn định và backend thường trực.

Tài liệu chính thức: https://capacitorjs.com/docs/basics/workflow ; https://socket.io/docs/v4/delivery-guarantees/ . Socket.IO không mặc định đảm bảo mọi sự kiện đều được gửi lại; vì vậy input gửi trạng thái liên tục và server tự về 0 khi quá 350 ms không nhận input, không dựa vào một sự kiện nhả nút duy nhất.
