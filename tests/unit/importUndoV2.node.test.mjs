import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createImportUndo, CommittedPresetError } from '../../src/presets/importUndo.ts';
import { createPresetFileReader } from '../../src/ui/controls/presetFile.ts';
import { A, B, json, makeDocument } from '../support/vt121Data.ts';
test('source controller paths with real v2 parser', () => {
 let state=makeDocument();const before=structuredClone(state);const owner=Symbol();let failures=0;let committed=false;
 const c=createImportUndo(owner,()=>state,next=>{state=next;if(committed){committed=false;throw new CommittedPresetError('reset');}if(failures){failures--;throw new Error('apply');}});
 assert.equal(c.canUndo(owner),false);assert.equal(c.undo(owner),false);
 for(const fn of [()=>c.importText(Symbol(),json(A)),()=>c.undo(Symbol()),()=>c.canUndo(Symbol()),()=>c.invalidate(Symbol())])assert.throws(fn,/Unauthorized/);
 assert.throws(()=>c.importText(owner,'{}'));c.importText(owner,json(A));assert.deepEqual(state,A);
 failures=1;assert.throws(()=>c.importText(owner,json(B)),/apply/);assert.deepEqual(state,A);
 failures=1;assert.throws(()=>c.undo(owner),/apply/);assert.deepEqual(state,A);assert.equal(c.canUndo(owner),true);
 failures=2;assert.throws(()=>c.importText(owner,json(B)),AggregateError);assert.equal(c.canUndo(owner),true);
 c.undo(owner);assert.deepEqual(state,before);
 committed=true;assert.throws(()=>c.importText(owner,json(A)),CommittedPresetError);assert.equal(c.canUndo(owner),true);
 committed=true;assert.throws(()=>c.undo(owner),CommittedPresetError);assert.equal(c.canUndo(owner),false);
 c.importText(owner,json(A));c.invalidate(owner);assert.equal(c.canUndo(owner),false);
});
test('source reader paths',async()=>{
 const notifications=[];const r=createPresetFileReader(t=>{if(t==='bad')throw new Error('bad');},(...args)=>notifications.push(args));
 await r.read({size:0,text:async()=>''});await r.read({size:1000001,text:async()=>''});
 await r.read({size:1,text:async()=> 'ok'});await r.read({size:1,text:async()=> 'bad'});
 await r.read({size:1,text:async()=>{throw 'non-error';}});
 let resolve;const pending=r.read({size:1,text:()=>new Promise(ok=>{resolve=ok;})});r.invalidate();resolve('ok');assert.equal(await pending,false);
 let reject;const stale=r.read({size:1,text:()=>new Promise((_ok,fail)=>{reject=fail;})});r.invalidate();reject(new Error('stale'));assert.equal(await stale,false);
 assert.equal(notifications.length,5);
});
