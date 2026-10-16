# RIFT ARENA — game đối kháng web + Capacitor Android

Bản 1.0 để chạy và kiểm thử đồ án. Đây là dự án mới, không ghi đè Snake Arena.

Có: 4 chiến binh pixel được vẽ bằng mã; CPU 3 cấp; luyện tập; 2 người cùng bàn phím; phòng online 2 người; khách hoặc Firebase Email/Google/Facebook; lưu thắng/thua/combo online trong SQLite; âm nhạc bạn đã cung cấp; nút cảm ứng nhiều ngón; FPS/P95/RTT; đổi server HTTPS trên Android.

Đồ họa và hoạt ảnh là bản dựng riêng, không phải sprite được trích từ game tham khảo. Bộ chiêu đã triển khai theo cơ chế bạn mô tả; chưa phải bản sao hoàn chỉnh hoặc đã cân bằng thi đấu chuyên nghiệp. Web/app dùng chung engine nhưng vẫn cần đo trên điện thoại thật. Không cam kết hết lag ở mọi mạng.

## 1. Chạy web trước — không cần đăng nhập để thử

Giải nén để có `D:\mobile\rift-arena\package.json`. Giữ nguyên `D:\mobile\snake-arena` làm dự phòng.

Mở Docker Desktop, chờ Docker sẵn sàng. Trong VS Code chọn File → Open Folder → `D:\mobile\rift-arena`. Mở Terminal → New Terminal và chọn **Command Prompt (CMD)**. Chạy từng dòng:

```bat
cd /d D:\mobile\rift-arena
copy .env.example .env
docker compose up -d --build
```

Chỉ `copy .env.example .env` ở lần đầu; lần sau không ghi đè file đã cấu hình.

Mở trình duyệt tại **http://localhost:8081**. Chọn Chơi đơn → nhân vật → độ khó → Vào trận. Không cần Firebase ở bước này. `http://localhost:3002/api/health` phải trả `"ok":true,"game":"rift-arena"`.

Game này dùng web **8081**, backend **3002**, volume **rift_data**, tách khỏi game rắn dùng 8080/3001. Hai game có thể cùng chạy nếu máy đủ tài nguyên.

Để test online: mở 2 cửa sổ trình duyệt khác nhau (một cửa sổ thường, một ẩn danh) → Solo cùng bạn bè → một máy tạo phòng, máy kia nhập mã → mỗi bên chọn nhân vật và bấm Sẵn sàng. Không dùng cùng tài khoản cho cả hai người. Hai tab chung phiên khách cũng bị chặn kết nối trùng.

Xem lỗi:
```bat
docker compose ps
docker compose logs --tail=100 backend
docker compose logs --tail=100 web
```

## 2. Cài Node để phát triển và đóng gói Android

Docker tự có Node trong container, nhưng lệnh npm ngoài CMD cần Node trên Windows.

```bat
node -v
npm -v
```

Dự án cần **Node.js 24 trở lên**. Sau khi đã cài Node:

```bat
cd /d D:\mobile\rift-arena
npm ci
npm test
npm run build
```

Nếu muốn sửa code và xem ngay, giữ backend Docker đang chạy rồi chạy `npm run dev:web`. Mở http://localhost:5173; Vite chuyển tiếp API/socket sang backend 3002. Không chạy `npm run dev:server` đồng thời với backend Docker vì cùng cổng. Dữ liệu Node chạy trực tiếp nằm trong `server/data`; dữ liệu Docker nằm trong volume riêng.

## 3. Dùng lại Firebase của game rắn

Bạn đã bật Email/Google/Facebook nên không cần tạo Firebase project mới. Tài khoản vẫn là các tài khoản cũ, thành tích game đối kháng được lưu riêng.

