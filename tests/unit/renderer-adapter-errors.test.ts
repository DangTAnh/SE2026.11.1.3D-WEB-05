import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MAX_GPU_MEASUREMENT_AGE_MS } from '../../src/core/renderer/RendererPort.ts';
import { ThreeRendererAdapter } from '../../src/simulations/rendererAdapter.ts';
import type { Scene, PerspectiveCamera } from 'three/webgpu';
import type { ParticleBuffers } from '../../src/simulations/shared/particleBuffers.ts';
import { DEFAULT_CONFIG, cloneConfig } from '../../src/presets/preset.ts';

const harness = vi.hoisted(() => ({
  scenario: '' as string,
  buffers: [] as ParticleBuffers[],
  scene: null as Scene | null,
  camera: null as PerspectiveCamera | null,
  controls: [] as Array<{ enabled: boolean; autoRotate: boolean; target: import('three').Vector3; update: ReturnType<typeof vi.fn>; dispose: ReturnType<typeof vi.fn> }>,
  error: null as Error | null,
  deferNextCompute: false,
  deferTimestamps: false,
  deferWebGLInit: false,
  webGLInitStarted: false,
  resolveWebGLInit: null as (() => void) | null,
  rejectWebGLInit: null as ((error: Error) => void) | null,
  timestampSupported: false,
  timestampValue: 4,
  noticeInsertions: 0,
  instances: [] as Array<{
    forceWebGL: boolean;
    canvas: HTMLCanvasElement | undefined;
    disposed: boolean;
    backendDisposed: boolean;
    internalFallbackUsed: boolean;
    animationLoopValues: unknown[];
    animationLoopCallback: ((time: number) => void) | null;
    resolveCompute: (() => void) | null;
    resolveTimestamp: ((durationMs: number) => void) | null;
    timestampResolveCalls: number;
    triggerDeviceLost: () => void;
  }>,
}));

vi.mock('three/addons/controls/OrbitControls.js', async () => {
  const { Vector3 } = await import('three/webgpu');
  class OrbitControls {
    enabled = true;
    autoRotate = false;
    target = new Vector3();
    update = vi.fn();
    dispose = vi.fn();
    constructor() { harness.controls.push(this); }
  }
  return { OrbitControls };
});

vi.mock('../../src/simulations/shared/particleBuffers.ts', async () => {
  const actual = await vi.importActual<typeof import('../../src/simulations/shared/particleBuffers.ts')>('../../src/simulations/shared/particleBuffers.ts');
  return { ...actual, createParticleBuffers: (count: number) => {
    const buffers = actual.createParticleBuffers(count);
    harness.buffers.push(buffers);
    return buffers;
  } };
});

