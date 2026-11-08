import { expect, test } from 'vitest';
import {
  cloneConfig,
  DEFAULT_CONFIG,
  type PresetDocument,
} from '../../src/presets/preset.ts';
import { PresetSaveService } from '../../src/presets/resubmission.ts';
import { Vt122Store } from '../support/vt122-store.ts';

const document = (name = 'VT122 recovery'): PresetDocument => ({
  schemaVersion: 2,
  app: '3D-WEB-05',
  name,
  config: cloneConfig(DEFAULT_CONFIG),
});

const makeService = (store: Vt122Store): PresetSaveService =>
  new PresetSaveService(store, { retentionMs: 1000, now: () => 1000 });

test('VT122-T23 a failed-then-successful retry returns a frozen confirmed receipt', async () => {
  const store = new Vt122Store(['throw-before-commit']);
  const saver = makeService(store);
  const input = document();

  await expect(saver.save('req-1', input)).rejects.toThrow('temporary failure');
  const receipt = await saver.save('req-1', input);

  expect(Object.isFrozen(receipt)).toBe(true);
  expect(store.calls).toHaveLength(2);
  expect(store.effectCount('req-1')).toBe(1);
  expect(saver.confirmed('req-1')).toBe(receipt);
});

test('VT122-T24 a wrong-canonical receipt is rejected and a retry reconciles one effect', async () => {
  const store = new Vt122Store(['wrong-canonical']);
  const saver = makeService(store);
  const input = document();

  await expect(saver.save('req-1', input)).rejects.toThrow(/receipt/);
  expect(saver.confirmed('req-1')).toBeUndefined();
  expect(store.effectCount('req-1')).toBe(1);

  const receipt = await saver.save('req-1', input);
  expect(store.calls).toHaveLength(2);
  expect(store.effectCount('req-1')).toBe(1);
  expect(saver.confirmed('req-1')).toBe(receipt);
});
