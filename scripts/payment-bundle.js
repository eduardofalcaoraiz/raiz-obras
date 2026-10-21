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
    try{
    const input=[];for(const d of sources)input.push(selected.find(s=>s.doc===d)?.file||await readDoc(d));
    if(input.length){
      const kind=sources.some(d=>paymentDocKindLabel(d)==='NF')?'NF':sources.some(d=>paymentDocKindLabel(d)==='ORCAMENTO')?'ORCAMENTO':paymentDocKindLabel(sources[0]);
      const pdf=await merge(input),merged=new File([pdf],kind==='ORCAMENTO'?'Orcamento-e-boleto.pdf':kind==='BOLETO'?'Boletos.pdf':pdf.name,{type:'application/pdf'}),storagePath=await uploadPagDoc(oid,merged,'nota-boleto');
      const bundle={name:merged.name,type:'application/pdf',bucket:'pagamentos',kind,storagePath,generatedBundle:true,bundleSources:sources.map(paymentDocKey)};
      next.docs=next.docs.filter(d=>!d.generatedBundle);next.docs.push(bundle);next.nfDoc=bundle;
    }
    }catch(e){
      // A derived preview must never prevent original attachments from being saved.
      next.docs=next.docs.filter(d=>!d.generatedBundle);
      next.nfDoc=sources[0]||null;
      next.bundleWarning='Originais salvos separadamente. '+(/encrypt|password/i.test(e.message||'')?'Um PDF esta protegido e nao pode ser combinado.':'Nao foi possivel gerar o PDF combinado.')+' Use a lista de arquivos para visualizar ou baixar cada anexo.';
    }
    next._fiscalFiles=selected.map(s=>s.file);
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
    Object.assign(p,{docs:next.docs,nfDoc:next.nfDoc,compDoc:next.compDoc,_heavyLoaded:true});
    next.invoiceRead=await enrichExisting(oid,p,files);
    if(next.bundleWarning)next.invoiceRead.warning=[next.bundleWarning,next.invoiceRead.warning].filter(Boolean).join(' ');
    return next;
  }
  const fiscalTypes=new Set(['NF-e','NFC-e','NFS-e','CT-e']);
  const blank=v=>v==null||String(v).trim()==='';
  const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/gi,'').toLowerCase();
  const taxId=v=>String(v||'').replace(/\D/g,'');
  const receiptStub=items=>Array.isArray(items)&&items.length>0&&items.every(it=>/produtos constantes da nota fiscal|identifica[cç][aã]o e assinatura do recebedor/i.test(it.descricao||'')&&!(Number(it.valor_total)>0));
  function validAccessKey(value){
    const key=taxId(value);if(key.length!==44||!['55','65','57'].includes(key.slice(20,22)))return false;
    let sum=0,weight=2;for(let i=42;i>=0;i--){sum+=Number(key[i])*weight;weight=weight===9?2:weight+1;}
    const rest=sum%11;return Number(key[43])===(rest<2?0:11-rest);
  }
  function keyFromText(text){
    const candidates=String(text).match(/\b(?:\d{4}[ \t]+){10}\d{4}\b|\b\d{44}\b/g)||[];
    return candidates.map(taxId).find(validAccessKey)||'';
  }
  function identifyByKey(data,key){
    return {...data,chave:key,cnpj:key.slice(6,20),doc:String(Number(key.slice(25,34))),serie:String(Number(key.slice(22,25))),tipo:key.slice(20,22)==='65'?'NFC-e':key.slice(20,22)==='57'?'CT-e':'NF-e'};
  }
  function consultationWindow(key,now=new Date()){
    const parts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now).filter(p=>p.type!=='literal').map(p=>[p.type,p.value]));
    const current=Number(parts.year)*12+Number(parts.month)-1,issued=(2000+Number(key.slice(2,4)))*12+Number(key.slice(4,6))-1;
    return issued===current||(Number(parts.day)<15&&issued===current-1);
  }
  async function retrieveFiscalFiles(oid,notes,existing,warnings,paymentId){
    const documents=[],seen=new Set();
    for(const note of notes){
      const key=taxId(note.chave);
      if(!validAccessKey(key)||key.slice(20,22)!=='55'||seen.has(key))continue;seen.add(key);
      if(existing.some(d=>ext(d)==='xml'&&(d.accessKey===key||d.invoiceIdentity?.accessKey===key))||notes.some(n=>ext({name:n.sourceName})==='xml'&&taxId(n.chave)===key))continue;
      if(!consultationWindow(key)){note.xmlStatus='Fora da janela de consulta gratuita';continue;}
      try{
        const session=await db.auth.getSession();
        if(!session.data?.session?.access_token)throw Error('Sessao expirada');
        const response=await fetch('/api/fiscal_xml',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+session.data.session.access_token},body:JSON.stringify({chave:key,payment_id:paymentId,obra_id:oid}),signal:AbortSignal.timeout(45000)});
        if(!response.ok)throw Error(response.status===429?'Limite do servico atingido; tente mais tarde':'Consulta indisponivel (HTTP '+response.status+')');
        const result=await response.json();
        if(result.status!=='ok'||result.chave!==key||!result.xml_base64)throw Error('XML nao retornado para esta chave');
        const decode=value=>{if(typeof value!=='string'||value.length>8*1024*1024)throw Error('Arquivo fora do limite');return Uint8Array.from(atob(value),c=>c.charCodeAt(0));};
        const xmlBytes=decode(result.xml_base64),xmlText=new TextDecoder().decode(xmlBytes);
        if(/<!DOCTYPE|<!ENTITY/i.test(xmlText))throw Error('XML com declaracao nao permitida');
        const parsed=parseNFeXML(xmlText);
        if(!parsed||taxId(parsed.chave)!==key||taxId(parsed.cnpj)!==key.slice(6,20)||!(Number(parsed.val)>0))throw Error('XML divergente da chave consultada');
        const xml=new File([xmlBytes],'NF-'+Number(key.slice(25,34))+'-'+key+'.xml',{type:'application/xml'});
        const storagePath=await uploadPagDoc(oid,xml,'xml');
        const xmlDoc={name:xml.name,type:xml.type,size:xml.size,storagePath,bucket:'pagamentos',kind:'XML',accessKey:key,source:'consultadanfe.com',retrievedAt:new Date().toISOString()};
        documents.push(xmlDoc);
        for(const n of notes)if(taxId(n.chave)===key)Object.assign(n,parsed,{xmlStatus:'XML obtido no Consulta DANFE'});
        notes.push({...parsed,sourceName:xml.name,xmlStatus:'XML obtido no Consulta DANFE'});
        if(result.pdf_base64&&!existing.some(d=>d.source==='consultadanfe.com'&&d.accessKey===key&&ext(d)==='pdf')){
          const bytes=decode(result.pdf_base64);
          if(new TextDecoder().decode(bytes.slice(0,5))!=='%PDF-')throw Error('PDF retornado em formato invalido');
          const pdf=new File([bytes],'DANFE-'+Number(key.slice(25,34))+'-'+key+'.pdf',{type:'application/pdf'});
          const path=await uploadPagDoc(oid,pdf,'nf');documents.push({name:pdf.name,type:pdf.type,size:pdf.size,storagePath:path,bucket:'pagamentos',kind:'NF',accessKey:key,source:'consultadanfe.com',retrievedAt:new Date().toISOString()});
          notes.push({...parsed,sourceName:pdf.name,xmlStatus:'XML obtido no Consulta DANFE'});
        }
      }catch(e){note.xmlStatus='XML nao obtido';warnings.push('NF '+note.doc+': '+(e.message||'Falha na consulta XML')+'. Leitura do anexo preservada.');}
    }
    return documents;
  }
  function nationalServiceInvoice(text){
    const t=String(text).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^\S\n]+/g,' ').trim();
    if(!/Documento Auxiliar da NFS-e/i.test(t)||!/EMITENTE DA NFS-e/i.test(t))return null;
    const doc=t.match(/Numero da NFS-e[^\n]*\n\s*(\d+)/i)?.[1];
    const issuer=t.split(/EMITENTE DA NFS-e/i)[1]?.split(/TOMADOR DO SERVICO/i)[0]||'';
    const cnpj=issuer.match(/\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/)?.[0];
    const dates=t.split(/Numero da NFS-e/i)[1]?.split(/Numero da DPS/i)[0]?.match(/\d{2}\/\d{2}\/\d{4}/g)||[];
    const totals=t.split(/VALOR TOTAL DA NFS-E/i)[1]||'';
    const amount=totals.match(/Valor do Servico[^\n]*\n\s*R\$\s*([\d.]+,\d{2})/i)?.[1];
    if(!doc||!cnpj||!dates.length||!amount)return null;
    const val=Number(amount.replace(/\./g,'').replace(',','.'));
    if(!(val>0))return null;
    const date=dates[dates.length-1].split('/').reverse().join('-');
    const ben=t.match(/Recebemos de (.+?), os servicos/i)?.[1]||issuer.match(/Nome \/ Nome empresarial[^\n]*\n\s*([^\n]+)/i)?.[1]||'';
    const descricao=t.match(/Descricao do Servico\s*\n([\s\S]*?)\n\s*TRIBUTACAO MUNICIPAL/i)?.[1]?.trim()||'';
    return {tipo:'NFS-e',doc,cnpj,ben,date,val,subtotal:val,chave:t.match(/Chave de Acesso da NFS-e\s*\n\s*(\d{50}|\d{48})\b/i)?.[1]||'',itens:descricao?[{descricao,quantidade:1,unidade:'SERV',valor_total:val}]:[]};
  }
  async function readFiscal(file){
    if(ext(file)==='xml')return parseNFeXML(await file.text());
    let keyedFallback=null;
    if(ext(file)==='pdf'&&typeof extractPdfText==='function'){
      try{
        const text=await extractPdfText(file);
        const service=nationalServiceInvoice(text);if(service)return service;
        const key=keyFromText(text);
        if(text.length>100&&!key&&/or[cç]amento/i.test(text)&&!/danfe/i.test(text))return null;
        let local=parseNFFromText(text);
        if(key){local=identifyByKey(local,key);const name=text.match(/RECEBEMOS DE\s*:?\s*(?:\d+\s+)?(.+?)\s+OS PRODUTOS/i);if(name)local.ben=name[1].trim();}
        // Some DANFEs place the ICMS base where other layouts show item discounts.
        if(Number(local.desconto)===0)for(const item of local.itens||[])item.desconto=0;
        const itemTotal=(local.itens||[]).reduce((sum,it)=>sum+(Number(it.valor_total)||0),0);
        const balanced=local.subtotal>0&&Math.abs(itemTotal-local.subtotal)<0.02&&Math.abs(itemTotal-(local.desconto||0)+(local.frete||0)-local.val)<0.02;
        if(key&&local.doc&&local.val>0&&balanced&&!receiptStub(local.itens))return local;
        if(key&&local.doc&&local.val>0)keyedFallback={...local,itens:[],xmlStatus:'Itens pendentes de conferencia; identificacao extraida da chave de acesso'};
        if(/or[cç]amento/i.test(text)&&!/danfe|nota fiscal|chave de acesso/i.test(text))return null;
      }catch(e){console.warn('Leitura local indisponivel:',e.message);}
    }
    let timer,data;
    try{data=await Promise.race([readInvoiceWithAI(file),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Tempo limite de leitura da nota.')),40000);})]);}
    catch(e){if(keyedFallback)return keyedFallback;throw e;}
    finally{clearTimeout(timer);}
    if(data&&['NF-e','NFC-e','CT-e'].includes(data.tipo)){
      if(!validAccessKey(data.chave))return keyedFallback;
      Object.assign(data,identifyByKey(data,taxId(data.chave)));
    }
    if(data&&receiptStub(data.itens))data.itens=[];
    return data;
  }
  function invoiceKey(x){return taxId(x.accessKey).length===44?taxId(x.accessKey):[taxId(x.issuerCnpj),norm(x.type||'NF-e'),norm(x.series),norm(String(x.invoiceNumber).replace(/^0+/,''))].join(':');}
  function invoices(p){
    const identities=(p.docs||[]).filter(d=>!d.generatedBundle&&d.invoiceIdentity).map(d=>d.invoiceIdentity);
    const unique=new Map();
    for(const x of identities){const key=invoiceKey(x),old=unique.get(key);if(!old||(x.items?.length||0)>(old.items?.length||0))unique.set(key,x);}
    return [...unique.values()];
  }
  function identityDetails(p){
    const unique=invoices(p),money=v=>Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
    const total=unique.reduce((s,x)=>s+(Number(x.total)||0),0),remaining=Number(p.v||0)-total;
    const summary=unique.length?`<div style="grid-column:1/-1"><strong>${unique.length} nota(s) fiscal(is) | Total documentado: ${money(total)}</strong><div>Valor do pagamento: ${money(p.v)} | ${remaining>=0?'A documentar: '+money(remaining):'Notas acima do pagamento: '+money(-remaining)}</div></div>`:'';
    return summary+unique.map(x=>{
      const different=x.status==='different';
      const label=different?'CNPJs diferentes: pagamento e emissao da NF. Vinculo a conferir.':x.status==='matched'?'Mesmo CNPJ no pagamento e na NF.':'CNPJ incompleto: identificacao a conferir.';
      const money=v=>Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
      const formatted=v=>taxId(v).length===14?taxId(v).replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,'$1.$2.$3/$4-$5'):'Nao identificado';
      const totals=x.subtotal>0?`<div>Produtos: ${money(x.subtotal)} | Desconto: ${money(x.discount)} | Frete: ${money(x.freight)} | Total da NF: ${money(x.total)}</div>`:'';
      const date=/^\d{4}-\d{2}-\d{2}$/.test(x.date||'')?x.date.split('-').reverse().join('/'):'Nao identificada';
      const items=Array.isArray(x.items)&&x.items.length?`<div style="overflow-x:auto;margin-top:8px"><table style="width:100%;border-collapse:collapse;font-size:13px"><thead><tr><th style="text-align:left">Itens da NF ${escHtml(x.invoiceNumber)}</th><th>Qtd.</th><th>Un.</th><th style="text-align:right">Total</th></tr></thead><tbody>${x.items.map(it=>`<tr><td style="padding:5px 0;border-top:1px solid #ddd">${escHtml(it.descricao||'')}</td><td style="text-align:center">${escHtml(String(it.quantidade??''))}</td><td style="text-align:center">${escHtml(it.unidade||'')}</td><td style="text-align:right;white-space:nowrap">${money(it.valor_total)}</td></tr>`).join('')}</tbody></table></div>`:'';
      return `<section style="grid-column:1/-1;font-size:14px;min-width:0;border-top:1px solid #ddd;padding-top:10px"><strong>${escHtml(x.type||'NF')} ${escHtml(x.invoiceNumber)} | Emissao: ${date} | ${money(x.total)}</strong><div>${escHtml(label)}</div><div>Beneficiario do pagamento: ${escHtml(x.payeeName)} | CNPJ: ${formatted(x.payeeCnpj)}</div><div>Emitente: ${escHtml(x.issuerName)} | CNPJ: ${formatted(x.issuerCnpj)}</div>${totals}${x.xmlStatus?`<div style="margin-top:4px;color:var(--muted)">${escHtml(x.xmlStatus)}</div>`:''}${items}</section>`;
    }).join('');
  }
  function invoicePatch(row,data){
    const patch={};
    const put=(column,value)=>{if(blank(row[column])&&!blank(value))patch[column]=value;};
    // Financial totals, payer, due dates and paid status are never inferred here.
    put('nf_num',cleanImpDocNumber(data.doc||'',data.tipo));
    if(blank(row.nf_tipo)||['Sem nota','Adiantamento','ORÇAMENTO - COBRAR NF'].includes(row.nf_tipo))patch.nf_tipo=data.tipo;
    if(/^\d{4}-\d{2}-\d{2}$/.test(data.date||''))put('emissao',data.date);
    put('chave',data.chave);
    if((!row.itens_pag||Array.isArray(row.itens_pag)&&!row.itens_pag.length||receiptStub(row.itens_pag))&&Array.isArray(data.itens)&&data.itens.length&&!receiptStub(data.itens))patch.itens_pag=data.itens;
    return patch;
  }
  async function enrichExisting(oid,p,files){
    const warnings=[],notes=[],nonFiscal=new Set();
    try{
      for(const file of [...files].sort((a,b)=>Number(ext(b)==='xml')-Number(ext(a)==='xml'))){
        if(ext(file)!=='xml'&&!visual(file))continue;
        try{
          const data=await readFiscal(file);
          if(data&&fiscalTypes.has(data.tipo)&&data.doc)notes.push({...data,sourceName:file.name});
          else if(data===null)nonFiscal.add(file.name);
        }catch(e){warnings.push(file.name+': '+(e.message||String(e)).slice(0,120));}
      }
      if(!notes.length)return {warning:'Arquivos salvos, mas a leitura nao identificou uma NF com numero. Use Reler NF ou confira os dados manualmente.'};
      const xmlNotes=new Map(notes.filter(n=>ext({name:n.sourceName})==='xml'&&validAccessKey(n.chave)).map(n=>[taxId(n.chave),n]));
      for(const note of notes){const xml=xmlNotes.get(taxId(note.chave));if(xml)Object.assign(note,xml,{sourceName:note.sourceName,xmlStatus:'Dados conferidos pelo XML anexado'});}
      const data=notes[0];
      // Re-read after OCR so edits made during the network request are preserved.
      const result=await db.from('pagamentos').select('*').eq('id',p.dbId).eq('obra_id',oid).single();
      if(result.error)throw result.error;
      const row=result.data;
      const downloaded=await retrieveFiscalFiles(oid,notes,row.docs_json||[],warnings,p.dbId);
      const supplier=await db.from('fornecedores_cnpj').select('nome,cnpj').eq('nome',row.ben||'').maybeSingle();
      if(supplier.error)throw supplier.error;
      const payeeCnpj=taxId(supplier.data?.cnpj);
      const identityFor=data=>{
      const issuerCnpj=taxId(data.cnpj);
      const identified=payeeCnpj.length===14&&issuerCnpj.length===14;
      const status=identified?(payeeCnpj===issuerCnpj?'matched':'different'):'unverified';
      const identity={payeeName:row.ben||'',payeeCnpj,issuerName:status==='matched'?(supplier.data.nome||row.ben):(data.ben||''),issuerCnpj,invoiceNumber:String(data.doc),type:data.tipo,series:data.serie||'',accessKey:data.chave||'',date:data.date||'',items:Array.isArray(data.itens)?data.itens:[],xmlStatus:data.xmlStatus||'',status,subtotal:Number(data.subtotal)||0,discount:Number(data.desconto)||0,freight:Number(data.frete)||0,total:Number(data.val)||0};
      if(status==='different')warnings.push('CNPJs diferentes: beneficiario do pagamento e emitente da NF foram mantidos separados. Vinculo a conferir.');
      if(status==='unverified')warnings.push('CNPJ incompleto: confira o beneficiario e o emitente. Nenhum fornecedor foi substituido.');
      return identity;
      };
      const budget=/or[cç]amento|adiantamento|sem nota/i.test(row.nf_tipo||'');
      const primary=notes.find(n=>norm(n.doc)===norm(row.nf_num))||data;
      const correctedPrimary=(row.docs_json||[]).some(d=>d.invoiceIdentity&&norm(d.invoiceIdentity.invoiceNumber)===norm(row.nf_num)&&(nonFiscal.has(d.name)||notes.some(n=>n.sourceName===d.name&&norm(n.doc)!==norm(row.nf_num))));
      const patch=blank(row.nf_num)||budget||correctedPrimary||norm(row.nf_num)===norm(primary.doc)?invoicePatch(row,primary):{};
      if(budget||correctedPrimary){patch.nf_num=cleanImpDocNumber(primary.doc,primary.tipo);patch.nf_tipo=primary.tipo;patch.emissao=primary.date||row.emissao;patch.chave=primary.chave||'';patch.itens_pag=primary.itens||[];}
      const sourceNames=new Set(notes.map(n=>n.sourceName));
      if(Array.isArray(row.docs_json)||downloaded.length){
        const docs=[...(row.docs_json||[]),...downloaded].map(d=>{
          if(!d.generatedBundle&&nonFiscal.has(d.name)&&d.invoiceIdentity){const clean={...d,kind:'ORCAMENTO'};delete clean.invoiceIdentity;return clean;}
          const note=notes.find(n=>n.sourceName===d.name);
          return !d.generatedBundle&&note?{...d,kind:ext(d)==='xml'?'XML':'NF',invoiceIdentity:identityFor(note),...(budget&&row.nf_num?{budgetReference:row.nf_num}:{})}:{...d};
        });
        for(const doc of docs){
          if(doc.generatedBundle&&doc.bundleSources?.some(key=>docs.some(d=>sourceNames.has(d.name)&&paymentDocKey(d)===key)))doc.kind='NF';
        }
        if(JSON.stringify(docs)!==JSON.stringify(row.docs_json))patch.docs_json=docs;
      }
      if(Object.keys(patch).length){
        let query=db.from('pagamentos').update(patch).eq('id',p.dbId).eq('obra_id',oid);
        // Compare all source fields, including identity, to reject concurrent edits.
        for(const column of new Set([...Object.keys(patch),'ben','nf_num'])){
          const value=row[column];
          query=value==null?query.is(column,null):query.eq(column,Array.isArray(value)?JSON.stringify(value):value);
        }
        const saved=await query.select('id');if(saved.error)throw saved.error;
        if(!saved.data?.length)throw Error('O cadastro mudou durante a leitura. Use Reler NF para tentar novamente.');
        const mapping={nf_num:'nfNum',nf_tipo:'nfTipo',emissao:'emissao',chave:'chave',itens_pag:'itens',docs_json:'docs'};
        for(const [column,value] of Object.entries(patch))p[mapping[column]]=value;
        if(patch.docs_json)hydratePaymentDocs(p);
      }
      const all=invoices({docs:patch.docs_json||row.docs_json||[]});
      const total=all.length?all.reduce((s,n)=>s+n.total,0):Number(data.val);
      if(total&&Math.abs(Number(row.v)-total)>0.01)warnings.push(total<Number(row.v)?'Documentacao parcial: outras notas podem ser anexadas a este pagamento. Valor cadastrado preservado.':'O total das notas excede o valor do pagamento; confira os vinculos. Valor cadastrado preservado.');
      if(notes.some(n=>!n.date||!n.itens?.length))warnings.push('A leitura ficou parcial; confira emissao e itens.');
      return {updated:Object.keys(patch).length,warning:[...new Set(warnings)].join(' ')};
    }catch(e){return {warning:'Anexos preservados; dados fiscais nao atualizados: '+(e.message||String(e)).slice(0,180)};}
  }
  function reportRead(result){toast(result?.warning||'NF lida. Dados fiscais conferidos; campos existentes e valores preservados.');}
  async function reprocess(oid,i){
    if(!AccessControl.canEdit()){toast('Sem permissao para atualizar.');return;}
    const p=obras.find(o=>+o.id===+oid)?.pag?.[i];if(!p?.dbId)return;
    const key=oid+':'+p.dbId;if(locks.has(key)){toast('Leitura em andamento.');return;}locks.add(key);
    try{
      toast('Lendo os documentos fiscais anexados...');await ensurePaymentHeavyFields(p);
      let docs=paymentAllDocs(p).filter(d=>!d.generatedBundle&&!paymentIsProofDoc(d)&&(ext(d)==='xml'||visual(d)));
      const files=[];for(const d of docs)files.push(await readDoc(d));
      const result=await enrichExisting(oid,p,files);if(cur&&+cur.id===+oid)renderObra();reportRead(result);
    }catch(e){toast('Nao foi possivel reler a NF: '+(e.message||String(e)).slice(0,160));}
    finally{locks.delete(key);}
  }
  function attach(oid,i){
    if(!AccessControl.canEdit()){toast('Sem permissao para anexar.');return;}
    const p=obras.find(o=>+o.id===+oid)?.pag?.[i];if(!p)return;
    const key=oid+':'+(p.dbId||i);if(locks.has(key)){toast('Envio em andamento.');return;}
    const input=document.createElement('input');input.type='file';input.multiple=true;input.accept='.pdf,.xml,.png,.jpg,.jpeg,.webp';
    input.onchange=async()=>{if(!input.files.length)return;locks.add(key);toast('Salvando originais e reunindo nota e boleto...');
      try{const result=await saveExisting(oid,p,Array.from(input.files));if(cur&&+cur.id===+oid)renderObra();reportRead(result.invoiceRead);}
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
    }catch(e){toast('PDF combinado indisponivel. Abra ou baixe os originais na lista de arquivos.');await openPaymentDocsModal(oid,i);}
  }
  async function insert(oid,payments){
    const rows=payments.map(p=>({obra_id:oid,ben:p.ben||'',v:p.v||0,ref:p.ref||'',nf_num:cleanImpDocNumber(p.nfNum||'',p.nfTipo||''),cat:p.cat||'outros',sub:p.sub||0,pagn:p.pagn||'',st:p.st||'PENDENTE',venc:p.venc||'',nf_tipo:p.nfTipo||'Sem nota',comp:p.comp||'',nf_doc_path:p.nfDoc?.storagePath||'',comp_doc_path:p.compDoc?.storagePath||'',docs_json:paymentAllDocs(p),emissao:p.emissao||'',paga_em:p.pagaEm||'',escopo_fin:p.escopoFin||'obra',contrato_seq:p.contratoSeq||null,tipo_custo:p.tipoCusto||'',mat_tipo:p.matTipo||'',mat_qtd:p.matQtd||null,mat_unidade:p.matUnidade||'',chave:p.chave||'',obs:p.obs||'',pag_forma:p.pagForma||'A_VISTA',parcelas:p.parcelas||null,itens_pag:p.itens||null,construtora_seq:p.construtora_seq||null,ticket_raiz:p.ticketRaiz||'',compra_vinculada_json:paymentCompraLink(p)}));
    const result=await db.from('pagamentos').insert(rows).select('id');if(result.error)throw result.error;
    if(result.data?.length!==payments.length)throw Error('Confirmacao de gravacao incompleta. Atualize a pagina antes de tentar novamente.');
    payments.forEach((p,i)=>{p.dbId=result.data[i].id;p._heavyLoaded=true;});
    // New payments use the same enrichment as attachments on existing payments.
    for(const p of payments){
      if(p._fiscalFiles?.length)p.invoiceRead=await enrichExisting(oid,p,p._fiscalFiles);
      delete p._fiscalFiles;
      if(typeof paymentSnapshot==='function'){
        const fresh=await db.from('pagamentos').select('*').eq('id',p.dbId).single();
        if(!fresh.error&&fresh.data)paymentSnapshot({id:oid},p,fresh.data);
      }
    }
  }
  root.PaymentBundle={merge,stage,saveExisting,attach,open,insert,reprocess,enrichExisting,invoicePatch,identityDetails,invoices,keyFromText,validAccessKey,nationalServiceInvoice,readFiscal,consultationWindow,retrieveFiscalFiles,confirming:false};
})(typeof window==='undefined'?globalThis:window);
