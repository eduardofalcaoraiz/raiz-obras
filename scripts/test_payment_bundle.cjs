const fs=require('fs'),vm=require('vm'),assert=require('assert/strict'),path=require('path'),PDFLib=require('../vendor/pdf-lib/pdf-lib.min.js');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
for(const m of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi))if(m[1].trim())new vm.Script(m[1]);
const uploaded=new Map();let seq=0,fail=false;
const ctx={PDFLib,File,Blob,URL,console,crypto:require('crypto').webcrypto,inferType:n=>n.endsWith('.xml')?'application/xml':'application/pdf',capexZeevNormField:s=>String(s||'').toLowerCase().replace(/[^a-z0-9]/g,''),paymentDocUrlFileName:()=>'',paymentDocNorm:d=>d.name||'',paymentCompraLink:()=>null,cleanImpDocNumber:s=>s};
ctx.structuredClone=structuredClone;
vm.createContext(ctx);
for(const name of ['paymentDocKey','paymentDocLogicalName','paymentDocsMatch','isZeevAuditDocClient','normalizePaymentDocs','paymentDocKindLabel','paymentIsFiscalDoc','paymentIsProofDoc','hydratePaymentDocs','applyPaymentHeavyRow','paymentAllDocs','paymentFileSha256']){
 const re=new RegExp('(?:async )?function '+name+'\\('),start=html.search(re);assert(start>=0,name);
 const end=html.slice(start+1).search(/\n(?:async )?function /);vm.runInContext(html.slice(start,start+1+end),ctx);
}
ctx.uploadPagDoc=async(oid,file)=>{if(fail)throw Error('upload failed');const key=oid+'/'+(++seq)+'/'+file.name;uploaded.set(key,file);return key;};
ctx.db={storage:{from:()=>({download:async key=>({data:uploaded.get(key)})})}};
vm.runInContext(fs.readFileSync(path.join(__dirname,'payment-bundle.js'),'utf8'),ctx);
(async()=>{
const pdf=async(name,label,w)=>{const d=await PDFLib.PDFDocument.create();d.addPage([w,500]).drawText(label);return new File([await d.save()],name,{type:'application/pdf'});};
const nf=await pdf('NF-2730.pdf','NOTA',400),bol=await pdf('boleto.pdf','BOLETO',300),xml=new File(['<xml/>'],'nota.xml',{type:'application/xml'});
const result=await ctx.PaymentBundle.stage(5,{docs:[]},[bol,xml,nf]);assert.equal(result.docs.length,4);assert(result.nfDoc.generatedBundle);
assert(result.docs.some(d=>d.name==='nota.xml'));assert.equal(uploaded.size,4);
const merged=await PDFLib.PDFDocument.load(await uploaded.get(result.nfDoc.storagePath).arrayBuffer());assert.equal(merged.getPageCount(),2);assert.equal(merged.getPage(0).getWidth(),400);assert.equal(merged.getPage(1).getWidth(),300);
const reloaded=ctx.applyPaymentHeavyRow({}, {docs_json:result.docs,nf_doc_path:result.nfDoc.storagePath});assert(reloaded.nfDoc.generatedBundle);
const originalLoad=PDFLib.PDFDocument.load;
PDFLib.PDFDocument.load=async()=>{throw Error('Input document is encrypted');};
try{
 const protectedFile=new File(['protected fixture'],'NF-protegida.pdf',{type:'application/pdf'});
 const fallback=await ctx.PaymentBundle.stage(5,result,[protectedFile]);
 assert(fallback.bundleWarning.includes('protegido'));
 assert(!fallback.docs.some(d=>d.generatedBundle));
 assert(!fallback.nfDoc?.generatedBundle);
 for(const name of ['NF-2730.pdf','boleto.pdf','nota.xml','NF-protegida.pdf'])assert(fallback.docs.some(d=>d.name===name));
 ctx.obras=[{id:5,pag:[fallback]}];ctx.ensurePaymentHeavyFields=async()=>{};ctx.toast=()=>{};
 let opened=false;ctx.openPaymentDocsModal=async()=>{opened=true;};
 await ctx.PaymentBundle.open(5,0);assert(opened,'Protected PDFs open the original file list');
}finally{PDFLib.PDFDocument.load=originalLoad;}
const legacy={nfDoc:{name:'boleto.pdf',storagePath:'legacy/boleto.pdf'},docs:[]};ctx.hydratePaymentDocs(legacy);assert.equal(legacy.docs.length,1);assert.equal(legacy.docs[0].kind,'BOLETO');assert(!legacy.nfDoc);
fail=true;await assert.rejects(ctx.PaymentBundle.stage(5,{docs:[]},[nf]),/upload failed/);fail=false;
const before={id:7,docs_json:[],nf_doc_path:'',comp_doc_path:'',parcelas:[],itens_pag:[]};let patch;
ctx.db.from=()=>({select:()=>({eq(){return this;},single:async()=>({data:before})}),update:v=>{patch=v;return {eq(){return this;},is(){return this;},select:async()=>({data:[]})};}});
const p={dbId:7,docs:[],v:43500,st:'PAGO'};await assert.rejects(ctx.PaymentBundle.saveExisting(5,p,[nf,bol]),/outra sessao/);assert.equal(p.docs.length,0);assert.deepEqual(Object.keys(patch).sort(),['docs_json','nf_doc_path']);
console.log('PASS: PDFs unidos em ordem, XML e originais preservados, recarga, boleto legado, falha de upload e conflito sem perda de dados.');
})().catch(e=>{console.error(e);process.exitCode=1;});

