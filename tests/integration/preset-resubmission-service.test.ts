import { expect, test } from 'vitest';
import {
  cloneConfig,
  DEFAULT_CONFIG,
  type PresetDocument,
} from '../../src/presets/preset.ts';
import { PresetSaveService } from '../../src/presets/resubmission.ts';
import { Vt122Store } from '../support/vt122-store.ts';

const document = (name = 'VT122 integration'): PresetDocument => ({
  schemaVersion: 2,
  app: '3D-WEB-05',
  name,
  config: cloneConfig(DEFAULT_CONFIG),
});

function makeService(store: Vt122Store): PresetSaveService {
  return new PresetSaveService(store, { retentionMs: 1000, now: () => 1000 });
}

test('VT122-T03 concurrent duplicates share one in-flight port call', async () => {
  const store = new Vt122Store([], () => new Promise(resolve => setTimeout(resolve, 5)));
  const saver = makeService(store);
  const input = document();

  const receipts = await Promise.all(
    Array.from({ length: 20 }, () => saver.save('req-1', input)),
  );

  expect(new Set(receipts).size).toBe(1);
  expect(store.calls).toHaveLength(1);
  expect(store.effectCount('req-1')).toBe(1);
  expect(saver.confirmed('req-1')).toBe(receipts[0]);
});

test('VT122-T08 invalid documents are rejected before the port', async () => {
  const store = new Vt122Store();
  const saver = makeService(store);
  const unknownKey = {
    schemaVersion: 2,
    app: '3D-WEB-05',
    config: { ...cloneConfig(DEFAULT_CONFIG), unknown: true },
  } as unknown as PresetDocument;
  const v1 = {
    schemaVersion: 1,
    app: '3D-WEB-05',
    config: cloneConfig(DEFAULT_CONFIG),
  } as unknown as PresetDocument;

  await expect(saver.save('req-1', unknownKey)).rejects.toThrow(/không được hỗ trợ/);
  await expect(saver.save('req-2', v1)).rejects.toThrow(/v1.*không được hỗ trợ/);
  expect(store.calls).toHaveLength(0);
});

test('VT122-T09 a lost response stays unconfirmed and a retry keeps one effect', async () => {
  const store = new Vt122Store(['throw-after-commit']);
  const saver = makeService(store);
  const input = document();

  await expect(saver.save('req-1', input)).rejects.toThrow('response lost');
  expect(store.calls).toHaveLength(1);
  expect(store.effectCount('req-1')).toBe(1);
  expect(saver.confirmed('req-1')).toBeUndefined();

  const receipt = await saver.save('req-1', input);
  expect(store.calls).toHaveLength(2);
  expect(store.effectCount('req-1')).toBe(1);
  expect(saver.confirmed('req-1')).toBe(receipt);
});

test('VT122-T10 a failure before commit can be retried without a duplicate', async () => {
  const store = new Vt122Store(['throw-before-commit']);
  const saver = makeService(store);
  const input = document();

  await expect(saver.save('req-1', input)).rejects.toThrow('temporary failure');
  expect(store.effectCount('req-1')).toBe(0);
  expect(saver.confirmed('req-1')).toBeUndefined();

  const receipt = await saver.save('req-1', input);
  expect(store.calls).toHaveLength(2);
  expect(store.effectCount('req-1')).toBe(1);
  expect(saver.confirmed('req-1')).toBe(receipt);
});

test('VT122-T12 different request ids commit independently without global serialization', async () => {
  const store = new Vt122Store();
  const saver = makeService(store);

  const receipts = await Promise.all([
    saver.save('req-a', document('a')),
    saver.save('req-b', document('b')),
  ]);

  expect(receipts).toHaveLength(2);
  expect(store.calls).toHaveLength(2);
  expect(store.effectCount('req-a')).toBe(1);
  expect(store.effectCount('req-b')).toBe(1);
});
