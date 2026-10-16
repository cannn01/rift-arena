# Kiểm thử mobile v4

- TypeScript/Vite production build qua.
- 17 test Node qua: gồm điều khiển v3, engine/multiplayer, ▲ nhảy, điều kiện/hướng dẫn Bộc phát, viewport giữ đúng aspect và kiểm tra JSON sai project/package.
- Chromium touch viewport 844×390: canvas và arena phủ đúng toàn bộ viewport (x0,y0,w844,h390); không dùng kéo dãn sprite. Đã xem ảnh game render.
- Mô phỏng native safe insets top 18px, left 36px: toolbar x38,y26 (không sát góc camera). Menu dọc với top32px được kiểm tra ở lượt cuối.
- Bấm ▲ bằng touch thật qua CDP, chụp được tư thế nhảy. Không còn nút Nhảy riêng.
- Bộc phát trong Tập luyện kích hoạt được và hiện 8s; UI giải thích thiếu 300 năng lượng trong CPU được kiểm tra ở lượt cuối.
- Capacitor sync qua và script tạo EdgeToEdge cho MainActivity mặc định. Chưa chạy Gradle/build APK hoặc phần cứng Android thật tại môi trường này.
- Google/Meta chưa thể kiểm thử đăng nhập tài khoản thật, vì cần người dùng đăng ký đúng dấu vân tay/khóa ký và cấu hình trên tài khoản của họ. Không khẳng định gói code tự sửa được lỗi [16].

Cần xác nhận trên điện thoại: menu tránh notch trong cả hai chiều xoay, độ trong suốt nút, Google/Facebook sau cấu hình, CPU và phòng online với web. Không dùng số FPS headless làm kết luận hiệu năng Android.
