const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const png=fs.readFileSync(path.join(root,'assets/brands/colegio-qi-original.png'));
assert.equal(crypto.createHash('sha256').update(png).digest('hex'),'69c7a4c7acff7fb5fe340c30be14a960db4d939a43c3f156c315b0a8e7af38a6');
assert.equal(png.readUInt32BE(16),1920);assert.equal(png.readUInt32BE(20),401);assert.equal(png[25],6);
const c=vm.createContext({});
vm.runInContext(html.slice(html.indexOf("const _RAW="),html.indexOf('/* ===== AN')),c);
const logos=html.slice(html.indexOf("const _LOGO_BASE="),html.indexOf('function computeCapexMarca('));
vm.runInContext(logos,c);
for(const name of ['QI','qi',' QI ']){
 assert.equal(c.getBrandLogoUrl(name),'/assets/brands/colegio-qi-original.png');
 assert.equal(c.brandLogoUrl(name),'/assets/brands/colegio-qi-original.png');
 assert.match(c.brandLogoImg(name),/colegio-qi-original\.png/);
}
assert.equal(c.brandLogoUrl('QI METROPOLITANO'),null,'Do not invent a separate-brand alias');
assert.match(c.brandLogoUrl('CUBO'),/CUBO/);assert.match(c.brandLogoUrl('MATRIZ'),/MATRIZ/);
assert.match(html,/'QI':\{p:'#F01830'/);
assert.match(html,/scripts\/qi-brand\.css\?v=20261029-original/);
assert.doesNotMatch(html,/LOGO%20DO%20QI\.png/);
const generator=fs.readFileSync(path.join(root,'scripts/generate_all_capex_brand_reports.py'),'utf8');
assert.match(generator,/"logo": "assets\/brands\/colegio-qi-original.png"/);
assert.match(generator,/"logo_preserve_original": True/);
for(const m of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g))if(m[1].trim())new vm.Script(m[1]);
console.log('QI canonical logo, PNG bytes/alpha, aliases, red identity and script parsing passed.');
