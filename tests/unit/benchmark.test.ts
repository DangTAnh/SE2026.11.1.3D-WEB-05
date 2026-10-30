/**
 * Contract tests for the two-backend benchmark runner (TV5).
 *
 * The protocol is one constant so both backends are measured the same way, and
 * a result is refused when it cannot prove where the numbers came from.
 */
import assert from 'node:assert/strict';
import { afterEach, test, vi } from 'vitest';
import { configHash } from '../../src/core/measurement/configHash.ts';
import { toMarkdown, type BenchmarkEnvironment } from '../../src/core/measurement/result.ts';
import type { PerformanceSnapshot } from '../../src/core/types/measurement.ts';
import { BENCHMARK_PROTOCOL, buildBenchmarkResult, collectBenchmarkSamples } from '../../src/perf/benchmark.ts';
import { cloneConfig, DEFAULT_CONFIG, parsePresetDocument, serializePresetDocument } from '../../src/presets/preset.ts';
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


test('build: full validated nested v2 config survives the benchmark result and report', async () => {
  for (const particleCount of [65536, 500000]) {
    const config = cloneConfig(DEFAULT_CONFIG);
    config.mode = particleCount === 65536 ? 'attractor' : 'vortex';
    Object.assign(config.simulation, { particleCount, spawnRadius: 23, lifetime: 9 });
    config.modes.attractor.attractorStrength = 3.2;
    config.modes.vortex.vortexDamping = 0.87;
    config.rendering = { particleColor: '#abcdef', backgroundColor: '#123456', opacity: 0.3, additiveBlend: true };
    config.camera = { enabled: false, autoRotate: true, distance: 500 };
    const document = parsePresetDocument(serializePresetDocument({
      schemaVersion: 2, app: '3D-WEB-05', name: 'validated benchmark preset', config,
    }));
    const hash = await configHash(document.config);
    const result = await buildBenchmarkResult({
      environment: ENVIRONMENT,
      config: document.config,
      samples: Array.from({ length: BENCHMARK_PROTOCOL.sampleCount }, () => snapshot(hash, { actual: 'webgl2' })),
    });
    assert.deepEqual(result.config, document.config);
    assert.equal(result.configHash, hash);
    assert.equal(result.groups[0]!.count, BENCHMARK_PROTOCOL.sampleCount);
    assert.ok(toMarkdown(result).includes(JSON.stringify(document.config)));
    assert.equal(Object.hasOwn(result.config, 'name'), false, 'envelope metadata is not an engine parameter');
  }
});
test('build: result config is isolated from later caller mutation', async () => {
  const config = cloneConfig(DEFAULT_CONFIG);
  const hash = await configHash(config);
  const result = await buildBenchmarkResult({ environment: ENVIRONMENT, config,
    samples: Array.from({ length: 100 }, () => snapshot(hash)) });
  config.rendering.opacity = 0.3;
  assert.equal(result.config.rendering.opacity, 1);
});

test.each(['rendering', 'camera', 'inactive mode'] as const)('collect: rejects same-hash %s changes', async field => {
  const config = cloneConfig(DEFAULT_CONFIG);
  const originalHash = await configHash(config);
  const port = new FakeRenderer({ actual: 'webgl2', running: true, fps: 60 });
  let reads = 0;
  const run = collectBenchmarkSamples(port, () => {
    if (++reads === 3) {
      if (field === 'rendering') config.rendering.additiveBlend = true;
      if (field === 'camera') config.camera.distance = 50;
      if (field === 'inactive mode') config.modes.vortex.vortexStrength = 3;
    }
    return config;
  }, { warmUpMs: 1, cadenceMs: 5, sampleCount: 3 });
  await assert.rejects(run, /full preset changed/);
  assert.equal(await configHash(config), originalHash);
  const calls = port.calls.length;
  await new Promise(resolve => setTimeout(resolve, 20));
  assert.equal(port.calls.length, calls);
});
