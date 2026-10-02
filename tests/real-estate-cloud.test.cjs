const {test}=require('node:test');const assert=require('node:assert/strict');
const {runCloud}=require('../scripts/run-real-estate-cloud.cjs');
test('one incremental scan and one bounded link recovery',()=>{
 const calls=[];const result=runCloud(only=>{calls.push(only);return {links_deferred:only?0:8};});
 assert.deepEqual(calls,[false,true]);assert.equal(result.links_deferred,0);
});
test('no extra pass without a backlog',()=>{
 let calls=0;runCloud(()=>{calls++;return {links_deferred:0};});assert.equal(calls,1);
});
test('persistent backlog cannot cause an infinite loop',()=>{
 let calls=0;runCloud(()=>{calls++;return {links_deferred:800};});assert.equal(calls,2);
});
test('manual links-only does not start a full scan',()=>{
 const calls=[];runCloud(only=>{calls.push(only);return {links_deferred:8};},true);assert.deepEqual(calls,[true]);
});
test('failed primary worker is not hidden',()=>{
 assert.throws(()=>runCloud(()=>{throw Error('HTTP 503');}),/HTTP 503/);
});
