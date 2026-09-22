const test=require('node:test'),assert=require('node:assert/strict');
const D=require('./dashboard-data.js');
const today='2026-09-16',work={id:1,contratado:1000,aditivos_contrato:[{valor:100}],pag:[]};
const entry=(p)=>({o:work,p});
test('Registered builders replace stale legacy totals without doubling the contract',()=>{
 for(const contratado of [0,3700000,999]){
  const s=D.project({contratado,construtoras:[{seq:1,valor:3700000}],pag:[{construtora_seq:1,st:'PAGO',v:560000},{construtora_seq:1,st:'PENDENTE',v:430138}]});
  assert.equal(s.contract,3700000);assert.equal(s.contracts.rows[0].balance,3140000);assert.equal(s.contracts.rows[0].unbilled,2709862);assert.equal(s.contracts.investmentExposure,3140000);
 }
 assert.equal(D.project({contratado:0,pag:[]}).contract,null);
});
test('Budget reserves outstanding contracts once, including school splits and amendments',()=>{
 const s=D.project({contratado:0,investimento_disponivel:2000,teto_escola:500,construtoras:[{seq:1,valor:1000}],aditivos_contrato:[{construtora_seq:1,valor:100}],contratos:[{seq:1,v:400,valor_investimento:300,aditivos:[{valor:-100,valor_investimento:50}]}],pag:[{construtora_seq:1,st:'PAGO',v:200},{construtora_seq:1,st:'PENDENTE',v:100},{contratoSeq:1,st:'PAGO',v:50},{contratoSeq:1,st:'PENDENTE',v:50},{contratoSeq:1,st:'PAGO',v:20,escopoFin:'extra'},{st:'PENDENTE',v:25}]});
 assert.equal(s.contract,1100);assert.equal(s.contracts.supplierTotal,300);assert.equal(s.contracts.investmentExposure,1125);assert.equal(s.contracts.schoolExposure,30);assert.equal(s.freeInvestment,625);assert.equal(s.freeSchool,450);
 assert.equal(s.contracts.rows[1].investment.obligation,250);assert.equal(s.contracts.rows[1].school.obligation,50);
});
test('Unlinked payments remain visible and dual links never count twice',()=>{
 const s=D.project({construtoras:[{seq:1,valor:1000}],contratos:[{seq:1,v:200},{seq:2,v:999,status_contr:'Cancelado'}],pag:[{st:'PAGO',v:100,construtora_seq:1,contratoSeq:1},{st:'PAGO',v:40},{st:'PENDENTE',v:300,contratoSeq:1}]});
 assert.equal(s.contracts.rows.length,2);assert.equal(s.contracts.rows[0].paid,0);assert.equal(s.contracts.rows[1].paid,100);assert.equal(s.contracts.conflicts.length,1);assert.equal(s.contracts.unlinked.paidValue,40);assert.equal(s.contracts.investmentExposure,1300);
});
test('Amounts preserve zero, missing data and cents',()=>{
 assert.equal(D.amount(null),null);assert.equal(D.amount(''),null);assert.equal(D.amount(false),null);assert.equal(D.amount('abc'),null);
 assert.equal(D.amount(0),0);assert.equal(D.sum([.1,.2]),.3);assert.equal(D.ratio(4,0),null);
});
test('Dates validate calendar and overdue excludes today',()=>{
 assert.equal(D.date('29/02/2024'),'2024-02-29');assert.equal(D.date('2026-02-29'),'');assert.match(D.today(),/^\d{4}-\d{2}-\d{2}$/);
 for(const [st,venc,want]of[['PENDENTE',today,'today'],['ATRASADO','2026-09-15','overdue'],['PAGO','2026-01-01','paid'],['REJEITADO','2026-01-01','cancelled'],['PENDENTE','','undated'],['PENDENTE','2026-10-01','upcoming'],['xyz','','unclassified']])assert.equal(D.paymentState({st,venc},today),want);
});
test('Ledger distinguishes amounts, statuses and real payment dates',()=>{
 const s=D.ledger([{st:'PAGO',v:10,venc:'2026-01-01'},{st:'PAGO',v:20,pagaEm:'2026-02-01'},{st:'ATRASADO',v:30,venc:'2026-09-01'},{st:'PENDENTE',v:40},{st:'CANCELADO',v:100},{st:'PENDENTE',v:null,venc:'2026-09-17'}].map(entry),today);
 assert.equal(s.paidValue,30);assert.equal(s.openValue,70);assert.equal(s.overdueValue,30);assert.equal(s.undatedValue,40);assert.equal(s.unknown.length,1);assert.equal(s.paidWithoutDate.length,1);assert.deepEqual(s.timeline,[{label:'2026-02',value:20,count:1}]);
});
test('Project scopes do not spend the contract twice or allocate legacy to months',()=>{
 const s=D.project({...work,pag:[{st:'PAGO',v:200,escopoFin:'obra'},{st:'PAGO',v:90,escopoFin:'extra'},{st:'PENDENTE',v:100,escopoFin:'obra'},{st:'PENDENTE',v:40,escopoFin:'extra'}]},today);
 assert.equal(s.contract,1100);assert.equal(s.paid,200);assert.equal(s.paidExtra,90);assert.equal(s.openExtra,40);assert.equal(s.projected,800);
 assert.equal(D.project({...work,contratado:null}).projected,null);assert.equal(D.project({...work,pago:100}).legacy,100);
});
test('CAPEX excludes cancelled and identifies missing or duplicate budgets',()=>{
 const rows=[{key:'a',value:70,status:'Resolvido'},{key:'a',value:0,status:'Em Andamento'},{key:'a',value:500,status:'Cancelado'},{key:'b',value:50,status:'Em Andamento'},{key:'c',value:30,status:'Em Andamento'}];
 const s=D.capex(rows,[{key:'a',value:100},{key:'c',value:10},{key:'c',value:20}]);
 assert.equal(s.committed,150);assert.equal(s.authorized,100);assert.equal(s.remainingKnown,30);assert.equal(s.missingBudget.length,2);assert.equal(s.rows.find(r=>r.key==='c').budgetConflict,true);assert.equal(s.missing.length,1);assert.equal(s.resolutionPct,25);
});
test('Investors never fabricate deposits from payments',()=>{
 const o={...work,aportes:[{inv:'Investor',v:100}],pag:[{pagn:'Investor',st:'PAGO',v:150},{pagn:'Investor',st:'PENDENTE',v:20},{pagn:'Investor',st:'CANCELADO',v:500},{pagn:'School',st:'PAGO',v:1000}]};
 const s=D.investors([o],[],n=>n==='Investor',today);assert.equal(s.received,100);assert.equal(s.paid,150);assert.equal(s.pending,20);assert.equal(s.balance,-50);
});
test('Suppliers count paid entries, not invoices',()=>{
 const s=D.suppliers([{...work,pag:[{ben:'Foo',st:'PAGO',v:30,nf_num:'1'},{ben:'FOO',st:'PAGO',v:20,nf_num:'1'},{ben:'Foo',st:'REPROVADO',v:999}]}],today);
 assert.equal(s.length,1);assert.equal(s[0].count,2);assert.equal(s[0].paid,50);assert.equal(s[0].pending,0);
});
test('Not done is not completion',()=>{
 assert.deepEqual(D.phases({fases_obra:{fases:[{itens:[{status:'done'},{status:'not_done'},{status:'pending'},{status:'done'}]}]}}),{total:4,done:2,notDone:1,pending:1,pct:50});
});
test('Property summaries exclude inactive records and never treat a folder as contract',()=>{
 const s=D.properties([{status:'Inativo',valor_referencia:500},{status:'Ativo',valor_referencia:100,pasta_url:'https://drive.test'},{status:'Ativo',valor_referencia:null,contrato_fim:'2026-10-01'}],'cantinas',today);
 assert.equal(s.reference,100);assert.equal(s.active.length,2);assert.equal(s.unknown.length,1);assert.equal(s.documents.length,0);assert.equal(s.ending.length,1);
});
test('Documents reflect the filtered units and actual arrays',()=>{
 assert.deepEqual(D.documents([{docs:{a:[{},{}],b:[]}},{docs:{}},{docs:{a:'not a document'}}]).count,2);
});
