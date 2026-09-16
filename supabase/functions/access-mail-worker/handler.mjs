const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const OWNER='eduardo.falcao@raizeducacao.com.br';
const ORIGIN='https://raiz-obras.vercel.app';
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export function messageFor(job,link){
 if(job.is_test)return {subject:'Teste de convites - Obras e Real Estate',text:'Eduardo, o envio pela sua conta Google esta funcionando. Este teste nao concede acesso, nao muda suas permissoes e nao foi enviado a terceiros.',html:'<p>Eduardo, o envio pela sua conta Google esta funcionando.</p><p>Este teste nao concede acesso e nao muda suas permissoes.</p>'};
 const text=`Ola, ${job.nome}. Voce recebeu um convite para a plataforma Obras e Real Estate da Raiz Educacao.\n\nAcesse: ${link}\n\nO convite expira em ate uma hora apos a solicitacao. As areas disponiveis sao as definidas pelo administrador. Se nao esperava este convite, ignore esta mensagem.`;
 return {subject:'Seu convite - Obras e Real Estate | Raiz Educacao',text,html:`<div style="font-family:Arial,sans-serif;color:#173c36;max-width:560px;margin:0 auto;padding:28px"><h2 style="margin:0 0 22px">Obras e Real Estate</h2><p>Olá, ${escape(job.nome)}.</p><p>Você recebeu um convite para acessar a plataforma da Raiz Educação.</p><p style="margin:28px 0"><a href="${escape(link)}" style="background:#167c71;color:#fff;padding:13px 20px;text-decoration:none;border-radius:6px;display:inline-block">Aceitar convite</a></p><p>O convite expira em até uma hora após a solicitação. Seu acesso será limitado às permissões definidas pelo administrador.</p><p style="color:#60736e;font-size:12px">Se não esperava este convite, ignore esta mensagem.</p></div>`};
}

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
     // generate_link does not send email. A fresh link is generated only when claimed.
     const auth=await api('/auth/v1/admin/generate_link',{type:job.existing_user?'magiclink':'invite',email:job.to,data:{nome:job.nome},redirect_to:ORIGIN+'/?access_invite='+job.invitation_id});
     link=auth.action_link||auth.properties?.action_link;
     const parsed=new URL(link);
     if(parsed.origin!==new URL(url).origin||parsed.pathname!=='/auth/v1/verify'||parsed.searchParams.get('redirect_to')!==ORIGIN+'/?access_invite='+job.invitation_id)throw new Error('invalid_link');
    }
    return reply(200,{ok:true,job:{id:job.id,lease:job.lease,to:job.to,...messageFor(job,link)}});
   }catch{
    await rpc('app_mail_ack',{p_id:job.id,p_lease:job.lease,p_success:false});
    return reply(502,{ok:false});
   }
  }catch{return reply(503,{ok:false});}
 };
}