vi.mock('three/webgpu', async () => {
  const actual = await vi.importActual<typeof import('three/webgpu')>('three/webgpu');

  class MockWebGPURenderer {
    readonly backend: { isWebGPUBackend?: boolean; isWebGLBackend?: boolean; dispose?: () => Promise<void> };
    readonly record: (typeof harness.instances)[number];
    _getFallback: ((error: unknown) => void) | null;
    onDeviceLost: (info: { api: string; message: string; reason: string | null; originalEvent: unknown }) => void = () => {};

    constructor(readonly options: { forceWebGL?: boolean; canvas?: HTMLCanvasElement }) {
      this.record = {
        forceWebGL: options.forceWebGL === true,
        canvas: options.canvas,
        disposed: false,
        backendDisposed: false,
        internalFallbackUsed: false,
        animationLoopValues: [],
        animationLoopCallback: null,
        resolveCompute: null,
        resolveTimestamp: null,
        timestampResolveCalls: 0,
        triggerDeviceLost: () => this.onDeviceLost({ api: 'WebGPU', message: 'Device removed', reason: 'unknown', originalEvent: null }),
      };
      harness.instances.push(this.record);
      this.backend = this.record.forceWebGL
        ? { isWebGLBackend: true, dispose: async () => { this.record.backendDisposed = true; } }
        : { isWebGPUBackend: true, dispose: async () => { this.record.backendDisposed = true; } };
      this._getFallback = this.record.forceWebGL
        ? null
        : () => {
          this.record.internalFallbackUsed = true;
          Object.assign(this.backend, { isWebGPUBackend: false, isWebGLBackend: true });
        };
    }

    async init(): Promise<void> {
      if (this.record.forceWebGL) {
        if (harness.deferWebGLInit) {
          harness.webGLInitStarted = true;
          harness.deferWebGLInit = false;
          await new Promise<void>((resolve, reject) => {
            harness.resolveWebGLInit = resolve;
            harness.rejectWebGLInit = reject;
          });
        }
        return;
      }
      if (this.options.canvas?.getContext('webgpu') === null) {
        throw new Error('Canvas context mode is already locked to another API.');
      }
      let error: Error | null = null;
      if (harness.scenario === 'init-programming') error = harness.error;
      if (harness.scenario === 'init-no-adapter') error = new Error('THREE.WebGPUBackend: Unable to create WebGPU adapter.');
      if (error !== null) {
        if (this._getFallback !== null) {
          this._getFallback(error);
          return;
        }
        throw error;
      }
    }

    compute(): Promise<void> | void {
      if (this.record.forceWebGL) return;
      if (harness.deferNextCompute) {
        harness.deferNextCompute = false;
        return new Promise<void>((resolve) => { this.record.resolveCompute = resolve; });
      }
      if (harness.scenario === 'compute-programming') throw harness.error;
      if (harness.scenario === 'compute-device-lost') {
        this.onDeviceLost({ api: 'WebGPU', message: 'Device removed', reason: 'unknown', originalEvent: null });
        throw harness.error;
      }
    }

    async setAnimationLoop(callback: ((time: number) => void) | null): Promise<void> {
      this.record.animationLoopValues.push(callback);
      if (callback) this.record.animationLoopCallback = callback;
      if (this.record.forceWebGL || callback === null) return;
      if (harness.scenario === 'animation-programming') throw harness.error;
      if (harness.scenario === 'animation-device-lost') {
        this.onDeviceLost({ api: 'WebGPU', message: 'Device removed', reason: 'unknown', originalEvent: null });
        throw harness.error;
      }
    }

    setPixelRatio(): void {}
    setSize(): void {}
    hasFeature(): boolean { return harness.timestampSupported; }
    resolveTimestampsAsync(): Promise<number> {
      this.record.timestampResolveCalls += 1;
      if (harness.deferTimestamps) {
        return new Promise((resolve) => { this.record.resolveTimestamp = resolve; });
      }
      return Promise.resolve(harness.timestampValue);
    }
    render(scene: Scene, camera: PerspectiveCamera): void { harness.scene = scene; harness.camera = camera; }
    dispose(): void { this.record.disposed = true; }
  }

  return { ...actual, WebGPURenderer: MockWebGPURenderer };
});

function makeCanvas(context: WebGL2RenderingContext | null = {} as WebGL2RenderingContext): HTMLCanvasElement {
  const host = { current: null as HTMLCanvasElement | null };
  const create = (): HTMLCanvasElement => {
    let contextMode: string | null = null;
    const canvas = new EventTarget() as HTMLCanvasElement;
    Object.defineProperties(canvas, {
      parentElement: { configurable: true, get: () => host },
      parentNode: { configurable: true, get: () => host },
    });
    Object.assign(canvas, {
      getRootNode: () => canvas,
      getContext: vi.fn((type: string) => {
        if (contextMode !== null && contextMode !== type) return null;
        contextMode = type;
        return context;
      }),
      cloneNode: vi.fn(() => create()),
      replaceWith: vi.fn((replacement: HTMLCanvasElement) => { host.current = replacement; }),
      insertAdjacentElement: vi.fn(() => { harness.noticeInsertions += 1; return null; }),
    });
    return canvas;
  };
  const canvas = create();
  host.current = canvas;
  return canvas;
}

async function expectDisposed(record: (typeof harness.instances)[number], initialized = true): Promise<void> {
  if (!initialized) {
    await vi.waitFor(() => expect(record.backendDisposed).toBe(true));
    expect(record.disposed).toBe(false);
    expect(record.animationLoopValues).not.toContain(null);
    return;
  }
  await vi.waitFor(() => expect(record.disposed).toBe(true));
  expect(record.animationLoopValues).toContain(null);
}

