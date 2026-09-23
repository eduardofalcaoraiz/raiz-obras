import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createOpenHandler} from '../supabase/functions/access-invite-open/handler.mjs';
const require=createRequire(import.meta.url);
const id='22222222-2222-4222-8222-222222222222',token='a'.repeat(64),url='https://project.supabase.co',origin='https://raiz-obras.vercel.app';
function fixture({denied=false,existing=false,badUrl=false}={}){
 const calls=[];
 const handler=createOpenHandler({url,serviceKey:'private-service',fetcher:async(u,init)=>{
  const data=JSON.parse(init.body);calls.push({u,data});
  if(u.endsWith('app_invite_link_open'))return new Response(JSON.stringify(denied?{code:'42501'}:{email:'recipient@example.test',nome:'Person',existing_user:existing}),{status:denied?403:200});
  return new Response(JSON.stringify({action_link:badUrl?'https://evil.test':url+'/auth/v1/verify?redirect_to='+encodeURIComponent(origin+'/?access_invite='+id)}));
 }});
 return {calls,send:(body={id,token},method='POST',from=origin)=>handler(new Request(origin,{method,headers:{Origin:from},...(method==='POST'?{body:JSON.stringify(body)}:{})}))};
}
test('invitation status is independent of dates',()=>{
 const {invitationStatus}=require('./access-invites.js');
 for(const expires_at of [null,'2000-01-01','2100-01-01'])assert.equal(invitationStatus({status:'sent',expires_at}),'sent');
 for(const status of ['accepted','revoked','failed'])assert.equal(invitationStatus({status,expires_at:null}),status);
});
test('new and existing recipients receive a freshly generated authentication link',async()=>{
 for(const existing of [false,true]){const f=fixture({existing});const r=await f.send({id,token,email:'attacker@test.test'});assert.equal(r.status,200);
 assert.notEqual(f.calls[0].data.p_hash,token);assert.match(f.calls[0].data.p_hash,/^[a-f0-9]{64}$/);
 assert.equal(f.calls[1].data.email,'recipient@example.test');assert.equal(f.calls[1].data.type,existing?'magiclink':'invite');
 assert.equal(f.calls[1].data.redirect_to,origin+'/?access_invite='+id);assert(!(await r.text()).includes('private-service'));}
});
test('unavailable, revoked or consumed invitation cannot generate authentication links',async()=>{const f=fixture({denied:true});assert.equal((await f.send()).status,403);assert.equal(f.calls.length,1);});
test('malformed token, wrong origin and GET do not reach database',async()=>{const f=fixture();assert.equal((await f.send({id,token:'bad'})).status,400);assert.equal((await f.send(undefined,'POST','https://evil.test')).status,403);assert.equal((await f.send(undefined,'GET')).status,405);assert.equal(f.calls.length,0);});
test('authentication redirects are restricted to the project',async()=>{const f=fixture({badUrl:true});assert.equal((await f.send()).status,503);});
