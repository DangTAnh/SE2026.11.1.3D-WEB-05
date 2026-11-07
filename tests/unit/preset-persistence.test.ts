import { expect, test, vi } from 'vitest';
import fc from 'fast-check';
import { PresetPersistenceClient } from '../../src/presets/persistence.ts';
import { cloneConfig, DEFAULT_CONFIG, serializePresetDocument, type PresetDocument } from '../../src/presets/preset.ts';
import { Vt120Service, type Fault } from '../support/vt120-service.ts';

const document = (): PresetDocument => ({schemaVersion: 2, app: '3D-WEB-05', name: 'VT120 riêng', config: cloneConfig(DEFAULT_CONFIG)});
const immediate = { delayMs: 0, wait: async () => {} };

test('VT120-T01 persists full document before confirming success', async () => {
  const service = new Vt120Service();
  const client = new PresetPersistenceClient(service, immediate);
  const receipt = await client.save('first', document());
  expect(receipt).toEqual({key: 'first', canonical: serializePresetDocument(document()), committed: true});
  expect(client.confirmed('first')).toEqual(service.ledger.get('first'));
});
test.each(['before', 'after'] as const)('VT120-T02/T03 %s transient failure retries identical operation once', async fault => {
  const service = new Vt120Service(() => [fault]);
  const client = new PresetPersistenceClient(service, immediate);
  await client.save('same', document());
  expect(service.calls).toHaveLength(2);
  expect(service.calls[0]).toEqual(service.calls[1]);
  expect(service.effects.get('same')).toBe(1);
});
test('VT120-T04 persistence exhaustion never reports success or confirms local state', async () => {
  const service = new Vt120Service(() => ['before', 'before', 'before']);
  const client = new PresetPersistenceClient(service, immediate);
  await expect(client.save('failed', document())).rejects.toThrow('temporary before');
  expect(client.confirmed('failed')).toBeUndefined();
  expect(service.ledger.size).toBe(0);
  expect(service.calls).toHaveLength(3);
});
test('VT120-T05 permanent errors stop immediately', async () => {
  const service = new Vt120Service(() => ['permanent']);
  const client = new PresetPersistenceClient(service, immediate);
  await expect(client.save('permanent', document())).rejects.toThrow('permanent');
  expect(service.calls).toHaveLength(1);
});
test('VT120-T06 invalid schema and key never reach persistence', async () => {
  const service = new Vt120Service();
  const client = new PresetPersistenceClient(service, immediate);
  const bad = document(); bad.config.simulation.speed = 999;
  await expect(client.save('invalid', bad)).rejects.toThrow(/Tốc độ/);
  await expect(client.save('', document())).rejects.toThrow('key');
  expect(service.calls).toHaveLength(0);
});
test('VT120-T07 key reuse with different content is rejected, even after response loss', async () => {
  const service = new Vt120Service(() => ['after']);
  const client = new PresetPersistenceClient(service, { ...immediate, maxAttempts: 1 });
  await expect(client.save('reserved', document())).rejects.toThrow();
  const changed = document(); changed.name = 'different';
  await expect(client.save('reserved', changed)).rejects.toThrow('key');
  expect(service.effects.get('reserved')).toBe(1);
  expect(client.confirmed('reserved')).toBeUndefined();
});
test('VT120-T08 mismatched receipt never confirms success', async () => {
  const service = new Vt120Service(() => ['bad-receipt']);
  const client = new PresetPersistenceClient(service, immediate);
  await expect(client.save('bad-receipt', document())).rejects.toThrow('receipt');
  expect(client.confirmed('bad-receipt')).toBeUndefined();
});
test('VT120-T09 concurrent matching calls coalesce and preserve snapshot', async () => {
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const service = new Vt120Service(() => [], () => gate);
  const client = new PresetPersistenceClient(service, immediate);
  const input = document(); const expected = serializePresetDocument(input);
  const calls = Array.from({length: 12}, () => client.save('concurrent', input));
  input.config.camera.distance = 400;
  release();
  const results = await Promise.all(calls);
  expect(results.every(result => result.canonical === expected)).toBe(true);
  expect(service.calls).toHaveLength(1);
  expect(service.effects.get('concurrent')).toBe(1);
});
test('VT120-T10 retries across client instances require service-side deduplication', async () => {
  const service = new Vt120Service(() => ['after']);
  await expect(new PresetPersistenceClient(service, {...immediate, maxAttempts: 1}).save('restart', document())).rejects.toThrow();
  await new PresetPersistenceClient(service, immediate).save('restart', document());
  expect(service.effects.get('restart')).toBe(1);
});
test('VT120-T11 default backoff uses bounded linear waits', async () => {
  vi.useFakeTimers();
  try {
    const service = new Vt120Service(() => ['before', 'before']);
    const run = new PresetPersistenceClient(service).save('delay', document());
    void run.catch(() => {}); // Attach rejection immediately, including RED stub runs.
    await vi.runAllTimersAsync();
    await expect(run).resolves.toMatchObject({committed: true});
    expect(service.calls).toHaveLength(3);
    expect(vi.getTimerCount()).toBe(0);
  } finally { vi.useRealTimers(); }
});
test.each([0, 9, NaN])('VT120-T12 rejects invalid attempt budget %s', maxAttempts => {
  expect(() => new PresetPersistenceClient(new Vt120Service(), { maxAttempts })).toThrow();
});
test('VT120-T13 property: generated partial-failure traces preserve confirmation and at-most-once', async () => {
  await fc.assert(fc.asyncProperty(
    fc.record({count: fc.integer({min: 1000, max: 500000}), speed: fc.integer({min: 100, max: 3000}), name: fc.string({minLength: 1, maxLength: 30})}),
    fc.array(fc.constantFrom<Fault>('before', 'after', 'ok', 'permanent'), {maxLength: 6}),
    fc.integer({min: 1, max: 8}),
    async (data, faults, maxAttempts) => {
      const input = document();
      input.name = data.name; input.config.simulation.particleCount = data.count; input.config.simulation.speed = data.speed / 1000;
      const service = new Vt120Service(() => faults);
      const client = new PresetPersistenceClient(service, {...immediate, maxAttempts});
      let succeeded = false;
      try {
        const receipt = await client.save('property-op', input);
        succeeded = true;
        expect(receipt).toEqual(service.ledger.get('property-op'));
        expect(client.confirmed('property-op')).toEqual(receipt);
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect(client.confirmed('property-op')).toBeUndefined();
      }
      const firstSuccess = faults.findIndex(fault => fault === 'ok');
      const permanent = faults.findIndex(fault => fault === 'permanent');
      const successAt = firstSuccess < 0 ? faults.length : firstSuccess;
      const expectedSuccess = successAt < maxAttempts && (permanent < 0 || permanent > successAt);
      expect(succeeded).toBe(expectedSuccess);
      expect(service.calls.length).toBeLessThanOrEqual(maxAttempts);
      expect(service.effects.get('property-op') ?? 0).toBeLessThanOrEqual(1);
      expect(service.calls.every(call => call.canonical === serializePresetDocument(input))).toBe(true);
    }), {seed: 23001821, numRuns: 200});
});
test('VT120-T14 receipt shape and rejected wait cannot be treated as persisted', async () => {
  const wrong = { write: async () => ({key: 'x', canonical: '', committed: false}) };
  // Runtime adapter input can violate its compile-time contract.
  const client = new PresetPersistenceClient(wrong as never, immediate);
  await expect(client.save('x', document())).rejects.toThrow('receipt');
  const brokenWait = new PresetPersistenceClient(new Vt120Service(() => ['before']), {
    wait: async () => { throw new Error('wait cancelled'); },
  });
  await expect(brokenWait.save('wait', document())).rejects.toThrow('wait cancelled');
  expect(brokenWait.confirmed('wait')).toBeUndefined();
});
