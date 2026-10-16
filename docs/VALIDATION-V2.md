# Kiểm thử Visual Update v2

- Đối chiếu các file mã trong RAR người dùng: các file có trong gói trùng với bản v1 đang làm việc. RAR không có thư mục server; gói cập nhật chỉ chứa frontend nên dùng được với backend v1 của người dùng.
- TypeScript và Vite production build thành công.
- Capacitor android:sync thành công; các ảnh được copy vào bundle native.
- Chromium headless desktop: trang chủ, chọn nhân vật và đấu CPU tải sprite/nền; không có pageerror.
- 844×390 touch: tài nguyên nạp thành công; đã xem render thực tế, không tràn ngang.
- Hai browser context: tạo/join phòng, cả hai vào trận, hai điểm chạm đồng thời tạo đúng 2 nút pressed, không có pageerror.
- 390×844: không tràn ngang trang chủ.
- Renderer đọc alpha một lần khi tải, cache nền một lần; số particles tối đa 100 và ghost tối đa 12; ít hơn ở chế độ low. Không có tải ảnh hoặc getImageData trong vòng lặp vẽ.
- Có lượt headless ghi nhận FPS thấp/dao động khi chạy nhiều surface trong môi trường kiểm thử. Đo callback riêng cho một surface cho thấy chi phí callback trung bình dưới 1 ms, nhưng kết quả headless không đủ xác nhận trải nghiệm Android. Vì vậy không dùng số FPS trong môi trường này làm bằng chứng 60 FPS trên điện thoại.
- Chưa chạy Gradle/APK hoặc Firebase native thật; không tuyên bố đã kiểm thử điện thoại người dùng.
- Phải đo Chrome và APK release trên cùng điện thoại, cùng quality sau warm-up. Chọn low nếu thiết bị không giữ được khung hình ổn định.
