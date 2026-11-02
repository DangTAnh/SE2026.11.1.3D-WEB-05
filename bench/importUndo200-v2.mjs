import { performance } from 'node:perf_hooks';
import os from 'node:os';
import assert from 'node:assert/strict';
import { createImportUndo } from '../src/presets/importUndo.ts';
import {A,json,makeDocument} from '../tests/support/vt121Data.ts';
const quantile=(sorted,p)=>sorted[Math.ceil(sorted.length*p)-1];
function operation(){let state=makeDocument();const before=structuredClone(state);const owner=Symbol();const c=createImportUndo(owner,()=>state,next=>{state=next;});c.importText(owner,json(A));assert.deepEqual(state,A);assert.equal(c.undo(owner),true);assert.deepEqual(state,before);}
for(let i=0;i<1000;i++)operation();
console.log(JSON.stringify({type:'environment',timestamp:new Date().toISOString(),node:process.version,os:`${os.platform()} ${os.release()}`,cpu:os.cpus()[0]?.model,logicalCpus:os.cpus().length,totalMemory:os.totalmem(),warmup:1000,rounds:5,workload:'200 Promise sessions submitted together; each real schema-v2 import + Undo + exact document assertions; latency includes queue delay; one Node event loop',inputBytes:Buffer.byteLength(json(A)),targetMs:5000,realUserSlo:'NOT_VERIFIED'}));
for(let round=1;round<=5;round++){
 const start=performance.now();let errors=0;
 const raw=await Promise.all(Array.from({length:200},(_,id)=>{const submitted=performance.now();return Promise.resolve().then(()=>{const begin=performance.now();let error;try{operation();}catch(e){errors++;error=String(e);}const end=performance.now();return{id,latencyMs:end-submitted,serviceMs:end-begin,error};});}));
 const durationMs=performance.now()-start;const sorted=raw.map(v=>v.latencyMs).sort((a,b)=>a-b);
 console.log(JSON.stringify({type:'round',round,ops:200,errors,durationMs,p50Ms:quantile(sorted,.5),p95Ms:quantile(sorted,.95),p99Ms:quantile(sorted,.99),throughputOpsSec:200/(durationMs/1000),scope:'synthetic Node controller only',raw}));
 if(errors)process.exitCode=1;
}
