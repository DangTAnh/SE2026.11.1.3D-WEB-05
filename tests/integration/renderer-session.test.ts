import { expect, test, vi } from 'vitest';
import { RendererSession } from '../../src/composition/rendererSession.ts';
import type { RendererCandidate } from '../../src/composition/backendSwitch.ts';
import { DEFAULT_CONFIG, type LabConfig } from '../../src/presets/preset.ts';
import { FakeRenderer } from '../support/fakeRenderer.ts';
import type { ActualBackend } from '../../src/core/types/backend.ts';
import type { RendererTarget } from '../../src/core/renderer/RendererPort.ts';

const target = { width: 800, height: 600, pixelRatio: 1 };
const resource = (port: FakeRenderer): RendererCandidate => ({ port, commit: vi.fn(), discard: vi.fn() });
class DeferredRenderer extends FakeRenderer {
  finish!: () => void;
  fail!: (error: Error) => void;
  resized: RendererTarget | null = null;
  initResult?: ActualBackend;
  resize(next: RendererTarget): void { this.resized = next; }
  override async init(): Promise<ActualBackend> {
    await new Promise<void>((resolve, reject) => { this.finish = resolve; this.fail = reject; });
    return this.initResult ?? this.getStatus().actual;
  }
}

class RecoveringRenderer extends FakeRenderer {
  override start(): void {
    this.calls.push({ type: 'start' });
    if (this.getStatus().actual !== 'unavailable') this.setStatus({ running: true });
  }
}

function makeHarness(ports: FakeRenderer[]) {
  const resources = ports.map(resource);
  const configs: LabConfig[] = [];
  const session = new RendererSession(DEFAULT_CONFIG, config => {
    configs.push({ ...config });
    const candidate = resources[configs.length - 1];
    if (!candidate) throw new Error('No test candidate');
    return candidate;
  });
  return { session, resources, configs };
}

test('successful switch commits a fresh candidate and preserves the full config and running intent', async () => {
  const old = new FakeRenderer({ actual: 'webgpu', requested: 'auto' });
  const next = new FakeRenderer({ actual: 'webgl2', requested: 'webgl2', gpuTimingAvailable: false });
  const { session, resources } = makeHarness([old, next]);
  await session.init(target);
  session.start();
  old.setStatus({ fps: 60, gpuTimingAvailable: true, gpuTimeMs: 3 });
  const config = { ...DEFAULT_CONFIG, mode: 'vortex' as const, particleCount: 32000,
    speed: 2.4, particleSize: 4.1, strength: 2.3, particleColor: '#ff8800', backendPreference: 'webgl2' as const };
  session.applyConfig(config);
  const result = await session.reinitialize();
  expect(result).toEqual({ outcome: 'applied', actual: 'webgl2', requested: 'webgl2', retainedPrevious: false });
  expect(next.lastConfig).toEqual(config);
  expect(old.disposed).toBe(true);
  expect(resources[1]!.commit).toHaveBeenCalledOnce();
  expect(session.getStatus()).toMatchObject({ actual: 'webgl2', running: true, fps: null, gpuTimeMs: null });
  expect(next.calls.filter(c => c.type === 'start')).toHaveLength(1);
  session.dispose();
});

test('pending initialization exposes no fabricated measurement age', async () => {
  const next = new DeferredRenderer({ actual: 'webgpu' });
  const { session } = makeHarness([next]);
  const task = session.init(target);

  expect(session.initializing).toBe(true);
  expect(session.getStatus()).toMatchObject({
    actual: 'unavailable', gpuTimingAvailable: false,
    measurementAgeMs: null, gpuTimeMs: null, fps: null,
  });

  next.finish();
  await task;
  session.dispose();
});
for (const failure of ['reject', 'unavailable', 'inconsistent-status'] as const) {
  test(`failed switch (${failure}) retains the live port/config/actual and disposes only the candidate`, async () => {
    const old = new FakeRenderer({ actual: 'webgpu', requested: 'auto' });
    const next = new DeferredRenderer({ actual: failure === 'unavailable' ? 'unavailable' : 'webgl2' });
    const { session, resources } = makeHarness([old, next]);
    await session.init(target);
    session.start();
    const config = { ...DEFAULT_CONFIG, speed: 2.4, backendPreference: 'webgl2' as const };
    session.applyConfig(config);
    const task = session.reinitialize();
    expect(old.disposed).toBe(false);
    expect(old.getStatus().running).toBe(true);
    expect(resources[1]!.commit).not.toHaveBeenCalled();
    if (failure === 'reject') next.fail(new Error('unavailable backend'));
    else {
      if (failure === 'inconsistent-status') {
        next.initResult = 'webgl2';
        next.setStatus({ actual: 'unavailable' });
      }
      next.finish();
    }
    expect(await task).toMatchObject({ outcome: 'failed', actual: 'webgpu', retainedPrevious: true });
    expect(session.getStatus()).toMatchObject({ actual: 'webgpu', requested: 'auto', running: true });
    expect(old.lastConfig).toEqual(config);
    expect(old.disposed).toBe(false);
    expect(next.disposed).toBe(true);
    expect(resources[1]!.discard).toHaveBeenCalledOnce();
    expect(resources[1]!.commit).not.toHaveBeenCalled();
    session.dispose();
  });
}

