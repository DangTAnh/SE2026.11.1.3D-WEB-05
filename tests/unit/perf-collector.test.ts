import assert from 'node:assert/strict';
import { afterEach, test, vi } from 'vitest';
import { configHash } from '../../src/core/measurement/configHash.ts';
import { MAX_GPU_MEASUREMENT_AGE_MS } from '../../src/core/renderer/RendererPort.ts';
import type { PerformanceSnapshot } from '../../src/core/types/measurement.ts';
import { PerformanceCollector } from '../../src/perf/collector.ts';
import { cloneConfig, DEFAULT_CONFIG, type LabConfig } from '../../src/presets/preset.ts';
import { FakeRenderer } from '../support/fakeRenderer.ts';

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function createSampleRecorder() {
  const samples: PerformanceSnapshot[] = [];
  let resolveNext: ((sample: PerformanceSnapshot) => void) | null = null;

  return {
    samples,
    onSample(sample: PerformanceSnapshot): void {
      samples.push(sample);
      const resolve = resolveNext;
      resolveNext = null;
      resolve?.(sample);
    },
    nextSample(): Promise<PerformanceSnapshot> {
      assert.equal(resolveNext, null, 'only one pending sample expectation is supported');
      return new Promise((resolve) => {
        resolveNext = resolve;
      });
    },
  };
}

test.each(['stop', 'dispose'] as const)('onStatus can %s collection without emitting a cancelled sample', async action => {
  vi.useFakeTimers();
  const port = new FakeRenderer({ actual: 'webgl2', running: true, fps: 60 });
  const onSample = vi.fn();
  const onError = vi.fn();
  const onStatus = vi.fn(() => collector[action]());
  const collector = new PerformanceCollector(port, {
    warmUpMs: 0,
    cadenceMs: 100,
    getConfig: () => DEFAULT_CONFIG,
    onStatus,
    onSample,
    onError,
  });

  try {
    collector.start();
    await vi.advanceTimersByTimeAsync(0);
    // Wait for the observer, not merely a timer: configHash is asynchronous.
    await vi.waitFor(() => assert.equal(onStatus.mock.calls.length, 1));
    assert.equal(onSample.mock.calls.length, 0);
    assert.equal(onError.mock.calls.length, 0);
    assert.equal(vi.getTimerCount(), 0);
    await vi.advanceTimersByTimeAsync(1000);
    assert.equal(onSample.mock.calls.length, 0);
    assert.equal(port.disposed, false, 'port remains caller-owned');
  } finally {
    collector.dispose();
  }
});

test('samples the actual backend after warm-up at a fixed cadence', async () => {
  vi.useFakeTimers();
  const port = new FakeRenderer({
    actual: 'webgl2',
    running: true,
    gpuTimingAvailable: true,
    fps: 58.5,
    gpuTimeMs: 3.25,
  });
  const recorder = createSampleRecorder();
  const collector = new PerformanceCollector(port, {
    warmUpMs: 100,
    cadenceMs: 50,
    getConfig: () => DEFAULT_CONFIG,
    onSample: recorder.onSample,
  });

  const firstSample = recorder.nextSample();
  collector.start();
  await vi.advanceTimersByTimeAsync(99);
  assert.equal(recorder.samples.length, 0);

  await vi.advanceTimersByTimeAsync(1);
  await firstSample;
  assert.equal(recorder.samples.length, 1);
  const secondSample = recorder.nextSample();
  await vi.advanceTimersByTimeAsync(50);
  await secondSample;
  assert.equal(recorder.samples.length, 2);

  const expectedHash = await configHash(DEFAULT_CONFIG);
  for (const sample of recorder.samples) {
    assert.equal(sample.actual, 'webgl2');
    assert.equal(sample.configHash, expectedHash);
    assert.match(sample.configHash, /^[0-9a-f]{64}$/);
    assert.equal(sample.fps, 58.5);
    assert.equal(sample.gpuTimingAvailable, true);
    assert.equal(sample.gpuTimeMs, 3.25);
  }

  collector.dispose();
});

