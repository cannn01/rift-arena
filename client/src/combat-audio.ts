// Tiny synthesized effects: no additional audio downloads or per-frame oscillators.
export function combatAudio(enabled:boolean){
 let ctx:AudioContext|null=null,last=0;
 try{if(enabled){ctx=new AudioContext();void ctx.resume();}}catch{}
 return {play(kind:string){if(!ctx||ctx.state!=='running'||ctx.currentTime-last<.035)return;last=ctx.currentTime;
 const t=ctx.currentTime,osc=ctx.createOscillator(),gain=ctx.createGain();osc.type=kind==='guard'?'triangle':'sawtooth';const superMove=kind==='super';osc.frequency.setValueAtTime(superMove?100:kind==='guard'?600:210,t);osc.frequency.exponentialRampToValueAtTime(superMove?35:55,t+.09);gain.gain.setValueAtTime(superMove?.045:.022,t);gain.gain.exponentialRampToValueAtTime(.0001,t+.12);osc.connect(gain);gain.connect(ctx.destination);osc.start(t);osc.stop(t+.13);},close(){void ctx?.close();}};
}
