# Kết quả kiểm thử bản 1.0

## Đã thực hiện trong môi trường phát triển

- TypeScript check và Vite production build thành công.
- 9 test Node: startup/recovery và đánh trúng một lần; đỡ/phá đỡ; invulnerability của lăn; nhảy/giới hạn bản đồ; đạn/tiêu hao năng lượng; thiếu năng lượng không tung super; thắng 2 hiệp và training; replay xác định/3 AI; tích hợp Socket.IO thật.
- Test socket: từ chối token giả, tạo/join mã 6 số, giới hạn 2 chỗ, từ chối nhân vật sai, hai phía cùng initial state, movement được gửi sang bên kia, hết input tự dừng, rời phòng tính thua và lưu thắng vào SQLite.
- Chromium headless: trang chủ/CPU; 2 browser context độc lập tạo và vào phòng, cùng vào trận; không có pageerror trong lượt kiểm thử cuối.
- Viewport 844×390 có touch: 2 điểm chạm thật qua CDP tạo 2 nút pressed đồng thời rồi nhả; không có pageerror. Đây là mô phỏng trình duyệt, chưa phải Android WebView.
- Viewport 390×844: không tràn ngang trang chủ. Đã xem ảnh render desktop, gameplay, landscape touch, portrait.
- Capacitor add Android + sync thành công với cấu hình không Firebase. Không kèm thư mục Android sinh tự động trong ZIP; bạn tạo lại bằng lệnh hướng dẫn.
- Font đã đưa vào bundle để giao diện không cần tải font mạng. Hai file nhạc người dùng cung cấp đã đưa vào public/audio.

## Chưa được xác nhận ở môi trường này

- Chưa build Gradle hoặc ký APK release: môi trường không có Android SDK/Android Studio.
- Chưa đăng nhập Firebase/Google/Facebook bằng cấu hình thật của bạn. Mã tích hợp đã dùng lại, nhưng package mới cần Firebase/Meta registration và signing fingerprints đúng.
- Chưa chạy Docker image thực tế vì môi trường không có Docker; Dockerfile/compose được chuẩn bị dựa trên cấu trúc Node/nginx tương ứng. Đường backend và Vite proxy đã kiểm thử trực tiếp bằng Node.
- Chưa đo FPS/P95 trên điện thoại thật, jitter mạng Internet, nóng máy, pin hoặc test tải nhiều phòng.
- Chưa có rollback/reconnect vào trận, matchmaking hay cân bằng kỹ năng chuyên sâu.

Không dùng FPS headless làm số liệu báo cáo hiệu năng Android. Thực hiện bảng đo trong BAO-CAO-VA-KIEM-THU.md trên thiết bị của bạn trước khi kết luận.
