(function(root){
  'use strict';
  const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const icon=name=>`<img class="re-property-icon" src="assets/icons/lucide/${name}.svg" width="18" height="18" alt="">`;
  const originalTitle=root.document?.title||'Real Estate';
  function parse(hash){const m=String(hash||'').match(/^#realestate\/imovel\/([^/?#]+)$/);return m&&uuid.test(m[1])?m[1].toLowerCase():null;}
  const href=id=>uuid.test(String(id))?'#realestate/imovel/'+String(id).toLowerCase():'#realestate';
  const label=i=>i.unidade_ocupante||i.nome||'Imovel sem nome';
  function cost(i){return i.fonte_chave?.startsWith('property-history|')&&!i.valor_aluguel?(i.status==='Encerrado'?'Encerrado':'N\u00e3o confirmado'):i.valor_aluguel===null||i.valor_aluguel===undefined?'N\u00e3o informado':fmt(i.valor_aluguel);}
  function status(i){
    if(realEstateNorm(i.status).includes('encerr'))return {text:'Encerrado',kind:'neutral'};
    const overdue=(i.obrigacoes||[]).filter(o=>!['Pago','Dispensado'].includes(o.status)&&realEstateDaysTo(o.vencimento)!==null&&realEstateDaysTo(o.vencimento)<0).length;
    if(overdue)return {text:overdue+' em atraso',kind:'danger'};
    const days=realEstateDaysTo(i.contrato_fim);
    if(days!==null&&days<0)return {text:'Vig\u00eancia cadastrada vencida',kind:'warning'};
    if(i.revisao_pendente)return {text:'Dados a revisar',kind:'warning'};
    if(days!==null&&days>=0&&days<=180)return {text:'Vig\u00eancia vencendo',kind:'warning'};
    return {text:realEstateStatusLabel(i.status),kind:realEstateStatusClass(i.status)==='ok'?'ok':'neutral'};
  }
  function card(i){
    if(!uuid.test(String(i.id)))return '';
    const brand=realEstateBrandLabel(i),s=status(i);
    return `<a class="card re-property-card" data-imovel-id="${esc(i.id)}" href="${href(i.id)}" onclick="RealEstatePropertyPage.open(event,'${i.id}')" style="--re-color:${esc(brandColor(brand))};--re-tint:${esc(brandLight(brand))}">
      <div class="re-property-card-top"><span class="re-property-brand">${brandLogoImg(brand,'width:58px;height:36px;object-fit:contain')}<span>${esc(brand)}</span></span><span class="re-property-status ${s.kind}">${esc(s.text)}</span></div>
      <div class="re-property-card-body"><h2>${esc(label(i))}</h2><div class="re-property-card-value"><small>Aluguel de refer\u00eancia</small><strong>${esc(cost(i))}</strong></div><p class="re-property-address">${esc(i.endereco||'Endere\u00e7o n\u00e3o informado')}</p>
      <div class="re-property-owner"><small>Locador</small><span>${esc(i.locador||'N\u00e3o informado')}</span></div>
      <div class="re-property-card-facts"><span><small>Reajuste</small>${esc(i.indice_reajuste||'A confirmar')}</span><span><small>Fim do contrato</small>${esc(i.contrato_fim?fmtD(i.contrato_fim):'A confirmar')}</span></div></div>
      <div class="re-property-card-bottom"><span>Abrir im\u00f3vel</span><span class="re-property-open" aria-hidden="true">${icon('arrow-up-right')}</span></div>
    </a>`;
  }
  function contractFacts(i){
    const rows=[['Locador',i.locador],['Locat\u00e1ria',i.locataria],['CNPJ da locat\u00e1ria',i.cnpj_locataria],['Centro de custo',i.centro_custo],['Contrato',i.contrato_numero],['Modalidade',i.modalidade],['\u00c1rea',i.area_m2?Number(i.area_m2).toLocaleString('pt-BR')+' m\u00b2':''],['\u00cdndice de reajuste',i.indice_reajuste],['Data de reajuste',i.data_reajuste?fmtD(i.data_reajuste):''],['Garantia',i.garantia],['Multa e aviso',i.multa_aviso]];
    return `<h2 class="re-property-section-title">Dados do contrato</h2><dl class="re-property-contract-facts">${rows.map(([k,v])=>`<div><dt>${esc(k)}</dt><dd>${esc(v||'N\u00e3o informado')}</dd></div>`).join('')}</dl>`;
  }
  function capture(){return {portfolio:root.RealEstateWorkspace?.snapshot('locacoes'),search:document.getElementById('realestate-search')?.value||'',status:document.getElementById('realestate-status-filter')?.value||'',review:!!document.getElementById('realestate-review-filter')?.checked,mainScroll:document.querySelector('.main')?.scrollTop||0,windowScroll:root.scrollY||0};}
  function applyListState(){const s=history.state?.rePropertyList;if(!s)return;root.RealEstateWorkspace?.restoreFilters('locacoes',s.portfolio);for(const [id,k]of [['realestate-search','search'],['realestate-status-filter','status']]){const el=document.getElementById(id);if(el)el.value=s[k]||'';}const review=document.getElementById('realestate-review-filter');if(review)review.checked=!!s.review;}
  function restoreScroll(){const s=history.state?.rePropertyList;if(!s)return;requestAnimationFrame(()=>{const card=[...document.querySelectorAll('.re-property-card')].find(c=>c.dataset.imovelId===s.focusId);card?.focus({preventScroll:true});document.querySelector('.main')?.scrollTo(0,s.mainScroll||0);root.scrollTo(0,s.windowScroll||0);});}
  function open(event,id){
    if(event&&(event.button>0||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey))return;
    event?.preventDefault();if(!uuid.test(String(id)))return;
    const list={...capture(),focusId:id};history.replaceState({...history.state,rePropertyList:list},'','#realestate');
    history.pushState({rePropertyFromList:true,rePropertyList:list},'',href(id));go('realestate');focusHeading();
  }
  function back(){if(history.state?.rePropertyFromList){history.back();return;}history.replaceState({...history.state,rePropertyFromList:false},'','#realestate');route();}
  function focusHeading(){requestAnimationFrame(()=>document.getElementById('re-property-title')?.focus({preventScroll:true}));}
  function render(){
    const id=parse(root.location.hash),list=document.getElementById('realestate-list-view'),page=document.getElementById('realestate-property-view'),view=document.getElementById('view-realestate');
    if(!list||!page)return false;
    list.hidden=!!id;page.hidden=!id;view.classList.toggle('re-property-detail',!!id);
    if(!id){page.innerHTML='';document.title=originalTitle;return false;}
    const i=realEstateImoveis.find(i=>String(i.id).toLowerCase()===id);
    if(!i){page.innerHTML=`<nav class="re-property-nav"><button class="re-property-back" onclick="RealEstatePropertyPage.back()">${icon('arrow-left')} Im\u00f3veis</button></nav><h1 id="re-property-title" tabindex="-1">${realEstateLoadError?'N\u00e3o foi poss\u00edvel carregar o im\u00f3vel':'Im\u00f3vel n\u00e3o encontrado'}</h1><p>${esc(realEstateLoadError||'O cadastro pode ter sido removido ou n\u00e3o estar dispon\u00edvel para esta conta.')}</p>${realEstateLoadError?'<button class="btn btn-ghost" onclick="RealEstatePropertyPage.retry()">Tentar novamente</button>':''}`;document.title='Imovel | Real Estate';return true;}
    const brand=realEstateBrandLabel(i),s=status(i),editable=AccessControl.can('realestate_locacoes','edit');
    applyBrandVars(view,brand);document.title=label(i)+' | Real Estate';
    page.innerHTML=`<article class="re-property-page" data-dossier-host data-imovel-id="${esc(id)}" style="--re-color:${esc(brandColor(brand))}">
      <nav class="re-property-nav" aria-label="Navega\u00e7\u00e3o do im\u00f3vel"><button class="re-property-back" onclick="RealEstatePropertyPage.back()">${icon('arrow-left')} Im\u00f3veis</button><span>Real Estate / Loca\u00e7\u00f5es</span><div class="re-property-tools"><button class="re-property-tool" title="Atualizar dossi\u00ea" aria-label="Atualizar dossi\u00ea" onclick="RealEstatePropertyPage.refresh(this)">${icon('refresh-cw')}</button>${editable?`<button class="re-property-tool" title="Editar im\u00f3vel" aria-label="Editar im\u00f3vel" onclick="openRealEstateModal('${id}')">${icon('pencil')}</button>`:''}</div></nav>
      <header class="re-property-heading"><div class="re-property-logo">${brandLogoImg(brand,'width:100%;height:100%;object-fit:contain')}</div><div class="re-property-heading-text"><div class="re-property-eyebrow">${esc(brand)}<span>${esc(i.modalidade||'Loca\u00e7\u00e3o')}</span></div><h1 id="re-property-title" tabindex="-1">${esc(label(i))}</h1><p>${esc(i.endereco||'Endere\u00e7o n\u00e3o informado')}</p></div><span class="re-property-status ${s.kind}">${esc(s.text)}</span></header>
      <dl class="re-property-summary"><div><dt>Aluguel de refer\u00eancia</dt><dd>${esc(cost(i))}</dd></div><div><dt>Locador</dt><dd>${esc(i.locador||'N\u00e3o informado')}</dd></div><div><dt>Vig\u00eancia contratual</dt><dd>${esc(fmtD(i.contrato_inicio))} a ${esc(fmtD(i.contrato_fim))}</dd></div><div><dt>\u00cdndice de reajuste</dt><dd>${esc(i.indice_reajuste||'N\u00e3o informado')}</dd></div></dl>
      ${RealEstateDossier.section(id)}${realEstateContractHtml(i)}
    </article>`;
    if(!editable)page.querySelector('.re-property-danger')?.remove();
    RealEstateDossier.open(page.querySelector('[data-dossier-host]'),id);
    scheduleActivePageArt([brand]);
    return true;
  }
  async function refresh(button){const host=button.closest('[data-dossier-host]');button.disabled=true;button.setAttribute('aria-busy','true');try{await RealEstateDossier.open(host,host.dataset.imovelId,true);}finally{button.disabled=false;button.removeAttribute('aria-busy');}}
  async function retry(){await loadRealEstate();renderRealEstate();}
  function leave(view){if(view==='realestate')return;if(/^#realestate(?:\/|$)/.test(root.location.hash)){if(!root.PlatformNav)history.replaceState({...history.state,rePropertyFromList:false},'',root.location.pathname+root.location.search);document.title=originalTitle;}}
  function route(){if(typeof currentProfile==='undefined'||!currentProfile)return;if(root.RealEstateWorkspace&&(RealEstateWorkspace.parse(root.location.hash)||root.location.hash==='#realestate/sublocacoes')){RealEstateWorkspace.restore();return;}if(!parse(root.location.hash)&&root.location.hash!=='#realestate')return;realEstateArea='locacoes';applyListState();go('realestate');if(!parse(root.location.hash))restoreScroll();else focusHeading();}
  let routePending=false;
  function scheduleRoute(){if(routePending)return;routePending=true;requestAnimationFrame(()=>{routePending=false;route();});}
  root.addEventListener?.('popstate',scheduleRoute);root.addEventListener?.('hashchange',scheduleRoute);
  root.RealEstatePropertyPage={parse,href,card,status,contractFacts,open,back,render,refresh,retry,leave,restore:route};
  if(typeof module==='object'&&module.exports)module.exports=root.RealEstatePropertyPage;
})(typeof window==='undefined'?globalThis:window);
