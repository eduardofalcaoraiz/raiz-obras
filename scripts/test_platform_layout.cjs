const fs=require('fs'),path=require('path'),assert=require('assert/strict'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),base='https://usability.test',out=process.env.USABILITY_OUTPUT||path.join(require('os').tmpdir(),'raiz-usability');fs.mkdirSync(out,{recursive:true});
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true}),errors=[],writes=[],issues=[],shots=[];try{
 const ctx=await browser.newContext({viewport:{width:1440,height:960}});
 await ctx.route('**/*.supabase.co/**',r=>{if(!['GET','HEAD'].includes(r.request().method())&&!r.request().url().includes('/auth/'))writes.push(r.request().url());return r.fulfill({json:r.request().url().includes('/auth/')?{}:[]});});
 await ctx.route(base+'/**',r=>{const u=new URL(r.request().url()),file=path.resolve(root,'.'+(u.pathname==='/'?'/index.html':decodeURIComponent(u.pathname)));if(u.pathname.startsWith('/api/')){writes.push(u.pathname);return r.fulfill({status:403,body:''});}if(!file.startsWith(root+path.sep)||!fs.existsSync(file))return r.fulfill({status:404,body:''});return r.fulfill({path:file,contentType:file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':undefined});});
 const page=await ctx.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(base,{waitUntil:'networkidle'});
 await page.evaluate(()=>{
  currentProfile={id:'e56ab877-62a8-4f2c-9ef8-55ab93fd51b9',role:'admin',aprovado:true,email:'test@example.test'};currentUser={id:currentProfile.id};
  document.getElementById('login-screen').style.display='none';document.getElementById('app').style.display='flex';document.getElementById('lo').style.display='none';
  const common={contratado:500000,investimento_disponivel:650000,aditivos_contrato:[],teto_escola:50000,aportado:100000,pago:0,taxa:{total:0,pago:0},contratos:[],construtoras:[],unidades_obra:[],aportes:[],status:'Em andamento',fases_obra:{fases:[]}};
  obras=[{...common,id:1,nome:'Escola Sa Pereira Recreio',marca:'SÁ PEREIRA',esfera:'nova',pag:[{st:'PENDENTE',v:12000,venc:'2026-09-30',ben:'Fornecedor de materiais e equipamentos',ref:'TR 204065',cat:'outros',pagn:'Raiz',emissao:'2026-09-01',nfDocs:[],compDocs:[],docs:[],escopoFin:'obra'}]},{...common,id:2,nome:'Matriz Recreio Americas',marca:'MATRIZ',esfera:'expansao',pag:[]}];
  unidades=[{id:'u1',nome:'Cubo Global School Marapendi',marca:'CUBO',docs:{},endereco:'Rio de Janeiro'},{id:'u2',nome:'Apogeu Global School Cidade Alta',marca:'APOGEU',docs:{},endereco:'Juiz de Fora'}];
  capexItens=[{id:1,ano:2026,unidade:'Cubo Global School Marapendi',marca:'CUBO',pedido:'Aquisicao de equipamentos esportivos e mobiliario para a unidade escolar',referencia:'204065',ticket_raiz_instance_id:204065,situacao:'Em Andamento',orcamento:12689.97,setor:'COMPRAS'},{id:2,ano:2026,unidade:'Cubo Global School Marapendi',marca:'CUBO',pedido:'Notebook para atendimento e matriculas',referencia:'204066',situacao:'Resolvido',orcamento:3200,setor:'COMPRAS'}];
  capexSaldos=[{ano:2026,unidade:'Cubo Global School Marapendi',marca:'CUBO',valor:100000}];capexDataLoaded=true;capexZeevLoaded=true;
  investidores=[{id:'i1',nome:'Investidor de teste'}];realEstateImoveis=[{id:'11111111-1111-4111-8111-111111111111',nome:'Rua da Matriz, 25',unidade_ocupante:'Sa Pereira Matriz',marca:'SÁ PEREIRA',endereco:'Rua da Matriz, 25 - Botafogo',locador:'Locador de teste',status:'Ativo',valor_aluguel:155622.02,contrato_docs:[],obrigacoes:[],investidores:[],observacoes:''}];realEstateSublocacoes=[];AccessControl.syncUi();
 });
 async function capture(name){await page.locator('.main').evaluate(e=>e.scrollTop=0);await page.screenshot({path:path.join(out,name+'.jpg'),type:'jpeg',quality:45});shots.push(name);const problems=await page.evaluate(()=>{
  const visible=e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0&&getComputedStyle(e).visibility!=='hidden';};
  const scope=document.querySelector('dialog[open],.overlay.show .modal,.view.active');if(!scope)return[];
  return [...scope.querySelectorAll('.capex-expander-summary,.phead,.party-card,.re-property-card,.hub-controls,.capex-tabs-shell,.capex-report-toolbar,.capex-navline,.fi,.btn,.modal,.modal-hd,.modal-ft')].filter(visible).filter(e=>!e.closest('table')).filter(e=>{const r=e.getBoundingClientRect();return r.width>innerWidth+2||r.left< -2||r.right>innerWidth+2;}).map(e=>({cls:e.className,text:e.textContent.trim().slice(0,55),width:Math.round(e.getBoundingClientRect().width)}));
 });if(problems.length)issues.push({name,problems});}
 for(const width of [1440,1024,390]){await page.setViewportSize({width,height:width<500?844:960});
  for(const view of ['escolas','nova','expansao','capex','forn','investidores','realestate','registros','cobranca']){await page.evaluate(v=>{go(v);if(v==='capex')drillCapex(2026,'CUBO','Cubo Global School Marapendi');},view);await capture(view+'-'+width);}
  await page.evaluate(()=>DashboardHub.open('capex',{}));await capture('dashboards-'+width);
  await page.evaluate(()=>{go('capex');drillCapex(2026,'CUBO','Cubo Global School Marapendi');CapexReviews.request(1);});await capture('review-'+width);await page.evaluate(()=>CapexReviews.close());
 }
 if(!process.argv.includes('--audit')){
  await page.evaluate(()=>{go('capex');drillCapex(2026,'CUBO','Cubo Global School Marapendi');capexSetListStatus('Resolvido');});
  const priority=await page.locator('.capex-unit-priority').innerText();assert.match(priority,/84\.110,03/);assert.match(priority,/15\.889,97/);
  await page.evaluate(()=>{capexSaldos=[];renderCapexDrill();});assert.match(await page.locator('.capex-unit-priority').innerText(),/Verba n\u00e3o cadastrada/);assert.match(await page.locator('.capex-unit-priority .priority-balance').innerText(),/A confirmar/);
  await page.evaluate(()=>{capexSaldos=[{ano:2026,unidade:'Cubo Global School Marapendi',marca:'CUBO',valor:0}];renderCapexDrill();});assert.equal(await page.locator('.priority-balance.is-negative').count(),1);
 }
 fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({errors,writes,issues,shots},null,2));console.log(JSON.stringify({errors,writes,issues,screenshots:shots.length,out}));assert.deepEqual(errors,[]);assert.deepEqual(writes,[]);if(!process.argv.includes('--audit'))assert.deepEqual(issues,[]);
 }finally{await browser.close();}})().catch(e=>{console.error(e.message);process.exitCode=1;});
