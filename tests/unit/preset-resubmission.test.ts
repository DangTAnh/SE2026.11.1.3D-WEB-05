import { expect, test } from 'vitest';
import {
  cloneConfig,
  DEFAULT_CONFIG,
  serializePresetDocument,
  type PresetDocument,
} from '../../src/presets/preset.ts';
import { PresetSaveService, SaveConflictError } from '../../src/presets/resubmission.ts';
import { Vt122Store, type StoreFault } from '../support/vt122-store.ts';

const document = (name = 'VT122 unit'): PresetDocument => ({
  schemaVersion: 2,
  app: '3D-WEB-05',
  name,
  config: cloneConfig(DEFAULT_CONFIG),
});

function makeClock(start = 1000): { now: () => number; set: (value: number) => void } {
  let value = start;
  return { now: () => value, set: next => { value = next; } };
}

function makeService(store: Vt122Store, clock = makeClock(), retentionMs = 1000): PresetSaveService {
  return new PresetSaveService(store, { retentionMs, now: clock.now });
}

test('VT122-T01 a new request commits once and exposes a confirmed receipt', async () => {
  const store = new Vt122Store();
  const saver = makeService(store);
  const input = document();
  const receipt = await saver.save('req-1', input);

  expect(receipt).toEqual({
    requestId: 'req-1',
    canonical: serializePresetDocument(input),
    committed: true,
  });
  expect(store.calls).toHaveLength(1);
  expect(store.effectCount('req-1')).toBe(1);
  expect(saver.confirmed('req-1')).toBe(receipt);
});

test('VT122-T02 sequential resubmission replays without another port call', async () => {
  const store = new Vt122Store();
  const saver = makeService(store);
  const input = document();

  const first = await saver.save('req-1', input);
  const second = await saver.save('req-1', input);

  expect(store.calls).toHaveLength(1);
  expect(second).toBe(first);
  expect(store.effectCount('req-1')).toBe(1);
});

test('VT122-T04 the same key with different content is rejected before the port', async () => {
  const store = new Vt122Store();
  const saver = makeService(store);
  const first = await saver.save('req-1', document('first'));

  await expect(saver.save('req-1', document('second'))).rejects.toBeInstanceOf(SaveConflictError);
  expect(store.calls).toHaveLength(1);
  expect(store.effectCount('req-1')).toBe(1);
  expect(saver.confirmed('req-1')).toBe(first);
});

test('VT122-T05 the retention boundary is inclusive: exact expiry replays', async () => {
  const clock = makeClock(1000);
  const store = new Vt122Store();
  const saver = makeService(store, clock);
  const input = document();

  const first = await saver.save('req-1', input);
  clock.set(2000);
  const second = await saver.save('req-1', input);

  expect(store.calls).toHaveLength(1);
  expect(store.effectCount('req-1')).toBe(1);
  expect(second).toBe(first);
});

test('VT122-T06 after expiry the cache may re-fetch but the port keeps one effect', async () => {
  const clock = makeClock(1000);
  const store = new Vt122Store();
  const saver = makeService(store, clock);
  const input = document();

  const first = await saver.save('req-1', input);
  clock.set(2001);
  const second = await saver.save('req-1', input);

  expect(store.calls).toHaveLength(2);
  expect(store.effectCount('req-1')).toBe(1);
  expect(second).toEqual(first);
});

test('VT122-T07 invalid request ids are rejected before serialization or I/O', async () => {
  const store = new Vt122Store();
  const saver = makeService(store);
  const input = document();

  for (const requestId of ['', 'bad key', 'slash/key', 'a'.repeat(129)]) {
    await expect(saver.save(requestId, input)).rejects.toThrow(TypeError);
  }
  expect(store.calls).toHaveLength(0);
});

test('VT122-T11 mismatched receipts never become confirmed success', async () => {
  const input = document();
  const faults: readonly StoreFault[] = [
    'wrong-requestId',
    'wrong-canonical',
    'uncommitted',
    'throw-after-commit',
  ];

  for (const fault of faults) {
    const store = new Vt122Store([fault]);
    const saver = makeService(store);
    await expect(saver.save('req-1', input)).rejects.toThrow(/receipt|response lost/);
    expect(store.effectCount('req-1')).toBe(1);
    expect(saver.confirmed('req-1')).toBeUndefined();
  }
});

test('VT122-T13 a failed request still conflicts with different content before expiry', async () => {
  const store = new Vt122Store(['throw-before-commit']);
  const saver = makeService(store);

  await expect(saver.save('req-1', document('first'))).rejects.toThrow('temporary failure');
  expect(store.effectCount('req-1')).toBe(0);

  await expect(saver.save('req-1', document('second'))).rejects.toBeInstanceOf(SaveConflictError);
  expect(store.calls).toHaveLength(1);
});

test('VT122-T14 confirmed() follows the inclusive cache boundary', async () => {
  const clock = makeClock(1000);
  const store = new Vt122Store();
  const saver = makeService(store, clock);
  const first = await saver.save('req-1', document());

  clock.set(1999);
  expect(saver.confirmed('req-1')).toBe(first);
  clock.set(2000);
  expect(saver.confirmed('req-1')).toBe(first);
  clock.set(2001);
  expect(saver.confirmed('req-1')).toBeUndefined();
  expect(store.calls).toHaveLength(1);
});

test('VT122-T20 invalid retention windows are rejected at construction', () => {
  for (const retentionMs of [0, -1, 1.5, 604_800_001, Number.NaN]) {
    expect(() => new PresetSaveService(new Vt122Store(), { retentionMs })).toThrow(RangeError);
  }
});

test('VT122-T21 confirmed() is undefined while the first save is pending', async () => {
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const store = new Vt122Store([], () => gate);
  const saver = makeService(store);
  const pending = saver.save('req-1', document());

  expect(saver.confirmed('req-1')).toBeUndefined();
  release();
  await expect(pending).resolves.toBeDefined();
  expect(saver.confirmed('req-1')).toBeDefined();
});

test('VT122-T22 the default retention window is 24 hours and inclusive', async () => {
  const clock = makeClock(0);
  const store = new Vt122Store();
  const saver = new PresetSaveService(store, { now: clock.now });
  const input = document();
  const first = await saver.save('req-1', input);

  clock.set(86_400_000);
  expect(await saver.save('req-1', input)).toBe(first);
  clock.set(86_400_001);
  await saver.save('req-1', input);

  expect(store.calls).toHaveLength(2);
  expect(store.effectCount('req-1')).toBe(1);
});

test('VT122-T18 the same payload under a different request id is a different operation', async () => {
  const store = new Vt122Store();
  const saver = makeService(store);
  const input = document();

  await saver.save('req-a', input);
  await saver.save('req-b', input);

  expect(store.calls).toHaveLength(2);
  expect(store.effectCount('req-a')).toBe(1);
  expect(store.effectCount('req-b')).toBe(1);
});
