import {useEffect,useRef,useState} from 'react';
import type {Socket} from 'socket.io-client';
import {Capacitor,SystemBars,SystemBarsStyle} from '@capacitor/core';
import {ScreenOrientation} from '@capacitor/screen-orientation';
import {App as NativeApp} from '@capacitor/app';
import {B,createMatch,step,createAI,aiInput} from '../../shared/engine.mjs';
import {createRenderer,loadArt} from './render';
import {combatAudio} from './combat-audio';
import {bindingFor} from './controls.mjs';
import {TOUCH_JUMP,actionMessage,viewportSize} from './mobile-controls.mjs';
export type Mode='cpu'|'local'|'training'|'online';
export default function GameView({mode,characters,level,socket,seat,initial,onExit,sound}:{mode:Mode,characters:string[],level:number,socket:Socket|null,seat:number,initial:any,onExit:()=>void,sound:boolean}){
 const canvas=useRef<HTMLCanvasElement>(null),keys=useRef([0,0]),touch=useRef(new Map<number,number>()),state=useRef<any>(initial||createMatch(characters,mode==='training'));
 const [paused,setPaused]=useState(false),pauseRef=useRef(false),[result,setResult]=useState<any>(null),[net,setNet]=useState(''),[metrics,setMetrics]=useState({fps:0,p95:0,ping:0}),[help,setHelp]=useState(false);
 const [combatUI,setCombatUI]=useState({energy:100,burst:0}),[hint,setHint]=useState('');
 const hintTimer=useRef<ReturnType<typeof setTimeout>|null>(null),touchRef=useRef(false),toolbar=useRef<HTMLDivElement>(null),arena=useRef<HTMLDivElement>(null);
 const [artError,setArtError]=useState(''),[artLoaded,setArtLoaded]=useState(false);
 const [touchOn,setTouchOn]=useState(Capacitor.isNativePlatform()||matchMedia('(pointer: coarse)').matches);
 touchRef.current=touchOn;
 function tell(message:string){setHint(message);if(hintTimer.current)clearTimeout(hintTimer.current);hintTimer.current=setTimeout(()=>setHint(''),4000);}
 function input(){let bits=keys.current[0];for(const b of touch.current.values())bits|=b;return bits;}
 function clear(){keys.current=[0,0];touch.current.clear();document.querySelectorAll('.control.pressed').forEach(e=>e.classList.remove('pressed'));socket?.emit('input',0);}
 function pause(){if(mode==='online')return;setPaused(v=>{pauseRef.current=!v;return !v;});clear();}
 useEffect(()=>{
  let alive=true,loaded=false;void loadArt().then(()=>{loaded=true;if(alive)setArtLoaded(true);}).catch(e=>{if(alive)setArtError(e.message);});
  const audio=combatAudio(sound),preference=localStorage.getItem('rift.graphics')||'auto',quality=preference==='low'||preference==='auto'&&(Capacitor.isNativePlatform()||matchMedia('(pointer: coarse)').matches)?'low':'high';
  const renderer=createRenderer({quality,shake:localStorage.getItem('rift.shake')!=='false'},kind=>audio.play(kind));
  if(Capacitor.isNativePlatform()){void ScreenOrientation.lock({orientation:'landscape'}).catch(()=>{});void SystemBars.hide().catch(()=>{});}
  const nativeListener=NativeApp.addListener('appStateChange',({isActive})=>{if(!isActive){clear();if(mode!=='online'){pauseRef.current=true;setPaused(true);}}});
  let music:HTMLAudioElement|null=null;if(sound){music=new Audio('/audio/nhac_trong_tran.mp3');music.loop=true;music.volume=.12;void music.play().catch(()=>{});}
  const key=(e:KeyboardEvent,down:boolean)=>{if(e.code==='Escape'){e.preventDefault();if(down&&!e.repeat)pause();return;}const binding=bindingFor(e.code,mode);if(!binding)return;e.preventDefault();if(down)keys.current[binding.seat]|=binding.bit;else keys.current[binding.seat]&=~binding.bit;if(mode==='online')socket?.emit('input',input());};
  const kd=(e:KeyboardEvent)=>key(e,true),ku=(e:KeyboardEvent)=>key(e,false);
  const blur=()=>{clear();if(mode!=='online'){pauseRef.current=true;setPaused(true);}};
  const visibility=()=>{if(document.hidden)blur();};
  window.addEventListener('keydown',kd);window.addEventListener('keyup',ku);window.addEventListener('blur',blur);document.addEventListener('visibilitychange',visibility);
  let authoritative=structuredClone(state.current),snapshotAt=performance.now(),lastSnapshotTick=authoritative.tick,frame=0,last=performance.now(),acc=0,samples:number[]=[],measureAt=last,frames=0,ping=0,lastSent=0,finished=false,uiAt=0;
  let display=state.current.players.map((p:any)=>[p.x,p.y]);const ai=createAI(level,Date.now()>>>0);
  const snapshot=(s:any)=>{if(s.tick<lastSnapshotTick)return;lastSnapshotTick=s.tick;authoritative=structuredClone(s);state.current=structuredClone(s);snapshotAt=performance.now();setNet('');};
  const disconnected=()=>{clear();setNet('Mất kết nối. Trận online đã dừng; hãy trở về và vào phòng mới.');};
  if(mode==='online'){socket?.on('snapshot',snapshot);socket?.on('disconnect',disconnected);}
  const pingTimer=setInterval(()=>{if(mode==='online'&&socket?.connected){const t=performance.now();socket.timeout(3000).emit('ping-check',(err:any)=>{if(!err)ping=Math.round(performance.now()-t);});}},1500);
  let viewport={height:540,hudTop:0},lastSize='';
  function resize(){if(!canvas.current||!arena.current)return;const bounds=arena.current.getBoundingClientRect(),size=viewportSize(bounds.width,bounds.height,touchRef.current),scale=quality==='high'?2:1;const key=[size.height,scale,size.wide].join(':');if(lastSize!==key){canvas.current.width=960*scale;canvas.current.height=size.height*scale;lastSize=key;}viewport={height:size.height,hudTop:size.wide?Math.max(0,((toolbar.current?.getBoundingClientRect().bottom||0)-bounds.top+8)*960/bounds.width):0};}
  const observer=new ResizeObserver(resize);observer.observe(arena.current!);window.addEventListener('resize',resize);resize();
  const ctx=canvas.current!.getContext('2d',{alpha:false})!;
  function loop(now:number){
   const elapsed=now-last,dt=Math.min(elapsed,100);last=now;frames++;samples.push(elapsed);if(samples.length>600)samples.shift();
   if(!pauseRef.current&&(loaded||mode==='online')){acc+=dt;let n=0;while(acc>=1000/60&&n++<6){acc-=1000/60;if(mode==='online'){
      // Extrapolate briefly between server snapshots. Health/results always corrected by server.
      if(now-snapshotAt<100&&socket?.connected){const bits=state.current.players.map((p:any)=>p.prev);bits[seat]=input();step(state.current,bits);}
    }else step(state.current,[input(),mode==='local'?keys.current[1]:mode==='training'?0:aiInput(ai,state.current)]);
   }}else acc=0;
   if(mode==='online'&&now-lastSent>32&&socket?.connected){socket.volatile.emit('input',input());lastSent=now;}
   const s=state.current;if(now-uiAt>100){const p=s.players[mode==='online'?seat:0];setCombatUI({energy:p.energy,burst:p.burst});uiAt=now;resize();}if(mode==='online'&&now-snapshotAt>2500&&socket?.connected)setNet('Đang chờ server…');
   const alpha=1-Math.exp(-dt/25);for(let i=0;i<2;i++){display[i][0]+=(s.players[i].x-display[i][0])*alpha;display[i][1]+=(s.players[i].y-display[i][1])*alpha;}
   if(loaded)renderer.draw(ctx,s,mode==='online'?display:undefined,viewport);else{samples=[];frames=0;measureAt=now;}
   const finalState=mode==='online'?authoritative:s;
   if(finalState.phase==='done'&&!finished){finished=true;clear();setResult(structuredClone(finalState));if(mode==='cpu'){const best=Number(localStorage.getItem('rift.cpuBest')||0);localStorage.setItem('rift.cpuBest',String(Math.max(best,finalState.players[0].maxCombo)));}}
   if(now-measureAt>=1000){const sorted=[...samples].sort((a,b)=>a-b);setMetrics({fps:Math.round(frames*1000/(now-measureAt)),p95:Math.round((sorted[Math.floor(sorted.length*.95)]||0)*10)/10,ping});frames=0;measureAt=now;}
   frame=requestAnimationFrame(loop);
  }
  frame=requestAnimationFrame(loop);
  return()=>{observer.disconnect();window.removeEventListener('resize',resize);if(hintTimer.current)clearTimeout(hintTimer.current);alive=false;audio.close();cancelAnimationFrame(frame);clearInterval(pingTimer);music?.pause();clear();window.removeEventListener('keydown',kd);window.removeEventListener('keyup',ku);window.removeEventListener('blur',blur);document.removeEventListener('visibilitychange',visibility);socket?.off('snapshot',snapshot);socket?.off('disconnect',disconnected);void nativeListener.then(h=>h.remove());if(Capacitor.isNativePlatform()){void SystemBars.show().then(()=>SystemBars.setStyle({style:SystemBarsStyle.Dark})).catch(()=>{});void ScreenOrientation.unlock().catch(()=>{});}};
 },[]);
 function control(label:string,bits:number,cls='',detail=''){const p=state.current.players[mode==='online'?seat:0],reason=(bits===B.burst||bits===B.super)?actionMessage(p,state.current.phase,bits):'';return <button className={'control '+cls} aria-label={label} aria-disabled={!!reason} data-ready={!reason} title={reason||label} onContextMenu={e=>e.preventDefault()} onPointerDown={e=>{e.preventDefault();const current=state.current,reason=(bits===B.burst||bits===B.super)?actionMessage(current.players[mode==='online'?seat:0],current.phase,bits):'';if(reason){tell(reason);return;}e.currentTarget.setPointerCapture(e.pointerId);touch.current.set(e.pointerId,bits);if(mode==='online')socket?.emit('input',input());e.currentTarget.classList.add('pressed');}} onPointerUp={e=>{touch.current.delete(e.pointerId);if(mode==='online')socket?.emit('input',input());e.currentTarget.classList.remove('pressed');}} onPointerCancel={e=>{touch.current.delete(e.pointerId);if(mode==='online')socket?.emit('input',input());e.currentTarget.classList.remove('pressed');}} onLostPointerCapture={e=>{touch.current.delete(e.pointerId);if(mode==='online')socket?.emit('input',input());e.currentTarget.classList.remove('pressed');}}><span>{label}</span>{detail&&<small>{detail}</small>}</button>;}
 return <main className={'game-shell '+(touchOn?'has-touch':'')}><div className="game-toolbar" ref={toolbar}><span className="live-dot"/><b>{mode==='online'?'LIVE DUEL':mode==='cpu'?'CPU · '+['DỄ','VỪA','KHÓ'][level]:mode==='training'?'TẬP LUYỆN':'LOCAL VERSUS'}</b><span className="telemetry">{metrics.fps} FPS · P95 {metrics.p95} ms{mode==='online'?' · RTT '+metrics.ping+' ms':''}</span><button onClick={()=>{clear();setTouchOn(!touchOn);}}>Nút cảm ứng</button><button onClick={()=>{setHelp(!help);if(mode!=='online'&&!paused)pause();}}>?</button>{mode!=='online'&&<button onClick={pause}>{paused?'Tiếp tục':'Dừng'}</button>}<button onClick={()=>{if(window.confirm('Rời trận? Trận online sẽ tính thua.'))onExit();}}>Thoát</button></div>
 <div className="arena" ref={arena}><canvas ref={canvas} width={960} height={540} aria-label="Đấu trường đối kháng"/>{!artLoaded&&<div className="game-overlay asset-loading"><div className="panel"><p className="eyebrow">RIFT ARENA · VISUAL UPDATE</p><h2>{artError?'Thiếu tài nguyên đồ họa':'Đang tải đấu trường…'}</h2><p>{artError||'Chuẩn bị sprite và hoạt ảnh chiến binh.'}</p>{artError&&<button onClick={onExit}>Về sảnh</button>}</div></div>}{net&&<div className="network-error">{net}<button onClick={onExit}>Về sảnh</button></div>}
 {(paused||help)&&!result&&<div className="game-overlay"><div className="panel"><p className="eyebrow">MOVE LIST</p><h2>{help?'Làm chủ trận đấu':'Tạm dừng'}</h2><p>A/D di chuyển · W hướng lên · S đỡ · Space nhảy<br/>{mode==='local'?'P1: F đánh · G kỹ năng · H lăn · R tuyệt chiêu · T bộc phát':'J đánh · K kỹ năng · L lăn · U tuyệt chiêu · I bộc phát'}<br/>{mode==='local'&&'P2: Mũi tên · Numpad 0 nhảy · 1 đánh · 2 kỹ năng · 3 lăn · 4 tuyệt chiêu · 5 bộc phát'}</p><p>Nhấn hướng hai lần để chạy nhanh. Nhấn Đánh nối tiếp lúc đòn trúng để combo. Hướng lên/xuống + Đánh: hất tung/phá đỡ. Giữ hướng + Kỹ năng: đổi chiêu. Esc: tạm dừng trận offline. Cảm ứng: ▲ để nhảy; Bộc phát cần đầy 300 năng lượng, dùng trên mặt đất khi hết đòn/choáng, tăng 12% sát thương và 10% tốc độ trong 8 giây.</p><button className="primary" onClick={()=>{setHelp(false);if(paused)pause();}}>Tiếp tục</button></div></div>}
 {result&&<div className="game-overlay"><div className="panel result"><p className="eyebrow">MATCH COMPLETE</p><h1>{result.winner===(mode==='online'?seat:0)?'VICTORY':'DEFEAT'}</h1>{result.endReason==='forfeit'?<p>Trận kết thúc do một người rời hoặc mất kết nối.</p>:<div className="score">{result.wins[0]} <span>:</span> {result.wins[1]}</div>}<p>Combo cao nhất: {result.players[mode==='online'?seat:0].maxCombo} hits</p><button className="primary" onClick={onExit}>Trở về sảnh</button></div></div>}</div>
 {hint&&<div className="combat-hint" role="status">{hint}</div>}{touchOn&&<div className="touch-deck"><div className="dpad">{control('▲',TOUCH_JUMP,'up','NHẢY')}{control('◀',B.left,'left')}{control('ĐỠ',B.block,'down')}{control('▶',B.right,'right')}</div><div className="touch-hint">RIFT<br/><span>ARENA</span></div><div className="actions">{control('BỘC PHÁT',B.burst,'burst '+(combatUI.burst>0?'is-active':''),combatUI.burst>0?Math.ceil(combatUI.burst/60)+'s':Math.min(100,Math.floor(combatUI.energy/3))+'%')}{control('SIÊU',B.super,'super','100 NL')}{control('LĂN',B.roll)}{control('KỸ NĂNG',B.skill,'skill')}{control('ĐÁNH',B.attack,'attack')}</div></div>}
 {!touchOn&&<div className="keyboard-strip">{mode==='local'?'P1: WASD · Space · F đánh · G kỹ năng · H né · R siêu · T bộc phát | P2: Mũi tên · Numpad 0 nhảy · 1 đánh · 2 kỹ năng · 3 né · 4 siêu · 5 bộc phát':'WASD hướng/đỡ · Space nhảy · J đánh · K kỹ năng · L né · U tuyệt chiêu · I bộc phát'} · Esc dừng</div>}
 </main>;
}
