(function(root){
  'use strict';
  const norm=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const safe=v=>{try{const u=new URL(v);return u.protocol==='https:'?u.href:'';}catch{return '';}};
  const link=(u,t)=>safe(u)?`<a href="${esc(safe(u))}" target="_blank" rel="noopener noreferrer">${esc(t)}</a>`:esc(t);
  const money=n=>n==null||!Number.isFinite(Number(n))?'Não informado':Number(n).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
  const day=d=>/^\d{4}-\d{2}-\d{2}$/.test(d||'')?d.split('-').reverse().join('/'):d||'Não informado';
  const caches=new WeakMap();
  const tabs=[['financeiro','Financeiro'],['tickets','TRs'],['documentos','Documentos'],['contrato','Contrato e cadastro'],['historico','Histórico das fontes']];
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
  function componentsHtml(t){const rows=(t?.componentes||[]).filter(c=>c.valor!=null&&Number(c.valor)!==0);return rows.length?`<div class="re-dossier-components"><b>Componentes informados no TR</b>${rows.map(c=>`<div><span>${esc(c.tipo)}</span><strong>${money(c.valor)}</strong></div>`).join('')}</div>`:'';}
  function ticketRows(rows){return rows.length?`<div class="re-dossier-scroll"><table class="re-dossier-table"><thead><tr><th>TR / fluxo</th><th>Fornecedor e descrição</th><th>Valor do TR</th><th>Andamento no Zeev</th><th>Documentos</th></tr></thead><tbody>${rows.map(t=>`<tr><td>${link(t.ticket_url,'TR '+t.ticket_raiz)}<small>${t.financeiro?'Financeiro':'Contratual / outro fluxo'}</small></td><td><b>${esc(t.fornecedor||'Não informado')}</b><details><summary>Descrição</summary><p>${esc(t.descricao||'Sem descrição disponível')}</p></details></td><td class="re-dossier-money">${money(t.valor_total)}<small>Vencimento ${esc(day(t.vencimento))}</small></td><td>${esc(t.status)}<small>${esc(t.etapa)}</small><small>Consulta ${esc(day(String(t.sincronizado_em||'').slice(0,10)))}</small></td><td>${(t.anexos||[]).length} anexo(s)${t.vinculo_revisar?'<small class="re-dossier-warning">Vínculo a revisar</small>':''}</td></tr>`).join('')}</tbody></table></div>`:'<p class="realestate-muted">Nenhum TR consultado para este imóvel.</p>';}
  function financeHtml(groups){const s=totals(groups);return `<div class="re-dossier-metrics"><div><small>Lançamentos no recorte</small><b>${s.count}</b></div><div><small>Total nominal sem divergência</small><b>${money(s.total)}</b></div><div><small>Conciliação / rateio</small><b>${s.review}</b></div><div><small>Sem TR / previsão na fonte</small><b>${s.provisional}</b></div></div><p class="re-dossier-caption">Total nominal não comprova pagamento. Previsões, cancelados, divergências e rateios pendentes não entram na soma.</p>${groups.length?`<div class="re-dossier-scroll"><table class="re-dossier-table"><thead><tr><th>Período / natureza</th><th>Fornecedor / TR</th><th>Valor</th><th>Situação</th><th>Composição e evidências</th></tr></thead><tbody>${groups.map(g=>`<tr><td><b>${esc(g.period)}</b><small>${esc(g.type)}</small>${g.meta?.competencia?'<small>Competência descrita no TR</small>':'<small>Período da fonte</small>'}</td><td><b>${esc(g.supplier)}</b><small>${g.ticket?link(g.meta?.ticket_url,'TR '+g.ticket):'Sem TR informado'}</small></td><td class="re-dossier-money">${money(g.value)}${g.shared?'<small>Total do TR, não rateado</small>':''}</td><td><span class="re-dossier-state ${g.review?'warning':''}">${esc(g.cancelled?'Cancelado / reprovado':g.shared?'Rateio a confirmar':g.conflict?'Valores divergentes':g.provisional?'Previsão na fonte':g.meta?.status||'Registrado na fonte')}</span>${g.meta?.etapa?`<small>${esc(g.meta.etapa)}</small>`:''}${g.meta?.vencimento?`<small>Vencimento ${esc(day(g.meta.vencimento))}</small>`:''}</td><td><details><summary>${g.sources.length} referência(s)${g.meta?.anexos?.length?' · '+g.meta.anexos.length+' anexo(s)':''}</summary><p>${esc(g.description)}</p>${g.meta?.observacoes?`<p>${esc(g.meta.observacoes)}</p>`:''}${componentsHtml(g.meta)}${g.sources.map(h=>`<div class="re-dossier-source">${link(h.fonte_url,h.fonte_nome)}<small>${esc(h.periodo)} · ${esc(h.tipo)} · ${money(h.valor)}</small><small>${esc(h.status_fonte)}${h.inscricao?' · '+esc(h.inscricao):''}</small></div>`).join('')}${(g.meta?.anexos||[]).map(d=>`<div class="re-dossier-source">${link(d.url,d.nome||'Anexo do TR')}</div>`).join('')}</details></td></tr>`).join('')}</tbody></table></div>`:'<p class="realestate-muted">Nenhum lançamento neste recorte.</p>'}`;}
  function documents(historyDocs,tickets){const map=new Map();for(const d of historyDocs){const k=d.url?.match(/\/d\/([^/?]+)/)?.[1]||d.url;if(k&&!map.has(k))map.set(k,{...d,tickets:[]});}
    for(const t of tickets)for(const d of t.anexos||[]){const k=d.url;if(!k)continue;if(!map.has(k))map.set(k,{nome:d.nome,tipo:d.tipo||'Anexo do TR',url:k,contexto:'TR '+t.ticket_raiz,observacoes:'Anexo localizado no Zeev; conteúdo e pagamento não presumidos.',tickets:[t.ticket_raiz],vinculo_revisar:t.vinculo_revisar});else map.get(k).tickets.push(t.ticket_raiz);}
    return [...map.values()].sort((a,b)=>String(a.tipo).localeCompare(String(b.tipo))||String(a.nome).localeCompare(String(b.nome)));}
  function section(id){return `<section class="re-dossier" data-property="${esc(id)}"><div class="re-dossier-tabs" role="tablist" aria-label="Informações do imóvel">${tabs.map(([k,v],n)=>`<button type="button" role="tab" id="re-tab-${esc(id)}-${k}" aria-controls="re-panel-${esc(id)}-${k}" aria-selected="${n===0}" tabindex="${n===0?0:-1}" data-tab="${k}" onclick="RealEstateDossier.tab(this,'${k}')" onkeydown="RealEstateDossier.key(event)">${v}</button>`).join('')}</div><div class="re-dossier-content" aria-live="polite"><p>Carregando informações do imóvel...</p></div></section>`;}
  async function all(make){let rows=[];for(let offset=0;;offset+=250){const r=await make().range(offset,offset+249);if(r.error)throw r.error;rows.push(...(r.data||[]));if((r.data||[]).length<250)return rows;}}
  async function open(card,id,force=false){if(card.tagName==='DETAILS'&&!card.open)return;const el=card.querySelector('.re-dossier');if(!el)return;let state=caches.get(el);if(state?.loading)return;if(state&&!force){draw(el);return;}
    state={id,loading:true,tab:'financeiro',year:'2026',type:'',query:'',hist:[],tickets:[],docs:[]};caches.set(el,state);
    try{state.hist=await all(()=>db.from('real_estate_lancamentos').select('*').eq('imovel_id',id).order('id'));state.docs=await all(()=>db.from('real_estate_documentos').select('*').contains('imovel_ids',[id]).order('id'));state.tickets=await all(()=>db.from('real_estate_tickets').select('*').contains('imovel_ids',[id]).order('ticket_raiz'));
      state.years=[...new Set(state.hist.map(h=>String(h.ano)))].sort().reverse();if(!state.years.includes(state.year))state.year=state.years[0]||'';state.loading=false;if(el.isConnected)draw(el);
    }catch(e){state.loading=false;state.error=e.message;if(el.isConnected){const content=el.querySelector('.re-dossier-content');content.textContent='Não foi possível carregar o dossiê: '+e.message;const b=document.createElement('button');b.className='btn btn-ghost btn-sm';b.textContent='Tentar novamente';b.onclick=()=>open(card,id,true);content.append(b);}}
  }
  function draw(el){const s=caches.get(el);if(!s||s.loading||!el.isConnected)return;
    const contract=el.closest('[data-dossier-host],.realestate-card').querySelector('.re-dossier-contract');if(contract)contract.hidden=s.tab!=='contrato';
    el.querySelectorAll('[role=tab]').forEach(b=>{b.setAttribute('aria-selected',String(b.dataset.tab===s.tab));b.tabIndex=b.dataset.tab===s.tab?0:-1;});
    const target=el.querySelector('.re-dossier-content');target.hidden=s.tab==='contrato';if(s.tab==='contrato'){target.innerHTML='';return;}
    let rows=s.hist.filter(h=>(!s.year||String(h.ano)===s.year)&&(!s.type||h.tipo===s.type));
    const q=norm(s.query),trs=new Set(rows.map(h=>h.ticket_raiz));
    const tickets=s.tickets.filter(t=>!s.year||trs.has(t.ticket_raiz)||(!s.type&&t.competencia?.startsWith(s.year)));
    const toolbar=`<div class="re-dossier-toolbar"><label>Buscar<input class="fi" placeholder="TR, fornecedor ou descrição" data-focus="search" value="${esc(s.query)}" oninput="RealEstateDossier.filter(this,'query',this.value)"></label><label>Ano<select class="fi" onchange="RealEstateDossier.filter(this,'year',this.value)"><option value="">Todos</option>${(s.years||[]).map(y=>`<option ${s.year===y?'selected':''}>${esc(y)}</option>`).join('')}</select></label><label>Natureza<select class="fi" onchange="RealEstateDossier.filter(this,'type',this.value)"><option value="">Todas</option>${[...new Set(s.hist.map(h=>h.tipo))].sort().map(t=>`<option ${t===s.type?'selected':''}>${esc(t)}</option>`).join('')}</select></label></div>`;
    let body='';
    if(s.tab==='financeiro'){const groups=groupHistory(rows,tickets,s.id).filter(g=>!q||norm([g.ticket,g.supplier,g.description,g.type,g.period].join(' ')).includes(q));body=financeHtml(groups);}
    if(s.tab==='tickets')body=ticketRows(tickets.filter(t=>!q||norm([t.ticket_raiz,t.fornecedor,t.descricao,t.etapa].join(' ')).includes(q)));
    if(s.tab==='historico'){rows=rows.filter(h=>!q||norm([h.ticket_raiz,h.contraparte,h.observacoes,h.referencia,h.inscricao].join(' ')).includes(q));body=RealEstateEvidence.historyHtml(rows.sort((a,b)=>period(b).localeCompare(period(a))));}
    if(s.tab==='documentos'){const docs=documents(s.docs,s.tickets).filter(d=>!q||norm([d.nome,d.tipo,d.contexto].join(' ')).includes(q));body=`<p class="re-dossier-caption">${docs.length} documento(s) do imóvel. Anexo disponível não significa comprovante conferido.</p><div class="re-evidence-doc-grid">${RealEstateEvidence.docsHtml(docs)}</div>`;}
    target.innerHTML=`<div role="tabpanel" id="re-panel-${esc(s.id)}-${s.tab}" aria-labelledby="re-tab-${esc(s.id)}-${s.tab}">${toolbar}${body}</div>`;
    if(s.tab==='documentos')target.querySelectorAll('.re-dossier-toolbar label:not(:first-child)').forEach(l=>l.hidden=true);
  }
  function filter(input,key,value){const el=input.closest('.re-dossier'),s=caches.get(el);if(!s)return;const position=input.selectionStart;s[key]=value;draw(el);if(key==='query'){const next=el.querySelector('[data-focus=search]');next.focus();next.setSelectionRange(position,position);}}
  function tab(button,name){const el=button.closest('.re-dossier'),s=caches.get(el);if(!s||s.loading||s.error)return;s.tab=name;draw(el);}
  function key(e){if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();const buttons=[...e.currentTarget.parentElement.querySelectorAll('[role=tab]')],index=buttons.indexOf(e.currentTarget),next=e.key==='Home'?0:e.key==='End'?buttons.length-1:(index+(e.key==='ArrowRight'?1:-1)+buttons.length)%buttons.length;buttons[next].click();buttons[next].focus();}
  root.RealEstateDossier={section,open,tab,key,filter,groupHistory,totals,documents,financeHtml,ticketRows};
  if(typeof module==='object'&&module.exports)module.exports=root.RealEstateDossier;
})(typeof window==='undefined'?globalThis:window);