test('unavailable GPU timing is always stored as null', async () => {
  vi.useFakeTimers();
  const port = new FakeRenderer({
    actual: 'webgpu',
    running: true,
    gpuTimingAvailable: false,
    fps: 60,
    // Deliberately inconsistent input to prove the collector preserves INV-1.
    gpuTimeMs: 4,
  });
  const recorder = createSampleRecorder();
  const collector = new PerformanceCollector(port, {
    warmUpMs: 0,
    cadenceMs: 100,
    getConfig: () => DEFAULT_CONFIG,
    onSample: recorder.onSample,
  });

  const firstSample = recorder.nextSample();
  collector.start();
  await vi.advanceTimersByTimeAsync(0);
  await firstSample;
  assert.equal(recorder.samples.length, 1);

  assert.equal(recorder.samples[0]?.gpuTimingAvailable, false);
  assert.equal(recorder.samples[0]?.gpuTimeMs, null);
  collector.dispose();
});

test('does not emit a sample while the renderer is paused', async () => {
  vi.useFakeTimers();
  const port = new FakeRenderer({
    actual: 'webgpu', running: false, gpuTimingAvailable: true, measurementAgeMs: 0,
    fps: 60, gpuTimeMs: 3,
  });
  const recorder = createSampleRecorder();
  const collector = new PerformanceCollector(port, {
    warmUpMs: 0,
    cadenceMs: 100,
    getConfig: () => DEFAULT_CONFIG,
    onSample: recorder.onSample,
  });

  collector.start();
  await vi.advanceTimersByTimeAsync(0);
  assert.equal(recorder.samples.length, 0);
  collector.dispose();
});

test('rejects producer-available stale GPU timing while preserving valid FPS', async () => {
  vi.useFakeTimers();
  const port = new FakeRenderer({
    actual: 'webgpu', running: true, gpuTimingAvailable: true,
    measurementAgeMs: MAX_GPU_MEASUREMENT_AGE_MS + 1, fps: 60, gpuTimeMs: 3,
  });
  const recorder = createSampleRecorder();
  const collector = new PerformanceCollector(port, {
    warmUpMs: 0,
    cadenceMs: 100,
    getConfig: () => DEFAULT_CONFIG,
    onSample: recorder.onSample,
  });

  try {
    const firstSample = recorder.nextSample();
    collector.start();
    await vi.advanceTimersByTimeAsync(0);
    const sample = await firstSample;

    assert.equal(recorder.samples.length, 1);
    assert.equal(sample.fps, 60);
    assert.equal(sample.gpuTimingAvailable, false);
    assert.equal(sample.gpuTimeMs, null);
  } finally {
    collector.dispose();
  }
});

test('keeps valid FPS when GPU timing is stale, then resumes GPU timing when fresh', async () => {
  vi.useFakeTimers();
  const port = new FakeRenderer({
    actual: 'webgpu', running: true, gpuTimingAvailable: false,
    measurementAgeMs: MAX_GPU_MEASUREMENT_AGE_MS + 1, fps: 60,
  });
  const recorder = createSampleRecorder();
  const collector = new PerformanceCollector(port, {
    warmUpMs: 0,
    cadenceMs: 100,
    getConfig: () => DEFAULT_CONFIG,
    onSample: recorder.onSample,
  });

  const firstSample = recorder.nextSample();
  collector.start();
  await vi.advanceTimersByTimeAsync(0);
  await firstSample;
  assert.equal(recorder.samples.length, 1);
  assert.equal(recorder.samples[0]?.fps, 60);
  assert.equal(recorder.samples[0]?.gpuTimingAvailable, false);
  assert.equal(recorder.samples[0]?.gpuTimeMs, null);

  const nextSample = recorder.nextSample();
  port.setStatus({ measurementAgeMs: 0, gpuTimingAvailable: true, gpuTimeMs: 3.5 });
  await vi.advanceTimersByTimeAsync(100);
  await nextSample;
  assert.equal(recorder.samples.length, 2);
  assert.equal(recorder.samples[1]?.fps, 60);
  assert.equal(recorder.samples[1]?.gpuTimingAvailable, true);
  assert.equal(recorder.samples[1]?.gpuTimeMs, 3.5);
  collector.dispose();
});

