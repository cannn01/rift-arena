import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {EventEmitter} from 'node:events';
import IORedis from 'ioredis';
import {io} from 'socket.io-client';
import {createCloudServer} from '../cloud.mjs';
import {restRedis} from './helpers/redis-rest.mjs';

// Adapter for exercising the production Lua scripts against a real local Redis.
// No Upstash credentials or real player data are used by these tests.
function adapter(url){
 const r=new IORedis(url);r.on('error',()=>{});
 return {close:()=>r.quit(),ping:()=>r.ping(),get:k=>r.get(k),hget:(k,f)=>r.hget(k,f),
  set:(k,v,o={})=>r.set(k,v,...(o.nx?['NX']:[]),...(o.px?['PX',o.px]:[]),...(o.ex?['EX',o.ex]:[])),
  eval:(script,keys,args)=>r.eval(script,keys.length,...keys,...args),
  zrange:(k,a,b,o)=>o?.rev?r.zrevrange(k,a,b):r.zrange(k,a,b),
  publish:(channel,message)=>r.publish(channel,message),
  subscribe:channel=>{
   const s=r.duplicate(),events=new EventEmitter();
   s.on('error',e=>events.emit('error',e));
   s.on('message',(channel,message)=>events.emit('message',{channel,message}));
   void s.subscribe(channel).then(n=>events.emit('subscribe',n));
   return {on:(...args)=>events.on(...args),unsubscribe:async()=>{await s.unsubscribe();await s.quit();}};
  }
 };
}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function once(s,e,ms=10000){return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{s.off(e,done);reject(new Error('Timeout '+e));},ms);function done(v){clearTimeout(timer);resolve(v);}s.once(e,done);});}
async function until(fn,ms=10000){const began=Date.now();while(Date.now()-began<ms){const v=await fn();if(v)return v;await sleep(80);}throw new Error('Condition timed out');}
const cmd=(s,e,p={})=>new Promise((resolve,reject)=>s.timeout(10000).emit(e,p,(err,r)=>err?reject(err):resolve(r)));

