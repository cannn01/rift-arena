# Rift Arena trên Vercel + Redis — bản thử nghiệm

Web và backend cùng chạy trên Vercel Services. APK chứa giao diện web và kết nối cùng URL HTTPS. Laptop, Docker và Cloudflare Tunnel không cần hoạt động sau khi cả hai service được triển khai thành công.

**Trạng thái:** mã đã được kiểm thử bằng hai instance Node.js, Redis thật và HTTP/SSE mô phỏng API Upstash; web build thành công. Chưa xác nhận deploy Vercel hoặc độ trễ trên mạng thực. Không gọi đây là bản production đã được chứng minh.

## 1. Áp dụng gói cập nhật và tạo nhánh thử nghiệm

Trong CMD tại thư mục dự án đang chạy, tạo nhánh trước khi chép file:

```bat
cd /d D:\mobile\rift-arena
git status
git switch -c vercel-redis-preview
```

Giải nén gói `rift-arena-vercel-update.zip` rồi chép nội dung vào **đúng thư mục gốc** có `package.json`, `client`, `server`, `shared`. Đồng ý thay các file cùng tên. Gói chỉ chứa mã/tài liệu thay đổi, không phải toàn bộ dự án. Giữ nguyên `.env`, `client/.env.local`, thư mục `secrets` và keystore trên máy.

```bat
npm ci
npm run build
git add .
git diff --cached --name-only
git commit -m "Add Vercel Redis cloud preview"
git push -u origin vercel-redis-preview
```

Kiểm tra danh sách staged không có file bí mật trước khi commit. Không đưa `.env` lên Git. Nhánh `main` vẫn là bản ổn định, chưa hợp nhất nhánh thử nghiệm.

## 2. Cấu hình cloud local trước

Giữ nguyên `.env`, thêm hoặc cập nhật:

```dotenv
UPSTASH_REDIS_REST_URL=YOUR_REDIS_HTTPS_URL
UPSTASH_REDIS_REST_TOKEN=YOUR_REDIS_TOKEN
GUEST_SECRET=YOUR_RANDOM_SECRET_AT_LEAST_32_CHARACTERS
REDIS_NAMESPACE=rift-cloud-v1
```

Sinh một giá trị ngẫu nhiên cho GUEST_SECRET, chép kết quả vào `.env` và sau đó vào Vercel:

```bat
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Không chia sẻ giá trị này. Mọi instance của cùng môi trường phải dùng cùng secret. Đổi secret sẽ làm phiên khách cũ hết hiệu lực.

Để test cloud backend trực tiếp trên Windows với Firebase hiện tại, đường dẫn `/run/secrets/...` chỉ tồn tại trong Docker. Dùng CMD mới, đặt đường dẫn thật cho terminal đó:

```bat
set "GOOGLE_APPLICATION_CREDENTIALS=D:\mobile\rift-arena\secrets\firebase-admin.json"
set "PORT=3003"
npm run dev:cloud
```

Tên file phải đúng với file đang có trên máy bạn. Mở `http://localhost:3003/api/health`; cần thấy `ok:true`, `storage:"redis"`, `cloud:true` và `firebase:true` nếu bật Firebase. Docker cũ vẫn dùng port 3002, dữ liệu SQLite cũ không bị chuyển đổi hoặc xóa.

## 3. Chuẩn bị Firebase Admin cho Vercel

Dùng file tài khoản dịch vụ hiện đang hoạt động của bạn ở `secrets/`. Vercel không thấy file riêng này trên laptop. Chép **toàn bộ JSON** vào biến nhạy cảm `FIREBASE_SERVICE_ACCOUNT_JSON` trên Vercel. Có thể tạo JSON một dòng để dán dễ hơn:

```bat
node -e "process.stdout.write(JSON.stringify(JSON.parse(require('node:fs').readFileSync('secrets/firebase-admin.json','utf8'))))" | clip
```

Lệnh chỉ chép vào clipboard của Windows. Không gửi JSON vào chat hoặc lưu trong mã nguồn. Dán vào Vercel xong xóa clipboard nếu dùng chung máy. Giữ nguyên các ký tự `\n` bên trong chuỗi `private_key`, không tự thay thành xuống dòng.

## 4. Import Vercel Services

