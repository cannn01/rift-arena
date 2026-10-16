import test from 'node:test';import assert from 'node:assert/strict';import {mkdtempSync,rmSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';import {io} from 'socket.io-client';import {startServer} from '../index.mjs';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const once=(s,e)=>new Promise((resolve,reject)=>{const t=setTimeout(()=>reject(new Error('Timed out '+e)),5000);s.once(e,x=>{clearTimeout(t);resolve(x);});});
const cmd=(s,e,p={})=>new Promise((resolve,reject)=>s.timeout(4000).emit(e,p,(err,r)=>err?reject(err):resolve(r)));
test('real sockets: auth, two seats, shared simulation, timeout input, forfeit and persistence',async()=>{const directory=mkdtempSync(join(tmpdir(),'rift-test-')),server=startServer({port:0,directory}),clients=[];try{
 if(!server.http.listening)await new Promise(r=>server.http.once('listening',r));const url='http://127.0.0.1:'+server.http.address().port;
 const bad=io(url,{auth:{token:'fake'},reconnection:false});clients.push(bad);assert.ok(await once(bad,'connect_error'));bad.disconnect();
 async function client(n){const r=await fetch(url+'/api/guest',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:n})});const {token}=await r.json();const s=io(url,{auth:{token},reconnection:false});s.token=token;clients.push(s);await once(s,'connect');return s;}
 const a=await client('Alpha'),b=await client('Beta'),c=await client('Gamma');const created=await cmd(a,'create');assert.equal(created.seat,0);const code=created.room.code;assert.match(code,/^\d{6}$/);assert.equal((await cmd(b,'join',{code})).seat,1);assert.equal((await cmd(c,'join',{code})).ok,false);
 assert.equal((await cmd(a,'select',{character:'invalid'})).ok,false);await cmd(a,'select',{character:'naruto'});await cmd(a,'ready');const sa=once(a,'start'),sb=once(b,'start');await cmd(b,'ready');const [ma,mb]=await Promise.all([sa,sb]);assert.deepEqual(ma,mb);assert.equal(ma.players[0].id,'naruto');
 await sleep(2000);a.emit('input',2);await sleep(200);const moving=await once(b,'snapshot');assert.ok(moving.players[0].x>250);await sleep(500);const stop=await once(b,'snapshot');await sleep(150);const still=await once(b,'snapshot');assert.equal(still.players[0].x,stop.players[0].x);
 const over=once(a,'snapshot');b.disconnect();let ending=await over;if(ending.phase!=='done')ending=await once(a,'snapshot');assert.equal(ending.phase,'done');assert.equal(ending.winner,0);
 const profile=await fetch(url+'/api/me',{headers:{Authorization:'Bearer '+a.token}}).then(r=>r.json());assert.equal(profile.stats.wins,1);assert.equal(profile.stats.matches,1);
 }finally{clients.forEach(s=>s.disconnect());await server.close();rmSync(directory,{recursive:true,force:true});}});
