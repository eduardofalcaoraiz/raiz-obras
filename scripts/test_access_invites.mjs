import test from 'node:test';
import assert from 'node:assert/strict';
import {createHandler,validPermissions} from '../supabase/functions/access-invitations/handler.mjs';
const admin='11111111-1111-4111-8111-111111111111',id='22222222-2222-4222-8222-222222222222';
const origin='https://raiz-obras.vercel.app';
function fixture(opts={}){
 const calls=[];
 const fetcher=async(url,init)=>{
  const path=new URL(url).pathname;calls.push({path,init,body:init.body?JSON.parse(init.body):undefined,url});
  let result={};let status=200;
  if(path==='/auth/v1/user'){result={id:admin};if(opts.badToken)status=401;}
  else if(path==='/rest/v1/user_profiles')result=[{role:opts.reader?'leitor':'admin',aprovado:!opts.pending}];
  else if(path.endsWith('/app_invite_prepare'))result={id,existing_user:!!opts.existing,duplicate:!!opts.duplicate,status:opts.duplicateStatus||'sent'};
  else if(path.endsWith('/app_invite_accept'))result={accepted:true,needs_password:true};
  else if(path==='/auth/v1/invite'||path==='/auth/v1/otp'){if(opts.mailFails)status=500;}
  else if(path.endsWith('/app_invite_delivery')&&opts.persistenceFails)status=500;
  return new Response(JSON.stringify(result),{status});
 };
 const handler=createHandler({url:'https://project.supabase.co',anonKey:'anon',serviceKey:'secret',emailEnabled:opts.enabled!==false,fetcher});
 const send=(body,extra={})=>handler(new Request(origin+'/functions/v1/access-invitations',{method:'POST',headers:{Origin:extra.origin||origin,Authorization:extra.auth===undefined?'Bearer user-token':extra.auth},body:JSON.stringify(body)}));
 return {calls,send};
}
const body={action:'send',id,nome:'Pessoa Teste',email:'teste@example.test',permissions:{capex:'read'}};
test('permissions reject admin escalation, unknown modules and empty grants',()=>{assert(validPermissions({capex:'edit'}));for(const v of [{},[],null,{capex:'admin'},{secret:'read'},{capex:'none'}])assert(!validPermissions(v));});
test('only approved administrators can send invitations',async()=>{for(const opts of [{reader:true},{pending:true},{badToken:true}]){const f=fixture(opts),r=await f.send(body);assert([401,403].includes(r.status));assert(!f.calls.some(c=>c.path.includes('app_invite_prepare')));}});
test('SMTP unconfigured fails before any email or write',async()=>{const f=fixture({enabled:false}),r=await f.send(body);assert.equal(r.status,503);assert(!f.calls.some(c=>c.init.method==='POST'));});
test('new person receives native invite with fixed redirect and no credentials returned',async()=>{const f=fixture(),r=await f.send(body);assert.equal(r.status,200);const sent=f.calls.find(c=>c.path==='/auth/v1/invite');assert(sent);assert.equal(new URL(sent.url).searchParams.get('redirect_to'),origin+'/?access_invite='+id);assert.equal(sent.body.email,body.email);assert(!JSON.stringify(await r.json()).includes('secret'));});
test('existing person receives sign-in link without recreating account',async()=>{const f=fixture({existing:true});assert.equal((await f.send(body)).status,200);const sent=f.calls.find(c=>c.path==='/auth/v1/otp');assert.equal(sent.body.create_user,false);assert(!f.calls.some(c=>c.path==='/auth/v1/invite'));});
test('failed provider is recorded as failed, never sent',async()=>{const f=fixture({mailFails:true}),r=await f.send(body);assert.equal(r.status,502);const c=f.calls.find(c=>c.path.endsWith('app_invite_delivery'));assert.equal(c.body.p_success,false);});
test('failed delivery persistence never reports a successful invite',async()=>{const f=fixture({persistenceFails:true});assert.notEqual((await f.send(body)).status,200);});
test('duplicate request does not send twice',async()=>{const f=fixture({duplicate:true});assert.equal((await f.send(body)).status,200);assert(!f.calls.some(c=>c.path==='/auth/v1/invite'||c.path==='/auth/v1/otp'));});
test('in-progress duplicate is not misrepresented as sent',async()=>{const f=fixture({duplicate:true,duplicateStatus:'sending'});assert.equal((await f.send(body)).status,409);});
test('acceptance uses authenticated identity, not body user id or permissions',async()=>{const f=fixture({reader:true}),r=await f.send({action:'accept',id,user_id:'other',permissions:{capex:'edit'}});assert.equal(r.status,200);const call=f.calls.find(c=>c.path.endsWith('app_invite_accept'));assert.deepEqual(call.body,{p_id:id,p_user_id:admin});});
test('cross-origin and unauthenticated calls fail closed',async()=>{for(const extra of [{origin:'https://evil.example'},{auth:''},{auth:'Bearer secret'},{auth:'Bearer anon'}]){const f=fixture();assert([401,403].includes((await f.send(body,extra)).status));assert.equal(f.calls.length,0);}});
test('browser cannot supply an external redirect, administrator grants or invalid email',async()=>{const f=fixture();assert.equal((await f.send({...body,permissions:{admin:'edit'}})).status,400);assert.equal((await f.send({...body,email:'invalid'})).status,400);assert(!f.calls.some(c=>c.path.includes('app_invite_prepare')));});
test('revoke is checked by administrator and server RPC',async()=>{const f=fixture();assert.equal((await f.send({action:'revoke',id})).status,200);assert.deepEqual(f.calls.find(c=>c.path.endsWith('app_invite_revoke')).body,{p_id:id,p_actor:admin});});
