const fs = require('fs');
const path = require('path');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
process.env.PW_TEST_SCREENSHOT_NO_FONTS_READY = '1';
const root = path.resolve(__dirname, '..');
const out = process.env.CAPEX_TEST_OUTPUT || path.join(require('os').tmpdir(), 'raiz-capex-review-tests');
fs.mkdirSync(out, { recursive: true });
const results = [], errors = [], network = [], screenshots = [];
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await ctx.route('**/*', async r => {
    const u = new URL(r.request().url());
    if (u.hostname.endsWith('supabase.co') || u.pathname.startsWith('/api/')) {
      network.push({ url: u.href, method: r.request().method() });
      return r.fulfill({ json: u.pathname.includes('/auth/') ? {} : [] });
    }
    if (u.hostname === 'capex.test') {
      const f = path.resolve(root, '.' + decodeURIComponent(u.pathname === '/' ? '/index.html' : u.pathname));
      if (!f.startsWith(root + path.sep) || !fs.existsSync(f)) return r.fulfill({ status: 404, body: '' });
      return r.fulfill({ path: f, contentType: f.endsWith('.js') ? 'text/javascript' : f.endsWith('.css') ? 'text/css' : f.endsWith('.html') ? 'text/html' : undefined });
    }
    if (!['GET', 'HEAD'].includes(r.request().method())) return r.abort();
    return r.continue();
  });
  const p = await ctx.newPage();
  p.setDefaultTimeout(5000);
  p.on('pageerror', e => errors.push(e.message));
  async function fixture(role = 'reader') {
    await p.goto('https://capex.test', { waitUntil: 'networkidle' });
    await p.evaluate(role => {
      currentProfile = { id: role === 'owner' ? 'e56ab877-62a8-4f2c-9ef8-55ab93fd51b9' : 'test-' + role, role: role === 'owner' ? 'admin' : role, aprovado: true, access_config: { capex: 'read', registros: 'read' } };
      currentUser = { id: currentProfile.id };
      document.getElementById('login-screen').style.display = 'none';
      document.getElementById('app').style.display = 'flex';
      document.getElementById('lo').style.display = 'none';
      window.mock = { calls: [], ranges: [], rpcError: null, listError: null, total: 31, status: 'pending', delay: 0 };
      const item = { id: 101, ano: 2026, unidade: 'Cubo Marapendi', marca: 'CUBO', pedido: 'Equipamentos esportivos', referencia: '200164', situacao: 'Em Andamento', orcamento: 8000, setor: 'COMPRAS' };
      capexItens = [item]; capexSaldos = [{ ano: 2026, unidade: item.unidade, marca: 'CUBO', valor: 25000 }];
      capexZeevSolicitacoes = [{ id: 201, capex_item_id: 101, status: 'aprovado' }];
      capexDataLoaded = true; capexDataLoading = false; capexZeevLoaded = true;
      window.review = id => ({ id, item_id: 101, status: mock.status, request_snapshot: item, reason: 'Valor precisa de revisao', requester_name: 'Pessoa de teste', requester_email: 'test@example.test', requested_at: '2026-09-21T12:00:00Z', decision_reason: mock.status === 'pending' ? null : 'Conferido pelo responsavel', decided_at: '2026-09-21T13:00:00Z' });
      db.rpc = async (name, args) => {
        mock.calls.push({ name, args });
        if (mock.delay) await new Promise(resolve => setTimeout(resolve, mock.delay));
        if (mock.rpcError) return { error: { message: mock.rpcError } };
        return { data: name === 'get_capex_review' ? { review: review(args.p_review_id), current_item: item, version: 'fixture-version' } : null, error: null };
      };
      db.from = table => {
        let head = false, start = 0, end = 29;
        const q = { select: (_, options) => { head = options?.head; return q; }, order: () => q, eq: () => q, in: () => q,
          range: (a, b) => { start = a; end = b; mock.ranges.push([a, b]); return q; },
          then: (resolve, reject) => Promise.resolve({ data: table === 'capex_reviews' && !head ? Array.from({ length: Math.max(0, Math.min(end + 1, mock.total) - start) }, (_, i) => review(start + i + 1)) : [], count: mock.total, error: !head && mock.listError ? { message: mock.listError } : null }).then(resolve, reject) };
        return q;
      };
      AccessControl.syncUi(); go('capex'); drillCapex(2026, 'CUBO', item.unidade);
    }, role);
  }
  async function test(name, fn) {
    try { await fn(); results.push({ name, passed: true }); console.log('PASS ' + name); }
    catch (e) { results.push({ name, passed: false, error: e.stack }); console.error('FAIL ' + name + ': ' + e.message); await p.screenshot({ path: path.join(out, 'failure-' + results.length + '.png') }).catch(() => {}); }
  }
  const dialog = p.locator('#capex-review-dialog');
  const error = p.locator('#capex-review-error');
  const calls = () => p.evaluate(() => mock.calls);
  const balance = () => p.evaluate(() => ({ ids: capexItens.map(i => i.id), saldo: capexBudgetStats(capexItens, { ano: 2026 }).saldo, loaded: capexDataLoaded, zeev: capexZeevSolicitacoes[0].status }));
  async function openReview(role) { await fixture(role); await p.evaluate(() => CapexReviews.open(1)); }
  async function shot(name) { const file = path.join(out, name + '.png'); await p.screenshot({ path: file }); screenshots.push(file); }
  try {
    await test('readonly integrated request, trimmed reason validation and balances unchanged', async () => {
      await fixture();
      const b = p.getByRole('button', { name: /Pedir revis/ }).first(); assert(await b.isVisible()); await b.click();
      for (const value of ['', '         ', 'short']) {
        await p.locator('#capex-review-reason').fill(value); await dialog.getByRole('button', { name: /Enviar/ }).click(); assert(await error.isVisible()); assert.equal((await calls()).length, 0);
      }
      await p.locator('#capex-review-reason').fill('  Motivo suficientemente claro  ');
      await dialog.getByRole('button', { name: /Enviar/ }).click(); await p.waitForFunction(() => !document.querySelector('#capex-review-dialog').open);
      assert.equal((await calls())[0].args.p_reason, 'Motivo suficientemente claro'); assert.equal((await balance()).saldo, 17000); assert.deepEqual((await balance()).ids, [101]);
    });
    await test('duplicate and backend request failures stay visible and retain balance', async () => {
      await fixture(); await p.evaluate(() => CapexReviews.request(101));
      await p.locator('#capex-review-reason').fill('Motivo suficientemente claro');
      for (const message of ['Ja existe revisao pendente para este gasto', 'Backend unavailable <script>']) {
        await p.evaluate(message => mock.rpcError = message, message); await dialog.getByRole('button', { name: /Enviar/ }).click();
        await p.waitForFunction(() => document.querySelector('#capex-review-dialog').getAttribute('aria-busy') === 'false');
        assert.equal(await error.innerText(), message); assert.equal(await error.locator('script').count(), 0); assert.equal((await balance()).saldo, 17000);
      }
    });
    await test('reader and nonowner admin cannot judge even by direct handler', async () => {
      for (const role of ['reader', 'admin']) { await openReview(role); assert.equal(await dialog.locator('textarea').count(), 0); assert.equal(await dialog.getByRole('button', { name: /Aprovar|Manter/ }).count(), 0); await p.evaluate(() => CapexReviews.decide(true)); assert.equal((await calls()).filter(c => c.name === 'decide_capex_review').length, 0); }
    });
    await test('owner rejection requires reason but no removal confirmation and retains balance', async () => {
      await openReview('owner'); await dialog.getByRole('button', { name: 'Manter no CAPEX' }).click(); assert(await error.isVisible());
      await p.locator('#capex-review-reason').fill('Gasto correto'); await dialog.getByRole('button', { name: 'Manter no CAPEX' }).click();
      await p.waitForFunction(() => !document.querySelector('#capex-review-dialog').open);
      assert.equal((await calls()).at(-1).args.p_approve, false); assert.equal((await balance()).saldo, 17000);
    });
    await test('owner approval confirmation, failed backend, pending RPC and successful local removal', async () => {
      await openReview('owner'); await p.locator('#capex-review-reason').fill('Retirada confirmada');
      const approve = dialog.getByRole('button', { name: 'Aprovar retirada do CAPEX' }); await approve.click(); assert.match(await error.innerText(), /Confirme/); assert.equal((await calls()).length, 1);
      await p.locator('#capex-review-confirm').check(); await p.evaluate(() => mock.rpcError = 'Version conflict'); await approve.click();
      await p.waitForFunction(() => document.querySelector('#capex-review-dialog').getAttribute('aria-busy') === 'false'); assert.equal(await error.innerText(), 'Version conflict'); assert.equal((await balance()).saldo, 17000);
      await p.evaluate(() => { mock.rpcError = null; mock.delay = 700; }); await approve.click(); assert(await approve.isDisabled()); assert.equal((await balance()).saldo, 17000);
      await p.waitForFunction(() => !document.querySelector('#capex-review-dialog').open);
      assert.deepEqual(await balance(), { ids: [], saldo: 25000, loaded: false, zeev: 'ignorado' }); assert.equal((await calls()).at(-1).args.p_version, 'fixture-version');
    });
    await test('integrated history pagination, error and retry', async () => {
      await fixture(); await p.evaluate(() => { mock.status = 'rejected'; go('registros'); });
      await p.locator('[data-review-tab="history"]').click(); await p.waitForSelector('.capex-review-row'); assert.equal(await p.locator('.capex-review-row').count(), 30);
      assert(await p.getByRole('button', { name: 'Pagina anterior'.replace('Pagina', 'P\u00e1gina') }).isDisabled());
      await p.getByRole('button', { name: 'Pr\u00f3xima p\u00e1gina' }).click(); await p.waitForFunction(() => document.querySelector('.capex-review-pagination').textContent.includes('2'));
      assert.equal(await p.locator('.capex-review-row').count(), 1); assert(await p.getByRole('button', { name: 'Pr\u00f3xima p\u00e1gina' }).isDisabled());
      assert.deepEqual((await p.evaluate(() => mock.ranges)).slice(-2), [[0, 29], [30, 59]]);
      await p.evaluate(() => { mock.listError = 'History offline'; return CapexReviews.load(); }); assert.match(await p.locator('#capex-review-list [role=alert]').innerText(), /History offline/);
      await p.evaluate(() => mock.listError = null); await p.getByRole('button', { name: 'Tentar novamente' }).click(); await p.waitForSelector('.capex-review-row');
    });
    await test('desktop and mobile dialogs and history fit viewport', async () => {
      for (const width of [1440, 390]) {
        await p.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
        for (const mode of ['request', 'decision', 'history']) {
          await fixture(mode === 'decision' ? 'owner' : 'reader');
          await p.evaluate(mode => { if (mode === 'request') CapexReviews.request(101); else if (mode === 'decision') return CapexReviews.open(1); else { mock.status = 'approved'; go('registros'); CapexReviews.switchTab('history'); } }, mode);
          if (mode === 'history') await p.waitForSelector('.capex-review-row');
          await shot(mode + '-' + width);
          const overflow = await p.evaluate(() => {
            const host = document.querySelector('dialog[open]') || document.querySelector('#capex-review-list');
            return { page: document.documentElement.scrollWidth > innerWidth + 1, host: host.scrollWidth > host.clientWidth + 1, outside: [...host.querySelectorAll('button,textarea,input')].filter(e => { const r = e.getBoundingClientRect(); return r.width && (r.left < 0 || r.right > innerWidth + 1); }).map(e => e.textContent) };
          });
          assert.deepEqual(overflow, { page: false, host: false, outside: [] }, mode + ' ' + width);
        }
      }
    });
    await test('approved snapshot document normalization and viewer handoff', async () => {
      await fixture();
      await p.evaluate(() => {
        const original = db.rpc;
        db.rpc = async (name, args) => {
          const result = await original(name, args);
          if (name === 'get_capex_review') {
            result.data.current_item = null; result.data.review.status = 'approved';
            result.data.review.request_snapshot.docs_json = [{ name: 'Comprovante.pdf', storagePath: 'fixture/comprovante.pdf', bucket: 'pagamentos' }];
          }
          return result;
        };
        window.openedDocument = null; viewFile = d => { window.openedDocument = d; };
        return CapexReviews.open(1);
      });
      const doc = dialog.getByRole('button', { name: 'Comprovante.pdf' }); assert(await doc.isVisible());
      await shot('snapshot-document-mobile'); await doc.click();
      assert.equal(await p.evaluate(() => openedDocument.storagePath), 'fixture/comprovante.pdf'); assert.equal(await dialog.isVisible(), false);
    });
    await test('detail backend error is visible and modal can close', async () => {
      await fixture(); await p.evaluate(() => { mock.rpcError = 'Detail unavailable'; return CapexReviews.open(1); });
      assert.equal(await error.innerText(), 'Detail unavailable'); await dialog.getByRole('button', { name: 'Fechar' }).click(); assert.equal(await dialog.isVisible(), false);
    });
    await test('identity change discards pending detail response', async () => {
      await fixture('owner');
      await p.evaluate(() => { mock.delay = 600; window.pendingDetail = CapexReviews.open(1); });
      await p.evaluate(() => { currentProfile = { id: 'different-reader', role: 'reader', aprovado: true, access_config: { capex: 'none', registros: 'none' } }; CapexReviews.pendingCount(); });
      assert.equal(await dialog.isVisible(), false); await p.evaluate(() => window.pendingDetail);
      await shot('identity-change-detail');
      assert.equal(await dialog.isVisible(), false, 'Old detail response must not reopen after identity loses access');
    });
    await test('long reference in mobile history does not overflow', async () => {
      await p.setViewportSize({ width: 390, height: 844 }); await fixture();
      await p.evaluate(() => {
        const original = review;
        review = id => { const r = original(id); return { ...r, request_snapshot: { ...r.request_snapshot, referencia: 'R'.repeat(120) } }; };
        mock.status = 'approved'; go('registros'); CapexReviews.switchTab('history');
      });
      await p.waitForSelector('.capex-review-row'); await shot('long-reference-mobile');
      const size = await p.locator('#capex-review-list').evaluate(e => ({ scroll: e.scrollWidth, client: e.clientWidth }));
      assert(size.scroll <= size.client + 1, 'History width ' + size.scroll + ' exceeds container ' + size.client);
    });
    await test('no runtime errors', async () => assert.deepEqual(errors, []));
  } finally {
    fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify({ results, errors, interceptedNetwork: network, screenshots, fixture: 'real index.html; mocked db.rpc/db.from; all Supabase network intercepted' }, null, 2));
    await browser.close();
  }
  console.log('Artifacts: ' + out);
  if (results.some(r => !r.passed)) process.exitCode = 1;
})().catch(e => { console.error(e); process.exitCode = 1; });