describe('ThreeRendererAdapter initialization error classification', () => {
  beforeEach(() => {
    harness.scenario = '';
    harness.buffers.length = 0;
    harness.controls.length = 0;
    harness.scene = null;
    harness.camera = null;
    harness.error = null;
    harness.deferNextCompute = false;
    harness.deferTimestamps = false;
    harness.deferWebGLInit = false;
    harness.webGLInitStarted = false;
    harness.resolveWebGLInit = null;
    harness.rejectWebGLInit = null;
    harness.timestampSupported = false;
    harness.timestampValue = 4;
    harness.noticeInsertions = 0;
    harness.instances.length = 0;
    vi.stubGlobal('navigator', { gpu: { requestAdapter: vi.fn(async () => ({})) } });
    vi.stubGlobal('document', {
      createElement: () => ({
        className: '',
        textContent: '',
        setAttribute: vi.fn(),
        remove: vi.fn(),
      }),
    });
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('propagates an unexpected renderer.init error and disposes without trying WebGL2', async () => {
    const error = new TypeError('invalid renderer configuration');
    harness.scenario = 'init-programming';
    harness.error = error;
    const adapter = new ThreeRendererAdapter(makeCanvas(), DEFAULT_CONFIG);

    await expect(adapter.init({ width: 640, height: 480, pixelRatio: 1 })).rejects.toBe(error);

    expect(harness.instances).toHaveLength(1);
    expect(harness.instances[0]?.forceWebGL).toBe(false);
    expect(harness.instances[0]?.internalFallbackUsed).toBe(false);
    await expectDisposed(harness.instances[0]!, false);
  });

  it('falls back for Three r186.1 explicit no-adapter result and disposes the failed renderer', async () => {
    harness.scenario = 'init-no-adapter';
    const adapter = new ThreeRendererAdapter(makeCanvas(), DEFAULT_CONFIG);

    await expect(adapter.init({ width: 640, height: 480, pixelRatio: 1 })).resolves.toBe('webgl2');

    expect(harness.instances).toHaveLength(2);
    expect(harness.instances[0]?.forceWebGL).toBe(false);
    expect(harness.instances[1]?.forceWebGL).toBe(true);
    await expectDisposed(harness.instances[0]!, false);
    adapter.dispose();
  });

  it('reports unavailable when WebGL2 cannot create a context', async () => {
    vi.stubGlobal('navigator', {});
    vi.stubGlobal('document', {
      createElement: () => ({
        setAttribute: vi.fn(),
        remove: vi.fn(),
      }),
    });
    const canvas = makeCanvas(null);
    const adapter = new ThreeRendererAdapter(canvas, { ...DEFAULT_CONFIG, backendPreference: 'webgl2' });

    await expect(adapter.init({ width: 640, height: 480, pixelRatio: 1 })).resolves.toBe('unavailable');

    expect(harness.instances).toHaveLength(0);
    expect(canvas.insertAdjacentElement).toHaveBeenCalledOnce();
  });

  it('propagates an unexpected init-kernel compute error and disposes without fallback', async () => {
    const error = new TypeError('invalid TSL compute graph');
    harness.scenario = 'compute-programming';
    harness.error = error;
    const adapter = new ThreeRendererAdapter(makeCanvas(), DEFAULT_CONFIG);

    await expect(adapter.init({ width: 640, height: 480, pixelRatio: 1 })).rejects.toBe(error);

    expect(harness.instances).toHaveLength(1);
    await expectDisposed(harness.instances[0]!);
  });

  it('falls back only when the renderer reports device loss during init-kernel compute', async () => {
    harness.scenario = 'compute-device-lost';
    harness.error = new Error('device queue unavailable');
    const adapter = new ThreeRendererAdapter(makeCanvas(), DEFAULT_CONFIG);

    await expect(adapter.init({ width: 640, height: 480, pixelRatio: 1 })).resolves.toBe('webgl2');

    expect(harness.instances).toHaveLength(2);
    await expectDisposed(harness.instances[0]!);
    adapter.dispose();
  });

  it('propagates an unexpected setAnimationLoop error and disposes without fallback', async () => {
    const error = new TypeError('invalid animation loop callback');
    harness.scenario = 'animation-programming';
    harness.error = error;
    const adapter = new ThreeRendererAdapter(makeCanvas(), DEFAULT_CONFIG);

    await expect(adapter.init({ width: 640, height: 480, pixelRatio: 1 })).rejects.toBe(error);

    expect(harness.instances).toHaveLength(1);
    await expectDisposed(harness.instances[0]!);
  });

  it('falls back only when the renderer reports device loss while starting its animation loop', async () => {
    harness.scenario = 'animation-device-lost';
    harness.error = new Error('device queue unavailable');
    const adapter = new ThreeRendererAdapter(makeCanvas(), DEFAULT_CONFIG);

    await expect(adapter.init({ width: 640, height: 480, pixelRatio: 1 })).resolves.toBe('webgl2');

    expect(harness.instances).toHaveLength(2);
    await expectDisposed(harness.instances[0]!);
    adapter.dispose();
  });

  it('clears GPU timing on pause and reset and ignores a result that resolves after pause', async () => {
    harness.timestampSupported = true;
    harness.deferTimestamps = true;
    vi.useFakeTimers();
    const adapter = new ThreeRendererAdapter(makeCanvas(), DEFAULT_CONFIG);
    await adapter.init({ width: 640, height: 480, pixelRatio: 1 });
    adapter.start();
    const frame = harness.instances[0]!.animationLoopCallback!;

    for (let index = 1; index <= 30; index += 1) frame(index * 16);
    await vi.waitFor(() => expect(harness.instances[0]?.resolveTimestamp).toBeTypeOf('function'));
    adapter.pause();
    expect(adapter.getStatus()).toMatchObject({ gpuTimingAvailable: false, measurementAgeMs: null, gpuTimeMs: null });

    harness.instances[0]!.resolveTimestamp!(3.25);
    await Promise.resolve();
    await Promise.resolve();
    expect(adapter.getStatus()).toMatchObject({ gpuTimingAvailable: false, measurementAgeMs: null, gpuTimeMs: null });

    adapter.start();
    for (let index = 31; index <= 60; index += 1) frame(index * 16);
    await vi.waitFor(() => expect(harness.instances[0]?.resolveTimestamp).toBeTypeOf('function'));
    harness.instances[0]!.resolveTimestamp!(3.25);
    await vi.waitFor(() => expect(adapter.getStatus().gpuTimingAvailable).toBe(true));
    expect(adapter.getStatus().measurementAgeMs).not.toBeNull();

    await vi.advanceTimersByTimeAsync(MAX_GPU_MEASUREMENT_AGE_MS + 1);
    expect(adapter.getStatus()).toMatchObject({ gpuTimingAvailable: false, gpuTimeMs: null });
    expect(adapter.getStatus().measurementAgeMs).toBeGreaterThan(MAX_GPU_MEASUREMENT_AGE_MS);

    adapter.reset();
    expect(adapter.getStatus()).toMatchObject({ gpuTimingAvailable: false, measurementAgeMs: null, gpuTimeMs: null });
    adapter.dispose();
  });

  it.each(['pause', 'reset', 'dispose'] as const)(
    'does not start a timestamp query when sampled compute resolves after %s',
    async (action) => {
      harness.timestampSupported = true;
      harness.deferTimestamps = true;
      const adapter = new ThreeRendererAdapter(makeCanvas(), DEFAULT_CONFIG);
      await adapter.init({ width: 640, height: 480, pixelRatio: 1 });
      adapter.start();
      const frame = harness.instances[0]!.animationLoopCallback!;
      for (let index = 1; index < 10; index += 1) frame(index * 16);
      harness.deferNextCompute = true;
      frame(10 * 16);
      await vi.waitFor(() => expect(harness.instances[0]?.resolveCompute).toBeTypeOf('function'));

      if (action === 'pause') adapter.pause();
      else if (action === 'reset') adapter.reset();
      else adapter.dispose();
      harness.instances[0]!.resolveCompute!();
      await Promise.resolve();
      await Promise.resolve();

      expect(harness.instances[0]?.timestampResolveCalls).toBe(0);
      expect(adapter.getStatus()).toMatchObject({
        gpuTimingAvailable: false,
        measurementAgeMs: null,
        gpuTimeMs: null,
      });
      if (action !== 'dispose') adapter.dispose();
    },
  );

  it('ages a GPU sample from compute submission, including delayed timestamp readback', async () => {
    harness.timestampSupported = true;
    harness.deferTimestamps = true;
    vi.useFakeTimers();
    const adapter = new ThreeRendererAdapter(makeCanvas(), DEFAULT_CONFIG);
    await adapter.init({ width: 640, height: 480, pixelRatio: 1 });
    adapter.start();
    const frame = harness.instances[0]!.animationLoopCallback!;
    for (let index = 1; index <= 10; index += 1) frame(index * 16);

    expect(harness.instances[0]?.timestampResolveCalls).toBe(1);
    await vi.advanceTimersByTimeAsync(500);
    harness.instances[0]!.resolveTimestamp!(3.25);
    await vi.waitFor(() => expect(adapter.getStatus().gpuTimingAvailable).toBe(true));

    expect(adapter.getStatus().measurementAgeMs).toBeGreaterThanOrEqual(500);
    adapter.dispose();
  });

  it('rejects late GPU timing from the lost renderer and samples the recovered renderer independently', async () => {
    harness.timestampSupported = true;
    harness.deferTimestamps = true;
    harness.deferWebGLInit = true;
    const adapter = new ThreeRendererAdapter(makeCanvas(), DEFAULT_CONFIG);
    await adapter.init({ width: 640, height: 480, pixelRatio: 1 });
    adapter.start();
    const lost = harness.instances[0]!;
    for (let index = 1; index <= 10; index += 1) lost.animationLoopCallback!(index * 16);
    expect(lost.timestampResolveCalls).toBe(1);

    lost.triggerDeviceLost();
    await vi.waitFor(() => expect(harness.webGLInitStarted).toBe(true));
    expect(adapter.getStatus()).toMatchObject({
      actual: 'unavailable', measurementAgeMs: null, gpuTimingAvailable: false, gpuTimeMs: null,
    });
    harness.resolveWebGLInit!();
    await vi.waitFor(() => expect(adapter.getStatus()).toMatchObject({ actual: 'webgl2', running: true }));
    const recovered = harness.instances[1]!;
    for (let index = 1; index <= 10; index += 1) recovered.animationLoopCallback!(index * 16);
    expect(recovered.timestampResolveCalls).toBe(1);

    lost.resolveTimestamp!(99);
    await new Promise<void>(resolve => setTimeout(resolve, 0));
    expect(adapter.getStatus()).toMatchObject({
      actual: 'webgl2', measurementAgeMs: null, gpuTimingAvailable: false, gpuTimeMs: null,
    });
    // A stale request's finally handler must not unlock the new in-flight query.
    for (let index = 11; index <= 20; index += 1) recovered.animationLoopCallback!(index * 16);
    expect(recovered.timestampResolveCalls).toBe(1);
    recovered.resolveTimestamp!(2.5);
    await vi.waitFor(() => expect(adapter.getStatus()).toMatchObject({
      actual: 'webgl2', running: true, gpuTimingAvailable: true, gpuTimeMs: 2.5,
      measurementAgeMs: expect.any(Number),
    }));
    adapter.dispose();
  });

  it('recovers once to WebGL2 when the WebGPU device is lost after initialization', async () => {
    const canvas = makeCanvas();
    const adapter = new ThreeRendererAdapter(canvas, DEFAULT_CONFIG);
    await expect(adapter.init({ width: 640, height: 480, pixelRatio: 1 })).resolves.toBe('webgpu');
    adapter.start();

    harness.instances[0]!.triggerDeviceLost();

    await vi.waitFor(() => expect(adapter.getStatus()).toMatchObject({ actual: 'webgl2', running: true }));
    expect(harness.instances).toHaveLength(2);
    expect(harness.instances[1]?.forceWebGL).toBe(true);
    expect(harness.instances[1]?.canvas).not.toBe(canvas);
    expect(canvas.replaceWith).toHaveBeenCalledOnce();
    await expectDisposed(harness.instances[0]!);
    expect(harness.instances[1]?.disposed).toBe(false);
    adapter.dispose();
  });

  it('uses a fresh canvas because a canvas cannot switch from its WebGPU context to WebGL2', async () => {
    const canvas = makeCanvas();
    const adapter = new ThreeRendererAdapter(canvas, DEFAULT_CONFIG);
    await adapter.init({ width: 640, height: 480, pixelRatio: 1 });
    expect(canvas.getContext('webgpu')).not.toBeNull();

    harness.instances[0]!.triggerDeviceLost();

    await vi.waitFor(() => expect(adapter.getStatus().actual).toBe('webgl2'));
    expect(harness.instances[1]?.canvas).not.toBe(canvas);
    expect(harness.instances[1]?.canvas?.getContext('webgl2')).not.toBeNull();
    adapter.dispose();
  });

  it('keeps a pause requested while WebGL2 recovery initialization is pending', async () => {
    const adapter = new ThreeRendererAdapter(makeCanvas(), DEFAULT_CONFIG);
    await adapter.init({ width: 640, height: 480, pixelRatio: 1 });
    adapter.start();
    harness.deferWebGLInit = true;
    harness.instances[0]!.triggerDeviceLost();
    await vi.waitFor(() => expect(harness.webGLInitStarted).toBe(true));

    adapter.pause();
    harness.resolveWebGLInit?.();

    await vi.waitFor(() => expect(adapter.getStatus()).toMatchObject({ actual: 'webgl2', running: false }));
    expect(harness.instances).toHaveLength(2);
    adapter.dispose();
  });

  it('keeps a start requested while WebGL2 recovery initialization is pending', async () => {
    const adapter = new ThreeRendererAdapter(makeCanvas(), DEFAULT_CONFIG);
    await adapter.init({ width: 640, height: 480, pixelRatio: 1 });
    adapter.pause();
    harness.deferWebGLInit = true;
    harness.instances[0]!.triggerDeviceLost();
    await vi.waitFor(() => expect(harness.webGLInitStarted).toBe(true));

    adapter.start();
    harness.resolveWebGLInit?.();

    await vi.waitFor(() => expect(adapter.getStatus()).toMatchObject({ actual: 'webgl2', running: true }));
    expect(harness.instances).toHaveLength(2);
    adapter.dispose();
  });

  it.each(['disposed', 'new initialization generation'] as const)(
    'ignores a late recovery failure after the adapter is %s', async (state) => {
      const adapter = new ThreeRendererAdapter(makeCanvas(), DEFAULT_CONFIG);
      await adapter.init({ width: 640, height: 480, pixelRatio: 1 });
      harness.deferWebGLInit = true;
      harness.instances[0]!.triggerDeviceLost();
      await vi.waitFor(() => expect(harness.webGLInitStarted).toBe(true));

      let replacementIndex: number | null = null;
      if (state === 'disposed') {
        adapter.dispose();
      } else {
        adapter.applyConfig({ ...DEFAULT_CONFIG, backendPreference: 'webgl2' });
        await expect(adapter.init({ width: 640, height: 480, pixelRatio: 1 })).resolves.toBe('webgl2');
        replacementIndex = harness.instances.length - 1;
        expect(adapter.getStatus().actual).toBe('webgl2');
      }

      const insertionsBeforeLateFailure = harness.noticeInsertions;
      harness.rejectWebGLInit?.(new Error('late recovery failure'));
      await vi.waitFor(() => expect(harness.instances[1]?.backendDisposed).toBe(true));
      await new Promise<void>(resolve => setTimeout(resolve, 0));

      expect(harness.noticeInsertions).toBe(insertionsBeforeLateFailure);
      if (state === 'disposed') {
        expect(adapter.getStatus()).toMatchObject({ actual: 'unavailable', running: false });
      } else {
        expect(adapter.getStatus()).toMatchObject({ actual: 'webgl2', running: false });
        expect(harness.instances[replacementIndex!]?.disposed).toBe(false);
      }
      adapter.dispose();
    },
  );

  it('clears stale FPS and keeps GPU timing unavailable during and after failed recovery', async () => {
    harness.timestampSupported = true;
    harness.deferWebGLInit = true;
    const adapter = new ThreeRendererAdapter(makeCanvas(), DEFAULT_CONFIG);
    await adapter.init({ width: 640, height: 480, pixelRatio: 1 });
    adapter.start();
    const frame = harness.instances[0]!.animationLoopValues.at(-1);
    expect(typeof frame).toBe('function');
    const startedAt = performance.now();
    for (let index = 0; index <= 32; index += 1) (frame as (time: number) => void)(startedAt + index * 20);
    await vi.waitFor(() => expect(adapter.getStatus()).toMatchObject({
      gpuTimingAvailable: true,
      gpuTimeMs: 4,
      fps: expect.any(Number),
    }));

    harness.instances[0]!.triggerDeviceLost();
    await vi.waitFor(() => expect(harness.webGLInitStarted).toBe(true));
    expect(adapter.getStatus()).toMatchObject({
      actual: 'unavailable',
      gpuTimingAvailable: false,
      gpuTimeMs: null,
      fps: null,
    });

    harness.rejectWebGLInit?.(new Error('WebGL2 recovery failed'));
    await vi.waitFor(() => expect(adapter.getStatus().actual).toBe('unavailable'));
    expect(adapter.getStatus()).toMatchObject({
      gpuTimingAvailable: false,
      gpuTimeMs: null,
      fps: null,
    });
    adapter.dispose();
  });

  it('does not retry after the recovered WebGL2 renderer is lost', async () => {
    const adapter = new ThreeRendererAdapter(makeCanvas(), DEFAULT_CONFIG);
    await adapter.init({ width: 640, height: 480, pixelRatio: 1 });
    harness.instances[0]!.triggerDeviceLost();
    await vi.waitFor(() => expect(adapter.getStatus().actual).toBe('webgl2'));

    harness.instances[1]!.triggerDeviceLost();

    await vi.waitFor(() => expect(adapter.getStatus()).toMatchObject({ actual: 'unavailable', running: false }));
    expect(harness.instances).toHaveLength(2);
    await expectDisposed(harness.instances[1]!);
    adapter.dispose();
  });

  it('marks a lost WebGL2 context unavailable without starting a recovery loop', async () => {
    const canvas = makeCanvas();
    const adapter = new ThreeRendererAdapter(canvas, { ...DEFAULT_CONFIG, backendPreference: 'webgl2' });
    await expect(adapter.init({ width: 640, height: 480, pixelRatio: 1 })).resolves.toBe('webgl2');

    const contextLost = new Event('webglcontextlost', { cancelable: true });
    canvas.dispatchEvent(contextLost);

    await vi.waitFor(() => expect(adapter.getStatus()).toMatchObject({ actual: 'unavailable', running: false }));
    expect(contextLost.defaultPrevented).toBe(true);
    expect(harness.instances).toHaveLength(1);
    await expectDisposed(harness.instances[0]!);
    adapter.dispose();
  });

  it('maps every nested runtime field into the shared pipeline, material, scene and camera', async () => {
    const config = cloneConfig(DEFAULT_CONFIG);
    Object.assign(config.simulation, { particleCount: 1000, speed: 2, spawnRadius: 37, lifetime: 11, particleSize: 7 });
    Object.assign(config.modes.attractor, { attractorStrength: 3, attractorRadius: 27, attractorDamping: 0.91 });
    Object.assign(config.rendering, { particleColor: '#123456', backgroundColor: '#234567', opacity: 0.4, additiveBlend: false });
    Object.assign(config.camera, { enabled: true, autoRotate: true, distance: 500 });
    const adapter = new ThreeRendererAdapter(makeCanvas(), config);
    await adapter.init({ width: 640, height: 480, pixelRatio: 1 });
    const frame = harness.instances[0]!.animationLoopValues.at(-1) as (time: number) => void;
    frame(1000);
    const buffers = harness.buffers[0]!;
    expect(buffers.count).toBe(1000);
    expect(buffers.uniforms.spawnRadius.value).toBe(37);
    expect(buffers.uniforms.lifetime.value).toBe(11);
    expect(buffers.uniforms.strength.value).toBe(3);
    expect(buffers.uniforms.radius.value).toBe(27);
    expect(buffers.uniforms.damping.value).toBe(0.91);
    const material = (harness.scene!.children[0] as import('three').Sprite).material as unknown as import('three/webgpu').PointsNodeMaterial;
    expect(material.color.getHexString()).toBe('123456');
    expect(material.size).toBe(7);
    expect(material.opacity).toBe(0.4);
    expect(material.transparent).toBe(true);
    expect(material.blending).toBe(1); // Three NormalBlending
    expect((harness.scene!.background as import('three').Color).getHexString()).toBe('234567');
    expect(harness.camera!.position.length()).toBe(500);
    expect(harness.camera!.far).toBeGreaterThan(500 + 37);
    expect(harness.controls[0]).toMatchObject({ enabled: true, autoRotate: true });

    // The caller's later mutation must not affect the adapter's snapshot.
    config.simulation.speed = 3;
    adapter.start();
    frame(1100);
    frame(2100);
    expect(buffers.uniforms.delta.value).toBeCloseTo(0.05 * 2); // clamp then multiply once
    adapter.dispose();
  });

  it('preserves inactive groups, selects the new group, and rebuilds/init-disposes only for count changes', async () => {
    const config = cloneConfig(DEFAULT_CONFIG);
    config.simulation.particleCount = 1000;
    const adapter = new ThreeRendererAdapter(makeCanvas(), config);
    await adapter.init({ width: 640, height: 480, pixelRatio: 1 });
    const buffers = harness.buffers[0]!;
    const dispose = vi.spyOn(buffers.positions.value, 'dispose');
    const next = cloneConfig(config);
    Object.assign(next.modes.vortex, { vortexStrength: 3.7, vortexDamping: 0.84 });
    adapter.applyConfig(next);
    expect(buffers.uniforms.strength.value).toBe(config.modes.attractor.attractorStrength);
    expect(harness.buffers).toHaveLength(1);
    next.mode = 'vortex';
    adapter.applyConfig(next);
    expect(buffers.uniforms.strength.value).toBe(3.7);
    expect(buffers.uniforms.vortexDamping.value).toBe(0.84);
    next.modes.attractor.attractorRadius = 39;
    adapter.applyConfig(next);
    expect(buffers.uniforms.radius.value).toBe(config.modes.attractor.attractorRadius);
    next.mode = 'attractor';
    adapter.applyConfig(next);
    expect(buffers.uniforms.radius.value).toBe(39);
    next.simulation.particleCount = 2000;
    adapter.applyConfig(next);
    expect(harness.buffers).toHaveLength(2);
    expect(harness.buffers[1]!.count).toBe(2000);
    expect(dispose).toHaveBeenCalledOnce();
    adapter.dispose();
  });

  it('updates material program state and camera radius without losing the orbit target/direction', async () => {
    const config = cloneConfig(DEFAULT_CONFIG);
    config.simulation.particleCount = 1000;
    config.rendering.opacity = 1;
    config.rendering.additiveBlend = false;
    const adapter = new ThreeRendererAdapter(makeCanvas(), config);
    await adapter.init({ width: 640, height: 480, pixelRatio: 1 });
    const frame = harness.instances[0]!.animationLoopValues.at(-1) as (time: number) => void;
    frame(1000);
    const material = (harness.scene!.children[0] as import('three').Sprite).material;
    const version = material.version;
    const controls = harness.controls[0]!;
    controls.target.set(10, 3, 2);
    harness.camera!.position.set(40, 3, 2);
    const next = cloneConfig(config);
    next.camera = { enabled: false, autoRotate: true, distance: 5 };
    next.rendering.additiveBlend = true;
    next.rendering.opacity = 0.7;
    adapter.applyConfig(next);
    expect(material.blending).toBe(2); // Three AdditiveBlending
    expect(material.transparent).toBe(true);
    expect(material.opacity).toBe(0.7);
    expect(material.version).toBeGreaterThan(version);
    expect(controls).toMatchObject({ enabled: false, autoRotate: false });
    expect(controls.target.toArray()).toEqual([10, 3, 2]);
    expect(harness.camera!.position.toArray()).toEqual([15, 3, 2]);
    next.simulation.speed = 2;
    adapter.applyConfig(next);
    expect(harness.camera!.position.toArray()).toEqual([15, 3, 2]);
    adapter.dispose();
    adapter.dispose();
    expect(controls.dispose).toHaveBeenCalledOnce();
  });

  it('recovers with the latest nested config and disposes the old controls before replacing them', async () => {
    const config = cloneConfig(DEFAULT_CONFIG);
    config.simulation.particleCount = 1000;
    const canvas = makeCanvas();
    const remove = vi.spyOn(canvas, 'removeEventListener');
    const adapter = new ThreeRendererAdapter(canvas, config);
    await adapter.init({ width: 640, height: 480, pixelRatio: 1 });
    const controls = harness.controls[0]!;
    const next = cloneConfig(config);
    next.mode = 'vortex';
    next.modes.vortex.vortexStrength = 2.9;
    next.modes.vortex.vortexDamping = 0.85;
    next.simulation.spawnRadius = 44;
    next.camera.distance = 450;
    adapter.applyConfig(next);
    adapter.pause();
    harness.instances[0]!.triggerDeviceLost();
    await vi.waitFor(() => expect(adapter.getStatus()).toMatchObject({ actual: 'webgl2', running: false }));
    expect(controls.dispose).toHaveBeenCalledOnce();
    expect(remove).toHaveBeenCalledWith('webglcontextlost', expect.any(Function));
    expect(harness.controls).toHaveLength(2);
    expect(harness.buffers.at(-1)!.uniforms.strength.value).toBe(2.9);
    expect(harness.buffers.at(-1)!.uniforms.vortexDamping.value).toBe(0.85);
    expect(harness.buffers.at(-1)!.uniforms.spawnRadius.value).toBe(44);
    adapter.dispose();
    expect(harness.controls[1]!.dispose).toHaveBeenCalledOnce();
  });

});
