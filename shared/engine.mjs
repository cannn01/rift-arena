// Pure fixed-step simulation. Shared by local play, prediction and authoritative server.
export const W=960, FLOOR=424, HZ=60;
export const B={left:1,right:2,up:4,block:8,attack:16,jump:32,roll:64,skill:128,super:256,burst:512};
export const FIGHTERS=[
 {id:'goku',name:'Goku',title:'Võ sĩ ánh dương',color:'#ff9d42',aura:'#6ee7ff',speed:4.0,power:1,skill:'Sóng năng lượng',style:'Cân bằng'},
 {id:'vegeta',name:'Vegeta',title:'Hoàng tử chiến binh',color:'#677dff',aura:'#cf9dff',speed:3.8,power:1.12,skill:'Pháo thiên hà',style:'Sát thương'},
 {id:'naruto',name:'Naruto',title:'Ý chí ngọn lửa',color:'#ffce57',aura:'#ffca65',speed:4.5,power:.92,skill:'Phong cầu',style:'Tốc độ'},
 {id:'sasuke',name:'Sasuke',title:'Lưỡi kiếm sấm',color:'#b3a2f8',aura:'#a1d7ff',speed:4.2,power:1,skill:'Lôi kích',style:'Áp sát'}
];
export const MOVES={
 jab:{startup:5,active:5,recovery:12,damage:55,range:64,stun:17,push:5},
 cross:{startup:7,active:5,recovery:15,damage:72,range:78,stun:20,push:7},
 kick:{startup:9,active:6,recovery:20,damage:100,range:90,stun:24,push:12},
 upper:{startup:10,active:7,recovery:22,damage:95,range:67,stun:27,push:6,launch:11},
 breaker:{startup:20,active:6,recovery:26,damage:115,range:76,stun:32,push:10,break:true},
 air:{startup:6,active:9,recovery:18,damage:72,range:76,stun:20,push:8},
 dash:{startup:7,active:9,recovery:22,damage:100,range:82,stun:22,push:10},
 shot:{startup:18,active:1,recovery:24,damage:110,cost:55,projectile:true,speed:8,size:19},
 rush:{startup:9,active:16,recovery:26,damage:130,cost:65,range:90,stun:27,push:14},
 rising:{startup:10,active:14,recovery:28,damage:145,cost:70,range:85,stun:30,push:7,launch:14},
 charge:{startup:18,active:1,recovery:24,damage:135,cost:70,projectile:true,speed:5,size:30},
 aerial:{startup:12,active:1,recovery:22,damage:105,cost:50,projectile:true,speed:9,size:18},
 super:{startup:25,active:1,recovery:40,damage:260,cost:100,projectile:true,speed:13,size:48},
 super2:{startup:18,active:18,recovery:35,damage:235,cost:100,range:145,stun:38,push:20,launch:12}
};
function fighter(i,id){return {id:FIGHTERS.some(f=>f.id===id)?id:'goku',x:i?710:250,y:FLOOR,vx:0,vy:0,face:i?-1:1,hp:1000,energy:100,guard:100,state:'idle',age:0,move:null,hit:false,stun:0,inv:0,burst:0,prev:0,combo:0,comboAt:-100,maxCombo:0,lastHit:-100,lastTap:-100,tapDir:0,dash:0,buffer:0,bufferUntil:0};}
export function createMatch(ids=['goku','vegeta'],training=false){return {tick:0,round:1,wins:[0,0],phase:'intro',phaseTicks:110,time:99*HZ,players:ids.map((id,i)=>fighter(i,id)),shots:[],effects:[],serial:0,winner:null,roundWinner:null,training};}
function effect(s,x,y,color,kind='hit'){s.effects.push({id:++s.serial,x,y,color,kind,life:kind==='super'?35:16});}
function hit(s,a,d,move){
 if(d.inv>0||d.hp<=0)return false;
 const m=move,power=FIGHTERS.find(f=>f.id===a.id).power;
 const blocked=d.state==='block'&&d.y===FLOOR&&((a.x-d.x)*d.face>0);
 if(blocked&&!m.break){d.guard-=m.damage*.32;d.hp=Math.max(1,d.hp-Math.round(m.damage*.08));d.stun=8;d.vx=a.face*3;effect(s,d.x,d.y-48,'#b4eaff','guard');if(d.guard<=0){d.guard=0;d.state='hurt';d.stun=48;effect(s,d.x,d.y-70,'#ffd75b','break');}return true;}
 d.hp=Math.max(0,d.hp-Math.round(m.damage*power*(a.burst>0?1.12:1)));d.stun=m.stun||24;d.state='hurt';d.move=null;d.vx=a.face*(m.push||9);if(m.launch)d.vy=-m.launch;
 a.combo=s.tick-a.comboAt<75?a.combo+1:1;a.comboAt=s.tick;a.maxCombo=Math.max(a.combo,a.maxCombo);a.lastHit=s.tick;a.energy=Math.min(300,a.energy+17);d.energy=Math.min(300,d.energy+8);
 effect(s,(a.x+d.x)/2,d.y-48,FIGHTERS.find(f=>f.id===a.id).aura);return true;
}
function start(p,name,s){const m=MOVES[name];if((m.cost||0)>p.energy)return false;p.energy-=m.cost||0;p.move=name;p.age=0;p.hit=false;p.state='attack';p.buffer=0;if(name.startsWith('super'))effect(s,p.x,p.y-48,'#ffffff','super');return true;}
export function step(s,inputs=[0,0]){
 s.tick++;s.effects=s.effects.filter(e=>--e.life>0);
 if(s.phase==='done')return s;
 if(s.phase==='intro'){if(--s.phaseTicks<=0)s.phase='fight';return s;}
 if(s.phase==='round'){
  if(--s.phaseTicks<=0){if(s.wins.some(n=>n>=2)){s.phase='done';s.winner=s.wins[0]>=2?0:1;}else{const old=s.players;s.players=old.map((p,i)=>({...fighter(i,p.id),maxCombo:p.maxCombo}));s.shots=[];s.round++;s.time=99*HZ;s.phase='intro';s.phaseTicks=90;}}
  return s;
 }
 if(!s.training)s.time--;
 for(let i=0;i<2;i++){
  const p=s.players[i],o=s.players[1-i],bits=(inputs[i]||0)&1023,edge=bits&~p.prev,meta=FIGHTERS.find(f=>f.id===p.id);
  p.prev=bits;p.inv=Math.max(0,p.inv-1);p.burst=Math.max(0,p.burst-1);p.dash=Math.max(0,p.dash-1);p.energy=Math.min(300,p.energy+(p.state==='idle'?.12:.035));if(p.state!=='block')p.guard=Math.min(100,p.guard+.22);
  if(p.state!=='attack'&&p.state!=='roll'&&p.stun<=0)p.face=o.x>=p.x?1:-1;
  if(edge&(B.attack|B.skill|B.super)){p.buffer=edge&(B.attack|B.skill|B.super);p.bufferUntil=s.tick+8;}
  if(s.tick>p.bufferUntil)p.buffer=0;
  const dir=(bits&B.right?1:0)-(bits&B.left?1:0);let ground=p.y>=FLOOR;
  if(p.stun>0){p.stun--;p.vx*=.85;if(p.stun===0)p.state='idle';}
  else if(p.state==='roll'){p.age++;if(p.age>23){p.state='idle';p.vx=0;}}
  else{
   // Jump has its own input path so simultaneous jump + attack becomes an aerial hit.
   if((edge&B.jump)&&ground&&p.state!=='attack'){p.vy=p.dash?-16:-13.5;p.state='jump';ground=false;}
   const canCancel=p.state==='attack'&&p.hit&&s.tick-p.lastHit<19;
   if((edge&B.burst)&&p.energy>=300&&ground&&p.state!=='attack'){
    p.energy=0;p.burst=480;p.inv=25;p.state='idle';effect(s,p.x,p.y-50,meta.aura,'super');
   }else if((p.buffer&B.super)&&(p.state!=='attack'||canCancel)){
    start(p,(bits&B.up)&&['goku','naruto'].includes(p.id)?'super2':'super',s);
   }else if((p.buffer&B.skill)&&(p.state!=='attack'||canCancel)){
    start(p,!ground?'aerial':bits&B.up?'rising':bits&B.block?'charge':dir?'rush':'shot',s);
   }else if((p.buffer&B.attack)&&(p.state!=='attack'||canCancel&&p.age>=MOVES[p.move].startup+MOVES[p.move].active)){
    const chain=canCancel?(p.move==='jab'?'cross':'kick'):null;start(p,chain||(!ground?'air':bits&B.block?'breaker':bits&B.up?'upper':p.dash?'dash':'jab'),s);
   }else if(p.state!=='attack'){
    if((edge&B.roll)&&ground){p.state='roll';p.age=0;p.inv=15;p.vx=(dir||-p.face)*8;}
    else{
     if(edge&(B.left|B.right)){if(dir===p.tapDir&&s.tick-p.lastTap<=16)p.dash=22;p.lastTap=s.tick;p.tapDir=dir;}
     p.state=ground&&(bits&B.block)?'block':!ground?'jump':dir?'run':'idle';p.vx=p.state==='block'?0:dir*meta.speed*(p.dash?1.85:1)*(p.burst?1.1:1);
     if((edge&B.jump)&&ground){p.vy=p.dash?-16:-13.5;p.state='jump';}
    }
   }
   if(p.state==='attack'){
    const m=MOVES[p.move];p.age++;
    if(p.move==='rush'||p.move==='dash')p.vx=p.age<m.startup+m.active?p.face*8:0;else p.vx*=.65;
    if(p.move==='rising'&&p.age===m.startup)p.vy=-11;
    if(m.projectile&&p.age===m.startup){s.shots.push({id:++s.serial,owner:i,x:p.x+p.face*45,y:p.y-48,vx:p.face*m.speed*(p.id==='sasuke'?1.3:1),vy:p.move==='aerial'?2:0,life:100,size:m.size*(p.id==='vegeta'?1.2:p.id==='naruto'?.8:1),move:p.move});}
    if(!m.projectile&&!p.hit&&p.age>=m.startup&&p.age<m.startup+m.active&&Math.abs(o.y-p.y)<(p.move==='upper'?110:80)&&(o.x-p.x)*p.face>-15&&Math.abs(o.x-p.x)<m.range){p.hit=hit(s,p,o,m);}
    if(p.age>=m.startup+m.active+m.recovery){p.move=null;p.state='idle';}
   }
  }
  p.x=Math.max(36,Math.min(W-36,p.x+p.vx));p.y+=p.vy;p.vy+=.65;if(p.y>=FLOOR){p.y=FLOOR;p.vy=0;}
 }
 const [a,b]=s.players;if(Math.abs(a.x-b.x)<42&&Math.abs(a.y-b.y)<70&&a.state!=='roll'&&b.state!=='roll'){const sign=a.x<=b.x?1:-1,over=(42-Math.abs(a.x-b.x))/2;a.x=Math.max(36,Math.min(W-36,a.x-over*sign));b.x=Math.max(36,Math.min(W-36,b.x+over*sign));}
 for(const q of s.shots){q.x+=q.vx;q.y+=q.vy;q.life--;const d=s.players[1-q.owner];if(Math.abs(q.x-d.x)<q.size+21&&Math.abs(q.y-(d.y-42))<q.size+35&&d.inv<=0){const owner=s.players[q.owner];const face=owner.face;owner.face=Math.sign(q.vx);hit(s,owner,d,MOVES[q.move]);owner.face=face;q.life=0;effect(s,q.x,q.y,FIGHTERS[q.owner].aura);}}
 s.shots=s.shots.filter(q=>q.life>0&&q.x>-80&&q.x<W+80);
 if(s.training){for(const p of s.players){if(p.hp<=0)p.hp=1000;p.energy=300;}return s;}
 if(a.hp<=0||b.hp<=0||s.time<=0){const win=a.hp===b.hp?null:a.hp>b.hp?0:1;s.roundWinner=win;if(win!==null)s.wins[win]++;s.phase='round';s.phaseTicks=150;s.shots=[];}
 return s;
}
// AI updates decisions at difficulty-dependent intervals, never reads future input.
export function createAI(level=1,seed=17){return {level,seed,next:0,bits:0};}
export function aiInput(ai,s,index=1){
 if(s.tick<ai.next)return ai.bits;
 ai.seed=(Math.imul(ai.seed,1664525)+1013904223)>>>0;const r=ai.seed/4294967296;
 ai.next=s.tick+[24,14,7][ai.level];const p=s.players[index],o=s.players[1-index],dist=Math.abs(p.x-o.x),toward=o.x>p.x?B.right:B.left;
 let bits=dist>74?toward:0;
 if(o.state==='attack'&&dist<130&&r<[.18,.42,.68][ai.level])bits=B.block;
 else if(dist<85){bits=r<.2?B.block|B.attack:r<.35?B.up|B.attack:B.attack;if(r>.86)bits|=B.jump;}
 else if(dist<420&&p.energy>=100&&r>.86)bits=B.super;
 else if(dist<450&&p.energy>=55&&r>.55)bits=r>.8?toward|B.skill:B.skill;
 else if(r<.14)bits|=B.jump;
 if(s.shots.some(q=>q.owner!==index&&Math.abs(q.x-p.x)<150)&&r>.35)bits=B.jump|toward;
 // Release action between decisions to generate input edges.
 if((ai.bits&B.attack)&&(bits&B.attack))bits&=~B.attack;
 if((ai.bits&B.skill)&&(bits&B.skill))bits&=~B.skill;
 ai.bits=bits;return bits;
}
