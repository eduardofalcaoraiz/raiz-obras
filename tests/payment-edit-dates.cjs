const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{stripTypeScriptTypes}=require('node:module');
const nodes=new Map();function el(){return {value:'',checked:false,hidden:false,style:{},children:[],parentElement:{style:{},after(){}},replaceChildren(){this.children=[]},append(x){this.children.push(x)},querySelector(){return {}},querySelectorAll(){return []}};}
for(const id of ['pm-pag','pm-funding','pm-funding-enabled','pm-funding-body','pm-funding-manager','pm-funding-rows','pm-nf','pm-escopo'])nodes.set(id,el());
global.document={getElementById:id=>nodes.get(id)||null,createElement:el};
const F=require('../scripts/payment-funding.js');
for(const p of [null,{pagn:'Escola',funding:[]},{pagn:'Davelino',funding:[{name:'RE',percent:50},{name:'JP',percent:50}]}]){
 F.open(p,[{nome:'RE'},{nome:'JP'}],{id:16,pag:[]});assert.equal(nodes.get('pm-funding-rows').children.length,2);
}
const ts=fs.readFileSync(__dirname+'/../supabase/functions/zeev-capex-sync/index.ts','utf8');
const from=ts.indexOf('function dueDateFromTicket('),to=ts.indexOf('function dateFromAnyObject',from);
const ctx={fieldMap:fields=>new Map(fields.map(f=>[f.name,f.value])),firstField:(m,keys)=>keys.map(k=>m.get(k)).find(Boolean),dateOnly:v=>{let s=String(v||'');return /^\d{4}-\d{2}-\d{2}$/.test(s)?s:/^\d{2}\/\d{2}\/\d{4}$/.test(s)?s.split('/').reverse().join('-'):'';}};
vm.createContext(ctx);vm.runInContext(stripTypeScriptTypes(ts.slice(from,to)),ctx);
const due=ctx.dueDateFromTicket;
assert.equal(due({raw_fields:[{name:'dataDeVencimento',value:'27/11/2026'}]}),'2026-11-27');
assert.equal(due({raw_fields:[{name:'dataPagamento',value:'20/11/2026'}]}),'');
assert.equal(due({raw_fields:[{name:'dataDeVencimento',value:'27/11/2026'}],pagamento_json:{previsao_pagamento:'2026-11-20'}}),'2026-11-27');
assert.equal(due({pagamento_json:{dataVencimento:'invalid',previsao_pagamento:'2026-11-20'}}),'2026-11-20');
assert.equal(due({pagamento_json:{parcelas:[{vencimento:'20/11/2026'}]}}),'2026-11-20');
assert.equal(due({pagamento_json:{parcelas:[{vencimento:'20/11/2026'},{vencimento:'20/12/2026'}]}}),'');
assert.equal(due({}), '');
const html=fs.readFileSync(__dirname+'/../index.html','utf8');for(const m of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi))if(m[1].trim())new vm.Script(m[1]);
console.log('PASS: existing/new payment editor, funding, due date priority, empty values and installment safety');
