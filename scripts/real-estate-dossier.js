(function(root){
  'use strict';
  const norm=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const safe=v=>{try{const u=new URL(v);return u.protocol==='https:'?u.href:'';}catch{return '';}};
  const link=(u,t)=>safe(u)?`<a href="${esc(safe(u))}" target="_blank" rel="noopener noreferrer">${esc(t)}</a>`:esc(t);
  const money=n=>n==null||!Number.isFinite(Number(n))?'Não informado':Number(n).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
  const day=d=>/^\d{4}-\d{2}-\d{2}$/.test(d||'')?d.split('-').reverse().join('/'):d||'Não informado';
  const caches=new WeakMap();
  const PAGE_SIZE=30;
  const icon=name=>`<img src="assets/icons/lucide/${name}.svg" width="16" height="16" alt="">`;
  const kinds=[['','Todos'],['registered','Registrados'],['review','Conciliação / rateio'],['provisional','Previsões'],['cancelled','Cancelados']];
  const tabs=[['financeiro','Financeiro'],['tickets','TRs'],['documentos','Documentos'],['contrato','Contrato e cadastro'],['historico','Histórico das fontes']];
  const expenseTypes=[['all','Visão geral'],['rent','Aluguel'],['iptu','Cotas de IPTU'],['condo','Condomínio'],['other','Outros encargos'],['unclassified','A classificar']];
  const expenseLabel=key=>expenseTypes.find(([k])=>k===key)?.[1]||'A classificar';
  function expenseType(value){const t=norm(value);if(t==='aluguel')return 'rent';if(t==='iptu'||t==='parcelamento iptu')return 'iptu';if(t==='condominio')return 'condo';return !t||['financeiro','atipico'].includes(t)?'unclassified':'other';}
  const period=h=>String(h.periodo||'');
  const sourceKey=h=>[h.imovel_id,h.sublocacao_id,h.tipo,h.periodo,h.inscricao,h.contraparte,h.valor,h.referencia].map(norm).join('|');
  function groupHistory(history,tickets,propertyId){
    const ticketMap=new Map(tickets.map(t=>[String(t.ticket_raiz),t])),groups=new Map();
    for(const h of history){
      if(!h.ticket_raiz&&h.valor==null&&/^(n a|na)$/.test(norm(h.referencia)))continue;
      if(!h.ticket_raiz&&!h.referencia&&Number(h.valor)===0&&!h.data_pagamento)continue;
      const tr=String(h.ticket_raiz||''),t=ticketMap.get(tr);
      if(t&&!t.financeiro)continue;
      if(!t&&h.tipo==='Atipico'&&h.valor==null)continue;
      const key=tr?'tr:'+tr:'source:'+sourceKey(h);
      if(!groups.has(key))groups.set(key,{key,ticket:tr,meta:t,sources:[],value:null,provisional:!tr,conflict:false,shared:false});
      groups.get(key).sources.push(h);
    }
    for(const t of tickets){if(!t.financeiro||groups.has('tr:'+t.ticket_raiz))continue;groups.set('tr:'+t.ticket_raiz,{key:'tr:'+t.ticket_raiz,ticket:t.ticket_raiz,meta:t,sources:[],value:null,provisional:false,conflict:false,shared:false});}
    for(const g of groups.values()){
      const vals=[...new Set(g.sources.filter(h=>h.valor!=null).map(h=>Math.round(Number(h.valor)*100)))];
      const t=g.meta,periods=[...new Set(g.sources.map(period))];
      g.periods=periods;g.period=t?.competencia||periods.join(', ')||'Sem competência';
      g.shared=!!t&&((t.imovel_ids||[]).length>1||(t.sublocacao_ids||[]).length>0);
      g.conflict=vals.length>1||!!(t?.valor_total!=null&&vals.length===1&&Math.abs(Math.round(t.valor_total*100)-vals[0])>1);
      g.value=t?.valor_total??(vals.length===1?vals[0]/100:null);
      g.review=!!t?.vinculo_revisar||g.shared||g.conflict||periods.length>1;
      g.cancelled=/cancel|reprov|rejeit/.test(norm(t?.status));
      g.supplier=t?.fornecedor||g.sources[0]?.contraparte||'Não informado';
      g.type=[...new Set(g.sources.map(h=>h.tipo))].join(' / ')||'Financeiro';
      g.description=t?.descricao||g.sources[0]?.observacoes||'';
      g.sortDate=periods.slice().sort().reverse()[0]||t?.competencia||'';
      g.countable=!g.provisional&&!g.review&&!g.cancelled&&g.value!=null&&(!t||t.imovel_ids?.includes(propertyId));
    }
    return [...groups.values()].sort((a,b)=>b.sortDate.localeCompare(a.sortDate)||Number(b.ticket)-Number(a.ticket));
  }
  function totals(groups){return {count:groups.length,total:groups.filter(g=>g.countable).reduce((s,g)=>s+Math.round(g.value*100),0)/100,review:groups.filter(g=>g.review).length,provisional:groups.filter(g=>g.provisional).length};}
  function expenseParts(g){
    const components=(g.meta?.componentes||[]).filter(c=>c.valor!=null&&Number.isFinite(Number(c.valor))&&Number(c.valor)!==0);
    const sourceTypes=[...new Set(g.sources.map(h=>expenseType(h.tipo)).filter(t=>t!=='unclassified'))];
    const grouped=new Map();
    for(const c of components){const type=expenseType(c.tipo);grouped.set(type,(grouped.get(type)||0)+Math.round(Number(c.valor)*100));}
    // Split only explicit components that reconcile to the parent TR in cents.
    const complete=components.length&&g.value!=null&&Number.isFinite(Number(g.value))&&[...grouped.values()].reduce((a,b)=>a+b,0)===Math.round(Number(g.value)*100)&&sourceTypes.every(t=>grouped.has(t));
    if(complete)return [...grouped].map(([expense,cents])=>({...g,key:g.key+':'+expense,parentKey:g.key,parentValue:g.value,value:cents/100,expense,type:expenseLabel(expense),componentValue:true}));
    const expense=!components.length&&sourceTypes.length===1?sourceTypes[0]:'unclassified';
    return [{...g,key:g.key+':'+expense,parentKey:g.key,parentValue:g.value,expense,type:expense==='unclassified'?g.type:expenseLabel(expense),allocationNote:expense==='unclassified'?(components.length?'Composição sem separação confirmada; total do TR preservado.':'Natureza não identificada de forma unívoca nas fontes.'):'',componentValue:false}];
  }
  function expenseGroups(groups,expense){return expense==='all'?groups:groups.flatMap(expenseParts).filter(g=>g.expense===expense);}
  function expenseNav(groups,s){return `<div class="tabs re-expense-tabs" role="tablist" aria-label="Tipo de despesa do imóvel">${expenseTypes.map(([key,label])=>{const summary=totals(expenseGroups(groups,key));return `<button class="tabbtn ${s.expense===key?'active':''}" role="tab" id="re-expense-${esc(s.id)}-${key}" aria-controls="re-expense-panel-${esc(s.id)}" aria-selected="${s.expense===key}" tabindex="${s.expense===key?0:-1}" onclick="RealEstateDossier.expense(this,'${key}')" onkeydown="RealEstateDossier.key(event)"><span>${label}</span><strong>${money(summary.total)}</strong><small>${summary.count} lançamento(s)</small></button>`;}).join('')}</div>`;}
  function iptuInfo(g){const rows=g.sources.filter(h=>expenseType(h.tipo)==='iptu');if(g.expense!=='iptu'&&!rows.length)return '';const registrations=[...new Set(rows.map(h=>h.inscricao).filter(Boolean))],quotas=[...new Set(rows.map(h=>h.periodo).filter(Boolean))];return `<span class="re-payment-tax">${esc(quotas.length?quotas.join(' · '):'Cota não discriminada')}${registrations.length?'<br>Inscrição '+esc(registrations.join(' · ')):''}</span>`;}
  function componentsHtml(t){const rows=(t?.componentes||[]).filter(c=>c.valor!=null&&Number(c.valor)!==0);return rows.length?`<div class="re-dossier-components"><b>Componentes informados no TR</b>${rows.map(c=>`<div><span>${esc(c.tipo)}</span><strong>${money(c.valor)}</strong></div>`).join('')}</div>`:'';}
  const category=g=>g.cancelled?'cancelled':g.review?'review':g.provisional?'provisional':'registered';
  const stateLabel=g=>g.cancelled?'Cancelado / reprovado':g.shared?'Rateio a confirmar':g.conflict?'Valores divergentes':g.review?'Vínculo / período a revisar':g.provisional?'Previsão na fonte':'Registrado';
  const monthLabel=m=>/^\d{4}-\d{2}$/.test(m)?['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'][Number(m.slice(5))-1]+'/'+m.slice(0,4):m;
  const months=g=>{const competence=String(g.meta?.competencia||'').match(/^\d{4}-\d{2}/)?.[0];return competence?[competence]:[...new Set(g.periods.filter(Boolean).map(p=>String(p).match(/^\d{4}-\d{2}/)?.[0]).filter(Boolean))];};
  function selectGroups(groups,s){return groups.filter(g=>(!s.year||g.sources.some(h=>String(h.ano)===s.year)||g.meta?.competencia?.startsWith(s.year))&&(!s.type||g.sources.some(h=>h.tipo===s.type))&&(!s.month||(s.month==='none'?months(g).length===0:months(g).includes(s.month)))&&(!s.supplier||g.supplier===s.supplier)&&(!s.query||norm([g.ticket,g.supplier,g.description,g.type,g.period].join(' ')).includes(norm(s.query)))&&(!s.state||category(g)===s.state));}
  function metricsHtml(groups,expense='all'){const s=totals(groups),label=expense==='all'?'Total nominal dos TRs':'Subtotal nominal · '+expenseLabel(expense);return `<div class="record-totals"><span>${esc(label)}: <strong>${money(s.total)}</strong></span><span>Lançamentos somados: ${s.count}</span><span>A conciliar: ${s.review}</span><span>Previsões: ${s.provisional}</span></div><p class="re-dossier-caption">Total nominal não comprova pagamento. Sem previsões, cancelados, divergências ou rateios pendentes na soma.</p>`;}
  function attachmentsHtml(rows){return rows.length?`<div class="re-payment-files">${rows.map(d=>`<div>${icon('file-text')}${link(d.url,d.nome||'Anexo do TR')}</div>`).join('')}</div>`:'<p class="realestate-muted">Nenhum anexo localizado neste TR.</p>';}
  function docsHtml(rows){return rows.map(d=>`<article class="re-evidence-doc re-file-row"><span class="re-file-icon">${icon('file-text')}</span><div><b>${link(d.url,d.nome||'Documento')}</b><small>${esc(d.tipo)}${d.contexto?' · '+esc(d.contexto):''}${d.vinculo_revisar?' · Vínculo a revisar':''}</small>${d.observacoes?`<details><summary>Observações da fonte</summary><p class="re-evidence-notes">${esc(d.observacoes)}</p></details>`:''}${safe(d.pasta_url)?link(d.pasta_url,'Pasta de origem'):''}</div>${safe(d.url)?`<a class="btn btn-ghost btn-sm re-file-open" href="${esc(safe(d.url))}" target="_blank" rel="noopener noreferrer" title="Abrir documento" aria-label="Abrir documento: ${esc(d.nome||'Documento')}">${icon('arrow-up-right')}</a>`:''}</article>`).join('')||'<p class="re-dossier-empty">Nenhum documento encontrado.</p>';}
  function paymentRow(g){const t=g.meta||{},files=t.anexos||[],kind=category(g);return `<article class="card pag-row re-payment-row ${kind}" data-payment-key="${esc(g.key)}">
    <details class="re-payment-details"><summary class="flow-row pag-card-grid re-payment-summary">
      <span class="re-payment-identity"><strong>${esc(g.supplier)}</strong><span class="re-payment-tags"><span class="re-payment-ticket">${g.ticket?'TR '+esc(g.ticket):'Sem TR'}</span><span>${esc(g.type)}</span></span><span class="re-payment-period">${esc(monthLabel(g.period))}</span>${iptuInfo(g)}</span>
      <span class="re-payment-reference"><span class="re-payment-description">${esc(g.description||g.type+' · '+g.period)}</span><span class="re-payment-stage">${esc(t.etapa||t.status||'Referência da planilha')}</span></span>
      <span class="re-payment-amount"><span class="re-dossier-state ${kind}">${esc(stateLabel(g))}</span><strong>${money(g.value)}</strong>${g.componentValue?`<small>Componente: ${esc(expenseLabel(g.expense))}</small>`:''}<small>${g.shared?(g.componentValue?'Componente do TR; rateio a confirmar':'Total do TR, não rateado'):t.vencimento?'Vencimento '+esc(day(t.vencimento)):'Vencimento não informado'}</small>${g.allocationNote?'<small class="re-dossier-warning">Separação a conferir</small>':''}</span>
      <span class="re-payment-chevron">${icon('chevron-down')}</span>
    </summary><div class="re-payment-detail">${g.componentValue?`<p class="re-payment-allocation">${esc(expenseLabel(g.expense))}: <strong>${money(g.value)}</strong> · Total original do TR: <strong>${money(g.parentValue)}</strong></p>`:''}${g.allocationNote?`<p class="re-dossier-warning">${esc(g.allocationNote)}</p>`:''}<h3>Referência / descrição</h3><p>${esc(g.description||'Não informada')}</p>${t.observacoes?`<p>${esc(t.observacoes)}</p>`:''}
      <dl class="re-payment-facts"><div><dt>Competência / período</dt><dd>${esc(g.period)}</dd></div><div><dt>Andamento no Zeev</dt><dd>${esc(t.status||'Não consultado')}${t.etapa?' · '+esc(t.etapa):''}</dd></div><div><dt>Vencimento</dt><dd>${esc(day(t.vencimento))}</dd></div>${g.countable===undefined?'':`<div><dt>Composição do total</dt><dd>${g.countable?'Incluído no total nominal':esc(stateLabel(g))+'; não somado'}</dd></div>`}</dl>
      ${componentsHtml(t)}<div class="re-payment-evidence"><section><h3>Referências (${g.sources.length})</h3>${g.sources.map(h=>`<div class="re-dossier-source">${link(h.fonte_url,h.fonte_nome||'Planilha de origem')}<small>${esc(h.periodo)} · ${esc(h.tipo)} · ${money(h.valor)}</small><small>${esc(h.status_fonte)}${h.inscricao?' · Inscrição '+esc(h.inscricao):''}</small></div>`).join('')||'<p class="realestate-muted">Sem referência de planilha vinculada.</p>'}</section><section data-attachments><h3 tabindex="-1">Arquivos do TR (${files.length})</h3>${attachmentsHtml(files)}</section></div></div></details>
    <footer class="re-payment-actions">${safe(t.ticket_url)?`<a class="btn btn-ghost btn-sm" href="${esc(safe(t.ticket_url))}" target="_blank" rel="noopener noreferrer">${icon('arrow-up-right')} Ver TR</a>`:''}<button class="btn btn-ghost btn-sm" onclick="RealEstateDossier.expand(this,'references')">${icon('list')} Fontes (${g.sources.length})</button><button class="btn btn-ghost btn-sm" onclick="RealEstateDossier.expand(this,'attachments')">${icon('folder-open')} Arquivos (${files.length})</button></footer>
  </article>`;}
  function financeHtml(groups,visible=groups){return metricsHtml(groups)+(visible.length?`<div class="re-payment-list">${visible.map(paymentRow).join('')}</div>`:'<p class="re-dossier-empty">Nenhum lançamento neste recorte.</p>');}
  function ticketRows(rows){return rows.length?`<div class="re-payment-list">${rows.map(t=>paymentRow({key:'ticket:'+t.ticket_raiz,ticket:t.ticket_raiz,meta:t,sources:[],period:t.competencia||'Sem competência',periods:[],type:t.financeiro?'Financeiro':'Contratual / outro fluxo',supplier:t.fornecedor||'Não informado',description:t.descricao,value:t.valor_total,review:!!t.vinculo_revisar,cancelled:/cancel|reprov|rejeit/.test(norm(t.status))})).join('')}</div>`:'<p class="re-dossier-empty">Nenhum TR consultado neste recorte.</p>';}
  function documents(historyDocs,tickets){const map=new Map();for(const d of historyDocs){const k=d.url?.match(/\/d\/([^/?]+)/)?.[1]||d.url;if(k&&!map.has(k))map.set(k,{...d,tickets:[]});}
    for(const t of tickets)for(const d of t.anexos||[]){const k=d.url;if(!k)continue;if(!map.has(k))map.set(k,{nome:d.nome,tipo:d.tipo||'Anexo do TR',url:k,contexto:'TR '+t.ticket_raiz,observacoes:'Anexo localizado no Zeev; conteúdo e pagamento não presumidos.',tickets:[t.ticket_raiz],vinculo_revisar:t.vinculo_revisar});else map.get(k).tickets.push(t.ticket_raiz);}
    return [...map.values()].sort((a,b)=>String(a.tipo).localeCompare(String(b.tipo))||String(a.nome).localeCompare(String(b.nome)));}
  function section(id){return `<section class="re-dossier" data-property="${esc(id)}"><div class="tabs re-dossier-tabs" role="tablist" aria-label="Informações do imóvel">${tabs.map(([k,v],n)=>`<button class="tabbtn ${n===0?'active':''}" type="button" role="tab" id="re-tab-${esc(id)}-${k}" aria-controls="re-panel-${esc(id)}-${k}" aria-selected="${n===0}" tabindex="${n===0?0:-1}" data-tab="${k}" onclick="RealEstateDossier.tab(this,'${k}')" onkeydown="RealEstateDossier.key(event)">${v}</button>`).join('')}</div><div class="re-dossier-content" aria-live="polite"><p>Carregando informações do imóvel...</p></div></section>`;}
  async function all(make){let rows=[];for(let offset=0;;offset+=250){const r=await make().range(offset,offset+249);if(r.error)throw r.error;rows.push(...(r.data||[]));if((r.data||[]).length<250)return rows;}}
  async function open(card,id,force=false){if(card.tagName==='DETAILS'&&!card.open)return;const el=card.querySelector('.re-dossier');if(!el)return;let state=caches.get(el);if(state?.loading)return;if(state&&!force){draw(el);return;}
    state={id,loading:true,tab:state?.tab||'financeiro',expense:state?.expense||'all',year:state?.year??'2026',type:state?.type||'',docKind:state?.docKind||'',query:state?.query||'',month:state?.month||'',supplier:state?.supplier||'',state:state?.state||'',page:0,hist:[],tickets:[],docs:[]};caches.set(el,state);
    try{state.hist=await all(()=>db.from('real_estate_lancamentos').select('*').eq('imovel_id',id).order('id'));state.docs=await all(()=>db.from('real_estate_documentos').select('*').contains('imovel_ids',[id]).order('id'));state.tickets=await all(()=>db.from('real_estate_tickets').select('*').contains('imovel_ids',[id]).order('ticket_raiz'));
      state.years=[...new Set([...state.hist.map(h=>String(h.ano)),...state.tickets.map(t=>String(t.competencia||'').match(/^\d{4}/)?.[0])].filter(Boolean))].sort().reverse();if(state.year&&!state.years.includes(state.year))state.year=state.years[0]||'';state.loading=false;if(el.isConnected)draw(el);
    }catch(e){state.loading=false;state.error=e.message;if(el.isConnected){const content=el.querySelector('.re-dossier-content');content.textContent='Não foi possível carregar o dossiê: '+e.message;const b=document.createElement('button');b.className='btn btn-ghost btn-sm';b.textContent='Tentar novamente';b.onclick=()=>open(card,id,true);content.append(b);}}
  }
  const option=(v,label,selected)=>`<option value="${esc(v)}" ${v===selected?'selected':''}>${esc(label)}</option>`;
  function documentKind(d){const classify=v=>/comprovante|recibo/.test(v)?'proof':/contrat|aditivo|distrato|mandato/.test(v)?'contract':/boleto|fatura|nota fiscal/.test(v)?'charge':'';return classify(norm(d.tipo))||classify(norm(d.nome))||'other';}
  function toolbar(s,groups){
    const docs=s.tab==='documentos',hist=s.tab==='historico',finance=s.tab==='financeiro';
    const ym=[...new Set(groups.flatMap(months))].filter(m=>!s.year||m.startsWith(s.year)).sort().reverse(),suppliers=[...new Set(groups.map(g=>g.supplier))].sort();
    const select=(label,key,options)=>`<label class="${key==='supplier'?'re-filter-supplier':''}">${label}<select class="fi" data-filter="${key}" onchange="RealEstateDossier.filter(this,'${key}',this.value)">${options}</select></label>`;
    let fields=`<label>Buscar<input class="fi" placeholder="${docs?'Nome ou tipo de documento':'TR, fornecedor ou descrição'}" data-focus="search" value="${esc(s.query)}" oninput="RealEstateDossier.filter(this,'query',this.value)"></label>`;
    if(docs)fields+=select('Grupo documental','docKind',[['','Todos'],['contract','Contratos e aditivos'],['charge','Boletos e notas'],['proof','Comprovantes e recibos'],['other','Outros documentos']].map(([v,l])=>option(v,l,s.docKind)).join(''));
    if(!docs)fields+=select('Ano','year',option('','Todos',s.year)+s.years.map(y=>option(y,y,s.year)).join(''));
    if(finance)fields+=select('Mês / ano','month',option('','Todos',s.month)+ym.map(m=>option(m,monthLabel(m),s.month)).join('')+option('none','Sem competência',s.month));
    if(hist)fields+=select('Natureza','type',option('','Todas',s.type)+[...new Set(s.hist.map(h=>h.tipo))].sort().map(t=>option(t,t,s.type)).join(''));
    if(finance)fields+=select('Fornecedor','supplier',option('','Todos',s.supplier)+suppliers.map(v=>option(v,v,s.supplier)).join(''));
    if(s.query||(docs&&s.docKind)||(!docs&&(s.type||s.supplier||s.month||s.state)))fields+='<button class="btn btn-ghost btn-sm re-filter-clear" title="Limpar filtros" aria-label="Limpar filtros" onclick="RealEstateDossier.clear(this)">'+icon('x')+'</button>';
    return `<div class="re-dossier-toolbar">${fields}</div>`;
  }
  function paginate(rows,s){const total=rows.length,pages=Math.max(1,Math.ceil(total/PAGE_SIZE));s.page=Math.max(0,Math.min(s.page,pages-1));const start=s.page*PAGE_SIZE;return {rows:rows.slice(start,start+PAGE_SIZE),html:`<div class="re-dossier-pager"><span>${total?`${start+1}–${Math.min(total,start+PAGE_SIZE)} de ${total}`:'0'} registro(s)</span>${pages>1?`<div><button class="btn btn-ghost btn-sm" title="Página anterior" aria-label="Página anterior" ${s.page===0?'disabled':''} onclick="RealEstateDossier.page(this,${s.page-1})">${icon('chevron-left')}</button><span>${s.page+1} / ${pages}</span><button class="btn btn-ghost btn-sm" title="Próxima página" aria-label="Próxima página" ${s.page===pages-1?'disabled':''} onclick="RealEstateDossier.page(this,${s.page+1})">${icon('chevron-right')}</button></div>`:''}</div>`};}
  function draw(el){const s=caches.get(el);if(!s||s.loading||!el.isConnected)return;
    const contract=el.closest('[data-dossier-host],.realestate-card').querySelector('.re-dossier-contract');if(contract)contract.hidden=s.tab!=='contrato';
    el.querySelectorAll('.re-dossier-tabs>[role=tab]').forEach(b=>{b.setAttribute('aria-selected',String(b.dataset.tab===s.tab));b.classList.toggle('active',b.dataset.tab===s.tab);b.tabIndex=b.dataset.tab===s.tab?0:-1;});
    const target=el.querySelector('.re-dossier-content');target.hidden=s.tab==='contrato';if(s.tab==='contrato'){target.innerHTML='';return;}
    let rows=s.hist.filter(h=>(!s.year||String(h.ano)===s.year)&&(!s.type||h.tipo===s.type));
    const q=norm(s.query),trs=new Set(s.hist.filter(h=>!s.year||String(h.ano)===s.year).map(h=>String(h.ticket_raiz)));
    const tickets=s.tickets.filter(t=>!s.year||trs.has(String(t.ticket_raiz))||t.competencia?.startsWith(s.year));
    // Reconcile before applying UI filters so a hidden source cannot hide a conflict.
    const groups=groupHistory(s.hist,s.tickets,s.id),controls=toolbar(s,groups);
    let body='';
    if(s.tab==='financeiro'){const filtered=selectGroups(groups,s),selected=expenseGroups(filtered,s.expense),recorte=expenseGroups(selectGroups(groups,{...s,state:''}),s.expense),p=paginate(selected,s);const chips=`<div class="chips re-dossier-states">${kinds.map(([k,v])=>`<button class="chip ${s.state===k?'active':''}" aria-pressed="${s.state===k}" onclick="RealEstateDossier.filter(this,'state','${k}')">${v} <span>${k?recorte.filter(g=>category(g)===k).length:recorte.length}</span></button>`).join('')}</div>`;body=controls+expenseNav(filtered,s)+`<div role="tabpanel" id="re-expense-panel-${esc(s.id)}" aria-labelledby="re-expense-${esc(s.id)}-${s.expense}">`+metricsHtml(selected,s.expense)+chips+p.html+(p.rows.length?`<div class="re-payment-list">${p.rows.map(paymentRow).join('')}</div>`:`<p class="re-dossier-empty">Nenhum lançamento ${s.expense==='all'?'':esc('de '+expenseLabel(s.expense))} neste recorte.</p>`)+p.html+'</div>';}
    if(s.tab==='tickets'){const p=paginate(tickets.filter(t=>!q||norm([t.ticket_raiz,t.fornecedor,t.descricao,t.etapa].join(' ')).includes(q)),s);body=controls+p.html+ticketRows(p.rows)+p.html;}
    if(s.tab==='historico'){rows=rows.filter(h=>!q||norm([h.ticket_raiz,h.contraparte,h.observacoes,h.referencia,h.inscricao].join(' ')).includes(q));const p=paginate(rows.sort((a,b)=>period(b).localeCompare(period(a))),s);body=controls+p.html+RealEstateEvidence.historyHtml(p.rows)+p.html;}
    if(s.tab==='documentos'){const docs=documents(s.docs,s.tickets).filter(d=>(!s.docKind||documentKind(d)===s.docKind)&&(!q||norm([d.nome,d.tipo,d.contexto].join(' ')).includes(q))),p=paginate(docs,s);body=controls+`<p class="re-dossier-caption">${docs.length} documento(s) do imóvel. Anexo disponível não significa comprovante conferido.</p>`+p.html+`<div class="re-property-documents">${docsHtml(p.rows)}</div>`+p.html;}
    target.innerHTML=`<div role="tabpanel" id="re-panel-${esc(s.id)}-${s.tab}" aria-labelledby="re-tab-${esc(s.id)}-${s.tab}">${body}</div>`;
    revealExpense(el);
  }
  function revealExpense(el){const nav=el.querySelector('.re-expense-tabs'),active=nav?.querySelector('.active');if(!active||nav.scrollWidth<=nav.clientWidth)return;const n=nav.getBoundingClientRect(),a=active.getBoundingClientRect();if(a.left<n.left)nav.scrollLeft-=n.left-a.left;else if(a.right>n.right)nav.scrollLeft+=a.right-n.right;}
  let resizePending=false;
  root.addEventListener?.('resize',()=>{if(resizePending)return;resizePending=true;root.requestAnimationFrame(()=>{resizePending=false;root.document.querySelectorAll('.re-dossier').forEach(revealExpense);});});
  function filter(input,key,value){const el=input.closest('.re-dossier'),s=caches.get(el);if(!s||!['query','year','type','docKind','month','supplier','state'].includes(key))return;const position=input.selectionStart;s[key]=value;s.page=0;if(key==='year')s.month='';draw(el);if(key==='query'){const next=el.querySelector('[data-focus=search]');next.focus();next.setSelectionRange(position,position);}else if(key==='state'){el.querySelector('.chip.active')?.focus();}else el.querySelector(`[data-filter="${key}"]`)?.focus();}
  function clear(button){const el=button.closest('.re-dossier'),s=caches.get(el);if(!s)return;Object.assign(s,{type:'',docKind:'',query:'',month:'',supplier:'',state:'',page:0});draw(el);el.querySelector('[data-focus=search]')?.focus();}
  function page(button,n){const el=button.closest('.re-dossier'),s=caches.get(el);if(!s)return;s.page=n;draw(el);el.querySelector('.re-dossier-toolbar').scrollIntoView({block:'start'});el.querySelector('[data-focus=search]')?.focus({preventScroll:true});}
  function expand(button,part){const row=button.closest('.re-payment-row'),details=row.querySelector('details');details.open=true;const target=row.querySelector(part==='attachments'?'[data-attachments] h3':'.re-payment-detail h3');target.setAttribute('tabindex','-1');target.focus({preventScroll:true});target.scrollIntoView({block:'nearest'});}
  function tab(button,name){const el=button.closest('.re-dossier'),s=caches.get(el);if(!s||s.loading||s.error)return;s.tab=name;s.page=0;if(name==='financeiro')s.type='';draw(el);}
  function expense(button,name){const el=button.closest('.re-dossier'),s=caches.get(el);if(!s||!expenseTypes.some(([key])=>key===name))return;s.expense=name;s.page=0;draw(el);el.querySelector('.re-expense-tabs .active')?.focus({preventScroll:true});}
  function key(e){if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();const buttons=[...e.currentTarget.parentElement.querySelectorAll('[role=tab]')],index=buttons.indexOf(e.currentTarget),next=e.key==='Home'?0:e.key==='End'?buttons.length-1:(index+(e.key==='ArrowRight'?1:-1)+buttons.length)%buttons.length;buttons[next].click();buttons[next].focus();}
  root.RealEstateDossier={section,open,tab,key,filter,clear,page,expand,expense,expenseParts,expenseGroups,groupHistory,selectGroups,totals,documents,documentKind,financeHtml,ticketRows,paginate};
  if(typeof module==='object'&&module.exports)module.exports=root.RealEstateDossier;
})(typeof window==='undefined'?globalThis:window);
