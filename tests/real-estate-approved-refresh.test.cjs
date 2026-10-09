'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {refreshApproved,BATCH_SIZE}=require('../scripts/real-estate-approved-refresh.cjs');
function fixture(ids,after=''){
 const calls=[],saved=[],reads=[];
 const reference={properties:[],subleases:[],history:[],tickets:ids.map(ticket_raiz=>({ticket_raiz,imovel_ids:['manual-destination']}))};
 const args={reference,env:{RE_APPROVED_BATCH:'40'},
  db:async(resource,method,body)=>{calls.push({resource,method,body});if(resource.startsWith('real_estate_sync_state?'))return [{value:{after}}];if(resource.startsWith('real_estate_tickets?'))return ids.map(ticket_raiz=>({ticket_raiz}));if(resource==='rpc/refresh_real_estate_snapshot')return null;throw Error('Unexpected write');},
  ticket:async id=>{reads.push(id);return {id,active:true,flow:{id:1},formFields:[{name:'valor',value:'123,45'}]};},
  saveState:async(name,value)=>saved.push({name,value})};
 return {args,calls,saved,reads};
}
test('bounded text-key rotation uses canonical candidate and refresh RPC only',async()=>{
 const ids=Array.from({length:41},(_,i)=>String(1000+i)),f=fixture(ids,'0999');
 assert.equal((await refreshApproved(f.args)).refreshed,40);
 assert.deepEqual(f.reads,ids.slice(0,40));
 assert.equal(f.saved.at(-1).value.after,'1039');
 const writes=f.calls.filter(c=>c.method==='POST');
 assert.equal(writes.length,40);
 for(const c of writes){assert.equal(c.resource,'rpc/refresh_real_estate_snapshot');assert.equal(c.method,'POST');assert.equal(c.body.p_candidate.snapshot.valor_total,123.45);assert.equal(c.body.p_candidate.source_fingerprint.length,64);assert.deepEqual(c.body.p_candidate.snapshot.imovel_ids,[]);}
 assert.deepEqual(f.args.reference.tickets[0].imovel_ids,['manual-destination']);
});
test('configuration limits, deadline and checkpoint failure are bounded',async()=>{
 for(const value of ['0','3001','NaN','1.5']){const f=fixture([]);f.args.env.RE_APPROVED_BATCH=value;await assert.rejects(refreshApproved(f.args),/limit/);}
 const f=fixture(['1000','1001']);let time=0;f.args.now=()=>time;f.args.env.RE_APPROVED_SECONDS='1';
 const ticket=f.args.ticket;f.args.ticket=async(id,deadline)=>{assert.equal(deadline,1000);time=1001;return ticket(id);};
 const r=await refreshApproved(f.args);assert.equal(r.attempted,1);assert.equal(r.time_limited,true);assert.equal(f.saved.at(-1).value.after,'1000');
 const g=fixture(['1000','1001']);g.args.saveState=async()=>{throw Error('checkpoint unavailable');};await assert.rejects(refreshApproved(g.args),/checkpoint/);assert.equal(g.reads.length,1);
});
test('due retries recover, backoff retries wait, active tickets precede history',async()=>{
 const f=fixture(['1000','1001','1002','1003']);f.args.now=()=>1000000;
 f.args.reference.tickets[2].status='Em andamento';
 const db=f.args.db;f.args.db=async(...args)=>args[0].startsWith('real_estate_sync_state?')?[{value:{after:'',retries:[{id:'1001',attempts:1,next:0},{id:'1003',attempts:1,next:2000000}]}}]:db(...args);
 const r=await refreshApproved(f.args);
 assert.deepEqual(f.reads,['1001','1002','1000']);assert.equal(r.retries_pending,1);assert.equal(f.saved.at(-1).value.retries[0].id,'1003');
});
test('short and empty pages reset cursor for next pass',async()=>{
 for(const ids of [[],['9999']]){const f=fixture(ids,'9000');assert.equal((await refreshApproved(f.args)).refreshed,ids.length);assert.deepEqual(f.saved.at(-1),{name:'approved-refresh',value:{after:'',retries:[]}});}
});
test('fetch and ingestion failures are isolated and durably queued',async()=>{
 for(const mode of ['fetch','ingest']){
  const f=fixture(['1000','1001','1002']);
  const fetch=f.args.ticket,db=f.args.db;
  f.args.ticket=async id=>{if(mode==='fetch'&&id==='1001')throw Error('offline');return fetch(id);};
  f.args.db=async(...a)=>{if(mode==='ingest'&&a[2]?.p_candidate.ticket_raiz==='1001')throw Error('offline');return db(...a);};
  const result=await refreshApproved(f.args);
  assert.equal(result.refreshed,2);assert.equal(result.failed,1);
  assert.deepEqual(f.reads,['1000',...(mode==='fetch'?[]:['1001']),'1002']);
  assert.equal(f.saved.at(-1).value.retries[0].id,'1001');
  assert.equal(f.saved.at(-1).value.after,'');
 }
});
test('malformed cursor and mismatched ticket fail closed',async()=>{
 const f=fixture(['1000'],'bad&limit=999');await assert.rejects(refreshApproved(f.args),/cursor/);assert.equal(f.calls.length,1);
 const g=fixture(['1000']);g.args.ticket=async()=>({id:'1001'});assert.equal((await refreshApproved(g.args)).failed,1);assert.equal(g.calls.filter(c=>c.method==='POST').length,0);
});
test('SQL refresh write allowlist excludes financial overrides, approvals and ledgers',()=>{
 const sql=fs.readFileSync(path.join(__dirname,'../sql/real_estate_snapshot_refresh.sql'),'utf8');
 const update=sql.split('update public.real_estate_tickets t set')[1].split('where t.ticket_raiz=v_ticket;')[0];
 for(const field of ['imovel_ids','sublocacao_ids','valor_total','vencimento','competencia','componentes','observacoes','vinculo_revisar','financeiro','descricao','fornecedor','centro_custo'])assert.doesNotMatch(update,new RegExp('\\b'+field+'\\s*='));
 assert.doesNotMatch(sql,/(?:insert into|update|delete from) public.real_estate_lancamentos|decide_real_estate_pending/i);
 assert.match(sql,/v_baseline=v_old_fields/);
 assert.match(sql,/v_baseline is null and v_old_fields=v_fields/);
 assert.match(sql,/if not v_conflict/);
 assert.match(sql,/if not found then raise exception/);
 assert.match(sql,/pg_advisory_xact_lock/);
 assert.match(sql,/revoke all .* from public,anon,authenticated/);
 assert.match(sql,/grant execute .* to service_role/);
 assert.ok(sql.indexOf('v_id:=public.ingest_real_estate_pending')>sql.indexOf('sincronizado_em=now()'));
});
test('ticket URL guard accepts only the official HTTPS origin and preserves fallback',()=>{
 const sql=fs.readFileSync(path.join(__dirname,'../sql/real_estate_snapshot_refresh.sql'),'utf8');
 const match=sql.match(/ticket_url=case when v_snapshot->>'ticket_url' ~ '([^']+)'\s+then v_snapshot->>'ticket_url' else t.ticket_url end/);
 assert.ok(match);
 // Translate the PostgreSQL POSIX whitespace/control class for this local guard check.
 const guard=new RegExp(match[1].replace('[^[:space:][:cntrl:]]','[^\\s\\x00-\\x1f\\x7f]'));
 assert.ok(guard.test('https://raizeducacao.zeev.it/audit?token=renewed'));
 for(const url of ['','http://raizeducacao.zeev.it/audit','https://raizeducacao.zeev.it.evil.test/audit','https://raizeducacao.zeev.it@evil.test/audit','https://raizeducacao.zeev.it/audit\ninvalid'])assert.equal(guard.test(url),false,url);
});
