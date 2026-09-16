const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MODULES=new Set(['escolas','capex','registros','realestate_locacoes','realestate_sublocacoes','expansao','nova','cobranca','forn','investidores']);
export function validPermissions(value){return !!value&&typeof value==='object'&&!Array.isArray(value)&&Object.entries(value).every(([k,v])=>MODULES.has(k)&&['none','read','edit'].includes(v))&&Object.values(value).some(v=>v==='read'||v==='edit');}
class Failure extends Error {constructor(status,message){super(message);this.status=status;}}
export function createHandler({url,anonKey,serviceKey,emailEnabled=false,delivery='smtp',fetcher=fetch,origin='https://raiz-obras.vercel.app'}){
 return async function handle(req){
  const cors={'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info','Access-Control-Allow-Methods':'POST,OPTIONS','Vary':'Origin','Cache-Control':'no-store'};
  const reply=(status,body)=>new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json'}});
  if(req.headers.get('Origin')&&req.headers.get('Origin')!==origin)return reply(403,{error:'Origem nao autorizada.'});
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
  if(req.method!=='POST')return reply(405,{error:'Metodo nao permitido.'});
  async function api(path,body,key=serviceKey,bearer=key){
   const response=await fetcher(url+path,{method:body===undefined?'GET':'POST',headers:{apikey:key,Authorization:'Bearer '+bearer,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(15000)});
   const data=await response.json().catch(()=>({}));
   if(!response.ok){
    if(response.status===429||data.code==='P0429')throw new Failure(429,'Limite de envio atingido. Aguarde antes de tentar novamente.');
    if(path.startsWith('/rest/v1/rpc/'))throw new Failure(409,data.message||'Nao foi possivel atualizar o convite.');
    if(path==='/auth/v1/user')throw new Failure(401,'Sessao expirada. Entre novamente.');
    throw new Failure(502,'O provedor de e-mail recusou o envio. Confira a configuracao SMTP e os limites de envio.');
   }
   return data;
  }
  const rpc=(name,body)=>api('/rest/v1/rpc/'+name,body);
  try{
   if(!url||!anonKey||!serviceKey)throw new Failure(503,'Servico de convites indisponivel.');
   const token=req.headers.get('Authorization')?.match(/^Bearer (.+)$/i)?.[1];
   if(!token||token===anonKey||token===serviceKey)throw new Failure(401,'Autenticacao necessaria.');
   const raw=await req.text();if(raw.length>10000)throw new Failure(413,'Solicitacao muito grande.');
   let body;try{body=JSON.parse(raw);}catch{throw new Failure(400,'Solicitacao invalida.');}
   if(!body||typeof body!=='object')throw new Failure(400,'Solicitacao invalida.');
   const user=await api('/auth/v1/user',undefined,anonKey,token);
   if(!UUID.test(user.id||''))throw new Failure(401,'Sessao invalida.');
   if(body.action==='accept'){
    if(!UUID.test(body.id||''))throw new Failure(400,'Convite invalido.');
    return reply(200,await rpc('app_invite_accept',{p_id:body.id,p_user_id:user.id}));
   }
   const profiles=await api('/rest/v1/user_profiles?id=eq.'+user.id+'&select=role,aprovado',undefined,anonKey,token);
   if(!profiles?.[0]?.aprovado||profiles[0].role!=='admin')throw new Failure(403,'Somente o administrador pode gerenciar convites.');
   if(body.action==='status'){
    const mail=delivery==='google'?await rpc('app_mail_status',{}):{ready:true};
    return reply(200,{emailEnabled:emailEnabled&&mail.ready===true,delivery});
   }
   if(body.action==='revoke'){
    if(!UUID.test(body.id||''))throw new Failure(400,'Convite invalido.');
    await rpc('app_invite_revoke',{p_id:body.id,p_actor:user.id});return reply(200,{revoked:true});
   }
   if(body.action!=='send')throw new Failure(400,'Operacao invalida.');
   if(!emailEnabled)throw new Failure(503,'O envio de convites ainda nao esta ativo. Nenhum convite foi enviado.');
   if(delivery==='google'&&!(await rpc('app_mail_status',{})).ready)throw new Failure(503,'A conexao de envio com o Google esta indisponivel. Aguarde antes de tentar novamente.');
   const email=String(body.email||'').trim().toLowerCase(),nome=String(body.nome||'').trim();
   if(!UUID.test(body.id||'')||!/^\S+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254||nome.length<2||nome.length>120||!validPermissions(body.permissions))throw new Failure(400,'Informe nome, e-mail e ao menos uma area de acesso.');
   const invitation=await rpc('app_invite_prepare',{p_id:body.id,p_actor:user.id,p_email:email,p_nome:nome,p_config:body.permissions});
   if(invitation.duplicate){
    if(invitation.status==='sent')return reply(200,{sent:true,id:invitation.id});
    if(delivery==='google'&&invitation.status==='sending'){
     await rpc('app_mail_enqueue',{p_id:invitation.id,p_actor:user.id});return reply(200,{queued:true,id:invitation.id});
    }
    throw new Failure(409,'Este envio ja foi solicitado. Confira a lista de convites antes de tentar novamente.');
   }
   if(delivery==='google'){
    await rpc('app_mail_enqueue',{p_id:invitation.id,p_actor:user.id});
    return reply(200,{queued:true,id:invitation.id});
   }
   const redirect=origin+'/?access_invite='+encodeURIComponent(invitation.id);
   try{
    if(invitation.existing_user)await api('/auth/v1/otp?redirect_to='+encodeURIComponent(redirect),{email,create_user:false},anonKey);
    else await api('/auth/v1/invite?redirect_to='+encodeURIComponent(redirect),{email,data:{nome}});
   }catch(e){
    await rpc('app_invite_delivery',{p_id:invitation.id,p_actor:user.id,p_success:false,p_error:'email_delivery_failed'}).catch(()=>{});
    throw e;
   }
   await rpc('app_invite_delivery',{p_id:invitation.id,p_actor:user.id,p_success:true,p_error:null});
   return reply(200,{sent:true,id:invitation.id});
  }catch(e){return reply(e.status||503,{error:e instanceof Failure?e.message:'Nao foi possivel concluir a operacao. Confira a lista antes de tentar novamente.'});}
 };
}
