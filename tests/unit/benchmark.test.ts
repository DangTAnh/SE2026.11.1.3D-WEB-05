/**
 * Contract tests for the two-backend benchmark runner (TV5).
 *
 * The protocol is one constant so both backends are measured the same way, and
 * a result is refused when it cannot prove where the numbers came from.
 */
import assert from 'node:assert/strict';
import { afterEach, test, vi } from 'vitest';
import { configHash } from '../../src/core/measurement/configHash.ts';
import type { BenchmarkEnvironment } from '../../src/core/measurement/result.ts';
import type { PerformanceSnapshot } from '../../src/core/types/measurement.ts';
import { BENCHMARK_PROTOCOL, buildBenchmarkResult, collectBenchmarkSamples } from '../../src/perf/benchmark.ts';
import { DEFAULT_CONFIG } from '../../src/presets/preset.ts';
import { FakeRenderer } from '../support/fakeRenderer.ts';

afterEach(() => {
  vi.useRealTimers();
});

const ENVIRONMENT: BenchmarkEnvironment = {
  browser: 'Chromium',
  browserVersion: '141',
  os: 'Windows 11',
  gpu: 'Test GPU',
  driver: '1.0',
  commit: 'ac36491',
  sameHost: true,
};

function snapshot(hash: string, patch: Partial<PerformanceSnapshot> = {}): PerformanceSnapshot {
  return {
    actual: 'webgpu',
    configHash: hash,
    fps: 60,
    gpuTimingAvailable: false,
    gpuTimeMs: null,
    ...patch,
  };
}

test('protocol: one constant fixes the run for both backends', () => {
  assert.deepEqual(BENCHMARK_PROTOCOL, {
    warmUpMs: 3000,
    cadenceMs: 100,
    sampleCount: 100,
    durationSeconds: 10,
    statistic: 'median',
  });
  assert.equal(
    BENCHMARK_PROTOCOL.durationSeconds * 1000,
    BENCHMARK_PROTOCOL.sampleCount * BENCHMARK_PROTOCOL.cadenceMs,
  );
});

test('build: an incomplete environment is refused', async () => {
  const hash = await configHash(DEFAULT_CONFIG);
  for (const field of ['browser', 'os', 'gpu', 'commit'] as const) {
    await assert.rejects(
      buildBenchmarkResult({
        environment: { ...ENVIRONMENT, [field]: '' },
        config: DEFAULT_CONFIG,
        samples: [snapshot(hash)],
      }),
      TypeError,
    );
  }
});

test('build: a run without samples is refused', async () => {
  await assert.rejects(
    buildBenchmarkResult({ environment: ENVIRONMENT, config: DEFAULT_CONFIG, samples: [] }),
    TypeError,
  );
});

test('build: samples measured under another configuration are refused', async () => {
  const hash = await configHash(DEFAULT_CONFIG);
  await assert.rejects(
    buildBenchmarkResult({
      environment: ENVIRONMENT,
      config: DEFAULT_CONFIG,
      samples: [snapshot(hash), snapshot('b'.repeat(64))],
    }),
    TypeError,
  );
});

test('build: groups by (configHash, actual) and records the fixed protocol', async () => {
  const hash = await configHash(DEFAULT_CONFIG);
  const result = await buildBenchmarkResult({
    environment: ENVIRONMENT,
    config: DEFAULT_CONFIG,
    samples: [
      snapshot(hash, { fps: 50 }),
      snapshot(hash, { fps: 70 }),
      snapshot(hash, { actual: 'webgl2', fps: 30 }),
      snapshot(hash, { actual: 'unavailable', fps: null }),
    ],
  });

  assert.equal(result.configHash, hash);
  assert.deepEqual(result.protocol, { warmUpSeconds: 3, sampleCount: 100, durationSeconds: 10 });
  assert.deepEqual(
    result.groups.map((group) => [group.actual, group.count, group.fps?.median ?? null]),
    [
      ['unavailable', 1, null],
      ['webgl2', 1, 30],
      ['webgpu', 2, 60],
    ],
  );
  assert.equal(result.groups[0]!.gpuTimeMs, null);
});

test('collect: takes exactly the requested sample count after warm-up', async () => {
  const port = new FakeRenderer({
    actual: 'webgl2',
    running: true,
    gpuTimingAvailable: false,
    fps: 60,
    gpuTimeMs: null,
  });
  const protocol = { warmUpMs: 20, cadenceMs: 5, sampleCount: 3 };

  const started = Date.now();
  const samples = await collectBenchmarkSamples(port, () => DEFAULT_CONFIG, protocol);

  assert.ok(Date.now() - started >= protocol.warmUpMs, 'the warm-up is respected');
  assert.equal(samples.length, protocol.sampleCount);
  assert.equal(samples[0]!.configHash, await configHash(DEFAULT_CONFIG));
  assert.equal(samples[0]!.actual, 'webgl2');
  assert.equal(samples[0]!.gpuTimeMs, null);

  const statusCalls = port.calls.filter((call) => call.type === 'getStatus').length;
  await new Promise((resolve) => setTimeout(resolve, 50));
  assert.equal(
    port.calls.filter((call) => call.type === 'getStatus').length,
    statusCalls,
    'sampling stops at the fixed count',
  );
  assert.equal(port.disposed, false, 'the port stays owned by the caller');
});

test('collect: a sampling error rejects the run and stops the timer', async () => {
  const port = new FakeRenderer({ actual: 'webgl2', running: true });
  const protocol = { warmUpMs: 5, cadenceMs: 5, sampleCount: 5 };

  await assert.rejects(
    collectBenchmarkSamples(
      port,
      () => {
        throw new Error('bad config');
      },
      protocol,
    ),
    /bad config/,
  );

  const statusCalls = port.calls.filter((call) => call.type === 'getStatus').length;
  await new Promise((resolve) => setTimeout(resolve, 30));
  assert.equal(
    port.calls.filter((call) => call.type === 'getStatus').length,
    statusCalls,
    'a failed run does not keep sampling',
  );
});
