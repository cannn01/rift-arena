import test from 'node:test';import assert from 'node:assert/strict';
import {createMatch,step,B,createAI,aiInput} from '../../shared/engine.mjs';
function match(){const s=createMatch();s.phase='fight';s.players[0].x=400;s.players[1].x=460;return s;}
function frames(s,n,a=0,b=0){for(let i=0;i<n;i++)step(s,[a,b]);}
test('attack has startup, single hit and recovery',()=>{const s=match();frames(s,4,B.attack);assert.equal(s.players[1].hp,1000);frames(s,40,B.attack);assert.equal(s.players[1].hp,945);});
test('guard reduces damage; breaker bypasses guard',()=>{const s=match();frames(s,30,B.attack,B.block);assert.ok(s.players[1].hp>980);const q=match();frames(q,30,B.attack|B.block,B.block);assert.ok(q.players[1].hp<900);});
test('roll invulnerability avoids active jab',()=>{const s=match();frames(s,10,B.attack,B.roll);assert.equal(s.players[1].hp,1000);});
test('jump and gravity land on floor; inputs bounded',()=>{const s=match();frames(s,1,B.jump|B.left);assert.ok(s.players[0].y<424);frames(s,120,B.left);assert.equal(s.players[0].y,424);assert.equal(s.players[0].x,36);});
test('skill costs energy and travels before hitting',()=>{const s=match();s.players[1].x=700;frames(s,19,B.skill);assert.ok(s.players[0].energy<60);assert.equal(s.players[1].hp,1000);frames(s,45);assert.ok(s.players[1].hp<1000);});
test('cannot cast super without enough energy',()=>{const s=match();s.players[0].energy=0;frames(s,50,B.super);assert.equal(s.players[1].hp,1000);assert.equal(s.shots.length,0);});
test('best of 3 winner and training never ends',()=>{const s=match();for(let r=0;r<2;r++){s.players[0].x=400;s.players[1].x=460;s.players[1].hp=1;frames(s,40,B.attack);assert.equal(s.phase,'round');frames(s,151);if(r===0)frames(s,91);}assert.equal(s.phase,'done');assert.equal(s.winner,0);const t=createMatch(undefined,true);t.phase='fight';t.players[0].hp=0;frames(t,1);assert.equal(t.players[0].hp,1000);assert.equal(t.players[0].energy,300);});
test('deterministic replays and three CPU levels produce finite state',()=>{for(let l=0;l<3;l++){const a=createMatch(),b=createMatch(),ai=createAI(l,24);for(let i=0;i<4000;i++){const bits=[i%60<20?B.right|B.attack:i%60<30?B.skill:0,aiInput(ai,a)];step(a,bits);step(b,bits);}assert.deepEqual(a,b);for(const p of a.players){assert.ok(Number.isFinite(p.x));assert.ok(p.hp>=0&&p.hp<=1000);}}});
