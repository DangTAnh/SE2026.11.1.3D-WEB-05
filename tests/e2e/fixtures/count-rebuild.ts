/**
 * Real ThreeRendererAdapter harness for #103 (particle-count rebuild).
 *
 * It drives the production adapter through its public RendererPort methods and
 * reads the *currently rendered* position attribute back from the GPU. The
 * attribute is located through the scene that the adapter passes to
 * `renderer.render()`, so the readback is the same buffer the points sample.
 * No adapter internals are changed and no CPU fallback is involved.
 */
import { WebGPURenderer, type Scene, type Sprite, type PointsNodeMaterial, type BufferAttribute } from 'three/webgpu';
import { ThreeRendererAdapter } from '../../../src/simulations/rendererAdapter.ts';
import { DEFAULT_CONFIG, cloneConfig, type LabConfig } from '../../../src/presets/preset.ts';
import type { RendererStatus } from '../../../src/core/renderer/RendererPort.ts';

export interface PositionSummary {
  /** Element count of the rendered attribute (vec3 entries). */
  count: number;
  /** Sprite instance count the scene draws. */
  drawCount: number;
  floats: number;
  nonZero: number;
  finite: boolean;
  maxAbs: number;
  /** Mean distance from the origin; spawn is uniform in a sphere of spawnRadius. */
  meanRadius: number;
  /** Sum of |coordinate|; changes when a resumed kernel moves the particles. */
  absSum: number;
}

export interface RebuildHarness {
  init(config: Partial<{ count: number; mode: LabConfig['mode']; backend: LabConfig['backendPreference'] }>): Promise<RendererStatus>;
  apply(patch: Partial<{ count: number; mode: LabConfig['mode'] }>): void;
  start(): void;
  pause(): void;
  frames(n: number): Promise<number>;
  readPositions(): Promise<PositionSummary>;
  status(): RendererStatus;
  dispose(): void;
}

declare global {
  interface Window {
    rebuild: RebuildHarness;
  }
}

let lastRenderer: WebGPURenderer | null = null;
let lastScene: Scene | null = null;
let renderCalls = 0;
const nativeRender = WebGPURenderer.prototype.render;
WebGPURenderer.prototype.render = function patchedRender(this: WebGPURenderer, scene, camera) {
  lastRenderer = this;
  lastScene = scene as Scene;
  renderCalls += 1;
  return nativeRender.call(this, scene, camera);
};

const host = document.querySelector<HTMLElement>('#host')!;
let adapter: ThreeRendererAdapter | null = null;
let config: LabConfig = cloneConfig(DEFAULT_CONFIG);

function renderedPoints(): Sprite {
  const sprites = (lastScene?.children ?? []).filter((child): child is Sprite => (child as Sprite).isSprite === true);
  if (sprites.length !== 1) throw new Error(`Expected exactly one rendered Sprite, found ${sprites.length}.`);
  return sprites[0];
}

function waitFrames(n: number): Promise<number> {
  const target = renderCalls + n;
  return new Promise((resolve, reject) => {
    const started = performance.now();
    const tick = (): void => {
      if (renderCalls >= target) resolve(renderCalls);
      else if (performance.now() - started > 30_000) reject(new Error(`Timed out waiting for ${n} rendered frames.`));
      else requestAnimationFrame(tick);
    };
    tick();
  });
}

window.rebuild = {
  async init({ count = 1000, mode = 'attractor', backend = 'webgl2' }) {
    config = cloneConfig(DEFAULT_CONFIG);
    config.simulation.particleCount = count;
    config.mode = mode;
    config.backendPreference = backend;
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 480;
    canvas.style.width = '640px';
    canvas.style.height = '480px';
    host.replaceChildren(canvas);
    adapter = new ThreeRendererAdapter(canvas, config);
    adapter.applyConfig(config);
    await adapter.init({ width: 640, height: 480, pixelRatio: 1 });
    return adapter.getStatus();
  },
  apply({ count, mode }) {
    if (!adapter) throw new Error('Adapter is not initialized.');
    const next = cloneConfig(config);
    if (count !== undefined) next.simulation.particleCount = count;
    if (mode !== undefined) next.mode = mode;
    config = next;
    adapter.applyConfig(next);
  },
  start() { adapter?.start(); },
  pause() { adapter?.pause(); },
  frames: waitFrames,
  async readPositions() {
    if (!lastRenderer) throw new Error('No frame has been rendered yet.');
    const points = renderedPoints();
    const material = points.material as PointsNodeMaterial;
    const attribute = (material.positionNode as unknown as { value?: BufferAttribute } | null)?.value;
    if (!attribute || (attribute as { isStorageInstancedBufferAttribute?: boolean }).isStorageInstancedBufferAttribute !== true) {
      throw new Error('Rendered positionNode is not backed by a storage instanced attribute.');
    }
    const floats = new Float32Array(await lastRenderer.getArrayBufferAsync(attribute));
    // vec3 storage may be padded to vec4 on WebGPU; use the attribute stride.
    const stride = attribute.itemSize;
    let nonZero = 0;
    let finite = true;
    let maxAbs = 0;
    let radiusSum = 0;
    let absSum = 0;
    if (floats.length < attribute.count * stride) throw new Error(`Truncated readback: ${floats.length} floats.`);
    for (let i = 0; i < attribute.count; i += 1) {
      const x = floats[i * stride];
      const y = floats[i * stride + 1];
      const z = floats[i * stride + 2];
      for (const value of [x, y, z]) {
        if (!Number.isFinite(value)) finite = false;
        if (value !== 0) nonZero += 1;
        maxAbs = Math.max(maxAbs, Math.abs(value));
        absSum += Math.abs(value);
      }
      radiusSum += Math.sqrt(x * x + y * y + z * z);
    }
    return {
      count: attribute.count,
      drawCount: points.count,
      floats: attribute.count * 3,
      nonZero,
      finite,
      maxAbs,
      meanRadius: radiusSum / attribute.count,
      absSum,
    };
  },
  status() {
    if (!adapter) throw new Error('Adapter is not initialized.');
    return adapter.getStatus();
  },
  dispose() {
    adapter?.dispose();
    adapter = null;
  },
};
