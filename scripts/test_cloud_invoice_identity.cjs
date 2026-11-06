'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { stripTypeScriptTypes } = require('node:module');
const { test } = require('node:test');
const source = process.env.EDGE_SOURCE || path.join(__dirname, '../supabase/functions/zeev-capex-sync/index.ts');
const context = vm.createContext({ URL, console, Deno: { env: { get: () => undefined }, serve: () => {} } });
// Run the actual module with server registration disabled; no network primitives are exposed.
vm.runInContext(stripTypeScriptTypes(fs.readFileSync(source, 'utf8')), context);
const identity = { invoiceNumber: '000123', type: 'NF-e', issuerCnpj: '12.345.678/0001-90', status: 'different' };
const doc = extra => ({ name: 'Orcamento-e-boleto.pdf', kind: 'ORCAMENTO', storagePath: 'docs/orcamento.pdf', ...extra });

test('verified identity precedes filenames, fields, stored kinds and purchase context', () => {
  for (const name of ['Orcamento.pdf', 'boleto.pdf', 'comprovante.pdf', 'documento_1700000000000_1_anexo.pdf']) {
    const d = doc({ name, invoiceIdentity: identity, source: 'anexarBoleto' });
    assert.equal(context.fiscalDocKind(d), 'NF');
    assert.equal(context.fiscalDocKindWithContext(d, { flow_id: 102, flow_name: 'Compras' }), 'NF');
  }
  assert.equal(context.hasVerifiedInvoiceIdentity(doc({ invoiceIdentity: { ...identity, type: 'NFS-e', issuerCnpj: '', accessKey: '12345678901234567890123456789012345678901234' } })), true);
});

test('consumer and transport fiscal types accept normalized aliases', () => {
  for (const type of ['NFC-e', 'nfce', 'CT-e', 'cte']) {
    assert.equal(context.fiscalDocKind(doc({ invoiceIdentity: { ...identity, type } })), 'NF');
  }
});

test('service keys provide a numeric 48/50-digit fallback only for service invoices', () => {
  for (const length of [48, 50]) {
    const key = '1234567890'.repeat(5).slice(0, length);
    for (const field of ['accessKey', 'serviceAccessKey']) {
      const value = { ...identity, type: 'NFS-e', issuerCnpj: '', [field]: key };
      assert.equal(context.fiscalDocKind(doc({ invoiceIdentity: value })), 'NF');
      assert.equal(context.hasVerifiedInvoiceIdentity(doc({ invoiceIdentity: { ...value, type: 'CT-e' } })), false);
    }
  }
  for (const key of ['1'.repeat(48), '0'.repeat(50), '1234567890'.repeat(5).slice(0, 49), 'a' + '1234567890'.repeat(5).slice(0, 47)]) {
    assert.equal(context.hasVerifiedInvoiceIdentity(doc({ invoiceIdentity: { ...identity, type: 'NFSE', issuerCnpj: '', serviceAccessKey: key } })), false);
  }
});

test('incomplete or malformed identity cannot promote a budget', () => {
  for (const value of [null, {}, { ...identity, invoiceNumber: '' }, { ...identity, invoiceNumber: '0' }, { ...identity, invoiceNumber: 'undefined' }, { ...identity, type: 'ORCAMENTO' }, { ...identity, issuerCnpj: '' }, { ...identity, issuerCnpj: '00000000000000' }, { ...identity, issuerCnpj: 'abcdefghijklmn' }]) {
    assert.equal(context.fiscalDocKind(doc({ invoiceIdentity: value })), 'ORCAMENTO');
  }
});

test('normalization preserves bundles, identities, metadata, and is idempotent', () => {
  for (const kind of ['NF', 'ORCAMENTO', 'BOLETO']) {
    const bundle = doc({ kind, generatedBundle: true, bundleSources: ['a', 'b'], budgetReference: '99', customMetadata: { retained: true } });
    const original = doc({ name: 'original.pdf', storagePath: 'docs/original.pdf', invoiceIdentity: identity, unlinkedDocuments: [{ name: 'archived.pdf' }] });
    const row = { docs_json: [bundle, original] };
    const before = JSON.stringify(row);
    const normalized = context.normalizeStoredDocs(row);
    assert.equal(normalized.length, 2);
    assert.equal(normalized[0].kind, kind);
    assert.equal(normalized[1].kind, 'NF');
    for (const field of ['generatedBundle', 'bundleSources', 'budgetReference', 'customMetadata']) assert.deepEqual(normalized[0][field], bundle[field]);
    assert.deepEqual(normalized[1].invoiceIdentity, identity);
    assert.deepEqual(normalized[1].unlinkedDocuments, original.unlinkedDocuments);
    assert.equal(JSON.stringify(row), before);
    assert.equal(JSON.stringify(context.normalizeStoredDocs({ docs_json: normalized })), JSON.stringify(normalized));
  }
});

test('ordinary proof, charge and generic attachments keep their classifications', () => {
  for (const [name, kind] of [['comprovante.pdf', 'COMPROVANTE'], ['boleto.pdf', 'BOLETO'], ['fatura.pdf', 'FATURA'], ['recibo.pdf', 'RECIBO'], ['projeto.pdf', 'DOCUMENTO']]) {
    assert.equal(context.fiscalDocKind({ name }), kind);
  }
});