test('start, stop and dispose are idempotent and cancelled work emits no more samples', async () => {
  vi.useFakeTimers();
  const port = new FakeRenderer({ actual: 'webgpu', running: true, fps: 60 });
  const recorder = createSampleRecorder();
  const collector = new PerformanceCollector(port, {
    warmUpMs: 20,
    cadenceMs: 10,
    getConfig: () => DEFAULT_CONFIG,
    onSample: recorder.onSample,
  });

  const firstSample = recorder.nextSample();
  collector.start();
  collector.start();
  await vi.advanceTimersByTimeAsync(20);
  await firstSample;
  assert.equal(recorder.samples.length, 1);

  collector.stop();
  collector.stop();
  await vi.advanceTimersByTimeAsync(100);
  assert.equal(recorder.samples.length, 1);

  const secondSample = recorder.nextSample();
  collector.start();
  await vi.advanceTimersByTimeAsync(20);
  await secondSample;
  assert.equal(recorder.samples.length, 2);
  collector.dispose();
  collector.dispose();
  collector.start();
  await vi.advanceTimersByTimeAsync(100);
  assert.equal(recorder.samples.length, 2);
});

test('rejects invalid warm-up and cadence values', () => {
  const port = new FakeRenderer();
  const baseOptions = {
    warmUpMs: 0,
    cadenceMs: 10,
    getConfig: () => DEFAULT_CONFIG,
    onSample: () => {},
  };

  assert.throws(() => new PerformanceCollector(port, { ...baseOptions, warmUpMs: -1 }), RangeError);
  assert.throws(() => new PerformanceCollector(port, { ...baseOptions, cadenceMs: 0 }), RangeError);
});

/**
 * Deferred digest so a test can change the workload while hashing is pending.
 * The real SHA-256 still produces the value, so assertions compare real hashes.
 */
function controlledDigest() {
  const realDigest = globalThis.crypto.subtle.digest.bind(globalThis.crypto.subtle);
  const pending: { bytes: Uint8Array; resolve: (digest: ArrayBuffer) => void; reject: (error: Error) => void }[] = [];
  vi.stubGlobal('crypto', {
    subtle: {
      digest: (_algorithm: string, bytes: Uint8Array) => new Promise<ArrayBuffer>((resolve, reject) => {
        pending.push({ bytes, resolve, reject });
      }),
    },
  });

  return {
    pendingCount: () => pending.length,
    async flush(): Promise<void> {
      const batch = pending.splice(0, pending.length);
      await Promise.all(batch.map(async (item) => {
        item.resolve(await realDigest('SHA-256', new Uint8Array(item.bytes)));
      }));
    },
    fail(): void {
      for (const item of pending.splice(0, pending.length)) item.reject(new Error('digest failed'));
    },
  };
}

function newWorkloadConfig(): LabConfig {
  const config = cloneConfig(DEFAULT_CONFIG);
  config.simulation.speed = 2;
  return config;
}

test('emits only the hash of the workload it actually sampled (#99)', async () => {
  vi.useFakeTimers();
  const port = new FakeRenderer({
    actual: 'webgl2', running: true, gpuTimingAvailable: true, measurementAgeMs: 0,
    fps: 60, gpuTimeMs: 3.25,
  });
  const oldConfig = cloneConfig(DEFAULT_CONFIG);
  const nextConfig = newWorkloadConfig();
  const oldHash = await configHash(oldConfig);
  const nextHash = await configHash(nextConfig);
  assert.notEqual(oldHash, nextHash);

  let current: Readonly<LabConfig> = oldConfig;
  const samples: PerformanceSnapshot[] = [];
  const collector = new PerformanceCollector(port, {
    warmUpMs: 0,
    cadenceMs: 100,
    getConfig: () => current,
    onSample: sample => samples.push(sample),
  });

  const digest = controlledDigest();
  collector.start();
  await vi.advanceTimersByTimeAsync(0);
  assert.equal(digest.pendingCount(), 1, 'capture reached the digest');

  // The user changes the workload (and the renderer's metrics) while hashing.
  current = nextConfig;
  port.setStatus({ fps: 42, gpuTimingAvailable: false, measurementAgeMs: null, gpuTimeMs: null });
  await digest.flush();
  await vi.advanceTimersByTimeAsync(0);
  assert.equal(samples.length, 0, 'the stale workload capture is discarded');

  // The next cadence samples the new workload with its own hash.
  await vi.advanceTimersByTimeAsync(100);
  await digest.flush();
  await vi.advanceTimersByTimeAsync(0);
  assert.equal(samples.length, 1);
  assert.equal(samples[0]?.configHash, nextHash);
  assert.notEqual(samples[0]?.configHash, oldHash);
  assert.equal(samples[0]?.fps, 42);
  assert.equal(samples[0]?.gpuTimingAvailable, false);
  assert.equal(samples[0]?.gpuTimeMs, null);
  collector.dispose();
});

