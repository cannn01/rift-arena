import {existsSync,readFileSync} from 'node:fs';
import {join} from 'node:path';
export function checkAndroidAuth(client,env){
 if(!env.VITE_FIREBASE_PROJECT_ID)return;
 const id=env.CAP_APP_ID||'com.riftarena.game',file=join(client,'android/app/google-services.json');
 if(!existsSync(file)){console.warn('Firebase Android: đặt google-services.json vào client/android/app/ trước khi build APK.');return;}
 const config=JSON.parse(readFileSync(file,'utf8'));
 if(config.project_info?.project_id!==env.VITE_FIREBASE_PROJECT_ID)throw new Error('google-services.json thuộc Firebase project khác VITE_FIREBASE_PROJECT_ID.');
 const entry=config.client?.find(c=>c.client_info?.android_client_info?.package_name===id);
 if(!entry)throw new Error('google-services.json chưa có Android package '+id+'. Tải file cho Android app đúng package trong Firebase.');
 const gradleFile=join(client,'android/app/build.gradle');if(existsSync(gradleFile)){const actual=readFileSync(gradleFile,'utf8').match(/applicationId\s+["']([^"']+)["']/)?.[1];if(actual&&actual!==id)throw new Error('Android applicationId khác CAP_APP_ID. Không chỉ đổi biến môi trường của một dự án Android đã tạo. Kiểm tra package thực tế.');}
 const oauth=entry.oauth_client||[];
 if(!oauth.some(c=>c.client_type===3))console.warn('Google Android: thiếu Web OAuth client trong google-services.json. Bật Google provider trên Firebase rồi tải file mới.');
 if(!oauth.some(c=>c.client_type===1&&c.android_info?.certificate_hash))console.warn('Google Android: chưa thấy OAuth Android có SHA-1 trong file. Chạy gradlew signingReport, thêm SHA-1 vào Firebase và tải file mới.');
 console.log('Firebase Android: project và package khớp. Cần đối chiếu SHA-1 với đúng khóa debug/release đang cài.');
 if(env.VITE_NATIVE_FACEBOOK_ENABLED==='true'&&!(env.FACEBOOK_APP_ID&&env.FACEBOOK_CLIENT_TOKEN))throw new Error('Facebook native đã bật nhưng thiếu FACEBOOK_APP_ID hoặc FACEBOOK_CLIENT_TOKEN.');
}
