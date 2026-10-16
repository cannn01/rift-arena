# Sửa đăng nhập native theo lỗi trong ảnh

Web đăng nhập được nhưng Android dùng OAuth/native SDK với package và khóa ký riêng. Cloudflare chỉ phục vụ backend/web; không phải cách sửa lỗi Google [16].

## A. Google: [16] Account reauth failed

Ảnh này phù hợp với tình huống thiếu Android OAuth client khớp package + SHA-1. Cần kiểm tra thực tế, không thể kết luận chỉ từ ảnh rằng đã biết chắc khóa nào sai.

### 1. Lấy SHA của đúng bản đang cài

Mở **CMD** (không phải PowerShell), chạy:

```bat
cd /d D:\mobile\rift-arena\rift-arena\client\android
gradlew.bat signingReport
```

Nếu CMD báo JAVA_HOME/Java không có, chạy cùng lệnh trong terminal Android Studio dùng JDK đã cấu hình; có thể dùng Gradle tool window chạy task signingReport. Không cần tìm đường keytool thủ công.

Nếu cài bằng nút Run thông thường, tìm block có Variant: debug, Config: debug, lấy SHA1 và SHA-256. Không lấy block androidTest hoặc khóa của project cũ trên máy khác. Nếu cài APK release, dùng SHA của chính keystore ký release đó.

### 2. Đăng ký trong Firebase

Firebase Console → project đang dùng → bánh răng Project settings → General → Your apps → Android app **com.riftarena.game**.

Kiểm tra package khớp applicationId trong client/android/app/build.gradle. Nếu bạn đã chủ động dùng package khác thì thao tác với package thật đó, không đổi applicationId tùy tiện để chữa lỗi.

Trong SHA certificate fingerprints → Add fingerprint → thêm SHA-1 và SHA-256 của bước 1 → Save.

Authentication → Sign-in method → Google phải Enabled.

### 3. Tải lại JSON mới

Tải google-services.json mới từ Android app đúng package, thay file:

client/android/app/google-services.json

Giữ các VITE_FIREBASE_* trong client/.env.local cùng Firebase project đang chạy web. VITE_FIREBASE_APP_ID ở đây vẫn là Web app ID.

### 4. Đồng bộ và cài lại

```bat
cd /d D:\mobile\rift-arena\rift-arena
npm run android:sync
npm run android:open
```

Android Studio Run lại đúng điện thoại. Đợi thay đổi OAuth được áp dụng rồi thử Google.

Nếu vẫn lỗi: mở Logcat lọc ứng dụng của bạn, tìm các dòng quanh Google/CredentialManager/FirebaseAuth. Gửi lỗi và block signingReport (không gửi mật khẩu/keystore/service-account). Google Play services cũng cần hoạt động/cập nhật, nhưng kiểm tra package/SHA trước vì ảnh hiện tại phù hợp lỗi đăng ký OAuth.

## B. Facebook: Android chưa được cấu hình

Thông báo trong ảnh do client/.env.local chưa bật native Facebook. Bật provider Facebook trên Firebase chỉ đủ cho web, chưa hoàn tất Android.

### 1. Điền client/.env.local

Sao chép giá trị của Meta app đang dùng cho game rắn nếu muốn dùng chung Meta app:

```env
FACEBOOK_APP_ID=APP_ID_THAT
FACEBOOK_CLIENT_TOKEN=CLIENT_TOKEN_THAT
VITE_NATIVE_FACEBOOK_ENABLED=true
```

Lấy Client Token trong phần cài đặt Meta app; đây không phải App Secret. Không đưa App Secret vào frontend hoặc APK.

### 2. Cấu hình Android trong Meta

Mở Meta for Developers → Meta app đang dùng → phần cấu hình nền tảng Android:

- Package: com.riftarena.game
- Activity/Class: com.riftarena.game.MainActivity
- Key hash: của chính khóa debug/release đang ký APK.

Để chuyển SHA-1 từ signingReport sang key hash, dùng script có trong gói. Chạy từ thư mục gốc, thay chuỗi mẫu bằng SHA-1 thật:

```bat
node scripts/facebook-key-hash.mjs "AA:BB:CC:..."
```

Script chỉ nhận SHA-1 đủ 20 byte (40 ký tự hex sau bỏ dấu hai chấm), rồi in Base64 key hash. Không dùng SHA-256 cho bước này. Có thể thêm cả hash debug và release vào Meta app.

Firebase Authentication → Facebook provider phải bật, dùng App ID/Secret của cùng Meta app. Callback OAuth trên Meta phải khớp callback do Firebase hiển thị. App Secret chỉ ở cấu hình provider trên Firebase, không nằm trong client/.env.local.

Nếu Meta app ở Development, tài khoản thử cần thuộc nhóm được phép (admin/developer/tester) theo cấu hình Meta app.

### 3. Đồng bộ và cài lại

```bat
npm run android:sync
npm run android:open
```

Log sync cần báo Facebook=true. Android Studio Run lại; APK cũ không tự nhận biến môi trường mới.

Nếu package/project JSON không khớp, script mới sẽ báo rõ khi sync để sửa trước khi cài.

## Tài liệu chính thức đã đối chiếu

- https://firebase.google.com/docs/auth/android/google-signin
- https://capawesome.io/docs/sdks/capacitor/google-sign-in/ (FAQ về Account reauth failed / Android OAuth client)
- https://github.com/capawesome-team/capacitor-firebase/blob/main/packages/authentication/docs/setup-google.md
- SystemBars documentation đi kèm @capacitor/core 8.5.3 trong node_modules/@capacitor/core/system-bars.md.