test('cloud: two instances share rooms, inputs, reconnect, ownership failover and exactly-once results',
 {skip:!process.env.REDIS_TEST_URL,timeout:45000},async()=>{
 const factory=process.env.REDIS_TEST_REST?restRedis:adapter;
 const namespace='test:'+randomUUID(),ra=await factory(process.env.REDIS_TEST_URL),rb=await factory(process.env.REDIS_TEST_URL);
 const secret='integration-test-secret-not-a-real-key-123456';
 const a=createCloudServer({redis:ra,secret,namespace,projectId:null,graceMs:15000,rotationMs:60000});
 const b=createCloudServer({redis:rb,secret,namespace,projectId:null,graceMs:15000,rotationMs:60000});
 const servers=[a,b],clients=[];let aClosed=false;
 async function listen(s){await s.ready();await new Promise(r=>s.http.listen(0,'127.0.0.1',r));return 'http://127.0.0.1:'+s.http.address().port;}
 try{
  const ua=await listen(a),ub=await listen(b);
  assert.equal((await fetch(ua+'/api/health').then(r=>r.json())).storage,'redis');
  async function guest(url,name){return (await fetch(url+'/api/guest',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name})}).then(r=>r.json())).token;}
  async function client(url,token,clientId=randomUUID()){
   const s=io(url,{transports:['websocket'],auth:{token,clientId},reconnection:false});clients.push(s);s.credentials={token,clientId};await once(s,'connect');return s;
  }
  const ta=await guest(ua,'Alpha'),tb=await guest(ub,'Beta'),tc=await guest(ub,'Gamma');
  let p1=await client(ua,ta),p2=await client(ub,tb),p3=await client(ub,tc);
  const bad=io(ub,{transports:['websocket'],auth:{token:ta,clientId:randomUUID()},reconnection:false});clients.push(bad);assert.match((await once(bad,'connect_error')).message,/thiết bị/);bad.disconnect();
  const created=await cmd(p1,'create');assert.equal(created.ok,true,created.error);const code=created.room.code;
  assert.equal((await cmd(p2,'join',{code})).seat,1);
  assert.equal((await cmd(p3,'join',{code})).ok,false);
  assert.equal((await cmd(p1,'select',{character:'invalid'})).ok,false);
  await cmd(p1,'select',{character:'naruto'});await cmd(p1,'ready');
  const start1=once(p1,'start'),start2=once(p2,'start');await cmd(p2,'ready');
  const [m1,m2]=await Promise.all([start1,start2]);assert.deepEqual(m1,m2);
  // Both connections see authoritative state although they connect to different servers.
  await sleep(2100);const before=await once(p2,'snapshot');
  for(let n=0;n<5;n++){p1.emit('input',2);await sleep(45);}
  const moving=await once(p2,'snapshot');assert.ok(moving.players[0].x>before.players[0].x);
  await sleep(500);const stopped=await once(p2,'snapshot');await sleep(150);assert.equal((await once(p2,'snapshot')).players[0].x,stopped.players[0].x);
  // Same client identity can reconnect; another client identity may not take its seat.
  const saved=p2.credentials;p2.disconnect();await sleep(150);
  const resumedP=io(ub,{transports:['websocket'],auth:saved,reconnection:false});clients.push(resumedP);
  const resumed=await once(resumedP,'resume');assert.equal(resumed.seat,1);assert.equal(resumed.room.code,code);assert.ok(resumed.match);p2=resumedP;
  // Kill the room owner, reconnect player 1 to instance B and recover from Redis.
  const saved1=p1.credentials;p1.disconnect();await a.close({crash:true});aClosed=true;
  await sleep(4200);
  const replacement=io(ub,{transports:['websocket'],auth:saved1,reconnection:false});clients.push(replacement);
  const recovered=await once(replacement,'resume');assert.equal(recovered.room.code,code);assert.equal(recovered.match.players[0].id,'naruto');p1=replacement;
  await until(()=>b.owned.has(code));
  // Stale owners cannot overwrite the new owner's state.
  const checkpoint=structuredClone(b.owned.get(code).room);
  assert.equal(await a.store.checkpoint(checkpoint,a.instance),false);
  const final=once(p1,'snapshot');assert.equal((await cmd(p2,'leave')).ok,true);
  let ending=await final;while(ending.phase!=='done')ending=await once(p1,'snapshot');assert.equal(ending.winner,0);
  const profile=()=>fetch(ub+'/api/me',{headers:{Authorization:'Bearer '+ta}}).then(r=>r.json());
  await until(async()=>((await profile()).stats.matches===1));
  assert.equal((await profile()).stats.wins,1);
  await sleep(1200);assert.equal((await profile()).stats.matches,1);
  const records=await rb.eval("return redis.call('LLEN',KEYS[1])",[namespace+':matches'],[]);assert.equal(Number(records),1);
 }finally{
  clients.forEach(s=>s.disconnect());if(!aClosed)await a.close();await b.close();
  // Only keys from this unique integration test namespace are removed.
  const cleanup=new IORedis(process.env.REDIS_TEST_URL);let cursor='0';do{const result=await cleanup.scan(cursor,'MATCH',namespace+':*');cursor=result[0];if(result[1].length)await cleanup.del(...result[1]);}while(cursor!=='0');await cleanup.quit();await ra.close();await rb.close();
 }
});

test('cloud: automatic transport rotation resumes both seats without forfeiting the match',
 {skip:!process.env.REDIS_TEST_URL,timeout:15000},async()=>{
 const redis=await restRedis(process.env.REDIS_TEST_URL),namespace='test:'+randomUUID();
 const server=createCloudServer({redis,secret:'rotation-test-secret-not-a-real-key-12345',projectId:null,namespace,rotationMs:800});
 const clients=[];
 try{
  await server.ready();await new Promise(r=>server.http.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.http.address().port;
  async function player(name){const {token}=await fetch(url+'/api/guest',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name})}).then(r=>r.json());
   const s=io(url,{transports:['websocket'],auth:{token,clientId:randomUUID()},reconnection:true,reconnectionDelay:50,reconnectionDelayMax:100,randomizationFactor:0});clients.push(s);s.resumes=0;s.on('resume',()=>s.resumes++);await once(s,'connect');return s;
  }
  const a=await player('Rotate A'),b=await player('Rotate B'),created=await cmd(a,'create');
  assert.equal((await cmd(b,'join',{code:created.room.code})).ok,true);await cmd(a,'ready');const start=once(b,'start');await cmd(b,'ready');await start;
  await until(()=>a.resumes>=3&&b.resumes>=3,10000);
  const state=await server.store.load(created.room.code);assert.notEqual(state.match.phase,'done');assert.equal(state.players.length,2);assert.ok(state.match.tick>0);
  assert.equal((await server.store.stats(state.players[0].user.uid)).matches,0);
 }finally{
  clients.forEach(s=>s.disconnect());await server.close();const cleanup=new IORedis(process.env.REDIS_TEST_URL);let cursor='0';do{const [next,keys]=await cleanup.scan(cursor,'MATCH',namespace+':*');cursor=next;if(keys.length)await cleanup.del(...keys);}while(cursor!=='0');await cleanup.quit();await redis.close();
 }
});
