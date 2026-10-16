import { useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { API } from './api';
export default function ServerSettings(){
 const [address,setAddress]=useState(API),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 if(!Capacitor.isNativePlatform())return null;
 async function connect(){
  if(busy)return;
  setBusy(true);setMessage('');
  try{
   let url:URL;
   try{url=new URL(address.trim());}catch{throw new Error('Nhập URL đầy đủ, bắt đầu bằng https://.');}
   if(url.protocol!=='https:')throw new Error('Địa chỉ server phải dùng HTTPS.');
   if(url.username||url.password||url.search||url.hash||(url.pathname!=='/'&&url.pathname!==''))throw new Error('Chỉ nhập địa chỉ gốc của server, không thêm /api hoặc tham số.');
   const response=await fetch(url.origin+'/api/health',{signal:AbortSignal.timeout(12000),cache:'no-store'});
   if(!response.ok)throw new Error('Server trả lỗi. Kiểm tra Docker và tunnel.');
   const result=await response.json();
   if(result.game!=='rift-arena'||result.ok!==true||typeof result.firebase!=='boolean'||typeof result.rooms!=='number')throw new Error('Địa chỉ này không trả về dữ liệu server Rift Arena.');
   localStorage.setItem('rift.server',url.origin);
   if(url.origin!==API)localStorage.removeItem('rift.guest');
   window.location.reload();
  }catch(error){setMessage(error instanceof Error&&error.name!=='TypeError'&&error.name!=='TimeoutError'?error.message:'Không kết nối được server. Kiểm tra địa chỉ, Internet, Docker và tunnel.');}
  finally{setBusy(false);}
 }
 return <section style={{marginBottom:24,paddingBottom:16,borderBottom:'1px solid #ffffff30'}}>
  <label>Địa chỉ server<input type="url" value={address} onChange={e=>setAddress(e.target.value)} placeholder="https://…trycloudflare.com" autoCapitalize="none" autoCorrect="off" spellCheck={false} disabled={busy}/></label>
  <p className="small-note">Chỉ nhập địa chỉ do người quản lý game cung cấp. Khi địa chỉ đổi, dán URL mới tại đây. Đổi server sẽ tải lại app.</p>
  <button type="button" disabled={busy} onClick={()=>void connect()}>{busy?'Đang kiểm tra…':'Kiểm tra và lưu server'}</button>
  {message&&<p role="alert">{message}</p>}
 </section>;
}
