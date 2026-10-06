const fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  const context=await browser.newContext({viewport:{width:1440,height:1000}});
  await context.route('**/*',async r=>{
   const u=new URL(r.request().url());
   if(u.hostname.endsWith('supabase.co')||u.pathname.startsWith('/api/'))return r.fulfill({json:[]});
   if(u.hostname==='forms.test'){
    const file=path.resolve(root,'.'+(u.pathname==='/'?'/index.html':decodeURIComponent(u.pathname)));
    if(!file.startsWith(root+path.sep)||!fs.existsSync(file))return r.fulfill({status:404,body:''});
    return r.fulfill({path:file,contentType:file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.html')?'text/html':undefined});
   }
   if(r.request().method()!=='GET')return r.abort();
   return r.continue();
  });
  const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('https://forms.test',{waitUntil:'networkidle'});
  await page.evaluate(()=>{
   currentProfile={id:'e56ab877-62a8-4f2c-9ef8-55ab93fd51b9',role:'admin',aprovado:true};currentUser={id:currentProfile.id,email:'fixture@example.test'};
   AccessControl.canEdit=()=>true;
   document.getElementById('login-screen').style.display='none';document.getElementById('app').style.display='flex';document.getElementById('lo').style.display='none';
   obras=[{id:1,nome:'Obra teste',esfera:'nova',pag:[]}];cur=obras[0];
   window.alerts=[];window.saves=0;toast=m=>alerts.push(m);
   capexCheckPendingBeforeSave=async()=>true;capexCaptureZeevReturnState=()=>{};renderCapexZeevCurrentView=()=>{};
   persist=async()=>{saves++;};capexImportAllZeevDocsToPayment=async()=>0;
   db.from=()=>{const q={update:()=>q,eq:()=>q,then:resolve=>Promise.resolve({data:[],error:null}).then(resolve)};return q;};
   db.rpc=()=>{throw new Error('Unexpected change to persistence');};
   window.setup=async(flow=365)=>{
    capexZeevSolicitacoes=[{id:1,zeev_instance_id:210804,flow_id:flow,flow_name:flow===365?'Compras':'Financeiro',status:'pendente',pedido:'Equipamentos',_detailLoaded:true,valor:null,valor_final:null}];
    await openCapexZeevObraApproval(1);document.getElementById('zo-obra-id').value='1';setZeevObraEscopo('extra');
   };
  });
  await page.evaluate(()=>setup());
  assert.equal(await page.locator('[data-tab="compras"]').count(),0);
  assert.equal(await page.locator('#zo-data-title').textContent(),'Dados da compra');
  assert.equal(await page.locator('#zo-venc').isVisible(),true);
  assert.equal(await page.locator('#zo-compra-vinculada').isVisible(),false);
  await page.evaluate(()=>saveCapexZeevObraApproval());
  const state=await page.evaluate(()=>({p:obras[0].pag,status:capexZeevSolicitacoes[0].status,saves,alerts}));
  assert.equal(state.p.length,1,JSON.stringify(state));assert.equal(state.p[0].ticketRaiz,'210804');assert.equal(state.p[0].escopoFin,'extra');assert.equal(state.p[0].st,'PENDENTE');assert.equal(state.p[0].v,0);assert.equal(state.status,'aprovado');assert.equal(state.saves,1);
  console.log('PASS purchase creates original payment row, pending and outside project');
  await page.evaluate(()=>setup());await page.evaluate(()=>saveCapexZeevObraApproval());
  assert.equal(await page.evaluate(()=>obras[0].pag.length),1);
  console.log('PASS repeated purchase updates existing row');
  await page.evaluate(()=>setup(299));
  assert.equal(await page.locator('#zo-compra-vinculada').isVisible(),true);
  await page.evaluate(()=>{
   document.getElementById('zo-ben').value='Fornecedor';document.getElementById('zo-val').value='100,00';
   document.getElementById('zo-compra-vinculada').checked=true;document.getElementById('zo-compra-tr').value='123';
   capexCompraLinkPayloadAsync=async tr=>({tr});
  });
  await page.evaluate(()=>saveCapexZeevObraApproval());
  assert.equal(await page.evaluate(()=>paymentCompraLink(obras[0].pag[0]).tr),'123');
  console.log('PASS financial ticket retains original purchase-link persistence');
  await page.setViewportSize({width:390,height:844});await page.evaluate(()=>setup());
  assert.equal(await page.locator('#capex-zeev-obra-overlay .modal').evaluate(el=>el.scrollWidth<=el.clientWidth+1),true);
  await page.screenshot({path:path.join(root,'tmp/forms-release/restored-form.png'),animations:'disabled'});
  assert.deepEqual(errors,[]);console.log('PASS mobile form and no runtime errors');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
