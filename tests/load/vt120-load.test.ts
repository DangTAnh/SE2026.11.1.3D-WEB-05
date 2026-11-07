import { expect, test } from 'vitest';
import { writeFileSync } from 'node:fs';
import { PresetPersistenceClient } from '../../src/presets/persistence.ts';
import { cloneConfig, DEFAULT_CONFIG, type PresetDocument } from '../../src/presets/preset.ts';
import { Vt120Service } from '../support/vt120-service.ts';

test('VT120-T15 eighty simultaneous tasks meet the 2500ms p95 harness target', async () => {
  const service = new Vt120Service(key => Number(key.split('-')[1]) % 2 ? ['after'] : ['before'],
    () => new Promise(resolve => setTimeout(resolve, 1)));
  const client = new PresetPersistenceClient(service, {maxAttempts: 3, delayMs: 5});
  let submittedAt = 0;
  let release!: () => void;
  const barrier = new Promise<void>(resolve => {release = resolve;});
  const tasks = Array.from({length: 80}, (_, id) => (async () => {
    await barrier;
    const started = submittedAt; // Include initial dispatch queue for all 80 tasks.
    const input: PresetDocument = {schemaVersion: 2, app: '3D-WEB-05', name: 'VT120-task-' + id, config: cloneConfig(DEFAULT_CONFIG)};
    input.config.simulation.particleCount = 1000 + id * 137;
    const receipt = await client.save('task-' + id, input);
    expect(client.confirmed(receipt.key)).toEqual(service.ledger.get(receipt.key));
    return {id, latencyMs: performance.now() - started};
  })());
  submittedAt = performance.now();
  release();
  const settled = await Promise.allSettled(tasks);
  const raw = settled.filter((result): result is PromiseFulfilledResult<{id:number;latencyMs:number}> => result.status === 'fulfilled').map(result => result.value);
  const latencies = raw.map(row => row.latencyMs).sort((a,b) => a-b);
  const result = {tasks: 80, errors: settled.length - raw.length, p95Ms: latencies[Math.ceil(.95 * 80) - 1],
    maxMs: latencies.at(-1), effects: [...service.effects.values()].reduce((a,b)=>a+b,0), calls: service.calls.length,
    scope: 'common barrier-release timestamp includes initial dispatch queue; single process; 1ms simulated I/O; 80 independent keys; half before-commit faults/half response losses; no real-user/GPU capacity claim',
    node: process.version, raw};
  if (process.env.VT120_LOAD_RESULT) writeFileSync(process.env.VT120_LOAD_RESULT, JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
  expect(result.errors).toBe(0);
  expect(result.effects).toBe(80);
  expect(result.calls).toBe(160);
  expect(result.p95Ms).toBeLessThanOrEqual(2500);
});
