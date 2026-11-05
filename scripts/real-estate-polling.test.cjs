const test=require('node:test');
const assert=require('node:assert/strict');
const {refreshApproved,isFinalWithValue}=require('./real-estate-approved-refresh.cjs');
test('completed valued tickets are terminal, open and incomplete tickets are not',()=>{
 for(const status of ['Finalizado: Concluído','Fechado','Concluído','Encerrado','Cancelado'])assert.equal(isFinalWithValue({status,valor_total:48500}),true);
 for(const row of [{status:'Em andamento',valor_total:48500},{status:'Finalizado: Concluído',valor_total:null},{status:'Finalizado no Zeev',valor_total:0},{valor_total:100}])assert.equal(isFinalWithValue(row),false);
});
test('terminal tickets are removed from retries and never requested',async()=>{
 const called=[];let saved;
 const reference={tickets:[{ticket_raiz:'10001',status:'Finalizado: Concluído',valor_total:100},{ticket_raiz:'10002',status:'Em andamento',valor_total:100}],properties:[],subleases:[],history:[]};
 await refreshApproved({reference,db:async()=>[{value:{after:'',retries:[{id:'10001',next:0,attempts:1}]}}],ticket:async id=>{called.push(id);throw Error('test outage');},saveState:async(name,value)=>{saved=value;},env:{RE_APPROVED_BATCH:'10',RE_APPROVED_SECONDS:'30'},now:()=>100000000});
 assert.deepEqual(called,['10002']);
 assert.equal(saved.retries.some(x=>x.id==='10001'),false);
 assert.equal(saved.retries.some(x=>x.id==='10002'),true);
});
