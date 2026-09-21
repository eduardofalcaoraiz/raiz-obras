(function(root){
  'use strict';
  const OWNER='e56ab877-62a8-4f2c-9ef8-55ab93fd51b9',SIZE=30;
  let identity='',tab='tickets',page=0,pending=0,busy=false,detail=null,serial=0;
  const user=()=>typeof currentProfile==='undefined'?null:currentProfile;
  const owner=()=>user()?.id===OWNER&&user()?.aprovado&&user()?.role==='admin';
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money=v=>Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
  const date=v=>v?new Date(v).toLocaleString('pt-BR'):'-';
  const icon=n=>`<img src="/assets/icons/lucide/${n==='file-search'?'file-text':n}.svg" width="18" height="18" alt="">`;
  function sync(){if(identity!==(user()?.id||'')){identity=user()?.id||'';pending=0;tab='tickets';page=0;detail=null;serial++;document.getElementById('capex-review-dialog')?.close();}}
  function button(item){sync();return AccessControl.can('capex')?`<button class="btn btn-ghost btn-sm" title="Solicitar revis\u00e3o deste gasto" onclick="event.preventDefault();event.stopPropagation();CapexReviews.request(${Number(item.id)})">${icon('refresh-cw')} Pedir revis\u00e3o</button>`:'';}
  function layout(tickets){sync();return `<nav class="capex-review-tabs" aria-label="Registros pendentes"><button class="btn btn-ghost" data-review-tab="tickets" onclick="CapexReviews.switchTab('tickets')">Tickets</button><button class="btn btn-ghost" data-review-tab="pending" onclick="CapexReviews.switchTab('pending')">Revis\u00f5es de CAPEX <span data-review-count></span></button><button class="btn btn-ghost" data-review-tab="history" onclick="CapexReviews.switchTab('history')">Hist\u00f3rico de revis\u00f5es</button></nav><div id="capex-review-tickets">${tickets}</div><section id="capex-review-list" aria-live="polite" hidden></section>`;}
  function tabs(){document.querySelectorAll('[data-review-tab]').forEach(el=>{el.setAttribute('aria-current',String(el.dataset.reviewTab===tab));});document.querySelectorAll('[data-review-count]').forEach(el=>el.textContent=pending?`(${pending})`:'');const tickets=document.getElementById('capex-review-tickets'),list=document.getElementById('capex-review-list');if(tickets)tickets.hidden=tab!=='tickets';if(list)list.hidden=tab==='tickets';}
  async function count(){sync();if(!AccessControl.can('registros'))return;const who=identity;const {count:n,error}=await db.from('capex_reviews').select('id',{count:'exact',head:true}).eq('status','pending');if(who!==user()?.id)return;if(!error){pending=n||0;tabs();if(typeof updateNavBadge==='function')updateNavBadge();}}
  function mount(){tabs();count().catch(()=>{});if(tab!=='tickets')load();}
  function switchTab(next){if(!['tickets','pending','history'].includes(next))return;tab=next;page=0;tabs();if(tab!=='tickets')load();}
  function label(status){return {pending:'Aguardando julgamento',approved:'Retirado do CAPEX',rejected:'Mantido no CAPEX'}[status]||status;}
  function row(r){const s=r.request_snapshot||{};return `<article class="capex-review-row"><div><b>TR ${esc(s.ticket_raiz_instance_id||s.referencia||'-')} &middot; ${esc(s.unidade)} &middot; ${esc(s.ano)}</b><p>${esc(s.pedido)}</p><p class="capex-review-reason">${esc(r.reason)}</p><small>${esc(r.requester_name)} &middot; ${esc(date(r.requested_at))}</small>${r.status!=='pending'?`<p>${esc(label(r.status))} &middot; ${esc(date(r.decided_at))}<br>${esc(r.decision_reason)}</p>`:''}</div><div class="capex-review-row-actions"><strong>${money(s.orcamento)}</strong><button class="btn btn-ghost" onclick="CapexReviews.open(${Number(r.id)})">${icon('file-search')}${owner()&&r.status==='pending'?'Julgar revis\u00e3o':'Ver revis\u00e3o'}</button></div></article>`;}
  async function load(){
    sync();const host=document.getElementById('capex-review-list');if(!host||tab==='tickets'||!AccessControl.can('registros'))return;
    const token=++serial;host.innerHTML='<p class="capex-review-empty">Carregando revis\u00f5es...</p>';
    try{let q=db.from('capex_reviews').select('*',{count:'exact'}).order('requested_at',{ascending:false}).order('id',{ascending:false});q=tab==='pending'?q.eq('status','pending'):q.in('status',['approved','rejected']);const {data,error,count:total}=await q.range(page*SIZE,(page+1)*SIZE-1);if(token!==serial)return;if(error)throw error;
      host.innerHTML=(data?.length?data.map(row).join(''):`<p class="capex-review-empty">${tab==='pending'?'Nenhuma revis\u00e3o pendente.':'Nenhuma revis\u00e3o julgada.'}</p>`)+`<footer class="capex-review-pagination"><button class="btn btn-ghost" ${page===0?'disabled':''} onclick="CapexReviews.paginate(-1)" aria-label="P\u00e1gina anterior">${icon('chevron-left')}</button><span>P\u00e1gina ${page+1} &middot; ${total||0} revis\u00f5es</span><button class="btn btn-ghost" ${(page+1)*SIZE>=(total||0)?'disabled':''} onclick="CapexReviews.paginate(1)" aria-label="Pr\u00f3xima p\u00e1gina">${icon('chevron-right')}</button></footer>`;
    }catch(e){if(token===serial)host.innerHTML=`<p role="alert">N\u00e3o foi poss\u00edvel carregar as revis\u00f5es: ${esc(e.message)}</p><button class="btn btn-ghost" onclick="CapexReviews.load()">Tentar novamente</button>`;}
  }
  function paginate(delta){page=Math.max(0,page+delta);load();}
  function dialog(){let d=document.getElementById('capex-review-dialog');if(!d){d=document.createElement('dialog');d.id='capex-review-dialog';d.className='capex-review-dialog';d.addEventListener('cancel',e=>{if(busy)e.preventDefault();});document.body.append(d);}return d;}
  function show(title,body,footer){const d=dialog();d.innerHTML=`<header><h2>${title}</h2><button class="btn btn-ghost" title="Fechar" aria-label="Fechar" onclick="CapexReviews.close()">${icon('x')}</button></header><div class="capex-review-content">${body}<p id="capex-review-error" role="alert" hidden></p></div><footer>${footer}</footer>`;if(!d.open)d.showModal();d.querySelector('textarea')?.focus();}
  function close(){if(!busy){dialog().close();detail=null;}}
  function lock(value){busy=value;dialog().querySelectorAll('button,textarea,input').forEach(el=>el.disabled=value);dialog().setAttribute('aria-busy',String(value));}
  function error(e){const el=document.getElementById('capex-review-error');if(el){el.textContent=e?.message||'N\u00e3o foi poss\u00edvel concluir. Tente novamente.';el.hidden=false;}}
  function summary(s){return `<div class="capex-review-summary"><div><b>TR ${esc(s.ticket_raiz_instance_id||s.referencia||'-')}</b><span>${esc(s.unidade)} &middot; ${esc(s.ano)}</span></div><strong>${money(s.orcamento)}</strong></div><p>${esc(s.pedido)}</p>`;}
  function documents(s){const docs=typeof capexItemDocs==='function'?capexItemDocs(s):[];return docs.length?'<div class="capex-review-documents">'+docs.map((d,i)=>`<button class="btn btn-ghost" onclick="CapexReviews.document(${i})">${icon('file-text')} ${esc(d.name||'Documento '+(i+1))}</button>`).join('')+'</div>':'';}
  function documentFile(index){if(busy||!detail?.review)return;const docs=capexItemDocs(detail.shownItem||detail.current_item||detail.review.request_snapshot);if(docs[index]){dialog().close();viewFile(docs[index]);}}
  function request(id){sync();if(busy||!AccessControl.can('capex'))return;const item=capexItens.find(x=>Number(x.id)===id);if(!item){toast('Atualize os gastos para solicitar a revis\u00e3o.');return;}detail={itemId:id};show('Pedir revis\u00e3o do gasto',summary(item)+'<label for="capex-review-reason">Motivo da revis\u00e3o</label><textarea id="capex-review-reason" rows="5" minlength="10" maxlength="2000" required></textarea>',`<button class="btn btn-ghost" onclick="CapexReviews.close()">Cancelar</button><button class="btn btn-primary" onclick="CapexReviews.submit()">Enviar para revis\u00e3o</button>`);}
  async function submit(){
    if(busy||!detail?.itemId||!AccessControl.can('capex'))return;const reason=document.getElementById('capex-review-reason').value.trim();if(reason.length<10){error({message:'Descreva o motivo com pelo menos 10 caracteres.'});return;}
    const itemId=detail.itemId;lock(true);
    try{const {error:e}=await db.rpc('request_capex_review',{p_item_id:itemId,p_reason:reason});if(e)throw e;lock(false);close();toast('Revis\u00e3o solicitada. O gasto permanece no CAPEX at\u00e9 a decis\u00e3o.');await count();if(tab!=='tickets')await load();}catch(e){error(e);}finally{lock(false);}
  }
  async function open(id){
    sync();if(busy)return;const who=identity;show('Revis\u00e3o do gasto','<p>Carregando...</p>','');lock(true);
    try{const {data,error:e}=await db.rpc('get_capex_review',{p_review_id:id});if(who!==(user()?.id||'')){dialog().close();detail=null;return;}if(e)throw e;detail=data;const r=data.review,s=(r.status==='pending'?data.current_item:r.decision_snapshot)||r.request_snapshot,judge=owner()&&r.status==='pending';detail.shownItem=s;
      show('Revis\u00e3o do gasto',summary(s)+documents(s)+`<p><b>${esc(label(r.status))}</b></p><p class="capex-review-reason">${esc(r.reason)}</p><p>${esc(r.requester_name)} &lt;${esc(r.requester_email)}&gt;<br>${esc(date(r.requested_at))}</p>`+(JSON.stringify(s)!==JSON.stringify(r.request_snapshot)?`<p class="capex-review-warning">O gasto foi alterado desde a solicita\u00e7\u00e3o. Valor original: ${money(r.request_snapshot?.orcamento)}. Confira os dados atuais acima.</p>`:'')+(judge?'<label for="capex-review-reason">Justificativa da decis\u00e3o</label><textarea id="capex-review-reason" rows="4" minlength="3" maxlength="2000" required></textarea><label class="capex-review-confirm"><input type="checkbox" id="capex-review-confirm"> Confirmo a retirada deste gasto do CAPEX e dos saldos do ciclo.</label>':r.decision_reason?`<p><b>Decis\u00e3o em ${esc(date(r.decided_at))}</b><br>${esc(r.decision_reason)}</p>`:''),judge?'<button class="btn btn-ghost" onclick="CapexReviews.decide(false)">Manter no CAPEX</button><button class="btn btn-primary" onclick="CapexReviews.decide(true)">Aprovar retirada do CAPEX</button>':'<button class="btn btn-ghost" onclick="CapexReviews.close()">Fechar</button>');
    }catch(e){error(e);}finally{lock(false);}
  }
  async function decide(approve){
    if(busy||!owner()||!detail?.review||detail.review.status!=='pending')return;
    const reason=document.getElementById('capex-review-reason').value.trim();if(reason.length<3){error({message:'Informe a justificativa da decis\u00e3o.'});return;}
    if(approve&&!document.getElementById('capex-review-confirm').checked){error({message:'Confirme a retirada do gasto antes de aprovar.'});return;}
    const {review,version}=detail;lock(true);
    try{const {error:e}=await db.rpc('decide_capex_review',{p_review_id:review.id,p_approve:approve,p_reason:reason,p_version:version});if(e)throw e;
      if(approve){capexItens=capexItens.filter(x=>Number(x.id)!==Number(review.item_id));capexDataLoaded=false;capexZeevSolicitacoes=capexZeevSolicitacoes.map(x=>Number(x.capex_item_id)===Number(review.item_id)?{...x,status:'ignorado'}:x);}
      lock(false);close();toast(approve?'Gasto retirado do CAPEX. Hist\u00f3rico preservado.':'Revis\u00e3o encerrada. Gasto mantido no CAPEX.');await count();await load();
    }catch(e){error(e);}finally{lock(false);}
  }
  root.CapexReviews={owner,button,layout,mount,switchTab,load,paginate,request,submit,open,close,decide,document:documentFile,refreshCount:count,pendingCount:()=>{sync();return pending;}};
})(window);
