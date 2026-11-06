const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { File } = require('node:buffer');
const { test } = require('node:test');

const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
const bundle = fs.readFileSync(path.join(__dirname, 'payment-bundle.js'), 'utf8');
function harness(overrides = {}) {
  const context = vm.createContext({
    console, File, setTimeout, clearTimeout, structuredClone,
    capexZeevNormField: value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/gi, '').toLowerCase(),
    paymentDocUrlFileName: () => '',
    paymentDocNorm: doc => doc.name || '',
    paymentDocKey: doc => doc.storagePath || doc.name,
    paymentDocsMatch: (a, b) => a.storagePath === b.storagePath,
    isZeevAuditDocClient: () => false,
    inferType: () => 'application/pdf',
    paymentFileSha256: async () => '',
    uploadPagDoc: async (oid, file, kind) => `obra_${oid}/${kind}/${file.name}`,
    cleanImpDocNumber: value => value,
    parseNFFromText: () => ({}),
    extractPdfText: async () => 'Numero NFS-e: 123\nOrcamento referenciado em documento municipal '.repeat(5),
    readInvoiceWithAI: async () => ({ tipo: 'NFS-e', doc: '123', cnpj: '12345678000199', val: 100, date: '2026-01-01', itens: [] }),
    ...overrides,
  });
  for (const name of ['paymentHasFiscalIdentity', 'paymentDocKindLabel', 'capexZeevDocKind', 'paymentIsFiscalDoc', 'paymentIsProofDoc', 'normalizePaymentDocs', 'hydratePaymentDocs', 'paymentAllDocs']) {
    const start = html.indexOf(`function ${name}(`);
    assert.ok(start >= 0, name);
    const end = html.indexOf('\n}', start) + 2;
    vm.runInContext(html.slice(start, end), context);
  }
  vm.runInContext(bundle, context);
  return context;
}

test('fiscal identity beats budget/proof filename and kind, regardless of payee match', () => {
  const c = harness();
  for (const status of ['matched', 'different', 'unverified']) {
    const doc = { name: 'orcamento-pix.pdf', kind: 'ORCAMENTO', storagePath: 'original.pdf', invoiceIdentity: { type: 'NFS-e', invoiceNumber: '123', status } };
    assert.equal(c.paymentDocKindLabel(doc), 'NF');
    assert.equal(c.capexZeevDocKind(doc), 'NF');
    const payment = { docs: [doc], nfDoc: doc };
    c.hydratePaymentDocs(payment);
    assert.equal(payment.nfDoc.kind, 'NF');
    assert.equal(payment.docs[0].kind, 'NF');
  }
});

test('true budgets and incomplete identities do not become invoices', () => {
  const c = harness();
  for (const invoiceIdentity of [undefined, {}, { type: 'ORCAMENTO', invoiceNumber: '123' }, { type: 'NF-e' }]) {
    assert.equal(c.paymentDocKindLabel({ name: 'orcamento.pdf', kind: 'ORCAMENTO', invoiceIdentity }), 'ORCAMENTO');
  }
  assert.equal(c.paymentDocKindLabel({ name: 'pix.pdf', kind: 'COMPROVANTE' }), 'COMPROVANTE');
});

test('stage uses DOCUMENTO for unknown originals independent of parent type', async () => {
  const c = harness();
  for (const nfTipo of ['OR\u00c7AMENTO - COBRAR NF', 'NF-e', 'Sem nota']) {
    const p = await c.PaymentBundle.stage(1, { nfTipo, docs: [] }, [new File(['bytes'], 'scan.pdf')]);
    assert.equal(p.docs[0].kind, 'DOCUMENTO');
    assert.equal(p.docs[0].storagePath, 'obra_1/documento/scan.pdf');
    assert.equal(p.nfDoc, undefined);
  }
});

test('strong fiscal number bypasses quote rejection; short text stays inconclusive', async () => {
  for (const text of ['Orcamento municipal\nNumero NFS-e: 123\n' + 'Servico municipal '.repeat(10), 'orcamento curto']) {
    let calls = 0;
    const c = harness({ extractPdfText: async () => text, readInvoiceWithAI: async () => { calls++; return { tipo: 'NFS-e', doc: '123' }; } });
    assert.equal((await c.PaymentBundle.readFiscal(new File(['pdf'], 'scan.pdf'))).tipo, 'NFS-e');
    assert.equal(calls, 1);
  }
});

function database(row, updates, conflict = false) {
  return { from(table) {
    let patch;
    const query = {
      select() { return patch ? Promise.resolve({ data: conflict ? [] : [{ id: row.id }] }) : query; },
      eq() { return query; },
      is() { return query; },
      single: async () => ({ data: structuredClone(row) }),
      maybeSingle: async () => ({ data: { nome: 'Payee', cnpj: '12345678000199' } }),
      update(value) { assert.equal(table, 'pagamentos'); patch = value; updates.push(value); return query; },
    };
    return query;
  } };
}

