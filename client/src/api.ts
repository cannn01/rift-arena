import { Capacitor } from '@capacitor/core';
const savedServer=Capacitor.isNativePlatform()?localStorage.getItem('rift.server'):null;
export const API=(savedServer??import.meta.env.VITE_API_URL??'').replace(/\/$/,'');
export async function api<T>(path:string,token?:string,options:RequestInit={}):Promise<T>{
 if(Capacitor.isNativePlatform()&&!API)throw new Error('App chưa có VITE_API_URL. Xem hướng dẫn Android rồi build lại.');
 let response:Response;
 try{response=await fetch(API+'/api'+path,{...options,headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{}),...options.headers},signal:AbortSignal.timeout(12000)});}catch{throw new Error('Không kết nối được backend. Kiểm tra Docker, địa chỉ server và mạng.');}
 const result=await response.json();if(!response.ok)throw new Error(result.error??'Yêu cầu không thành công.');return result as T;
}
