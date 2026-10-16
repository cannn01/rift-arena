import {config} from 'dotenv';
import {fileURLToPath} from 'node:url';
config({path:fileURLToPath(new URL('../.env',import.meta.url)),quiet:true});
import express from 'express';
import cors from 'cors';
import {createServer} from 'node:http';
import {randomUUID,randomInt} from 'node:crypto';
import {Redis} from '@upstash/redis';
import {createAuth} from './auth.mjs';
import {Server} from 'socket.io';
import {createMatch,step,FIGHTERS} from '../shared/engine.mjs';
import {CloudStore} from './cloud-store.mjs';
import {CloudBus} from './cloud-bus.mjs';

const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
export function createCloudServer({redis,secret=process.env.GUEST_SECRET,projectId=process.env.FIREBASE_PROJECT_ID,
 namespace=process.env.REDIS_NAMESPACE||'rift-cloud-v1',origins=process.env.ALLOWED_ORIGINS||'',
 graceMs=15000,rotationMs=240000}={}){
 if(!redis)redis=new Redis({url:process.env.UPSTASH_REDIS_REST_URL,token:process.env.UPSTASH_REDIS_REST_TOKEN,
  automaticDeserialization:false,enableAutoPipelining:false,retry:{retries:0}});
 if(!/^[a-zA-Z0-9:_-]{1,100}$/.test(namespace))throw new Error('Invalid REDIS_NAMESPACE');
 // Preview deployments must never operate production rooms.
 if(process.env.VERCEL_ENV==='preview')namespace+=':preview:'+String(process.env.VERCEL_GIT_COMMIT_REF||'preview').replace(/[^a-zA-Z0-9_-]/g,'_').slice(0,80);
 const store=new CloudStore(redis,namespace),instance=randomUUID(),owned=new Map(),pending=new Map();
 const auth=createAuth({projectId,secret,cloud:true});
 const app=express(),http=createServer(app),allow=new Set(origins.split(',').map(s=>s.trim()).filter(Boolean));
 for(const host of [process.env.VERCEL_URL,process.env.VERCEL_PROJECT_PRODUCTION_URL])if(host)allow.add('https://'+host);
 for(const o of ['https://localhost','http://localhost','capacitor://localhost'])allow.add(o);
 const allowed=o=>!o||allow.has(o);
 app.use(cors({origin:(o,cb)=>cb(null,allowed(o))}));app.use(express.json({limit:'8kb'}));
 const io=new Server(http,{transports:['websocket'],cors:{origin:(o,cb)=>cb(null,allowed(o))},
  allowRequest:(req,cb)=>cb(null,allowed(req.headers.origin)),maxHttpBufferSize:8192});
 let closed=false,readyPromise=null,timer=null,serviceBusy=false,lastBusPing=0,subscriberRestarting=false;
 const bus=new CloudBus(redis,store.key('bus'),receive);
 const limits=new Map();
 function limited(key,max,period){const now=Date.now(),v=limits.get(key);if(!v||now>=v.until){limits.set(key,{n:1,until:now+period});return false;}return ++v.n>max;}
 const report=()=>console.error('Redis backend unavailable; room simulation paused.');
 function ready(){return readyPromise??=(async()=>{await redis.ping();await bus.start();timer=setInterval(()=>void service().catch(report),500);})();}
 const route=fn=>async(req,res)=>{try{await ready();await fn(req,res);}catch{res.status(503).json({error:'Backend chưa sẵn sàng. Kiểm tra cấu hình Redis/Firebase và thử lại.'});}};
 app.get('/api/health',route(async(_,res)=>{await redis.ping();res.json({ok:true,game:'rift-arena',protocol:1,firebase:auth.enabled,storage:'redis',cloud:true});}));
 app.post('/api/guest',route(async(req,res)=>{if(limited('guest:'+req.ip,30,60000))return res.status(429).json({error:'Thử lại sau một phút.'});res.json({token:auth.guest(req.body.name)});}));
 app.get('/api/me',route(async(req,res)=>{let user;try{user=await auth.verify(req.headers.authorization?.replace(/^Bearer /,''));}catch(e){return res.status(401).json({error:e.message});}res.json({user,stats:await store.stats(user.uid)});}));
 app.get('/api/leaderboard',route(async(_,res)=>res.json(await store.leaderboard())));
 io.use(async(socket,next)=>{try{
  await ready();socket.data.user=await auth.verify(socket.handshake.auth.token);
  const clientId=socket.handshake.auth.clientId;
  if(typeof clientId!=='string'||!/^[a-zA-Z0-9_-]{16,80}$/.test(clientId))throw new Error('Hãy cập nhật web hoặc APK để kết nối cloud.');
  socket.data.clientId=clientId;
  if(!Number(await store.claim(socket.data.user.uid,clientId,socket.id)))throw new Error('Tài khoản này đang kết nối ở thiết bị/tab khác.');
  next();
 }catch(e){next(new Error(e.message));}});
 function view(r){return {code:r.code,phase:r.match?.phase||'lobby',players:r.players.map(p=>p?{name:p.user.name,character:p.character,ready:p.ready,connected:p.connected}:null)};}
 function localEvent(code,event,data){io.to(code).emit(event,data);}
 async function emitRoom(r,event,data){localEvent(r.code,event,data);await bus.publish({kind:'event',source:instance,code:r.code,event,data});}
 function queue(a,fn){const result=a.chain.then(fn);a.chain=result.catch(()=>{});return result;}
 function own(r){const a={room:r,until:performance.now()+3000,chain:Promise.resolve(),saving:false,publishing:false,latest:null,last:performance.now(),acc:0,timer:null};
  a.timer=setInterval(()=>tick(a),8);owned.set(r.code,a);return a;}
 function drop(code){const a=owned.get(code);if(a)clearInterval(a.timer);owned.delete(code);}
 async function checkpoint(a){
  const began=performance.now();
  if(!await store.checkpoint(a.room,instance)){drop(a.room.code);throw new Error('Phòng đang chuyển server, hãy thử lại.');}
  a.until=began+3000;
 }
 async function locate(code){
  if(owned.has(code)&&performance.now()<owned.get(code).until)return instance;
  const current=await store.owner(code);if(current)return current;
  if(!await store.acquire(code,instance))return await store.owner(code);
  const room=await store.load(code);if(!room){await store.release(code,instance);throw new Error('Không tìm thấy phòng.');}
  // A recovered owner does not replay unobserved wall-clock time or stale inputs.
  room.inputs=[0,0];room.queued=[[],[]];room.lastInput=[0,0];
  const a=own(room);await checkpoint(a);return instance;
 }
 async function request(code,op,payload,user,clientId,socketId){
  for(let attempt=0;attempt<3;attempt++){
   const target=await locate(code);if(!target)continue;
   const request={kind:'request',source:instance,target,id:randomUUID(),code,op,payload,user,clientId,socketId};
   if(target===instance)return await operate(request);
   try{return await new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>{pending.delete(request.id);reject(new Error('Phòng đang chuyển server, hãy thử lại.'));},1800);
    pending.set(request.id,{resolve,reject,timer});bus.publish(request).catch(()=>{clearTimeout(timer);pending.delete(request.id);reject(new Error('Không kết nối được Redis.'));});
   });}catch(e){if(attempt===2)throw e;await wait(300);}
  }
  throw new Error('Phòng đang chuyển server, hãy thử lại.');
 }
 async function receive(m){
  if(!m||closed)return;
  if(m.kind==='reply'&&m.target===instance){const p=pending.get(m.id);if(p){clearTimeout(p.timer);pending.delete(m.id);m.error?p.reject(new Error(m.error)):p.resolve(m.result);}return;}
  if(m.kind==='event'&&m.source!==instance){localEvent(m.code,m.event,m.data);return;}
  if(m.kind==='input'&&m.target===instance){const a=owned.get(m.code);if(a)applyInput(a.room,m);return;}
  if(m.kind==='request'&&m.target===instance){try{const result=await operate(m);await bus.publish({kind:'reply',target:m.source,id:m.id,result});}catch(e){await bus.publish({kind:'reply',target:m.source,id:m.id,error:e.message}).catch(report);}}
 }
 function seatOf(r,m){return r.players.findIndex(p=>p?.user.uid===m.user.uid&&p.clientId===m.clientId);}
 function applyInput(r,m){const i=seatOf(r,m);if(i<0||r.players[i].socket!==m.socketId||!r.match||r.match.phase==='done')return;
  const q=r.queued[i];for(const bits of m.bits){if(Number.isInteger(bits)&&bits>=0&&bits<=1023&&q.length<8&&bits!==(q.length?q.at(-1):r.inputs[i]))q.push(bits);}
  r.lastInput[i]=Date.now();
 }
 async function operate(m){
  const a=owned.get(m.code);if(!a||performance.now()>=a.until)throw new Error('Phòng đang chuyển server, hãy thử lại.');
  return queue(a,async()=>{
   const r=a.room;let seat=seatOf(r,m),p=r.players[seat];
   if(m.op==='join'){
    if(seat>=0){if(p.clientId!==m.clientId)throw new Error('Tài khoản đã có trong phòng.');}
    else {if(r.match)throw new Error('Phòng đang thi đấu.');seat=r.players.findIndex(p=>!p);if(seat<0)throw new Error('Phòng đã đủ 2 người.');
     p=r.players[seat]={user:m.user,clientId:m.clientId,socket:m.socketId,connected:true,disconnectedAt:0,character:seat?'vegeta':'goku',ready:false};}
    await store.mapUser(m.user.uid,r.code);
   }else if(seat<0)throw new Error('Bạn không còn ở trong phòng.');
   if(m.op==='resume'||m.op==='join'){
    p.socket=m.socketId;p.connected=true;p.disconnectedAt=0;
    await checkpoint(a);await emitRoom(r,'room',view(r));
    return {room:view(r),seat,match:r.match,matchId:r.matchId};
   }
   if(p.socket!==m.socketId)throw new Error('Kết nối đã được thay thế.');
   if(m.op==='presence'){p.connected=true;p.disconnectedAt=0;return {};}
   if(m.op==='offline'){p.connected=false;p.disconnectedAt=Date.now();r.inputs[seat]=0;r.queued[seat]=[];await checkpoint(a);await emitRoom(r,'room',view(r));return {};}
   if(m.op==='select'){
    if(r.match||!FIGHTERS.some(f=>f.id===m.payload.character))throw new Error('Không thể chọn nhân vật này.');p.character=m.payload.character;p.ready=false;
   }else if(m.op==='ready'){
    if(r.match)throw new Error('Trận đang diễn ra.');p.ready=true;
    if(r.players.every(p=>p?.ready&&p.connected)){
     r.match=createMatch(r.players.map(p=>p.character));r.matchId=randomUUID();r.inputs=[0,0];r.queued=[[],[]];r.lastInput=[Date.now(),Date.now()];
     await checkpoint(a);await emitRoom(r,'start',r.match);
    }
   }else if(m.op==='rematch'){
    if(r.match?.phase!=='done')throw new Error('Trận chưa kết thúc.');r.match=null;r.matchId=null;r.players.forEach(p=>{if(p)p.ready=false;});
   }else if(m.op==='leave'){
    await remove(a,seat);return {};
   }else throw new Error('Lệnh không hợp lệ.');
   await checkpoint(a);await emitRoom(r,'room',view(r));return {};
  });
 }
 async function remove(a,seat){
  const r=a.room;
  if(r.match&&r.match.phase!=='done'){
   r.match.phase='done';r.match.winner=1-seat;r.match.endReason='forfeit';await checkpoint(a);await emitRoom(r,'snapshot',r.match);
  }
  // Persist final results before releasing a seat.
  await checkpoint(a);const old=r.players[seat];r.players[seat]=null;r.match=null;r.matchId=null;
  r.players.forEach(p=>{if(p)p.ready=false;});
  if(old)await store.mapUser(old.user.uid,'');
  await checkpoint(a);await emitRoom(r,'room',view(r));
  if(r.players.every(p=>!p)){await store.release(r.code,instance);drop(r.code);}
 }
 function tick(a){
  if(closed||performance.now()>=a.until)return;
  const r=a.room,now=performance.now();a.acc+=Math.min(now-a.last,100);a.last=now;
  if(!r.match||r.match.phase==='done'||r.players.some(p=>!p?.connected)){a.acc=0;return;}
  let count=0;while(a.acc>=1000/60&&count++<6){a.acc-=1000/60;
   for(let i=0;i<2;i++)if(Date.now()-r.lastInput[i]>350){r.inputs[i]=0;r.queued[i]=[];}else if(r.queued[i].length)r.inputs[i]=r.queued[i].shift();
   step(r.match,r.inputs);
   if(r.match.tick%2===0||r.match.phase==='done'){
    // Local clients receive snapshots immediately. Remote instances receive the latest
    // snapshot through a bounded publisher; never accumulate slow HTTP requests.
    localEvent(r.code,'snapshot',r.match);if(r.players.some(p=>p&&!io.sockets.sockets.has(p.socket))){a.latest=structuredClone(r.match);void publishLatest(a);}
   }
   if(r.match.phase==='done'){if(!a.saving){a.saving=true;void queue(a,()=>checkpoint(a)).catch(report).finally(()=>a.saving=false);}break;}
  }
 }
 async function publishLatest(a){if(a.publishing||!a.latest)return;a.publishing=true;
  try{while(a.latest&&performance.now()<a.until){const data=a.latest;a.latest=null;await bus.publish({kind:'event',source:instance,code:a.room.code,event:'snapshot',data});}}
  catch{report();}finally{a.publishing=false;}
 }
 io.on('connection',socket=>{
  const user=socket.data.user,clientId=socket.data.clientId;
  const identity={user,clientId,socketId:socket.id};let attached=false;
  socket.data.bits=[];socket.data.lastPresence=0;
  const rotate=setTimeout(()=>socket.conn.close(),rotationMs);rotate.unref?.();
  async function attach(result){socket.data.room=result.room.code;await socket.join(result.room.code);socket.emit('resume',result);}
  const attaching=(async()=>{const code=await store.userRoom(user.uid);if(code){try{await attach(await request(code,'resume',{},user,clientId,socket.id));}catch{socket.emit('resume-missing','Phòng cũ đã hết hạn hoặc không còn khả dụng.');}}else socket.emit('resume-missing','');attached=true;})();
  attaching.catch(()=>socket.emit('fatal','Không khôi phục được phòng. Hãy kết nối lại.'));
  for(const op of ['create','join','select','ready','rematch','leave'])socket.on(op,async(payload,ack)=>{
   if(typeof ack!=='function')return;
   try{
    await attaching;if(limited('cmd:'+socket.id,30,10000))throw new Error('Thao tác quá nhanh.');
    if(!Number(await store.touch(user.uid,clientId,socket.id)))throw new Error('Phiên kết nối đã hết hạn.');
    let result={};
    if(op==='create'){
     if(socket.data.room)throw new Error('Rời phòng hiện tại trước.');
     // Refreshes may resume a room; never silently overwrite the user-room index.
     let r,created=false;
     for(let n=0;n<10&&!created;n++){
      r={code:String(randomInt(100000,1000000)),players:[{...identity,socket:socket.id,connected:true,disconnectedAt:0,character:'goku',ready:false},null],match:null,matchId:null,inputs:[0,0],queued:[[],[]],lastInput:[0,0],created:Date.now()};
      delete r.players[0].socketId;created=await store.create(r,instance);
     }
     if(!created)throw new Error('Không tạo được phòng. Thử lại.');const a=own(r);await checkpoint(a);await store.mapUser(user.uid,r.code);
     result={room:view(r),seat:0,match:null};await attach(result);
    }else if(op==='join'){
     if(socket.data.room)throw new Error('Rời phòng hiện tại trước.');const code=String(payload?.code||'');if(!/^\d{6}$/.test(code))throw new Error('Mã phòng gồm 6 chữ số.');
     result=await request(code,op,payload,user,clientId,socket.id);await attach(result);
    }else{
     if(!socket.data.room)throw new Error('Bạn chưa ở trong phòng.');
     result=await request(socket.data.room,op,payload||{},user,clientId,socket.id);
     if(op==='leave'){await socket.leave(socket.data.room);socket.data.room=null;}
    }
    ack({ok:true,...result});
   }catch(e){ack({ok:false,error:e.message});}
  });
  socket.on('input',bits=>{if(!Number.isInteger(bits)||bits<0||bits>1023||!attached||!socket.data.room||limited('input:'+socket.id,150,1000))return;
   const q=socket.data.bits;if(q.length<8&&bits!==q.at(-1))q.push(bits);
  });
  const flush=setInterval(()=>{void (async()=>{
   if(!socket.data.room||socket.data.flushing||!socket.data.bits.length)return;
   socket.data.flushing=true;const bits=socket.data.bits.splice(0),code=socket.data.room;
   try{if(bits.length===1&&bits[0]===socket.data.lastBits&&Date.now()-(socket.data.lastForward||0)<100)return;socket.data.lastBits=bits.at(-1);socket.data.lastForward=Date.now();const target=await locate(code),m={kind:'input',target,code,...identity,bits};if(target===instance){const a=owned.get(code);if(a)applyInput(a.room,m);}else await bus.publish(m);}
   catch{socket.data.bits.unshift(...bits.slice(-8));}finally{socket.data.flushing=false;}
  })();},33);
  socket.on('ping-check',ack=>{if(typeof ack==='function')ack();});
  socket.on('disconnect',()=>{
   clearTimeout(rotate);clearInterval(flush);if(closed)return;
   void attaching.then(async()=>{if(socket.data.room)await request(socket.data.room,'offline',{},user,clientId,socket.id);}).catch(()=>{}).finally(()=>void store.unclaim(user.uid,clientId,socket.id).catch(report));
  });
 });
 async function service(){
  if(serviceBusy||closed)return;serviceBusy=true;
  try{
   for(const [key,v]of limits)if(v.until<Date.now())limits.delete(key);
   // A silent SSE EOF also triggers re-subscription through this heartbeat watchdog.
   if(Date.now()-lastBusPing>4000){lastBusPing=Date.now();await bus.publish({kind:'heartbeat',source:instance});}
   if(Date.now()-bus.lastSeen>10000&&!subscriberRestarting){subscriberRestarting=true;try{await bus.start();}finally{subscriberRestarting=false;}}
   for(const socket of io.sockets.sockets.values())if(socket.data.user&&Date.now()-socket.data.lastPresence>4000){
    socket.data.lastPresence=Date.now();const {user,clientId}=socket.data;
    if(!Number(await store.touch(user.uid,clientId,socket.id))){socket.emit('fatal','Phiên đã được thay thế.');socket.disconnect(true);continue;}
    if(socket.data.room)await request(socket.data.room,'presence',{},user,clientId,socket.id).catch(()=>{});
   }
   for(const a of [...owned.values()]){
    if(a.saving)continue;a.saving=true;
    try{await queue(a,async()=>{
     // Presence is authoritative; a dead instance cannot keep its player connected.
     if(Date.now()-(a.checkedPresence||0)>4000){a.checkedPresence=Date.now();for(const p of a.room.players)if(p&&p.connected){const live=await redis.get(store.key('session:'+p.user.uid));if(live!==p.clientId+':'+p.socket){p.connected=false;p.disconnectedAt=Date.now();}}}
     await checkpoint(a);
     if(!a.room.match&&Date.now()-a.room.created>3600000){await emitRoom(a.room,'fatal','Phòng đã hết hạn.');for(let i=0;i<2;i++)if(a.room.players[i])await remove(a,i);return;}
     for(let i=0;i<2;i++){const p=a.room.players[i];if(p&&!p.connected&&Date.now()-p.disconnectedAt>graceMs)await remove(a,i);}
    });}catch{report();}finally{a.saving=false;}
   }
  }finally{serviceBusy=false;}
 }
 return {http,io,store,owned,instance,ready,
  async close({crash=false}={}){closed=true;clearInterval(timer);for(const a of owned.values())clearInterval(a.timer);
   for(const p of pending.values()){clearTimeout(p.timer);p.reject(new Error('Server closed'));}pending.clear();
   if(!crash)for(const a of owned.values())await store.release(a.room.code,instance).catch(()=>{});
   await bus.close();await new Promise(resolve=>io.close(resolve));
  }};
}
