import { expect, test } from 'vitest';
import { createImportUndo, CommittedPresetError } from '../../src/presets/importUndo.ts';
import { parsePresetDocument, type PresetDocument } from '../../src/presets/preset.ts';
import { A, B, boundaries, candidate, json, makeDocument } from '../support/vt121Data.ts';
function fixture() {
  const owner = Symbol(); let state = makeDocument('original'); let failure: 'none'|'before'|'partial'|'always'|'committed' = 'none';
  const apply = (next: PresetDocument) => {
    const kind = failure; if(kind !== 'always') failure = 'none';
    if(kind === 'before') throw new Error('before');
    if(kind === 'partial' || kind === 'always') {
      state.config.simulation.speed = next.config.simulation.speed; state.name = next.name;
      throw new Error('partial');
    }
    state = next;
    if(kind === 'committed') throw new CommittedPresetError('config committed, reset failed');
  };
  return {owner, session: createImportUndo(owner,()=>state,apply), get:()=>state, fail:(kind:typeof failure)=>{failure=kind;}};
}
test('S1 deep document snapshot restores name, inactive mode, camera, rendering exactly once',()=>{
 const f=fixture();const before=structuredClone(f.get());f.session.importText(f.owner,json(A));
 f.get().config.camera.distance=100;f.get().config.modes.attractor.attractorStrength=4;
 expect(f.session.undo(f.owner)).toBe(true);expect(f.get()).toEqual(before);
 expect(f.session.undo(f.owner)).toBe(false);expect(f.get()).toEqual(before);
});
test.each(boundaries)('%s real v2 schema %s=%s expected=%s',(_id,path,value,accepted)=>{
 const f=fixture();const before=structuredClone(f.get());f.session.importText(f.owner,json(A));const input=candidate(path,value);
 if(accepted){expect(parsePresetDocument(json(input))).toEqual(input);f.session.importText(f.owner,json(input));expect(f.get()).toEqual(input);f.session.undo(f.owner);expect(f.get()).toEqual(A);}
 else{expect(()=>parsePresetDocument(json(input))).toThrow();expect(()=>f.session.importText(f.owner,json(input))).toThrow();expect(f.get()).toEqual(A);expect(f.session.canUndo(f.owner)).toBe(true);f.session.undo(f.owner);expect(f.get()).toEqual(before);}
});
const missing = makeDocument(); delete (missing.config.simulation as Partial<typeof missing.config.simulation>).speed;
test.each(['','""','0','{}','{bad',json(missing),json({...makeDocument(),schemaVersion:1}),json({...makeDocument(),schemaVersion:3}),json({...makeDocument(),name:''}),json({...makeDocument(),name:'a'.repeat(81)})])('B6 malformed/version/name %s preserves exact state/history',input=>{
 const f=fixture();const before=structuredClone(f.get());f.session.importText(f.owner,json(A));
 expect(()=>f.session.importText(f.owner,input)).toThrow();expect(f.get()).toEqual(A);
 f.session.undo(f.owner);expect(f.get()).toEqual(before);
});
test.each([1,80])('B7 name length %s accepted',length=>{const f=fixture();const doc=makeDocument('a'.repeat(length));f.session.importText(f.owner,json(doc));expect(f.get()).toEqual(doc);});
test('S2 consecutive imports undo to immediate predecessor; absent name restored',()=>{const f=fixture();f.session.importText(f.owner,json(makeDocument()));f.session.importText(f.owner,json(B));f.session.undo(f.owner);expect(f.get()).toEqual(makeDocument());expect('name' in f.get()).toBe(false);});
test('S3 manual edit invalidates history',()=>{const f=fixture();f.session.importText(f.owner,json(A));f.session.invalidate(f.owner);expect(f.session.undo(f.owner)).toBe(false);expect(f.get()).toEqual(A);});
test('S4 snapshot validation prevents Undo bypass via malformed current config',()=>{const f=fixture();f.get().config.simulation.speed=99;const before=structuredClone(f.get());expect(()=>f.session.importText(f.owner,json(A))).toThrow();expect(f.get()).toEqual(before);expect(f.session.canUndo(f.owner)).toBe(false);});
test('AUTH1 unauthorized import preserves state and history',()=>{const f=fixture();const before=structuredClone(f.get());f.session.importText(f.owner,json(A));expect(()=>f.session.importText(Symbol(),json(B))).toThrow(/Unauthorized/);expect(f.get()).toEqual(A);expect(f.session.canUndo(f.owner)).toBe(true);f.session.undo(f.owner);expect(f.get()).toEqual(before);});
test('AUTH2 unauthorized undo preserves state and history',()=>{const f=fixture();const before=structuredClone(f.get());f.session.importText(f.owner,json(A));expect(()=>f.session.undo(Symbol())).toThrow(/Unauthorized/);expect(f.get()).toEqual(A);expect(f.session.canUndo(f.owner)).toBe(true);f.session.undo(f.owner);expect(f.get()).toEqual(before);});
test('AUTH3 wrong owner cannot inspect or invalidate history',()=>{const f=fixture();f.session.importText(f.owner,json(A));expect(()=>f.session.canUndo(Symbol())).toThrow(/Unauthorized/);expect(()=>f.session.invalidate(Symbol())).toThrow(/Unauthorized/);expect(f.session.canUndo(f.owner)).toBe(true);expect(f.get()).toEqual(A);});
test.each(['before','partial'] as const)('FAIL1/2 %s import recovers state and prior history',kind=>{const f=fixture();const before=structuredClone(f.get());f.session.importText(f.owner,json(A));f.fail(kind);expect(()=>f.session.importText(f.owner,json(B))).toThrow();expect(f.get()).toEqual(A);expect(f.session.canUndo(f.owner)).toBe(true);f.session.undo(f.owner);expect(f.get()).toEqual(before);});
test('FAIL3 partial Undo failure retains history and recovers imported state',()=>{const f=fixture();const before=structuredClone(f.get());f.session.importText(f.owner,json(A));f.fail('partial');expect(()=>f.session.undo(f.owner)).toThrow(/partial/);expect(f.get()).toEqual(A);expect(f.session.canUndo(f.owner)).toBe(true);f.session.undo(f.owner);expect(f.get()).toEqual(before);});
test('FAIL4 apply and rollback throw: both errors exposed, no universal atomicity claim',()=>{const f=fixture();f.session.importText(f.owner,json(A));f.fail('always');let error:unknown;try{f.session.importText(f.owner,json(B));}catch(e){error=e;}expect(error).toBeInstanceOf(AggregateError);expect((error as AggregateError).errors).toHaveLength(2);expect(f.session.canUndo(f.owner)).toBe(true);});
test('FAIL5 committed config with reset warning retains Undo; committed Undo consumes it',()=>{const f=fixture();const before=structuredClone(f.get());f.fail('committed');expect(()=>f.session.importText(f.owner,json(A))).toThrow(CommittedPresetError);expect(f.get()).toEqual(A);expect(f.session.canUndo(f.owner)).toBe(true);f.fail('committed');expect(()=>f.session.undo(f.owner)).toThrow(CommittedPresetError);expect(f.get()).toEqual(before);expect(f.session.canUndo(f.owner)).toBe(false);});
