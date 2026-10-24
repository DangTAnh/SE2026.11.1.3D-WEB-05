/**
 * Contract test for RendererPort, driven by a test double.
 *
 * The point is not to test the fake: it is to prove that the UI and the perf
 * collector can be written against the interface alone, and that `actual`
 * comes from the engine rather than from what was requested.
 */
import { test } from 'vitest';
import assert from 'node:assert/strict';
import { DEFAULT_CONFIG } from '../../src/presets/preset.ts';
import type { LabConfig } from '../../src/presets/preset.ts';
import type { ActualBackend } from '../../src/core/types/backend.ts';
import type { RendererPort, RendererStatus, RendererTarget } from '../../src/core/renderer/RendererPort.ts';

/** Minimal implementation: no canvas, no GPU, no three. */
class FakeRenderer implements RendererPort {
  readonly #backend: ActualBackend;
  #status: RendererStatus;
  #lastConfig: Readonly<LabConfig> | null = null;

  constructor(backend: ActualBackend) {
    this.#backend = backend;
    this.#status = {
      requested: 'auto',
      actual: 'unavailable',
      running: false,
      gpuTimingAvailable: backend !== 'unavailable',
      fps: null,
      gpuTimeMs: null,
    };
  }

  async init(_target: RendererTarget): Promise<ActualBackend> {
    this.#status = { ...this.#status, actual: this.#backend };
    return this.#backend;
  }

  applyConfig(config: Readonly<LabConfig>): void {
    this.#lastConfig = config;
  }

  start(): void {
    this.#status = { ...this.#status, running: true };
  }

  pause(): void {
    this.#status = { ...this.#status, running: false };
  }

  reset(): void {
    this.#lastConfig = null;
  }

  getStatus(): RendererStatus {
    return { ...this.#status };
  }

  get lastConfig(): Readonly<LabConfig> | null {
    return this.#lastConfig;
  }

  dispose(): void {
    this.#status = { ...this.#status, running: false };
  }
}

const TARGET: RendererTarget = { width: 800, height: 600, pixelRatio: 1 };

test('port contract: init reports the backend the engine ran, not the requested one', async () => {
  const port: RendererPort = new FakeRenderer('webgl2');

  const actual = await port.init(TARGET);

  assert.equal(actual, 'webgl2');
  assert.equal(port.getStatus().actual, 'webgl2');
  assert.equal(port.getStatus().requested, 'auto');
});

test('port contract: an unavailable backend never reports gpu timing', async () => {
  const port: RendererPort = new FakeRenderer('unavailable');
  await port.init(TARGET);
  port.start();

  const status = port.getStatus();

  assert.equal(status.actual, 'unavailable');
  assert.equal(status.gpuTimingAvailable, false);
  assert.equal(status.gpuTimeMs, null);
  assert.equal(status.fps, null);
});

test('port contract: applyConfig accepts the preset config unchanged and does not retain it after reset', async () => {
  const fake = new FakeRenderer('webgpu');
  const port: RendererPort = fake;
  await port.init(TARGET);

  port.applyConfig({ ...DEFAULT_CONFIG, particleCount: 50000 });
  assert.equal(fake.lastConfig?.particleCount, 50000);

  port.reset();
  assert.equal(fake.lastConfig, null);
});
