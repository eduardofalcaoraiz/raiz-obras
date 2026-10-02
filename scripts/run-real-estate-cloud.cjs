'use strict';
const {spawnSync}=require('node:child_process');
const path=require('node:path');

function runCloud(worker,linksOnly=false){
  const first=worker(linksOnly);
  // One bounded recovery pass, never another full scan or an unbounded loop.
  if(!linksOnly && first.links_deferred>0)return worker(true);
  return first;
}

function worker(linksOnly){
  const result=spawnSync(process.execPath,[path.join(__dirname,'zeev-real-estate-sync.cjs')],{
    env:{...process.env,RE_LINKS_ONLY:linksOnly?'1':'0'},
    encoding:'utf8',stdio:['ignore','pipe','inherit'],maxBuffer:1024*1024
  });
  if(result.stdout)process.stdout.write(result.stdout);
  if(result.error)throw result.error;
  if(result.status!==0)throw Error('Real Estate worker failed: '+result.status);
  return JSON.parse(result.stdout.trim().split(/\r?\n/).at(-1));
}

if(require.main===module){
  try{
    const result=runCloud(worker,process.env.RE_LINKS_ONLY==='1');
    if(result.links_deferred>0)console.warn('::warning::Related tickets remain queued for the next daily run: '+result.links_deferred);
  }catch(error){console.error(error.message);process.exitCode=1;}
}
module.exports={runCloud};
