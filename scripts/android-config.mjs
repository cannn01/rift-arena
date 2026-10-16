import {patchAndroidTheme} from './android-theme.mjs';
import {checkAndroidAuth} from './android-auth-check.mjs';
import { readFileSync,writeFileSync,existsSync } from 'node:fs';
import { join } from 'node:path';
import { config } from 'dotenv';
const client=process.cwd().endsWith('client')?process.cwd():join(process.cwd(),'client');
config({path:join(client,'.env.local'),quiet:true});
const env=process.env,root=join(client,'android'),firebase=!!env.VITE_FIREBASE_PROJECT_ID,facebook=!!(env.FACEBOOK_APP_ID&&env.FACEBOOK_CLIENT_TOKEN),http=env.CAP_ANDROID_ALLOW_HTTP==='true';
if(!existsSync(root)){console.error('Chạy npm run android:add trước.');process.exit(1);}
const vars=join(root,'variables.gradle');let variables=readFileSync(vars,'utf8');variables=variables.replace(/\n\/\/ SNAKE PROVIDERS START[\s\S]*?\/\/ SNAKE PROVIDERS END\n?/g,'\n');variables+=`\n// SNAKE PROVIDERS START\next {\n    rgcfaIncludeGoogle = ${firebase}\n    rgcfaIncludeFacebook = ${firebase&&facebook}\n    androidxCredentialsVersion = '1.3.0'\n    androidxCredentialsPlayServicesAuthVersion = '1.3.0'\n}\n// SNAKE PROVIDERS END\n`;writeFileSync(vars,variables);
const manifest=join(root,'app/src/main/AndroidManifest.xml');let xml=readFileSync(manifest,'utf8');
xml=xml.replace(/\s*android:usesCleartextTraffic="[^"]*"/g,'');xml=xml.replace('<application','<application android:usesCleartextTraffic="'+http+'"');
xml=xml.replace(/\s*<!-- SNAKE FACEBOOK START -->[\s\S]*?<!-- SNAKE FACEBOOK END -->/g,'');
if(firebase&&facebook){xml=xml.replace('</application>',`<!-- SNAKE FACEBOOK START -->
<meta-data android:name="com.facebook.sdk.ApplicationId" android:value="@string/facebook_app_id"/>
<meta-data android:name="com.facebook.sdk.ClientToken" android:value="@string/facebook_client_token"/>
<activity android:name="com.facebook.FacebookActivity" android:configChanges="keyboard|keyboardHidden|screenLayout|screenSize|orientation" android:label="@string/app_name"/>
<activity android:name="com.facebook.CustomTabActivity" android:exported="true"><intent-filter><action android:name="android.intent.action.VIEW"/><category android:name="android.intent.category.DEFAULT"/><category android:name="android.intent.category.BROWSABLE"/><data android:scheme="@string/fb_login_protocol_scheme"/></intent-filter></activity>
<!-- SNAKE FACEBOOK END -->\n</application>`);}
writeFileSync(manifest,xml);
const strings=join(root,'app/src/main/res/values/strings.xml');let values=readFileSync(strings,'utf8').replace(/\s*<!-- SNAKE FACEBOOK START -->[\s\S]*?<!-- SNAKE FACEBOOK END -->/g,'');
const escape=value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
if(firebase&&facebook)values=values.replace('</resources>',`<!-- SNAKE FACEBOOK START -->\n<string name="facebook_app_id">${escape(env.FACEBOOK_APP_ID)}</string>\n<string name="fb_login_protocol_scheme">fb${escape(env.FACEBOOK_APP_ID)}</string>\n<string name="facebook_client_token">${escape(env.FACEBOOK_CLIENT_TOKEN)}</string>\n<!-- SNAKE FACEBOOK END -->\n</resources>`);
writeFileSync(strings,values);
if(firebase&&!existsSync(join(root,'app/google-services.json')))console.warn('Cần đặt google-services.json thật vào client/android/app/ trước khi chạy APK có Firebase.');
checkAndroidAuth(client,env);
// Enable native edge-to-edge inset dispatch only for the generated empty activity.
const appId=env.CAP_APP_ID||'com.riftarena.game',activity=join(root,'app/src/main/java',...appId.split('.'),'MainActivity.java');
if(existsSync(activity)){let java=readFileSync(activity,'utf8');if(/extends BridgeActivity\s*\{\s*\}/.test(java)){java=java.replace('import com.getcapacitor.BridgeActivity;','import com.getcapacitor.BridgeActivity;\nimport android.os.Bundle;\nimport androidx.activity.EdgeToEdge;').replace(/extends BridgeActivity\s*\{\s*\}/,'extends BridgeActivity {\n    @Override\n    public void onCreate(Bundle savedInstanceState) {\n        EdgeToEdge.enable(this);\n        super.onCreate(savedInstanceState);\n    }\n}');writeFileSync(activity,java);}}
patchAndroidTheme(root,appId);
console.log(`Android configured: Firebase=${firebase}, Facebook=${firebase&&facebook}, HTTP LAN=${http}.`);
