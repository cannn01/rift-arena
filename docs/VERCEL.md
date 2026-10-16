# Triển khai Rift Arena trên Vercel + Upstash Redis

Web và backend cùng chạy trong một deployment Vercel Services. APK đóng gói giao diện bằng Capacitor và gọi URL HTTPS của deployment. Không cần giữ laptop, Docker hoặc Cloudflare Tunnel hoạt động.

Bản hiện tại đã được tác giả xác nhận web/app hoạt động, đăng nhập và vào phòng được. Kiểm thử trực tiếp cũng đã xác nhận hai client khách kết nối, tạo/join phòng rồi rời phòng. Độ trễ đấu online còn phụ thuộc region, Redis và mạng; đây chưa phải xác nhận hiệu năng hay kiểm thử tải đầy đủ.

## 1. Chuẩn bị mã nguồn

Dùng nhánh chứa `server/cloud.mjs`, `server/vercel.mjs` và `vercel.json` hiện tại. Trước khi hợp nhất dùng `vercel-redis-preview`; sau khi hợp nhất có thể dùng `main`.

```bat
npm ci
npm test
npm run build
```

Không chép file cấu hình hoặc khóa của tác giả vào Git. Nếu dùng lại deployment đang chạy, không cần tạo Upstash/Firebase mới.

## 2. Cấu hình Vercel

Import repository với Root Directory là thư mục gốc. Dùng Services định nghĩa trong `vercel.json` (web Vite và backend Node.js). Không áp dụng lại override build/output dành riêng cho frontend ở cấp project. Dùng Node.js 24.x và Fluid Compute.

Thiết lập các Environment Variables sau trong môi trường cần deploy:

| Biến | Giá trị |
| --- | --- |
| `UPSTASH_REDIS_REST_URL` | HTTPS REST URL của Redis |
| `UPSTASH_REDIS_REST_TOKEN` | REST token của Redis; chỉ backend |
| `GUEST_SECRET` | Chuỗi ngẫu nhiên ít nhất 32 ký tự, dùng thống nhất giữa các instance |
| `REDIS_NAMESPACE` | Ví dụ `rift-cloud-v1` |
| `FIREBASE_PROJECT_ID` | Project ID Firebase |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Toàn bộ JSON tài khoản dịch vụ Firebase Admin; chỉ backend |
| `VITE_FIREBASE_API_KEY` | Firebase web config |
| `VITE_FIREBASE_AUTH_DOMAIN` | Firebase web config |
| `VITE_FIREBASE_PROJECT_ID` | Cùng project với backend |
| `VITE_FIREBASE_APP_ID` | Firebase web config |
| `ALLOWED_ORIGINS` | `http://localhost,https://localhost,capacitor://localhost` và origin bổ sung nếu cần |

Không đặt `GOOGLE_APPLICATION_CREDENTIALS=/run/secrets/...` trên Vercel. Để trống hoặc không đặt `VITE_API_URL` khi web và API dùng cùng deployment. Không đưa Redis token, GUEST_SECRET hoặc Admin JSON vào biến `VITE_*`.

Sinh GUEST_SECRET trong CMD:

```bat
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Để chép service-account JSON của chính bạn vào clipboard Windows:

```bat
node -e "process.stdout.write(JSON.stringify(JSON.parse(require('node:fs').readFileSync('secrets/firebase-admin.json','utf8'))))" | clip
```

Dán vào biến backend `FIREBASE_SERVICE_ACCOUNT_JSON` của Vercel; không commit JSON vào source. Khi thay biến môi trường, redeploy để áp dụng.

Domain production do Vercel cung cấp được backend bổ sung qua biến hệ thống. Với custom domain hoặc client khác origin, thêm đúng `https://hostname` vào `ALLOWED_ORIGINS`. Chọn chế độ truy cập phù hợp để người dùng/APK không gặp trang đăng nhập bảo vệ deployment.

## 3. Routing và WebSocket

Giữ cấu hình `vercel.json` hiện tại: `/api/:path*` tới backend; `/socket.io/:path*` chọn backend với `path: '/index'`; `/` chọn web `/index.html`; tài nguyên còn lại tới web.

Client hiện kết nối bằng:

```ts
io(serverOrigin, {
  path: '/socket.io/connect',
  addTrailingSlash: false,
  transports: ['websocket'],
  // Giữ nguyên auth và các tùy chọn reconnect trong App.tsx.
});
```

Đây là minh họa các tùy chọn đường dẫn, không thay toàn bộ hàm connect bằng đoạn rút gọn này. Trên deployment đã kiểm tra, `/socket.io/` và `/socket.io/connect/` trả 404, còn `/socket.io/connect` bắt tay WebSocket và tạo/join phòng được. Vì vậy không bỏ hai tùy chọn path/addTrailingSlash khi cập nhật client. Backend hiện tại đã tiếp nhận đường dẫn này.

