import {config} from 'dotenv';
import {fileURLToPath,pathToFileURL} from 'node:url';
config({path:fileURLToPath(new URL('../.env',import.meta.url)),quiet:true});
import express from 'express';
import cors from 'cors';
import {createServer} from 'node:http';
import {randomInt} from 'node:crypto';
import {mkdirSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {Server} from 'socket.io';
import {createAuth} from './auth.mjs';
import {cleanName} from './catalog.mjs';
import {createMatch,step,FIGHTERS} from '../shared/engine.mjs';
export function startServer({port=Number(process.env.PORT||3002),directory=process.env.DATA_DIR||'./data'}={}){
 mkdirSync(directory,{recursive:true});
 const db=new DatabaseSync(directory+'/rift.sqlite');db.exec('PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS players(uid TEXT PRIMARY KEY,name TEXT,wins INTEGER DEFAULT 0,losses INTEGER DEFAULT 0,matches INTEGER DEFAULT 0,best_combo INTEGER DEFAULT 0); CREATE TABLE IF NOT EXISTS matches(id INTEGER PRIMARY KEY,created_at TEXT DEFAULT CURRENT_TIMESTAMP,p1 TEXT,p2 TEXT,winner TEXT,score TEXT,reason TEXT);');
 const auth=createAuth({directory,projectId:process.env.FIREBASE_PROJECT_ID,secret:process.env.GUEST_SECRET});
 const app=express(),http=createServer(app),origins=(process.env.ALLOWED_ORIGINS||'http://localhost:5173,http://localhost:8081,https://localhost,http://localhost,capacitor://localhost').split(',').map(x=>x.trim());
 const allowed=o=>!o||origins.includes(o);
 app.use(cors({origin:(o,cb)=>cb(null,allowed(o))}));app.use(express.json({limit:'8kb'}));
 const limits=new Map();function limited(key,max,period){const now=Date.now();let l=limits.get(key);if(!l||now>l.until){l={n:0,until:now+period};limits.set(key,l);}return ++l.n>max;}
 const rooms=new Map(),byUid=new Map();
 app.get('/api/health',(_,res)=>res.json({ok:true,game:'rift-arena',protocol:1,firebase:auth.enabled,rooms:rooms.size}));
 app.post('/api/guest',(req,res)=>{if(limited('guest:'+req.ip,30,60000))return res.status(429).json({error:'Thử lại sau một phút.'});res.json({token:auth.guest(req.body.name)});});
 app.get('/api/me',async(req,res)=>{try{const user=await auth.verify(req.headers.authorization?.replace(/^Bearer /,''));const stats=db.prepare('SELECT * FROM players WHERE uid=?').get(user.uid);res.json({user,stats:stats||{wins:0,losses:0,matches:0,best_combo:0}});}catch(e){res.status(401).json({error:e.message});}});
 app.get('/api/leaderboard',(_,res)=>res.json(db.prepare('SELECT name,wins,matches,best_combo FROM players WHERE uid NOT LIKE ? ORDER BY wins DESC LIMIT 20').all('guest:%')));
 const io=new Server(http,{cors:{origin:(o,cb)=>cb(null,allowed(o))},allowRequest:(req,cb)=>cb(null,allowed(req.headers.origin)),maxHttpBufferSize:8192});
 io.use(async(socket,next)=>{try{socket.data.user=await auth.verify(socket.handshake.auth.token);if(byUid.has(socket.data.user.uid))throw new Error('Tài khoản này đang kết nối ở thiết bị/tab khác.');next();}catch(e){next(new Error(e.message));}});
 function view(r){return {code:r.code,phase:r.match?.phase||'lobby',players:r.players.map(p=>p?{name:p.user.name,character:p.character,ready:p.ready,connected:!!p.socket}:null)};}
 function broadcast(r){io.to(r.code).emit('room',view(r));}
 function record(r,winner,reason){if(r.recorded)return;r.recorded=true;const p=r.players;if(!p[0]||!p[1])return;db.exec('BEGIN');try{
  for(let i=0;i<2;i++){db.prepare('INSERT INTO players(uid,name,wins,losses,matches,best_combo) VALUES(?,?,?,?,1,?) ON CONFLICT(uid) DO UPDATE SET name=excluded.name,wins=wins+excluded.wins,losses=losses+excluded.losses,matches=matches+1,best_combo=MAX(best_combo,excluded.best_combo)').run(p[i].user.uid,cleanName(p[i].user.name),winner===i?1:0,winner===1-i?1:0,r.match.players[i].maxCombo);}
  db.prepare('INSERT INTO matches(p1,p2,winner,score,reason) VALUES(?,?,?,?,?)').run(p[0].user.uid,p[1].user.uid,winner===null?null:p[winner].user.uid,JSON.stringify(r.match.wins),reason);db.exec('COMMIT');
 }catch(e){db.exec('ROLLBACK');console.error('Save match failed',e.message);}}
 function leave(socket){const r=rooms.get(socket.data.room);socket.data.room=null;if(!r)return;const i=r.players.findIndex(p=>p?.socket===socket.id);if(i<0)return;
  if(r.match&&r.match.phase!=='done'){r.match.phase='done';r.match.winner=1-i;r.match.endReason='forfeit';record(r,1-i,'leave');io.to(r.code).emit('snapshot',r.match);}
  socket.leave(r.code);r.players[i]=null;r.match=null;r.recorded=false;for(const p of r.players)if(p)p.ready=false;
  if(r.players.every(p=>!p))rooms.delete(r.code);else broadcast(r);
 }
 io.on('connection',socket=>{
  // Recheck after asynchronous token verification to prevent simultaneous duplicate sessions.
  const user=socket.data.user;if(byUid.has(user.uid)){socket.emit('fatal','Tài khoản đã có kết nối khác.');socket.disconnect(true);return;}byUid.set(user.uid,socket.id);
  const handle=(name,fn)=>socket.on(name,(payload,ack)=>{if(typeof ack!=='function')return;try{if(limited('cmd:'+socket.id,30,10000))throw new Error('Thao tác quá nhanh.');ack({ok:true,...fn(payload||{})});}catch(e){ack({ok:false,error:e.message});}});
  handle('create',()=>{if(socket.data.room)throw new Error('Rời phòng hiện tại trước.');if(rooms.size>=200)throw new Error('Server đầy.');let code;do{code=String(randomInt(100000,1000000));}while(rooms.has(code));const r={code,players:[{socket:socket.id,user,character:'goku',ready:false},null],match:null,recorded:false,inputs:[0,0],queued:[[],[]],lastInput:[0,0],created:Date.now()};rooms.set(code,r);socket.data.room=code;socket.join(code);broadcast(r);return {room:view(r),seat:0};});
  handle('join',({code})=>{if(socket.data.room)throw new Error('Rời phòng hiện tại trước.');const r=rooms.get(String(code));if(!r)throw new Error('Không tìm thấy phòng.');if(r.match)throw new Error('Phòng đang thi đấu.');const seat=r.players.findIndex(p=>!p);if(seat<0)throw new Error('Phòng đã đủ 2 người.');r.players[seat]={socket:socket.id,user,character:'vegeta',ready:false};socket.data.room=r.code;socket.join(r.code);broadcast(r);return {room:view(r),seat};});
  handle('select',({character})=>{const r=rooms.get(socket.data.room);if(!r||r.match)throw new Error('Không thể đổi lúc này.');if(!FIGHTERS.some(f=>f.id===character))throw new Error('Nhân vật không hợp lệ.');const p=r.players.find(p=>p?.socket===socket.id);p.character=character;p.ready=false;broadcast(r);return {};});
  handle('ready',()=>{const r=rooms.get(socket.data.room);if(!r||r.match)throw new Error('Không thể sẵn sàng lúc này.');r.players.find(p=>p?.socket===socket.id).ready=true;if(r.players.every(p=>p?.ready)){r.match=createMatch(r.players.map(p=>p.character));r.inputs=[0,0];r.queued=[[],[]];r.lastInput=[Date.now(),Date.now()];r.recorded=false;io.to(r.code).emit('start',r.match);}broadcast(r);return {};});
  handle('rematch',()=>{const r=rooms.get(socket.data.room);if(!r||r.match?.phase!=='done')throw new Error('Trận chưa kết thúc.');r.match=null;r.recorded=false;r.players.forEach(p=>{if(p)p.ready=false;});broadcast(r);return {};});
  handle('leave',()=>{leave(socket);return {};});
  socket.on('input',bits=>{if(!Number.isInteger(bits)||bits<0||bits>1023||limited('input:'+socket.id,150,1000))return;const r=rooms.get(socket.data.room);if(!r?.match)return;const i=r.players.findIndex(p=>p?.socket===socket.id);if(i<0)return;const queue=r.queued[i];if(bits!==(queue.length?queue[queue.length-1]:r.inputs[i])&&queue.length<8)queue.push(bits);r.lastInput[i]=Date.now();});
  socket.on('ping-check',ack=>{if(typeof ack==='function')ack();});
  socket.on('disconnect',()=>{if(byUid.get(user.uid)===socket.id)byUid.delete(user.uid);leave(socket);});
 });
 let last=performance.now(),acc=0;
 const timer=setInterval(()=>{const now=performance.now();acc+=Math.min(now-last,100);last=now;let n=0;while(acc>=1000/60&&n++<6){acc-=1000/60;for(const r of rooms.values())if(r.match&&r.match.phase!=='done'){
  for(let i=0;i<2;i++){if(Date.now()-r.lastInput[i]>350){r.inputs[i]=0;r.queued[i]=[];}else if(r.queued[i].length)r.inputs[i]=r.queued[i].shift();}
  step(r.match,r.inputs);if(r.match.tick%2===0||r.match.phase==='done')io.to(r.code).emit('snapshot',r.match);
  if(r.match.phase==='done')record(r,r.match.winner,'complete');
 }}},8);
 const cleanup=setInterval(()=>{for(const [k,v]of limits)if(v.until<Date.now())limits.delete(k);for(const r of rooms.values())if(!r.match&&Date.now()-r.created>3600000){io.to(r.code).emit('fatal','Phòng đã hết hạn.');for(const p of r.players)if(p?.socket)io.sockets.sockets.get(p.socket)?.disconnect(true);rooms.delete(r.code);}},60000);
 http.listen(port,'0.0.0.0',()=>console.log(`Rift Arena backend :${http.address().port}`));
 return {http,io,rooms,close:async()=>{clearInterval(timer);clearInterval(cleanup);await new Promise(resolve=>io.close(resolve));db.close();}};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)startServer();
