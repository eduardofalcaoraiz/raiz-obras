(function(root){
 'use strict';
 const norm=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase().replace(/\s+/g,' ');
 function amount(v){if(v===null||v===undefined||typeof v==='boolean'||String(v).trim()==='')return null;const n=Number(v);return Number.isFinite(n)?Math.round(n*100)/100:null;}
 const sum=(rows,fn=x=>x)=>rows.reduce((s,r)=>s+Math.round((amount(fn(r))??0)*100),0)/100;
 const round=v=>Math.round(v*100)/100;
 const ratio=(a,b)=>b>0?round(a/b*100):null;
 function date(v){
  const s=String(v||'').trim(),br=s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  const iso=br?`${br[3]}-${br[2].padStart(2,'0')}-${br[1].padStart(2,'0')}`:s.slice(0,10);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(iso))return '';
  const d=new Date(iso+'T12:00:00Z');return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===iso?iso:'';
 }
 const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const days=(a,b)=>Math.round((Date.parse(b+'T12:00:00Z')-Date.parse(a+'T12:00:00Z'))/86400000);
 function paymentState(p,asOf=today()){
  const st=norm(p.st),due=date(p.venc);
  if(['pago','quitado'].includes(st))return 'paid';
  if(['cancelado','rejeitado','reprovado'].includes(st))return 'cancelled';
  if(!['pendente','atrasado'].includes(st))return 'unclassified';
  if(!due)return 'undated';
  return due<asOf?'overdue':due===asOf?'today':'upcoming';
 }
 function ledger(entries,asOf=today()){
  const rows=entries.map(x=>({...x,value:amount(x.p.v),state:paymentState(x.p,asOf),due:date(x.p.venc),paidDate:date(x.p.pagaEm||x.p.paga_em),scope:x.p.escopoFin||x.p.escopo_fin||'obra'}));
  const paid=rows.filter(r=>r.state==='paid'),open=rows.filter(r=>['overdue','today','upcoming','undated'].includes(r.state));
  const get=s=>rows.filter(r=>r.state===s),overdue=get('overdue'),dueToday=get('today'),future=get('upcoming'),undated=get('undated');
  const months=new Map();for(const r of paid){if(!r.paidDate)continue;const key=r.paidDate.slice(0,7);if(!months.has(key))months.set(key,[]);months.get(key).push(r);}
  return {rows,paid,open,overdue,dueToday,future,undated,cancelled:get('cancelled'),unclassified:get('unclassified'),
   paidValue:sum(paid,r=>r.value),openValue:sum(open,r=>r.value),overdueValue:sum(overdue,r=>r.value),todayValue:sum(dueToday,r=>r.value),
   futureValue:sum(future,r=>r.value),undatedValue:sum(undated,r=>r.value),unknown:rows.filter(r=>r.value===null),
   next30:future.filter(r=>days(asOf,r.due)<=30),paidWithoutDate:paid.filter(r=>!r.paidDate),
   timeline:[...months].sort(([a],[b])=>a.localeCompare(b)).map(([key,list])=>({label:key,value:sum(list,r=>r.value),count:list.length}))};
 }
 const entries=projects=>projects.flatMap(o=>(o.pag||[]).map((p,i)=>({o,p,i})));
 function project(o,asOf=today()){
  const l=ledger(entries([o]),asOf),base=amount(o.contratado),add=sum(o.aditivos_contrato||[],a=>a.valor);
  const contract=base===null?null:round(base+add),inScope=r=>r.scope==='obra';
  const paidWork=sum(l.paid.filter(inScope),r=>r.value),paidExtra=sum(l.paid.filter(r=>r.scope==='extra'),r=>r.value);
  const legacy=!(o.pag||[]).length?amount(o.pago)||0:0,paid=round(paidWork+legacy),open=sum(l.open.filter(inScope),r=>r.value);
  return {o,ledger:l,base,add,contract,paid,paidExtra,legacy,open,openExtra:sum(l.open.filter(r=>r.scope==='extra'),r=>r.value),
   balance:contract===null?null:round(contract-paid),projected:contract===null?null:round(contract-paid-open),financialPct:ratio(paid,contract),
   scopeUnknown:l.rows.filter(r=>!['obra','extra'].includes(r.scope))};
 }
 function portfolio(projects,asOf=today()){
  const rows=projects.map(o=>project(o,asOf));return {rows,ledger:ledger(entries(projects),asOf),contract:sum(rows,r=>r.contract),paid:sum(rows,r=>r.paid),extra:sum(rows,r=>r.paidExtra),
   open:sum(rows,r=>r.open),balance:sum(rows,r=>r.balance),projected:sum(rows,r=>r.projected),missingContract:rows.filter(r=>r.contract===null||r.contract===0),legacy:sum(rows,r=>r.legacy)};
 }
 function capex(items,budgets){
  const active=items.filter(i=>norm(i.status)!=='cancelado'),resolved=active.filter(i=>norm(i.status)==='resolvido'),ongoing=active.filter(i=>norm(i.status)!=='resolvido');
  const groups=new Map();
  const group=r=>{if(!groups.has(r.key))groups.set(r.key,{key:r.key,year:r.year,unit:r.unit,brand:r.brand,items:[],budgets:[]});return groups.get(r.key);};
  for(const i of items)group(i).items.push(i);for(const b of budgets)group(b).budgets.push(b);
  const rows=[...groups.values()].map(g=>{
   const live=g.items.filter(i=>norm(i.status)!=='cancelado'),values=g.budgets.map(b=>amount(b.value)),hasBudget=values.length===1&&values[0]!==null;
   const authorized=hasBudget?values[0]:null,committed=sum(live,i=>i.value);
   return {...g,authorized,committed,hasBudget,budgetConflict:values.length>1,remaining:hasBudget?round(authorized-committed):null,
    ongoing:sum(live.filter(i=>norm(i.status)!=='resolvido'),i=>i.value),resolved:sum(live.filter(i=>norm(i.status)==='resolvido'),i=>i.value),missing:live.filter(i=>amount(i.value)===null||amount(i.value)===0).length};
  });
  const committed=sum(active,i=>i.value),authorized=sum(rows,r=>r.authorized),missingBudget=rows.filter(r=>!r.hasBudget&&r.items.some(i=>norm(i.status)!=='cancelado'));
  return {items,active,resolved,ongoing,rows,committed,authorized,resolvedValue:sum(resolved,i=>i.value),ongoingValue:sum(ongoing,i=>i.value),
   remaining:round(authorized-committed),remainingKnown:sum(rows.filter(r=>r.hasBudget),r=>r.remaining),missingBudget,
   missing:active.filter(i=>amount(i.value)===null||amount(i.value)===0),cancelled:items.filter(i=>norm(i.status)==='cancelado'),
   exceeded:rows.filter(r=>r.remaining!==null&&r.remaining<0),coverage:rows.filter(r=>r.hasBudget).length,
   resolutionPct:ratio(resolved.length,active.length)};
 }
 function investors(projects,registered,isExternal,asOf=today()){
  const map=new Map(),get=name=>{const key=norm(name)||'sem fonte';if(!map.has(key))map.set(key,{key,name:name||'Sem fonte',deposits:[],payments:[],projects:new Map(),registration:null});return map.get(key);};
  for(const i of registered)get(i.nome).registration=i;
  for(const o of projects){
   for(const a of o.aportes||[]){if(!isExternal(a.inv,o))continue;const g=get(a.inv);g.deposits.push({...a,project:o});g.projects.set(o.id,o);}
   for(const [i,p]of(o.pag||[]).entries()){if((p.escopoFin||'obra')!=='obra'||!isExternal(p.pagn,o))continue;const g=get(p.pagn);g.payments.push({o,p,i});g.projects.set(o.id,o);}
  }
  const rows=[...map.values()].map(g=>{const l=ledger(g.payments,asOf),received=sum(g.deposits,a=>a.v);return {...g,ledger:l,received,paid:l.paidValue,pending:l.openValue,balance:round(received-l.paidValue),projected:round(received-l.paidValue-l.openValue)};});
  return {rows,received:sum(rows,r=>r.received),paid:sum(rows,r=>r.paid),pending:sum(rows,r=>r.pending),balance:sum(rows,r=>r.balance),unfunded:rows.filter(r=>r.paid>r.received)};
 }
 function suppliers(projects,asOf=today()){
  const map=new Map();for(const x of entries(projects)){const name=String(x.p.ben||'Fornecedor não informado').trim(),key=norm(name);if(!map.has(key))map.set(key,{key,name,entries:[]});map.get(key).entries.push(x);}
  return [...map.values()].map(g=>{const l=ledger(g.entries,asOf);return {...g,ledger:l,paid:l.paidValue,pending:l.openValue,overdue:l.overdueValue,count:l.paid.length,projects:new Set(g.entries.map(x=>x.o.id)).size};}).sort((a,b)=>b.paid-a.paid||a.name.localeCompare(b.name,'pt-BR'));
 }
 function phases(o){
  const raw=o.fases_obra?.fases||[],items=raw.flatMap(f=>f.itens||[]);
  const done=items.filter(i=>i.status==='done'||!i.status&&i.done).length,notDone=items.filter(i=>i.status==='not_done'||!i.status&&i.notDone).length;
  return {total:items.length,done,notDone,pending:items.length-done-notDone,pct:ratio(done,items.length)};
 }
 function properties(rows,area,asOf=today()){
  const closed=r=>['encerrado','encerrada','inativo','inativa','devolvido','rescindido'].includes(norm(r.status));
  const active=rows.filter(r=>!closed(r));
  const value=r=>amount(area==='locacoes'?r.valor_aluguel:r.valor_referencia);
  const known=active.filter(r=>value(r)!==null),unknown=active.filter(r=>value(r)===null);
  const ending=active.filter(r=>date(r.contrato_fim)&&days(asOf,date(r.contrato_fim))>=0&&days(asOf,date(r.contrato_fim))<=90);
  const expired=active.filter(r=>date(r.contrato_fim)&&date(r.contrato_fim)<asOf);
  return {rows,active,known,unknown,reference:sum(known,value),closed:rows.filter(closed),ending,expired,
   review:rows.filter(r=>r.revisao_pendente),documents:rows.filter(r=>area==='locacoes'?(r.contrato_docs||[]).length>0:!!r.documento_url),
   noEnd:active.filter(r=>!date(r.contrato_fim))};
 }
 function documents(units){
  const rows=units.map(u=>{const docs=Object.values(u.docs||{}).flatMap(v=>Array.isArray(v)?v:[]);return {unit:u,count:docs.length,folders:Object.values(u.docs||{}).filter(v=>Array.isArray(v)&&v.length).length};});
  return {rows,count:rows.reduce((s,r)=>s+r.count,0),covered:rows.filter(r=>r.count>0).length,missing:rows.filter(r=>!r.count).length};
 }
 root.DashboardData={norm,amount,sum,round,ratio,date,today,days,paymentState,ledger,entries,project,portfolio,capex,investors,suppliers,phases,properties,documents};
 if(typeof module==='object'&&module.exports)module.exports=root.DashboardData;
})(typeof window==='undefined'?globalThis:window);
