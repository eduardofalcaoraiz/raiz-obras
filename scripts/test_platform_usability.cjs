const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const {chromium} = require('playwright');
const root = path.resolve(__dirname, '..');
(async () => {
  const browser = await chromium.launch({channel:'chrome', headless:true});
  try {
    for (const width of [1440, 390]) {
      const page = await browser.newPage({viewport:{width, height:900}});
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.route('**/*', route => route.abort());
      // Real markup/styles, with business scripts and handlers removed: no data writes.
      const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8')
        .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/\son\w+\s*=\s*(?:"[^"]*"|'[^']*')/gi, '');
      await page.setContent(html);
      await page.evaluate(() => {
        const launcher = document.createElement('button');
        launcher.id = 'test-launcher'; launcher.textContent = 'Open';
        launcher.style.cssText = 'position:fixed;top:0;left:0;z-index:99999';
        document.body.append(launcher); launcher.focus();
      });
      await page.addScriptTag({path:path.join(root, 'scripts/platform-usability.js')});
      const settle = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      const toggle = async (id, show) => {
        await page.evaluate(({id, show}) => document.getElementById(id).classList.toggle('show', show), {id, show});
        await settle();
      };
      await toggle('obra-overlay', true);
      assert.equal(await page.locator('#obra-overlay .modal').getAttribute('role'), 'dialog');
      assert(await page.locator('#obra-overlay .modal').getAttribute('aria-labelledby'));
      assert(await page.evaluate(() => document.querySelector('#obra-overlay .modal') === document.activeElement));
      await page.keyboard.press('Shift+Tab');
      assert(await page.evaluate(() => document.querySelector('#obra-overlay').contains(document.activeElement)));
      const parentFocus = await page.evaluate(() => { document.activeElement.id ||= 'parent-focus-test'; return document.activeElement.id; });
      await toggle('confirm-overlay', true);
      for (let i = 0; i < 12; i++) {
        await page.keyboard.press(i % 2 ? 'Shift+Tab' : 'Tab');
        assert(await page.evaluate(() => document.querySelector('#confirm-overlay').contains(document.activeElement)));
      }
      await page.evaluate(() => document.getElementById('test-launcher').focus());
      assert(await page.evaluate(() => document.querySelector('#confirm-overlay').contains(document.activeElement)));
      await page.keyboard.press('Escape');
      assert(await page.locator('#confirm-overlay').evaluate(el => el.classList.contains('show')));
      await toggle('confirm-overlay', false);
      assert.equal(await page.evaluate(() => document.activeElement.id), parentFocus);
      await toggle('obra-overlay', false);
      assert.equal(await page.evaluate(() => document.activeElement.id), 'test-launcher');
      await page.evaluate(() => {
        const el = document.createElement('div');
        el.id = 'dynamic-test'; el.className = 'overlay show';
        el.innerHTML = '<div class="modal" role="alertdialog" aria-label="Existing"><p>Empty</p></div>';
        document.body.append(el);
      });
      await settle();
      await page.keyboard.press('Tab');
      assert.equal(await page.locator('#dynamic-test .modal').getAttribute('role'), 'alertdialog');
      assert.equal(await page.locator('#dynamic-test .modal').getAttribute('aria-label'), 'Existing');
      assert(await page.evaluate(() => document.querySelector('#dynamic-test .modal') === document.activeElement));
      await page.evaluate(() => {
        const dialog = document.createElement('dialog');
        dialog.id = 'native-test'; dialog.innerHTML = '<button>Native</button>';
        document.body.append(dialog); dialog.showModal();
      });
      await settle();
      assert(await page.evaluate(() => document.getElementById('native-test').contains(document.activeElement)));
      await page.evaluate(() => { document.getElementById('native-test').close(); document.getElementById('dynamic-test').remove(); });
      await settle();
      assert.equal(await page.evaluate(() => document.activeElement.id), 'test-launcher');
      assert.equal(await page.locator('#sidebar').getAttribute('role'), null);
      assert.deepEqual(errors, []);
      await page.close();
      console.log('PASS real-index offline modal keyboard tests: ' + width + 'px');
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
