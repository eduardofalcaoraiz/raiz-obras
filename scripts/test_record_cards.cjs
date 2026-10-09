const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = name => fs.readFileSync(path.join(__dirname, name), 'utf8');
const cards = read('record-cards.css');
const identity = read('platform-identity.css');
const html = read('../index.html');

// Only logo sizing changes in the school documents reference.
assert.doesNotMatch(cards + identity, /\.uc-(?:body|head|nome|acts)/);
assert.match(cards, /\.uni-card \.uc-logo\{width:60px;height:42px/);
assert.match(cards, /#sidebar\.collapsed \.brand \.mk\{width:54px;height:66px/);
assert.doesNotMatch(identity, /\.view>\.card|\.tabpane>\.card|\.main \.kpi\{/);
assert.match(cards, /linear-gradient\(135deg,var\(--surface\) 0%,var\(--record-soft,var\(--raiz-soft\)\) 132%\)/);
assert.match(cards, /background:var\(--record-accent,var\(--raiz-primary\)\)/);
assert.match(cards, /font-size:var\(--text-card-title,16px\)/);
assert.match(cards, /grid-template-rows:subgrid;grid-row:span 3/);
assert.match(cards, /\.party-card\.investor-card\{grid-row:span 4\}/);
assert.match(cards, /\.dash-table td:first-child\{min-width:230px\}/);
assert.match(cards, /img\{object-fit:contain;flex-shrink:0;max-width:100%\}/);
assert.match(cards, /:focus-visible\{outline:3px solid var\(--record-accent,var\(--raiz-primary\)\)/);
assert.match(cards, /@media\(prefers-reduced-motion:reduce\)[\s\S]*\.party-card\)\{transition:none\}/);
for (const selector of ['capex-brand-logo', 'capex-unit-logo', 'obra-brand-logo']) {
  assert.ok(html.includes(selector), `${selector} must exist in the application`);
}
assert.ok(html.indexOf('scripts/platform-identity.css') < html.indexOf('scripts/record-cards.css'));
console.log('Record card CSS regression checks passed.');
