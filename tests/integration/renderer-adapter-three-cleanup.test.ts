import { afterEach, describe, expect, it, vi } from 'vitest';
import type { WebGPURenderer } from 'three/webgpu';
import { DEFAULT_CONFIG } from '../../src/presets/preset.ts';
import { ThreeRendererAdapter } from '../../src/simulations/rendererAdapter.ts';

const harness = vi.hoisted(() => ({
  initError: null as Error | null,
  backendDisposeCalled: false,
  rendererDisposeCalled: false,
}));

vi.mock('three/webgpu', async () => {
  const actual = await vi.importActual<typeof import('three/webgpu')>('three/webgpu');

  class CapturingWebGPURenderer extends actual.WebGPURenderer {
    constructor(options: ConstructorParameters<typeof actual.WebGPURenderer>[0]) {
      super(options);
      const backend = this.backend as typeof this.backend & {
        init: (...args: unknown[]) => Promise<void>;
        dispose: () => Promise<void>;
      };
      const renderer = this as WebGPURenderer & { dispose: () => Promise<void> };
      const disposeBackend = backend.dispose.bind(backend);
      const disposeRenderer = renderer.dispose.bind(renderer);
      backend.init = async () => { throw harness.initError; };
      backend.dispose = async () => {
        harness.backendDisposeCalled = true;
        await disposeBackend();
      };
      renderer.dispose = async () => {
        harness.rendererDisposeCalled = true;
        await disposeRenderer();
      };
    }
  }

  return { ...actual, WebGPURenderer: CapturingWebGPURenderer };
});

function makeCanvas(): HTMLCanvasElement {
  return {
    width: 1,
    height: 1,
    getContext: vi.fn(() => null),
    insertAdjacentElement: vi.fn(),
  } as unknown as HTMLCanvasElement;
}

describe('ThreeRendererAdapter cleanup with Three r186.1 lifecycle', () => {
  afterEach(() => {
    harness.initError = null;
    harness.backendDisposeCalled = false;
    harness.rendererDisposeCalled = false;
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('disposes only the partial backend without retrying rejected init or leaking an unhandled rejection', async () => {
    const initError = new Error('probe init failure');
    harness.initError = initError;
    vi.stubGlobal('navigator', { gpu: { requestAdapter: vi.fn(async () => ({})) } });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const unhandled: unknown[] = [];
    const onUnhandled = (reason: unknown): void => { unhandled.push(reason); };
    process.on('unhandledRejection', onUnhandled);

    try {
      const adapter = new ThreeRendererAdapter(makeCanvas(), {
        ...DEFAULT_CONFIG,
        backendPreference: 'webgpu',
      });

      await expect(adapter.init({ width: 640, height: 480, pixelRatio: 1 })).rejects.toBe(initError);
      await new Promise<void>((resolve) => setTimeout(resolve, 0));

      expect(harness.backendDisposeCalled).toBe(true);
      expect(harness.rendererDisposeCalled).toBe(false);
      expect(unhandled).toEqual([]);
    } finally {
      process.off('unhandledRejection', onUnhandled);
    }
  });
});
