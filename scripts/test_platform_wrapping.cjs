const fs=require('fs'),Module=require('module'),path=require('path');
// Reuse the isolated real-screen harness, with longer operational content.
let source=fs.readFileSync(path.join(__dirname,'test_platform_layout.cjs'),'utf8');
source=source.replace('for(const width of [1440,1024,390])',`await page.evaluate(()=>{
 unidades[0].nome='Cubo Global School Marapendi - Unidade de Ensino Fundamental e Medio';
 capexItens.forEach(x=>{x.unidade=unidades[0].nome;x.pedido+=' - Equipamentos e materiais destinados a implantacao e adequacao das salas de aula';});
 capexSaldos[0].unidade=unidades[0].nome;
 realEstateImoveis[0].locador='Administradora de Empreendimentos e Participacoes Imobiliarias Ltda';
 });
 for(const width of [1440,1024,768,360])`);
source=source.replaceAll("'Cubo Global School Marapendi'","'Cubo Global School Marapendi - Unidade de Ensino Fundamental e Medio'");
source=source.replace("'realestate','registros','cobranca'","'realestate','registros','cobranca','admin'");
source=source.replace("'.capex-expander-summary,.phead", "'.realestate-area-tab,.capex-expander-summary,.phead");
source=source.replace("await page.evaluate(()=>CapexReviews.close());",`await page.evaluate(()=>CapexReviews.close());
 for(const id of ['obra-overlay','pag-overlay','realestate-overlay','realestate-subloc-overlay','capex-item-overlay','uni-overlay','doc-overlay','inv-overlay','forn-detail-overlay']){
 await page.evaluate(id=>document.getElementById(id).classList.add('show'),id);await capture(id+'-'+width);await page.evaluate(id=>document.getElementById(id).classList.remove('show'),id);
 }`);
source=source.replace('shots.push(name);',`shots.push(name);
 const clipped=await page.evaluate(()=>{
 const scope=document.querySelector('dialog[open],.overlay.show .modal,.view.active');if(!scope)return[];
 return [...scope.querySelectorAll('h1,h2,h3,.btn,.tabbtn,.chip,.capex-summary-title,.capex-summary-meta,.capex-nav-title,.capex-nav-sub,.uc-nome,.party-title,.re-property-address,.re-property-owner,.capex-summary-fact,.capex-brand-stat,.capex-unit-stat,.re-property-card-value')].filter(e=>{
 const r=e.getBoundingClientRect(),s=getComputedStyle(e);return r.width>0&&r.height>0&&s.visibility!=='hidden'&&!e.closest('table')&&(e.scrollWidth>e.clientWidth+2||e.scrollHeight>e.clientHeight+2);
 }).map(e=>({cls:e.className,text:e.textContent.trim().slice(0,80),width:e.clientWidth,scroll:e.scrollWidth}));
 });if(clipped.length)issues.push({name,clipped});`);
const runner=new Module(path.join(__dirname,'wrapping-harness.cjs'),module);runner.filename=runner.id;runner.paths=module.paths;runner._compile(source,runner.filename);
