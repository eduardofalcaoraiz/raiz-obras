const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const {stripTypeScriptTypes}=require('node:module');
const source=fs.readFileSync('supabase/functions/zeev-capex-sync/index.ts','utf8');
function extract(name){const start=source.indexOf('async function '+name+'(');return stripTypeScriptTypes(source.slice(start,source.indexOf('\n}',start)+2));}
test('report requests signed URLs on the first successful attempt',async()=>{
 let calls=0;const ctx=vm.createContext({URL,JSON,zeevToken:()=> 'test',env:(_,d)=>d,hasFormFields:r=>!!r.formFields?.length,
 zeevJsonRequest:async(url,init)=>{calls++;const body=JSON.parse(init.body);assert.equal(body.allowOpenUrlsForFilesInForm,true);assert.equal(body.useCache,false);assert.deepEqual(body.formFieldNames,['anexo']);return [{id:198911,formFields:[{name:'anexo',openUrl:'signed'}]}];}});
 vm.runInContext(extract('zeevInstanceReport'),ctx);const row=await ctx.zeevInstanceReport(198911,365,['anexo']);assert.equal(row.id,198911);assert.equal(calls,1);
});
test('login HTML is not accepted as a downloaded file',async()=>{
 let calls=0;const ctx=vm.createContext({URL,Headers,Set,zeevTokens:()=>['test'],BAD_ZEEV_TOKENS:new Set(),env:(_,d)=>d,responseText:r=>r.text(),summarizeZeevErrors:e=>e.join(';'),
 zeevFetchWithTimeout:async()=>{calls++;return new Response('<html>Login</html>',{headers:{'content-type':'text/html'}});}});
 vm.runInContext(extract('zeevBinaryRequest'),ctx);await assert.rejects(ctx.zeevBinaryRequest('https://raizeducacao.zeev.it/document/download/test.pdf?c=test'),/HTML/);assert.equal(calls,2);
});
test('valid signed PDF downloads without a browser cookie',async()=>{
 const ctx=vm.createContext({URL,Headers,Set,zeevTokens:()=>['test'],BAD_ZEEV_TOKENS:new Set(),env:(_,d)=>d,
 zeevFetchWithTimeout:async(url,init)=>{assert.equal(init.headers.has('Cookie'),false);return new Response('%PDF-test',{headers:{'content-type':'application/pdf'}});}});
 vm.runInContext(extract('zeevBinaryRequest'),ctx);assert.equal(await (await ctx.zeevBinaryRequest('https://raizeducacao.zeev.it/document/download/test.pdf?c=test')).text(),'%PDF-test');
});
