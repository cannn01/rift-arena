import type { CapacitorConfig } from '@capacitor/cli';
import { config as loadEnv } from 'dotenv';
loadEnv({path:'.env.local',quiet:true});
const firebase=!!process.env.VITE_FIREBASE_PROJECT_ID;
const facebook=!!(process.env.FACEBOOK_APP_ID&&process.env.FACEBOOK_CLIENT_TOKEN);
const config:CapacitorConfig={
 appId:process.env.CAP_APP_ID||'com.riftarena.game',appName:'Rift Arena',webDir:'dist',
 includePlugins:['@capacitor/app','@capacitor/screen-orientation',...(firebase?['@capacitor-firebase/authentication']:[])],
 android:{allowMixedContent:process.env.CAP_ANDROID_ALLOW_HTTP==='true'},
 plugins:{SystemBars:{insetsHandling:'css',initialViewportFitValueHint:'cover',style:'DARK'},FirebaseAuthentication:{skipNativeAuth:true,providers:firebase?['google.com',...(facebook?['facebook.com']:[])]:[]}}
};
export default config;
