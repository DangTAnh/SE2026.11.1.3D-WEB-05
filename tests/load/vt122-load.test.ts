import { expect, test } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import {
  cloneConfig,
  DEFAULT_CONFIG,
  type PresetDocument,
} from '../../src/presets/preset.ts';
import {
  PresetSaveService,
  type PresetSavePort,
} from '../../src/presets/resubmission.ts';
import { Vt122Store } from '../support/vt122-store.ts';

const TASKS = 100;
const IO_MS = 50;
const TARGET_P95_MS = 3000;
const RETENTION_MS = 60_000;

const document = (name: string): PresetDocument => ({
  schemaVersion: 2,
  app: '3D-WEB-05',
  name,
  config: cloneConfig(DEFAULT_CONFIG),
});

function deferred<T = void>(): {
  promise: Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
} {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>(res => { resolve = res; });
  return { promise, resolve };
}

function percentile(values: readonly number[], fraction: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.ceil(fraction * sorted.length) - 1]!;
}

function saveResult(name: string, settled: readonly PromiseSettledResult<{ id: string; latencyMs: number }>[], store: Vt122Store, scope: string): void {
  const fulfilled = settled.filter(
    (result): result is PromiseFulfilledResult<{ id: string; latencyMs: number }> => result.status === 'fulfilled',
  );
  const latencies = fulfilled.map(result => result.value.latencyMs);
  const failures = settled.filter((result): result is PromiseRejectedResult => result.status === 'rejected');
  const result = {
    scenario: name,
    tasks: settled.length,
    errors: failures.length,
    errorMessages: failures.map(failure => String(failure.reason)),
    effects: [...store.effects.values()].reduce((sum, value) => sum + value, 0),
    calls: store.calls.length,
    p50Ms: percentile(latencies, 0.5),
    p95Ms: percentile(latencies, 0.95),
    maxMs: Math.max(...latencies),
    targetP95Ms: TARGET_P95_MS,
    ioMs: IO_MS,
    node: process.version,
    platform: process.platform,
    arch: process.arch,
    scope,
    raw: fulfilled.map(result => result.value),
  };
  console.log(JSON.stringify(result));
  const directory = process.env.VT122_LOAD_RESULT;
  if (directory) {
    mkdirSync(resolve(directory), { recursive: true });
    writeFileSync(resolve(directory, `${name}.json`), `${JSON.stringify(result, null, 2)}\n`);
  }
}

async function runTasks(
  makeTask: (index: number) => Promise<{ id: string; latencyMs: number }>,
): Promise<PromiseSettledResult<{ id: string; latencyMs: number }>[]> {
  const barrier = deferred();
  const tasks = Array.from({ length: TASKS }, (_, index) => (async () => {
    await barrier.promise;
    const started = performance.now();
    const value = await makeTask(index);
    return { id: value.id, latencyMs: performance.now() - started };
  })());
  barrier.resolve();
  return Promise.allSettled(tasks);
}

class SerializedStore implements PresetSavePort {
  #tail: Promise<void> = Promise.resolve();

  constructor(private readonly inner: PresetSavePort) {}

  save(request: Parameters<PresetSavePort['save']>[0]): ReturnType<PresetSavePort['save']> {
    const result = this.#tail.then(() => this.inner.save(request));
    this.#tail = result.then(() => undefined, () => undefined);
    return result;
  }
}

const scope = 'single Node process, 100 promises, 50 ms simulated I/O per port call, no real network/DB/user capacity claim';

test('VT122-T16 100 unique concurrent tasks meet p95 <= 3000 ms', async () => {
  const store = new Vt122Store([], () => new Promise(resolve => setTimeout(resolve, IO_MS)));
  const saver = new PresetSaveService(store, { retentionMs: RETENTION_MS, now: () => 1000 });

  const settled = await runTasks(async index => {
    const receipt = await saver.save(`unique-${index}`, document(`unique-${index}`));
    return { id: receipt.requestId, latencyMs: 0 };
  });
  saveResult('unique', settled, store, scope);

  const fulfilled = settled.filter(result => result.status === 'fulfilled');
  expect(fulfilled).toHaveLength(TASKS);
  expect(store.calls).toHaveLength(TASKS);
  expect([...store.effects.values()].reduce((sum, value) => sum + value, 0)).toBe(TASKS);
  expect(percentile(fulfilled.map(result => result.value.latencyMs), 0.95)).toBeLessThanOrEqual(TARGET_P95_MS);
});

test('VT122-T17 100 concurrent tasks over 10 keys create only 10 effects', async () => {
  const store = new Vt122Store([], () => new Promise(resolve => setTimeout(resolve, IO_MS)));
  const saver = new PresetSaveService(store, { retentionMs: RETENTION_MS, now: () => 1000 });

  const settled = await runTasks(async index => {
    const key = `duplicate-${index % 10}`;
    const receipt = await saver.save(key, document(key));
    return { id: receipt.requestId, latencyMs: 0 };
  });
  saveResult('duplicates', settled, store, scope);

  const fulfilled = settled.filter(result => result.status === 'fulfilled');
  expect(fulfilled).toHaveLength(TASKS);
  expect(store.calls).toHaveLength(10);
  expect(store.effects.size).toBe(10);
  expect([...store.effects.values()].reduce((sum, value) => sum + value, 0)).toBe(10);
  expect(percentile(fulfilled.map(result => result.value.latencyMs), 0.95)).toBeLessThanOrEqual(TARGET_P95_MS);
});

test('VT122-T19 control: serialized 100 tasks exceed the target, proving the harness is sensitive', async () => {
  const store = new Vt122Store([], () => new Promise(resolve => setTimeout(resolve, IO_MS)));
  const serialized = new SerializedStore(store);
  const saver = new PresetSaveService(serialized, { retentionMs: RETENTION_MS, now: () => 1000 });

  const settled = await runTasks(async index => {
    const receipt = await saver.save(`serial-${index}`, document(`serial-${index}`));
    return { id: receipt.requestId, latencyMs: 0 };
  });
  saveResult('serialized-control', settled, store, `${scope}; deliberate global serialization control`);

  const fulfilled = settled.filter(result => result.status === 'fulfilled');
  expect(fulfilled).toHaveLength(TASKS);
  expect(store.calls).toHaveLength(TASKS);
  expect(percentile(fulfilled.map(result => result.value.latencyMs), 0.95)).toBeGreaterThan(TARGET_P95_MS);
});
