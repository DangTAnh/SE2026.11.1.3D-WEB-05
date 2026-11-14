import { expect, test } from 'vitest';
import { PresetPersistenceClient } from '../../src/presets/persistence.ts';
import { cloneConfig, DEFAULT_CONFIG, type PresetDocument } from '../../src/presets/preset.ts';
import { Vt120Service } from '../support/vt120-service.ts';

const document = (): PresetDocument => ({schemaVersion: 2, app: '3D-WEB-05', name: 'VT120 integration', config: cloneConfig(DEFAULT_CONFIG)});
const immediate = {delayMs: 0, wait: async () => {}};

test('VT120-I01 eighty independent clients share one atomic operation ledger', async () => {
  const service = new Vt120Service(() => ['after']);
  const receipts = await Promise.all(Array.from({length: 80},
    () => new PresetPersistenceClient(service, immediate).save('shared-operation', document())));
  expect(receipts).toHaveLength(80);
  expect(service.effects.get('shared-operation')).toBe(1);
  expect(receipts.every(receipt => receipt.canonical === service.ledger.get(receipt.key)?.canonical)).toBe(true);
});
test('VT120-I02 conflicting clients cannot overwrite a committed key', async () => {
  const service = new Vt120Service();
  const changed = document(); changed.name = 'competing payload';
  const results = await Promise.allSettled([
    new PresetPersistenceClient(service, immediate).save('conflict', document()),
    new PresetPersistenceClient(service, immediate).save('conflict', changed),
  ]);
  expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
  expect(results.filter(result => result.status === 'rejected')).toHaveLength(1);
  expect(service.effects.get('conflict')).toBe(1);
});
test('VT120-I03 repeated response loss stays unconfirmed; same-key retry can later reconcile', async () => {
  const service = new Vt120Service(() => ['after', 'after', 'after']);
  const client = new PresetPersistenceClient(service, immediate);
  await expect(client.save('ambiguous', document())).rejects.toThrow('response lost');
  expect(service.effects.get('ambiguous')).toBe(1);
  expect(client.confirmed('ambiguous')).toBeUndefined();
  const reconciled = await client.save('ambiguous', document());
  expect(client.confirmed('ambiguous')).toEqual(reconciled);
  expect(service.effects.get('ambiguous')).toBe(1);
  const calls = service.calls.length;
  await client.save('ambiguous', document());
  expect(service.calls).toHaveLength(calls);
  expect(Object.isFrozen(reconciled)).toBe(true);
});
