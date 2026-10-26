import { expect, test } from 'vitest';
import { RendererSession } from '../../src/composition/rendererSession.ts';
import { DEFAULT_CONFIG } from '../../src/presets/preset.ts';
import { FakeRenderer } from '../support/fakeRenderer.ts';
import type { ActualBackend } from '../../src/core/types/backend.ts';

const target = { width: 800, height: 600, pixelRatio: 1 };

class DeferredRenderer extends FakeRenderer {
  finish!: () => void;
  resized: typeof target | null = null;
  resize(next: typeof target): void { this.resized = next; }
  override async init(): Promise<ActualBackend> {
    await new Promise<void>(resolve => { this.finish = resolve; });
    return this.getStatus().actual;
  }
}

test('backend apply creates a fresh adapter, preserves config and clears old measurements', async () => {
  const ports: FakeRenderer[] = [];
  const session = new RendererSession(DEFAULT_CONFIG, config => {
    const port = new FakeRenderer({ actual: config.backendPreference === 'webgl2' ? 'webgl2' : 'webgpu',
      requested: config.backendPreference, gpuTimingAvailable: false });
    ports.push(port);
    return port;
  });
  await session.init(target);
  session.start();
  ports[0]!.setStatus({ fps: 60, gpuTimingAvailable: true, gpuTimeMs: 3 });
  const config = { ...DEFAULT_CONFIG, mode: 'vortex' as const, speed: 2.5,
    particleCount: 32000, particleSize: 4.1, strength: 2.3,
    particleColor: '#ff8800', backendPreference: 'webgl2' as const };
  session.applyConfig(config);
  await session.reinitialize();
  expect(ports[0]!.disposed).toBe(true);
  expect(ports[1]!.lastConfig).toEqual(config);
  expect(session.getStatus()).toMatchObject({ actual: 'webgl2', running: true, fps: null, gpuTimeMs: null });
  session.dispose();
});

test('overlapping init uses the latest generation even if the old init completes last', async () => {
  const ports: DeferredRenderer[] = [];
  const session = new RendererSession(DEFAULT_CONFIG, config => {
    const port = new DeferredRenderer({ actual: config.backendPreference === 'webgl2' ? 'webgl2' : 'webgpu',
      requested: config.backendPreference });
    ports.push(port);
    return port;
  });
  const first = session.init(target);
  session.applyConfig({ ...DEFAULT_CONFIG, backendPreference: 'webgl2' });
  const second = session.reinitialize();
  expect(ports[0]!.disposed).toBe(true);
  expect(session.getStatus()).toMatchObject({ actual: 'unavailable', fps: null, gpuTimeMs: null });
  ports[1]!.finish();
  expect(await second).toBe('webgl2');
  ports[0]!.finish();
  expect(await first).toBe('unavailable');
  expect(session.getStatus().actual).toBe('webgl2');
  expect(ports[0]!.calls.filter(c => c.type === 'dispose')).toHaveLength(1);
  session.dispose();
});

test('config edits, resize and pause during init are applied after completion', async () => {
  const port = new DeferredRenderer({ actual: 'webgl2' });
  const session = new RendererSession(DEFAULT_CONFIG, () => port);
  session.start();
  const task = session.init(target);
  const config = { ...DEFAULT_CONFIG, speed: 2.4, strength: 2.1 };
  session.applyConfig(config);
  session.resize({ ...target, width: 400 });
  session.pause();
  port.finish();
  await task;
  expect(port.lastConfig).toEqual(config);
  expect(session.getStatus().running).toBe(false);
  expect(port.resized).toEqual({ ...target, width: 400 });
  session.start();
  expect(session.getStatus().running).toBe(true);
  session.pause();
  session.reset();
  expect(port.calls.slice(-2).map(c => c.type)).toEqual(['pause', 'reset']);
  session.dispose();
});

test('a failed init disposes its candidate and permits retry with the preserved config', async () => {
  const failed = new FakeRenderer();
  failed.init = async () => { throw new Error('init failed'); };
  const next = new FakeRenderer({ actual: 'webgl2', requested: 'webgpu' });
  let calls = 0;
  const session = new RendererSession(DEFAULT_CONFIG, () => calls++ === 0 ? failed : next);
  expect(await session.init(target)).toBe('unavailable');
  expect(session.initializing).toBe(false);
  expect(failed.disposed).toBe(true);
  expect(session.getStatus()).toMatchObject({ actual: 'unavailable', fps: null, gpuTimeMs: null });
  session.applyConfig({ ...DEFAULT_CONFIG, backendPreference: 'webgpu', speed: 2 });
  expect(await session.reinitialize()).toBe('webgl2');
  expect(next.lastConfig?.speed).toBe(2);
  expect(session.getStatus().requested).toBe('webgpu');
  session.dispose();
});

test('dispose during pending init prevents late starts and disposes exactly once', async () => {
  const port = new DeferredRenderer({ actual: 'webgpu' });
  const session = new RendererSession(DEFAULT_CONFIG, () => port);
  session.start();
  const task = session.init(target);
  session.dispose();
  session.dispose();
  port.finish();
  expect(await task).toBe('unavailable');
  expect(port.calls.filter(c => c.type === 'dispose')).toHaveLength(1);
  expect(port.calls.filter(c => c.type === 'start')).toHaveLength(0);
  expect(session.getStatus().actual).toBe('unavailable');
});

test('factory failure resolves unavailable and does not retain initialization state', async () => {
  const session = new RendererSession(DEFAULT_CONFIG, () => { throw new Error('factory'); });
  expect(await session.init(target)).toBe('unavailable');
  expect(session.initializing).toBe(false);
  session.dispose();
});