`/api/health` thành công chỉ chứng minh API hoạt động, chưa đủ chứng minh phòng online hoạt động.

## 4. Firebase và APK

Thêm hostname web vào Firebase Authentication → Settings → Authorized domains, không kèm `https://`. Bật provider và cấu hình OAuth/Meta theo project của bạn.

Trong `client/.env.local`:

```dotenv
VITE_API_URL=https://YOUR_PROJECT.vercel.app
CAP_APP_ID=com.riftarena.game
CAP_ANDROID_ALLOW_HTTP=false
```

Điền Firebase web config và cấu hình native nếu cần đăng nhập. Android package, google-services.json, SHA debug/release và Facebook key hash phải khớp nhau. Không thay bằng package của dự án khác.

```bat
npm run android:sync
npm run android:open
```

Build APK trong Android Studio. Nếu app đã lưu URL cũ trong cài đặt, cập nhật tại đó vì giá trị đã lưu ưu tiên hơn biến lúc build. Không thêm `/api` hay `/socket.io/connect` vào ô địa chỉ server.

## 5. Kiểm tra deployment

1. `/api/health`: có `ok:true`, `storage:"redis"`, `cloud:true`; `firebase:true` nếu bật Firebase.
2. Thử khách, Google, Facebook và email đã xác minh theo provider được cấu hình.
3. Web tạo phòng/app vào phòng và ngược lại; dùng hai danh tính khác nhau.
4. Thử sẵn sàng, đánh, rời phòng và cập nhật thành tích.
5. Thử reconnect, chơi qua chu kỳ xoay kết nối và thử mạng khác nhau.
6. Tắt laptop của người triển khai rồi thử lại.
7. Ghi FPS/RTT và theo dõi Usage Vercel/Upstash.

Lỗi 404 WebSocket: kiểm tra URL kết nối thực tế trong Network → WS và đúng commit đang Production. Lỗi 500/503: đọc Runtime Logs và kiểm tra cấu hình backend; không suy nguyên nhân chỉ từ build log. Chưa đo trên thiết bị/mạng thực thì không coi build thành công là bằng chứng gameplay mượt.

## 6. Chạy cloud backend local (tùy chọn)

Trong `.env`, điền URL/token Redis, GUEST_SECRET và cấu hình Firebase riêng. Đường dẫn `/run/secrets/...` chỉ dùng trong Docker. Khi chạy bằng Node trên Windows, dùng đường dẫn thật trong terminal đó:

```bat
set "GOOGLE_APPLICATION_CREDENTIALS=D:\mobile\rift-arena\secrets\firebase-admin.json"
set "PORT=3003"
npm run dev:cloud
```

Nếu không dùng Firebase thì không cần file này và để trống FIREBASE_PROJECT_ID. Để client gọi cloud backend local, đặt `VITE_API_URL=http://localhost:3003` trong `client/.env.local`; origin `http://localhost:5173` cần nằm trong ALLOWED_ORIGINS. Khởi động lại Vite sau khi đổi biến. Để quay về Docker local, xóa giá trị VITE_API_URL. Không dùng database chứa dữ liệu thật cho integration test.

## 7. Giới hạn

- Cloud dùng Redis; Docker local vẫn dùng SQLite. Không tự di chuyển dữ liệu giữa hai chế độ.
- Các instance phối hợp owner phòng, input và snapshot qua Redis; không đảm bảo hai người ở cùng instance. Đây có thể là nguồn độ trễ.
- Backend chạy mô phỏng 60 Hz, gửi snapshot dự kiến 30 Hz; tốc độ thực tế phụ thuộc môi trường. Client dự đoán ngắn, chưa có rollback netcode hoàn chỉnh.
- Checkpoint khoảng 500 ms; owner lease và reconnect giúp khôi phục nhưng không bảo đảm trận không gián đoạn. Quá thời gian mất kết nối có thể bị xử thua.
- Socket được xoay vòng khoảng 4 phút để reconnect trước giới hạn duration. Lịch sử cloud giữ tối đa 1.000 trận gần nhất.
- Gói miễn phí có hạn mức compute, request, Redis command và băng thông. Không bảo đảm hoạt động 24/7 không giới hạn hoặc SLA.

## 8. Integration test riêng

```bat
set "REDIS_TEST_URL=redis://127.0.0.1:6379"
set "REDIS_TEST_REST=1"
npm test
```

Cần Redis test đang chạy. Test cloud mặc định skip khi không cấu hình Redis test. HTTP/SSE bridge trong test kiểm tra SDK Upstash với Redis local; không thay thế kiểm tra deployment thật.

Tài liệu: [Vercel Services](https://vercel.com/docs/services), [WebSocket](https://vercel.com/docs/functions/websockets), [Socket.IO client options](https://socket.io/docs/v4/client-options/), [Upstash REST](https://upstash.com/docs/redis/features/restapi).
