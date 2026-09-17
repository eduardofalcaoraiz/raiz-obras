(function(root){
 'use strict';
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const panels=[['capex','CAPEX de melhorias'],['nova','Novas unidades'],['expansao','Expansões'],['realestate_locacoes','Imóveis e encargos'],['realestate_sublocacoes','Sublocações e uso de marca'],['cobranca','Contas a pagar das obras'],['forn','Fornecedores'],['investidores','Investidores'],['escolas','Documentos das escolas'],['registros','Registros pendentes']];
 const saved=new Map();let selected='capex',scope={year:String(new Date().getFullYear())},generation=0;
 const active=()=>!!document.getElementById('view-dashboards')?.classList.contains('active');
 const available=()=>panels.filter(([key])=>AccessControl.can(key));
 const hash=()=>{const q=new URLSearchParams();for(const k of ['brand','year','unit','project'])if(scope[k])q.set(k,scope[k]);return '#dashboards/'+selected+(q.size?'?'+q:'');};
 function parse(value){const m=String(value).match(/^#dashboards(?:\/([a-z_]+))?(?:\?(.*))?$/);if(!m)return null;const q=new URLSearchParams(m[2]||'');return {panel:m[1]||'',scope:Object.fromEntries(['brand','year','unit','project'].map(k=>[k,q.get(k)||'']))};}
 function open(panel,options){
  if(panel&&!AccessControl.can(panel))return;
  saved.set(selected,{...scope});selected=panel||available()[0]?.[0];
  scope={...(options||saved.get(selected)||{})};
  if(selected==='capex'&&!Object.hasOwn(scope,'year'))scope.year=String(new Date().getFullYear());
  go('dashboards');
 }
 function restore(route){if(!route)return false;if(!AccessControl.can(route.panel)){const first=available()[0];if(!first)return false;route={panel:first[0],scope:{}};}selected=route.panel;scope={...route.scope};go('dashboards');return true;}
 const select=(label,key,options,value)=>`<label class="hub-filter">${esc(label)}<select class="fi" data-hub-filter="${key}">${options.map(([v,l])=>`<option value="${esc(v)}" ${String(v)===String(value||'')?'selected':''}>${esc(l)}</option>`).join('')}</select></label>`;
 function source(){
  if(selected==='capex')return [...capexItens.map(r=>({brand:extractMarca(r),unit:r.unidade,year:r.ano})),...capexSaldos.map(r=>({brand:capexSaldoMarca(r),unit:r.unidade,year:r.ano}))];
  if(selected.startsWith('realestate_'))return (selected==='realestate_locacoes'?realEstateImoveis:realEstateSublocacoes).map(r=>({brand:realEstateBrandLabel(r)}));
  if(selected==='escolas')return unidades.map(r=>({brand:r.marca}));
  if(selected==='registros')return capexZeevPendingList().map(r=>({brand:r.marca||extractMarca(r)}));
  return obras.filter(o=>!['nova','expansao'].includes(selected)||(o.esfera||'nova')===selected).flatMap(o=>obraMarcaNames(o).map(brand=>({brand,project:o.id,name:o.nome})));
 }
 function title(){return panels.find(([key])=>key===selected)?.[1]||'Dashboards';}
 function header(rows){
  const brands=[...new Set(rows.filter(r=>!scope.year||String(r.year)===String(scope.year)).map(r=>r.brand).filter(Boolean))].sort();
  const brand=scope.brand||'RAIZ',years=[...new Set(rows.map(r=>r.year).filter(Boolean))].sort((a,b)=>b-a);
  const units=[...new Set(rows.filter(r=>(!scope.year||String(r.year)===String(scope.year))&&(!scope.brand||r.brand===scope.brand)).map(r=>r.unit).filter(Boolean))].sort();
  const projects=[...new Map(rows.filter(r=>r.project&&(!scope.brand||r.brand===scope.brand)).map(r=>[r.project,r])).values()];
  const el=document.getElementById('view-dashboards');el.style.setProperty('--hub-color',brandColor(brand));el.style.setProperty('--hub-tint',brandLight(brand));
  updateSideArt([brand]);
  document.getElementById('dashboard-hub-header').innerHTML=`<header class="hub-heading"><div class="hub-identity">${brandLogoImg(brand,'width:86px;height:64px;object-fit:contain')}<div><span class="eyebrow">Visão de gestão</span><h1>Dashboards</h1><p>${esc(title())}</p></div></div><button type="button" class="btn btn-ghost" data-hub-records><img src="assets/icons/lucide/list.svg" width="17" height="17" alt=""> Abrir registros</button></header><div class="hub-controls">${select('Painel','panel',available(),selected)}${selected==='capex'?select('Ciclo','year',[['','Todos os ciclos'],...years.map(y=>[y,y])],scope.year):''}${select('Marca','brand',[['','Todas as marcas'],...brands.map(b=>[b,b])],scope.brand)}${selected==='capex'?select('Unidade','unit',[['','Todas as unidades'],...units.map(u=>[u,u])],scope.unit):''}${['nova','expansao'].includes(selected)?select('Obra','project',[['','Todas as obras'],...projects.map(p=>[p.project,p.name])],scope.project):''}</div>${scope.brand?'':`<div class="hub-brand-strip">${brands.map(b=>`<button type="button" data-hub-brand="${esc(b)}" title="Filtrar ${esc(b)}" style="--brand-accent:${esc(brandColor(b))}">${brandLogoImg(b,'width:48px;height:28px;object-fit:contain')}<span>${esc(b)}</span></button>`).join('')}</div>`}`;
 }
 async function render(){
  if(!active())return;
  const focused=document.activeElement?.dataset?.hubFilter;
  if(!AccessControl.can(selected)){selected=available()[0]?.[0];scope={};}
  const body=document.getElementById('dashboard-hub-body'),run=++generation;
  if(!selected){body.innerHTML='<p class="dash-empty">Nenhum painel liberado.</p>';return;}
  try{
   if((selected==='capex'&&!capexDataLoaded)||(selected==='registros'&&!capexZeevLoaded)){
    body.innerHTML='<p class="dash-empty" role="status">Carregando os registros do painel...</p>';
    if(selected==='capex')await loadCapexData();else await refreshCapexZeevQueue({silent:true});
    if(run!==generation||!active())return;
    if(selected==='capex'&&!capexDataLoaded)throw new Error('CAPEX indisponível');
    if(selected==='registros'&&capexZeevLoadError)throw new Error('Fila indisponível');
   }
   header(source());body.innerHTML=Dashboards.render(selected,scope);
   if(['panel','brand','year','unit','project'].includes(focused))document.querySelector(`[data-hub-filter="${focused}"]`)?.focus({preventScroll:true});
   // Brand comes from the active record scope, never from a previous operational filter.
   root.PlatformNav?.replace();
  }catch(error){if(run!==generation||!active())return;header([]);body.innerHTML='<div class="hub-error" role="alert"><h2>Não foi possível carregar este painel</h2><p>Os valores não foram substituídos por zero.</p><button type="button" class="btn btn-ghost" data-hub-retry>Tentar novamente</button></div>';console.warn('[dashboard-hub]',error);}
 }
 function remember(){saved.set(selected,{...scope});root.PlatformNav?.rememberHub(hash());}
 function records(){
  if(!AccessControl.can(selected))return;
  remember();
  if(selected==='capex'){
   go('capex');capexDrillYear=scope.year?+scope.year:null;capexDrillMarca=scope.brand||null;capexDrillUnidade=scope.unit||null;capexListStatus='Todos';capexDashControls={focusDim:'',focusValue:''};capexTab='pedidos';renderCapexView();
  }else if(['nova','expansao'].includes(selected)){
   if(scope.project){const o=obras.find(o=>String(o.id)===String(scope.project)&&(o.esfera||'nova')===selected);if(o)openObra(o.id);}
   else{go(selected);esfFiltroMarca=scope.brand||'Todas';esfBusca='';esfNfSearchQuery='';document.getElementById('esf-busca').value='';renderEsfera();}
  }else if(selected.startsWith('realestate_')){
   realEstateArea=selected==='realestate_locacoes'?'locacoes':'cantinas';go('realestate');
   for(const id of ['realestate-search','realestate-status-filter','realestate-type-filter']){const el=document.getElementById(id);if(el)el.value='';}
   document.getElementById('realestate-review-filter').checked=false;
   RealEstateWorkspace.filter(realEstateArea,'brand',scope.brand||'');
  }else{go(selected);Dashboards.recordsScope(selected,scope.brand);if(selected==='escolas'){document.getElementById('esc-busca').value=scope.brand||'';renderEscolas();}if(selected==='registros'){capexZeevSearchQuery=scope.brand||'';renderRegistrosPendentes();}}
  root.PlatformNav?.replace();
 }
 function action(a){
  if(!AccessControl.can(selected))return true;
  if(a.name==='export'){Dashboards.csv(a.key);return true;}
  if(a.name==='capex-unit-open'){scope={...scope,year:String(a.year),brand:a.brand,unit:a.unit};render();return true;}
  if(a.name.startsWith('capex-')){records();capexListStatus=a.status||'Todos';capexDashControls={focusDim:a.kind?'pendencia':'',focusValue:a.kind||''};renderCapexView();root.PlatformNav?.replace();return true;}
  if(a.name==='project'){scope={...scope,project:String(a.id)};render();return true;}
  if(a.name==='property'){
   remember();const area=a.area==='cantinas'?'realestate_sublocacoes':'realestate_locacoes';if(!AccessControl.can(area))return true;
   realEstateArea=a.area;history.pushState({hubReturn:hash()},'',a.area==='cantinas'?'#realestate/sublocacao/'+encodeURIComponent(a.id):'#realestate/imovel/'+encodeURIComponent(a.id));go('realestate');return true;
  }
  if(a.name==='unit'){remember();openUni(a.id);return true;}
   if(a.name==='payment'||a.name==='supplier'||a.name==='investor'){
   remember();if(a.name==='supplier')go('forn');if(a.name==='investor')go('investidores');return false;
  }
  if(a.name.startsWith('project-')||['deposit','school-ceiling'].includes(a.name)){records();return false;}
  return false;
 }
 document.addEventListener('change',e=>{const key=e.target.dataset.hubFilter;if(!key)return;if(key==='panel'){open(e.target.value);return;}scope={...scope,[key]:e.target.value};if(['year','brand'].includes(key)){scope.unit='';scope.project='';}render();});
 document.addEventListener('click',e=>{const b=e.target.closest('[data-hub-brand]');if(b){scope={...scope,brand:b.dataset.hubBrand,unit:'',project:''};render();}if(e.target.closest('[data-hub-records]'))records();if(e.target.closest('[data-hub-retry]'))render();});
 root.DashboardHub={open,render,restore,parse,hash,active,action,available,records,scope:()=>({...scope}),panel:()=>selected};
})(window);
