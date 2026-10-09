'use strict';
const assert=require('node:assert/strict');
const test=require('node:test');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {stripTypeScriptTypes}=require('node:module');
const I=require('./capex-ticket-intelligence');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const inline=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]).find(s=>s.includes('const SUPA_URL'));
const fn=(source,name)=>{
  const start=source.search(new RegExp('^(?:async )?function '+name+'\\(', 'm'));
  assert.ok(start>=0,`Missing function: ${name}`);
  const end=source.indexOf('\n}',start)+2;
  return source.slice(start,end);
};
const context={CapexTicketIntelligence:I,console};
vm.createContext(context);
vm.runInContext('const capexNormText=CapexTicketIntelligence.norm;const escHtml=v=>String(v).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");const capexZeevType=z=>z.type||"compras";',context);
for(const name of ['CAPEX_ZEEV_PURCHASE_JUSTIFICATION_FIELDS','CAPEX_ZEEV_PURCHASE_SERVICE_FIELDS','CAPEX_ZEEV_PURCHASE_ITEM_FIELDS','CAPEX_ZEEV_FINANCE_REQUEST_FIELDS']){
  vm.runInContext(inline.match(new RegExp('const '+name+'=\\[[\\s\\S]*?\\];'))[0],context);
}
for(const name of ['capexZeevTrustedStoredFinanceDescription','capexZeevItemSummary','capexZeevDescriptionSections','capexZeevDescricaoLancamento','capexZeevDescriptionHtml','capexCheckPendingBeforeSave'])vm.runInContext(fn(inline,name),context);
const fields=values=>Object.entries(values).map(([name,value])=>({name,value,row:1}));
const notebook='Notebook Core i5 com 16 Gbs de Memoria Ram.';
const badTicket={pedido:'1',campos_extraidos:{item:'1',quantidadeItem:notebook},itens_json:[{row:1,descricao:'1'}]};

test('all application JavaScript parses',()=>new vm.Script(inline));
test('empty, structured and label-matched fields',()=>{
  const z={campos_extraidos:{nomeSolicitante:''},raw_fields:[{name:'opaque',label:'Nome do solicitante',value:{label:'Maria Silva'}}]};
  assert.equal(I.first(z,['nomeDoSolicitante']),'Maria Silva');
  assert.equal(I.firstGroup({campos_extraidos:{item:['Cadeira','Mesa']}},['item']),'Cadeira\nMesa');
  assert.deepEqual(I.values({id:42}),[]);
});
test('requester email is specific, validated and not the vendor email',()=>{
  assert.deepEqual(I.requester({campos_extraidos:{nomeSolicitante:'Charlles Oliveira',emailSolicitante:'Charlles@Example.com',email:'vendor@example.com'}}),{nome:'Charlles Oliveira',email:'charlles@example.com',equipe:''});
  assert.equal(I.requester({campos_extraidos:{email:'vendor@example.com'}}).email,'');
  assert.equal(I.requester({requester_name:'null',campos_extraidos:{nomeSolicitante:'Ana <ana@example.com>'}}).nome,'Ana');
  assert.equal(I.requester({requester_name:'Ana <ana@example.com>'}).email,'ana@example.com');
  assert.equal(I.email('a@example.com; b@example.com'),'');
});
const units=[{nome:'Cubo Global School Marapendi',marca:'Cubo'},{nome:'Cubo Global School Barra Golf',marca:'Cubo'},{nome:'QI Tijuca',marca:'QI'},{nome:'QI Valqueire',marca:'QI'}];
test('explicit cost center aliases resolve without matching unrelated words',()=>{
  assert.equal(I.inferUnit({campos_extraidos:{centroDeCusto:'CUBO GLOBAL SCHOOL - ABM'}},units).unidade,units[0].nome);
  assert.equal(I.inferUnit({campos_extraidos:{centroDeCusto:'3.07.006 - CUBO GLOBAL SCHOOL - GOLF'}},units).unidade,units[1].nome);
  assert.equal(I.inferUnit({pedido:'Servico do fornecedor Tijuca Ltda'},units).unidade,'');
});
test('contradictory unit evidence requires manual selection',()=>{
  const result=I.inferUnit({unidade:'QI Tijuca',campos_extraidos:{centroDeCusto:'QI Valqueire'}},units);
  assert.equal(result.unidade,'');assert.equal(result.confidence,'ambiguous');
});

test('219653-like explicit unit and description conflict stays unresolved',()=>{
  const catalog=[{nome:'Leonardo da Vinci Alfa',marca:'Leonardo da Vinci'},{nome:'Apogeu Vianna',marca:'Apogeu'}];
  const result=I.inferUnit({unidade:catalog[0].nome,pedido:'Laudo de avaliacao para o novo imovel do Apogeu Vianna - Avenida dos Andradas, 415'},catalog);
  assert.equal(result.unidade,'');
  assert.equal(result.confidence,'ambiguous');
  assert.deepEqual(result.candidates,catalog.map(u=>u.nome));
  assert.ok(result.source.includes('Unidade informada no ticket'));
  assert.ok(result.source.includes('Descricao do ticket'));
});

