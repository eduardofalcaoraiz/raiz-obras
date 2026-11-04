(function(root){
 'use strict';
 function validate(rows){
  if(!Array.isArray(rows)||!rows.length)return [];
  const names=new Set();let sum=0;
  const out=rows.map(r=>{const name=String(r.name||'').trim(),percent=Number(r.percent);
   if(!name||names.has(name.toLowerCase())||!Number.isFinite(percent)||percent<=0||percent>100)throw Error('Informe investidores distintos e percentuais positivos.');
   names.add(name.toLowerCase());sum+=Math.round(percent*100);return {name,percent:Math.round(percent*100)/100};});
  if(sum!==10000)throw Error('O rateio dos investidores deve somar 100%.');return out;
 }
 function shares(p){
  const rows=validate(p.funding||[]);if(!rows.length)return [{name:p.pagn||'',value:Number(p.v)||0,percent:100}];
  const cents=Math.round((Number(p.v)||0)*100),sign=cents<0?-1:1,total=Math.abs(cents);
  const parts=rows.map((r,i)=>({r,i,exact:total*Math.round(r.percent*100)/10000}));
  parts.forEach(a=>{a.cents=Math.floor(a.exact);});
  let remainder=total-parts.reduce((n,a)=>n+a.cents,0);
  for(const a of [...parts].sort((a,b)=>(b.exact-b.cents)-(a.exact-a.cents)||a.i-b.i)){if(remainder-->0)a.cents++;}
  return parts.map(a=>({...a.r,value:sign*a.cents/100}));
 }
 function allocatedPayments(o){return (o.pag||[]).flatMap(p=>shares(p).map(s=>({...p,pagn:s.name,v:s.value,funding:[],paymentManager:p.pagn})));}
 function escape(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
 function detail(p,fmt){return p.funding?.length?'<div style="grid-column:1/-1"><b>Origem dos recursos</b><div>'+shares(p).map(s=>escape(s.name)+' ('+s.percent+'%): '+fmt(s.value)).join('<br>')+'</div></div>':'';}
 const saFunding=[{name:'R. E. PARTICIPACOES E EMPREENDIMENTOS LTDA',percent:50},{name:'JP TERRAZI EMPREENDIMENTOS PARTICIPACOES E LOCACOES LTDA',percent:50}];
 function applyPolicy(o,p){if(Number(o?.id)===7&&(p.escopoFin||'obra')==='obra'&&p.nfTipo==='Sem nota'){p.pagn='DAVELINO IMOVEIS LTDA';p.funding=saFunding.map(r=>({...r}));}return p;}
 function syncImport(project){
  const el=document.getElementById('imp-pag');if(!el)return;
  const forced=Number(project?.id)===7&&document.getElementById('imp-nftipo')?.value==='Sem nota'&&(document.getElementById('imp-escopo')?.value||'obra')==='obra';
  let note=document.getElementById('imp-funding-note');if(!note){note=document.createElement('p');note.id='imp-funding-note';el.after(note);}
  if(forced){if(!el.disabled)el.dataset.previous=el.value;if(![...el.options].some(o=>o.value==='DAVELINO IMOVEIS LTDA'))el.add(new Option('DAVELINO IMOVEIS LTDA','DAVELINO IMOVEIS LTDA'));el.value='DAVELINO IMOVEIS LTDA';note.textContent='Recursos: R.E. 50% | JP 50%';}
  else if(el.disabled){el.value=el.dataset.previous||'';}
  el.disabled=forced;note.hidden=!forced;
 }
 let names=[],projectId=null,original=null;
 function isPolicy(){return Number(projectId)===7&&document.getElementById('pm-nf')?.value==='Sem nota'&&(document.getElementById('pm-escopo')?.value||'obra')==='obra';}
 function syncPolicy(){
  const box=document.getElementById('pm-funding');if(!box)return;
  const forced=isPolicy(),check=document.getElementById('pm-funding-enabled');
  if(forced){check.checked=true;document.getElementById('pm-funding-body').hidden=false;document.getElementById('pm-funding-manager').value='DAVELINO IMOVEIS LTDA';document.getElementById('pm-funding-rows').replaceChildren();saFunding.forEach(addRow);}
  else if(box.dataset.forced==='true'&&!original?.funding?.length){check.checked=false;document.getElementById('pm-funding-body').hidden=true;}
  box.dataset.forced=String(forced);check.disabled=forced;
  for(const el of box.querySelectorAll('#pm-funding-body input,#pm-funding-body select,#pm-funding-body button'))el.disabled=forced;
  document.getElementById('pm-pag').parentElement.style.display=check.checked?'none':'';
 }
 function addRow(row={name:'',percent:''}){
  const tr=document.createElement('div');tr.className='funding-row';tr.style.cssText='display:grid;grid-template-columns:minmax(0,1fr) 90px 36px;gap:8px;margin-top:8px';
  tr.innerHTML='<select class="fi" aria-label="Investidor do rateio"><option value="">Selecione o investidor</option>'+[...new Set([...names,row.name].filter(Boolean))].map(n=>'<option value="'+escape(n)+'"'+(n===row.name?' selected':'')+'>'+escape(n)+'</option>').join('')+'</select><input class="fi" aria-label="Percentual do investidor" type="number" min="0.01" max="100" step="0.01" value="'+escape(row.percent)+'"><button type="button" class="btn btn-ghost" aria-label="Remover investidor" title="Remover investidor">&times;</button>';
  tr.querySelector('button').onclick=()=>tr.remove();document.getElementById('pm-funding-rows').append(tr);
 }
 function open(p,investors,project){
  projectId=project?.id;original=p;
  if(Number(projectId)===7&&(!p||((p.escopoFin||'obra')==='obra'&&p.nfTipo==='Sem nota')))p={...p,pagn:'DAVELINO IMOVEIS LTDA',funding:saFunding};
  names=investors.map(i=>i.nome);let box=document.getElementById('pm-funding');
  if(!box){box=document.createElement('section');box.id='pm-funding';box.style.cssText='margin:12px 0;padding:12px 0;border-top:1px solid var(--line)';
   box.innerHTML='<label><input id="pm-funding-enabled" type="checkbox"> Recursos de investidores / pagamento administrado</label><div id="pm-funding-body" hidden><label class="fl" for="pm-funding-manager">Quem realiza o pagamento</label><input id="pm-funding-manager" class="fi" placeholder="Razão social da administradora ou pagante"><div id="pm-funding-rows"></div><button type="button" class="btn btn-ghost" id="pm-funding-add">+ Investidor</button><span>Participação (%)</span></div>';
   document.getElementById('pm-pag').parentElement.after(box);
   document.getElementById('pm-funding-enabled').onchange=e=>{document.getElementById('pm-funding-body').hidden=!e.target.checked;document.getElementById('pm-pag').parentElement.style.display=e.target.checked?'none':'';};
   document.getElementById('pm-funding-add').onclick=()=>addRow();
  }
  document.getElementById('pm-funding-enabled').checked=!!p?.funding?.length;
  document.getElementById('pm-funding-body').hidden=!p?.funding?.length;
  document.getElementById('pm-funding-manager').value=p?.funding?.length?p.pagn:'';
  document.getElementById('pm-funding-rows').replaceChildren();
  (p?.funding?.length?p.funding:[{name:'',percent:50},{name:'',percent:50}]).forEach(addRow);
  syncPolicy();
 }
 function read(){
  if(Number(projectId)===7&&document.getElementById('pm-nf')?.value==='Sem nota'&&(document.getElementById('pm-escopo')?.value||'obra')==='obra')return {funding:saFunding.map(r=>({...r})),payer:'DAVELINO IMOVEIS LTDA'};
  if(!document.getElementById('pm-funding-enabled')?.checked)return {funding:[]};
  const payer=document.getElementById('pm-funding-manager').value.trim();if(!payer)throw Error('Informe quem realiza o pagamento.');
  const funding=validate([...document.querySelectorAll('#pm-funding-rows .funding-row')].map(r=>({name:r.querySelector('select').value,percent:Number(r.querySelector('input').value)})));
  if(!funding.length)throw Error('Inclua ao menos um investidor.');return {funding,payer};
 }
 const api={validate,shares,allocatedPayments,detail,open,read,syncPolicy,syncImport,applyPolicy};root.PaymentFunding=api;if(typeof module!=='undefined')module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