test('commit failure rolls back the pause boundary and resumes the retained port', async () => {
  const old = new FakeRenderer({ actual: 'webgpu' });
  const next = new FakeRenderer({ actual: 'webgl2' });
  const { session, resources } = makeHarness([old, next]);
  await session.init(target); session.start();
  resources[1]!.commit = () => { throw new Error('surface commit failed'); };
  expect(await session.reinitialize()).toMatchObject({ outcome: 'failed', actual: 'webgpu', retainedPrevious: true });
  expect(old.getStatus().running).toBe(true);
  expect(old.disposed).toBe(false);
  expect(next.disposed).toBe(true);
  session.dispose();
});

test('candidate does not start before readiness and old simulation pauses before candidate start', async () => {
  const old = new FakeRenderer({ actual: 'webgpu' });
  const next = new DeferredRenderer({ actual: 'webgl2' });
  const { session, resources } = makeHarness([old, next]);
  await session.init(target); session.start();
  const order: string[] = [];
  const oldPause = old.pause.bind(old), nextStart = next.start.bind(next);
  old.pause = () => { order.push('old.pause'); oldPause(); };
  next.start = () => { order.push('next.start'); nextStart(); };
  resources[1]!.commit = () => { order.push('commit'); };
  const task = session.reinitialize();
  expect(order).toEqual([]);
  expect(old.getStatus().running).toBe(true);
  next.finish(); await task;
  expect(order).toEqual(['old.pause', 'next.start', 'commit']);
  session.dispose();
});

test('requested is snapshotted per generation; only the latest candidate commits even when old completes last', async () => {
  const old = new FakeRenderer({ actual: 'webgpu' });
  const first = new DeferredRenderer({ actual: 'webgpu', requested: 'webgpu' });
  const last = new DeferredRenderer({ actual: 'webgl2', requested: 'webgl2' });
  const { session, resources, configs } = makeHarness([old, first, last]);
  await session.init(target);
  session.applyConfig({ ...DEFAULT_CONFIG, backendPreference: 'webgpu' });
  const firstTask = session.reinitialize();
  session.applyConfig({ ...DEFAULT_CONFIG, backendPreference: 'webgl2' });
  expect(session.getStatus().requested).toBe('webgpu');
  const lastTask = session.reinitialize();
  expect(first.disposed).toBe(true);
  session.applyConfig({ ...DEFAULT_CONFIG, backendPreference: 'auto', speed: 2.4 });
  expect(session.getStatus().requested).toBe('webgl2');
  last.finish();
  expect(await lastTask).toMatchObject({ outcome: 'applied', actual: 'webgl2', requested: 'webgl2' });
  first.finish();
  expect(await firstTask).toMatchObject({ outcome: 'superseded' });
  expect(session.getStatus().requested).toBe('webgl2');
  expect(last.lastConfig).toMatchObject({ speed: 2.4, backendPreference: 'webgl2' });
  expect(configs.map(c => c.backendPreference)).toEqual(['auto', 'webgpu', 'webgl2']);
  expect(resources[1]!.commit).not.toHaveBeenCalled();
  expect(first.calls.filter(c => c.type === 'dispose')).toHaveLength(1);
  session.dispose();
});

test('obsolete rejection neither rolls back nor clears the latest pending generation', async () => {
  const first = new DeferredRenderer({ actual: 'webgpu' });
  const last = new DeferredRenderer({ actual: 'webgl2' });
  const { session } = makeHarness([first, last]);
  const a = session.init(target);
  const b = session.reinitialize();
  first.fail(new Error('late failure'));
  await a;
  expect(session.initializing).toBe(true);
  last.finish();
  expect(await b).toMatchObject({ outcome: 'applied', actual: 'webgl2' });
  session.dispose();
});

