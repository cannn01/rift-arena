import {FIGHTERS,FLOOR,MOVES} from '../../shared/engine.mjs';
import {art,type SpriteFrame} from './art';
export {loadArt} from './art';
type VisualMove={startup:number;active:number;projectile?:boolean;cost?:number;range?:number};
const moves:Record<string,VisualMove>=MOVES;
const clamp=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,v));
function sprite(c:CanvasRenderingContext2D,img:HTMLImageElement,frame:SpriteFrame,height:number){const s=height/frame.height;c.drawImage(img,frame.sx,frame.sy,frame.sw,frame.sh,-frame.sw*s*frame.anchor,-frame.sh*s,frame.sw*s,frame.sh*s);}
export function drawFighter(c:CanvasRenderingContext2D,id:string,x:number,y:number,face=1,state='idle',age=0,move='',tick=0,burst=false,scale=1){
 if(!art.ready)return;
 const row=Math.max(0,FIGHTERS.findIndex(f=>f.id===id)),f=FIGHTERS[row];let pose=0;
 const m=moves[move];
 if(state==='hurt')pose=6;else if(state==='block')pose=5;else if(state==='jump'||state==='roll')pose=2;
 else if(state==='attack'&&m){if(age<Math.max(2,m.startup-4))pose=5;else if(m.projectile||m.cost)pose=7;else pose=move==='kick'||move==='breaker'||move==='air'?4:3;}
 const run=state==='run'&&!move,img=run?art.run:art.fighters,frame=run?art.runs[row][Math.floor(tick/5)%4]:art.poses[row][pose];
 c.save();c.translate(Math.round(x),Math.round(y));c.scale(face*scale,scale);c.imageSmoothingEnabled=false;
 if(burst){const g=c.createRadialGradient(0,-65,10,0,-65,95);g.addColorStop(0,f.aura+'60');g.addColorStop(1,f.aura+'00');c.fillStyle=g;c.fillRect(-90,-170,180,180);}
 if(state==='roll'){c.translate(0,-35);c.rotate(age*.26);c.scale(.7,.7);c.translate(0,45);}
 else if(state==='idle'){c.translate(0,-Math.sin(tick*.10)*1.2);c.scale(1,1+Math.sin(tick*.10)*.006);}
 else if(run)c.translate(0,-Math.abs(Math.sin(tick*.32))*2);
 else if(state==='attack'){const progress=m?clamp((age-m.startup+5)/8,0,1):1;c.translate(progress*3,0);}
 sprite(c,img,frame,136);c.restore();
}
type Particle={x:number;y:number;vx:number;vy:number;life:number;max:number;size:number;color:string};
type Ghost={x:number;y:number;face:number;id:string;age:number;move:string;state:string;life:number};
export type RenderOptions={quality:'high'|'low';shake:boolean};
export function createRenderer(options:RenderOptions,onEffect:(kind:string)=>void=()=>{}){
 let stage:HTMLCanvasElement|null=null,lastTick=-1,lastTime=performance.now(),shake=0,flash=0,lastEffect=0;
 let particles:Particle[]=[],ghosts:Ghost[]=[],health=[1000,1000],lastRound=1,lastY=[FLOOR,FLOOR];
 function background(height:number){const b=document.createElement('canvas');b.width=960;b.height=height;const c=b.getContext('2d')!;c.imageSmoothingEnabled=true;c.drawImage(art.village,0,0,960,(height*FLOOR/540)/.746);const tint=c.createLinearGradient(0,0,0,height);tint.addColorStop(0,'#0c183344');tint.addColorStop(.55,'#0c183300');tint.addColorStop(1,'#09142322');c.fillStyle=tint;c.fillRect(0,0,960,height);return b;}
 function addEffect(e:any){const count=options.quality==='high'?(e.kind==='super'?28:18):6;const seed=e.id*17;for(let j=0;j<count;j++){const angle=(j*2.399+seed)*1.1,speed=2+(j%5)*1.2;particles.push({x:e.x,y:e.y,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed-1,life:22+j%10,max:32,size:2+j%3,color:j%3?e.color:'#fff5d5'});}if(particles.length>100)particles=particles.slice(-100);shake=e.kind==='guard'?2:e.kind==='super'?8:5;flash=e.kind==='super'?5:2;onEffect(e.kind);}
 function glow(c:CanvasRenderingContext2D,x:number,y:number,size:number,color:string){if(options.quality==='low')return;const g=c.createRadialGradient(x,y,0,x,y,size);g.addColorStop(0,color+'77');g.addColorStop(1,color+'00');c.fillStyle=g;c.fillRect(x-size,y-size,size*2,size*2);}
 return {draw(c:CanvasRenderingContext2D,s:any,positions?:number[][],viewport={height:540,hudTop:0}){
  if(!art.ready)return;const viewHeight=viewport.height,floorY=viewHeight*FLOOR/540;if(!stage||stage.height!==viewHeight)stage=background(viewHeight);const now=performance.now(),elapsed=Math.min(50,now-lastTime)/16.667;lastTime=now;
  if(s.round!==lastRound){lastRound=s.round;health=[1000,1000];particles=[];ghosts=[];}
  if(s.tick!==lastTick){for(const e of s.effects)if(e.id>lastEffect){lastEffect=e.id;addEffect(e);}lastTick=s.tick;
   for(let i=0;i<2;i++){const p=s.players[i];if((p.state==='run'&&p.y===FLOOR&&s.tick%8===0)||(lastY[i]<FLOOR&&p.y===FLOOR)){for(let j=0;j<(options.quality==='high'?5:2);j++)particles.push({x:p.x+(j-2)*5,y:FLOOR-2,vx:(j-2)*.7,vy:-1.6-j*.15,life:14,max:14,size:3,color:'#d8b8a5'});}lastY[i]=p.y;}if(particles.length>100)particles=particles.slice(-100);
   for(const p of s.players)if(options.quality==='high'&&(p.state==='roll'||p.dash>0||p.move==='rush')&&s.tick%4===0)ghosts.push({x:p.x,y:p.y,id:p.id,face:p.face,age:p.age,move:p.move||'',state:p.state,life:14});
  }
  particles=particles.filter(p=>p.life>0);for(const p of particles){p.x+=p.vx*elapsed;p.y+=p.vy*elapsed;p.vy+=.09*elapsed;p.life-=elapsed;}
  ghosts=ghosts.filter(g=>g.life>0).slice(-12);for(const g of ghosts)g.life-=elapsed;
  const pixelScale=c.canvas.width/960;c.setTransform(pixelScale,0,0,pixelScale,0,0);c.clearRect(0,0,960,viewHeight);c.save();
  if(options.shake&&shake>0)c.translate(Math.sin(now*.1)*shake,Math.cos(now*.13)*shake*.55);shake=Math.max(0,shake-.7*elapsed);
  c.drawImage(stage,0,0); // static art is rasterized only once
  // Sparse petals are deterministic visual-only particles, never replicated through sockets.
  const petals=options.quality==='high'?18:5;c.fillStyle='#ffdbd499';for(let i=0;i<petals;i++){const x=((now*.015*(1+i%3*.2)+i*113)%1030)-35,y=(now*.024+i*47)%440;c.save();c.translate(x,y);c.rotate(now*.001+i);c.fillRect(-3,-1,6,3);c.restore();}
  c.save();c.translate(0,floorY-FLOOR);
  for(const g of ghosts){c.globalAlpha=g.life/50;drawFighter(c,g.id,g.x,g.y,g.face,g.state,g.age,g.move,s.tick,false);c.globalAlpha=1;}
  for(let i=0;i<2;i++){
   const p=s.players[i],x=positions?.[i]?.[0]??p.x,y=positions?.[i]?.[1]??p.y;
   const air=clamp((FLOOR-y)/180,0,1);c.fillStyle='#09132388';c.beginPath();c.ellipse(x,FLOOR+3,31-air*9,5-air*2,0,0,Math.PI*2);c.fill();
   if(p.burst>0){glow(c,x,y-60,100,FIGHTERS.find(f=>f.id===p.id)!.aura);c.strokeStyle=FIGHTERS.find(f=>f.id===p.id)!.aura+'aa';c.lineWidth=2;for(let k=0;k<4;k++){const ax=x-35+k*23;c.beginPath();c.moveTo(ax,y);c.lineTo(ax+Math.sin(s.tick*.2+k)*8,y-55);c.lineTo(ax-4,y-110);c.stroke();}}
   if(p.inv>0&&s.tick%4<2)c.globalAlpha=.45;
   drawFighter(c,p.id,x,y,p.face,y<FLOOR&&p.state!=='attack'&&p.state!=='hurt'&&p.state!=='roll'?'jump':p.state,p.age,p.move||'',s.tick,p.burst>0);c.globalAlpha=1;
   // Visible guard shield is tied to the actual guard state.
   if(p.state==='block'){c.save();c.translate(x+p.face*21,y-58);c.scale(p.face,1);c.strokeStyle='#b7e9ff99';c.lineWidth=2;c.beginPath();c.ellipse(0,0,25,52,0,-Math.PI/2,Math.PI/2);c.stroke();c.restore();}
   if(p.state==='attack'&&p.move&&p.age>=moves[p.move]?.startup){const m=moves[p.move];if(!m.projectile&&p.age<m.startup+m.active){c.save();c.translate(x,y-59);c.scale(p.face,1);c.strokeStyle='#fff2c3aa';c.lineWidth=p.move==='kick'?5:3;c.beginPath();c.arc(22,0,(m.range||60)*.7,-1.15,1.15);c.stroke();c.restore();}}
  }
  for(const q of s.shots){const owner=s.players[q.owner],f=FIGHTERS.find(f=>f.id===owner.id)!,big=q.move==='super',size=q.size,sign=Math.sign(q.vx);c.save();glow(c,q.x,q.y,size*(big?3:2.2),f.aura);c.translate(q.x,q.y);c.scale(sign,1);
   if(owner.id==='goku'){const length=big?155:45;c.fillStyle='#66dfff55';c.fillRect(-length,-size*.65,length,size*1.3);c.fillStyle='#cafaff';c.fillRect(-length,-size*.25,length,size*.5);c.fillStyle='#6ee7ff';c.beginPath();c.ellipse(0,0,size*.8,size,0,0,7);c.fill();c.fillStyle='#f4ffff';c.beginPath();c.ellipse(5,0,size*.45,size*.6,0,0,7);c.fill();}
   else if(owner.id==='naruto'){c.rotate(s.tick*.20);c.strokeStyle='#fff0a6';c.lineWidth=3;for(let k=0;k<3;k++){c.beginPath();c.arc(0,0,size*(.45+k*.25),k,Math.PI*1.5+k);c.stroke();}c.fillStyle='#fffdf0';for(let k=0;k<4;k++){c.rotate(Math.PI/2);c.beginPath();c.moveTo(0,0);c.lineTo(7,-size*1.5);c.lineTo(-7,-size*.6);c.fill();}}
   else if(owner.id==='sasuke'){c.strokeStyle='#b7edff';c.lineWidth=big?5:3;for(let k=0;k<3;k++){c.beginPath();c.moveTo(-size*2,k*9-9);for(let j=0;j<6;j++)c.lineTo(-size*2+j*size*.65,Math.sin(s.tick*.7+j*2+k)*size*.5);c.stroke();}c.fillStyle='#f1fdff';c.beginPath();c.arc(0,0,size*.42,0,7);c.fill();}
   else{c.fillStyle='#b499ff';c.beginPath();c.ellipse(0,0,size,size*.85,0,0,7);c.fill();c.strokeStyle='#ffe898';c.lineWidth=3;c.beginPath();c.arc(0,0,size*.95,-s.tick*.2,4-s.tick*.2);c.stroke();c.fillStyle='#fff7da';c.beginPath();c.arc(4,0,size*.55,0,7);c.fill();}
   c.restore();
  }
  for(const e of s.effects){const progress=1-e.life/(e.kind==='super'?35:16),r=12+Math.max(0,progress)*42;c.save();c.translate(e.x,e.y);c.globalAlpha=clamp(e.life/8,0,1);c.strokeStyle=e.color;c.lineWidth=e.kind==='guard'?3:2;c.beginPath();c.arc(0,0,r,0,7);c.stroke();if(e.kind!=='guard'){c.fillStyle='#fff9e3';c.beginPath();for(let j=0;j<16;j++){const a=j*Math.PI/8,len=j%2?r*.35:r;const x=Math.cos(a)*len,y=Math.sin(a)*len;if(!j)c.moveTo(x,y);else c.lineTo(x,y);}c.closePath();c.fill();}c.restore();}
  for(const p of particles){c.globalAlpha=clamp(p.life/12,0,1);c.fillStyle=p.color;c.fillRect(p.x,p.y,p.size,p.size);}c.globalAlpha=1;
  c.restore(); // world floor offset only; UI keeps viewport coordinates
  if(flash>0&&options.quality==='high'){c.fillStyle='#fff1ca';c.globalAlpha=flash*.035;c.fillRect(0,0,960,viewHeight);c.globalAlpha=1;flash=Math.max(0,flash-elapsed);}
  c.restore(); // HUD remains stationary during camera shake.
  c.save();c.translate(0,viewport.hudTop);c.imageSmoothingEnabled=true;c.textBaseline='middle';
  for(let i=0;i<2;i++){
   const p=s.players[i],f=FIGHTERS.find(f=>f.id===p.id)!,left=i===0,x=left?27:565;
   health[i]=Math.max(p.hp,health[i]-(health[i]-p.hp)*.045*elapsed);c.fillStyle='#111725d9';c.fillRect(x-7,18,375,81);
   c.fillStyle='#ffffff0c';c.fillRect(x-7,18,375,1);c.textAlign=left?'left':'right';c.font='800 14px "Be Vietnam Pro",sans-serif';c.fillStyle='#f4e7d9';c.fillText(f.name.toUpperCase(),left?x:x+352,35);
   c.font='9px system-ui';c.fillStyle=f.aura;c.fillText(p.burst>0?'POWER BURST':f.style.toUpperCase(),left?x+155:x+195,35);
   c.fillStyle='#342937';c.fillRect(x,49,352,14);const trail=352*health[i]/1000,life=352*p.hp/1000;c.fillStyle='#d96167';c.fillRect(left?x:x+352-trail,49,trail,14);
   const g=c.createLinearGradient(x,49,x+352,49);g.addColorStop(0,p.hp>300?'#dbefa8':'#ffe1a3');g.addColorStop(1,p.hp>300?'#6fce92':'#e56a67');c.fillStyle=g;c.fillRect(left?x:x+352-life,49,life,14);c.fillStyle='#ffffff55';c.fillRect(left?x:x+352-life,49,life,2);
   c.fillStyle='#262f43';c.fillRect(x,69,352,5);c.fillStyle=f.aura;c.fillRect(left?x:x+352-352*p.energy/300,69,352*p.energy/300,5);c.fillStyle='#0f1624';for(let n=1;n<3;n++)c.fillRect(x+352*n/3,69,3,5);
   c.fillStyle='#becfdf66';c.fillRect(x,79,352*p.guard/100,2);c.fillStyle='#ffd598';for(let n=0;n<2;n++){c.globalAlpha=n<s.wins[i]?1:.18;const dx=left?x+6+n*17:x+346-n*17;c.beginPath();c.moveTo(dx,85);c.lineTo(dx+4,89);c.lineTo(dx,93);c.lineTo(dx-4,89);c.fill();}c.globalAlpha=1;
   if(p.combo>1&&s.tick-p.comboAt<75){c.font='italic 800 28px "Barlow Condensed",sans-serif';c.fillStyle='#0c152a';c.fillText(p.combo+' HITS',left?29:934,125);c.fillStyle=f.aura;c.fillText(p.combo+' HITS',left?27:932,123);}
  }
  c.textAlign='center';c.fillStyle='#131b2ae8';c.beginPath();c.moveTo(439,17);c.lineTo(521,17);c.lineTo(512,89);c.lineTo(448,89);c.closePath();c.fill();c.font='800 42px "Barlow Condensed",sans-serif';c.fillStyle='#ffe5b2';c.fillText(s.training?'∞':String(Math.ceil(s.time/60)).padStart(2,'0'),480,47);c.font='8px system-ui';c.fillStyle='#bfc8d5';c.fillText('ROUND '+s.round,480,78);
  c.restore();
  let banner='';if(s.phase==='intro')banner=s.phaseTicks>45?'ROUND '+s.round:'FIGHT';if(s.phase==='round')banner=s.roundWinner===null?'DRAW':s.players.some((p:any)=>p.hp<=0)?'K.O.':'TIME UP';
  if(banner){c.save();c.translate(0,(viewHeight-540)*.4);c.fillStyle='#09132266';c.fillRect(0,202,960,87);c.font='italic 900 61px "Barlow Condensed",sans-serif';c.strokeStyle='#2e233f';c.lineWidth=6;c.strokeText(banner,480,246);c.fillStyle='#ffe0a4';c.fillText(banner,480,246);c.fillStyle='#efbd8177';c.fillRect(290,286,380,1);c.restore();}
 }};
}
