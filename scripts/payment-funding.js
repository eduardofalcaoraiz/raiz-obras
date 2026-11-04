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
 let names=[];
 function addRow(row={name:'',percent:''}){
  const tr=document.createElement('div');tr.className='funding-row';tr.style.cssText='display:grid;grid-template-columns:minmax(0,1fr) 90px 36px;gap:8px;margin-top:8px';
  tr.innerHTML='<select class="fi" aria-label="Investidor do rateio"><option value="">Selecione o investidor</option>'+[...new Set([...names,row.name].filter(Boolean))].map(n=>'<option value="'+escape(n)+'"'+(n===row.name?' selected':'')+'>'+escape(n)+'</option>').join('')+'</select><input class="fi" aria-label="Percentual do investidor" type="number" min="0.01" max="100" step="0.01" value="'+escape(row.percent)+'"><button type="button" class="btn btn-ghost" aria-label="Remover investidor" title="Remover investidor">&times;</button>';
  tr.querySelector('button').onclick=()=>tr.remove();document.getElementById('pm-funding-rows').append(tr);
 }
 function open(p,investors){
  names=investors.map(i=>i.nome);let box=document.getElementById('pm-funding');
  if(!box){box=document.createElement('section');box.id='pm-funding';box.style.cssText='margin:12px 0;padding:12px 0;border-top:1px solid var(--line)';
   box.innerHTML='<label><input id="pm-funding-enabled" type="checkbox"> Recursos de investidores / pagamento administrado</label><div id="pm-funding-body" hidden><label class="fl" for="pm-funding-manager">Quem realiza o pagamento</label><input id="pm-funding-manager" class="fi" placeholder="Razão social da administradora ou pagante"><div id="pm-funding-rows"></div><button type="button" class="btn btn-ghost" id="pm-funding-add">+ Investidor</button><span>Participação (%)</span></div>';
   document.getElementById('pm-pag').parentElement.after(box);
   document.getElementById('pm-funding-enabled').onchange=e=>document.getElementById('pm-funding-body').hidden=!e.target.checked;
   document.getElementById('pm-funding-add').onclick=()=>addRow();
  }
  document.getElementById('pm-funding-enabled').checked=!!p?.funding?.length;
  document.getElementById('pm-funding-body').hidden=!p?.funding?.length;
  document.getElementById('pm-funding-manager').value=p?.funding?.length?p.pagn:'';
  document.getElementById('pm-funding-rows').replaceChildren();
  (p?.funding?.length?p.funding:[{name:'',percent:50},{name:'',percent:50}]).forEach(addRow);
 }
 function read(){
  if(!document.getElementById('pm-funding-enabled')?.checked)return {funding:[]};
  const payer=document.getElementById('pm-funding-manager').value.trim();if(!payer)throw Error('Informe quem realiza o pagamento.');
  const funding=validate([...document.querySelectorAll('#pm-funding-rows .funding-row')].map(r=>({name:r.querySelector('select').value,percent:Number(r.querySelector('input').value)})));
  if(!funding.length)throw Error('Inclua ao menos um investidor.');return {funding,payer};
 }
 const api={validate,shares,allocatedPayments,detail,open,read};root.PaymentFunding=api;if(typeof module!=='undefined')module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
