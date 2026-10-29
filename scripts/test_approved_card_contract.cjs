const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const read = name => fs.readFileSync(path.join(__dirname, name), 'utf8');
const html = read('../index.html');
const css = read('record-cards.css');
const start = html.indexOf('function renderObraCard(');
const end = html.indexOf('\nfunction geralBarRows(', start);
assert.ok(start >= 0 && end > start, 'Obra renderer boundaries must exist');
const source = html.slice(start, end);
const escape = value => String(value).replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[char]));
const context = vm.createContext({
  ESFERAS: { nova: { label: 'Obra nova' } },
  obraUnitRefs: o => o.units || [],
  obraMarcaNames: o => o.brands || ['TEST'],
  brandColor: () => '#007acc', brandTextOnLight: () => '#003344',
  readableTextOnColor: () => '#fff', textShadowOnColor: () => 'none',
  brandLight: () => '#eefaff',
  brandLogoImg: brand => `<img src="test.svg" alt="${escape(brand)}">`,
  escHtml: escape,
  _obraUnitMatchKey: value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase(),
  _obraEndYear: o => o.year,
  DashboardData: { ...require('./dashboard-data.js'), project: o => ({ contract: o.contract, ledger:{paid:[]}, legacy:0 }) },
  fmt: value => `DATA:${value}`
});
vm.runInContext(source, context);

// The renderer emits balanced divs; track their ancestry, not proximity in source.
function checkHeader(markup) {
  const stack = [];
  const found = new Set();
  for (const token of markup.matchAll(/<\/?div\b[^>]*>|<h3\b[^>]*>|<select\b[^>]*>/g)) {
    if (/^<(?:h3|select)\b/.test(token[0])) {
      assert.ok(stack.some(parent => parent.includes('obra-card-head')), 'Title and status must be inside obra-card-head');
      continue;
    }
    if (token[0].startsWith('</')) { stack.pop(); continue; }
    const classes = (token[0].match(/class="([^"]*)"/)?.[1] || '').split(/\s+/);
    for (const name of ['obra-card-heading', 'obra-card-brands']) {
      if (classes.includes(name)) {
        assert.ok(stack.some(parent => parent.includes('obra-card-head')), `${name} must be inside obra-card-head`);
        found.add(name);
      }
    }
    stack.push(classes);
  }
  assert.equal(found.size, 2, 'Header needs both brand and heading');
  const headerEnd = markup.indexOf('<div class="obra-card-body">');
  assert.ok(headerEnd > 0, 'Card body must exist');
  const header = markup.slice(0, headerEnd);
  assert.match(header, /<h3>/, 'Title must precede body');
  assert.match(header, /<select class="obra-status-select"/, 'Status must precede body');
}

for (const contract of [null, 0, 234567.89]) {
  const markup = context.renderObraCard({
    id: 17, nome: 'Test <school>', status: 'Em andamento', contract,
    year: 2031, construtoras: ['Builder A', 'Builder B'],
    units: [{ nome: 'Other unit' }], brands: ['TEST', 'SECOND']
  }, 0);
  checkHeader(markup);
  assert.match(markup, /Test &lt;school&gt;/);
  assert.match(markup, /Builder A[\s\S]*Builder B/);
  assert.match(markup, /2031/);
  assert.match(markup, /<button[^>]*class="obra-card-btn"[^>]*>Abrir obra/);
  assert.match(markup, /<div class="obra-card-footer">\s*<button[^>]*class="obra-card-btn"/);
  assert.match(markup, /event\.stopPropagation\(\);openObra\(17\)/);
  assert.match(markup, /arrow-up-right\.svg/);
  assert.doesNotMatch(markup, /1\.200\.000,00|1200000|Construtora exemplo/);
  assert.ok(markup.includes(contract === null ? 'N\u00e3o cadastrado' : `DATA:${contract}`), 'Contract must use data, including zero and missing states');
  const outside = markup.replace('<div class="obra-card-heading">', '</div><div class="obra-card-heading">');
  assert.throws(() => checkHeader(outside), /must be inside/, 'Guard must reject a heading moved outside header');
}
// Use the real financial model: builder contracts must win over legacy zero.
context.DashboardData = require('./dashboard-data.js');
for (const [id, investment, contract] of [[7,4200000,3700000],[5,9800000,9300000]]) {
  const obra = {id, nome:'School', contratado:0, investimento_disponivel:investment,
    construtoras:[{seq:1,nome:'Builder',valor:contract}], aditivos_contrato:[]};
  const before = JSON.stringify(obra);
  const markup = context.renderObraCard(obra,0);
  assert.match(markup, new RegExp('Investimento total</span>\\s*<strong>DATA:'+investment));
  assert.match(markup, new RegExp('Contrato construtora\\(s\\) \\+ aditivos</span>\\s*<strong>DATA:'+contract));
  assert.match(markup, new RegExp('Saldo investimento</span>\\s*<strong>DATA:'+investment));
  assert.match(markup, new RegExp('Saldo construtora</span>\\s*<strong>DATA:'+contract));
  assert.equal(JSON.stringify(obra), before, 'Rendering must not mutate source data');
}
for (const [value, expected] of [[null,'N\u00e3o cadastrado'],[undefined,'N\u00e3o cadastrado'],['','N\u00e3o cadastrado'],['invalid','N\u00e3o cadastrado'],[0,'DATA:0'],['4200000','DATA:4200000']]) {
  const markup = context.renderObraCard({id:19,nome:'Test',investimento_disponivel:value,contratado:100},0);
  assert.ok(markup.includes('Investimento total</span>\n          <strong>'+expected));
}
const amended = context.renderObraCard({id:20,nome:'Test',contratado:0,construtoras:[{seq:1,valor:100},{seq:2,valor:200}],aditivos_contrato:[{valor:25}]},0);
assert.match(amended,/Contrato construtora\(s\) \+ aditivos<\/span>\s*<strong>DATA:325/);
const legacy = context.renderObraCard({id:21,nome:'Test',contratado:400},0);
assert.match(legacy,/Contrato construtora\(s\) \+ aditivos<\/span>\s*<strong>DATA:400/);
assert.match(legacy,/Saldo construtora<\/span>\s*<strong>N\u00e3o cadastrado/);
function checkBalances(obra, investment, builder) {
  const before = JSON.stringify(obra);
  const markup = context.renderObraCard(obra,0);
  for (const [label,value] of [['Saldo investimento',investment],['Saldo construtora',builder]]) {
    const expected = value === null ? 'N\u00e3o cadastrado' : 'DATA:'+value;
    assert.match(markup,new RegExp(label+'</span>\\s*<strong>'+expected+'</strong>'));
  }
  assert.equal(JSON.stringify(obra),before);
}
for (const [id, investment, contract] of [[7,4200000,3700000],[5,9800000,9300000]]) {
  const obra={id,nome:'School',investimento_disponivel:investment,contratado:0,
    construtoras:[{seq:1,nome:'Builder',valor:contract}],
    aditivos_contrato:[{valor:10000,construtora_seq:1},{valor:5000},{valor:-1000,construtora_seq:1}],
    contratos:[{seq:2,v:50000}],
    pag:[
      {st:'PAGO',v:100000,escopoFin:'obra',construtora_seq:'1'},
      {st:'PAGO',v:20000,escopoFin:'obra'},
      {st:'PAGO',v:7000,escopoFin:'extra',construtora_seq:1},
      {st:'PENDENTE',v:8000,escopoFin:'obra',construtora_seq:1},
      {st:'CANCELADO',v:9000,escopoFin:'obra',construtora_seq:1},
      {st:'PAGO',v:3000,escopoFin:'obra',construtora_seq:99},
      {st:'PAGO',v:4000,escopoFin:'obra',construtora_seq:1,contrato_seq:2},
      {st:'PAGO',v:5000,escopoFin:'obra',construtora_seq:1,contratoSeq:2},
      {st:'PAGO',v:2000,escopo_fin:'obra',construtora_seq:1,contrato_seq:0}
    ]};
  checkBalances(obra,investment-134000,contract+14000-102000);
  checkBalances({...obra,pag:[{st:'PAGO',v:20000,escopoFin:'obra'}]},investment-20000,contract+14000);
}
checkBalances({id:30,nome:'Legacy',contratado:400,investimento_disponivel:1000,
  construtoras:[{seq:1,nome:'Builder',valor:0}],pag:[{st:'PAGO',v:50,escopoFin:'obra',construtora_seq:1}]},950,350);
