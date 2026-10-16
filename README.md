# Rift Arena

**Rift Arena** là một game đối kháng 2D chạy trên **web và Android**, sử dụng React, Canvas và Node.js. Tôi dùng Capacitor để đóng gói giao diện web thành ứng dụng Android, đồng thời giữ chung backend để người chơi có thể đấu **web ↔ web, web ↔ app và app ↔ app**.

Mục tiêu của tôi là triển khai một game có nhiều thao tác và hiệu ứng để đánh giá khả năng đáp ứng của ứng dụng đóng gói bằng Capacitor, đồng thời hỗ trợ đăng nhập và thi đấu giữa các thiết bị.

**Chơi trên web:** [rift-arena-theta.vercel.app](https://rift-arena-theta.vercel.app/)

**Tải ứng dụng Android:** [app-debug.apk](./app-debug.apk) — mở file rồi chọn **Download raw file**, hoặc [tải trực tiếp](https://raw.githubusercontent.com/cannn01/rift-arena/vercel-redis-preview/app-debug.apk).

Tôi đã triển khai web và backend bằng **Vercel Services**, sử dụng **Upstash Redis** để lưu dữ liệu online và **Firebase Authentication** để xác thực. Bản cloud hoạt động độc lập với máy tính cá nhân; người chơi chỉ cần trình duyệt hoặc APK và kết nối Internet để đăng nhập, thi đấu online. Chế độ đấu máy và luyện tập trong APK được xử lý trên thiết bị.

## Tính năng

- Bốn nhân vật với bộ chiêu, combo, đỡ, nhảy, né, tuyệt chiêu và bộc phát.
- Đấu CPU ba mức khó, luyện tập và hai người trên cùng bàn phím.
- Phòng online hai người: tạo phòng, nhập mã, chọn nhân vật và sẵn sàng.
- Chơi khách; đăng nhập email/mật khẩu, Google hoặc Facebook khi đã cấu hình Firebase/provider.
- Xác minh email, khôi phục mật khẩu và liên kết phương thức đăng nhập.
- Lưu kết quả online, thắng/thua và combo tốt nhất; bảng xếp hạng.
- Điều khiển cảm ứng nhiều ngón, nhạc nền, hiệu ứng âm thanh, chỉ số FPS/P95/RTT.
- Đổi địa chỉ backend trong phần cài đặt ứng dụng Android.

## Cách sử dụng để kiểm thử

1. Mở website hoặc tải `app-debug.apk` theo liên kết phía trên và cài trên điện thoại Android. Nếu được yêu cầu, cho phép cài ứng dụng từ nguồn đã tải APK.
2. Chọn đấu máy để thử gameplay, hoặc chọn solo cùng bạn bè.
3. Người thứ nhất tạo phòng; người thứ hai nhập mã phòng trên thiết bị của mình.
4. Mỗi bên chọn nhân vật và bấm **Sẵn sàng**.

Dùng hai tài khoản/phiên khách khác nhau. Khi thử trên cùng máy, có thể dùng một cửa sổ thường và một cửa sổ ẩn danh. Không dùng cùng tài khoản cho cả hai người.

APK hiện tại kết nối backend Vercel. Có thể kiểm tra hoặc cập nhật tại **Cài đặt → Địa chỉ server** bằng địa chỉ:

```text
https://rift-arena-theta.vercel.app
```

Chỉ nhập URL gốc; không thêm `/api/health` hoặc `/socket.io`. Tôi đã đưa bản APK hiện tại vào repository để có thể tải và kiểm thử cùng mã nguồn. Đây là bản **debug phục vụ kiểm thử**; hướng dẫn build APK riêng nằm bên dưới.

## Kiến trúc và dữ liệu

| Thành phần | Công nghệ / nhiệm vụ |
| --- | --- |
| Giao diện | React, TypeScript, Vite, Canvas 2D |
| Android | Capacitor; tài nguyên web được build và chép vào ứng dụng |
| Xác thực | Firebase Authentication; Firebase Admin kiểm tra token ở backend |
| Backend cloud | Node.js, Express, Socket.IO, Vercel Services |
| Dữ liệu cloud | Upstash Redis: phòng, trạng thái, phối hợp instance và thành tích |
| Backend local | Node.js, Socket.IO, SQLite; chạy bằng Docker hoặc Node |
| Luật chơi | Engine dùng chung trong `shared/engine.mjs`, bước mô phỏng 60 Hz |

Cloud và Docker local là **hai chế độ triển khai khác nhau**. `docker compose` vẫn chạy backend SQLite dành cho phát triển local; không tự chuyển sang Redis. Dữ liệu SQLite không tự được chuyển lên Upstash.

**Kết nối online đang dùng:** client Socket.IO đặt `path: '/socket.io/connect'`, `addTrailingSlash: false`, `transports: ['websocket']`. Tôi đã kiểm tra việc tạo và vào phòng với cấu hình này trên deployment hiện tại. Khi tự triển khai, cần giữ các tùy chọn đường dẫn phù hợp; URL gốc của backend và đường dẫn WebSocket là hai cấu hình riêng.

## Yêu cầu phát triển

- Git và Node.js **24 trở lên**, kèm npm.
- Docker Desktop nếu chạy bằng Docker Compose.
- Android Studio và Android SDK nếu build APK; dùng JDK phù hợp với Gradle của dự án (có thể dùng JDK đi kèm Android Studio).
- Firebase và Upstash nếu tự triển khai đầy đủ bản cloud.

Các lệnh dưới đây dành cho **Windows CMD**, chạy tại thư mục gốc có `package.json`.

```bat
git clone --branch vercel-redis-preview https://github.com/cannn01/rift-arena.git
cd rift-arena
```

Tôi đang lưu bản web/app kết nối Vercel trên nhánh **`vercel-redis-preview`**. Lệnh clone phía trên chọn trực tiếp nhánh này. Cài dependency:

```bat
npm ci
```

## Chạy local bằng Docker

Lần đầu tạo file cấu hình:

```bat
copy .env.example .env
```

Để thử khách và đấu máy, có thể để trống các biến Firebase. Mở Docker Desktop, rồi chạy:

```bat
docker compose up -d --build
```

- Web: http://localhost:8081
- Backend health: http://localhost:3002/api/health
- Kết quả online local: SQLite trong volume `rift_data`, file `/data/rift.sqlite`.

Lần sau chỉ cần `docker compose up -d`. Sau khi đổi mã nguồn, dùng lại `docker compose up -d --build`.

```bat
docker compose logs --tail=100 backend
docker compose down
```

`down` dừng container; không thêm `-v` nếu cần giữ dữ liệu local.

### Sửa giao diện bằng Vite

Giữ backend Docker chạy trên cổng 3002. Tạo cấu hình client lần đầu:

```bat
copy client\.env.example client\.env.local
```

Đặt `VITE_API_URL=` trống trong `client/.env.local`, rồi chạy:

```bat
npm run dev:web
```

Mở http://localhost:5173. Vite proxy `/api` và `/socket.io` sang backend local cổng 3002. Không chạy backend Node và Docker cùng cổng.

Có thể đặt `VITE_API_URL=https://rift-arena-theta.vercel.app` để client kết nối deployment cloud thay cho local. Khi đó dùng dữ liệu cloud; Firebase client phải thuộc cùng project với backend và backend phải cho phép origin client.

## Cấu hình đăng nhập

Website và APK tôi cung cấp đã được cấu hình đăng nhập; người dùng không cần tự cài Firebase để chơi. Nếu **tự build hoặc triển khai một bản riêng**, hãy tạo cấu hình Firebase cho môi trường đó theo các bước dưới đây.

1. Tạo Firebase project, bật Email/Password, Google và Facebook theo nhu cầu.
2. Thêm Firebase Web App; điền bốn biến `VITE_FIREBASE_*` trong `.env` cho Docker build, và `client/.env.local` cho Vite/Android build.
3. Thêm hostname website vào Firebase Authentication → Settings → Authorized domains.
4. Backend local: đặt service-account JSON tại `secrets/firebase-admin.json`, điền `FIREBASE_PROJECT_ID` và bật dòng `GOOGLE_APPLICATION_CREDENTIALS=/run/secrets/firebase-admin.json` trong `.env` khi chạy Docker.
5. Backend Vercel: dùng biến `FIREBASE_SERVICE_ACCOUNT_JSON` chứa toàn bộ JSON; không dùng đường dẫn `/run/secrets/...`.
6. Facebook cần cấu hình provider trong Firebase và OAuth redirect URI tương ứng trong Meta. Native Android có cấu hình riêng bên dưới.

Email/mật khẩu cần xác minh email trước khi vào online. Thành tích được lưu bởi backend; Firebase Authentication quản lý danh tính, không phải nơi lưu thành tích của bản này.

## Tự triển khai Vercel + Upstash

Xem hướng dẫn tại [docs/VERCEL.md](docs/VERCEL.md).

Tóm tắt:

1. Import repo vào Vercel ở thư mục gốc, dùng cấu hình Services trong `vercel.json`.
2. Tạo Upstash Redis; cấu hình biến Redis, Firebase và `GUEST_SECRET` ở Vercel.
3. Để trống/không đặt `VITE_API_URL` cho web cùng deployment để gọi cùng origin.
4. Deploy rồi kiểm tra `/api/health`, đăng nhập, tạo phòng và vào phòng bằng hai thiết bị.
5. Dùng URL HTTPS của deployment làm `VITE_API_URL` khi build APK.

Không cần chạy Cloudflare Tunnel cho deployment này. Vercel và Upstash có hạn mức miễn phí; theo dõi Usage. Chất lượng đấu online phụ thuộc RTT, vị trí backend/Redis, thiết bị và tải hệ thống; dự án chưa có rollback netcode hoàn chỉnh.

## Build ứng dụng Android / APK

Android package hiện tại: **`com.riftarena.game`**. Repo đã có thư mục `client/android`; không chạy `android:add` lại khi thư mục này tồn tại.

Tạo `client/.env.local` từ mẫu nếu chưa có, rồi đặt:

```dotenv
VITE_API_URL=https://rift-arena-theta.vercel.app
CAP_APP_ID=com.riftarena.game
CAP_ANDROID_ALLOW_HTTP=false
```

Nếu tự triển khai, thay URL bằng deployment của bạn. Điền Firebase web config khi cần đăng nhập; không đưa Redis token hoặc Firebase Admin JSON vào client.

Để bật đăng nhập native:

- Đăng ký Android App đúng package trong cùng Firebase project; đặt file tải về tại `client/android/app/google-services.json`.
- Google: thêm SHA-1/SHA-256 của khóa debug hoặc release đang ký vào Firebase; cập nhật file cấu hình khi cần.
- Facebook: điền `FACEBOOK_APP_ID`, `FACEBOOK_CLIENT_TOKEN`, bật `VITE_NATIVE_FACEBOOK_ENABLED=true` trong `client/.env.local`; cấu hình package, activity và key hash tương ứng trong Meta. Không đặt Facebook App Secret trong client.

```bat
npm run android:sync
npm run android:open
```

Trong Android Studio, chờ Gradle Sync rồi Run trên thiết bị hoặc máy ảo. Để tạo APK gửi người khác: **Build → Generate Signed App Bundle / APK → APK → chọn/tạo keystore → release**. Đường dẫn APK cuối cùng được Android Studio thông báo. Giữ lại keystore để các bản cập nhật dùng cùng chữ ký; cập nhật `versionCode` khi phát hành bản mới.

Nếu làm lại Android từ đầu và chưa có `client/android`, chạy `npm run build` rồi `npm run android:add` trước khi thêm file Firebase và sync.

Sau mỗi lần sửa giao diện/game, chạy `npm run android:sync` và build/cài lại APK. Deploy web không tự cập nhật tài nguyên đã đóng gói trong APK. Địa chỉ lưu trong cài đặt app có ưu tiên cao hơn `VITE_API_URL` lúc build.

## Điều khiển

| Hành động | Đơn / online | Local P1 | Local P2 |
| --- | --- | --- | --- |
| Di chuyển | A / D | A / D | ← / → |
| Hướng lên / đỡ | W / S | W / S | ↑ / ↓ |
| Nhảy | Space | Space | Numpad 0 |
| Đánh | J | F | Numpad 1 |
| Kỹ năng | K | G | Numpad 2 |
| Lăn / né | L | H | Numpad 3 |
| Tuyệt chiêu | U | R | Numpad 4 |
| Bộc phát | I | T | Numpad 5 |

Trên điện thoại dùng nút cảm ứng; **▲ là nhảy**. Bộc phát cần đầy 300 năng lượng và điều kiện hành động phù hợp; xem hướng dẫn trong game. Esc tạm dừng các chế độ offline; không dừng trận online.

## Cấu trúc và kiểm tra

| Đường dẫn | Nội dung |
| --- | --- |
| `client/src/` | UI, xác thực, input, render, âm thanh và game loop |
| `client/android/` | Dự án Android Capacitor |
| `shared/engine.mjs` | Luật chơi, nhân vật, hitbox và CPU |
| `server/index.mjs` | Backend local SQLite |
| `server/cloud.mjs` | Phòng và mô phỏng cloud |
| `server/cloud-store.mjs`, `cloud-bus.mjs` | Lưu trữ và phối hợp qua Redis |
| `server/vercel.mjs` | HTTP server entrypoint cho Vercel |
| `scripts/` | Cấu hình và kiểm tra Android |
| `vercel.json` | Services và routing deployment |
| `compose.yaml` | Môi trường Docker local |

```bat
npm test
npm run build
```

Cloud integration test cần Redis test riêng; xem [docs/VERCEL.md](docs/VERCEL.md). Test tự động không thay thế thử nghiệm web/app và đo RTT trên mạng thật.

## Lưu ý cấu hình và dữ liệu

Tôi đưa mã nguồn, file cấu hình mẫu và APK kiểm thử vào repository. Các cấu hình riêng như `.env`, `client/.env.local`, thư mục `secrets`, service-account JSON và keystore được giữ ngoài Git. Khi chạy bản riêng, sao chép các file mẫu rồi điền cấu hình cho dịch vụ tương ứng.

Cloud hỗ trợ khôi phục kết nối trong thời gian cho phép; mất kết nối lâu có thể bị xử thua. CPU best combo lưu trên thiết bị; dữ liệu online lưu trong Redis. Không có công cụ tự di chuyển SQLite sang Redis. Tôi sử dụng các dịch vụ trong hạn mức miễn phí, vì vậy khả năng truy cập bản demo còn phụ thuộc vào trạng thái deployment và hạn mức sử dụng.
