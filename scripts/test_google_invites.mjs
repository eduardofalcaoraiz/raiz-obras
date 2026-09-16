import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import {createWorker,messageFor} from '../supabase/functions/access-mail-worker/handler.mjs';
import {createHandler} from '../supabase/functions/access-invitations/handler.mjs';
const id='22222222-2222-4222-8222-222222222222',lease='33333333-3333-4333-8333-333333333333',actor='11111111-1111-4111-8111-111111111111';
const owner='eduardo.falcao@raizeducacao.com.br',audience='script-client.apps.googleusercontent.com',url='https://project.supabase.co';
function fixture(options={}){
 const calls=[];
 const link=url+'/auth/v1/verify?token=private-link&type=invite&redirect_to='+encodeURIComponent('https://raiz-obras.vercel.app/?access_invite='+id);
 const job={id,lease,to:options.test?owner:'person@example.test',is_test:!!options.test,nome:'<Test>',invitation_id:id,access_config:{capex:'read'},expires_at:new Date(Date.now()+3600000).toISOString(),existing_user:!!options.existing,...options.job};
 const fetcher=async(u,init)=>{
  const path=new URL(u).pathname,body=JSON.parse(init.body);calls.push({path,body});
  let data=null;
  if(path.endsWith('/app_mail_claim'))data=options.empty?null:job;
  if(path==='/auth/v1/admin/generate_link')data={action_link:options.badLink?'https://evil.test/':link};
  return new Response(JSON.stringify(data),{status:200});
 };
 const claims={aud:audience,email:owner,email_verified:true,iss:'https://accounts.google.com',exp:Math.floor(Date.now()/1000)+3600,...options.claims};
 const handle=createWorker({url,serviceKey:'server-secret',audience:options.noConfig?'':audience,fetcher,verifyGoogle:async()=>{if(options.badSignature)throw Error('signature');return claims;}});
 const send=(body={action:'claim',quota:100},headers={})=>handle(new Request('https://worker.test',{method:'POST',headers:{Authorization:'Bearer google-id-token',...headers},body:JSON.stringify(body)}));
 return {calls,send,link};
}
test('Google worker rejects wrong identity, audience, issuer, signature and expiry',async()=>{
 for(const options of [{claims:{email:'other@example.test'}},{claims:{aud:'other'}},{claims:{email_verified:false}},{claims:{iss:'evil'}},{claims:{exp:1}},{badSignature:true},{noConfig:true}]){
  const f=fixture(options),r=await f.send();assert([401,403,503].includes(r.status));assert.equal(f.calls.length,0);
 }
});
test('browser origin and missing identity cannot claim mail',async()=>{
 for(const headers of [{Origin:'https://raiz-obras.vercel.app'},{Authorization:''}]){const f=fixture();assert([401,403].includes((await f.send(undefined,headers)).status));assert.equal(f.calls.length,0);}
});
test('recipient and message always come from the claimed queue, never caller fields',async()=>{
 const f=fixture();const r=await f.send({action:'claim',quota:100,to:'attacker@test.test',html:'evil'});const data=await r.json();
 assert.equal(data.job.to,'person@example.test');assert(data.job.html.includes('&lt;Test&gt;'));assert(!JSON.stringify(data).includes('server-secret'));
 assert.equal(f.calls.find(c=>c.path.includes('generate_link')).body.type,'invite');
});
test('existing account receives magic link, without inviting or recreating it',async()=>{const f=fixture({existing:true});assert.equal((await f.send()).status,200);assert.equal(f.calls.find(c=>c.path.includes('generate_link')).body.type,'magiclink');});
test('unsafe authentication URL fails the job and is never sent',async()=>{const f=fixture({badLink:true});assert.equal((await f.send()).status,502);assert.equal(f.calls.at(-1).body.p_success,false);});
test('test mail goes only to owner and creates no authentication link',async()=>{const f=fixture({test:true});const data=await (await f.send()).json();assert.equal(data.job.to,owner);assert(!f.calls.some(c=>c.path.includes('generate_link')));const bad=fixture({test:true,job:{to:'other@test.test'}});assert.equal((await bad.send()).status,502);});
test('no quota means heartbeat without claims or mail',async()=>{const f=fixture();assert.equal((await (await f.send({action:'claim',quota:0})).json()).job,null);assert(!f.calls.some(c=>c.path.endsWith('app_mail_claim')));});
test('ack requires lease and boolean result',async()=>{const f=fixture();assert.equal((await f.send({action:'ack',id,lease,success:true,quota:99})).status,200);assert.deepEqual(f.calls.at(-1).body,{p_id:id,p_lease:lease,p_success:true});assert.equal((await f.send({action:'ack',id,success:true,quota:99})).status,400);});
test('queueing does not claim to have delivered and makes no email API call',async()=>{
 const calls=[];
 const handler=createHandler({url,anonKey:'anon',serviceKey:'secret',emailEnabled:true,delivery:'google',fetcher:async(u,init)=>{
  calls.push(u);let data={};if(u.endsWith('/auth/v1/user'))data={id:actor};else if(u.includes('/user_profiles?'))data=[{role:'admin',aprovado:true}];else if(u.endsWith('/app_mail_status'))data={ready:true};else if(u.endsWith('/app_invite_prepare'))data={id,status:'sending'};
  return new Response(JSON.stringify(data));
 }});
 const response=await handler(new Request('https://raiz-obras.vercel.app',{method:'POST',headers:{Authorization:'Bearer user'},body:JSON.stringify({action:'send',id,email:'person@example.test',nome:'Person',permissions:{capex:'read'}})}));
 assert.equal(response.status,200);assert.deepEqual(await response.json(),{queued:true,id});assert(calls.some(u=>u.endsWith('/app_mail_enqueue')));assert(!calls.some(u=>u.includes('/invite?')||u.includes('generate_link')||u.includes('/otp?')));
});
test('Apps Script sends once even when acknowledgement fails',()=>{
 const props=new Map(),sent=[],acks=[];let claimed=false,failAck=true;
 const context={console,JSON,MailApp:{getRemainingDailyQuota:()=>100,sendEmail:m=>sent.push(m)},LockService:{getScriptLock:()=>({tryLock:()=>true,releaseLock(){}})},PropertiesService:{getScriptProperties:()=>({getProperty:k=>props.get(k),setProperty:(k,v)=>props.set(k,v),deleteProperty:k=>props.delete(k)})}};
 vm.createContext(context);vm.runInContext(fs.readFileSync(new URL('./google-invites/Code.gs',import.meta.url),'utf8'),context);
 context.chamarPlataforma_=body=>{if(body.action==='ack'){acks.push({...body});if(failAck)throw Error('network');return {ok:true};}if(body.action==='claim'&&!claimed){claimed=true;return {job:{id,lease,to:owner,...messageFor({is_test:true})}};}return {ok:true,job:null};};
 assert.throws(()=>context.processarConvites());assert.equal(sent.length,1);assert(JSON.parse(props.get('CONVITE_CONFIRMAR')).success);failAck=false;context.processarConvites();assert.equal(sent.length,1);assert.equal(props.size,0);assert.equal(acks.at(-1).success,true);
});
