import { expect, test } from 'vitest';
import {
  cloneConfig,
  DEFAULT_CONFIG,
  type PresetDocument,
} from '../../src/presets/preset.ts';
import { PresetSaveService } from '../../src/presets/resubmission.ts';
import { Vt122Store } from '../support/vt122-store.ts';

const document = (name = 'AI candidate'): PresetDocument => ({
  schemaVersion: 2,
  app: '3D-WEB-05',
  name,
  config: cloneConfig(DEFAULT_CONFIG),
});

const makeService = (store: Vt122Store): PresetSaveService =>
  new PresetSaveService(store, { retentionMs: 20, now: () => 1000 });

test('AI-01 duplicate happy path', async () => {
  const store = new Vt122Store();
  const saver = makeService(store);
  const input = document();
  await saver.save('req-1', input);
  await saver.save('req-1', input);
  expect(store.calls).toHaveLength(1);
});

test('AI-02 weak promise assertion', async () => {
  const store = new Vt122Store();
  const saver = makeService(store);
  await expect(saver.save('req-1', document())).resolves.toBeDefined();
});

test('AI-03 invalid key without a zero-call oracle', async () => {
  const store = new Vt122Store();
  const saver = makeService(store);
  await expect(saver.save('bad key', document())).rejects.toThrow();
});

test('AI-04 duplicate conflict without an effect oracle', async () => {
  const store = new Vt122Store();
  const saver = makeService(store);
  await saver.save('req-1', document('a'));
  await expect(saver.save('req-1', document('b'))).rejects.toThrow();
});

test('AI-05 weak receipt mismatch assertion', async () => {
  const store = new Vt122Store(['wrong-canonical']);
  const saver = makeService(store);
  await expect(saver.save('req-1', document())).rejects.toThrow();
});

test('AI-06 real-timer retention test', async () => {
  const store = new Vt122Store();
  const saver = new PresetSaveService(store, { retentionMs: 20 });
  const input = document();
  await saver.save('req-1', input);
  await new Promise(resolve => setTimeout(resolve, 25));
  await expect(saver.save('req-1', input)).resolves.toBeDefined();
});