for (const withBundle of [false, true]) test(`enrichment persists primary path with metadata, bundle=${withBundle}`, async () => {
  const doc = { name: 'orcamento.pdf', storagePath: 'original.pdf', kind: 'ORCAMENTO' };
  const docs = [doc];
  if (withBundle) docs.push({ name: 'Orcamento-e-boleto.pdf', storagePath: 'bundle.pdf', kind: 'ORCAMENTO', generatedBundle: true, bundleSources: ['original.pdf'] });
  const row = { id: 1, xmin: '42', docs_json: docs, nf_doc_path: '', nf_tipo: 'ORCAMENTO', nf_num: 'budget-1', ben: 'Payee', v: 999, st: 'PAGO', venc: '2026-02-01', paga_em: '2026-01-02', pagn: 'Payer', parcelas: [{ valor: 999 }] };
  const updates = [];
  const c = harness({ db: database(row, updates) });
  const p = { dbId: 1, docs: structuredClone(docs), v: row.v, ben: row.ben, st: row.st };
  const result = await c.PaymentBundle.enrichExisting(1, p, [new File(['pdf'], doc.name)]);
  assert.ok(result.updated, result.warning);
  assert.equal(updates.length, 1);
  const patch = updates[0];
  assert.equal(patch.nf_doc_path, withBundle ? 'bundle.pdf' : 'original.pdf');
  assert.equal(p.nfDoc.storagePath, patch.nf_doc_path);
  assert.equal(c.paymentDocKindLabel(patch.docs_json[0]), 'NF');
  assert.equal(patch.docs_json[0].budgetReference, 'budget-1');
  assert.equal(patch.docs_json.length, docs.length);
  for (const key of ['v', 'ben', 'st', 'venc', 'paga_em', 'pagn', 'parcelas']) assert.equal(Object.hasOwn(patch, key), false, key);
  assert.equal(Object.hasOwn(p, 'undefined'), false);
  const reloaded = { docs: structuredClone(patch.docs_json) };
  c.hydratePaymentDocs(reloaded);
  assert.equal(reloaded.nfDoc.storagePath, patch.nf_doc_path);
});

test('inconclusive reading preserves attachments and does not mutate database', async () => {
  const c = harness({ readInvoiceWithAI: async () => null, db: { from() { throw Error('Must not write'); } } });
  const p = { dbId: 1, docs: [{ name: 'orcamento.pdf', kind: 'ORCAMENTO' }] };
  const before = structuredClone(p);
  const result = await c.PaymentBundle.enrichExisting(1, p, [new File(['pdf'], 'orcamento.pdf')]);
  assert.ok(result.warning);
  assert.deepEqual(p, before);
});

test('quote terms mentioning nota fiscal do not trigger invoice OCR', async () => {
  const c = harness({ extractPdfText: async () => 'ORCAMENTO 789\n' + 'Pagamento apos emissao da nota fiscal. Valores validos por trinta dias. '.repeat(3), readInvoiceWithAI: async () => { throw Error('Quote must not reach AI'); } });
  const result = await c.PaymentBundle.readFiscal(new File(['pdf'], 'quote.pdf'));
  assert.equal(result.tipo, 'ORCAMENTO');
  assert.equal(result.classificationEvidence, 'budget-heading');
});

test('confirmed budget repairs a lone false identity and bundle without losing originals', async () => {
  const docs = [{ name: 'quote.pdf', storagePath: 'quote.pdf', kind: 'NF', invoiceIdentity: { type: 'NFS-e', invoiceNumber: '789' } }, { name: 'bundle.pdf', storagePath: 'bundle.pdf', generatedBundle: true, kind: 'NF', bundleSources: ['quote.pdf'] }];
  const row = { id: 1, xmin: '42', nf_num: '789', nf_tipo: 'NFS-e', nf_doc_path: 'bundle.pdf', docs_json: docs, v: 99 };
  const updates = [];
  const c = harness({ db: database(row, updates), extractPdfText: async () => 'ORCAMENTO 789\n' + 'Emissao de nota fiscal somente apos aprovacao. '.repeat(4) });
  const p = { dbId: 1, docs: structuredClone(docs), nfDoc: docs[1] };
  const result = await c.PaymentBundle.enrichExisting(1, p, [new File(['pdf'], 'quote.pdf')]);
  assert.ok(result.updated, result.warning);
  assert.equal(updates[0].nf_doc_path, '');
  assert.equal(updates[0].docs_json.length, 2);
  assert.equal(updates[0].docs_json[0].kind, 'ORCAMENTO');
  assert.equal(updates[0].docs_json[0].invoiceIdentity, undefined);
  assert.equal(updates[0].docs_json[1].kind, 'ORCAMENTO');
  assert.equal(p.nfDoc, null);
  assert.equal(Object.hasOwn(updates[0], 'v'), false);
});