- Import repository `cannn01/rift-arena`.
- Root Directory: `./` (thư mục gốc repository).
- Chọn nhánh `vercel-redis-preview` để thử. Nếu giao diện Import chưa cho chọn nhánh, tạo project rồi vào **Settings → Environments / Git → Production Branch** để chọn nhánh này và redeploy; có thể tên mục thay đổi theo giao diện.
- Application Preset: **Services**, không chỉ chọn Vite.
- `vercel.json` trên nhánh định nghĩa `web` và `backend`, không nhập các lệnh build cũ ở cấp project. Xóa override build/install/output cấp project nếu đã đặt từ hướng dẫn frontend trước.
- Node.js: **24.x**, bật **Fluid Compute**.
- Giữ Hobby/Free, không bật nâng cấp trả phí.
- Nếu có phần phạm vi mã nguồn cho từng service, cho phép truy cập file ở ngoài thư mục service: backend cần `shared/`, client cũng import `shared/` và cả hai cần lockfile ở gốc.

### Environment Variables

Đặt các biến sau trong môi trường định triển khai (Production; thêm Preview nếu muốn thử preview). Không dán cả `.env` Docker.

| Biến | Giá trị |
|---|---|
| `UPSTASH_REDIS_REST_URL` | URL Redis của bạn |
| `UPSTASH_REDIS_REST_TOKEN` | Token Redis; đánh dấu sensitive khi được hỗ trợ |
| `GUEST_SECRET` | Chuỗi ngẫu nhiên đã tạo ở bước 2; sensitive |
| `REDIS_NAMESPACE` | `rift-cloud-v1` |
| `FIREBASE_PROJECT_ID` | ID project Firebase đang dùng |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Toàn bộ JSON tài khoản dịch vụ; sensitive |
| `VITE_FIREBASE_API_KEY` | Cấu hình Firebase web hiện tại |
| `VITE_FIREBASE_AUTH_DOMAIN` | Cấu hình Firebase web hiện tại |
| `VITE_FIREBASE_PROJECT_ID` | Cùng project Firebase |
| `VITE_FIREBASE_APP_ID` | Cấu hình Firebase web hiện tại |
| `ALLOWED_ORIGINS` | `http://localhost,https://localhost,capacitor://localhost` và domain web bổ sung nếu cần |

**Không đặt `GOOGLE_APPLICATION_CREDENTIALS=/run/secrets/...` trên Vercel.** Biến này dành cho Docker.

**Không đặt `VITE_API_URL` cho web Vercel** (hoặc xóa giá trị cũ): web gọi cùng domain. Không dùng URL Cloudflare hoặc localhost. Frontend không nhận token Redis hoặc service account.

Domain deployment hiện tại và domain production do Vercel cung cấp được backend chấp nhận qua biến hệ thống. Nếu dùng custom domain, thêm chính xác `https://domain` vào `ALLOWED_ORIGINS` rồi redeploy.

Bấm Deploy. Nếu Vercel yêu cầu xác nhận sử dụng Services/WebSocket beta, đọc phạm vi trong giao diện và bật nếu gói Hobby được hỗ trợ. Nếu UI yêu cầu nâng cấp trả phí, dừng và kiểm tra giới hạn thay vì thanh toán.

## 5. Kiểm tra backend trước khi đăng nhập

Mở:

```text
https://YOUR_PROJECT.vercel.app/api/health
```

Mong đợi có `ok:true`, `storage:"redis"`, `cloud:true`, `firebase:true`.

- 404/HTML: kiểm tra đúng nhánh và routing Services trong `vercel.json`.
- 500/503: mở Runtime Logs; kiểm tra tên biến, JSON Firebase, GUEST_SECRET và kết nối Redis. Không chia sẻ log có khóa.
- `/api/health` chạy nhưng không vào phòng: kiểm tra WebSocket/Fluid Compute và domain được phép, không đánh giá backend chỉ qua health.

Trong Firebase Console → Authentication → Settings → Authorized domains, thêm domain production **không kèm https://**. Giữ redirect URI Facebook Firebase đã dùng. Nếu cấu hình Facebook có danh sách domain website, cập nhật domain mới tại đó khi cần.

Nếu deployment đang bật bảo vệ đăng nhập Vercel, chọn chế độ cho phép thầy truy cập public theo nhu cầu; APK không tự vượt qua trang đăng nhập bảo vệ deployment.

## 6. Cấu hình APK

Trong `client/.env.local`, chỉ sửa URL backend mặc định:

```dotenv
VITE_API_URL=https://YOUR_PROJECT.vercel.app
```

Giữ cấu hình Google/Facebook native, package ID, SHA và keystore hiện tại. Không thêm `/api` hoặc `/socket.io` vào URL.

Chạy:

```bat
npm run android:sync
npm run android:open
```

Trong Android Studio, build APK bằng khóa ký đã cấu hình. Bản APK cũ không có cơ chế reconnect mới; cần build từ nhánh mới để kiểm tra cloud đầy đủ.