1. Mở `.env` của Snake Arena và `.env` của Rift Arena trong VS Code. Sao chép **giá trị** các biến `FIREBASE_PROJECT_ID`, `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_APP_ID` sang file mới. Giữ `PORT=3002`, giữ các origin mới và `VITE_API_URL=` trống cho web Docker.
2. Sao chép file service account thật của bạn vào `rift-arena\secrets\firebase-admin.json`.
3. Trong `.env` mới bỏ dấu `#` ở dòng `GOOGLE_APPLICATION_CREDENTIALS=/run/secrets/firebase-admin.json`. Tên file phải khớp bước 2.
4. Tạo cấu hình cho Vite/Android:

```bat
copy client\.env.example client\.env.local
```

5. Điền bốn biến `VITE_FIREBASE_*` vào `client/.env.local`. Sao chép `FACEBOOK_APP_ID`, `FACEBOOK_CLIENT_TOKEN` và `VITE_NATIVE_FACEBOOK_ENABLED=true` từ cấu hình cũ khi muốn dùng Facebook native. Không điền Facebook App Secret vào client.
6. Chạy:

```bat
docker compose up -d --build
```

7. Trên web vào Tài khoản, thử từng phương thức. Email/mật khẩu phải xác minh email trước khi dùng online. CPU không yêu cầu xác minh.

File service account là khóa backend: không đặt trong `client/public`, không đưa vào Git hoặc gửi bạn bè. APK không cần chứa khóa này.

## 4. Kết nối qua Internet, không dùng USB

Dùng Cloudflare tunnel như bạn đã làm, nhưng trỏ vào **web mới cổng 8081** để đi chung API và Socket.IO:

```bat
cloudflared tunnel --url http://localhost:8081
```

Lấy URL HTTPS vừa được in ra. Mở `URL/api/health` trên điện thoại; phải có `game: rift-arena`. Giữ CMD tunnel và Docker đang chạy.

Thêm nguyên origin HTTPS mới vào cuối `ALLOWED_ORIGINS` trong `.env`, cách bằng dấu phẩy. Ví dụ:

```env
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:8081,http://localhost,https://localhost,capacitor://localhost,https://TEN-MOI.trycloudflare.com
```

Sau đó:
```bat
docker compose up -d --force-recreate backend
```

Nếu đăng nhập Google/Facebook **trên website tunnel**, thêm hostname mới vào Firebase Authorized domains và kiểm tra allowlist web của Meta. Native Android dùng cấu hình package/chứng chỉ riêng. URL tunnel thay đổi thì gửi URL mới cho bạn bè; app vào Cài đặt → Địa chỉ server → Kiểm tra và lưu. Chỉ lưu URL gốc, không thêm `/api/health`.

## 5. Tạo app Android riêng để giữ app rắn

Mặc định package mới là **com.riftarena.game**. Cần đăng ký Android app này trong Firebase project hiện tại; file google-services.json của package game rắn không tự dùng được cho package mới.

1. Firebase Console → Project settings → General → Add app → Android → package `com.riftarena.game` → tải `google-services.json` mới. Dùng cùng Firebase project để giữ tài khoản.
2. Điền `VITE_API_URL=https://TEN-MOI.trycloudflare.com` trong `client/.env.local`. Giữ `CAP_ANDROID_ALLOW_HTTP=false` nếu dùng HTTPS. Giữ `CAP_APP_ID=com.riftarena.game`.
3. Trong CMD ở thư mục dự án:

```bat
npm run build
npm run android:add
```

`android:add` chỉ chạy lần đầu khi chưa có `client/android`.

4. Chép file Firebase mới vào `client\android\app\google-services.json`.
5. Chạy:

```bat
npm run android:sync
npm run android:open
```

6. Android Studio mở dự án, chờ Gradle Sync. Cắm điện thoại, bật USB debugging, chọn thiết bị và Run. Sau khi cài xong có thể tháo USB nếu API dùng tunnel HTTPS.
7. Vào Cài đặt trên app để kiểm tra URL server, rồi thử CPU trước, khách online sau, cuối cùng đăng nhập.