test('null from invalid key or OCR uncertainty never demotes a verified identity', async () => {
  for (const result of [null, { tipo: 'NF-e', doc: '123', chave: 'invalid' }]) {
    const doc = { name: 'scan.pdf', storagePath: 'scan.pdf', kind: 'NF', invoiceIdentity: { type: 'NF-e', invoiceNumber: '123' } };
    let queries = 0;
    const c = harness({ readInvoiceWithAI: async () => result, db: { from() { queries++; throw Error('No write expected'); } } });
    const p = { dbId: 1, docs: [doc], nfDoc: doc };
    const before = structuredClone(p);
    await c.PaymentBundle.enrichExisting(1, p, [new File(['pdf'], 'scan.pdf')]);
    assert.equal(queries, 0);
    assert.deepEqual(p, before);
  }
});

test('same-name original collisions warn without relabeling or metadata changes', async () => {
  const row = { id: 1, xmin: '42', docs_json: [{ name: 'scan.pdf', storagePath: 'a.pdf', kind: 'DOCUMENTO' }, { name: 'scan.pdf', storagePath: 'b.pdf', kind: 'ORCAMENTO' }] };
  const updates = [];
  const c = harness({ db: database(row, updates) });
  for (const files of [[new File(['a'], 'scan.pdf')], [new File(['a'], 'scan.pdf'), new File(['b'], 'scan.pdf')]]) {
    const p = { dbId: 1, docs: structuredClone(row.docs_json) };
    const before = structuredClone(p);
    const result = await c.PaymentBundle.enrichExisting(1, p, files);
    assert.match(result.warning, /nome/);
    assert.equal(updates.length, 0);
    assert.deepEqual(p, before);
  }
});

test('unknown visual attachments stay stored separately and are never merged', async () => {
  const c = harness({ PDFLib: { PDFDocument: { create() { throw Error('Unknowns must not be merged'); } } } });
  const old = { name: 'unrelated.pdf', storagePath: 'unrelated.pdf', kind: 'DOCUMENTO' };
  const p = await c.PaymentBundle.stage(1, { docs: [old], nfTipo: 'ORCAMENTO' }, [new File(['a'], 'scan-a.pdf'), new File(['b'], 'scan-b.pdf')]);
  assert.equal(p.docs.length, 3);
  assert.equal(p.docs.some(d => d.generatedBundle), false);
  assert.ok(p.docs.every(d => d.kind === 'DOCUMENTO'));
  assert.equal(p._fiscalFiles.length, 2);
});

test('PDF beats same-invoice XML; stale bundle cannot hide an additional invoice', async () => {
  const identity = { type: 'NFS-e', invoiceNumber: '123', issuerCnpj: '12345678000199' };
  for (const extraInvoice of [false, true]) {
    const docs = [{ name: 'invoice.xml', storagePath: 'invoice.xml', kind: 'XML', invoiceIdentity: identity }, { name: 'invoice.pdf', storagePath: 'invoice.pdf', kind: 'NF', invoiceIdentity: identity }];
    if (extraInvoice) docs.push({ name: 'old-bundle.pdf', storagePath: 'old-bundle.pdf', generatedBundle: true, kind: 'NF', bundleSources: ['invoice.pdf'] }, { name: 'second.pdf', storagePath: 'second.pdf', kind: 'NF', invoiceIdentity: { ...identity, invoiceNumber: '456' } });
    const row = { id: 1, xmin: '42', docs_json: docs, nf_doc_path: 'invoice.xml', nf_num: '123', nf_tipo: 'NFS-e' };
    const updates = [];
    const c = harness({ db: database(row, updates) });
    const p = { dbId: 1, docs: structuredClone(docs) };
    const result = await c.PaymentBundle.enrichExisting(1, p, [new File(['pdf'], 'invoice.pdf')]);
    assert.ok(result.updated, result.warning);
    assert.equal(updates[0].nf_doc_path, 'invoice.pdf');
    assert.equal(p.nfDoc.storagePath, 'invoice.pdf');
  }
});

test('revision conflict does not apply fiscal changes locally', async () => {
  const row = { id: 1, xmin: '42', docs_json: [{ name: 'scan.pdf', storagePath: 'scan.pdf', kind: 'DOCUMENTO' }], nf_doc_path: '', nf_tipo: 'Sem nota', ben: 'Payee' };
  const c = harness({ db: database(row, [], true) });
  const p = { dbId: 1, docs: structuredClone(row.docs_json) };
  const before = structuredClone(p);
  const result = await c.PaymentBundle.enrichExisting(1, p, [new File(['pdf'], 'scan.pdf')]);
  assert.match(result.warning, /cadastro mudou/);
  assert.deepEqual(p, before);
});
