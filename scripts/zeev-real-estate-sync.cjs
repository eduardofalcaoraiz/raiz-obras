'use strict';
const {fields,classify,links,requester}=require('./real-estate-discovery.cjs');
const {refreshApproved}=require('./real-estate-approved-refresh.cjs');
const SUPA=process.env.SUPABASE_URL,KEY=process.env.SUPABASE_SERVICE_ROLE_KEY,TOKEN=process.env.ZEEV_TOKEN;
const ZEEV=process.env.ZEEV_BASE_URL||'https://raizeducacao.zeev.it';
const stats={pages:0,read:0,candidates:0,related:0,failed:0};
const budget=Number(process.env.RE_MAX_PAGES||120),cache=new Map();
const backlog=new Set();
const fullTickets=new Set();
let pendingIds=null;
let knownLinks=null;
function zeevTime(value){const p=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(new Date(value)).map(x=>[x.type,x.value]));return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}`;}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function request(url,options={},deadline=Infinity){for(let i=0;i<3;i++){try{const remaining=deadline-Date.now();if(remaining<=0)throw Error('Refresh time budget exhausted');const r=await fetch(url,{...options,signal:AbortSignal.timeout(Math.min(90000,remaining))});if(!r.ok)throw Error('HTTP '+r.status+' '+new URL(url).pathname);return r.status===204?null:await r.json();}catch(e){if(i===2||Date.now()>=deadline)throw e;await sleep(Math.min(1500*(i+1),Math.max(0,deadline-Date.now())));}}}
function db(resource,method='GET',body,deadline){return request(SUPA+'/rest/v1/'+resource,{method,headers:{apikey:KEY,Authorization:'Bearer '+KEY,'Content-Type':'application/json',Prefer:'return=representation,resolution=merge-duplicates'},body:body===undefined?undefined:JSON.stringify(body)},deadline);}
async function all(table,select){if(table==='real_estate_tickets')select+=',status,sincronizado_em';let rows=[];for(let offset=0;;offset+=1000){const chunk=await db(table+'?select='+select+'&order='+({real_estate_tickets:'ticket_raiz',real_estate_lancamentos:'id'}[table]||'id')+'&limit=1000&offset='+offset);rows.push(...chunk);if(chunk.length<1000)return rows;}}
async function ticket(id,deadline){id=String(id);if(fullTickets.has(id))return cache.get(id);const params=new URLSearchParams({showPendingInstanceTasks:'true',showFinishedInstanceTasks:'true',allowOpenUrlsForFilesInForm:'true',useCache:'false'});fields.forEach(f=>params.append('formFieldNames',f));const t=await request(ZEEV+'/api/2/instances/'+id+'?'+params,{headers:{Authorization:'Bearer '+TOKEN,'Accept-Language':'pt-BR,pt;q=0.9,en;q=0.8'}},deadline);if(!t?.id)throw Error('Invalid ticket response');cache.set(id,t);fullTickets.add(id);return t;}
async function saveState(name,value,deadline){await db('real_estate_sync_state','POST',{name,value,updated_at:new Date().toISOString()},deadline);}
async function relatedTicket(id){
 if(cache.has(id))return cache.get(id);
 if(!knownLinks){const saved=(await db('real_estate_sync_state?name=eq.link-requesters'))[0]?.value?.entries||[];knownLinks=new Map(saved.filter(([,v])=>Date.now()-Date.parse(v.readAt)<30*86400000));}
 if(knownLinks.has(id))return knownLinks.get(id);
 if(stats.related>=200)return undefined;
 try{const t=await ticket(id);stats.related++;knownLinks.set(id,{id:t.id,requester:requester(t),flow:t.flow,readAt:new Date().toISOString()});return t;}catch(e){if(e.message.includes('HTTP 404'))return null;throw e;}
}
async function processTicket(t,reference){if(!/^\d{4,8}$/.test(String(t?.id)))throw Error('Malformed Zeev report');if(!fullTickets.has(String(t.id)))cache.set(String(t.id),t);backlog.delete(String(t.id));stats.read++;
 if(Number(t.flow?.id)===276){if(!pendingIds)pendingIds=new Set((await all('real_estate_pending','id,ticket_raiz,status')).filter(x=>x.status==='pending').map(x=>x.ticket_raiz));if(pendingIds.delete(String(t.id)))await db('real_estate_pending?ticket_raiz=eq.'+t.id+'&status=eq.pending','PATCH',{status:'superseded',decision_reason:'Subprocesso tecnico de dados bancarios, nao lancamento financeiro'});return;}
 if(fullTickets.has(String(t.id)))t=cache.get(String(t.id));else if(classify(t,reference))t=await ticket(t.id);
 const technicalChildren=new Set((t.instanceTasks||[]).filter(x=>/dados.*bancar|bancar.*dados/i.test(x.task?.name||'')).map(x=>String(x.subprocessId)));
 const related=[];for(const id of links(t).filter(id=>!technicalChildren.has(id))){const r=await relatedTicket(id);if(r===undefined){backlog.add(String(t.id));continue;}if(r&&Number(r.flow?.id)!==276)related.push(r);}
 const candidate=classify(t,reference,related);if(candidate){await db('rpc/ingest_real_estate_pending','POST',{p_candidate:candidate});stats.candidates++;}
 // Child financial requests can have another requester. Inspect directly linked children.
 if(requester(t).email==='eduardo.falcao@raizeducacao.com.br')for(const r of related){if(!/financeir/i.test(r.flow?.name||r.requestName||''))continue;const child=classify(await ticket(r.id),reference,[t]);if(child){await db('rpc/ingest_real_estate_pending','POST',{p_candidate:child});stats.candidates++;}}
}
async function scan(mode,reference){const name='discovery-'+mode;let state=(await db('real_estate_sync_state?name=eq.'+name))[0]?.value;const now=new Date();if(!state)state={start:new Date(now-2*86400000).toISOString(),end:now.toISOString(),page:1};else if(state.done)state={start:new Date(new Date(state.end)-36*3600000).toISOString(),end:now.toISOString(),page:1};
 if(state.version!==2){state.page=1;state.version=2;}
 const limit=stats.pages+Math.max(1,Math.floor(budget/2));
 while(stats.pages<limit){const prefix=mode==='created'?'startDateInterval':'lastTaskEndDateInterval';const body={[prefix+'Begin']:zeevTime(state.start),[prefix+'End']:zeevTime(state.end),recordsPerPage:100,pageNumber:state.page,simulation:false,useCache:false,formFieldNames:fields,showPendingInstanceTasks:true,showFinishedInstanceTasks:false,showPendingAssignees:false,allowOpenUrlsForFilesInForm:true};const data=await request(ZEEV+'/api/2/instances/report',{method:'POST',headers:{Authorization:'Bearer '+TOKEN,'Content-Type':'application/json','Accept-Language':'pt-BR,pt;q=0.9,en;q=0.8'},body:JSON.stringify(body)});if(!Array.isArray(data))throw Error('Unexpected report shape');stats.pages++;for(const t of data)await processTicket(t,reference);state.page++;state.done=data.length<100;await saveState('link-backlog',{ids:[...backlog]});await saveState(name,state);if(state.done)return true;}
 return false;
}
async function main(){if(!SUPA||!KEY||!TOKEN)throw Error('Missing configured cloud credentials');const run=(await db('real_estate_sync_runs','POST',{}))[0];try{const reference={properties:await all('real_estate_imoveis','id,nome,endereco,locador,centro_custo'),subleases:await all('real_estate_sublocacoes','id,sublocatario,unidade'),tickets:await all('real_estate_tickets','ticket_raiz,imovel_ids,sublocacao_ids,cnpj_fornecedor'),history:await all('real_estate_lancamentos','id,imovel_id,sublocacao_id,ticket_raiz,contraparte,fonte_url,fonte_nome,tipo')};for(const id of (await db('real_estate_sync_state?name=eq.link-backlog'))[0]?.value?.ids||[])backlog.add(String(id));for(const id of [...backlog].slice(0,200)){backlog.delete(id);await processTicket(await ticket(id),reference);}let completed=true;stats.scope=process.env.RE_LINKS_ONLY==='1'?'linked-and-pending':'incremental';if(process.env.RE_LINKS_ONLY!=='1'){completed=await scan('created',reference);completed=(await scan('changed',reference))&&completed;}
 // Rotate a small pending batch to catch form edits that did not finish a task.
 stats.approved_refresh=await refreshApproved({db,ticket,saveState,reference});
 completed=completed&&!stats.approved_refresh.failed&&!stats.approved_refresh.retries_pending&&!stats.approved_refresh.time_limited;
 const refresh=(await db('real_estate_sync_state?name=eq.pending-refresh'))[0]?.value?.after||0;
 const pending=await db('real_estate_pending?status=eq.pending&id=gt.'+refresh+'&select=id,ticket_raiz&order=id&limit=40');for(const p of pending)await processTicket(await ticket(p.ticket_raiz),reference);await saveState('pending-refresh',{after:pending.length===40?pending.at(-1).id:0});
 await saveState('link-backlog',{ids:[...backlog]});stats.links_deferred=backlog.size;completed=completed&&!backlog.size;
 if(knownLinks)await saveState('link-requesters',{entries:[...knownLinks].slice(-4000)});
 await db('real_estate_sync_runs?id=eq.'+run.id,'PATCH',{status:completed?'completed':'partial',finished_at:new Date().toISOString(),summary:{...stats,reference:'Cadastros e historico importado das planilhas; nao leitura diaria ao vivo do Google Sheets',references:reference.history.length}});console.log(JSON.stringify({...stats,completed}));
 }catch(e){stats.failed++;await db('real_estate_sync_runs?id=eq.'+run.id,'PATCH',{status:'failed',finished_at:new Date().toISOString(),summary:{...stats,error:e.message}});throw e;}}
async function approvedOnly(){
 if(!SUPA||!KEY||!TOKEN)throw Error('Missing configured cloud credentials');
 const run=(await db('real_estate_sync_runs','POST',{}))[0];
 try{
  const reference={properties:await all('real_estate_imoveis','id,nome,endereco,locador,centro_custo'),subleases:await all('real_estate_sublocacoes','id,sublocatario,unidade'),tickets:await all('real_estate_tickets','ticket_raiz,imovel_ids,sublocacao_ids,cnpj_fornecedor'),history:await all('real_estate_lancamentos','id,imovel_id,sublocacao_id,ticket_raiz,contraparte,fonte_url,fonte_nome,tipo')};
  const refresh=await refreshApproved({db,ticket,saveState,reference});
  const completed=!refresh.failed&&!refresh.retries_pending&&!refresh.time_limited;
  const summary={scope:'approved-only',approved_refresh:refresh,completed,links_deferred:0};
  await db('real_estate_sync_runs?id=eq.'+run.id,'PATCH',{status:completed?'completed':'partial',finished_at:new Date().toISOString(),summary});
  console.log(JSON.stringify(summary));
 }catch(e){await db('real_estate_sync_runs?id=eq.'+run.id,'PATCH',{status:'failed',finished_at:new Date().toISOString(),summary:{scope:'approved-only',error:e.message}});throw e;}
}
if(require.main===module)(process.env.RE_APPROVED_ONLY==='1'?approvedOnly():main()).catch(e=>{console.error(e.message);process.exitCode=1});