**Google native:** thêm SHA-1 và SHA-256 của khóa debug/release đang dùng vào Firebase Android app mới. Có thể lấy debug bằng Android Studio Terminal tại `client/android`:
```bat
gradlew.bat signingReport
```
Tải lại google-services.json khi cấu hình OAuth thay đổi rồi sync/build lại.

**Facebook native:** trong Meta app hiện tại thêm nền tảng Android hoặc cấu hình Android phù hợp: package `com.riftarena.game`, activity `com.riftarena.game.MainActivity`, key hash của khóa ký APK. App ID/client token dùng lại nếu cùng Meta app. Người không phải tester cần quyền/phát hành Meta phù hợp, như game rắn đã cấu hình.

Nếu muốn dùng package cũ để thử nhanh thì phải chủ động đổi `CAP_APP_ID` **trước android:add** và dùng file Firebase đúng package đó; cài đặt sẽ thay thế app rắn khi cùng package/chữ ký. Khuyến nghị giữ package mới.

Mỗi lần sửa web/game:
```bat
npm run android:sync
```
Sau đó bấm Run lại trong Android Studio. Sync chỉ chép web build và cập nhật cấu hình; chưa tạo APK release.

Nếu cần test USB local: `VITE_API_URL=http://127.0.0.1:3002`, `CAP_ANDROID_ALLOW_HTTP=true`, sync và chạy `adb reverse tcp:3002 tcp:3002` sau mỗi lần kết nối. App mặc định yêu cầu HTTPS khi đổi server qua giao diện; URL HTTP chỉ dành cho cấu hình phát triển này.

## 6. APK gửi bạn bè

Sau khi đã test điện thoại: Android Studio → Build → Generate Signed App Bundle / APK → APK → chọn/tạo keystore → release → Finish. Giữ kỹ keystore, alias và mật khẩu. Thêm SHA/key hash của **release** vào Firebase/Meta, không chỉ debug. Gửi file APK release được Android Studio tạo ra, không gửi source hoặc khóa.

Mọi người cài APK → nhập URL tunnel hiện tại ở Cài đặt → có thể vào phòng cùng bạn. Bạn cần giữ laptop, Docker, tunnel và Internet hoạt động; khi laptop tắt, **online dừng**, còn CPU/luyện tập trong app vẫn hoạt động.

## 7. Điều khiển và phạm vi

Xem trang Chiêu thức trong game. P1: WASD, J/K/U/I; O tuyệt chiêu; P bộc phát. P2 local: mũi tên, 1/2/4/5, 6 tuyệt chiêu. Online mỗi thiết bị dùng P1. Touch hỗ trợ nhiều pointer độc lập. Có nút bật/tắt touch để thử trên desktop.

Server lưu kết quả online, thắng/thua và combo tốt nhất; SQLite trong volume `rift_data`, file `/data/rift.sqlite`. Không dùng SQLite của game rắn. Không có matchmaking công khai, spectate, chat, rollback netcode đầy đủ, hoặc reconnect vào trận đang đánh. Rời/mất kết nối tính thua; tạo phòng mới để đấu lại. CPU best combo được lưu cục bộ, không đưa lên BXH online để tránh tin điểm do client gửi.

Các file quan trọng:
- `shared/engine.mjs`: fixed-step 60 Hz, hitbox, đòn đánh, năng lượng, CPU.
- `server/index.mjs`: xác thực, phòng 2 người, kết quả SQLite, snapshot 30 Hz.
- `client/src/render.ts`: pixel art bằng Canvas 2D, HUD, hiệu ứng.
- `client/src/GameView.tsx`: game loop, nội suy/dự đoán ngắn giữa snapshot, input bàn phím/touch, đo hiệu năng.
- `client/src/auth.ts`: Firebase web + native.
- `client/capacitor.config.ts`, `scripts/android-config.mjs`: cấu hình native.

Xem `docs/BAO-CAO-VA-KIEM-THU.md` để đo và giải thích cho thầy. Xem `docs/VALIDATION.md` để biết phần nào đã kiểm thử và phần nào cần kiểm thử trên máy bạn.
