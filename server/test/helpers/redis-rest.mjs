// Local Upstash-compatible HTTP/SSE bridge for SDK integration tests only.
import {createServer} from 'node:http';
import IORedis from 'ioredis';
import {Redis} from '@upstash/redis';
export async function restRedis(url){
 const connection=new IORedis(url),subscribers=new Set();
 const server=createServer(async(req,res)=>{
  try{
   if(req.url.startsWith('/subscribe/')){
    const channel=decodeURIComponent(req.url.slice('/subscribe/'.length)),sub=connection.duplicate();subscribers.add(sub);
    res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-cache','Connection':'keep-alive'});
    sub.on('message',(ch,message)=>res.write('data: message,'+ch+','+message+'\n\n'));
    await sub.subscribe(channel);res.write('data: subscribe,'+channel+',1\n\n');
    res.on('close',()=>{subscribers.delete(sub);sub.disconnect();});return;
   }
   let body='';for await(const chunk of req)body+=chunk;
   const command=JSON.parse(body),value=await connection.call(...command);
   const encode=v=>typeof v==='string'?(v==='OK'?'OK':Buffer.from(v).toString('base64')):Array.isArray(v)?v.map(encode):v;
   res.setHeader('Content-Type','application/json');res.end(JSON.stringify({result:req.headers['upstash-encoding']==='base64'?encode(value):value}));
  }catch(e){res.statusCode=400;res.end(JSON.stringify({error:e.message}));}
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const redis=new Redis({url:'http://127.0.0.1:'+server.address().port,token:'integration-test-only',automaticDeserialization:false,enableAutoPipelining:false,retry:{retries:0}});
 redis.close=async()=>{for(const sub of subscribers)sub.disconnect();server.closeAllConnections();await new Promise(r=>server.close(r));await connection.quit();};
 return redis;
}
