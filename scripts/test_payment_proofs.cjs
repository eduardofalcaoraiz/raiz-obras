const fs=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const source=fs.readFileSync('index.html','utf8');
const code=source.slice(source.indexOf('function anexarComp('),source.indexOf('function anexarNF('));
async function run(failedUpload=false,failedSave=false){
  const old={name:'previous.pdf',storagePath:'previous',kind:'COMPROVANTE'};
  const payment={compDoc:old,docs:[old]};
  const input={files:[{name:'first.pdf',size:1},{name:'second.pdf',size:2}],click(){}};
  let saves=0;
  const notices=[];
  const context={obras:[{id:1,pag:[payment]}],document:{getElementById:()=>input},
    paymentDocUploadLocks:new Set(),toast:m=>notices.push(m),console,
    db:{auth:{getSession:async()=>({data:{session:{}}})}},ensurePaymentHeavyFields:async()=>{},
    inferType:()=> 'application/pdf',paymentFileSha256:async f=>f.name,
    paymentAllDocs:p=>p.docs,paymentDocsMatch:(a,b)=>a.sha256===b.sha256,
    replacePaymentDocKind:()=>{},uploadPagDoc:async(_,f)=>{if(failedUpload&&f.name==='first.pdf')throw Error('test failure');return f.name;},
    addPaymentDoc:(p,d)=>p.docs.push(d),persist:async()=>{saves++;return !failedSave;},cur:null,activePaymentDocs:null};
  vm.createContext(context);vm.runInContext(code,context);context.anexarComp(1,0);
  assert.equal(input.multiple,true);
  await input.onchange();
  assert.equal(payment.compDoc,old);
  assert.equal(context.paymentDocUploadLocks.size,0);
  assert.equal(payment.docs.length,failedUpload?2:3);
  assert.equal(saves,failedUpload?1:2);
  assert.equal(notices.at(-1).includes('Falha em:'),failedUpload||failedSave);
  if(!failedUpload&&!failedSave){await input.onchange();assert.equal(payment.docs.length,3);}
}
(async()=>{await run();await run(true);await run(false,true);console.log('Multiple proofs: preservation, duplicates, partial upload and persistence failures passed.');})().catch(e=>{console.error(e);process.exitCode=1;});

