const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert/strict');
const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
const label = 'OR\u00c7AMENTO - COBRAR NF';
for (const m of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)) {
  if (m[1].trim()) new vm.Script(m[1]);
}
for (const id of ['pm-nf', 'imp-nftipo', 'zo-nf-tipo']) {
  const select = html.match(new RegExp('<select[^>]*id="' + id + '"[^>]*>([\\s\\S]*?)</select>'));
  assert(select, id);
  assert(select[1].includes('value="' + label + '"'), id);
}
const ctx = {
  capexZeevNormField: s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, ''),
  paymentDocNorm: d => d.name || ''
};
vm.createContext(ctx);
for (const name of ['paymentDocUrlFileName', 'normalizeImpDocTipo', 'paymentDocKindLabel', 'paymentDocDisplayType', 'paymentDocKindPretty', 'paymentIsFiscalDoc', 'capexZeevDocKind']) {
  const start = html.indexOf('function ' + name + '(');
  assert(start >= 0, name);
  const end = html.slice(start + 1).search(/\n(?:async )?function /);
  assert(end >= 0, name);
  vm.runInContext(html.slice(start, start + 1 + end), ctx);
}
for (const raw of [label, 'orcamento - cobrar nf', 'Orcamento']) {
  assert.equal(ctx.normalizeImpDocTipo(raw), label);
}
for (const doc of [{kind: 'ORCAMENTO', name: 'documento.pdf'}, {name: label + '.pdf'}, {name: 'orcamento.pdf', kind: 'NF'}, {url: 'https://example.invalid/ORCAMENTO_COBRAR_NF.pdf'}]) {
  assert.equal(ctx.paymentDocKindLabel(doc), 'ORCAMENTO');
  assert.equal(ctx.capexZeevDocKind(doc), 'ORCAMENTO');
  assert.equal(ctx.paymentIsFiscalDoc(doc), false);
  assert.equal(ctx.paymentDocKindPretty(ctx.paymentDocDisplayType(doc, {nfTipo: label}), label), label);
}
assert.equal(ctx.paymentDocKindPretty('', label), label);
assert.equal(ctx.paymentDocDisplayType({}, {nfTipo: label}), label);
assert.equal(ctx.paymentIsFiscalDoc({name: 'NF-123.pdf'}), true);
assert.equal(ctx.paymentDocKindLabel({name: 'boleto.pdf'}), 'BOLETO');
assert.equal(ctx.normalizeImpDocTipo('NF-e'), 'NF-e');
assert(html.includes("t!=='OR\u00c7AMENTO - COBRAR NF'"));
assert(html.includes("tipo==='OR\u00c7AMENTO - COBRAR NF')?'badge b-warn'"));
console.log('PASS: budget menus, normalization, display, non-fiscal classification and pending badges');
