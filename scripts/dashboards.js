(function(root){
 'use strict';
 const D=DashboardData,esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const money=v=>v===null?'Não informado':Number(v).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
 const number=v=>Number(v).toLocaleString('pt-BR'),pct=v=>v===null?'Não calculável':number(v)+'%';
 const date=v=>D.date(v)?D.date(v).split('-').reverse().join('/'):'Sem data';
 const icon=n=>`<img src="assets/icons/lucide/${n}.svg" alt="" width="16" height="16">`;
 const state={collections:'all',collectionBrand:'',projectScope:'all',projectYear:'',supplierSort:'paid',investorQuery:''};
 const exports=new Map();
 let renderContext=null;
 const operationalBrands={forn:'',investidores:''};
 const scopedWorks=panel=>{const brand=renderContext?renderContext.scope.brand:operationalBrands[panel];return obras.filter(o=>!brand||obraMarcaNames(o).includes(brand));};
 const operationalBrandFilter=panel=>renderContext?'':select('Marca','records-brand-'+panel,[['','Todas as marcas'],...[...new Set(obras.flatMap(obraMarcaNames))].sort().map(b=>[b,b])],operationalBrands[panel]);
 const action=(name,args={})=>`data-dash-action="${esc(JSON.stringify({name,...args}))}"`;
 const button=(label,name,args={},kind='dash-link')=>`<button type="button" class="${kind}" ${action(name,args)}>${esc(label)}${icon('arrow-up-right')}</button>`;
 const badge=(label,tone='neutral')=>`<span class="dash-badge ${tone}">${esc(label)}</span>`;
 const note=(text,tone='neutral')=>`<p class="dash-note ${tone}">${esc(text)}</p>`;
 function metrics(items){return `<div class="dash-metrics">${items.map(m=>`<${m.action?'button type="button"':'div'} class="dash-metric ${m.tone||''}" ${m.action?action(m.action,m.args):''}><span>${esc(m.label)}</span><strong>${esc(m.value)}</strong><small>${esc(m.sub||'')}</small></${m.action?'button':'div'}>`).join('')}</div>`;}
 function host(id,html){
  if(renderContext){renderContext.hosts.set(id,html);return;}
  const el=document.getElementById(id);if(!el)return;
  if(['esf-kpis','esf-alert','o-kpis','cobr-kpis','forn-kpis','inv-kpis','realestate-kpis'].includes(id)){el.innerHTML='';el.classList.remove('dash-host');return;}
  if(id==='forn-grid'||id==='inv-list'){
   const filter=operationalBrandFilter(id==='forn-grid'?'forn':'investidores');
   html=html.startsWith('<div class="party-toolbar">')?html.replace('<div class="party-toolbar">','<div class="party-toolbar">'+filter):'<div class="dash-filters">'+filter+'</div>'+html;
  }
  el.classList.add('dash-host');el.innerHTML=html;
 }
 const empty=text=>`<p class="dash-empty">${esc(text||'Nenhum registro neste recorte.')}</p>`;
 function section(title,body,sub='',actions=''){return `<section class="dash-section"><header><div><h2>${esc(title)}</h2>${sub?`<p>${esc(sub)}</p>`:''}</div>${actions}</header>${body}</section>`;}
 function table(headers,rows,key){
  if(key)exports.set(key,{headers:headers.map(h=>typeof h==='string'?h:h.label),rows:rows.map(r=>r.map(c=>typeof c==='object'?c.text:c))});
  return rows.length?`<div class="dash-table-wrap" tabindex="0" aria-label="Tabela de ${esc(headers[0]?.label||headers[0])}"><table class="dash-table"><thead><tr>${headers.map(h=>`<th scope="col" class="${h.money?'is-number':''}">${esc(h.label||h)}</th>`).join('')}</tr></thead><tbody>${rows.map(row=>`<tr>${row.map((c,i)=>`<td class="${headers[i]?.money?'is-number':''}">${typeof c==='object'?c.html:esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`:empty();
 }
 const cell=(html,text)=>({html,text});
 const cash=n=>cell(money(n),n===null?'Não informado':n);
 const download=key=>`<button type="button" class="dash-icon" title="Baixar composição CSV" aria-label="Baixar composição CSV" ${action('export',{key})}>${icon('save')}</button>`;
 const mark=brand=>`<span class="dash-brand">${brandLogoImg(brand||'RAIZ','width:36px;height:24px;object-fit:contain')}<span>${esc(brand||'Sem marca')}</span></span>`;
 function bars(rows,options={}){
  const max=Math.max(...rows.map(r=>Math.abs(r.value||0)),1),total=D.sum(rows,r=>r.value);
  return rows.length?`<div class="dash-bars">${rows.map(r=>`<div class="dash-bar-row"><div class="dash-bar-title">${r.action?button(r.label,r.action,r.args):esc(r.label)}<strong>${esc(options.count?number(r.value):money(r.value))}</strong></div><div class="dash-track" role="img" aria-label="${esc(r.label+': '+(options.count?number(r.value):money(r.value)))}"><i class="${r.tone||'green'}" style="width:${Math.max(0,Math.min(100,Math.abs(r.value||0)/max*100))}%"></i></div>${r.sub?`<small>${esc(r.sub)}</small>`:''}</div>`).join('')}</div>`:empty(options.empty);
 }
 function select(label,name,options,value){return `<label class="dash-filter">${esc(label)}<select class="fi" data-dash-change="${name}">${options.map(([v,l])=>`<option value="${esc(v)}" ${String(v)===String(value)?'selected':''}>${esc(l)}</option>`).join('')}</select></label>`;}
 const context=text=>`<div class="dash-context"><span>${esc(text)}</span><span>Leitura em ${date(D.today())}</span></div>`;
 function captureFocus(fn){const active=document.activeElement,key=active?.dataset?.dashChange,pos=active?.selectionStart;fn();if(key){const input=document.querySelector(`[data-dash-change="${key}"]`);input?.focus({preventScroll:true});if(typeof pos==='number')input?.setSelectionRange?.(pos,pos);}}
 function capexRows(){
  const all=capexConsolidatedItems(capexItens),rows=all.map(i=>({raw:i,key:`${i.ano}|${capexUnitKey(i.unidade)}`,year:+i.ano,unit:i.unidade||'Sem unidade',brand:extractMarca(i)||'Sem marca',value:D.amount(i.orcamento),status:D.norm(i.situacao)==='cancelado'?'Cancelado':_ciSit(i)}));
  const budgets=capexSaldos.map(b=>({key:`${b.ano}|${capexUnitKey(b.unidade)}`,year:+b.ano,unit:b.unidade,brand:capexSaldoMarca(b)||'Sem marca',value:D.amount(b.valor)}));
  const scope=renderContext?.scope||{year:capexDrillYear,brand:capexDrillMarca,unit:capexDrillUnidade};
  const matches=r=>(!scope.year||r.year===+scope.year)&&(!scope.brand||r.brand===scope.brand)&&(!scope.unit||capexUnitKey(r.unit)===capexUnitKey(scope.unit));
  return {all:rows,allBudgets:budgets,items:rows.filter(matches),budgets:budgets.filter(matches),excluded:capexItens.length-all.length};
 }
 function capex(){
  if(!AccessControl.can('capex'))return;
  if(!renderContext){DashboardHub.open('capex',{year:capexDrillYear,brand:capexDrillMarca,unit:capexDrillUnidade});return;}
  const source=capexRows(),s=D.capex(source.items,source.budgets),{year='',brand='',unit=''}=renderContext.scope;
  const years=[...new Set([...source.all,...source.allBudgets].map(r=>r.year))].sort((a,b)=>b-a);
  const brands=[...new Set([...source.all,...source.allBudgets].filter(r=>!year||r.year===+year).map(r=>r.brand))].sort();
  const units=[...new Set([...source.all,...source.allBudgets].filter(r=>(!year||r.year===+year)&&(!brand||r.brand===brand)).map(r=>r.unit))].sort();
  let html=`<div class="dash-shell">`+context(`CAPEX ${year||'· todos os ciclos'}${brand?' / '+brand:''}${unit?' / '+unit:''}`);
  html+=metrics([
   {label:'Disponibilizado',value:s.coverage?money(s.authorized):'Não cadastrado',sub:`${s.coverage} unidades/ciclos com verba`,tone:'blue'},
   {label:'Comprometido',value:money(s.committed),sub:`${s.active.length} registros ativos consolidados`},
   {label:'Em andamento',value:money(s.ongoingValue),sub:`${s.ongoing.length} registros · inclui valores estimados`,tone:'amber',action:'capex-list',args:{status:'Em Andamento'}},
   {label:'Saldo nas unidades com verba',value:s.coverage?money(s.remainingKnown):'Não calculável',sub:s.missingBudget.length?`${s.missingBudget.length} unidades sem verba fora deste saldo`:'Disponibilizado menos comprometido',tone:s.remainingKnown<0?'red':'green'}]);
  const statusRows=[{label:'Resolvidos',value:s.resolvedValue,sub:`${s.resolved.length} registros · não equivale a pagamento`,tone:'green',action:'capex-list',args:{status:'Resolvido'}},{label:'Em andamento',value:s.ongoingValue,sub:`${s.ongoing.length} registros`,tone:'blue',action:'capex-list',args:{status:'Em Andamento'}}];
  const alerts=[{label:'Sem valor definido',value:s.missing.length,tone:'amber',sub:'Orçamento vazio ou zero',action:'capex-issue',args:{kind:'sem_orcamento'}},{label:'Acima da verba',value:s.exceeded.length,tone:'red',sub:money(-D.sum(s.exceeded,r=>r.remaining))+' excedidos'},{label:'Sem verba cadastrada',value:s.missingBudget.length,tone:'amber',sub:money(D.sum(s.missingBudget,r=>r.committed))+' em compromissos'}];
  html+=`<div class="dash-columns">${section('Composição dos compromissos',bars(statusRows),'Situação operacional dos TRs')}${section('Atenção no orçamento',bars(alerts,{count:true}),'Pendências que afetam a leitura do saldo')}</div>`;
  const grouped=s.rows.slice().sort((a,b)=>b.committed-a.committed||a.unit.localeCompare(b.unit,'pt-BR'));
  const rows=grouped.map(g=>[cell(mark(g.brand)+button(g.unit,'capex-unit-open',{year:g.year,brand:g.brand,unit:g.unit}),g.unit),String(g.year),cash(g.authorized),cash(g.resolved),cash(g.ongoing),cell(`<strong class="${g.remaining<0?'dash-red':''}">${money(g.remaining)}</strong>`,g.remaining??'Sem verba'),g.missing?`${g.missing} sem valor`:g.budgetConflict?'Verbas divergentes':g.hasBudget?'Verba cadastrada':'Sem verba']);
  html+=section(unit?'Composição da unidade':'Orçamento por unidade',table(['Unidade','Ciclo',{label:'Disponibilizado',money:true},{label:'Resolvido',money:true},{label:'Em andamento',money:true},{label:'Saldo',money:true},'Conferência'],rows,'capex'),`${s.rows.length} unidades/ciclos · ${s.cancelled.length} cancelados fora do comprometido`,download('capex'));
  const priorities=s.ongoing.slice().sort((a,b)=>(b.value||0)-(a.value||0)).slice(0,10);
  html+=section('Demandas em andamento',table(['Ticket','Unidade','Demanda',{label:'Valor registrado',money:true}],priorities.map(i=>[String(i.raw.referencia||i.raw.ticket_raiz_instance_id||'Sem TR'),i.unit,i.raw.pedido||'Sem descrição',cash(i.value)])),`Até 10 maiores valores do recorte`,button('Abrir pedidos','capex-list',{status:'Em Andamento'}));
  html+=note('Saldo calculado somente nas unidades com verba cadastrada. Valores ainda não definidos não entram na soma. TRs de compra substituídos por financeiros vinculados não são somados novamente.');
  host('esf-capex-drill',html+'</div>');
 }
 function paymentTable(rows,key,limit=30){
  const ordered=rows.slice().sort((a,b)=>(a.due||'9999').localeCompare(b.due||'9999')||(b.value||0)-(a.value||0));
  const labels={paid:'Pago',overdue:'Vencido',today:'Vence hoje',upcoming:'A vencer',undated:'Sem vencimento',cancelled:'Cancelado',unclassified:'A classificar'};
  const cells=ordered.map(r=>[cell(button(r.p.ben||'Sem fornecedor','payment',{id:r.o.id,index:r.i}),r.p.ben||'Sem fornecedor'),r.p.ticketRaiz||r.p.ticket_raiz||r.p.ref||'Sem referência',r.o.nome,date(r.due),cell(badge(labels[r.state],r.state==='overdue'?'red':r.state==='paid'?'green':'neutral'),labels[r.state]),cash(r.value)]);
  if(key)exports.set(key,{headers:['Fornecedor','Referência','Obra','Vencimento','Situação','Valor'],rows:cells.map(r=>r.map(c=>typeof c==='object'?c.text:c))});
  return table(['Fornecedor','Referência','Obra','Vencimento','Situação',{label:'Valor',money:true}],cells.slice(0,limit))+(cells.length>limit?note(`${limit} de ${cells.length} registros exibidos. A composição CSV contém todos os registros deste recorte.`):'');
 }
 function portfolio(list){
  if(!renderContext){const controls=document.getElementById('esf-acts');if(controls)controls.hidden=!AccessControl.canEdit(curEsfera);host('esf-kpis','');host('esf-alert','');return;}
  const s=D.portfolio(list),missing=s.missingContract.length;
  host('esf-kpis',metrics([{label:'Contrato + aditivos',value:money(s.contract),sub:missing?`${missing} obras sem contrato valorizado`:`${list.length} obras neste recorte`,tone:'blue'},
   {label:'Pago no contrato',value:money(s.paid),sub:s.legacy?money(s.legacy)+' de saldo histórico sem lançamentos':'Pagamentos registrados dentro da obra',tone:'green'},
   {label:'Pendente no contrato',value:money(s.open),sub:'Não inclui pagamentos fora da obra',tone:'amber'},
   {label:'Pago fora da obra',value:money(s.extra),sub:'Separado do saldo contratual'}]));
  const rows=s.rows.slice().sort((a,b)=>b.ledger.overdueValue-a.ledger.overdueValue||b.open-a.open);
  host('esf-alert',`<div class="dash-shell">${context(`${list.length} obras no filtro atual`)}<div class="dash-columns">${section('Contratos e exposição',table(['Obra',{label:'Contratado',money:true},{label:'Pago',money:true},{label:'Pendente',money:true},{label:'Saldo após pendências',money:true}],rows.map(r=>[cell(mark(r.o.marca)+button(r.o.nome,'project',{id:r.o.id}),r.o.nome),cash(r.contract),cash(r.paid),cash(r.open),cash(r.projected)]),'works'),'Saldo contratual projetado não inclui demandas ainda não lançadas.',download('works'))}${section('Prioridades de pagamento',bars([{label:'Vencidos',value:s.ledger.overdueValue,tone:'red',sub:s.ledger.overdue.length+' lançamentos'},{label:'Vencem hoje',value:s.ledger.todayValue,tone:'amber',sub:s.ledger.dueToday.length+' lançamentos'},{label:'Próximos 30 dias',value:D.sum(s.ledger.next30,r=>r.value),tone:'blue',sub:s.ledger.next30.length+' lançamentos'},{label:'Sem vencimento',value:s.ledger.undatedValue,tone:'neutral',sub:s.ledger.undated.length+' lançamentos'}]))}</div></div>`);
 }
 function project(){
  const o=renderContext?.project||cur;if(!o||!AccessControl.can(o.esfera||'nova'))return;
  if(!renderContext){projectRecords(o);return;}
  if(state.projectId!==o.id){state.projectId=o.id;state.projectScope='all';state.projectYear='';}
  const s=D.project(o),ph=D.phases(o),l=s.ledger;
  const scope=state.projectScope;const rows=l.rows.filter(r=>(scope==='all'||r.scope===scope));
  const years=[...new Set(rows.map(r=>r.state==='paid'?r.paidDate.slice(0,4):r.due.slice(0,4)).filter(Boolean))].sort().reverse();
  const flow=D.ledger(rows.filter(r=>!state.projectYear||(r.state==='paid'?r.paidDate:r.due).startsWith(state.projectYear)).map(r=>({o:r.o,p:r.p,i:r.i})));
  let html=`<div class="dash-shell">`+context('Contrato da obra · posição acumulada');
  host('o-kpis',metrics([{label:'Contrato + aditivos',value:money(s.contract),sub:money(s.base)+' base · '+money(s.add)+' aditivos',tone:'blue',action:'project-tab',args:{tab:'contr'}},{label:'Pago no contrato',value:money(s.paid),sub:pct(s.financialPct)+' desembolsado · não é avanço físico',tone:'green'},{label:'Pendente no contrato',value:money(s.open),sub:l.open.filter(r=>r.scope==='obra').length+' lançamentos',tone:'amber',action:'project-payments',args:{scope:'obra',status:'pend'}},{label:'Saldo após pendências',value:money(s.projected),sub:money(s.balance)+' antes dos pendentes',tone:s.projected<0?'red':'green'}]));
  const planned=D.amount(o.investimento_disponivel),ceiling=D.amount(o.teto_escola);
  html+=section('Limites de planejamento',metrics([{label:'Investimento previsto',value:planned>0?money(planned):'Não definido',sub:'Previsão cadastrada, não é aporte recebido'},{label:'Saldo do investimento previsto',value:planned>0?money(D.round(planned-s.paid-s.open)):'Não calculável',sub:'Previsão menos pagos e pendentes dentro da obra'},{label:'Teto do caixa da escola',value:ceiling>0?money(ceiling):'Não definido',sub:'Limite dos pagamentos fora da obra'},{label:'Saldo do caixa após pendências',value:ceiling>0?money(D.round(ceiling-s.paidExtra-s.openExtra)):'Não calculável',sub:'Teto menos pagos e pendentes fora da obra'}]),'',AccessControl.canEdit(o.esfera||'nova')?`<div class="dash-tools">${button('Investimento','project-settings')}${button('Teto escolar','school-ceiling')}${button('Aditivos','project-additions')}</div>`:'' );
  const contractorRows=(o.construtoras||[]).map(c=>{const linked=l.rows.filter(r=>r.scope==='obra'&&String(r.p.construtora_seq)===String(c.seq)),cl=D.ledger(linked);return [c.nome||'Sem nome',cash(D.amount(c.valor)),cash(D.sum((o.aditivos_contrato||[]).filter(a=>String(a.construtora_seq)===String(c.seq)),a=>a.valor)),cash(cl.paidValue),cash(cl.openValue)];});
  const phaseBody=ph.total?bars([{label:'Concluídas',value:ph.done,tone:'green'},{label:'Pendentes',value:ph.pending,tone:'blue'},{label:'Não realizadas',value:ph.notDone,tone:'neutral'}],{count:true})+note(pct(ph.pct)+' das etapas efetivamente concluídas. Etapas não realizadas ficam fora desse percentual.'):empty('Nenhuma etapa cadastrada.');
  html+=`<div class="dash-columns">${section('Contrato e construtoras',contractorRows.length?table(['Construtora',{label:'Base',money:true},{label:'Aditivos',money:true},{label:'Pago',money:true},{label:'Pendente',money:true}],contractorRows):note(o.constr||'Construtora não informada'),'Pagamentos sem vínculo específico não são distribuídos artificialmente.',button('Contratos','project-tab',{tab:'contr'}))}${section('Andamento operacional',phaseBody,'Etapas cadastradas da obra',button('Fases da obra','project-tab',{tab:'fases'}))}</div>`;
  html+=section('Caixa fora do contrato',metrics([{label:'Pago fora da obra',value:money(s.paidExtra),sub:'Não reduz o contrato principal'},{label:'Pendente fora da obra',value:money(s.openExtra),sub:'Compromissos do caixa da escola'},{label:'Sem vínculo de construtora',value:money(D.sum(l.paid.filter(r=>r.scope==='obra'&&!r.p.construtora_seq),r=>r.value)),sub:'Pagamentos dentro da obra'}]),'',button('Pagamentos da escola','project-payments',{scope:'extra'}));
  const inv=D.investors([o],[],(name,work)=>!!name&&_isInvestidorExternoPagador(name,work));
  html+=section('Aportes e fontes externas',inv.rows.length?table(['Fonte',{label:'Depósitos registrados',money:true},{label:'Pagamentos vinculados',money:true},{label:'Pendente',money:true},{label:'Diferença de conciliação',money:true}],inv.rows.map(r=>[r.name,cash(r.received),cash(r.paid),cash(r.pending),cash(r.balance)])):empty('Nenhum aporte ou pagamento externo vinculado.'),'Pagamentos diretos não são convertidos em depósitos recebidos.',AccessControl.canEdit(o.esfera||'nova')?button('Registrar depósito','deposit',{},'btn btn-ghost btn-sm'):'');
  if((o.aportes||[]).length)html+=section('Histórico de depósitos',table(['Data','Fonte',{label:'Valor',money:true},'Registro'],o.aportes.map((a,index)=>[date(a.d),a.inv||'Sem fonte',cash(D.amount(a.v)),cell(AccessControl.canEdit(o.esfera||'nova')?button('Editar','deposit',{index}):esc(a.obs||''),a.obs||'')])));
  if(o.modelo_contrato==='ADMINISTRACAO'&&o.taxa?.total>0)html+=section('Taxa de administração',metrics([{label:'Acordada',value:money(D.amount(o.taxa.total))},{label:'Registrada como paga',value:money(D.amount(o.taxa.pago))},{label:'Saldo da taxa',value:money(D.round(o.taxa.total-(o.taxa.pago||0)))}]));
  html+=section('Movimentação financeira',`<div class="dash-filters">${select('Escopo','project-scope',[['all','Obra e caixa da escola'],['obra','Dentro da obra'],['extra','Fora da obra']],scope)}${select('Ano do movimento','project-year',[['','Todo o histórico'],...years.map(y=>[y,y])],state.projectYear)}</div>`+metrics([{label:'Pago no recorte',value:money(flow.paidValue),sub:flow.paid.length+' lançamentos',tone:'green'},{label:'Em aberto no recorte',value:money(flow.openValue),sub:flow.open.length+' lançamentos',tone:'amber'},{label:'Vencidos no recorte',value:money(flow.overdueValue),sub:flow.overdue.length+' lançamentos',tone:'red'},{label:'Sem data de pagamento',value:String(l.paidWithoutDate.length),sub:'Não entram na evolução mensal'}])+`<div class="dash-columns">${section('Pagamentos por mês',bars(flow.timeline.slice(-12).map(r=>({...r,label:r.label.split('-').reverse().join('/'),sub:r.count+' lançamentos'}))),'Somente datas de pagamento registradas; até 12 meses.')}${section('Próximas saídas e atrasos',paymentTable(flow.open,'project-open',8),flow.open.length+' lançamentos no recorte',download('project-open'))}</div>`,'Pagos por data de pagamento; pendentes por vencimento. Sem data ficam fora do filtro anual.');
  if(s.legacy)html+=note(money(s.legacy)+' no pago histórico sem lançamentos detalhados. Esse valor não foi atribuído a meses ou fornecedores.','amber');
  host('pane-resumo',html+'</div>');
 }
 function collections(){
  if(!AccessControl.can('cobranca'))return;
  const brands=[...new Set(obras.map(o=>o.marca).filter(Boolean))].sort();
  const all=D.ledger(D.entries(scopedWorks().filter(o=>renderContext||!state.collectionBrand||o.marca===state.collectionBrand)));
  const rows=state.collections==='all'?all.open:all.open.filter(r=>r.state===state.collections);
  host('cobr-kpis',metrics([{label:'Em aberto',value:money(all.openValue),sub:all.open.length+' lançamentos',tone:'blue'},{label:'Vencidos',value:money(all.overdueValue),sub:all.overdue.length+' lançamentos',tone:'red'},{label:'Vencem hoje',value:money(all.todayValue),sub:all.dueToday.length+' lançamentos',tone:'amber'},{label:'Sem vencimento',value:money(all.undatedValue),sub:all.undated.length+' lançamentos a conferir'}]));
  host('cobr-body',`<div class="dash-shell">${context('Contas a pagar das obras · marca selecionada')}<div class="dash-filters">${select('Marca','collection-brand',[['','Todas as marcas'],...brands.map(b=>[b,b])],state.collectionBrand)}${select('Composição exibida','collection-state',[['all','Todos em aberto'],['overdue','Vencidos'],['today','Vencem hoje'],['upcoming','A vencer'],['undated','Sem vencimento']],state.collections)}</div>${section('Agenda de pagamentos',paymentTable(rows,'collections',80),`${rows.length} lançamentos · ${money(D.sum(rows,r=>r.value))}`,download('collections'))}${all.unclassified.length?note(all.unclassified.length+' lançamentos com situação não classificada ficam fora dos totais de aberto e pago.','amber'):''}${all.unknown.length?note(all.unknown.length+' lançamentos sem valor numérico.','amber'):''}</div>`);
 }
 const partyStyle=brand=>`--record-accent:${esc(brandColor(brand))};--record-soft:${esc(brandLight(brand))}`;
 const partyBrands=brands=>`<div class="party-brands">${(brands.length?brands:['RAIZ']).map(brand=>mark(brand)).join('')}</div>`;
 const partyValue=(label,value,tone='')=>`<div class="${tone}"><dt>${esc(label)}</dt><dd>${esc(money(value))}</dd></div>`;
 function suppliers(){
  if(!AccessControl.can('forn'))return;
  const q=D.norm(renderContext?'':document.getElementById('forn-busca')?.value),all=D.suppliers(scopedWorks('forn'));
  const rows=all.filter(r=>!q||D.norm(r.name+' '+(CNPJS[r.name]||'')).includes(q)).sort((a,b)=>(b[state.supplierSort]||0)-(a[state.supplierSort]||0)||a.name.localeCompare(b.name));
  host('forn-kpis',metrics([{label:'Fornecedores no filtro',value:number(rows.length),sub:'Agrupados pelo nome cadastrado'},{label:'Pago registrado',value:money(D.sum(rows,r=>r.paid)),sub:'Status pago, em ambos os escopos',tone:'green'},{label:'Em aberto',value:money(D.sum(rows,r=>r.pending)),sub:'Inclui pendentes sem vencimento',tone:'blue'},{label:'Vencido',value:money(D.sum(rows,r=>r.overdue)),sub:'Em aberto com vencimento anterior a hoje',tone:'red'}]));
  const count=document.getElementById('forn-count');if(count&&!renderContext)count.textContent=rows.length+' fornecedores';
  if(!renderContext){
   table(['Fornecedor','Obras','Lançamentos pagos','Pago','Em aberto','Vencido'],rows.map(r=>[r.name,r.projects,r.count,r.paid,r.pending,r.overdue]),'suppliers');
   host('forn-grid',`<div class="party-toolbar">${select('Ordenar por','supplier-sort',[['paid','Maior valor pago'],['pending','Maior valor em aberto'],['overdue','Maior valor vencido']],state.supplierSort)}${download('suppliers')}</div><div class="party-grid">${rows.map(r=>{
    const brands=[...new Set(r.entries.flatMap(x=>obraMarcaNames(x.o)))],brand=brands.length===1?brands[0]:'RAIZ';
    return `<article class="party-card supplier-card" style="${partyStyle(brand)}"><header>${partyBrands(brands)}<h2>${button(r.name,'supplier',{nameValue:r.name},'party-title')}</h2><p>${esc(CNPJS[r.name]||'CNPJ não informado')}</p></header><dl class="party-values">${partyValue('Pago registrado',r.paid)}${partyValue('Em aberto',r.pending)}${partyValue('Vencido',r.overdue,r.overdue>0?'danger':'')}</dl><footer><span>${number(r.projects)} obra(s) · ${number(r.count)} lançamento(s) pago(s)</span>${button('Ver lançamentos','supplier',{nameValue:r.name},'btn btn-ghost')}</footer></article>`;
   }).join('')||empty('Nenhum fornecedor neste filtro.')}</div>`);return;
  }
  host('forn-grid',`<div class="dash-shell">${context('Fornecedores · composição do filtro atual')}<div class="dash-filters">${select('Ordenar por','supplier-sort',[['paid','Maior valor pago'],['pending','Maior valor em aberto'],['overdue','Maior valor vencido']],state.supplierSort)}</div>${section('Posição por fornecedor',table(['Fornecedor','Obras','Lançamentos pagos',{label:'Pago',money:true},{label:'Em aberto',money:true},{label:'Vencido',money:true}],rows.map(r=>[cell(button(r.name,'supplier',{nameValue:r.name}),r.name),r.projects,r.count,cash(r.paid),cash(r.pending),cash(r.overdue)]),'suppliers'),'Quantidade de lançamentos não representa quantidade de notas fiscais distintas.',download('suppliers'))}</div>`);
 }
 function investors(){
  if(!AccessControl.can('investidores'))return;
  const all=D.investors(scopedWorks('investidores'),(renderContext?.scope.brand||!renderContext&&operationalBrands.investidores)?[]:(root.investidores||investidores),(name,o)=>!!name&&_isInvestidorExternoPagador(name,o));
  const rows=all.rows.filter(r=>!state.investorQuery||D.norm(r.name).includes(D.norm(state.investorQuery)));
  host('inv-kpis',metrics([{label:'Depósitos registrados',value:money(D.sum(rows,r=>r.received)),sub:'Somente aportes cadastrados',tone:'blue'},{label:'Pagamentos vinculados',value:money(D.sum(rows,r=>r.paid)),sub:'Pago pelo investidor dentro da obra',tone:'green'},{label:'Compromissos pendentes',value:money(D.sum(rows,r=>r.pending)),sub:'Cancelados e rejeitados excluídos',tone:'amber'},{label:'Diferença de conciliação',value:money(D.sum(rows,r=>r.balance)),sub:'Depósitos menos pagamentos vinculados'}]));
  const cells=rows.sort((a,b)=>b.paid-a.paid).map(r=>[cell(esc(r.name)+(AccessControl.canEdit('investidores')?button(r.registration?'Editar cadastro':'Cadastrar','investor',{id:r.registration?.id,nameValue:r.name}):''),r.name),r.projects.size,cash(r.received),cash(r.paid),cash(r.pending),cash(r.balance)]);
  if(!renderContext){
   table(['Investidor','Obras','Depósitos','Pagamentos','Pendentes','Diferença'],cells,'investors');
   host('inv-list',`<div class="party-toolbar"><label class="dash-filter">Buscar investidor<input class="fi" type="search" data-dash-change="investor-query" value="${esc(state.investorQuery)}"></label>${download('investors')}</div><div class="party-grid">${rows.map(r=>{
    const projects=[...r.projects.values()],brands=[...new Set(projects.flatMap(obraMarcaNames))],brand=brands.length===1?brands[0]:'RAIZ';
    const edit=AccessControl.canEdit('investidores')?`<button type="button" class="party-edit" title="${r.registration?'Editar cadastro':'Cadastrar investidor'}" aria-label="${r.registration?'Editar cadastro':'Cadastrar investidor'}" ${action('investor',{id:r.registration?.id,nameValue:r.name})}>${icon('pencil')}</button>`:'';
    return `<article class="party-card investor-card" style="${partyStyle(brand)}"><header>${partyBrands(brands)}${edit}<h2>${esc(r.name)}</h2><p>${esc(r.registration?.cnpj_cpf||'Documento não informado')}</p>${r.registration?.email?`<p>${esc(r.registration.email)}</p>`:''}</header><dl class="party-values">${partyValue('Depósitos registrados',r.received)}${partyValue('Pagamentos vinculados',r.paid)}${partyValue('Pendentes',r.pending)}${partyValue('Diferença de conciliação',r.balance,r.balance<0?'danger':'')}</dl><details class="party-projects"><summary>Obras vinculadas (${projects.length})</summary>${projects.map(o=>`<div>${AccessControl.can(o.esfera||'nova')?button(o.nome,'project',{id:o.id}):esc(o.nome)}</div>`).join('')||'<p>Nenhuma obra vinculada.</p>'}</details><footer><span>Diferença = depósitos − pagamentos; não comprova dívida.</span></footer></article>`;
   }).join('')||empty('Nenhum investidor neste filtro.')}</div>`);return;
  }
  host('inv-list',`<div class="dash-shell">${context('Fontes externas · posição registrada')}<label class="dash-filter">Buscar investidor<input class="fi" type="search" data-dash-change="investor-query" value="${esc(state.investorQuery)}"></label>${section('Aportes e pagamentos',table(['Investidor','Obras',{label:'Depósitos',money:true},{label:'Pagamentos',money:true},{label:'Pendentes',money:true},{label:'Diferença',money:true}],cells,'investors'),'Diferença negativa pode indicar pagamento direto sem depósito vinculado; não comprova dívida.',download('investors'))}</div>`);
 }
 function realEstate(rows,area){
  if(!renderContext){host('realestate-kpis','');return;}
  const scoped=rows,s=D.properties(scoped,area);
  host('realestate-kpis',metrics([{label:area==='locacoes'?'Imóveis no filtro':'Vínculos no filtro',value:number(s.rows.length),sub:`${s.active.length} não encerrados · ${s.closed.length} encerrados`},{label:area==='locacoes'?'Aluguel de referência':'Cobrança de referência',value:s.known.length?money(s.reference):'Não informado',sub:`${s.known.length} valores cadastrados · ${s.unknown.length} sem valor`,tone:'blue'},{label:'Término em até 90 dias',value:number(s.ending.length),sub:`${s.expired.length} com término passado · ${s.noEnd.length} sem data`,tone:'amber'},{label:'Revisão pendente',value:number(s.review.length),sub:`${s.documents.length} com documento vinculado`,tone:s.review.length?'amber':'green'}])+note('Referência cadastral dos vínculos não encerrados, não é fluxo de caixa nem comprovação de pagamento. IPTU, condomínio e demais encargos estão separados no imóvel.'));
  host('realestate-composition',section(area==='locacoes'?'Imóveis e contratos':'Sublocações e uso de marca',table(['Unidade','Imóvel / contraparte','Situação',{label:'Referência mensal',money:true},'Fim do contrato'],scoped.map(r=>[cell(mark(realEstateBrandLabel(r))+button(r.unidade_ocupante||r.unidade||r.nome||'Sem unidade','property',{id:r.id,area}),r.unidade_ocupante||r.unidade||r.nome),area==='locacoes'?r.endereco:r.sublocatario,r.status||'Não informado',cash(D.amount(area==='locacoes'?r.valor_aluguel:r.valor_referencia)),date(r.contrato_fim)]))));
 }
 function documents(units){
  if(!renderContext)return '';
  const s=D.documents(units);
  return `<div class="dash-shell dash-documents">${metrics([{label:'Unidades no filtro',value:number(units.length),sub:'Cadastro de escolas'},{label:'Com documentos',value:number(s.covered),sub:'Ao menos um arquivo cadastrado',tone:'green'},{label:'Sem documentos',value:number(s.missing),sub:'Nenhum arquivo vinculado',tone:'amber'},{label:'Arquivos cadastrados',value:number(s.count),sub:'Quantidade não indica validade jurídica',tone:'blue'}])}</div>`;
 }
 function queue(rows){
  if(!renderContext)return '';
  const missing=rows.filter(r=>!(D.amount(r.valor_final)||D.amount(r.valor))),final=rows.filter(r=>(r.pronto_valor_final||r.valor_status==='final')&&(D.amount(r.valor_final)||D.amount(r.valor)));
  return metrics([{label:'Registros no filtro',value:number(rows.length),sub:'Ainda fora do CAPEX aprovado'},{label:'Com valor final',value:number(final.length),sub:'Requer conferência antes do registro',tone:'green'},{label:'Sem valor definido',value:number(missing.length),sub:'Não presumidos como custo zero',tone:'amber'},{label:'Valor não final',value:number(rows.length-final.length-missing.length),sub:'Estimativa ou aprovação em curso',tone:'blue'}]);
 }
 function csv(key){
  const data=exports.get(key);if(!data)return;
  const safe=v=>{let s=String(v??'');if(/^[\s]*[=+@-]/.test(s)&&typeof v!=='number')s="'"+s;return '"'+s.replace(/"/g,'""')+'"';};
  const blob=new Blob(['\ufeff'+[data.headers,...data.rows].map(r=>r.map(safe).join(';')).join('\r\n')],{type:'text/csv;charset=utf-8'});
  const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`${key}-${D.today()}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 }
 function openPayment(a){
  const o=obras.find(x=>String(x.id)===String(a.id));if(!o||!AccessControl.can(o.esfera||'nova'))return;
  openObra(o.id);showTab('pag');drillPag(o.pag[a.index]?.escopoFin||'obra');
  // Open the existing record only when editing is allowed; never save from a dashboard.
  if(AccessControl.canEdit(o.esfera||'nova'))openPagModal(a.index);
 }
 function act(a){
  if(root.DashboardHub?.active()&&DashboardHub.action(a))return;
  if(a.name==='export'){const areas={capex:'capex',works:curEsfera,'project-open':cur?.esfera||'nova',collections:'cobranca',suppliers:'forn',investors:'investidores'};if(AccessControl.can(areas[a.key]))csv(a.key);return;}
  if(a.name.startsWith('capex-')){
   if(!AccessControl.can('capex'))return;
   if(a.name==='capex-unit-open'){capexDrillYear=a.year;capexDrillMarca=a.brand;capexDrillUnidade=a.unit;capexTab='dashboard';capexListStatus='Todos';capexDashControls={focusDim:'',focusValue:''};}
   else{capexTab='pedidos';capexListStatus=a.status||'Todos';capexDashControls={focusDim:a.kind?'pendencia':'',focusValue:a.kind||''};}
   renderCapexView();return;
  }
  if(a.name==='project'){const o=obras.find(x=>String(x.id)===String(a.id));if(o&&AccessControl.can(o.esfera||'nova'))openObra(o.id);}
  if(a.name==='payment')openPayment(a);
  if(a.name==='project-tab'&&cur&&AccessControl.can(cur.esfera||'nova'))showTab(a.tab);
  if(a.name==='project-payments'&&cur&&AccessControl.can(cur.esfera||'nova')){showTab('pag');drillPag(a.scope);setPagFiltro(a.status||'todos');}
  if(a.name==='project-settings'&&cur&&AccessControl.canEdit(cur.esfera||'nova'))openObraModal(cur.id);
  if(a.name==='school-ceiling'&&cur&&AccessControl.canEdit(cur.esfera||'nova'))editarTetoEscola();
  if(a.name==='project-additions'&&cur&&AccessControl.canEdit(cur.esfera||'nova'))openAditivos();
  if(a.name==='deposit'&&cur&&AccessControl.canEdit(cur.esfera||'nova'))openAporteModal(a.index);
  if(a.name==='supplier'&&AccessControl.can('forn'))openFornDetail(encodeURIComponent(a.nameValue));
  if(a.name==='investor'&&AccessControl.canEdit('investidores')){if(a.id)openInvModal(a.id);else openInvAuto(a.nameValue);}
 }
 function change(el){
  const key=el.dataset.dashChange,v=el.value;
  if(key.startsWith('records-brand-')){const panel=key.slice(14);if(!AccessControl.can(panel))return;operationalBrands[panel]=v;if(panel==='forn')suppliers();else investors();return;}
  if(key.startsWith('capex-')){if(!AccessControl.can('capex'))return;if(key==='capex-year'){capexDrillYear=v?+v:null;capexDrillMarca=null;capexDrillUnidade=null;}if(key==='capex-brand'){capexDrillMarca=v||null;capexDrillUnidade=null;}if(key==='capex-unit')capexDrillUnidade=v||null;capexTab='dashboard';capexListStatus='Todos';capexDashControls={focusDim:'',focusValue:''};renderCapexView();}
  if(key==='collection-brand'){state.collectionBrand=v;collections();}
  if(key==='collection-state'){state.collections=v;collections();}
  if(key==='supplier-sort'){state.supplierSort=v;suppliers();}
  if(key==='project-scope'){state.projectScope=v;state.projectYear='';project();}
  if(key==='project-year'){state.projectYear=v;project();}
  if(key==='investor-query'){state.investorQuery=v;investors();}
 }
 document.addEventListener('click',e=>{const el=e.target.closest('[data-dash-action]');if(el){e.preventDefault();act(JSON.parse(el.dataset.dashAction));}});
 function onChange(el){
  if(root.DashboardHub?.active()){
   const keys={'collection-state':'collections','supplier-sort':'supplierSort','project-scope':'projectScope','project-year':'projectYear','investor-query':'investorQuery'};
   if(keys[el.dataset.dashChange])state[keys[el.dataset.dashChange]]=el.value;
   DashboardHub.render();return;
  }
  change(el);
 }
 document.addEventListener('change',e=>{if(e.target.dataset.dashChange)captureFocus(()=>onChange(e.target));});
 document.addEventListener('input',e=>{if(e.target.dataset.dashChange==='investor-query')captureFocus(()=>onChange(e.target));});
 function projectRecords(o){
  host('o-kpis','');
  const editable=AccessControl.canEdit(o.esfera||'nova');
  host('pane-resumo',`<div class="dash-shell">${section('Cadastro da obra',table(['Campo','Valor'],[['Contrato base',money(D.amount(o.contratado))],['Investimento previsto',D.amount(o.investimento_disponivel)>0?money(o.investimento_disponivel):'Não definido'],['Teto do caixa da escola',D.amount(o.teto_escola)>0?money(o.teto_escola):'Não definido']]),'',editable?`<div class="dash-tools">${button('Editar obra','project-settings')}${button('Teto escolar','school-ceiling')}${button('Aditivos','project-additions')}</div>`:'')}${section('Depósitos registrados',table(['Data','Fonte',{label:'Valor',money:true},'Observação',''],(o.aportes||[]).map((a,index)=>[date(a.d),a.inv||'Sem fonte',cash(D.amount(a.v)),a.obs||'',cell(editable?button('Editar','deposit',{index}):'','')])), '',editable?button('Registrar depósito','deposit'):'')}</div>`);
 }
 function render(panel,scope={}){
  if(!AccessControl.can(panel))return '';
  renderContext={scope,hosts:new Map(),project:null};
  try{
   if(panel==='capex')capex();
   else if(['nova','expansao'].includes(panel)){
    const list=scopedWorks().filter(o=>(o.esfera||'nova')===panel);
    const chosen=list.find(o=>String(o.id)===String(scope.project));
    if(chosen){renderContext.project=chosen;project();}else portfolio(list);
   }
   else if(panel==='cobranca')collections();
   else if(panel==='forn')suppliers();
   else if(panel==='investidores')investors();
   else if(panel.startsWith('realestate_')){
    const area=panel==='realestate_locacoes'?'locacoes':'cantinas';
    realEstate((area==='locacoes'?realEstateImoveis:realEstateSublocacoes).filter(r=>!scope.brand||realEstateBrandLabel(r)===scope.brand),area);
   }else if(panel==='escolas'){
    const units=unidades.filter(u=>!scope.brand||u.marca===scope.brand);
    host('docs',documents(units)+section('Cobertura documental',table(['Unidade','Arquivos'],units.map(u=>[cell(mark(u.marca)+button(u.nome,'unit',{id:u.id}),u.nome),D.documents([u]).count]))));
   }else if(panel==='registros'){
    const rows=capexZeevPendingList().filter(r=>!scope.brand||(r.marca||extractMarca(r))===scope.brand);
    host('queue',queue(rows)+section('Registros aguardando conferência',table(['Ticket','Unidade','Descrição',{label:'Valor informado',money:true}],rows.map(r=>[r.zeev_instance_id||r.instance_id||r.ticket_raiz_instance_id||r.id,r.unidade||r.unidade_nome||'A identificar',capexZeevFirstItem(r)||'A conferir',cash(D.amount(r.valor_final)||D.amount(r.valor))]))));
   }
   return [...renderContext.hosts.values()].join('');
  }finally{renderContext=null;}
 }
 function recordsScope(panel,brand){if(panel==='cobranca'){state.collectionBrand=brand||'';collections();}else if(panel in operationalBrands){operationalBrands[panel]=brand||'';if(panel==='forn'){document.getElementById('forn-busca').value='';suppliers();}else{state.investorQuery='';investors();}}}
 root.Dashboards={capex,portfolio,project,collections,suppliers,investors,realEstate,documents,queue,render,csv,recordsScope};
})(window);
