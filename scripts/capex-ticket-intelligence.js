(function(root){
  'use strict';
  const norm=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
  const key=v=>norm(v).replace(/ /g,'');
  const unique=xs=>[...new Set(xs.filter(Boolean))];
  function clean(value){
    return String(value??'').replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi,'')
      .replace(/<\s*br\s*\/?\s*>|<\/\s*(?:p|div|li|tr|h[1-6])\s*>/gi,'\n')
      .replace(/<[^>]+>/g,' ')
      .replace(/&(#x[0-9a-f]+|#\d+|nbsp|amp|lt|gt|quot|apos);/gi,(_,entity)=>{
        const e=entity.toLowerCase();
        if(e[0]==='#'){
          const n=e[1]==='x'?parseInt(e.slice(2),16):parseInt(e.slice(1),10);
          return n>0&&n<=0x10ffff?String.fromCodePoint(n):'';
        }
        return {nbsp:' ',amp:'&',lt:'<',gt:'>',quot:'"',apos:"'"}[e];
      }).replace(/\u00a0/g,' ').replace(/[ \t\r\f\v]+/g,' ')
      .replace(/ *\n */g,'\n').replace(/\n{3,}/g,'\n\n').trim();
  }
  function values(value){
    if(value==null)return[];
    if(Array.isArray(value))return value.flatMap(values);
    if(typeof value==='object'){
      for(const k of ['displayValue','text','label','value','name','description']){
        const result=values(value[k]);
        if(result.length)return result;
      }
      return[];
    }
    const text=clean(String(value).replace(/<([^<>\s]+@[^<>\s]+)>/g,'($1)'));
    return text&&!['null','undefined','[object Object]'].includes(text)?[text]:[];
  }
  function fieldValues(z,names){
    const entries=[];
    for(const bag of [z?.campos_extraidos,z?.campos,z?.ticket_raiz_dados?.campos]){
      if(bag&&typeof bag==='object')for(const [name,value] of Object.entries(bag))entries.push({names:[key(name)],value});
    }
    for(const rows of [z?.raw_fields,z?.rawFields,z?.formFields,z?.raw_instance?.formFields]){
      if(!Array.isArray(rows))continue;
      for(const row of rows){
        if(!row||typeof row!=='object')continue;
        entries.push({names:[row.name,row.label,row.fieldName,row.title].map(key),value:row.displayValue||row.value||row.text});
      }
    }
    return unique(names.flatMap(name=>entries.filter(e=>e.names.includes(key(name))).flatMap(e=>values(e.value))));
  }
  const first=(z,names)=>fieldValues(z,names)[0]||'';
  function firstGroup(z,names){
    for(const name of names){
      const found=fieldValues(z,[name]);
      if(found.length)return found.join('\n');
    }
    return'';
  }
  const email=v=>{
    const found=String(v??'').match(/[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9](?:[A-Z0-9.-]*[A-Z0-9])?\.[A-Z]{2,}/gi)||[];
    return unique(found.map(s=>s.toLowerCase())).length===1?found[0].toLowerCase():'';
  };
  function requester(z){
    z=z||{};
    const person=z.requester||z.raw_instance?.requester||z.solicitante||{};
    const personField=first(z,['nomeSolicitante','nomeDoSolicitante','solicitante','requisitante','nomeRequisitante','usuarioSolicitante']);
    const rawName=[z.requester_name,person.name,person.nome,person.fullName,personField]
      .flatMap(values).find(v=>!/^\s*(?:\d+|null|undefined|nao informado|n\/a|-+)\s*$/i.test(norm(v)))||'';
    const embeddedEmail=email(rawName);
    const nome=rawName.replace(/<[^>]*@[^>]*>/g,'').replace(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi,'').replace(/[<>()[\]]/g,'').trim();
    const emailAddress=email(z.requester_email)||email(person.email)||
      email(first(z,['emailSolicitante','emailDoSolicitante','e-mail do solicitante','emailRequisitante','emailDoRequisitante']))||
      embeddedEmail||email(z.requester_username)||email(person.username);
    const equipe=clean(z.requester_team||person.team?.name||person.equipe||first(z,['equipeSolicitante','departamentoSolicitante']));
    return {nome:/^(?:\d+|null|undefined|nao informado)$/i.test(nome)?'':nome,email:emailAddress,equipe};
  }
  const COST_FIELDS=['codigoDoCentroDeCusto','codigoCentroCusto','codCentroCusto','centroDeCusto','centroCusto','centro de custos','centro custos'];
  const UNIT_FIELDS=['unidadeEscolar','unidade','escola','filialDeDestino','filial','localEntrega','localDeEntrega','unidadeSolicitante'];
  const CNPJ_FIELDS=['cnpjFilial','cnpjDaFilial','cnpjColigada','cnpjDaColigada','cnpjUnidade','cnpjDaUnidade','cnpjEscola','cnpjDaEscola'];
  const canonical=v=>norm(v).replace(/\b(?:colegio|escola|educacao|global school|unidade)\b/g,' ').replace(/\bgolfe\b/g,'golf').replace(/\bleo\b/g,'leonardo da vinci').replace(/\s+/g,' ').trim();
  const includes=(text,term)=>!!term&&(' '+text+' ').includes(' '+term+' ');
  function recoveredItemDescriptions(z){
    const rows=new Map();
    for(const fields of [z?.raw_fields,z?.rawFields,z?.formFields,z?.raw_instance?.formFields]){
      for(const f of Array.isArray(fields)?fields:[]){
        const row=String(f.row||1),bag=rows.get(row)||{};
        for(const name of [f.name,f.label])if(name)bag[name]=f.value;
        rows.set(row,bag);
      }
    }
    const recover=bag=>{
      const source={campos_extraidos:bag};
      const description=firstGroup(source,['item','itemMedicamento']);
      if(/[a-z]/.test(norm(description)))return[];
      return fieldValues(source,['quantidadeItem','quantidadeMedicamento'])
        .filter(v=>/[a-z]/.test(norm(v))&&norm(v).split(' ').length>=2&&!/^\d+(?:[.,]\d+)?\s*(?:un|und|unid|unidade|unidades|peca|pecas|caixa|caixas|kg|m|m2|litro|litros)\.?$/i.test(norm(v)));
    };
    if(rows.size)return unique([...rows.values()].flatMap(recover));
    return recover(z?.campos_extraidos||z?.campos||{});
  }
  function costCodes(text){
    return unique((String(text||'').match(/\b\d{1,4}(?:\.\d{1,6}){1,5}\b|\b\d{5,12}\b/g)||[]));
  }
  function indexRegistrations(registered){
    const codes=new Map(),refs=new Map();
    const append=(map,k,names)=>map.set(k,unique([...(map.get(k)||[]),...names]));
    for(const it of registered){
      const names=unique([it.unidade,...(Array.isArray(it.unidades_json)?it.unidades_json:[])]).filter(n=>typeof n==='string');
      const ref=String(it.ticket_raiz_instance_id||it.referencia||'').replace(/^TR\s*/i,'').trim();
      if(/^\d+$/.test(ref))append(refs,ref,names);
      if(it.ticket_raiz_dados?.rateio?.ativo||names.length!==1)continue;
      for(const text of fieldValues(it.ticket_raiz_dados||{},COST_FIELDS)){
        for(const code of costCodes(text))append(codes,code,names);
      }
    }
    return{codes,refs};
  }
  function inferUnit(z,units,registered=[],index){
    const catalog=units.filter(u=>u?.nome);
    index=index||indexRegistrations(registered);
    const hits=[];
    const add=(rows,source,level)=>{if(rows.length)hits.push({rows:unique(rows.map(u=>u.nome)),source,level});};
    const match=text=>{
      const t=canonical(text);
      if(!t)return[];
      const exact=catalog.filter(u=>canonical(u.nome)===t);
      if(exact.length)return exact;
      return catalog.filter(u=>{
        const name=canonical(u.nome),brand=canonical(u.marca);
        const aliases=[name,...(Array.isArray(u.aliases)?u.aliases.map(canonical):[])];
        if(name.includes('marapendi'))aliases.push(name.replace('marapendi','abm'));
        if(name.includes('barra golf'))aliases.push(name.replace('barra golf','golf'));
        if(aliases.some(a=>a.split(' ').length>1&&includes(t,a)))return true;
        const distinct=name.split(' ').filter(w=>w.length>2&&!['sao','santa','santo','centro','expansao'].includes(w)&&!brand.split(' ').includes(w));
        return !!brand&&includes(t,brand)&&distinct.length>0&&distinct.every(w=>includes(t,w));
      });
    };
    const unitTexts=unique([...fieldValues(z,UNIT_FIELDS),...values(z?.unidade)]);
    for(const text of unitTexts)add(match(text),'Unidade informada no ticket',3);
    const costTexts=fieldValues(z,COST_FIELDS);
    for(const text of costTexts)add(match(text),'Centro de custo',3);
    const codes=unique(costTexts.flatMap(costCodes));
    if(codes.length){
      add(catalog.filter(u=>values(u.centro_custo||u.centros_custo||u.codigo_centro_custo).some(v=>costCodes(v).some(c=>codes.includes(c)))),'Codigo do centro de custo',3);
      const mapped=codes.flatMap(c=>index.codes.get(c)||[]);
      add(catalog.filter(u=>mapped.some(n=>canonical(n)===canonical(u.nome))),'Centro de custo em registros anteriores',2);
    }
    const cnpjs=fieldValues(z,CNPJ_FIELDS).flatMap(v=>v.match(/\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}|\b\d{14}\b/g)||[]).map(v=>v.replace(/\D/g,''));
    add(catalog.filter(u=>u.cnpj&&cnpjs.includes(String(u.cnpj).replace(/\D/g,''))),'CNPJ da unidade',2);
    const tr=String(z?.zeev_instance_id||'').replace(/\D/g,'');
    const linked=fieldValues(z,['ticketRaizCompra','ticketDeCompra','numeroTicketCompra','ticketCompra','solicitacaoDeCompra','ticketRaizDeOrigem','ticketOrigem']);
    const refs=unique([tr,...linked.filter(v=>/^(?:TR\s*[-:#]?\s*)?\d+$/i.test(v)).map(v=>v.replace(/\D/g,''))]);
    const linkedNames=refs.flatMap(r=>index.refs.get(r)||[]);
    add(catalog.filter(u=>linkedNames.some(n=>canonical(n)===canonical(u.nome))),'Ticket registrado ou compra vinculada',2);
    add(match(z?.requester_team||z?.requester?.team?.name||''),'Equipe do solicitante',1);
    add(match(z?.pedido||''),'Descricao do ticket',1);
    const strong=hits.filter(h=>h.level===3);
    const useful=strong.length?strong:hits.filter(h=>h.level===2).length?hits.filter(h=>h.level===2):hits;
    if(!useful.length)return{unidade:'',source:'Unidade nao identificada',candidates:[],confidence:'missing'};
    // Disagreement between explicit fields must never be hidden by a score.
    const names=unique(useful.flatMap(h=>h.rows));
    let candidates=names;
    if(!strong.length&&useful.length>1){
      const intersection=names.filter(n=>useful.every(h=>h.rows.includes(n)));
      if(intersection.length)candidates=intersection;
    }
    return{unidade:candidates.length===1?candidates[0]:'',source:unique(useful.map(h=>h.source)).join(' + '),candidates,confidence:candidates.length===1?(strong.length?'high':'suggested'):'ambiguous'};
  }
  const api={norm,clean,values,fieldValues,first,firstGroup,email,requester,inferUnit,indexRegistrations,recoveredItemDescriptions,costCodes,COST_FIELDS};
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.CapexTicketIntelligence=api;
})(typeof globalThis!=='undefined'?globalThis:this);
