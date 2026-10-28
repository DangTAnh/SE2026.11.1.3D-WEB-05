/**
 * Regression coverage for #78 review: a WebGPU init/sampling failure must not
 * be reported as absent hardware. Only a null adapter may say
 * "requestAdapter() returned null".
 */
import { test } from 'vitest';
import assert from 'node:assert/strict';
import { webGpuLimitation } from '../../src/perf/benchmark.ts';

const adapter = { vendor: 'amd', architecture: 'rdna-2' };

test('webgpu limitation: missing API is distinct from a null adapter', () => {
  const text = webGpuLimitation({ status: 'api-unavailable' });

  assert.ok(text !== null);
  assert.match(text, /navigator\.gpu is undefined/);
  assert.doesNotMatch(text, /requestAdapter\(\) returned null/);
});

test('webgpu limitation: only a null adapter reports requestAdapter() returning null', () => {
  const text = webGpuLimitation({ status: 'adapter-unavailable' });

  assert.ok(text !== null);
  assert.match(text, /requestAdapter\(\) returned null/);
});

test('webgpu limitation: initialization errors are runner failures, not missing hardware', () => {
  const text = webGpuLimitation({
    status: 'failed',
    phase: 'initialization',
    error: 'device creation failed',
    adapter,
  });

  assert.ok(text !== null);
  assert.match(text, /initialization failed/);
  assert.match(text, /device creation failed/);
  assert.match(text, /adapter vendor "amd", architecture "rdna-2"/);
  assert.match(text, /does not prove the adapter is unavailable/);
  assert.doesNotMatch(text, /requestAdapter\(\) returned null/);
});

test('webgpu limitation: sampling errors name the phase and keep the measured error', () => {
  const text = webGpuLimitation({
    status: 'failed',
    phase: 'sampling',
    error: 'collector timed out',
    adapter,
  });

  assert.ok(text !== null);
  assert.match(text, /sampling failed/);
  assert.match(text, /collector timed out/);
  assert.doesNotMatch(text, /requestAdapter\(\) returned null/);
});

test('webgpu limitation: an actual webgl2 fallback is reported as such', () => {
  const text = webGpuLimitation({ status: 'initialized', actual: 'webgl2', adapter });

  assert.ok(text !== null);
  assert.match(text, /actual="webgl2"/);
  assert.doesNotMatch(text, /requestAdapter\(\) returned null/);
});

test('webgpu limitation: a real WebGPU run needs no limitation', () => {
  const text = webGpuLimitation({ status: 'initialized', actual: 'webgpu', adapter });

  assert.equal(text, null);
});
