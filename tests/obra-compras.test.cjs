const fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  const context=await browser.newContext({viewport:{width:1440,height:1050}});
  await context.route('**/*',async r=>{
   const u=new URL(r.request().url());
   if(u.hostname.endsWith('supabase.co')||u.pathname.startsWith('/api/'))return r.fulfill({json:[]});
   if(u.hostname==='forms.test'){
    const file=path.resolve(root,'.'+(u.pathname==='/'?'/index.html':u.pathname));
    if(!file.startsWith(root+path.sep)||!fs.existsSync(file))return r.fulfill({status:404,body:''});
    return r.fulfill({path:file,contentType:file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html'});
   }
   if(r.request().method()!=='GET')return r.abort();
   return r.continue();
  });
  const page=await context.newPage();
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('https://forms.test',{waitUntil:'networkidle'});
  await page.evaluate(()=>{
   currentProfile={id:'e56ab877-62a8-4f2c-9ef8-55ab93fd51b9',role:'admin',aprovado:true};
   currentUser={id:currentProfile.id,email:'fixture@example.test'};
   AccessControl.canEdit=()=>true;
   document.getElementById('login-screen').style.display='none';
   document.getElementById('app').style.display='flex';
   document.getElementById('lo').style.display='none';
   obras=[{id:1,nome:'Obra de teste',esfera:'nova',pag:[]}];cur=obras[0];
   window.calls=[];window.alerts=[];window.rpcError=null;window.parent=null;
   toast=m=>alerts.push(m);
   capexCheckPendingBeforeSave=async()=>true;
   capexCaptureZeevReturnState=()=>{};
   renderCapexZeevCurrentView=()=>{};
   db.rpc=async(name,args)=>{calls.push({name,args});return rpcError?{error:{message:rpcError}}:{data:{id:1}};};
   db.from=()=>{
    const q={select:()=>q,eq:()=>q,order:()=>q,maybeSingle:async()=>({data:parent}),then:resolve=>Promise.resolve({data:[]}).then(resolve)};return q;
   };
   window.setup=async(kind='compra')=>{
    capexZeevSolicitacoes=[{id:1,zeev_instance_id:210804,flow_id:kind==='compra'?365:299,flow_name:kind==='compra'?'Solicitacao de compras':'Financeiro',status:'pendente',pedido:'Equipamentos para a unidade',_detailLoaded:true,valor:null,valor_final:null}];
    await openCapexZeevObraApproval(1);
    document.getElementById('zo-obra-id').value='1';updateZeevObraDerivedFields();
   };
  });
  await page.evaluate(()=>setup());
  assert.equal(await page.locator('#zo-data-title').textContent(),'Dados da compra');
  assert.equal(await page.locator('#zo-venc').isVisible(),false);
  assert.equal(await page.locator('#zo-compra-vinculada').isVisible(),false);
  assert.equal(await page.locator('#zo-ben').inputValue(),'');
  await page.screenshot({path:path.join(root,'tmp/forms-release/purchase-desktop.png'),animations:'disabled'});
  await page.evaluate(()=>saveCapexZeevObraApproval());
  let state=await page.evaluate(()=>({calls,status:capexZeevSolicitacoes[0].status,payments:obras[0].pag}));
  assert.equal(state.calls[0].name,'register_obra_compra');assert.equal(state.calls[0].args.p_valor,null);
  assert.equal(state.status,'aprovado');assert.equal(state.payments.length,0);
  console.log('PASS purchase without supplier/estimate does not create payment');
  await page.evaluate(async()=>{await setup();rpcError='Conflito concorrente';});
  await page.evaluate(()=>saveCapexZeevObraApproval());
  assert.equal(await page.evaluate(()=>capexZeevSolicitacoes[0].status),'pendente');
  assert.equal(await page.locator('#zo-save').isEnabled(),true);
  console.log('PASS failed save preserves queue and unlocks form');
  await page.evaluate(async()=>{rpcError=null;await setup('financeiro');document.getElementById('zo-ben').value='Fornecedor de teste';});
  assert.equal(await page.locator('#zo-venc').isVisible(),true);
  await page.evaluate(()=>saveCapexZeevObraApproval());
  assert.equal(await page.evaluate(()=>capexZeevSolicitacoes[0].status),'pendente');
  assert.match(await page.evaluate(()=>alerts.at(-1)),/valor.*maior que zero/i);
  console.log('PASS financial form requires a positive amount');
  await page.evaluate(()=>{parent={obra_id:2,escopo:'extra'};});
  assert.equal(await page.evaluate(()=>ObraCompras.validateLink('123',obras[0],'obra')),false);
  assert.equal(await page.evaluate(()=>capexZeevIsCompra({flow_id:299,request_name:'pagamento da compra'})),false);
  assert.equal(await page.evaluate(()=>capexZeevIsCompra({flow_id:365})),true);
  console.log('PASS purchase scope conflict blocked and finance classification retained');
  await page.setViewportSize({width:390,height:844});
  await page.evaluate(()=>setup());
  await page.screenshot({path:path.join(root,'tmp/forms-release/purchase-mobile.png'),animations:'disabled'});
  assert.equal(await page.locator('#capex-zeev-obra-overlay .modal').evaluate(el=>el.scrollWidth<=el.clientWidth+1),true);
  assert.equal(await page.locator('#zo-supplier-label').getAttribute('for'),'zo-ben');
  console.log('PASS mobile layout and accessible labels');
  assert.deepEqual(errors,[]);
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