test('pairs the captured status with the config it was read with (#99)', async () => {
  vi.useFakeTimers();
  const port = new FakeRenderer({
    actual: 'webgl2', running: true, gpuTimingAvailable: true, measurementAgeMs: 0,
    fps: 60, gpuTimeMs: 3.25,
  });
  const expectedHash = await configHash(DEFAULT_CONFIG);
  const samples: PerformanceSnapshot[] = [];
  const collector = new PerformanceCollector(port, {
    warmUpMs: 0,
    cadenceMs: 100,
    getConfig: () => DEFAULT_CONFIG,
    onSample: sample => samples.push(sample),
  });

  const digest = controlledDigest();
  collector.start();
  await vi.advanceTimersByTimeAsync(0);
  assert.equal(digest.pendingCount(), 1);

  // Metrics move on while the digest is pending; the sample must stay internal.
  port.setStatus({ fps: 42, gpuTimingAvailable: false, measurementAgeMs: null, gpuTimeMs: null });
  await digest.flush();
  await vi.advanceTimersByTimeAsync(0);

  assert.equal(samples.length, 1);
  assert.equal(samples[0]?.configHash, expectedHash);
  assert.equal(samples[0]?.fps, 60);
  assert.equal(samples[0]?.gpuTimingAvailable, true);
  assert.equal(samples[0]?.gpuTimeMs, 3.25);
  collector.dispose();
});

test('a config change from the onStatus observer discards the capture (#99)', async () => {
  vi.useFakeTimers();
  const port = new FakeRenderer({ actual: 'webgl2', running: true, fps: 60 });
  const nextConfig = newWorkloadConfig();
  const nextHash = await configHash(nextConfig);
  let current: Readonly<LabConfig> = DEFAULT_CONFIG;
  const samples: PerformanceSnapshot[] = [];
  const collector = new PerformanceCollector(port, {
    warmUpMs: 0,
    cadenceMs: 100,
    getConfig: () => current,
    onStatus: () => { current = nextConfig; },
    onSample: sample => samples.push(sample),
  });

  const digest = controlledDigest();
  collector.start();
  await vi.advanceTimersByTimeAsync(0);
  await digest.flush();
  await vi.advanceTimersByTimeAsync(0);
  assert.equal(samples.length, 0, 'the pre-observer identity is never emitted');

  await vi.advanceTimersByTimeAsync(100);
  await digest.flush();
  await vi.advanceTimersByTimeAsync(0);
  assert.equal(samples.length, 1);
  assert.equal(samples[0]?.configHash, nextHash);
  collector.dispose();
});

test('a digest failure reaches onError and emits no sample (#99)', async () => {
  vi.useFakeTimers();
  const port = new FakeRenderer({ actual: 'webgl2', running: true, fps: 60 });
  const onSample = vi.fn();
  const onError = vi.fn();
  const collector = new PerformanceCollector(port, {
    warmUpMs: 0,
    cadenceMs: 100,
    getConfig: () => DEFAULT_CONFIG,
    onSample,
    onError,
  });

  const digest = controlledDigest();
  collector.start();
  await vi.advanceTimersByTimeAsync(0);
  digest.fail();
  await vi.advanceTimersByTimeAsync(0);
  assert.equal(onError.mock.calls.length, 1);
  assert.equal(onSample.mock.calls.length, 0);

  // A failed digest does not wedge the cadence.
  await vi.advanceTimersByTimeAsync(100);
  await digest.flush();
  await vi.advanceTimersByTimeAsync(0);
  assert.equal(onSample.mock.calls.length, 1);
  collector.dispose();
});

test('stopping during the digest emits no sample (#99)', async () => {
  vi.useFakeTimers();
  const port = new FakeRenderer({ actual: 'webgl2', running: true, fps: 60 });
  const onSample = vi.fn();
  const collector = new PerformanceCollector(port, {
    warmUpMs: 0,
    cadenceMs: 100,
    getConfig: () => DEFAULT_CONFIG,
    onSample,
  });

  const digest = controlledDigest();
  collector.start();
  await vi.advanceTimersByTimeAsync(0);
  collector.stop();
  await digest.flush();
  await vi.advanceTimersByTimeAsync(0);
  assert.equal(onSample.mock.calls.length, 0);
  collector.dispose();
});
