import {
  Color,
  PerspectiveCamera,
  Sprite,
  Scene,
  Vector3,
} from 'three/webgpu';
import { PointsNodeMaterial, WebGPURenderer } from 'three/webgpu';
import type { ActualBackend } from '../core/types/backend.ts';
import type { RendererPort, RendererStatus, RendererTarget } from '../core/renderer/RendererPort.ts';
import type { LabConfig } from '../presets/preset.ts';
import { DEFAULT_ATTRACTOR_DAMPING, DEFAULT_ATTRACTOR_RADIUS, DEFAULT_VORTEX_DAMPING } from './simulation.ts';
import { createAttractorKernel } from './shared/attractorKernel.ts';
import { createVortexKernel } from './shared/vortexKernel.ts';
import { createParticleBuffers, type ParticleBuffers } from './shared/particleBuffers.ts';

const MAX_FRAME_DELTA = 0.05;

/** Three.js implementation of the app-facing renderer contract. */
export class ThreeRendererAdapter implements RendererPort {
  #canvas: HTMLCanvasElement;
  #renderer: WebGPURenderer | null = null;
  #scene: Scene | null = null;
  #camera: PerspectiveCamera | null = null;
  #material: PointsNodeMaterial | null = null;
  #points: Sprite | null = null;
  #buffers: ParticleBuffers | null = null;
  #computeKernel: ReturnType<typeof createAttractorKernel> | ReturnType<typeof createVortexKernel> | null = null;
  #config: Readonly<LabConfig>;
  #actual: ActualBackend = 'unavailable';
  #requested: LabConfig['backendPreference'] = 'auto';
  #initGeneration = 0;
  #running = false;
  #disposed = false;
  #fps = 0;
  #fpsFrames = 0;
  #fpsStartedAt = 0;
  #lastFrameAt = 0;
  #target: RendererTarget = { width: 1, height: 1, pixelRatio: 1 };
  #unavailableNotice: HTMLElement | null = null;

  constructor(canvas: HTMLCanvasElement, initialConfig: Readonly<LabConfig>) {
    this.#canvas = canvas;
    this.#config = { ...initialConfig };
    this.#requested = initialConfig.backendPreference;
  }

