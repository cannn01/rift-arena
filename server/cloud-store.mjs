// Redis is authoritative for ownership, recoverable room checkpoints and results.
// Lua fences writes so an expired Function cannot overwrite a replacement owner.
export const CHECKPOINT = `
if redis.call('GET',KEYS[1]) ~= ARGV[1] then return 0 end
redis.call('PEXPIRE',KEYS[1],4000)
redis.call('SET',KEYS[2],ARGV[2],'EX',3600)
local r=cjson.decode(ARGV[2])
if r.match and r.match~=cjson.null and r.match.phase=='done' and r.matchId and redis.call('SET',KEYS[3]..r.matchId,'1','NX','EX',604800) then
 for i,p in ipairs(r.players) do
  if p and p~=cjson.null then
   local raw=redis.call('HGET',KEYS[4],p.user.uid)
   local s=raw and cjson.decode(raw) or {wins=0,losses=0,matches=0,best_combo=0}
   s.name=p.user.name; s.matches=s.matches+1
   if r.match.winner==i-1 then s.wins=s.wins+1 end
   if r.match.winner==2-i then s.losses=s.losses+1 end
   s.best_combo=math.max(s.best_combo,r.match.players[i].maxCombo or 0)
   redis.call('HSET',KEYS[4],p.user.uid,cjson.encode(s))
   if string.sub(p.user.uid,1,6)~='guest:' then redis.call('ZADD',KEYS[5],s.wins,p.user.uid) end
  end
 end
 redis.call('LPUSH',KEYS[6],cjson.encode({id=r.matchId,created_at=ARGV[3],players=r.players,winner=r.match.winner,score=r.match.wins}))
 redis.call('LTRIM',KEYS[6],0,999)
end
return 1`;
const RELEASE = `if redis.call('GET',KEYS[1])==ARGV[1] then return redis.call('DEL',KEYS[1]) end return 0`;
const CLAIM_SESSION = `
local old=redis.call('GET',KEYS[1])
if old and string.sub(old,1,string.len(ARGV[1])+1)~=ARGV[1]..':' then return 0 end
redis.call('SET',KEYS[1],ARGV[1]..':'..ARGV[2],'EX',30);return 1`;
const TOUCH_SESSION = `if redis.call('GET',KEYS[1])~=ARGV[1] then return 0 end redis.call('EXPIRE',KEYS[1],30);return 1`;
export const decode = v=>typeof v==='string'?JSON.parse(v):v;
export class CloudStore {
 constructor(redis,prefix){this.redis=redis;this.prefix=prefix;}
 key(part){return this.prefix+':'+part;}
 async acquire(code,owner){return !!await this.redis.set(this.key('lease:'+code),owner,{nx:true,px:4000});}
 owner(code){return this.redis.get(this.key('lease:'+code));}
 async load(code){return decode(await this.redis.get(this.key('room:'+code)));}
 async checkpoint(room,owner){return Number(await this.redis.eval(CHECKPOINT,[this.key('lease:'+room.code),this.key('room:'+room.code),this.key('recorded:'),this.key('players'),this.key('ranking'),this.key('matches')],[owner,JSON.stringify(room),String(Date.now())]))===1;}
 release(code,owner){return this.redis.eval(RELEASE,[this.key('lease:'+code)],[owner]);}
 async create(room,owner){
  if(!await this.redis.set(this.key('room:'+room.code),JSON.stringify(room),{nx:true,ex:3600}))return false;
  if(!await this.acquire(room.code,owner))return false;
  return true;
 }
 async mapUser(uid,code){await this.redis.set(this.key('user-room:'+uid),code,{ex:3600});}
 userRoom(uid){return this.redis.get(this.key('user-room:'+uid));}
 async stats(uid){return decode(await this.redis.hget(this.key('players'),uid))||{wins:0,losses:0,matches:0,best_combo:0};}
 async leaderboard(){const ids=await this.redis.zrange(this.key('ranking'),0,19,{rev:true});return Promise.all(ids.map(uid=>this.stats(uid)));}
 claim(uid,clientId,socket){return this.redis.eval(CLAIM_SESSION,[this.key('session:'+uid)],[clientId,socket]);}
 touch(uid,clientId,socket){return this.redis.eval(TOUCH_SESSION,[this.key('session:'+uid)],[clientId+':'+socket]);}
 unclaim(uid,clientId,socket){return this.redis.eval(RELEASE,[this.key('session:'+uid)],[clientId+':'+socket]);}
}