**Ô địa chỉ server đã lưu trong app có độ ưu tiên cao hơn VITE_API_URL.** Vào cài đặt app và đổi URL Cloudflare cũ sang URL Vercel, hoặc xóa override bằng chức năng hiện có. Không cần xóa dữ liệu app nếu chỉ thay URL.

## 7. Các bài test bắt buộc trên deployment

1. Guest: web tạo phòng, APK nhập mã; thử thao tác cả hai phía.
2. Đổi vai: APK tạo phòng, web nhập mã.
3. Kiểm tra Google, Facebook, email; dùng hai tài khoản khác nhau khi solo.
4. Chơi lâu hơn 5 phút để đi qua chu kỳ khôi phục kết nối. Có thể có tạm dừng ngắn; không tuyên bố không gián đoạn.
5. Rời phòng: phía còn lại nhận kết quả; bảng thành tích không tăng lặp.
6. Tắt Wi-Fi vài giây rồi bật lại, thử khôi phục. Mất quá thời gian cho phép sẽ thua/rời phòng.
7. Kiểm tra kết quả còn sau redeploy. Dữ liệu SQLite cũ không tự xuất hiện trong Redis.
8. Tắt laptop, dùng mạng di động trên điện thoại, mở web ở máy khác và thử lại.
9. Đo RTT/P95/FPS, so với bản Docker; kiểm tra Upstash Usage và Vercel Usage.

Chỉ hợp nhất PR sau khi các kiểm tra thực tế đạt yêu cầu.

## Cách hoạt động và giới hạn

- Chế độ Docker giữ `server/index.mjs`, SQLite và quy tắc mất kết nối cũ.
- Cloud dùng `server/cloud.mjs`, Redis và HTTP server xuất qua `server/vercel.mjs`. Không ghi file cục bộ.
- Mỗi phòng có một owner lease. Owner chạy engine 60 Hz khi Function đang hoạt động; các instance khác chuyển input qua Pub/Sub và chuyển snapshot về đúng socket. Đây vẫn là server quyết định kết quả.
- State được checkpoint khoảng 500 ms, lease 4 giây, fenced writes ngăn owner hết hạn ghi đè. Khi Function chết, instance có kết nối còn sống có thể nhận quyền điều khiển; có thể khôi phục lùi tối đa khoảng một checkpoint, hoặc lâu hơn nếu Redis đang lỗi. Đây chưa phải rollback networking.
- Khi phát hiện socket mất kết nối, trận tạm dừng và cho 15 giây quay lại. Nếu instance chết đột ngột, cần thêm thời gian phát hiện session hết hạn. Không giữ trận vô thời hạn khi không còn kết nối nào.
- WebSocket được xoay vòng khoảng 4 phút để thử reconnect trước thời hạn Function; socket.io dùng WebSocket trực tiếp, không long-polling. Mạng không cho phép WebSocket sẽ không đấu online được.
- Snapshot remote có hàng đợi giới hạn, bỏ snapshot cũ nếu mạng Redis chậm. Không có bảo đảm độ trễ tương đương server Docker gần người chơi.
- Stats lưu trong Redis; lịch sử giữ 1.000 trận gần nhất. Namespace preview được tách với production. Không có công cụ tự di chuyển SQLite trong bản này.
- Chỉ dùng gói miễn phí trong hạn mức. Redis Pub/Sub, checkpoint, input và snapshot đều tiêu tốn lệnh/băng thông; Vercel cũng có hạn mức compute và transfer. **Không có bảo đảm chạy gameplay liên tục 24/7 miễn phí hoặc SLA.** Ngừng test khi gần hết hạn mức; không dùng cron/ping để cố giữ Function chạy mãi.

## Kiểm thử tự động

```bat
npm test
npm run build
```

Cloud integration mặc định skip nếu không có Redis test riêng. Để chạy, mở Redis local trên port 6379, rồi trong CMD:

```bat
set "REDIS_TEST_URL=redis://127.0.0.1:6379"
set "REDIS_TEST_REST=1"
npm test
```

Test chạy hai instance thực, Lua trên Redis thật và SDK Upstash qua bridge HTTP/SSE local. Không dùng database cloud chứa dữ liệu người dùng cho test. Chưa thay thế kiểm thử beta của Vercel trên deployment thật.

Tài liệu chính thức: [Services](https://vercel.com/docs/services), [WebSocket](https://vercel.com/docs/functions/websockets), [SQLite trên Vercel](https://vercel.com/kb/guide/is-sqlite-supported-in-vercel), [Upstash REST/PubSub](https://upstash.com/docs/redis/features/restapi).
