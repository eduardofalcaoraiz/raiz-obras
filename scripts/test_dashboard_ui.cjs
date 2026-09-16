const fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),production=process.argv.includes('--production'),base=production?'https://raiz-obras.vercel.app':'https://dashboards.test';
const prefix=production?'production':'local';
const out=process.env.DASHBOARD_TEST_OUTPUT||path.join(require('os').tmpdir(),'raiz-dashboard-tests');fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true}),errors=[],writes=[],screens=[];
 try{
 const ctx=await browser.newContext({viewport:{width:1440,height:1000}});
 await ctx.route('**/*.supabase.co/**',r=>{
  const req=r.request(),u=new URL(req.url());if(!['GET','HEAD'].includes(req.method())&&!u.pathname.includes('/auth/')){writes.push(u.pathname);return r.fulfill({status:403,json:{error:'Dashboard tests are read-only'}});}
  return r.fulfill({json:u.pathname.includes('/auth/')?{}:[]});
 });
 await ctx.route(base+'/api/**',r=>{writes.push(r.request().url());return r.fulfill({status:403,json:{error:'No API operations allowed'}});});
 if(!production)await ctx.route(base+'/**',r=>{const u=new URL(r.request().url()),f=path.resolve(root,'.'+(u.pathname==='/'?'/index.html':u.pathname));if(!f.startsWith(path.resolve(root)+path.sep)||!fs.existsSync(f))return r.fulfill({status:404,body:''});return r.fulfill({path:f,contentType:f.endsWith('.js')?'text/javascript':f.endsWith('.css')?'text/css':f.endsWith('.html')?'text/html':undefined});});
 const page=await ctx.newPage();page.on('pageerror',e=>{errors.push(e.message);console.error(e.message);});
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
  AccessControl.start();
 });
 async function shot(name){await page.locator('.main').evaluate(e=>e.scrollTop=0);await page.screenshot({path:out+'/'+prefix+'-'+name+'.png'});screens.push(name);}
 async function checkLayout(name){const overflow=await page.evaluate(()=>[...document.querySelectorAll('.view.active .dash-shell,.view.active .dash-metrics')].filter(e=>e.getBoundingClientRect().width>0).filter(e=>e.getBoundingClientRect().right>innerWidth+2).map(e=>e.className));assert.deepEqual(overflow,[],name+' overflow');}
 await page.evaluate(()=>go('capex'));await page.locator('[data-dash-change=capex-year]').selectOption('2026');await shot('capex-desktop');
 assert.match(await page.locator('#esf-capex-drill .dash-metrics').innerText(),/46\.000,00/);
 await page.locator('[data-dash-change=capex-brand]').selectOption('CUBO');assert.match(await page.locator('#esf-capex-drill .dash-metrics').innerText(),/31\.000,00/);await shot('capex-brand');
 assert(await page.getByRole('button',{name:'Resumo da marca',exact:true}).isVisible());
 await page.locator('[data-dash-change=capex-unit]').selectOption('Cubo Marapendi');assert.match(await page.locator('#esf-capex-drill .dash-metrics').innerText(),/-R\$\s*6\.000,00/);
 await page.getByRole('button',{name:'Abrir pedidos',exact:true}).click();assert.equal(await page.evaluate(()=>capexListStatus),'Em Andamento');
 await page.evaluate(()=>go('nova'));await shot('works-desktop');assert.match(await page.locator('#esf-kpis').innerText(),/200\.000,00/);
 await page.evaluate(()=>{esfFiltroMarca='MATRIZ';renderEsfera();});assert.match(await page.locator('#esf-kpis').innerText(),/80\.000,00/);
 await page.evaluate(()=>openObra(1));await shot('project-desktop');assert.match(await page.locator('#o-kpis').innerText(),/379\.500,00/);
 await page.locator('#pane-resumo [data-dash-change=project-scope]').selectOption('extra');await page.locator('#pane-resumo [data-dash-change=project-scope]').selectOption('all');
 await page.locator('#pane-resumo [data-dash-change=project-year]').selectOption('2026');await page.evaluate(()=>openObra(2));assert.equal(await page.locator('[data-dash-change=project-year]').inputValue(),'');
 for(const view of ['cobranca','forn','investidores','escolas','realestate']){await page.evaluate(v=>go(v),view);await checkLayout(view);await shot(view+'-desktop');}
 await page.locator('#re-brand-filter').selectOption('MATRIZ');assert.match(await page.locator('#realestate-kpis').innerText(),/0 não encerrados/);
 await page.evaluate(()=>{realEstateArea='cantinas';renderRealEstate();});await shot('sublocacoes-desktop');
 await page.evaluate(()=>go('forn'));await page.locator('#forn-busca').fill('Fornecedor B');await page.locator('#forn-busca').dispatchEvent('input');assert.match(await page.locator('#forn-kpis').innerText(),/20\.000,00/);assert.doesNotMatch(await page.locator('#forn-kpis').innerText(),/200\.000,00/);
 await page.setViewportSize({width:390,height:844});
 for(const view of ['capex','nova','cobranca','forn','investidores','escolas','realestate']){await page.evaluate(v=>go(v),view);await checkLayout(view);await shot(view+'-mobile');}
 await page.evaluate(()=>openObra(1));await checkLayout('project');await shot('project-mobile');
 await page.evaluate(()=>{currentProfile={id:'test-reader',role:'reader',aprovado:true,access_config:{capex:'read',nova:'read',forn:'read'}};AccessControl.start();go('capex');});
 assert.equal(await page.locator('#esf-acts').evaluate(e=>e.hidden),true);await page.evaluate(()=>openObra(1));assert.equal(await page.getByRole('button',{name:'Registrar depósito',exact:true}).count(),0);
 await page.evaluate(()=>{currentProfile={role:'admin',aprovado:true};obras=[];capexItens=[];capexSaldos=[];capexDataLoaded=true;});
 for(const v of ['capex','nova','cobranca','forn','investidores']){await page.evaluate(v=>go(v),v);assert(!await page.locator('.view.active').innerText().then(t=>/NaN|undefined/.test(t)));}
 assert.deepEqual(errors,[]);assert.deepEqual(writes,[]);
 fs.writeFileSync(out+'/'+prefix+'-ui-validation.json',JSON.stringify({passed:true,errors,writes,screens,viewports:['1440x1000','390x844'],fixtureData:true},null,2));console.log('PASS dashboards: '+screens.length+' screenshots, filters, read permissions, empty states; zero writes.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
