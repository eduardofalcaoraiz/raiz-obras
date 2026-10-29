const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const root=path.resolve(__dirname,'..'),production=process.argv.includes('--production');
const origin='https://raiz-obras.vercel.app',output=process.env.QI_QA_OUTPUT||path.join(root,'qa');
(async()=>{fs.mkdirSync(output,{recursive:true});const browser=await chromium.launch({channel:'chrome',headless:true});
try{const page=await browser.newPage(),errors=[],writes=[];
page.on('pageerror',e=>errors.push(e.message));
await page.route('**/*',r=>{const q=r.request(),u=new URL(q.url());
if(!['GET','HEAD'].includes(q.method())){writes.push(u.pathname);return r.abort();}
if(u.hostname.endsWith('supabase.co')||u.pathname.startsWith('/api/'))return r.fulfill({json:[]});
if(!production&&u.origin===origin){const f=path.resolve(root,'.'+decodeURIComponent(u.pathname==='/'?'/index.html':u.pathname));if(f.startsWith(root+path.sep)&&fs.existsSync(f)&&fs.statSync(f).isFile())return r.fulfill({path:f});}
return r.continue();});
await page.goto(origin,{waitUntil:'networkidle'});
assert.equal(await page.evaluate(()=>brandColor('QI')),'#F01830');
const report=await page.evaluate(()=>capexReportPrintableHtml({filters:{brand:'QI',start:'2026-01-01',end:'2026-12-31',year:2026,details:true},config:capexReportBrandConfig('QI'),units:[{marca:'QI',unidade:'QI Recreio',items:[],available:0,resolved:0,active:0,remaining:0}],available:0,resolved:0,active:0,remaining:0}));
assert.ok(report.includes('/assets/brands/colegio-qi-original.png'));
await page.evaluate(()=>{
const logo=()=>brandLogoImg('QI','height:24px;width:36px;object-fit:contain');
const parts=[
renderObraCard({id:5,nome:'QI Recreio',marca:'QI',status:'Em andamento',investimento_disponivel:9800000,contratado:0,construtoras:[{seq:1,nome:'Aldeias',valor:9300000}]},0),
'<div class="uni-card"><div class="uc-head"><span class="uc-logo">'+logo()+'</span><span>QI Recreio</span></div></div>',
'<div class="capex-brand-card"><div class="capex-brand-head"><div class="capex-brand-logo">'+logo()+'</div><h3>QI CAPEX</h3></div></div>',
'<div class="capex-unit-card"><div class="capex-unit-head"><div class="capex-unit-logo">'+logo()+'</div><h3>QI Recreio CAPEX</h3></div></div>',
'<div class="re-property-card"><div class="re-property-card-top"><span class="re-property-brand">'+logo()+'</span><span>Imovel QI</span></div></div>',
'<div class="party-card"><div class="party-brands"><span class="dash-brand">'+logo()+'</span></div><h3>Investidor QI</h3></div>',
'<div class="hub-identity">'+logo()+'<h3>Dashboard QI</h3></div>',
'<div class="capex-status-head"><div class="capex-status-logo">'+logo()+'</div><h3>Status CAPEX QI</h3></div>'
];
document.querySelectorAll('body link[rel="stylesheet"],body style').forEach(e=>document.head.appendChild(e));
document.body.innerHTML='<div id="app" style="display:block;width:100%;max-width:none"><main class="main" style="margin:0;width:100%;max-width:none;padding:16px"><div class="pgrid">'+parts.join('')+'</div></main></div>';
document.body.style.display='block';
document.body.style.overflow='auto';
document.querySelector('#app').style.height='auto';
Object.assign(document.querySelector('.main').style,{height:'auto',overflow:'visible'});
document.querySelectorAll('.pgrid>*').forEach(e=>{e.style.setProperty('--brand-cur',brandColor('QI'));e.style.setProperty('--capex-card-accent',brandColor('QI'));e.style.setProperty('--capex-card-soft',brandLight('QI'));});
});
for(const width of [1440,768,390,320]){
await page.setViewportSize({width,height:1100});await page.evaluate(()=>document.fonts.ready);
await page.locator('img').evaluateAll(imgs=>Promise.all(imgs.map(i=>i.decode())));
const checks=await page.locator('img[src*="colegio-qi-original.png"]').evaluateAll(imgs=>imgs.map(i=>{const r=i.getBoundingClientRect(),s=getComputedStyle(i);return {w:r.width,h:r.height,nw:i.naturalWidth,nh:i.naturalHeight,fit:s.objectFit,left:r.left,right:r.right,viewport:innerWidth};}));
assert.equal(checks.length,8);
for(const c of checks){assert.equal(c.nw,1920);assert.equal(c.nh,401);assert.equal(c.fit,'contain');assert.ok(c.w>=120,JSON.stringify(c));assert.ok(Math.abs(c.w/c.h-1920/401)<0.04,JSON.stringify(c));assert.ok(c.left>=0&&c.right<=width+1,JSON.stringify(c));}
await page.screenshot({path:path.join(output,(production?'production':'candidate')+'-qi-'+width+'.png'),fullPage:true,animations:'disabled'});
console.log('QI surfaces passed at '+width+'px');
}
await page.setViewportSize({width:1000,height:1200});
await page.setContent(report.replace('<head>','<head><base href="'+origin+'/">'));
await page.locator('img').evaluateAll(imgs=>Promise.all(imgs.map(i=>i.decode())));
assert.equal(await page.locator('img[src*="colegio-qi-original.png"]').count(),2);
await page.screenshot({path:path.join(output,(production?'production':'candidate')+'-qi-export.png'),fullPage:true});
assert.deepEqual(errors,[]);assert.deepEqual(writes,[]);
console.log('Print preview uses original QI on cover/detail; no page errors or writes.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
