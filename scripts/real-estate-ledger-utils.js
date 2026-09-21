(function(root){
  'use strict';
  const norm=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
  const finite=v=>v!==null&&v!==undefined&&String(v).trim()!==''&&Number.isFinite(Number(v));
  function charges(record,history){
    const result=[],seen=new Map();
    // Only billing-sheet rows are charges. Receipt controls are separate evidence.
    const imported=history.filter(h=>norm(h.fonte_nome).includes('lancamentos')&&h.sublocacao_id===record.id).map(h=>({competencia:h.periodo,valor:h.valor,vencimento:h.vencimento,referencia:h.referencia,status:h.status_fonte,observacao:h.observacoes,fonte_url:h.fonte_url,tipo:h.tipo,origem:'Planilha'}));
    for(const c of [...imported,...(record.cobrancas||[]).map(c=>({...c,origem:'Cadastro'}))]){
      if(!finite(c.valor)&&!c.referencia&&!c.vencimento)continue;
      const key=[c.competencia||'',norm(c.referencia),finite(c.valor)?Math.round(Number(c.valor)*100):'unknown',c.vencimento||''].join('|');
      if(c.referencia&&seen.has(key))continue;
      const next={...c,valor:finite(c.valor)?Number(c.valor):null};result.push(next);seen.set(key,next);
    }
    return result.sort((a,b)=>String(b.competencia).localeCompare(String(a.competencia))||String(b.vencimento).localeCompare(String(a.vencimento)));
  }
  function attention(record,today=new Date()){
    if(norm(record.status).includes('encerr'))return 'closed';
    if(!/^\d{4}-\d{2}-\d{2}$/.test(record.contrato_fim||''))return record.revisao_pendente?'review':'';
    const [y,m,d]=record.contrato_fim.split('-').map(Number),end=Date.UTC(y,m-1,d),start=Date.UTC(today.getFullYear(),today.getMonth(),today.getDate());
    if(end<start)return 'expired';
    if(end-start<=180*86400000)return 'ending';
    return record.revisao_pendente?'review':'';
  }
  root.RealEstateLedger={charges,attention};
  if(typeof module==='object'&&module.exports)module.exports=root.RealEstateLedger;
})(typeof window==='undefined'?globalThis:window);
