const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),production=process.argv.includes('--production');
const base=production?'https://raiz-obras.vercel.app':'https://menu.test';
const output=process.env.MENU_TEST_OUTPUT||path.join(require('node:os').tmpdir(),'raiz-menu-tests');
fs.mkdirSync(output,{recursive:true});
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 const errors=[],writes=[];
 try{
  const context=await browser.newContext({viewport:{width:1440,height:1000}});
  await context.route('**/*.supabase.co/**',route=>{
   const req=route.request();if(!['GET','HEAD'].includes(req.method())&&!req.url().includes('/auth/'))writes.push(req.url());
   return route.fulfill({json:req.url().includes('/auth/')?{}:[]});
  });
  await context.route(base+'/api/**',route=>route.fulfill({status:403,json:{error:'Read-only UI test'}}));
  if(!production)await context.route(base+'/**',route=>{
   const url=new URL(route.request().url()),file=path.resolve(root,'.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));
   if(!file.startsWith(root+path.sep)||!fs.existsSync(file))return route.fulfill({status:404});
   return route.fulfill({path:file,contentType:file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.html')?'text/html':undefined});
  });
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base,{waitUntil:'networkidle'});
  await page.evaluate(()=>{
   currentProfile={id:'test-owner',nome:'Eduardo Falcao',role:'admin',aprovado:true};currentUser={id:'test-owner'};
   document.getElementById('login-screen').style.display='none';document.getElementById('lo').style.display='none';document.getElementById('app').style.display='flex';
   document.getElementById('foot-user-name').textContent='Eduardo Falcao';document.getElementById('nav-admin').style.display='flex';
   obras=[];investidores=[];realEstateImoveis=[];realEstateSublocacoes=[];
   unidades=[{id:'u1',nome:'Cubo Marapendi',marca:'CUBO',docs:{}},{id:'u2',nome:'Apogeu Cidade Alta',marca:'APOGEU',docs:{}}];
   capexDataLoaded=true;capexZeevLoaded=true;
   capexItens=[{id:'c1',ano:2026,marca:'CUBO',unidade:'Cubo Marapendi',pedido:'Mobiliario escolar',situacao:'Resolvido',orcamento:21000},{id:'c2',ano:2026,marca:'APOGEU',unidade:'Apogeu Cidade Alta',pedido:'Equipamentos',situacao:'Em Andamento',orcamento:16000}];
   capexSaldos=[{ano:2026,marca:'CUBO',unidade:'Cubo Marapendi',valor:140000},{ano:2026,marca:'APOGEU',unidade:'Apogeu Cidade Alta',valor:183432}];
   AccessControl.syncUi();applySideCollapsePreference();DashboardHub.open('capex',{year:2026});PlatformMenu.sync();
  });
  const nav=page.locator('#nav');
  async function counters(value='318'){
   await page.evaluate(v=>{const el=document.getElementById('nav-registros');el.textContent=v;el.style.display='inline-block';const b=document.getElementById('nav-cobr');b.textContent='8';b.style.display='inline-block';PlatformMenu.sync();},value);
  }
  async function shot(name){await page.locator('#sidebar img,.hub-identity img,.hub-brand-strip img').evaluateAll(es=>Promise.all(es.map(e=>e.decode().catch(()=>{}))));await page.screenshot({path:path.join(output,(production?'production-':'local-')+name+'.png'),animations:'disabled'});}
  async function geometry(){
   await page.waitForFunction(()=>{const s=document.getElementById('sidebar');return Math.abs(s.getBoundingClientRect().width-(s.classList.contains('collapsed')?78:Math.min(286,innerWidth<=768?innerWidth-28:286)))<.1;});
   const issues=await nav.locator('button:visible').evaluateAll(buttons=>buttons.flatMap(b=>{
    const label=b.querySelector('.nav-label'),badge=b.querySelector('.pill'),r=b.getBoundingClientRect(),l=label.getBoundingClientRect(),p=badge?.getBoundingClientRect();
    const issues=[];if(l.width&&p?.width&&l.right>p.left-3)issues.push(b.dataset.nav+' badge collision');
    if(l.width&&label.scrollWidth>label.clientWidth+1)issues.push(b.dataset.nav+' clipped label');
    if(r.right>innerWidth)issues.push(b.dataset.nav+' outside viewport');return issues;
   }));assert.deepEqual(issues,[]);
  }
  await counters();await geometry();await shot('desktop');
  assert.notEqual(await page.locator('.main').evaluate(e=>getComputedStyle(e).backgroundImage),'none');
  const sidebarGradient=()=>page.locator('#side-color-layer').evaluate(e=>getComputedStyle(e).backgroundImage);
  const raizGradient=await sidebarGradient();assert.match(raizGradient,/linear-gradient/);
  assert.equal(await page.locator('#side-color-layer').evaluate(e=>e.getBoundingClientRect().height),1000);
  assert.equal(await page.locator('#sidebar .brand b').evaluate(e=>getComputedStyle(e).color),'rgb(23, 60, 52)');
  for(const selector of ['.dash-metrics','#sidebar .nav button.active']){
   assert.match(await page.locator(selector).first().evaluate(e=>getComputedStyle(e).backgroundImage),/linear-gradient/,selector);
  }
  for(const selector of ['.hub-heading','.hub-controls','.dash-metric']){
   assert.equal(await page.locator(selector).first().evaluate(e=>getComputedStyle(e).borderTopWidth),'0px',selector+' must not be boxed');
  }
  assert.equal(await nav.locator('[aria-current=page]').count(),1);
  assert.equal(await nav.locator('[aria-current=page]').getAttribute('data-nav'),'dashboards');
  const masks=await page.locator('#sidebar .menu-icon').evaluateAll(es=>es.map(e=>getComputedStyle(e).maskImage));
  for(const mask of new Set(masks)){assert.notEqual(mask,'none');const url=mask.slice(5,-2);const response=await page.evaluate(async u=>{const r=await fetch(u);return {status:r.status,text:await r.text()};},url);assert.equal(response.status,200,url);assert.match(response.text,/<svg/);}
  await page.locator('[data-hub-filter=brand]').selectOption('CUBO');await shot('brand-cubo');
  assert.equal(await page.locator('#view-dashboards').evaluate(e=>e.style.getPropertyValue('--hub-color')),'#08B8A8');
  assert.equal(await page.locator('#sidebar').evaluate(e=>e.style.getPropertyValue('--side-art-color')),'#08B8A8');
  const cuboGradient=await sidebarGradient();assert.notEqual(cuboGradient,raizGradient);
  await page.locator('[data-hub-filter=brand]').selectOption('APOGEU');await shot('brand-apogeu');
  assert.notEqual(await sidebarGradient(),cuboGradient);
  await page.locator('[data-hub-filter=brand]').selectOption('');
  assert.equal(await sidebarGradient(),raizGradient);
  await page.locator('#side-collapse-btn').click();await counters();await shot('collapsed');
  assert.equal(await page.locator('#sidebar').evaluate(e=>e.getBoundingClientRect().width),78);
  assert.equal(await page.locator('#side-collapse-btn').getAttribute('aria-expanded'),'false');
  assert.match(await nav.locator('[data-nav=registros]').getAttribute('title'),/318/);
  await page.locator('#side-collapse-btn').click();
  await counters('123456');await geometry();await counters();
  for(const area of ['locacoes','cantinas']){
   await nav.locator('[data-nav-area='+area+']').click();
   assert.equal(await nav.locator('[aria-current=page]').count(),1);
   assert.equal(await nav.locator('[aria-current=page]').getAttribute('data-nav-area'),area);
   assert.equal(await page.evaluate(()=>realEstateArea),area);
  }
  await page.goBack();await page.waitForFunction(()=>realEstateArea==='locacoes');
  await page.goForward();await page.waitForFunction(()=>realEstateArea==='cantinas');
  await page.evaluate(()=>{
   currentProfile={role:'leitor',aprovado:true,access_config:{capex:'read',realestate_sublocacoes:'read'}};
   AccessControl.syncUi();PlatformMenu.sync();
  });
  assert.deepEqual(await nav.locator('[data-nav]:visible').evaluateAll(es=>es.map(e=>e.dataset.navArea||e.dataset.nav)),['dashboards','capex','cantinas']);
  assert.deepEqual(await nav.locator('.nav-group:visible h2').allTextContents(),['Visao geral'.replace('ao','\u00e3o'),'Obras e CAPEX','Real Estate']);
  await page.evaluate(()=>PlatformMenu.openRealEstate('locacoes'));assert.equal(await page.evaluate(()=>realEstateArea),'cantinas');
  await shot('restricted');
  await page.evaluate(()=>{currentProfile={role:'admin',aprovado:true};AccessControl.syncUi();DashboardHub.open('capex',{year:2026});PlatformMenu.sync();});
  await page.setViewportSize({width:1280,height:720});await counters();await geometry();await shot('laptop');
  assert(await page.locator('#sidebar .btn-logout').isVisible());
  await nav.locator('[data-nav=admin]').scrollIntoViewIfNeeded();
  const bottom=await nav.locator('[data-nav=admin]').boundingBox(),footer=await page.locator('#sidebar .foot').boundingBox();assert(bottom.y+bottom.height<=footer.y+1);
  for(const width of [390,320]){
   await page.setViewportSize({width,height:844});
   assert.match(await page.locator('.mobile-topbar').evaluate(e=>getComputedStyle(e).backgroundImage),/linear-gradient/);
   assert.equal(await page.locator('.mobile-topbar .mobile-brand').evaluate(e=>getComputedStyle(e).color),'rgb(23, 60, 52)');
   await page.locator('#mobile-menu-trigger').click();await counters();await geometry();await shot('mobile-'+width);
   assert.equal(await page.locator('#sidebar').getAttribute('aria-modal'),'true');
   await page.locator('#sidebar .btn-logout').focus();await page.keyboard.press('Tab');assert(await page.locator('#sidebar .side-close-btn').evaluate(e=>e===document.activeElement));
   await page.keyboard.press('Shift+Tab');assert(await page.locator('#sidebar .btn-logout').evaluate(e=>e===document.activeElement));
   await page.keyboard.press('Escape');assert.equal(await page.locator('#mobile-menu-trigger').getAttribute('aria-expanded'),'false');
   assert(await page.locator('#mobile-menu-trigger').evaluate(e=>e===document.activeElement));
   await page.locator('#mobile-menu-trigger').click();await nav.locator('[data-nav-area=cantinas]').click();
   assert.equal(await page.locator('#mobile-menu-trigger').getAttribute('aria-expanded'),'false');
   assert.equal(await page.locator('#sidebar').evaluate(e=>e.inert),true);
   assert.equal(await page.locator('.main').evaluate(e=>e.inert),false);
  }
  await page.locator('#mobile-menu-trigger').click();await page.setViewportSize({width:1440,height:1000});
  assert.equal(await page.locator('.main').evaluate(e=>e.inert),false);
  assert.equal(await page.locator('#sidebar').evaluate(e=>e.inert),false);
  assert.deepEqual(errors,[]);assert.deepEqual(writes,[]);
  console.log(JSON.stringify({passed:true,production,output,errors,writes,checks:['groups','badge layout','icons','light gradients','brand colors','collapsed menu','permissions','Real Estate routing','history','mobile','keyboard','responsive resizing']}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
