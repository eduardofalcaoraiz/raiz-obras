import {messageFor} from './email-template.mjs';
export {messageFor};
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const OWNER='eduardo.falcao@raizeducacao.com.br';
const ORIGIN='https://raiz-obras.vercel.app';

export function createWorker({url,serviceKey,audience,verifyGoogle,fetcher=fetch}){
 return async req=>{
  const reply=(status,data)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
  if(req.method!=='POST'||req.headers.has('Origin'))return reply(403,{ok:false});
  if(!audience||!url||!serviceKey)return reply(503,{ok:false});
  const token=req.headers.get('Authorization')?.match(/^Bearer (.{1,8000})$/)?.[1];
  if(!token)return reply(401,{ok:false});
  try{
   const claims=await verifyGoogle(token,audience);
   if(claims.aud!==audience||claims.email!==OWNER||claims.email_verified!==true||!['accounts.google.com','https://accounts.google.com'].includes(claims.iss)||claims.exp*1000<=Date.now())return reply(403,{ok:false});
  }catch{return reply(401,{ok:false});}
  async function api(path,body){
   const r=await fetcher(url+path,{method:'POST',headers:{Authorization:'Bearer '+serviceKey,apikey:serviceKey,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(15000)});
   if(!r.ok)throw new Error('upstream');return r.status===204?null:r.json();
  }
  const rpc=(name,body={})=>api('/rest/v1/rpc/'+name,body);
  try{
   const raw=await req.text();if(raw.length>2000)return reply(413,{ok:false});
   const body=JSON.parse(raw);
   if(!body||!['status','claim','ack'].includes(body.action))return reply(400,{ok:false});
   if(!Number.isInteger(body.quota)||body.quota<0||body.quota>100000)return reply(400,{ok:false});
   await rpc('app_mail_heartbeat',{p_quota:body.quota});
   if(body.action==='status')return reply(200,{ok:true});
   if(body.action==='ack'){
    if(!UUID.test(body.id||'')||!UUID.test(body.lease||'')||typeof body.success!=='boolean')return reply(400,{ok:false});
    await rpc('app_mail_ack',{p_id:body.id,p_lease:body.lease,p_success:body.success});return reply(200,{ok:true});
   }
   if(body.quota<1)return reply(200,{ok:true,job:null});
   const job=await rpc('app_mail_claim');if(!job)return reply(200,{ok:true,job:null});
   try{
    if(job.is_test&&job.to!==OWNER)throw new Error('test_recipient');
    let link;
    if(!job.is_test){
     if(!UUID.test(job.invitation_id||''))throw new Error('invalid_invitation');
     const secret=Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,'0')).join('');
     const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(secret))),b=>b.toString(16).padStart(2,'0')).join('');
     await rpc('app_invite_link_save',{p_id:job.invitation_id,p_lease:job.lease,p_hash:hash});
     link=ORIGIN+'/convite.html#'+job.invitation_id+'.'+secret;
    }
    return reply(200,{ok:true,job:{id:job.id,lease:job.lease,to:job.to,...messageFor(job,link)}});
   }catch{
    await rpc('app_mail_ack',{p_id:job.id,p_lease:job.lease,p_success:false});
    return reply(502,{ok:false});
   }
  }catch{return reply(503,{ok:false});}
 };
}