  async init(target: RendererTarget): Promise<ActualBackend> {
    if (this.#disposed) return 'unavailable';
    const generation = ++this.#initGeneration;
    if (this.#renderer) this.#releaseRenderer();
    this.#unavailableNotice?.remove();
    this.#unavailableNotice = null;
    this.#actual = 'unavailable';
    this.#running = false;
    this.#requested = this.#config.backendPreference;
    this.#target = target;

    let renderer: WebGPURenderer | null = null;
    try {
      renderer = new WebGPURenderer({ canvas: this.#canvas, antialias: true });
      await renderer.init();
      if (!this.#isInitActive(generation)) {
        renderer.dispose();
        return 'unavailable';
      }

      this.#renderer = renderer;
      this.#actual = 'webgpu';
      this.#createScene();
      this.#createPipeline(this.#config.particleCount);
      if (this.#buffers) await renderer.compute(this.#buffers.initKernel);
      if (!this.#isInitActive(generation)) return 'unavailable';

      await renderer.setAnimationLoop(this.#onFrame);
      if (!this.#isInitActive(generation)) return 'unavailable';
    } catch {
      if (renderer && this.#renderer === renderer) {
        this.#releaseRenderer();
      } else if (renderer && this.#isInitActive(generation)) {
        renderer.dispose();
      }
      if (this.#isInitActive(generation)) {
        this.#actual = 'unavailable';
        this.#showUnavailableNotice();
      }
    }

    return this.#isInitActive(generation) ? this.#actual : 'unavailable';
  }
  #isInitActive(generation: number): boolean {
    return !this.#disposed && generation === this.#initGeneration;
  }

  #watchCompute(run: () => Promise<unknown> | undefined, renderer: WebGPURenderer): void {
    let task: Promise<unknown>;
    try {
      const result = run();
      if (!result) return;
      task = result;
    } catch {
      this.#handleComputeFailure(renderer);
      return;
    }
    void task.catch(() => this.#handleComputeFailure(renderer));
  }

  #handleComputeFailure(renderer: WebGPURenderer): void {
    if (this.#disposed || this.#renderer !== renderer) return;
    this.#running = false;
    this.#actual = 'unavailable';
    this.#releaseRenderer();
    this.#showUnavailableNotice();
  }
  applyConfig(config: Readonly<LabConfig>): void {
    const countChanged = config.particleCount !== this.#config.particleCount;
    const modeChanged = config.mode !== this.#config.mode;
    this.#config = { ...config };
    this.#updateUniforms();
    if (this.#material) {
      this.#material.color = new Color(config.particleColor);
      this.#material.size = config.particleSize;
    }

    if (this.#renderer && (countChanged || modeChanged)) {
      if (countChanged) this.#createPipeline(config.particleCount);
      else if (modeChanged) this.#selectComputeKernel();
      this.#updateUniforms();
    }
  }
  start(): void {
    if (this.#disposed || this.#actual === 'unavailable') return;
    this.#running = true;
    this.#lastFrameAt = 0;
    this.#fpsFrames = 0;
    this.#fpsStartedAt = performance.now();
  }

  pause(): void {
    this.#running = false;
  }

  resize(target: RendererTarget): void {
    this.#target = target;
    this.#resize();
  }

  reset(): void {
    if (!this.#renderer || this.#disposed) return;
    if (this.#buffers) this.#watchCompute(() => this.#renderer!.compute(this.#buffers!.initKernel), this.#renderer);
  }

  getStatus(): RendererStatus {
    return {
      requested: this.#requested,
      actual: this.#actual,
      running: this.#running,
      gpuTimingAvailable: false,
      fps: this.#fps > 0 ? this.#fps : null,
      gpuTimeMs: null,
    };
  }

  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    this.#running = false;
    this.#releaseRenderer();
    this.#unavailableNotice?.remove();
    this.#unavailableNotice = null;
  }

  #createScene(): void {
    const renderer = this.#renderer;
    if (!renderer) return;

    const scene = new Scene();
    scene.background = new Color('#071018');
    const camera = new PerspectiveCamera(55, this.#target.width / this.#target.height, 0.1, 200);
    camera.position.set(0, 0, 30);
    camera.lookAt(new Vector3(0, 0, 0));
    this.#scene = scene;
    this.#camera = camera;
    renderer.setPixelRatio(this.#target.pixelRatio);
    renderer.setSize(this.#target.width, this.#target.height, false);
  }

  #createPipeline(count: number): void {
    if (!this.#renderer || count <= 0) return;

    if (this.#points) this.#scene?.remove(this.#points);
    this.#geometryAndMaterialDispose();

    const buffers = createParticleBuffers(count);
    const material = new PointsNodeMaterial({
      color: this.#config.particleColor,
      size: this.#config.particleSize,
      positionNode: buffers.positions.toAttribute(),
    });
    const points = new Sprite(material);
    points.count = count;
    this.#buffers = buffers;
    this.#scene?.add(points);

    this.#material = material;
    this.#points = points;
    this.#updateUniforms();
    this.#selectComputeKernel();
  }
  #updateUniforms(): void {
    if (!this.#buffers) return;
    const { uniforms } = this.#buffers;
    uniforms.strength.value = this.#config.strength;
    uniforms.delta.value = 0;
    // Both kernels are compiled once with their respective mode uniform values.
    uniforms.radius.value = DEFAULT_ATTRACTOR_RADIUS;
    uniforms.damping.value = DEFAULT_ATTRACTOR_DAMPING;
    uniforms.vortexDamping.value = DEFAULT_VORTEX_DAMPING;
  }

  #selectComputeKernel(): void {
    if (!this.#buffers) return;
    this.#computeKernel = this.#config.mode === 'attractor'
      ? createAttractorKernel(this.#buffers)
      : createVortexKernel(this.#buffers);
  }

  #onFrame = (time: number): void => {
    const renderer = this.#renderer;
    const scene = this.#scene;
    const camera = this.#camera;
    const buffers = this.#buffers;
    if (!renderer || !scene || !camera || this.#disposed) return;

    if (this.#running) {
      const rawDelta = this.#lastFrameAt === 0 ? 0 : (time - this.#lastFrameAt) / 1000;
      const delta = Math.min(MAX_FRAME_DELTA, Math.max(0, rawDelta));
      if (buffers) {
        buffers.uniforms.delta.value = delta * this.#config.speed;
        if (this.#computeKernel) {
          this.#watchCompute(() => renderer.compute(this.#computeKernel!), renderer);
        }
      }
      this.#fpsFrames += 1;
      const elapsed = time - this.#fpsStartedAt;
      if (elapsed >= 500) {
        this.#fps = (this.#fpsFrames * 1000) / elapsed;
        this.#fpsFrames = 0;
        this.#fpsStartedAt = time;
      }
    }

    this.#lastFrameAt = time;
    renderer.render(scene, camera);
  };

  #resize(): void {
    this.#renderer?.setPixelRatio(this.#target.pixelRatio);
    this.#renderer?.setSize(this.#target.width, this.#target.height, false);
    if (this.#camera) {
      this.#camera.aspect = this.#target.width / this.#target.height;
      this.#camera.updateProjectionMatrix();
    }
  }

  #geometryAndMaterialDispose(): void {
    this.#material?.dispose();
    this.#material = null;
    this.#points = null;

    const buffers = this.#buffers;
    this.#buffers = null;
    buffers?.positions.value.dispose();
    buffers?.velocities.value.dispose();
    buffers?.ages.value.dispose();
    buffers?.seeds.value.dispose();
  }
  #releaseRenderer(): void {
    const renderer = this.#renderer;
    if (renderer) void Promise.resolve(renderer.setAnimationLoop(null)).catch(() => undefined);
    this.#geometryAndMaterialDispose();
    renderer?.dispose();
    this.#renderer = null;
    this.#scene = null;
    this.#camera = null;
    this.#buffers = null;
    this.#computeKernel = null;
  }

  #showUnavailableNotice(): void {
    const notice = document.createElement('div');
    notice.className = 'renderer-unavailable';
    notice.setAttribute('role', 'status');
    notice.textContent = 'No supported renderer could be initialized in this browser.';
    this.#canvas.insertAdjacentElement('afterend', notice);
    this.#unavailableNotice = notice;
  }
}
