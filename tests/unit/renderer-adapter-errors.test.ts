import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ThreeRendererAdapter } from '../../src/simulations/rendererAdapter.ts';
import { DEFAULT_CONFIG } from '../../src/presets/preset.ts';

const harness = vi.hoisted(() => ({
  scenario: '' as string,
  error: null as Error | null,
  instances: [] as Array<{
    forceWebGL: boolean;
    disposed: boolean;
    backendDisposed: boolean;
    internalFallbackUsed: boolean;
    animationLoopValues: unknown[];
    triggerDeviceLost: () => void;
  }>,
}));

vi.mock('three/webgpu', async () => {
  const actual = await vi.importActual<typeof import('three/webgpu')>('three/webgpu');

  class MockWebGPURenderer {
    readonly backend: { isWebGPUBackend?: boolean; isWebGLBackend?: boolean; dispose?: () => Promise<void> };
    readonly record: (typeof harness.instances)[number];
    _getFallback: ((error: unknown) => void) | null;
    onDeviceLost: (info: { api: string; message: string; reason: string | null; originalEvent: unknown }) => void = () => {};

    constructor(readonly options: { forceWebGL?: boolean }) {
      this.record = {
        forceWebGL: options.forceWebGL === true,
        disposed: false,
        backendDisposed: false,
        internalFallbackUsed: false,
        animationLoopValues: [],
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
      if (this.record.forceWebGL) return;
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

    async compute(): Promise<void> {
      if (this.record.forceWebGL) return;
      if (harness.scenario === 'compute-programming') throw harness.error;
      if (harness.scenario === 'compute-device-lost') {
        this.onDeviceLost({ api: 'WebGPU', message: 'Device removed', reason: 'unknown', originalEvent: null });
        throw harness.error;
      }
    }

    async setAnimationLoop(callback: ((time: number) => void) | null): Promise<void> {
      this.record.animationLoopValues.push(callback);
      if (this.record.forceWebGL || callback === null) return;
      if (harness.scenario === 'animation-programming') throw harness.error;
      if (harness.scenario === 'animation-device-lost') {
        this.onDeviceLost({ api: 'WebGPU', message: 'Device removed', reason: 'unknown', originalEvent: null });
        throw harness.error;
      }
    }

    setPixelRatio(): void {}
    setSize(): void {}
    hasFeature(): boolean { return false; }
    render(): void {}
    dispose(): void { this.record.disposed = true; }
  }

  return { ...actual, WebGPURenderer: MockWebGPURenderer };
});

function makeCanvas(context: WebGL2RenderingContext | null = {} as WebGL2RenderingContext): HTMLCanvasElement {
  const canvas = new EventTarget() as HTMLCanvasElement;
  Object.assign(canvas, {
    getContext: vi.fn(() => context),
    insertAdjacentElement: vi.fn(),
  });
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
    harness.error = null;
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

  it('recovers once to WebGL2 when the WebGPU device is lost after initialization', async () => {
    const adapter = new ThreeRendererAdapter(makeCanvas(), DEFAULT_CONFIG);
    await expect(adapter.init({ width: 640, height: 480, pixelRatio: 1 })).resolves.toBe('webgpu');
    adapter.start();

    harness.instances[0]!.triggerDeviceLost();

    await vi.waitFor(() => expect(adapter.getStatus()).toMatchObject({ actual: 'webgl2', running: true }));
    expect(harness.instances).toHaveLength(2);
    expect(harness.instances[1]?.forceWebGL).toBe(true);
    await expectDisposed(harness.instances[0]!);
    expect(harness.instances[1]?.disposed).toBe(false);
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
});
