(function(root){
 'use strict';
 const memory=new Map();let current='',routing=false,navigating=false,returnHub='',restoring=null,revision=0;
 const fields=['esc-busca','forn-busca','realestate-search','realestate-status-filter','realestate-type-filter','realestate-review-filter'];
 function snapshot(){
  const inputs={};for(const id of fields){const e=document.getElementById(id);if(e)inputs[id]=e.type==='checkbox'?e.checked:e.value;}
  return {inputs,search:esfBusca,brand:esfFiltroMarca,nf:esfNfSearchQuery,year:capexDrillYear,capexBrand:capexDrillMarca,unit:capexDrillUnidade,status:capexListStatus,focus:{...capexDashControls},area:realEstateArea,scroll:document.querySelector('.main')?.scrollTop||0};
 }
 function apply(s){
  if(!s)return;for(const [id,v]of Object.entries(s.inputs||{})){const e=document.getElementById(id);if(e){if(e.type==='checkbox')e.checked=v;else e.value=v;}}
  if(['nova','expansao'].includes(current)){esfBusca=s.search||'';esfFiltroMarca=s.brand||'Todas';esfNfSearchQuery=s.nf||'';const e=document.getElementById('esf-busca');if(e)e.value=esfBusca;}
  if(current==='capex'){capexDrillYear=s.year||null;capexDrillMarca=s.capexBrand||null;capexDrillUnidade=s.unit||null;capexListStatus=s.status||'Todos';capexDashControls=s.focus||{focusDim:'',focusValue:''};}
 }
 function before(view){
  if(view==='docs'||view==='geral')view='escolas';
  if(restoring?.view&&(restoring.view!==view||restoring.hash!==location.hash))restoring=null;
  revision++;
  navigating=true;
  if(current&&!routing&&!restoring){memory.set(current,snapshot());if(history.state?.platform)history.replaceState({...history.state,screen:memory.get(current)},'');}
  const previous=current;current=view;
  if(restoring)apply(restoring.screen);
  else if(!routing&&previous!==view){apply(memory.get(view)||{});}
 }
 function routeHash(){
  if(current==='dashboards')return DashboardHub.hash();
  if(current==='realestate')return /^#realestate(?:\/|$)/.test(location.hash)?location.hash:realEstateArea==='cantinas'?'#realestate/sublocacoes':'#realestate';
  const q=new URLSearchParams();
  if(current==='capex'){for(const [k,v]of Object.entries({year:capexDrillYear,brand:capexDrillMarca,unit:capexDrillUnidade,status:capexListStatus==='Todos'?'':capexListStatus}))if(v)q.set(k,v);}
  if(current==='obra'&&cur)q.set('id',cur.id);
  if(current==='uni'&&curUni)q.set('id',curUni.id);
  return '#app/'+current+(q.size?'?'+q:'');
 }
 function commit(replace){
  if(!current||routing||navigating)return;
  const hash=routeHash(),state={...history.state,platform:true,view:current,screen:snapshot(),hubReturn:returnHub};
  if(replace||location.hash===hash)history.replaceState(state,'',hash);else history.pushState(state,'',hash);
 }
 function after(){
  navigating=false;
  const scroll=restoring?.screen?.scroll??0,version=revision;
  document.querySelector('.main')?.scrollTo(0,scroll);
  if(restoring){history.replaceState({...history.state,platform:true,view:current,screen:snapshot(),hubReturn:returnHub},'',routeHash());restoring=null;}
  else commit(false);
  toolbar();
  requestAnimationFrame(()=>{if(version===revision)document.querySelector('.main')?.scrollTo(0,scroll);});
 }
 function toolbar(){
  document.querySelectorAll('.platform-context-nav').forEach(e=>e.remove());
  if(!current||current==='dashboards'||current==='admin'||!AccessControl.allowedView('dashboards'))return;
  const el=document.querySelector('.view.active');if(!el)return;
  const nav=document.createElement('div');nav.className='platform-context-nav';
  const b=document.createElement('button');b.type='button';b.className='dash-link';b.innerHTML='<img src="assets/icons/lucide/arrow-left.svg" alt="" width="15" height="15"> '+(returnHub?'Voltar aos dashboards':'Dashboards');
  b.onclick=()=>{const route=DashboardHub.parse(returnHub);if(route)DashboardHub.restore(route);else DashboardHub.open(current==='realestate'?(realEstateArea==='cantinas'?'realestate_sublocacoes':'realestate_locacoes'):current==='obra'?(cur?.esfera||'nova'):current==='uni'?'escolas':current,current==='capex'?{year:capexDrillYear,brand:capexDrillMarca,unit:capexDrillUnidade}:undefined);};
  nav.append(b);el.prepend(nav);
 }
 function restore(){
  if(typeof currentProfile==='undefined'||!currentProfile?.aprovado)return false;
  const hub=DashboardHub.parse(location.hash),m=location.hash.match(/^#app\/([a-z]+)(?:\?(.*))?$/);
  if(!hub&&!m){if(location.hash.startsWith('#app/'))return fallback();return false;}
  const old=routing;routing=true;
  try{
   if(hub){restoring={screen:history.state?.screen};returnHub=history.state?.hubReturn||'';if(DashboardHub.restore(hub))return true;return fallback();}
   const view=m[1],q=new URLSearchParams(m[2]||'');
   if(!['capex','nova','expansao','registros','escolas','forn','cobranca','investidores','obra','uni','admin'].includes(view))return fallback();
   const record=view==='obra'?obras.find(o=>String(o.id)===q.get('id')):view==='uni'?unidades.find(u=>String(u.id)===q.get('id')):null;
   if(view==='obra'?(!record||!AccessControl.can(record.esfera||'nova')):(!AccessControl.allowedView(view)||(view==='uni'&&!record)))return fallback();
   restoring={view,hash:location.hash,screen:history.state?.screen};returnHub=history.state?.hubReturn||'';
   if(view==='obra'){openObra(record.id);return true;}
   if(view==='uni'){openUni(record.id);return true;}
   if(view==='capex'){const year=Number(q.get('year'));restoring.screen={...restoring.screen,year:Number.isFinite(year)&&year>0?year:null,capexBrand:q.get('brand')||null,unit:q.get('unit')||null,status:q.get('status')||'Todos'};}
   go(view);return true;
  }finally{routing=old;}
 }
 function fallback(){
  const old=routing;routing=true;restoring={screen:{scroll:0}};returnHub='';
  try{AccessControl.landing();if(restoring){current='';restoring=null;history.replaceState({platform:true},'','#app');}return true;}finally{routing=old;}
 }
 function saveScreen(){
  if(!current||routing||navigating||restoring||history.state?.view!==current)return;
  const screen=snapshot();memory.set(current,screen);history.replaceState({...history.state,screen},'');
 }
 let scrollPending=false;
 function onScroll(event){
  if(event.target!==document.querySelector('.main')||scrollPending)return;
  scrollPending=true;
  const version=revision,entry=history.state;
  requestAnimationFrame(()=>{
   scrollPending=false;
   if(version===revision&&entry===history.state)saveScreen();
  });
 }
 document.addEventListener('scroll',onScroll,true);
 document.addEventListener('input',saveScreen);
 document.addEventListener('change',saveScreen);
 let pending=false;function onRoute(){
  if(/^#realestate(?:\/|$)/.test(location.hash))restoring={view:'realestate',hash:location.hash,screen:history.state?.screen};
  if(pending)return;pending=true;requestAnimationFrame(()=>{pending=false;restore();});
 }
 root.addEventListener('popstate',onRoute);root.addEventListener('hashchange',onRoute);
 root.PlatformNav={before,after,restore,replace:()=>commit(true),push:()=>commit(false),rememberHub:value=>{returnHub=value;},reset:()=>{memory.clear();current='';returnHub='';restoring=null;routing=false;navigating=false;revision++;}};
})(window);
