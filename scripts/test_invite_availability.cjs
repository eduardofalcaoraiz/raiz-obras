const {test,before,after}=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');
const {chromium}=require('playwright');
let browser;
before(async()=>{browser=await chromium.launch({channel:'chrome',headless:true});});
after(async()=>{await browser?.close();});
async function fixture(t){
 const page=await browser.newPage();t.after(()=>page.close());
 await page.route('https://invite.test/**',r=>r.fulfill({contentType:'text/html',body:'<div id="admin-users"></div>'}));
 await page.goto('https://invite.test');
 await page.addStyleTag({path:path.join(__dirname,'access-control.css')});
 await page.evaluate(()=>{
  window.currentProfile={id:'owner',email:'owner@example.test',role:'admin',aprovado:true};
  window.SUPA_URL='https://api.example.test';window.SUPA_ANON='public-test-key';
  window.db={auth:{getSession:async()=>({data:{session:{access_token:'synthetic-test-token'}}})},from:()=>({select:()=>({order:()=>({limit:async()=>({data:[]})})})})};
  window.statusRequests=[];window.mailRequests=0;
  window.fetch=async(url,init)=>{
   const body=JSON.parse(init.body);
   if(body.action!=='status'){mailRequests++;throw Error('Only status requests are allowed in this test');}
   return new Promise(resolve=>statusRequests.push(resolve));
  };
  window.finishStatus=(body,status=200)=>statusRequests.shift()(new Response(JSON.stringify(body),{status}));
 });
 await page.addScriptTag({path:path.join(__dirname,'access-control.js')});
 await page.addScriptTag({path:path.join(__dirname,'access-invites.js')});
 await page.evaluate(()=>AccessInvites.mount([currentProfile]));
 await page.waitForFunction(()=>statusRequests.length===1);
 return page;
}
async function fillDraft(page){
 await page.locator('#invite-name').fill('Pessoa de teste');
 await page.locator('#invite-email').fill('person@example.test');
 await page.locator('input[name=invite-capex][value=read]').check({force:true});
}
async function assertDraft(page){
 assert.equal(await page.locator('#invite-name').inputValue(),'Pessoa de teste');
 assert.equal(await page.locator('#invite-email').inputValue(),'person@example.test');
 assert(await page.locator('input[name=invite-capex][value=read]').isChecked());
 assert.equal(await page.evaluate(()=>mailRequests),0);
}
test('opening while status loads enables the existing dialog without losing the draft',async t=>{
 const p=await fixture(t);await p.evaluate(()=>AccessInvites.open());await fillDraft(p);
 assert(await p.locator('#invite-send').isDisabled());
 assert.match(await p.locator('#invite-availability').innerText(),/Verificando/);
 await p.evaluate(()=>finishStatus({emailEnabled:true}));
 await p.waitForFunction(()=>!document.getElementById('invite-send').disabled);
 assert(await p.locator('#invite-availability').isHidden());await assertDraft(p);
});
test('unavailable service can be checked again inside the same dialog',async t=>{
 const p=await fixture(t);await p.evaluate(()=>AccessInvites.open());await fillDraft(p);
 await p.evaluate(()=>finishStatus({emailEnabled:false}));await p.locator('#invite-check').waitFor({state:'visible'});
 assert(await p.locator('#invite-send').isDisabled());
 await p.locator('#invite-check').click();await p.waitForFunction(()=>statusRequests.length===1);
 await p.evaluate(()=>finishStatus({emailEnabled:true}));
 await p.waitForFunction(()=>!document.getElementById('invite-send').disabled);await assertDraft(p);
});
test('failed status shows the actual error and recovers without losing permissions',async t=>{
 const p=await fixture(t);await p.evaluate(()=>AccessInvites.open());await fillDraft(p);
 await p.evaluate(()=>finishStatus({error:'Sessao expirada. Entre novamente.'},401));
 await p.locator('#invite-check').waitFor({state:'visible'});
 assert.match(await p.locator('#invite-availability').innerText(),/Sessao expirada/);
 assert(await p.locator('#invite-send').isDisabled());
 await p.locator('#invite-check').click();await p.waitForFunction(()=>statusRequests.length===1);
 await p.evaluate(()=>finishStatus({emailEnabled:true}));
 await p.waitForFunction(()=>!document.getElementById('invite-send').disabled);await assertDraft(p);
});
test('reopening checks availability again rather than trusting a stale enabled state',async t=>{
 const p=await fixture(t);await p.evaluate(()=>finishStatus({emailEnabled:true}));
 await p.waitForFunction(()=>!document.querySelector('#admin-users .access-service-note'));
 await p.evaluate(()=>AccessInvites.open());await p.waitForFunction(()=>statusRequests.length===1);
 assert(await p.locator('#invite-send').isDisabled());
 await p.evaluate(()=>finishStatus({emailEnabled:false}));await p.locator('#invite-check').waitFor({state:'visible'});
 assert(await p.locator('#invite-send').isDisabled());
});
