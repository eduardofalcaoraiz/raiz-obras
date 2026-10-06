/* Purchases are a separate ledger: never add their estimates to payments. */
window.ObraCompras=(()=>{
  let generation=0;
  function fail(id,message){
    const el=document.getElementById(id);
    if(el){el.setAttribute('aria-invalid','true');el.focus();}
    toast(message);return false;
  }
  function configure(z){
    const purchase=capexZeevIsCompra(z);
    const root=document.getElementById('capex-zeev-obra-overlay');
    root.dataset.kind=purchase?'compra':'pagamento';
    document.getElementById('zo-title').textContent=(purchase?'Registrar compra #':'Registrar pagamento #')+z.zeev_instance_id;
    document.getElementById('zo-data-title').textContent=purchase?'Dados da compra':'Dados do pagamento';
    document.getElementById('zo-value-label').textContent=purchase?'Valor estimado (opcional)':'Valor a pagar';
    document.getElementById('zo-supplier-label').textContent=purchase?'Fornecedor (se definido)':'Fornecedor / favorecido';
    document.getElementById('zo-save').textContent=purchase?'Registrar compra':'Registrar pagamento';
    root.querySelectorAll('[data-payment-only]').forEach(el=>{el.hidden=purchase;});
    if(purchase){
      document.getElementById('zo-compra-vinculada').checked=false;
      document.getElementById('zo-compra-tr').value='';
    }
  }
  async function find(tr){
    const digits=String(tr||'').replace(/\D/g,'');
    if(!digits)return null;
    const {data,error}=await db.from('obra_compras').select('*').eq('ticket_raiz',digits).maybeSingle();
    if(error)throw error;
    return data;
  }
  async function suggest(z){
    if(capexZeevIsCompra(z))return;
    const parent=capexCompraLinkFromZeev(z);
    if(!parent?.tr)return;
    try{
      const found=await find(parent.tr);
      if(!found||+capexZeevObraApproveId!==+z.id)return;
      document.getElementById('zo-obra-id').value=String(found.obra_id);
      setZeevObraEscopo(found.escopo);
    }catch(e){toast('Nao foi possivel conferir a obra da compra: '+e.message);}
  }
  async function validateLink(tr,obra,scope){
    const parent=await find(tr);
    if(parent&&(+parent.obra_id!==+obra.id||parent.escopo!==scope)){
      fail('zo-obra-id','O pagamento deve usar a mesma obra e o mesmo escopo da compra #'+tr+'.');return false;
    }
    return true;
  }
  async function register(z,obra,scope,values,approve=true){
    if(!z.id){
      const {data,error}=await db.from('capex_zeev_solicitacoes').select('id').eq('zeev_instance_id',z.zeev_instance_id).single();
      if(error||!data)throw new Error('Compra sem ticket de origem sincronizado. Atualize o ticket antes de vincular a obra.');
      z={...z,id:data.id};
    }
    const {data,error}=await db.rpc('register_obra_compra',{
      p_solicitacao_id:+z.id,p_obra_id:+obra.id,p_escopo:scope,
      p_fornecedor:values.ben||'',p_descricao:values.ref,p_valor:values.value,p_aprovar:approve
    });
    if(error)throw error;
    return data;
  }
  async function render(obra){
    const panel=document.getElementById('pane-compras');
    if(!panel||!obra)return;
    const request=++generation;
    panel.innerHTML='<p role="status">Carregando compras...</p>';
    try{
      const {data,error}=await db.from('obra_compras').select('*').eq('obra_id',obra.id).order('registrado_em',{ascending:false});
      if(error)throw error;
      if(request!==generation||+cur?.id!==+obra.id)return;
      if(!data?.length){panel.innerHTML='<p class="empty">Nenhuma compra registrada nesta obra.</p>';return;}
      panel.innerHTML='<div class="obra-purchases">'+data.map(row=>{
        const payments=(obra.pag||[]).filter(p=>String(paymentCompraLink(p)?.tr||'').replace(/\D/g,'')===String(row.ticket_raiz));
        const total=payments.reduce((sum,p)=>sum+(Number(p.v)||0),0);
        return `<article class="obra-purchase"><header><strong>Compra #${escHtml(String(row.ticket_raiz))}</strong><span class="badge">${row.escopo==='extra'?'Fora da obra':'Dentro da obra'}</span></header><p>${escHtml(row.descricao)}</p><p class="muted">${escHtml(row.fornecedor||'Fornecedor a definir')}</p><dl><div><dt>Estimativa</dt><dd>${row.valor_estimado==null?'A cotar':fmt(+row.valor_estimado)}</dd></div><div><dt>Pagamentos vinculados</dt><dd>${payments.length?fmt(total):'Aguardando TR financeiro'}</dd></div></dl><div class="purchase-actions"><button class="btn btn-ghost btn-sm" type="button" onclick="ObraCompras.documents(${row.solicitacao_id})">Ver ticket e documentos</button>${payments.length?'<button class="btn btn-ghost btn-sm" type="button" onclick="showTab(\'pag\')">Ver pagamentos</button>':''}</div></article>`;
      }).join('')+'</div>';
    }catch(e){
      if(request===generation)panel.innerHTML='<p role="alert">Nao foi possivel carregar as compras. '+escHtml(e.message)+'</p><button class="btn" onclick="ObraCompras.render(cur)">Tentar novamente</button>';
    }
  }
  async function documents(id){
    try{
      const {data:z,error}=await db.rpc('obra_compra_documentos',{p_solicitacao_id:id});
      if(error)throw error;
      if(!z)throw new Error('Ticket indisponivel para este acesso.');
      const docs=capexZeevStoredDocs(z);
      activePaymentDocs={zeevId:id,docs};
      document.getElementById('payment-docs-title').textContent='Compra #'+z.zeev_instance_id;
      document.getElementById('payment-docs-context').textContent=z.pedido||z.request_name||'';
      document.getElementById('payment-docs-body').innerHTML=docs.length?docs.map((d,i)=>`<div class="payment-doc-row"><b>${escHtml(d.name||'Documento')}</b><button class="btn btn-sm" onclick="viewFile(activePaymentDocs.docs[${i}])">Ver / baixar</button></div>`).join(''):'<p>Nenhum documento importado neste ticket.</p>';
      document.getElementById('payment-docs-overlay').classList.add('show');
    }catch(e){toast('Nao foi possivel acessar os documentos: '+e.message);}
  }
  return {configure,suggest,find,validateLink,register,render,documents,fail};
})();
