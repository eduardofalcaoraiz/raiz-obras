const ORIGIN='https://raiz-obras.vercel.app';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function createOpenHandler({url,serviceKey,fetcher=fetch}){
 return async req=>{
  const headers={'Content-Type':'application/json','Cache-Control':'no-store','Access-Control-Allow-Origin':ORIGIN,'Access-Control-Allow-Headers':'content-type','Access-Control-Allow-Methods':'POST,OPTIONS','Vary':'Origin'};
  const reply=(status,body)=>new Response(JSON.stringify(body),{status,headers});
  if(req.headers.get('Origin')&&req.headers.get('Origin')!==ORIGIN)return reply(403,{error:'Origem nao autorizada.'});
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
  if(req.method!=='POST')return reply(405,{error:'Metodo nao permitido.'});
  try{
   if(!url||!serviceKey)throw Error('configuration');
   const raw=await req.text();if(raw.length>1000)return reply(413,{error:'Solicitacao invalida.'});
   let body;try{body=JSON.parse(raw);}catch{return reply(400,{error:'Convite invalido.'});}
   if(!UUID.test(body?.id||'')||!/^[a-f0-9]{64}$/.test(body?.token||''))return reply(400,{error:'Convite invalido.'});
   const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(body.token))),b=>b.toString(16).padStart(2,'0')).join('');
   async function api(path,data){return fetcher(url+path,{method:'POST',headers:{Authorization:'Bearer '+serviceKey,apikey:serviceKey,'Content-Type':'application/json'},body:JSON.stringify(data),signal:AbortSignal.timeout(15000)});}
   const check=await api('/rest/v1/rpc/app_invite_link_open',{p_id:body.id,p_hash:hash});
   if(!check.ok){const e=await check.json().catch(()=>({}));return reply(e.code==='P0429'?429:403,{error:e.code==='P0429'?'Aguarde alguns segundos e tente novamente.':'Convite indisponivel. Se ja ativou seu acesso, entre pela tela de login. Caso contrario, fale com o administrador.'});}
   const invite=await check.json();
   const redirect=ORIGIN+'/?access_invite='+body.id;
   // Generate a short-lived authentication token only on an explicit opening.
   const auth=await api('/auth/v1/admin/generate_link',{type:invite.existing_user?'magiclink':'invite',email:invite.email,data:{nome:invite.nome},redirect_to:redirect});
   if(!auth.ok)throw Error('authentication');
   const data=await auth.json(),link=data.action_link||data.properties?.action_link,parsed=new URL(link);
   if(parsed.origin!==new URL(url).origin||parsed.pathname!=='/auth/v1/verify'||parsed.searchParams.get('redirect_to')!==redirect)throw Error('invalid_redirect');
   return reply(200,{url:link});
  }catch{return reply(503,{error:'Nao foi possivel abrir o convite. Tente novamente.'});}
 };
}