checkBalances({id:31,nome:'Legacy without links',contratado:400,investimento_disponivel:1000,
  pag:[{st:'PAGO',v:50,escopoFin:'obra'}]},950,null);
checkBalances({id:32,nome:'Legacy aggregate',contratado:400,investimento_disponivel:1000,pago:100,
  construtoras:[{seq:1,nome:'Builder',valor:400}]},null,null);
checkBalances({id:33,nome:'Missing contract',investimento_disponivel:1000,contratado:0,
  construtoras:[{seq:1,nome:'Builder',valor:0}],pag:[{st:'PAGO',v:50,construtora_seq:1,escopoFin:'obra'}]},950,null);
checkBalances({id:34,nome:'Missing investment',contratado:100,construtoras:[{seq:1,valor:100}],
  pag:[{st:'PAGO',v:150,escopoFin:'obra',construtora_seq:1}]},null,-50);
checkBalances({id:35,nome:'Multiple builders',investimento_disponivel:500,contratado:0,
  construtoras:[{seq:1,valor:100},{seq:2,valor:200}],aditivos_contrato:[{valor:25}],
  pag:[{st:'PAGO',v:60,escopoFin:'obra',construtora_seq:1},{st:'PAGO',v:80,escopoFin:'obra',construtora_seq:2}]},360,185);
console.log('Investment and builder balance checks passed (linked, unlinked, extra, pending, legacy, amendments).');
assert.match(css,/\.obra-card-finances \.obra-card-contract\{[^}]*flex-wrap:wrap/);
delete context.DashboardData;
assert.match(context.renderObraCard({ id: 18, nome: 'No data' }, 0), /N\u00e3o cadastrado/);

const buttonRule = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].find(match =>
  match[1].trim() === '#app>.main .pgrid>.obra-card.obra-card .obra-card-btn');
assert.ok(buttonRule, 'Scoped approved CTA rule must exist');
assert.match(buttonRule[2], /background\s*:\s*(?:var\(--brand-cur\)|linear-gradient\([^;]*var\(--brand-cur\))/, 'CTA must be brand-filled');
assert.match(buttonRule[2], /color\s*:\s*var\(--brand-readable\s*,\s*#fff\)/, 'CTA needs readable text');
assert.match(buttonRule[2], /width\s*:\s*100%/, 'CTA must span footer content');
assert.match(buttonRule[2], /margin\s*:\s*0\s*;/, 'Footer owns CTA spacing');
assert.match(css, /\.obra-card-footer\s*\{[^}]*border-top\s*:/, 'Footer needs separator');
assert.match(buttonRule[2], /justify-content\s*:\s*center/);
assert.match(buttonRule[2], /min-height\s*:\s*(?:3[6-9]|[4-9]\d)px/);
console.log('Approved card contract passed (rendered header, data states, CTA source rules).');
