import { test, expect } from './vt121Transport.ts';
import { cloneConfig, DEFAULT_CONFIG } from '../../src/presets/preset.ts';

test('VT121 browser/port integration 200 submitted tasks, pool10 @evidence @vt121load',async({browser})=>{
 test.setTimeout(240000);
 const contexts=await Promise.all(Array.from({length:10},()=>browser.newContext({viewport:{width:1440,height:1000}})));
 try {
  const pages=await Promise.all(contexts.map(c=>c.newPage()));
  await Promise.all(pages.map(async p=>{await p.goto('/tests/e2e/fixtures/renderer-port.html');await expect(p.locator('#speed')).toHaveValue('1.2');}));
  const document={schemaVersion:2,app:'3D-WEB-05',name:'browser load',config:cloneConfig(DEFAULT_CONFIG)};
  document.config.simulation.speed=2;document.config.mode='vortex';
  const raw=Buffer.from(JSON.stringify(document));
  const operation=async(page:typeof pages[number])=>{
   await page.locator('#preset-file').setInputFiles({name:'load.json',mimeType:'application/json',buffer:raw});
   await expect(page.locator('#speed')).toHaveValue('2');
   const undo=page.getByRole('button',{name:'Undo import',exact:true});await undo.click();
   await expect(page.locator('#speed')).toHaveValue('1.2');await expect(undo).toBeDisabled();
  };
  await Promise.all(pages.map(operation)); // one warmup per page
  const started=performance.now();let next=0;
  const results:Array<{id:number;latencyMs:number;serviceMs:number;error?:string}>=[];
  await Promise.all(pages.map(async page=>{
   while(next<200){const id=next++;const begin=performance.now();let error:string|undefined;
    try{await operation(page);}catch(e){error=e instanceof Error?e.message:String(e);}
    const end=performance.now();results.push({id,latencyMs:end-started,serviceMs:end-begin,error});
   }
  }));
  const durationMs=performance.now()-started;const sorted=results.map(r=>r.latencyMs).sort((a,b)=>a-b);
  const q=(p:number)=>sorted[Math.ceil(sorted.length*p)-1];const errors=results.filter(r=>r.error).length;
  console.log(JSON.stringify({type:'browser-round',timestamp:new Date().toISOString(),browser:browser.version(),ops:200,pool:10,rounds:1,warmup:10,errors,durationMs,p50Ms:q(.5),p95Ms:q(.95),p99Ms:q(.99),throughputOpsSec:200/(durationMs/1000),scope:'200 submitted UI import/Undo tasks, max10 browser contexts active, real UI and FakeRenderer over intercepted Vite; not 200 simultaneous real users, not HTTP/GPU SLO',realUserSlo:'NOT_VERIFIED',raw:results}));
  expect(results).toHaveLength(200);expect(errors).toBe(0);
 }finally{await Promise.all(contexts.map(c=>c.close()));}
});
