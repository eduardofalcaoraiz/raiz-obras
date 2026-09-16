(function (root) {
  'use strict';
  const modules = [
    ['escolas','Documentos das escolas'], ['capex','CAPEX de melhorias'],
    ['registros','Registros pendentes'], ['realestate_locacoes','Real Estate: im\u00f3veis e encargos'],
    ['realestate_sublocacoes','Real Estate: subloca\u00e7\u00f5es e uso de marca'],
    ['expansao','Expans\u00f5es de unidades'], ['nova','Novas unidades'],
    ['cobranca','Cobran\u00e7a'], ['forn','Fornecedores'], ['investidores','Investidores externos']
  ];
  const keys = new Set(modules.map(m => m[0]));
  const labels = { none:'Sem acesso', read:'Somente leitura', edit:'Leitura e edi\u00e7\u00e3o' };
  let active='escolas', profiles=new Map(), editing=null, saving=false, poll=null;
  const profile = () => typeof currentProfile==='undefined' ? null : currentProfile;
  const escape = s => String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function level(p,key) {
    if(!p?.aprovado || !keys.has(key)) return 'none';
    if(p.role==='admin') return 'edit';
    if(p.access_config===null || p.access_config===undefined) return p.role==='editor'?'edit':'read';
    const v=p.access_config[key];
    return ['none','read','edit'].includes(v)?v:'none';
  }
  function can(key,action='read',p=profile()) {
    if(action==='admin') return !!p?.aprovado&&p.role==='admin';
    if(action==='document' && p?.aprovado && p.role==='doc' && p.access_config==null && key==='escolas') return true;
    const v=level(p,key);
    return action==='read' ? v!=='none' : ['edit','document'].includes(action)&&v==='edit';
  }
  function areaModule(area) {return area==='cantinas'?'realestate_sublocacoes':area==='locacoes'?'realestate_locacoes':null;}
  function viewModule(view) {
    if(view==='obra') return typeof cur!=='undefined'&&cur?.esfera||'nova';
    if(['uni','docs','geral'].includes(view)) return 'escolas';
    return view;
  }
  function allowedView(view) {
    if(view==='admin') return can('', 'admin');
    if(view==='realestate') return can('realestate_locacoes')||can('realestate_sublocacoes');
    return can(viewModule(view));
  }
  function canEdit(key=active) {return key==='admin'?can('','admin'):can(key,'edit');}
  function enter(view) {
    if(!allowedView(view)) {if(typeof toast==='function')toast('Seu acesso n\u00e3o permite abrir esta \u00e1rea.');return false;}
    if(view==='realestate'&&typeof realEstateArea!=='undefined'&&!can(areaModule(realEstateArea))&&areaModule(realEstateArea))realEstateArea=can('realestate_locacoes')?'locacoes':'cantinas';
    active=view==='realestate'?(areaModule(typeof realEstateArea==='undefined'?'locacoes':realEstateArea)||'realestate_locacoes'):viewModule(view);
    syncUi(); return true;
  }
  function enterArea(area) {
    const key=areaModule(area);
    if(key&&!can(key)) {toast('Seu acesso n\u00e3o permite abrir esta \u00e1rea.');return false;}
    if(!key&&!allowedView('realestate'))return false;
    active=key||'realestate_locacoes'; return true;
  }
  function syncUi() {
    if(!root.document)return;
    document.querySelectorAll('[data-nav]').forEach(n=>{n.hidden=!allowedView(n.dataset.nav);});
    [['locacoes','realestate_locacoes'],['cantinas','realestate_sublocacoes']].forEach(([area,key])=>{
      const el=document.getElementById('realestate-tab-'+area);if(el)el.hidden=!can(key);
    });
    document.body.classList.toggle('access-readonly',!canEdit());
    decorate();
  }
  function start() {
    syncUi();
    if(typeof realEstateArea!=='undefined'&&!can('realestate_locacoes')&&can('realestate_sublocacoes'))realEstateArea='cantinas';
    clearInterval(poll);poll=setInterval(checkCurrent,60000);
  }
  function landing() {
    const preferred=['escolas','capex','realestate','registros','expansao','nova','cobranca','forn','investidores','admin'];
    const view=preferred.find(allowedView);
    if(view){go(view);return;}
    document.querySelectorAll('.view').forEach(n=>n.classList.remove('active'));
    let empty=document.getElementById('access-empty');
    if(!empty){empty=document.createElement('section');empty.id='access-empty';empty.className='view';empty.innerHTML='<div class="phead"><h1>Acesso aguardando defini\u00e7\u00e3o</h1></div><p class="empty">Nenhuma \u00e1rea foi liberada para este usu\u00e1rio.</p>';document.querySelector('.main').append(empty);}
    empty.classList.add('active');
  }
  async function checkCurrent() {
    if(!profile()||document.visibilityState==='hidden')return;
    const {data,error}=await db.from('user_profiles').select('id,role,aprovado,access_revision').eq('id',profile().id).single();
    if(error)return;
    if(!data?.aprovado||data.role!==profile().role||Number(data.access_revision||0)!==Number(profile().access_revision||0))root.location.reload();
  }
  function summary(u) {
    if(u.role==='admin') return 'Administrador: acesso completo';
    if(u.access_config==null)return 'Perfil atual (sem personaliza\u00e7\u00e3o)';
    const values=modules.map(([key])=>u.access_config[key]);
    return `${values.filter(v=>v==='read').length} leitura \u00b7 ${values.filter(v=>v==='edit').length} edi\u00e7\u00e3o`;
  }
  function renderUsers(users) {
    profiles=new Map(users.map(u=>[u.id,u]));
    const roles=[['leitor','Leitor'],['doc','Colaborador de documentos'],['editor','Editor'],['admin','Administrador']];
    return '<table><thead><tr><th>Usu\u00e1rio</th><th>Perfil</th><th>Permiss\u00f5es</th><th>Status</th><th>A\u00e7\u00f5es</th></tr></thead><tbody>'+users.map(u=>{
      const self=u.id===profile()?.id, id=escape(u.id);
      const role=self?'<span class="badge b-neutral">Administrador</span>':`<select class="fi" aria-label="Perfil de ${escape(u.nome||u.email)}" onchange="setUserRole('${id}',this.value)">${roles.map(([k,l])=>`<option value="${k}" ${u.role===k?'selected':''}>${l}</option>`).join('')}</select>`;
      return `<tr><td><b>${escape(u.nome||'Sem nome')}</b><br><span class="access-email">${escape(u.email)}</span></td><td>${role}</td><td><span class="access-summary">${escape(summary(u))}</span>${!self&&u.role!=='admin'?`<button class="btn btn-sm btn-ghost" onclick="AccessControl.open('${id}')"><img src="/assets/icons/lucide/settings-2.svg" alt="" width="15" height="15"> Permiss\u00f5es</button>`:''}</td><td><span class="badge ${u.aprovado?'b-ok':'b-warn'}">${u.aprovado?'Aprovado':'Pendente'}</span></td><td>${!u.aprovado?`<button class="btn btn-sm btn-primary" onclick="aprovarUser('${id}')">Aprovar</button>`:''}${!self&&u.aprovado?`<button class="btn btn-sm btn-ghost" onclick="revogarUser('${id}')">Revogar</button>`:''}</td></tr>`;
    }).join('')+'</tbody></table>';
  }
  function open(id) {
    if(!can('','admin'))return;
    const u=profiles.get(id);if(!u||u.id===profile()?.id||u.role==='admin')return;
    editing={...u};saving=false;
    let dlg=document.getElementById('access-dialog');
    if(!dlg){dlg=document.createElement('dialog');dlg.id='access-dialog';dlg.className='access-dialog';document.body.append(dlg);dlg.addEventListener('cancel',e=>{if(saving)e.preventDefault();});}
    const proposed={...u,aprovado:true};
    dlg.innerHTML=`<form onsubmit="event.preventDefault();AccessControl.save()"><header><div><h2>Permiss\u00f5es individuais</h2><b>${escape(u.nome)}</b><div class="access-email">${escape(u.email)}</div></div><button type="button" class="access-close" aria-label="Fechar" title="Fechar" onclick="AccessControl.close()"><img src="/assets/icons/lucide/x.svg" alt="" width="20" height="20"></button></header><div class="access-matrix"><div class="access-matrix-head"><b>\u00c1rea</b><span>Permiss\u00e3o</span></div>${modules.map(([key,label])=>`<fieldset><legend>${escape(label)}</legend><div class="access-options">${Object.entries(labels).map(([v,l])=>`<label><input type="radio" name="access-${key}" value="${v}" ${level(proposed,key)===v?'checked':''}><span>${l}</span></label>`).join('')}</div></fieldset>`).join('')}</div><div id="access-error" class="access-error" role="alert" hidden></div><footer><span>${u.aprovado?'Usu\u00e1rio aprovado':'Usu\u00e1rio pendente de aprova\u00e7\u00e3o'}</span><button type="button" class="btn btn-ghost" onclick="AccessControl.close()">Cancelar</button><button type="submit" class="btn btn-primary" id="access-save"><img src="/assets/icons/lucide/save.svg" alt="" width="16" height="16"> Salvar permiss\u00f5es</button></footer></form>`;
    dlg.showModal();dlg.querySelector('input')?.focus();
  }
  function close() {if(!saving)document.getElementById('access-dialog')?.close();}
  async function save() {
    if(!editing||saving||!can('','admin'))return;
    const config={};for(const [key]of modules){config[key]=document.querySelector(`input[name="access-${key}"]:checked`)?.value||'none';}
    saving=true;const button=document.getElementById('access-save'),err=document.getElementById('access-error');button.disabled=true;err.hidden=true;
    try{
      const {error}=await db.rpc('set_user_access',{p_user_id:editing.id,p_config:config,p_revision:Number(editing.access_revision||0)});
      if(error)throw error;
      saving=false;close();toast('Permiss\u00f5es salvas. A aprova\u00e7\u00e3o do usu\u00e1rio foi mantida.');await renderAdmin();
    }catch(e){err.textContent=e?.message||'N\u00e3o foi poss\u00edvel salvar as permiss\u00f5es.';err.hidden=false;}
    finally{saving=false;button.disabled=false;}
  }
  function reset() {clearInterval(poll);poll=null;profiles.clear();editing=null;}
  const guarded = new Map();
  function allowedCommand(name) {const rule=guarded.get(name);return !rule||can(rule[0]||active,rule[1]||'edit');}
  function decorate() {
    document.querySelectorAll('button[onclick],input[onchange],select[onchange]').forEach(el=>{
      const match=(el.getAttribute('onclick')||el.getAttribute('onchange')||'').match(/^\s*([a-zA-Z0-9_]+)\(/);
      if(!match||!guarded.has(match[1]))return;
      const denied=!allowedCommand(match[1]);
      el.disabled=denied;el.setAttribute('aria-disabled',String(denied));
      if(denied)el.title='Sem permiss\u00e3o de edi\u00e7\u00e3o';
    });
  }
  function installGuards() {
    const groups=[
      ['realestate_locacoes','edit','openRealEstateModal saveRealEstateImovel deleteRealEstateImovel realEstatePersistImovel'],
      ['realestate_sublocacoes','edit','openRealEstateSublocModal saveRealEstateSublocacao deleteRealEstateSublocacao'],
      ['capex','edit','openCapexModal saveCapexItem saveCapexItemLocked deleteCapexItem openCapexSaldoModal saveCapexSaldo'],
      ['registros','edit','openCapexZeevApproval ignoreCapexZeev restoreCapexZeev openCapexZeevDestination openCapexZeevRealEstateApproval saveCapexZeevRealEstateApproval openCapexZeevObraApproval saveCapexZeevObraApproval'],
      ['escolas','edit','openUniModal saveUni deleteEscola deleteDoc'],
      ['escolas','document','anexarCat anexarIA openDocModal confirmDocs'],
      ['investidores','edit','openInvModal saveInvestidor deleteInvestidor'],
      ['','admin','syncZeevCapexNow refreshAdminZeevAudit setUserRole aprovarUser revogarUser openCatModal saveCatModal deleteCat'],
      ['','edit','openObraModal saveObra deleteObra setObraStatus openPagModal savePag deletePagment marcarPago marcarPagoLista anexarNF anexarComp openContrModal saveContr deleteContr openAporteModal saveAporte deleteAporte openAditivoModal saveAditivo deleteAditivo openAditContrModal saveAditContr deleteAditContr openImport confirmImport openCsvImport confirmCsvImport editarTetoEscola']
    ];
    for(const [key,action,names]of groups)for(const name of names.split(' ')){
      const fn=root[name];if(typeof fn!=='function'||guarded.has(name))continue;
      guarded.set(name,[key,action]);
      root[name]=function(...args){if(!allowedCommand(name)){toast('Sem permiss\u00e3o para esta opera\u00e7\u00e3o.');return false;}return fn.apply(this,args);};
    }
    let frame=false;new MutationObserver(()=>{if(frame)return;frame=true;requestAnimationFrame(()=>{frame=false;decorate();});}).observe(document.body,{childList:true,subtree:true});
  }
  root.AccessControl={modules,level,can,canEdit,enter,enterArea,allowedView,areaModule,start,landing,syncUi,renderUsers,open,close,save,summary,reset,installGuards};
  if(typeof module!=='undefined')module.exports=root.AccessControl;
})(typeof window!=='undefined'?window:globalThis);
