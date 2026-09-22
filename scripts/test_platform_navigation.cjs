'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const test = require('node:test');
const source = fs.readFileSync(require('node:path').join(__dirname, 'platform-navigation.js'), 'utf8');
function setup() {
 const events = {}, frames = [], entries = [{state:null,hash:''}]; let index=0;
 const inputs = {'esc-busca':{value:''},'forn-busca':{value:''}};
 const main = {scrollTop:0,scrollTo(x,y){this.scrollTop=y;}};
 const c = {URLSearchParams,Map,location:{hash:''},currentProfile:{aprovado:true},
 esfBusca:'',esfFiltroMarca:'Todas',esfNfSearchQuery:'',capexDrillYear:null,capexDrillMarca:null,
 capexDrillUnidade:null,capexListStatus:'Todos',capexDashControls:{},realEstateArea:'locacoes',
 cur:null,curUni:null,obras:[{id:1,esfera:'nova'}],unidades:[{id:2}],
 requestAnimationFrame:fn=>frames.push(fn),addEventListener:(name,fn)=>events[name]=fn,
 document:{getElementById:id=>inputs[id]||null,querySelector:s=>s==='.main'?main:null,
 querySelectorAll:()=>[],addEventListener:(name,fn)=>events[name]=fn}};
 const denied = new Set();
 c.AccessControl={allowedView:v=>!denied.has(v),can:v=>!denied.has(v),landing:()=>c.go('escolas')};
 c.DashboardHub={parse:hash=>hash.startsWith('#dashboards')?{}:null,hash:()=>'#dashboards/capex',
 restore:()=>{c.go('dashboards');return true;}};
 c.history={get state(){return entries[index].state;},
 replaceState(state,_,hash){entries[index]={state,hash:hash??c.location.hash};if(hash!==undefined)c.location.hash=hash;},
 pushState(state,_,hash){entries.splice(index+1);entries.push({state,hash});index++;c.location.hash=hash;}};
 c.window=c;
 c.go=view=>{if(!c.AccessControl.allowedView(view))return;c.PlatformNav.before(view);main.scrollTo(0,0);c.visible=view;c.PlatformNav.after();};
 c.openObra=id=>{c.cur=c.obras.find(o=>o.id===id);c.go('obra');};
 c.openUni=id=>{c.curUni=c.unidades.find(o=>o.id===id);c.go('uni');};
 vm.runInNewContext(source,c);
 const flush=()=>{while(frames.length)frames.shift()();};
 const jump=delta=>{index+=delta;c.location.hash=entries[index].hash;events.popstate();events.hashchange();flush();};
 return {c,main,inputs,events,entries,denied,flush,jump};
}
test('back/forward restores entry-specific filters and scroll, including zero',()=>{
 const s=setup(),{c,main,inputs,events}=s;
 c.go('escolas');s.flush();inputs['esc-busca'].value='Alpha';events.input();main.scrollTop=240;events.scroll({target:main});
 c.go('forn');s.flush();assert.equal(main.scrollTop,0);inputs['forn-busca'].value='Beta';events.change();
 s.jump(-1);assert.equal(c.visible,'escolas');assert.equal(main.scrollTop,240);assert.equal(inputs['esc-busca'].value,'Alpha');
 s.jump(1);assert.equal(c.visible,'forn');assert.equal(main.scrollTop,0);assert.equal(inputs['forn-busca'].value,'Beta');
});
test('module switches reset scroll and repeated navigation does not push',()=>{
 const s=setup();s.c.go('escolas');s.flush();s.main.scrollTop=300;s.events.scroll({target:s.main});s.c.go('forn');s.flush();
 s.c.go('escolas');s.flush();assert.equal(s.main.scrollTop,0);
 const length=s.entries.length;s.c.go('escolas');s.c.PlatformNav.push();assert.equal(s.entries.length,length);
});
test('invalid, deleted and denied routes replace with authorized landing',()=>{
 for(const hash of ['#app/unknown','#app/obra?id=404','#app/uni?id=404','#app/admin','#app/obra?id=1','#app/not-valid']){
  const s=setup();s.denied.add('admin');s.denied.add('nova');s.c.go('forn');s.flush();
  s.c.history.pushState({screen:{inputs:{'esc-busca':'UNAUTHORIZED'},search:'bad'}},'',hash);
  const length=s.entries.length;assert.equal(s.c.PlatformNav.restore(),true);s.flush();
  assert.equal(s.c.visible,'escolas');assert.equal(s.c.location.hash,'#app/escolas');assert.equal(s.entries.length,length);
  assert.notEqual(s.inputs['esc-busca'].value,'UNAUTHORIZED');assert.notEqual(s.c.esfBusca,'bad');
 }
});
test('CAPEX URL filters win over stored screen and invalid year is discarded',()=>{
 const s=setup();s.c.history.replaceState({screen:{year:2020,scroll:80}},'','#app/capex?year=2026&brand=A&unit=B&status=Aberto');
 s.c.PlatformNav.restore();s.flush();assert.equal(s.c.capexDrillYear,2026);assert.equal(s.c.capexDrillMarca,'A');
 assert.equal(s.c.capexDrillUnidade,'B');assert.equal(s.c.capexListStatus,'Aberto');assert.equal(s.main.scrollTop,80);
 s.c.history.replaceState(null,'','#app/capex?year=oops');s.c.PlatformNav.restore();assert.equal(s.c.capexDrillYear,null);
});
test('real estate entry creates only one history item and records target view',()=>{
 const s=setup();s.c.go('escolas');const length=s.entries.length;s.c.realEstateArea='cantinas';s.c.go('realestate');
 assert.equal(s.entries.length,length+1);assert.equal(s.c.location.hash,'#realestate/sublocacoes');assert.equal(s.c.history.state.view,'realestate');
});
test('stale scroll frames cannot overwrite a newer destination',()=>{
 const s=setup();s.c.history.replaceState({screen:{scroll:480}},'','#app/escolas');s.c.PlatformNav.restore();
 s.c.go('forn');s.flush();assert.equal(s.main.scrollTop,0);
});
test('async unit completion consumes restoration without creating history',()=>{
 const s=setup();let finish;
 s.c.openUni=id=>{finish=()=>{s.c.curUni={id};s.c.go('uni');};};
 s.c.go('forn');s.flush();s.c.history.pushState({screen:{scroll:90}},'','#app/uni?id=2');
 const length=s.entries.length;s.c.PlatformNav.restore();finish();s.flush();
 assert.equal(s.c.visible,'uni');assert.equal(s.main.scrollTop,90);assert.equal(s.entries.length,length);
});
test('scroll saves ignore other containers and coalesce main events per frame',()=>{
 const s=setup();s.c.go('escolas');s.flush();
 let writes=0;const replace=s.c.history.replaceState;
 s.c.history.replaceState=(...args)=>{writes++;replace(...args);};
 s.events.scroll({target:{scrollTop:100}});s.events.scroll({target:s.c.document});s.flush();
 assert.equal(writes,0);
 for(const scroll of [20,60,120]){s.main.scrollTop=scroll;s.events.scroll({target:s.main});}
 assert.equal(writes,0);s.flush();assert.equal(writes,1);assert.equal(s.c.history.state.screen.scroll,120);
 s.main.scrollTop=180;s.events.scroll({target:s.main});s.flush();
 assert.equal(writes,2);assert.equal(s.c.history.state.screen.scroll,180);
});
test('queued scroll saves cannot overwrite a traversed history entry',()=>{
 const s=setup();s.c.go('escolas');s.flush();s.c.go('forn');s.flush();
 s.main.scrollTop=200;s.events.scroll({target:s.main});s.jump(-1);
 assert.equal(s.c.visible,'escolas');assert.equal(s.c.history.state.screen.scroll,0);assert.equal(s.main.scrollTop,0);
});
