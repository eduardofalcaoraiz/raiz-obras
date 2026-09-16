const test=require('node:test'),assert=require('node:assert/strict');
const acl=require('./access-control.js');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
function editHelper(name,profile,active='capex'){
  const source=html.match(new RegExp('function '+name+'\\(\\)\\s*\\{[^}]*\\}'))?.[0];
  assert(source,'Missing permission helper '+name);
  return vm.runInNewContext(source+';'+name+'()',{
    AccessControl:{canEdit:(module=active)=>acl.can(module,'edit',profile)}
  });
}
const user=(extra={})=>({id:'test',role:'leitor',aprovado:true,access_config:{},...extra});
test('pending admin cannot read or edit anything',()=>{const p=user({role:'admin',aprovado:false});for(const [m]of acl.modules){assert.equal(acl.can(m,'read',p),false);assert.equal(acl.can(m,'edit',p),false);}assert.equal(acl.can('','admin',p),false);});
test('approved administrator retains every area',()=>{for(const [m]of acl.modules)assert.equal(acl.can(m,'edit',user({role:'admin'})),true);});
test('new custom profile is deny-by-default',()=>{for(const [m]of acl.modules)assert.equal(acl.can(m,'read',user()),false);});
test('individual permissions override general role without administrator escalation',()=>{const p=user({role:'editor',access_config:{capex:'read',realestate_locacoes:'edit'}});assert(acl.can('capex','read',p));assert(!acl.can('capex','edit',p));assert(acl.can('realestate_locacoes','edit',p));assert(!acl.can('realestate_sublocacoes','read',p));assert(!acl.can('','admin',p));});
test('custom reader can edit only the explicitly granted area',()=>{const p=user({access_config:{realestate_sublocacoes:'edit'}});assert(acl.can('realestate_sublocacoes','edit',p));assert(!acl.can('capex','read',p));});
test('existing profiles keep their prior functional role',()=>{for(const role of ['leitor','doc','editor']){const p=user({role,access_config:null});assert(acl.can('capex','read',p));assert.equal(acl.can('capex','edit',p),role==='editor');}assert(acl.can('escolas','document',user({role:'doc',access_config:null})));});
test('unknown module and invalid access levels fail closed',()=>{assert(!acl.can('secret','read',user({role:'admin'})));for(const value of ['admin',true,1,[],{}])assert(!acl.can('capex','edit',user({access_config:{capex:value}})));});
test('custom doc profile cannot inherit implicit upload rights',()=>{assert(!acl.can('escolas','document',user({role:'doc',access_config:{escolas:'read'}})));});
test('profile summary does not leak markup',()=>assert.equal(acl.summary(user({access_config:{capex:'read',forn:'edit'}})),'1 leitura \u00b7 1 edi\u00e7\u00e3o'));
test('sublease and property controls are independent',()=>{global.currentProfile=user({access_config:{realestate_sublocacoes:'read'}});assert(acl.allowedView('realestate'));assert(!acl.allowedView('capex'));assert(!acl.allowedView('admin'));delete global.currentProfile;});
test('CAPEX budget helper preserves administrator access despite restrictive config',()=>{
  assert.equal(editHelper('capexSaldoCanEdit',user({role:'admin',access_config:{capex:'none'}})),true);
});
test('CAPEX budget helper uses CAPEX permissions regardless of active area',()=>{
  assert.equal(editHelper('capexSaldoCanEdit',user({access_config:{capex:'edit',escolas:'read'}}),'escolas'),true);
  assert.equal(editHelper('capexSaldoCanEdit',user({access_config:{capex:'read',escolas:'edit'}}),'escolas'),false);
  assert.equal(editHelper('capexSaldoCanEdit',user({role:'admin',aprovado:false})),false);
});
test('construction phase helper executes and respects active-area permissions',()=>{
  assert.equal(editHelper('canEditObraFluxo',user({role:'admin'}),'escolas'),true);
  assert.equal(editHelper('canEditObraFluxo',user({access_config:{escolas:'read'}}),'escolas'),false);
  assert.equal(editHelper('canEditObraFluxo',user({access_config:{escolas:'edit'}}),'escolas'),true);
});
