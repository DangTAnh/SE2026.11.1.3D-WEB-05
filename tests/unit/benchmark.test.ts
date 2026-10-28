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

const REQUIRED_ENVIRONMENT_FIELDS = [
  'browser',
  'browserVersion',
  'os',
  'gpu',
  'driver',
  'commit',
] as const;

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

test('build: a complete environment keeps browser version and driver', async () => {
  const hash = await configHash(DEFAULT_CONFIG);
  const result = await buildBenchmarkResult({
    environment: ENVIRONMENT,
    config: DEFAULT_CONFIG,
    samples: Array.from({ length: BENCHMARK_PROTOCOL.sampleCount }, () => snapshot(hash)),
  });

  assert.equal(result.environment.browserVersion, '141');
  assert.equal(result.environment.driver, '1.0');
});

test('build: an incomplete environment is refused', async () => {
  const hash = await configHash(DEFAULT_CONFIG);
  for (const field of REQUIRED_ENVIRONMENT_FIELDS) {
    for (const value of ['', '   ']) {
      await assert.rejects(
        buildBenchmarkResult({
          environment: { ...ENVIRONMENT, [field]: value },
          config: DEFAULT_CONFIG,
          samples: [snapshot(hash)],
        }),
        new RegExp(`buildBenchmarkResult: environment\\.${field} is required`),
      );
    }
  }
});

test('build: an environment missing a required field at runtime is refused', async () => {
  const hash = await configHash(DEFAULT_CONFIG);
  const environment: Record<string, unknown> = { ...ENVIRONMENT };
  delete environment.browserVersion;
  delete environment.driver;

  await assert.rejects(
    buildBenchmarkResult({
      environment: environment as unknown as BenchmarkEnvironment,
      config: DEFAULT_CONFIG,
      samples: [snapshot(hash)],
    }),
    /buildBenchmarkResult: environment\.browserVersion is required/,
  );
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

test('build: a partial group cannot claim the fixed protocol', async () => {
  const hash = await configHash(DEFAULT_CONFIG);
  await assert.rejects(
    buildBenchmarkResult({
      environment: ENVIRONMENT,
      config: DEFAULT_CONFIG,
      samples: [snapshot(hash)],
    }),
    /buildBenchmarkResult: every backend group needs exactly 100 samples \(webgpu=1\)/,
  );
});

test('build: a blocked backend is recorded without fabricating samples', async () => {
  const hash = await configHash(DEFAULT_CONFIG);
  const result = await buildBenchmarkResult({
    environment: ENVIRONMENT,
    config: DEFAULT_CONFIG,
    samples: Array.from({ length: BENCHMARK_PROTOCOL.sampleCount }, () =>
      snapshot(hash, { actual: 'webgl2' }),
    ),
    blockedBackends: ['webgpu'],
    limitations: ['No WebGPU adapter was available'],
  });

  assert.deepEqual(result.blockedBackends, ['webgpu']);
  assert.deepEqual(result.groups.map((group) => group.actual), ['webgl2']);
});

test('build: a blocked backend needs a stated limitation', async () => {
  const hash = await configHash(DEFAULT_CONFIG);
  await assert.rejects(
    buildBenchmarkResult({
      environment: ENVIRONMENT,
      config: DEFAULT_CONFIG,
      samples: Array.from({ length: BENCHMARK_PROTOCOL.sampleCount }, () =>
        snapshot(hash, { actual: 'webgl2' }),
      ),
      blockedBackends: ['webgpu'],
    }),
    /a blocked backend needs a stated limitation/,
  );
});

test('build: a measured backend cannot also be blocked', async () => {
  const hash = await configHash(DEFAULT_CONFIG);
  await assert.rejects(
    buildBenchmarkResult({
      environment: ENVIRONMENT,
      config: DEFAULT_CONFIG,
      samples: Array.from({ length: BENCHMARK_PROTOCOL.sampleCount }, () => snapshot(hash)),
      blockedBackends: ['webgpu'],
      limitations: ['contradiction'],
    }),
    /backend "webgpu" cannot be both measured and blocked/,
  );
});

test('build: groups by (configHash, actual) and records the fixed protocol', async () => {
  const hash = await configHash(DEFAULT_CONFIG);
  const count = BENCHMARK_PROTOCOL.sampleCount;
  const result = await buildBenchmarkResult({
    environment: ENVIRONMENT,
    config: DEFAULT_CONFIG,
    samples: [
      ...Array.from({ length: count }, (_, index) => snapshot(hash, { fps: index % 2 === 0 ? 50 : 70 })),
      ...Array.from({ length: count }, () => snapshot(hash, { actual: 'webgl2', fps: 30 })),
      ...Array.from({ length: count }, () => snapshot(hash, { actual: 'unavailable', fps: null })),
    ],
  });

  assert.equal(result.configHash, hash);
  assert.deepEqual(result.protocol, { warmUpSeconds: 3, sampleCount: 100, durationSeconds: 10 });
  assert.deepEqual(
    result.groups.map((group) => [group.actual, group.count, group.fps?.median ?? null]),
    [
      ['unavailable', 100, null],
      ['webgl2', 100, 30],
      ['webgpu', 100, 60],
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
