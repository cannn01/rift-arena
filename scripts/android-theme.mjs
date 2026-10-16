import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {join} from 'node:path';
// Keep native chrome disabled; safe-area spacing belongs inside the web header.
export function patchAndroidTheme(root,appId){
 const styles=join(root,'app/src/main/res/values/styles.xml');
 if(existsSync(styles)){
  let xml=readFileSync(styles,'utf8');
  xml=xml.replace(/(<style\s+name="AppTheme"\s+parent=")[^"]*(">)/,'$1Theme.AppCompat.DayNight.NoActionBar$2');
  xml=xml.replace(/<style\b[^>]*name="AppTheme(?:\.NoActionBar)?"[^>]*>[\s\S]*?<\/style>/g,block=>{
   block=block.replace(/\s*<item name="(?:windowActionBar|windowNoTitle|android:windowBackground)">[^<]*<\/item>/g,'');
   return block.replace('</style>','    <item name="windowActionBar">false</item>\n        <item name="windowNoTitle">true</item>\n        <item name="android:windowBackground">#101219</item>\n    </style>');
  });
  xml=xml.replace(/<style\b[^>]*name="AppTheme\.NoActionBarLaunch"[^>]*>[\s\S]*?<\/style>/g,block=>{
   if(block.includes('postSplashScreenTheme'))return block.replace(/(<item name="postSplashScreenTheme">)[^<]*(<\/item>)/,'$1@style/AppTheme.NoActionBar$2');
   return block.replace('</style>','    <item name="postSplashScreenTheme">@style/AppTheme.NoActionBar</item>\n    </style>');
  });writeFileSync(styles,xml);
 }
 const activity=join(root,'app/src/main/java',...appId.split('.'),'MainActivity.java');
 if(existsSync(activity)){
  let java=readFileSync(activity,'utf8');
  if(!java.includes('// RIFT NO TITLE START')){
   const onCreate=/void onCreate\(\s*Bundle\s+(\w+)\s*\)\s*\{/;
   const match=java.match(onCreate);
   if(match){java=java.replace(onCreate,'$&\n        // RIFT NO TITLE START\n        setTheme(R.style.AppTheme_NoActionBar);\n        // RIFT NO TITLE END');
    const superCall='super.onCreate('+match[1]+');';
    java=java.replace(superCall,superCall+'\n        if (getSupportActionBar() != null) getSupportActionBar().hide();');writeFileSync(activity,java);
   }else console.warn('MainActivity có cấu trúc tùy chỉnh: kiểm tra NoActionBar trong onCreate trước super.onCreate.');
  }
 }
 console.log('Android theme: NoActionBar; native title disabled.');
}
