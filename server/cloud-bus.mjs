// One authenticated server-side Pub/Sub channel. Never expose its token to clients.
export class CloudBus {
 constructor(redis,channel,onMessage){this.redis=redis;this.channel=channel;this.onMessage=onMessage;this.closed=false;this.lastSeen=Date.now();}
 async start(){
  if(this.closed)throw new Error('Bus closed');
  if(this.sub)await this.sub.unsubscribe();
  await new Promise((resolve,reject)=>{
   const sub=this.sub=this.redis.subscribe(this.channel);
   const timer=setTimeout(()=>reject(new Error('Redis subscription timed out')),8000);
   sub.on('subscribe',()=>{clearTimeout(timer);this.lastSeen=Date.now();resolve();});
   sub.on('message',({message})=>{this.lastSeen=Date.now();try{this.onMessage(typeof message==='string'?JSON.parse(message):message);}catch{console.error('Invalid internal Redis message');}});
   sub.on('error',()=>{clearTimeout(timer);reject(new Error('Redis subscription failed'));this.lastSeen=0;});
  });
 }
 publish(message){return this.redis.publish(this.channel,JSON.stringify(message));}
 async close(){this.closed=true;await this.sub?.unsubscribe();}
}
