import { afterEach, describe, expect, it, vi } from 'vitest';
import { cloneConfig, DEFAULT_CONFIG } from '../../src/presets/preset.ts';
import { ThreeRendererAdapter } from '../../src/simulations/rendererAdapter.ts';

vi.mock('three/webgpu', async () => {
  const actual = await vi.importActual<typeof import('three/webgpu')>('three/webgpu');
  class Renderer {
    backend = { isWebGLBackend: true };
    onDeviceLost = (): void => {};
    async init(): Promise<void> {}
    async compute(): Promise<void> {}
    async setAnimationLoop(): Promise<void> {}
    setPixelRatio(): void {}
    setSize(): void {}
    hasFeature(): boolean { return false; }
    dispose(): void {}
  }
  return { ...actual, WebGPURenderer: Renderer };
});

/** Real Three OrbitControls, fake GPU renderer: proves listener ownership only. */
describe('OrbitControls lifecycle with detached session canvases', () => {
  afterEach(() => { vi.restoreAllMocks(); });

  it('removes root keyboard listeners even when session commit detached the old canvas first', async () => {
    const root = new EventTarget();
    const rootAdd = vi.spyOn(root, 'addEventListener');
    const rootRemove = vi.spyOn(root, 'removeEventListener');
    let attached = true;
    const canvas = new EventTarget() as HTMLCanvasElement;
    Object.assign(canvas, {
      style: {},
      clientHeight: 480,
      clientWidth: 640,
      ownerDocument: root,
      getRootNode: () => attached ? root : canvas,
      getContext: () => ({}),
    });
    const canvasAdd = vi.spyOn(canvas, 'addEventListener');
    const canvasRemove = vi.spyOn(canvas, 'removeEventListener');
    const config = cloneConfig(DEFAULT_CONFIG);
    config.backendPreference = 'webgl2';
    config.simulation.particleCount = 1000;
    const adapter = new ThreeRendererAdapter(canvas, config);
    await expect(adapter.init({ width: 640, height: 480, pixelRatio: 1 })).resolves.toBe('webgl2');
    const keyboardListener = rootAdd.mock.calls.find(([name]) => name === 'keydown')?.[1];
    expect(keyboardListener).toBeTypeOf('function');
    const keydown = new Event('keydown');
    Object.assign(keydown, { key: 'Control' });
    root.dispatchEvent(keydown);
    const keyupListener = rootAdd.mock.calls.find(([name]) => name === 'keyup')?.[1];
    expect(keyupListener).toBeTypeOf('function');
    // Simulate the order used by RendererSession: replacement commit, then dispose.
    attached = false;
    adapter.dispose();
    expect(rootRemove).toHaveBeenCalledWith('keydown', keyboardListener, { capture: true });
    expect(rootRemove).toHaveBeenCalledWith('keyup', keyupListener, { capture: true });
    for (const [type, listener] of canvasAdd.mock.calls) {
      expect(canvasRemove.mock.calls.some(([removedType, removedListener]) => removedType === type && removedListener === listener)).toBe(true);
    }
    expect(canvas.style.touchAction).toBe('');
    const removalCount = rootRemove.mock.calls.length;
    adapter.dispose();
    expect(rootRemove).toHaveBeenCalledTimes(removalCount);
  });
});
