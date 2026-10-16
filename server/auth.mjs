import { createHmac, randomUUID, randomBytes, timingSafeEqual } from 'node:crypto';
import { existsSync,readFileSync,writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { initializeApp,applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { cleanName } from './catalog.mjs';
export function createAuth({directory,projectId,secret,allowGuest=true,requireVerified=true}){
 const path=join(directory,'guest-secret');
 if(!secret||secret.startsWith('replace-')){secret=existsSync(path)?readFileSync(path,'utf8'):randomBytes(32).toString('hex');if(!existsSync(path))writeFileSync(path,secret,{mode:0o600});}
 const firebase=projectId?getAuth(initializeApp({credential:applicationDefault(),projectId})):null;
 const sign=value=>createHmac('sha256',secret).update(value).digest('base64url');
 return {
  enabled:!!firebase,
  guest(name){if(!allowGuest)throw new Error('Chơi khách đã bị tắt.');const data=Buffer.from(JSON.stringify({uid:'guest:'+randomUUID(),name:cleanName(name),exp:Date.now()+30*86400_000})).toString('base64url');return 'guest.'+data+'.'+sign(data);},
  async verify(token){
   if(typeof token!=='string'||token.length>10000)throw new Error('Vui lòng đăng nhập.');
   if(token.startsWith('guest.')){
    if(!allowGuest)throw new Error('Chơi khách đã bị tắt.');const [,data,signature]=token.split('.');const expected=sign(data??'');const a=Buffer.from(signature??''),b=Buffer.from(expected);
    if(a.length!==b.length||!timingSafeEqual(a,b))throw new Error('Phiên khách không hợp lệ.');
    const user=JSON.parse(Buffer.from(data,'base64url').toString());if(user.exp<Date.now()||!user.uid.startsWith('guest:'))throw new Error('Phiên khách đã hết hạn.');return {...user,guest:true};
   }
   if(!firebase)throw new Error('Backend chưa được cấu hình Firebase.');
   const decoded=await firebase.verifyIdToken(token,true);
   if(requireVerified&&decoded.firebase?.sign_in_provider==='password'&&!decoded.email_verified)throw new Error('Hãy xác minh email rồi bấm “Đã xác minh” trước khi chơi.');
   return {uid:decoded.uid,name:decoded.name??decoded.email?.split('@')[0]??'Người chơi',guest:false};
  }
 };
}