test('explicit unit cannot hide conflicting linked purchase evidence',()=>{
  const result=I.inferUnit({unidade:'QI Tijuca',campos_extraidos:{ticketCompra:'123456'}},units,[{referencia:'123456',unidade:'QI Valqueire'}]);
  assert.equal(result.unidade,'');assert.equal(result.confidence,'ambiguous');
  assert.deepEqual(result.candidates,['QI Tijuca','QI Valqueire']);
  assert.ok(result.source.includes('Ticket registrado ou compra vinculada'));
});

// Production catalog subset and cost-center mapping read on 2026-10-09; no Vianna unit exists.
const real219653Catalog=[
  {nome:'Colégio Leonardo da Vinci Alfa',marca:'LEONARDO DA VINCI'},
  ...['Cidade Alta','Ferreira Guimarães','Santo Antônio 1','Santo Antônio 2','Zona Norte'].map(s=>({nome:'Apogeu Global School '+s,marca:'APOGEU'}))
];
const real219653History=[{unidade:'Colégio Leonardo da Vinci Alfa',ticket_raiz_dados:{campos:{codigoDoCentroDeCusto:'3.06.002'}}}];
const real219653={zeev_instance_id:219653,unidade:null,
  pedido:'Laudo de avaliação para o novo imóvel do Apogeu Vianna - Endereço: Avenida dos Andradas, nº 415, Bairro: Centro, Cidade/Estado: Juiz de Fora MG, CEP: 36036-000',
  campos_extraidos:{codigoDoCentroDeCusto:'3.06.002',unidadeFilial2:'01 - COLÉGIO LEONARDO DA VINCI - ALFA - 09.262.835/0001-94'}
};
test('real 219653 cost-center evidence conflicts with destination brand without a Vianna unit',()=>{
  const result=I.inferUnit(real219653,real219653Catalog,real219653History);
  assert.equal(result.unidade,'');assert.equal(result.confidence,'ambiguous');
  assert.deepEqual(result.candidates,['Colégio Leonardo da Vinci Alfa']);
  assert.ok(result.source.includes('Centro de custo em registros anteriores'));
  assert.ok(result.source.includes('Marca de destino conflitante na descricao: apogeu'));
});
test('brand-only guard does not guess destinations or flag unrelated mentions',()=>{
  for(const pedido of ['Laudo para o imóvel do Leonardo da Vinci Alfa','Laudo do fornecedor Apogeu Vianna','Laudo para o imóvel do Apogeuzinho']){
    const result=I.inferUnit({...real219653,pedido},real219653Catalog,real219653History);
    assert.equal(result.unidade,'Colégio Leonardo da Vinci Alfa');
    assert.equal(result.confidence,'suggested');
  }
  const result=I.inferUnit({pedido:real219653.pedido},real219653Catalog);
  assert.equal(result.unidade,'');assert.equal(result.confidence,'missing');
});

test('historical unit cannot hide a conflicting description',()=>{
  const result=I.inferUnit({pedido:'Reforma QI Valqueire',campos_extraidos:{ticketCompra:'123456'}},units,[{referencia:'123456',unidade:'QI Tijuca'}]);
  assert.equal(result.unidade,'');assert.equal(result.confidence,'ambiguous');
  assert.deepEqual(result.candidates,['QI Tijuca','QI Valqueire']);
});