test('initial unavailable followed by retry stays paused until an explicit start on an available backend', async () => {
  const none = new FakeRenderer({ actual: 'unavailable' });
  const ready = new FakeRenderer({ actual: 'webgl2' });
  const { session } = makeHarness([none, ready]);
  expect(await session.init(target)).toBe('unavailable');
  session.start(); // defensive no-op; main also guards the initial start
  expect(session.getStatus().running).toBe(false);
  expect(await session.reinitialize()).toMatchObject({ outcome: 'applied', actual: 'webgl2' });
  expect(session.getStatus().running).toBe(false);
  expect(ready.calls.filter(c => c.type === 'start')).toHaveLength(0);
  session.start();
  expect(session.getStatus().running).toBe(true);
  session.dispose();
});

test('a Play request during runtime recovery is retained by the session for the recovered or next renderer', async () => {
  const recovering = new RecoveringRenderer({ actual: 'webgpu', running: true });
  const next = new FakeRenderer({ actual: 'webgl2' });
  const { session } = makeHarness([recovering, next]);
  await session.init(target);
  session.pause();
  recovering.setStatus({ actual: 'unavailable', running: false });

  session.start();

  expect(session.getStatus()).toMatchObject({ actual: 'unavailable', running: false });
  expect(recovering.calls.filter(call => call.type === 'start')).toHaveLength(1);
  recovering.setStatus({ actual: 'webgpu', running: true });
  expect(session.getStatus()).toMatchObject({ actual: 'webgpu', running: true });

  session.applyConfig({ ...DEFAULT_CONFIG, backendPreference: 'webgl2' });
  expect(await session.reinitialize()).toMatchObject({ outcome: 'applied', actual: 'webgl2' });
  expect(session.getStatus()).toMatchObject({ actual: 'webgl2', running: true });
  expect(next.calls.filter(call => call.type === 'start')).toHaveLength(1);
  session.dispose();
});

for (const running of [false, true]) {
  test(`pause/resume intent (${running}) survives a switch and applies config/resize edits made during init`, async () => {
    const old = new FakeRenderer({ actual: 'webgpu' });
    const next = new DeferredRenderer({ actual: 'webgl2' });
    const { session } = makeHarness([old, next]);
    await session.init(target); session.start();
    const task = session.reinitialize();
    session.pause();
    if (running) session.start();
    session.applyConfig({ ...DEFAULT_CONFIG, speed: 2.4 });
    session.resize({ ...target, width: 400 });
    next.finish(); await task;
    expect(session.getStatus().running).toBe(running);
    expect(next.lastConfig?.speed).toBe(2.4);
    expect(next.resized).toEqual({ ...target, width: 400 });
    session.dispose();
  });
}

test('dispose during a switch releases live and pending resources once and prevents late commit/start', async () => {
  const old = new FakeRenderer({ actual: 'webgpu' });
  const next = new DeferredRenderer({ actual: 'webgl2' });
  const { session, resources } = makeHarness([old, next]);
  await session.init(target); session.start();
  const task = session.reinitialize();
  session.dispose(); session.dispose();
  next.finish();
  expect(await task).toMatchObject({ outcome: 'superseded', actual: 'unavailable' });
  for (const port of [old, next]) expect(port.calls.filter(c => c.type === 'dispose')).toHaveLength(1);
  expect(resources[1]!.commit).not.toHaveBeenCalled();
  expect(next.calls.filter(c => c.type === 'start')).toHaveLength(0);
});

test('multiple successful switches clean every port and surface exactly once', async () => {
  const ports = Array.from({ length: 5 }, () => new FakeRenderer({ actual: 'webgl2' }));
  const { session, resources } = makeHarness(ports);
  await session.init(target);
  for (let i = 1; i < ports.length; i++) await session.reinitialize();
  session.dispose();
  for (const candidate of resources) {
    expect(candidate.commit).toHaveBeenCalledOnce();
    expect(candidate.discard).toHaveBeenCalledOnce();
    expect((candidate.port as FakeRenderer).calls.filter(c => c.type === 'dispose')).toHaveLength(1);
  }
});

test('factory failure retains the prior renderer and resolves an explicit failure', async () => {
  const { session } = makeHarness([new FakeRenderer({ actual: 'webgl2' })]);
  await session.init(target); session.start();
  expect(await session.reinitialize()).toMatchObject({ outcome: 'failed', actual: 'webgl2', retainedPrevious: true });
  expect(session.initializing).toBe(false);
  expect(session.getStatus().running).toBe(true);
  session.dispose();
});

test('failure does not claim a retained backend if the old backend became unavailable during init', async () => {
  const old = new FakeRenderer({ actual: 'webgpu' });
  const next = new DeferredRenderer({ actual: 'unavailable' });
  const { session } = makeHarness([old, next]);
  await session.init(target);
  const task = session.reinitialize();
  old.setStatus({ actual: 'unavailable', running: false });
  next.finish();
  expect(await task).toMatchObject({ outcome: 'failed', actual: 'unavailable', retainedPrevious: false });
  session.dispose();
});
