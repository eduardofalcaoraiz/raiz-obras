(function(root){
 'use strict';
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
 let users=[],invites=[],tab='active',search='',emailEnabled=null,loadError='',loading=false,saving=false,requestId=null,arrival=null;
 const icon=(name)=>`<img src="/assets/icons/lucide/${name}.svg" width="17" height="17" alt="">`;
 function invitationStatus(i){return i.status==='sent'&&new Date(i.expires_at).getTime()<=Date.now()?'expired':i.status;}
 const statuses={sending:'Enviando',sent:'Aguardando aceite',accepted:'Aceito',failed:'Falha no envio',revoked:'Revogado',expired:'Expirado'};
 async function api(body){
  const {data:{session}}=await db.auth.getSession();if(!session)throw new Error('Sua sess\u00e3o expirou. Entre novamente.');
  const response=await fetch(SUPA_URL+'/functions/v1/access-invitations',{method:'POST',headers:{Authorization:'Bearer '+session.access_token,apikey:SUPA_ANON,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(25000)});
  const data=await response.json().catch(()=>({}));if(!response.ok){const error=new Error(data.error||'N\u00e3o foi poss\u00edvel concluir a opera\u00e7\u00e3o.');error.status=response.status;throw error;}return data;
 }
 function mount(list){users=list;render();load();}
 async function load(){
  if(loading||!AccessControl.can('','admin'))return;loading=true;loadError='';
  try{
   const {data,error}=await db.from('user_access_invitations').select('id,email,nome,access_config,status,created_at,sent_at,expires_at,accepted_at').order('created_at',{ascending:false}).limit(200);
   if(error)throw error;invites=data||[];
   const state=await api({action:'status'});emailEnabled=state.emailEnabled===true;
  }catch(e){loadError=e.message||'Falha ao carregar convites.';emailEnabled=null;}
  finally{loading=false;render();}
 }
 function render(){
  const host=document.getElementById('admin-users');if(!host)return;
  const normalize=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const match=u=>normalize((u.nome||'')+' '+u.email).includes(normalize(search));
  const active=users.filter(u=>u.aprovado),inactive=users.filter(u=>!u.aprovado),pending=invites.filter(i=>['sent','sending'].includes(invitationStatus(i)));
  const list=(tab==='active'?active:inactive).filter(match),rows=invites.filter(match);
  const hadFocus=document.activeElement?.id==='access-search',caret=hadFocus?document.activeElement.selectionStart:0;
  host.innerHTML=`<div class="access-overview"><div><span>Pessoas ativas</span><strong>${active.length}</strong></div><div><span>Convites pendentes</span><strong>${pending.length}</strong></div><div><span>Sem acesso</span><strong>${inactive.length}</strong></div></div>
   <div class="access-toolbar"><div class="access-tabs" role="tablist" aria-label="Gest\u00e3o de acessos">${[['active','Pessoas',active.length],['invites','Convites',invites.length],['inactive','Sem acesso',inactive.length]].map(([id,label,count])=>`<button type="button" role="tab" aria-selected="${tab===id}" onclick="AccessInvites.setTab('${id}')">${label}<span>${count}</span></button>`).join('')}</div><label class="access-search">${icon('search')}<input id="access-search" type="search" placeholder="Buscar nome ou e-mail" aria-label="Buscar nome ou e-mail" value="${esc(search)}" oninput="AccessInvites.search(this.value)"></label></div>
   ${loadError?`<div class="access-service-note is-error" role="alert">${esc(loadError)}<button class="btn btn-sm btn-ghost" onclick="AccessInvites.load()">Tentar novamente</button></div>`:emailEnabled===false?'<div class="access-service-note">'+icon('mail')+'<span><b>Envio de e-mails pendente de configura\u00e7\u00e3o</b><small>SMTP n\u00e3o configurado. Os convites ainda n\u00e3o podem ser enviados.</small></span></div>':''}
   <div class="access-table-scroll">${tab==='invites'?renderInvites(rows):(list.length?AccessControl.renderUsers(list):'<div class="access-empty-state">Nenhuma pessoa neste filtro.</div>')}</div>`;
  if(hadFocus){const input=document.getElementById('access-search');input.focus();input.setSelectionRange?.(caret,caret);}
 }
 function renderInvites(rows){
  if(!rows.length)return '<div class="access-empty-state">'+icon('mail')+'<b>Nenhum convite enviado</b></div>';
  return `<table class="access-people-table"><thead><tr><th>Destinat\u00e1rio</th><th>Permiss\u00f5es</th><th>Enviado em</th><th>Status</th><th>A\u00e7\u00f5es</th></tr></thead><tbody>${rows.map(i=>{
   const status=invitationStatus(i),date=i.sent_at?new Date(i.sent_at).toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'}):'N\u00e3o enviado';
   return `<tr><td><b>${esc(i.nome)}</b><span class="access-email">${esc(i.email)}</span></td><td>${esc(AccessControl.summary({access_config:i.access_config}))}</td><td>${esc(date)}</td><td><span class="access-status ${status==='accepted'?'is-active':status==='failed'?'is-error':''}">${statuses[status]||esc(status)}</span></td><td><div class="access-row-actions">${status!=='accepted'&&uuid.test(i.id)?`<button class="access-icon-button" title="Preparar novo convite" aria-label="Preparar novo convite para ${esc(i.email)}" onclick="AccessInvites.resend('${i.id}')">${icon('refresh-cw')}</button>`:''}${['sent','sending','failed'].includes(i.status)&&uuid.test(i.id)?`<button class="access-icon-button danger" title="Revogar convite" aria-label="Revogar convite para ${esc(i.email)}" onclick="AccessInvites.revoke('${i.id}')">${icon('ban')}</button>`:''}</div></td></tr>`;
  }).join('')}</tbody></table>`;
 }
 function open(id,invitation){
  if(!AccessControl.can('','admin'))return;
  const source=invitation||users.find(u=>u.id===id)||{};saving=false;requestId=crypto.randomUUID();
  let dlg=document.getElementById('invite-dialog');
  if(!dlg){dlg=document.createElement('dialog');dlg.id='invite-dialog';dlg.className='access-dialog';document.body.append(dlg);dlg.addEventListener('cancel',e=>{if(saving)e.preventDefault();});}
  dlg.innerHTML=`<form onsubmit="event.preventDefault();AccessInvites.send()"><header><div><span class="access-dialog-kicker">NOVO ACESSO</span><h2>Convidar pessoa</h2></div><button type="button" class="access-close" title="Fechar" aria-label="Fechar" onclick="AccessInvites.close()">${icon('x')}</button></header>
   ${emailEnabled!==true?'<div class="access-service-note in-dialog"><span><b>Envio de e-mail indispon\u00edvel</b><small>A configura\u00e7\u00e3o SMTP precisa ser conclu\u00edda antes do primeiro convite.</small></span></div>':''}
   <div class="access-invite-fields"><label>Nome<input id="invite-name" class="fi" required minlength="2" maxlength="120" autocomplete="name" value="${esc(source.nome||'')}"></label><label>E-mail<input id="invite-email" class="fi" type="email" required maxlength="254" autocomplete="email" value="${esc(source.email||'')}"></label></div>${AccessControl.matrix(source.access_config||{},'invite')}
   <div id="invite-error" class="access-error" role="alert" hidden></div><footer><span id="invite-selection">Permiss\u00f5es individuais</span><button class="btn btn-ghost" type="button" onclick="AccessInvites.close()">Cancelar</button><button id="invite-send" class="btn btn-primary" type="submit" ${emailEnabled===true?'':'disabled'}>${icon('send')} Enviar convite</button></footer></form>`;
  dlg.showModal();dlg.querySelector('input').focus();
 }
 function close(){if(!saving)document.getElementById('invite-dialog')?.close();}
 async function send(){
  if(saving||!AccessControl.can('','admin'))return;
  const dlg=document.getElementById('invite-dialog'),form=dlg.querySelector('form');if(!form.reportValidity())return;
  const err=document.getElementById('invite-error');err.hidden=true;
  const permissions={};for(const [key]of AccessControl.modules)permissions[key]=dlg.querySelector(`input[name="invite-${key}"]:checked`)?.value||'none';
  if(!Object.values(permissions).some(v=>v!=='none')){err.textContent='Selecione ao menos uma \u00e1rea para leitura ou edi\u00e7\u00e3o.';err.hidden=false;return;}
  saving=true;dlg.querySelectorAll('input,button').forEach(el=>el.disabled=true);
  try{
   const result=await api({action:'send',id:requestId,nome:document.getElementById('invite-name').value.trim(),email:document.getElementById('invite-email').value.trim(),permissions});
   if(!result.sent)throw new Error('O envio n\u00e3o foi confirmado.');
   saving=false;close();tab='invites';search='';toast('Convite enviado ao e-mail informado.');await load();
  }catch(e){if(e.status===502)requestId=crypto.randomUUID();err.textContent=e.message||'Falha no envio. Confira a lista antes de reenviar.';err.hidden=false;}
  finally{saving=false;dlg.querySelectorAll('input,button').forEach(el=>el.disabled=false);if(emailEnabled!==true)document.getElementById('invite-send').disabled=true;}
 }
 async function revoke(id){
  if(!AccessControl.can('','admin')||!confirm('Revogar este convite? O link n\u00e3o liberar\u00e1 acesso.'))return;
  try{await api({action:'revoke',id});toast('Convite revogado.');await load();}catch(e){toast(e.message);}
 }
 function revokeUser(id){if(AccessControl.can('','admin')&&confirm('Revogar o acesso desta pessoa \u00e0 plataforma?'))revogarUser(id);}
 function resend(id){const i=invites.find(x=>x.id===id);if(i)open(null,i);}
 function clearArrival(){const u=new URL(location.href);u.searchParams.delete('access_invite');history.replaceState(null,'',u.pathname+u.search+u.hash);arrival=null;}
 async function acceptArrival(user){
  const id=new URL(location.href).searchParams.get('access_invite');if(!id)return true;
  if(!arrival)arrival=(async()=>{
   if(!uuid.test(id))throw new Error('Link de convite inv\u00e1lido.');
   const result=await api({action:'accept',id});
   if(!result.accepted)throw new Error('N\u00e3o foi poss\u00edvel aceitar o convite.');
   if(result.needs_password){document.getElementById('login-screen').style.display='flex';document.getElementById('app').style.display='none';lSwitch('newpwd');return false;}
   clearArrival();return true;
  })();
  try{return await arrival;}catch(e){arrival=null;document.getElementById('login-screen').style.display='flex';lSwitch('login');const el=document.getElementById('l-err');el.textContent=e.message;el.style.display='block';return false;}
 }
 root.AccessInvites={mount,load,render,open,close,send,revoke,resend,revokeUser,acceptArrival,clearArrival,invitationStatus,setTab(value){tab=value;search='';render();},search(value){search=value;render();}};
 if(typeof module!=='undefined')module.exports={invitationStatus};
})(typeof window==='undefined'?globalThis:window);
