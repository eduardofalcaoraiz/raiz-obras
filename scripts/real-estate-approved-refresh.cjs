'use strict';
const {classify}=require('./real-estate-discovery.cjs');
const BATCH_SIZE=1000;
function bounded(value,fallback,max){const n=Number(value??fallback);if(!Number.isInteger(n)||n<1||n>max)throw Error('Invalid approved refresh limit');return n;}
async function refreshApproved({db,ticket,saveState,reference,env=process.env,now=Date.now}){
 const limit=bounded(env.RE_APPROVED_BATCH,BATCH_SIZE,3000);
 const deadline=now()+bounded(env.RE_APPROVED_SECONDS,1200,1800)*1000;
 const state=(await db('real_estate_sync_state?name=eq.approved-refresh','GET',undefined,deadline))[0]?.value||{};
 let after=String(state.after||'');
 if(after&&!/^\d{4,8}$/.test(after))throw Error('Invalid approved refresh cursor');
 const known=new Map(reference.tickets.map(t=>[String(t.ticket_raiz),t]));
 const retries=new Map((state.retries||[]).filter(r=>known.has(r.id)).map(r=>[r.id,r]));
 const due=[...retries.values()].filter(r=>r.next<=now()).sort((a,b)=>a.next-b.next).slice(0,Math.min(40,limit)).map(r=>r.id);
 // Reserve capacity for historical rotation even when the active queue is large.
 const active=[...known.values()].filter(t=>t.status==='Em andamento'&&(!t.sincronizado_em||now()-Date.parse(t.sincronizado_em)>=86400000)&&!retries.has(String(t.ticket_raiz)))
  .sort((a,b)=>String(a.sincronizado_em||'').localeCompare(String(b.sincronizado_em||''))||String(a.ticket_raiz).localeCompare(String(b.ticket_raiz)))
  .slice(0,Math.floor((limit-due.length)*0.7)).map(t=>String(t.ticket_raiz));
 const priority=new Set([...due,...active]);
 const rotation=[...known.keys()].sort().filter(id=>id>after);
 const result={attempted:0,refreshed:0,failed:0,retries_pending:0,time_limited:false};
 const persist=()=>saveState('approved-refresh',{after,retries:[...retries.values()]},deadline+30000);
 async function one(id){
  result.attempted++;
  try{
   const t=await ticket(id,deadline);
   if(String(t?.id)!==id)throw Error('Approved refresh ticket mismatch');
   const candidate=classify(t,reference);
   if(!candidate)throw Error('Registered ticket cannot be classified');
   await db('rpc/refresh_real_estate_snapshot','POST',{p_candidate:candidate},deadline);
   retries.delete(id);result.refreshed++;
  }catch(error){
   const attempts=(retries.get(id)?.attempts||0)+1;
   retries.set(id,{id,attempts,next:now()+Math.min(86400000,300000*2**Math.min(attempts-1,9)),error:String(error.message).slice(0,200)});
   result.failed++;
  }
 }
 for(const id of priority){
  if(now()>=deadline){result.time_limited=true;break;}
  await one(id);await persist();
 }
 let exhausted=true;
 for(const id of rotation){
  if(result.attempted>=limit||now()>=deadline){exhausted=false;result.time_limited=now()>=deadline;break;}
  if(!priority.has(id)&&!retries.has(id))await one(id);
  // Persist failures with the cursor, so a poisoned ticket cannot block others.
  after=id;await persist();
 }
 if(exhausted){after='';await persist();}
 result.retries_pending=retries.size;
 return result;
}
module.exports={refreshApproved,BATCH_SIZE};
