import assert from 'node:assert/strict';
import { afterEach, test, vi } from 'vitest';
import { configHash } from '../../src/core/measurement/configHash.ts';
import { MAX_GPU_MEASUREMENT_AGE_MS } from '../../src/core/renderer/RendererPort.ts';
import type { PerformanceSnapshot } from '../../src/core/types/measurement.ts';
import { PerformanceCollector } from '../../src/perf/collector.ts';
import { DEFAULT_CONFIG } from '../../src/presets/preset.ts';
import { FakeRenderer } from '../support/fakeRenderer.ts';

afterEach(() => {
  vi.useRealTimers();
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
