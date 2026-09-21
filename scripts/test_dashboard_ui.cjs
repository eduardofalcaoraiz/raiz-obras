const fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
process.env.PW_TEST_SCREENSHOT_NO_FONTS_READY='1';
const root=path.resolve(__dirname,'..'),production=process.argv.includes('--production'),base=production?'https://raiz-obras.vercel.app':'https://dashboards.test';
const prefix=production?'production':'local';
const out=process.env.DASHBOARD_TEST_OUTPUT||path.join(require('os').tmpdir(),'raiz-dashboard-tests');fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true}),errors=[],writes=[],screens=[],failedAssets=[];
 try{
 const ctx=await browser.newContext({viewport:{width:1440,height:1000}});
 await ctx.route('**/*.supabase.co/**',r=>{
  const req=r.request(),u=new URL(req.url());if(!['GET','HEAD'].includes(req.method())&&!u.pathname.includes('/auth/')){writes.push(u.pathname);return r.fulfill({status:403,json:{error:'Dashboard tests are read-only'}});}
  return r.fulfill({json:u.pathname.includes('/auth/')?{}:[]});
 });
 await ctx.route(base+'/api/**',r=>{writes.push(r.request().url());return r.fulfill({status:403,json:{error:'No API operations allowed'}});});
 if(!production)await ctx.route(base+'/**',r=>{const u=new URL(r.request().url()),f=path.resolve(root,'.'+decodeURIComponent(u.pathname==='/'?'/index.html':u.pathname));if(!f.startsWith(path.resolve(root)+path.sep)||!fs.existsSync(f))return r.fulfill({status:404,body:''});return r.fulfill({path:f,contentType:f.endsWith('.js')?'text/javascript':f.endsWith('.css')?'text/css':f.endsWith('.html')?'text/html':undefined});});
 const page=await ctx.newPage();page.on('pageerror',e=>{errors.push(e.message);console.error(e.message);});
 page.on('response',r=>{if(r.status()>=400&&new URL(r.url()).pathname.startsWith('/assets/'))failedAssets.push({url:r.url(),status:r.status()});});
 page.on('console',m=>{if(['error','warning'].includes(m.type()))console.error(m.type()+': '+m.text());});
 await page.goto(base,{waitUntil:'networkidle'});
 await page.evaluate(()=>{
  currentProfile={id:'test-owner',role:'admin',aprovado:true,email:'owner@example.test'};currentUser={id:'test-owner'};
  document.getElementById('login-screen').style.display='none';document.getElementById('app').style.display='flex';document.getElementById('lo').style.display='none';
  const pay=(st,v,venc,ben,extra={})=>({st,v,venc,ben,ref:'TR 123456 · Materiais da obra',cat:'outros',pagn:'Raiz',emissao:venc,pagaEm:st==='PAGO'?venc:'',nfDocs:[],compDocs:[],docs:[],escopoFin:'obra',...extra});
  const common={constr:'Construtora Exemplo',contratado:500000,aditivos_contrato:[{valor:20000,motivo:'Ajuste',data:'2026-08-01'}],investimento_disponivel:650000,teto_escola:50000,aportado:150000,pago:0,taxa:{total:0,pago:0},contratos:[],construtoras:[],unidades_obra:[],aportes:[{inv:'Investidor A',v:150000,d:'2026-07-01'}],status:'Em andamento',fases_obra:{fases:[{id:'f00',itens:[{id:'f00_i00',status:'done'},{id:'f00_i01',status:'not_done',notDoneReason:'Não aplicável'}]}]}};
  obras=[{...common,id:1,nome:'Sá Pereira Recreio',marca:'SÁ PEREIRA',esfera:'nova',pag:[pay('PAGO',120000,'2026-08-15','Fornecedor A',{pagn:'Investidor A'}),pay('PENDENTE',20000,'2026-09-10','Fornecedor B'),pay('PENDENTE',5000,'2026-10-05','Fornecedor A',{escopoFin:'extra'}),pay('PENDENTE',500,'','Fornecedor C'),pay('CANCELADO',999999,'2026-01-01','Fornecedor A')]},{...common,id:2,nome:'Matriz Recreio Américas',marca:'MATRIZ',esfera:'nova',pag:[pay('PAGO',80000,'2026-07-15','Fornecedor A'),pay('ATRASADO',3000,'2026-09-01','Fornecedor D')]},{...common,id:3,nome:'QI Tijuca',marca:'QI',esfera:'expansao',pag:[]}];
  unidades=[{id:'u1',nome:'Cubo Marapendi',marca:'CUBO',docs:{contratos:[{name:'Contrato.pdf'}]},endereco:'Rio de Janeiro'},{id:'u2',nome:'Apogeu Cidade Alta',marca:'APOGEU',docs:{},endereco:'Juiz de Fora'},{id:'u3',nome:'Sá Pereira Recreio',marca:'SÁ PEREIRA',docs:{}}];
  capexItens=[{id:'c1',ano:2026,unidade:'Cubo Marapendi',marca:'CUBO',pedido:'Equipamentos esportivos',referencia:'TR 200164',situacao:'Em Andamento',orcamento:8000,setor:'COMPRAS'},{id:'c2',ano:2026,unidade:'Cubo Marapendi',marca:'CUBO',pedido:'Mobiliário',referencia:'TR 200165',situacao:'Resolvido',orcamento:23000,setor:'COMPRAS'},{id:'c3',ano:2026,unidade:'Apogeu Cidade Alta',marca:'APOGEU',pedido:'Cotação sem valor',referencia:'TR 200586',situacao:'Em Andamento',orcamento:0,setor:'COMPRAS'},{id:'c4',ano:2025,unidade:'Cubo Marapendi',marca:'CUBO',pedido:'Cancelado',situacao:'Cancelado',orcamento:999999},{id:'c5',ano:2026,unidade:'Sá Pereira Recreio',marca:'SÁ PEREIRA',pedido:'Material sem verba cadastrada',situacao:'Resolvido',orcamento:15000}];
  capexSaldos=[{ano:2026,unidade:'Cubo Marapendi',marca:'CUBO',valor:25000},{ano:2026,unidade:'Apogeu Cidade Alta',marca:'APOGEU',valor:183432}];capexDataLoaded=true;capexDataLoading=false;
  investidores=[{id:'i1',nome:'Investidor A'}];
  realEstateImoveis=[{id:'11111111-1111-4111-8111-111111111111',nome:'Rua da Matriz, 25',unidade_ocupante:'Sá Pereira Matriz',marca:'SÁ PEREIRA',endereco:'Rua da Matriz, 25 - Botafogo',locador:'Locador Exemplo',status:'Ativo',valor_aluguel:155622.02,contrato_docs:[],obrigacoes:[],investidores:[],observacoes:'',contrato_fim:'2026-12-01'},{id:'22222222-2222-4222-8222-222222222222',nome:'Encerrado',unidade_ocupante:'Matriz',marca:'MATRIZ',status:'Encerrado',valor_aluguel:10000,contrato_docs:[],obrigacoes:[],investidores:[]}];
  realEstateSublocacoes=[{id:'33333333-3333-4333-8333-333333333333',marca:'CUBO',unidade:'Barra Golfe',sublocatario:'Operador Exemplo',tipo:'Cantina',status:'Atencao',valor_referencia:1188,revisao_pendente:true,cobrancas:[],divergencias:[]}];
  capexZeevLoaded=true;AccessControl.syncUi();
 });
 async function shot(name){await page.locator('.main').evaluate(e=>e.scrollTop=0);await page.locator('.view.active img,#sidebar img').evaluateAll(es=>Promise.all(es.filter(e=>e.getBoundingClientRect().top<innerHeight).map(e=>e.decode().catch(()=>{}))));await page.screenshot({path:out+'/'+prefix+'-'+name+'.png'});screens.push(name);}
 async function checkLayout(name){const overflow=await page.evaluate(()=>[...document.querySelectorAll('.view.active .dash-shell,.view.active .dash-metrics')].filter(e=>e.getBoundingClientRect().width>0).filter(e=>e.getBoundingClientRect().right>innerWidth+2).map(e=>e.className));assert.deepEqual(overflow,[],name+' overflow');}
 async function unfilled(selector){
  const painted=await page.locator(selector).evaluateAll(es=>es.filter(e=>e.getBoundingClientRect().width>0).filter(e=>{const s=getComputedStyle(e);return s.backgroundImage!=='none'||s.backgroundColor!=='rgba(0, 0, 0, 0)';}).map(e=>e.className));
  assert.deepEqual(painted,[],selector+' must not paint colored panels');
 }
 async function brandedRecord(selector){
  const styles=await page.locator(selector).evaluateAll(es=>es.filter(e=>e.getBoundingClientRect().width>0).map(e=>{const s=getComputedStyle(e),rail=e.querySelector('.uc-bar');return {background:s.backgroundColor,image:s.backgroundImage,border:s.borderTopWidth,radius:s.borderTopLeftRadius,railWidth:rail?getComputedStyle(rail).width:getComputedStyle(e,'::before').width};}));
  assert(styles.length>0,selector+' must be rendered');
  for(const s of styles){assert.match(s.image,/linear-gradient\(135deg,.*132%\)/,selector+' must use the school document gradient');assert.equal(s.border,'1px');assert.equal(s.radius,'10px');assert.equal(s.railWidth,'5px');}
 }
 const hub=page.locator('#dashboard-hub-body');
 await page.evaluate(()=>DashboardHub.open('capex',{year:'2026'}));await shot('capex-desktop');
 await unfilled('.dash-metrics,.dash-metric');
 async function fillsWorkspace(selector){
  const widths=await page.locator(selector).evaluate(e=>({content:e.getBoundingClientRect().width,available:document.querySelector('.main').clientWidth}));
  assert(widths.available-widths.content<=42,selector+' leaves unused horizontal space');
 }
 for(const width of [1920,2560]){
  await page.setViewportSize({width,height:1080});await fillsWorkspace('#view-dashboards');await checkLayout('wide-'+width);await shot('capex-wide-'+width);
  assert.equal(await page.locator('.dash-metric').first().evaluate(e=>getComputedStyle(e).borderTopWidth),'0px');
  assert.equal(await page.locator('.dash-table-wrap').first().evaluate(e=>getComputedStyle(e).borderLeftWidth),'0px');
 }
 await page.setViewportSize({width:1440,height:1000});
 assert.match(await hub.locator('.dash-metrics').innerText(),/46\.000,00/);
 await page.locator('[data-hub-filter=brand]').selectOption('CUBO');assert.match(await hub.locator('.dash-metrics').innerText(),/31\.000,00/);await shot('capex-brand');
 assert.equal(await page.locator('#view-dashboards').evaluate(e=>e.style.getPropertyValue('--hub-color')),'#08B8A8');
 await page.locator('[data-hub-filter=unit]').selectOption('Cubo Marapendi');assert.match(await hub.locator('.dash-metrics').innerText(),/-R\$\s*6\.000,00/);
 await page.getByRole('button',{name:'Abrir pedidos',exact:true}).click();assert.equal(await page.evaluate(()=>capexListStatus),'Em Andamento');
 assert.equal(await page.locator('.view.active .dash-metrics').count(),0);assert.match(await page.locator('#esf-capex-drill').innerText(),/Equipamentos esportivos/);
 await page.getByRole('button',{name:'Voltar aos dashboards',exact:true}).click();assert.equal(await page.locator('[data-hub-filter=unit]').inputValue(),'Cubo Marapendi');
 await page.evaluate(()=>DashboardHub.open('nova',{}));assert.match(await hub.locator('.dash-metrics').first().innerText(),/200\.000,00/);await shot('works-desktop');
 await page.locator('[data-hub-filter=brand]').selectOption('MATRIZ');assert.match(await hub.locator('.dash-metrics').first().innerText(),/80\.000,00/);
 await page.locator('[data-hub-filter=brand]').selectOption('');await page.locator('[data-hub-filter=project]').selectOption('1');await shot('project-desktop');assert.match(await hub.locator('.dash-metrics').first().innerText(),/379\.500,00/);
 await hub.locator('[data-dash-change=project-year]').selectOption('2026');await page.locator('[data-hub-filter=project]').selectOption('2');assert.equal(await hub.locator('[data-dash-change=project-year]').inputValue(),'');
 await page.locator('[data-hub-records]').click();assert.equal(await page.locator('#pane-pag').evaluate(e=>e.classList.contains('active')),true);assert.equal(await page.locator('#o-kpis').innerText(),'');
 assert.equal(await page.locator('#pane-resumo').isVisible(),false);await page.getByRole('button',{name:'Fora da obra',exact:true}).click();assert.equal(await page.evaluate(()=>pagEscopo),'extra');await page.getByRole('button',{name:'Dentro da obra',exact:true}).click();assert.equal(await page.evaluate(()=>pagEscopo),'obra');
 await page.getByRole('button',{name:'Cadastro e aportes',exact:true}).click();assert(await page.getByRole('button',{name:'Registrar depósito',exact:true}).isVisible());
 await page.evaluate(()=>{go('nova');esfFiltroMarca='MATRIZ';esfBusca='Recreio';renderEsfera();go('escolas');go('nova');});assert.equal(await page.evaluate(()=>esfFiltroMarca),'MATRIZ');assert.equal(await page.evaluate(()=>esfBusca),'Recreio');
 await page.evaluate(()=>go('expansao'));assert.equal(await page.evaluate(()=>esfFiltroMarca),'Todas');
 const panels=['capex','nova','expansao','cobranca','forn','investidores','escolas','realestate_locacoes','realestate_sublocacoes','registros'];
 for(const panel of panels){await page.evaluate(p=>DashboardHub.open(p,{}),panel);await checkLayout(panel);await unfilled('.dash-metrics,.dash-metric');await shot(panel+'-desktop');assert(!/NaN|undefined/.test(await hub.innerText()));}
 await page.evaluate(()=>DashboardHub.open('realestate_locacoes',{brand:'MATRIZ'}));assert.match(await hub.locator('.dash-metrics').innerText(),/0 não encerrados/);
 await page.evaluate(()=>{go('realestate');document.getElementById('realestate-search').value='Unrelated previous query';document.getElementById('realestate-review-filter').checked=true;DashboardHub.open('realestate_locacoes',{brand:'MATRIZ'});DashboardHub.records();});assert.equal(await page.locator('#realestate-search').inputValue(),'');assert.equal(await page.locator('#realestate-review-filter').isChecked(),false);assert.equal(await page.locator('#re-brand-filter').inputValue(),'MATRIZ');
 await page.evaluate(()=>DashboardHub.open('realestate_locacoes',{brand:'SÁ PEREIRA'}));await hub.getByRole('button',{name:'Sá Pereira Matriz',exact:true}).click();await page.waitForFunction(()=>document.getElementById('realestate-property-view').hidden===false);assert.equal(await page.locator('#nav button.active').getAttribute('data-nav'),'realestate');
 await page.setViewportSize({width:2560,height:1080});await fillsWorkspace('.re-property-page');await shot('property-wide');await page.setViewportSize({width:1440,height:1000});
 await page.getByRole('button',{name:'Voltar aos dashboards',exact:true}).click();assert.equal(await page.locator('[data-hub-filter=brand]').inputValue(),'SÁ PEREIRA');
 await page.evaluate(()=>DashboardHub.open('forn',{brand:'MATRIZ'}));await page.locator('[data-hub-records]').click();assert.equal(await page.locator('[data-dash-change=records-brand-forn]').inputValue(),'MATRIZ');assert.doesNotMatch(await page.locator('#forn-grid').innerText(),/Fornecedor B/);
 await page.evaluate(()=>DashboardHub.open('capex',{year:'2026',brand:'CUBO'}));const hubHash=await page.evaluate(()=>location.hash);await page.evaluate(()=>go('escolas'));await page.goBack();await page.waitForFunction(()=>DashboardHub.active());assert.equal(await page.evaluate(()=>location.hash),hubHash);
 await page.goForward();await page.waitForFunction(()=>document.getElementById('view-escolas').classList.contains('active'));
 await page.evaluate(()=>{location.hash='#dashboards/capex?year=2026&brand=CUBO&unit=Cubo+Marapendi';});await page.waitForFunction(()=>DashboardHub.active()&&DashboardHub.scope().unit==='Cubo Marapendi');
 for(const view of ['capex','nova','expansao','cobranca','forn','investidores','escolas','realestate']){await page.evaluate(v=>go(v),view);assert.equal(await page.locator('.view.active .dash-metrics').count(),0,view+' must remain operational');assert.equal(await page.locator('#nav button.active').getAttribute('data-nav'),view);await shot('records-'+view);}
 const property=page.locator('.re-property-card:visible').first(),grid=page.locator('.re-property-grid:visible').first();
 await page.mouse.move(0,0);await brandedRecord('.re-property-card');
 assert(Math.abs((await property.boundingBox()).width-(await grid.boundingBox()).width)<2,'Single property must fill its row');
 for(const [name,brand,unit]of [['brands',null,null],['units','CUBO',null],['requests','CUBO','Cubo Marapendi']]){
  await page.evaluate(({brand,unit})=>{go('capex');drillCapex(2026,brand,unit);},{brand,unit});await shot('capex-'+name);
  await brandedRecord('.capex-brand-card,.capex-unit-card,.capex-expander-card');
  if(name==='brands')assert((await page.locator('.capex-brand-card').evaluateAll(es=>new Set(es.map(e=>getComputedStyle(e).backgroundImage)).size))>1,'School cards must retain distinct brand gradients');
  if(name==='units'){
   const widths=await page.locator('.capex-unit-card').evaluate(e=>({card:e.getBoundingClientRect().width,grid:e.parentElement.getBoundingClientRect().width}));
   assert(Math.abs(widths.card-widths.grid)<2,'Single CAPEX unit must fill its row');
  }
  if(name==='requests'){
   const selector='#esf-capex-drill .capex-summary-actions .btn-primary:visible',editButtons=page.locator(selector);
   assert.equal(await editButtons.count(),2,'Both CAPEX edit actions must be rendered');
   await unfilled(selector);
   assert.deepEqual(await editButtons.evaluateAll(es=>es.map(e=>{const s=getComputedStyle(e);return {color:s.color,textShadow:s.textShadow};})),Array.from({length:2},()=>({color:'rgb(23, 60, 52)',textShadow:'none'})));
   const newRequest=page.getByRole('button',{name:/Novo pedido$/});
   assert.equal(await newRequest.evaluate(e=>getComputedStyle(e).backgroundColor),'rgb(8, 184, 168)','Primary actions outside CAPEX summaries must keep their brand fill');
   await editButtons.first().hover();
   await page.waitForFunction(()=>document.querySelector('#esf-capex-drill .capex-summary-actions .btn-primary').getAnimations().length===0);
   const hover=await editButtons.first().evaluate(e=>{const s=getComputedStyle(e);return {background:s.backgroundColor,image:s.backgroundImage,color:s.color,textShadow:s.textShadow};});
   assert.match(hover.background,/^rgba?\(255, 255, 255(?:, 0\.\d+)?\)$/,'CAPEX edit hover must remain neutral');
   assert.equal(hover.image,'none');assert.equal(hover.color,'rgb(23, 60, 52)');assert.equal(hover.textShadow,'none');
   await page.mouse.move(0,0);
   await page.waitForFunction(()=>document.querySelector('#esf-capex-drill .capex-summary-actions .btn-primary').getAnimations().length===0);
  }
 }
 await page.evaluate(()=>{go('capex');drillCapex(2024,null,null);});assert.equal(writes.length,0,'Historical navigation cannot update financial records');
 await page.setViewportSize({width:390,height:844});
 for(const panel of panels){await page.evaluate(p=>DashboardHub.open(p,{}),panel);await checkLayout(panel);await shot(panel+'-mobile');}
 for(const [view,selector]of [['escolas','.uni-card'],['capex','.capex-brand-card'],['realestate','.re-property-card']]){
  await page.evaluate(v=>{go(v);if(v==='capex')drillCapex(2026,null,null);if(v==='realestate'){realEstateArea='locacoes';RealEstateWorkspace.restoreFilters('locacoes',{brand:'',sort:'unit',attention:''});document.getElementById('realestate-search').value='';document.getElementById('realestate-review-filter').checked=false;renderRealEstate();}},view);
  await brandedRecord(selector);await shot('cards-'+view+'-mobile');
  if(view==='realestate')assert(await page.locator('#realestate-search').evaluate(e=>e.getBoundingClientRect().width>300),'Property search must occupy a full mobile row');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,view+' mobile overflow');
 }
 await page.evaluate(()=>openObra(1));await checkLayout('project');await shot('project-records-mobile');
 await page.evaluate(()=>{currentProfile={id:'test-reader',role:'reader',aprovado:true,access_config:{capex:'read',nova:'read'}};AccessControl.syncUi();DashboardHub.open('capex',{});});
 assert.deepEqual(await page.locator('[data-hub-filter=panel] option').evaluateAll(es=>es.map(e=>e.value)),['capex','nova']);
 await page.evaluate(()=>DashboardHub.open('realestate_locacoes',{}));assert.equal(await page.evaluate(()=>DashboardHub.panel()),'capex');
 await page.evaluate(()=>go('capex'));assert.equal(await page.locator('#esf-acts').evaluate(e=>e.hidden),true);await page.evaluate(()=>openObra(1));assert.equal(await page.getByRole('button',{name:'Registrar depósito',exact:true}).count(),0);
 await page.evaluate(()=>{
  currentProfile={role:'admin',aprovado:true};AccessControl.syncUi();
  const sample=obras[0],samples=[['QI','Colégio QI Recreio - Praça do Amor'],['SÁ PEREIRA','Sá Pereira Recreio'],['SARAH DAWSEY','Sarah Dawsey Tijuca'],['MATRIZ','Matriz Educação Cachambi'],['QI','Colégio QI Valqueire'],['LEONARDO DA VINCI','Colégio Leonardo da Vinci Alfa'],['MATRIZ','Matriz Educação Tijuca'],['CUBO','Cubo e Global Tree - Barra Golf'],['MATRIZ','Matriz Educação Recreio - Americas'],['AMERICANO','Colégio Americano Cabral'],['CUBO','Cubo Kids'],['CUBO','Cubo Global School Marapendi'],['APOGEU','Apogeu Global School Cidade Alta'],['LEONARDO DA VINCI','Colégio Leonardo da Vinci Alfa - Ginásio']];
  obras=samples.map(([marca,nome],i)=>({...sample,id:100+i,nome,marca,esfera:'nova',subtitulo_obra:i===10?nome:'',status:i%3===0?'Planejamento':i%3===1?'Em andamento':'Concluído',tem_construtora:i%2===0,construtoras:i%2===0?[]:['Construtora de Teste e Empreendimentos Imobiliários Ltda.'],pag:[]}));
  go('nova');esfFiltroMarca='Todas';esfBusca='';document.getElementById('esf-busca').value='';renderEsfera();
 });
 for(const width of [1920,1440,390]){
  await page.setViewportSize({width,height:width===390?844:1000});await shot('populated-works-'+width);await brandedRecord('.obra-card');
  const bounds=await page.locator('.obra-card').evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect();return {left:r.left,right:r.right,width:r.width};}));
  assert(bounds.every(r=>r.left>=0&&r.right<=width+1),'Work cards overflow '+width);
  assert.equal(await page.locator('#esf-desc').evaluate(e=>getComputedStyle(e).fontWeight),'400','Supporting text must not be forced bold');
  assert.equal(await page.locator('.obra-card').filter({hasText:'Cubo Kids'}).locator('.obra-card-unit-chip,.obra-card-subtitle').count(),0,'Do not repeat the work title as its unit or subtitle');
  if(width===1920){const top=await page.locator('#esf-grid').boundingBox();assert(top.y<340,'Search toolbar leaves excessive whitespace above records');}
 }
 await page.evaluate(()=>{currentProfile={role:'admin',aprovado:true};obras=[];capexItens=[];capexSaldos=[];capexDataLoaded=true;});
 for(const panel of panels){await page.evaluate(p=>DashboardHub.open(p,{}),panel);assert(!/NaN|undefined/.test(await hub.innerText()));}
 await page.evaluate(async()=>{DashboardHub.open('capex',{});const original=loadCapexData;capexDataLoaded=false;loadCapexData=async()=>{throw new Error('Simulated read failure');};await DashboardHub.render();loadCapexData=original;capexDataLoaded=true;});assert(await hub.getByRole('alert').isVisible());assert.equal(await hub.locator('.dash-metrics').count(),0);
 assert.deepEqual(errors,[]);assert.deepEqual(writes,[]);assert.deepEqual(failedAssets,[]);
 fs.writeFileSync(out+'/'+prefix+'-ui-validation.json',JSON.stringify({passed:true,errors,writes,screens,viewports:['2560x1080','1920x1080','1440x1000','390x844'],fixtureData:true},null,2));console.log('PASS dashboards: '+screens.length+' screenshots, full-width layouts, filters, read permissions, empty states; zero writes.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
