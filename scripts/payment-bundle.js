(function(root){
  'use strict';
  const locks=new Set();let previewUrl=null;
  const ext=f=>String(f.name||f.storagePath||'').split('.').pop().toLowerCase();
  const visual=d=>['pdf','png','jpg','jpeg','webp'].includes(ext(d));
  const charge=d=>paymentDocKindLabel(d)==='BOLETO';
  const eligible=d=>visual(d)&&!d.generatedBundle&&!paymentIsProofDoc(d)&&['NF','BOLETO','FATURA','RECIBO','ORCAMENTO'].includes(paymentDocKindLabel(d));
  async function merge(files){
    if(!files.length)return null;
    const out=await PDFLib.PDFDocument.create();
    const ordered=files.map((f,i)=>({f,i})).sort((a,b)=>Number(/boleto/i.test(a.f.name))-Number(/boleto/i.test(b.f.name))||a.i-b.i);
    for(const {f} of ordered){
      const bytes=await f.arrayBuffer();
      if(ext(f)==='pdf'){
        const source=await PDFLib.PDFDocument.load(bytes);
        if(source.getForm().getFields().length)source.getForm().flatten();
        const pages=await out.copyPages(source,source.getPageIndices());pages.forEach(p=>out.addPage(p));
      }else{
        let png=bytes;
        if(ext(f)==='webp'){
          const bitmap=await createImageBitmap(f),canvas=document.createElement('canvas');canvas.width=bitmap.width;canvas.height=bitmap.height;canvas.getContext('2d').drawImage(bitmap,0,0);bitmap.close();
          png=await (await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(Error('Falha ao converter imagem.')),'image/png'))).arrayBuffer();
        }
        const img=['jpg','jpeg'].includes(ext(f))?await out.embedJpg(bytes):await out.embedPng(png);
        const scale=Math.min(555/img.width,802/img.height,1),w=img.width*scale,h=img.height*scale;
        const page=out.addPage([595,842]);page.drawImage(img,{x:(595-w)/2,y:(842-h)/2,width:w,height:h});
      }
    }
    return new File([await out.save()], 'Nota-e-boleto.pdf',{type:'application/pdf'});
  }
  async function readDoc(d){
    let blob;
    if(d.storagePath){const result=await db.storage.from(d.bucket||'pagamentos').download(d.storagePath);if(result.error)throw result.error;blob=result.data;}
    else{const url=d.dataUrl||d.url||d._signedUrl;if(!url)throw Error('Arquivo sem endereco: '+d.name);const r=await fetch(url);if(!r.ok)throw Error('Nao foi possivel ler '+d.name);blob=await r.blob();}
    return new File([blob],d.name||d.storagePath.split('/').pop(),{type:blob.type});
  }
  async function stage(oid,p,files){
    const next={...p,docs:paymentAllDocs(p).map(d=>({...d}))};const selected=[];
    for(const f of files){
      const sha256=await paymentFileSha256(f);
      let doc=next.docs.find(d=>sha256&&d.sha256===sha256);
      if(!doc){
        const budget=/or[cç]amento/i.test(p.nfTipo||'');
        const kind=ext(f)==='xml'?'XML':(/boleto/i.test(f.name)?'BOLETO':visual(f)?(budget?'ORCAMENTO':'NF'):'DOCUMENTO');
        const storagePath=await uploadPagDoc(oid,f,kind.toLowerCase());
        doc={name:f.name,type:f.type||inferType(f.name),size:f.size,storagePath,bucket:'pagamentos',kind,sha256};next.docs.push(doc);
      }
      selected.push({doc,file:f});
    }
    const sources=next.docs.filter(eligible).sort((a,b)=>Number(charge(a))-Number(charge(b)));
    const input=[];for(const d of sources)input.push(selected.find(s=>s.doc===d)?.file||await readDoc(d));
    if(input.length){
      const kind=sources.some(d=>paymentDocKindLabel(d)==='NF')?'NF':sources.some(d=>paymentDocKindLabel(d)==='ORCAMENTO')?'ORCAMENTO':paymentDocKindLabel(sources[0]);
      const pdf=await merge(input),merged=new File([pdf],kind==='ORCAMENTO'?'Orcamento-e-boleto.pdf':kind==='BOLETO'?'Boletos.pdf':pdf.name,{type:'application/pdf'}),storagePath=await uploadPagDoc(oid,merged,'nota-boleto');
      const bundle={name:merged.name,type:'application/pdf',bucket:'pagamentos',kind,storagePath,generatedBundle:true,bundleSources:sources.map(paymentDocKey)};
      next.docs=next.docs.filter(d=>!d.generatedBundle);next.docs.push(bundle);next.nfDoc=bundle;
    }
    next._heavyLoaded=true;hydratePaymentDocs(next);return next;
  }
  async function saveExisting(oid,p,files){
    if(!p.dbId)throw Error('Atualize a pagina antes de anexar a este pagamento.');
    const response=await db.from('pagamentos').select('id,docs_json,parcelas,itens_pag,nf_doc_path,comp_doc_path').eq('id',p.dbId).eq('obra_id',oid).single();if(response.error)throw response.error;
    const before=response.data,base=applyPaymentHeavyRow({...p},before),next=await stage(oid,base,files);
    let query=db.from('pagamentos').update({docs_json:paymentAllDocs(next),nf_doc_path:next.nfDoc?.storagePath||''}).eq('id',p.dbId).eq('obra_id',oid);
    query=before.docs_json===null?query.is('docs_json',null):query.eq('docs_json',JSON.stringify(before.docs_json));
    query=before.nf_doc_path===null?query.is('nf_doc_path',null):query.eq('nf_doc_path',before.nf_doc_path);
    const saved=await query.select('id');if(saved.error)throw saved.error;if(!saved.data?.length)throw Error('Os anexos mudaram em outra sessao. Atualize a pagina e tente novamente.');
    Object.assign(p,{docs:next.docs,nfDoc:next.nfDoc,compDoc:next.compDoc,_heavyLoaded:true});return next;
  }
  function attach(oid,i){
    if(!AccessControl.canEdit()){toast('Sem permissao para anexar.');return;}
    const p=obras.find(o=>+o.id===+oid)?.pag?.[i];if(!p)return;
    const key=oid+':'+(p.dbId||i);if(locks.has(key)){toast('Envio em andamento.');return;}
    const input=document.createElement('input');input.type='file';input.multiple=true;input.accept='.pdf,.xml,.png,.jpg,.jpeg,.webp';
    input.onchange=async()=>{if(!input.files.length)return;locks.add(key);toast('Salvando originais e reunindo nota e boleto...');
      try{await saveExisting(oid,p,Array.from(input.files));if(cur&&+cur.id===+oid)renderObra();toast('Anexos salvos. PDF disponivel para visualizar e baixar.');}
      catch(e){toast('Anexos nao confirmados: '+(e.message||String(e)).slice(0,180));}
      finally{locks.delete(key);input.remove();}
    };input.click();
  }
  async function open(oid,i){
    try{
      const p=obras.find(o=>+o.id===+oid)?.pag?.[i];if(!p)return;await ensurePaymentHeavyFields(p);
      const docs=paymentAllDocs(p),bundle=docs.find(d=>d.generatedBundle);
      if(bundle){await viewFile(bundle);return;}
      const sources=docs.filter(eligible);if(!sources.length){await openPaymentDocsModal(oid,i);return;}
      if(sources.length===1){await viewFile(sources[0]);return;}
      toast('Reunindo nota e boleto para visualizacao...');const files=[];for(const d of sources)files.push(await readDoc(d));
      const pdf=await merge(files);if(previewUrl)URL.revokeObjectURL(previewUrl);previewUrl=URL.createObjectURL(pdf);await viewFile({name:pdf.name,type:pdf.type,dataUrl:previewUrl});
    }catch(e){toast('Nao foi possivel abrir os anexos: '+(e.message||String(e)).slice(0,160));}
  }
  async function insert(oid,payments){
    const rows=payments.map(p=>({obra_id:oid,ben:p.ben||'',v:p.v||0,ref:p.ref||'',nf_num:cleanImpDocNumber(p.nfNum||'',p.nfTipo||''),cat:p.cat||'outros',sub:p.sub||0,pagn:p.pagn||'',st:p.st||'PENDENTE',venc:p.venc||'',nf_tipo:p.nfTipo||'Sem nota',comp:p.comp||'',nf_doc_path:p.nfDoc?.storagePath||'',comp_doc_path:p.compDoc?.storagePath||'',docs_json:paymentAllDocs(p),emissao:p.emissao||'',paga_em:p.pagaEm||'',escopo_fin:p.escopoFin||'obra',contrato_seq:p.contratoSeq||null,tipo_custo:p.tipoCusto||'',mat_tipo:p.matTipo||'',mat_qtd:p.matQtd||null,mat_unidade:p.matUnidade||'',chave:p.chave||'',obs:p.obs||'',pag_forma:p.pagForma||'A_VISTA',parcelas:p.parcelas||null,itens_pag:p.itens||null,construtora_seq:p.construtora_seq||null,ticket_raiz:p.ticketRaiz||'',compra_vinculada_json:paymentCompraLink(p)}));
    const result=await db.from('pagamentos').insert(rows).select('id');if(result.error)throw result.error;
    if(result.data?.length!==payments.length)throw Error('Confirmacao de gravacao incompleta. Atualize a pagina antes de tentar novamente.');
    payments.forEach((p,i)=>{p.dbId=result.data[i].id;p._heavyLoaded=true;});
  }
  root.PaymentBundle={merge,stage,saveExisting,attach,open,insert,confirming:false};
})(typeof window==='undefined'?globalThis:window);
