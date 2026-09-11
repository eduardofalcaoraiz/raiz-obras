'use strict';
const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {stripTypeScriptTypes} = require('node:module');
const source = fs.readFileSync(path.join(__dirname, '../supabase/functions/zeev-capex-sync/index.ts'), 'utf8');
const start = source.indexOf('async function zeevFetchWithTimeout(');
assert.ok(start >= 0);
const code = stripTypeScriptTypes(source.slice(start, source.indexOf('\n}', start) + 2));

function runtime(transport) {
  const context = vm.createContext({
    Headers, AbortController, fetch: transport, setTimeout, clearTimeout,
    zeevRequestTimeoutMs: value => value || 1000,
  });
  vm.runInContext(code, context);
  return context.zeevFetchWithTimeout;
}

test('Zeev fetch supplies language while preserving auth, method and body', async () => {
  const original = new Headers({Authorization: 'Bearer test-token', Accept: 'application/json'});
  const result = await runtime(async (url, init) => {
    assert.equal(url, 'https://example.test/api/2/instances/report');
    assert.equal(init.headers.get('Accept-Language'), 'pt-BR,pt;q=0.9,en;q=0.8');
    assert.equal(init.headers.get('Authorization'), 'Bearer test-token');
    assert.equal(init.headers.get('Accept'), 'application/json');
    assert.equal(init.method, 'POST');
    assert.equal(init.body, '{"page":1}');
    assert.equal(init.signal.aborted, false);
    return 'ok';
  })('https://example.test/api/2/instances/report', {headers: original, method: 'POST', body: '{"page":1}'});
  assert.equal(result, 'ok');
  assert.equal(original.has('Accept-Language'), false);
});

test('caller language is preserved regardless of header casing', async () => {
  await runtime(async (_, init) => {
    assert.equal(init.headers.get('Accept-Language'), 'pt-BR');
  })('https://example.test', {headers: {'accept-language': 'pt-BR'}});
});

test('empty init still supplies language and network errors propagate', async () => {
  const failure = new Error('network error');
  await assert.rejects(runtime(async (_, init) => {
    assert.equal(init.headers.get('Accept-Language'), 'pt-BR,pt;q=0.9,en;q=0.8');
    throw failure;
  })('https://example.test'), failure);
});

test('timeout still aborts the request', async () => {
  await assert.rejects(runtime((_, init) => new Promise((resolve, reject) => {
    init.signal.addEventListener('abort', () => reject(new Error('timed out')));
  }))('https://example.test', {}, 10), /timed out/);
});