test('unambiguous exact and alias matches retain their confidence',()=>{
  const catalog=[...units,{nome:'Apogeu Vianna',marca:'Apogeu',aliases:['Apogeu Centro']}];
  for(const [text,name] of [['QI Tijuca','QI Tijuca'],['CUBO GLOBAL SCHOOL - ABM',units[0].nome],['Apogeu Centro','Apogeu Vianna']]){
    const result=I.inferUnit({unidade:text,pedido:'Reforma '+name},catalog);
    assert.equal(result.unidade,name);assert.equal(result.confidence,'high');
    assert.deepEqual(result.candidates,[name]);
  }
  assert.equal(I.inferUnit({pedido:'Reforma QI Tijuca'},units).confidence,'suggested');
});
test('cost code history and exact purchase reference, never a partial reference',()=>{
  const registered=[{referencia:'123456',unidade:units[0].nome,ticket_raiz_dados:{campos:{codigoDoCentroDeCusto:'3.07.999'}}}];
  assert.equal(I.inferUnit({campos_extraidos:{codigoDoCentroDeCusto:'3.07.999'}},units,registered).unidade,units[0].nome);
  assert.equal(I.inferUnit({campos_extraidos:{ticketCompra:'TR 123456'}},units,registered).unidade,units[0].nome);
  assert.equal(I.inferUnit({campos_extraidos:{ticketCompra:'3456'}},units,registered).unidade,'');
});
test('shared cost center and multi-unit purchase are ambiguous',()=>{
  const registered=units.slice(0,2).map(u=>({referencia:'123456',unidade:u.nome,ticket_raiz_dados:{campos:{centroDeCusto:'3.07.999'}}}));
  assert.equal(I.inferUnit({campos_extraidos:{codigoDoCentroDeCusto:'3.07.999'}},units,registered).confidence,'ambiguous');
  assert.equal(I.inferUnit({campos_extraidos:{ticketCompra:'123456'}},units,registered).confidence,'ambiguous');
});
test('202857 recovers notebook in both queue summary and raw fields',()=>{
  assert.equal(context.capexZeevDescricaoLancamento(badTicket),notebook);
  assert.equal(context.capexZeevDescricaoLancamento({...badTicket,raw_fields:fields(badTicket.campos_extraidos)}),notebook);
  assert.deepEqual(I.recoveredItemDescriptions({campos_extraidos:{item:'Mesa',quantidadeItem:'2 unidades'}}),[]);
  assert.deepEqual(I.recoveredItemDescriptions({campos_extraidos:{item:'1',quantidadeItem:'2'}}),[]);
});
test('row-scoped recovery never replaces a valid item in another row',()=>{
  const raw_fields=[...fields({item:'Mesa',quantidadeItem:'2'}),...fields({item:'1',quantidadeItem:notebook}).map(f=>({...f,row:2}))];
  assert.deepEqual(I.recoveredItemDescriptions({raw_fields}),[notebook]);
});
test('description preserves full text, line breaks, justification and repeated items',()=>{
  const text=context.capexZeevDescricaoLancamento({campos_extraidos:{descricaoServico:'<p>Pintura</p><p>Salas</p>',justificativa:'Reforma anual',item:['Tinta branca','Tinta verde']}});
  assert.ok(text.includes('Pintura\nSalas'));assert.ok(text.includes('Reforma anual'));assert.ok(text.includes('Tinta verde'));
});
test('purchase request information is not hidden by the service field',()=>{
  const text=context.capexZeevDescricaoLancamento({campos_extraidos:{informacoesReferentesASolicitacao:'Notebook para a equipe',descricaoServico:'Compra de equipamento'}});
  assert.ok(text.includes('Notebook para a equipe'));
});
test('finance never substitutes an invoice or arbitrary item for the request',()=>{
  assert.equal(context.capexZeevDescricaoLancamento({type:'financeiras',pedido:'NF 1',campos_extraidos:{descricaoDaNotaFiscal:'Pintura',item:'Mesa'}}),'');
  assert.equal(context.capexZeevDescricaoLancamento({type:'financeiras',campos_extraidos:{informacoesReferentesASolicitacao:'Obra das salas'}}),'Obra das salas');
});
test('partial descriptions are explicit and HTML is not executed',()=>{
  const out=context.capexZeevDescriptionHtml({campos_extraidos:{descricaoServico:'<script>alert(1)</script>Pintura &lt;img src=x onerror=alert(1)&gt;',_descricao_status:'parcial'}});
  assert.ok(out.includes('parcial'));assert.ok(!out.includes('<script>'));assert.ok(!out.includes('<img'));
});
test('fresh pending guard blocks already approved records with no writes',async()=>{
  let writes=0;const messages=[];
  context.toast=m=>messages.push(m);context.capexZeevSolicitacoes=[{id:1,status:'pendente'}];
  context.db={from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:{id:1,status:'aprovado',capex_item_id:2}})})}),update:()=>writes++})};
  assert.equal(await context.capexCheckPendingBeforeSave(1),false);assert.equal(writes,0);assert.ok(messages.length);
});
test('deployed TypeScript item parser recovers text without invented amounts',()=>{
  const source=fs.readFileSync(path.join(__dirname,'../supabase/functions/zeev-capex-sync/index.ts'),'utf8');
  const edge={norm:I.norm,fieldMatches:(f,names)=>names.some(n=>I.norm(n)===I.norm(f.name)),parseMoney:v=>Number(String(v).replace(',','.')),ITEM_DESC_FIELDS:['item'],ITEM_QTY_FIELDS:['quantidade'],ITEM_UNIT_MEASURE_FIELDS:['unidade'],ITEM_UNIT_FIELDS:['valorUnitario'],ITEM_TOTAL_FIELDS:['valorTotalItem']};
  vm.createContext(edge);
  vm.runInContext(stripTypeScriptTypes(fn(source,'extractItems')),edge);
  const items=edge.extractItems(fields({item:'1',quantidadeItem:notebook,valorUnitario:'5000'}));
  assert.equal(items[0].descricao,notebook);assert.equal(items[0].quantidade,undefined);assert.equal(items[0].valor_total,undefined);
  new vm.SourceTextModule(stripTypeScriptTypes(source));
});
