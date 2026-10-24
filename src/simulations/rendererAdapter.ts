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
import { BackendUnavailableError, forceWebGLFromSearch, startBackend, type InitializedBackend } from './backend/fallback.ts';

const MAX_FRAME_DELTA = 0.05;
const GPU_TIMING_SAMPLE_INTERVAL_FRAMES = 30;

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
  #gpuTimingSupported = false;
  #gpuTimingAvailable = false;
  #gpuTimingInFlight = false;
  #gpuTimeMs: number | null = null;
  #computeFrames = 0;
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

    try {
      const started = await startBackend<WebGPURenderer>(
        this.#requested,
        forceWebGLFromSearch(window.location.search),
        {
          webgpu: () => this.#initializeRenderer(false, generation),
          webgl2: () => this.#initializeRenderer(true, generation),
        },
      );
      if (!this.#isInitActive(generation)) return 'unavailable';
      this.#renderer = started.instance;
      this.#actual = started.actual;
      if (!this.#renderer) this.#showUnavailableNotice();
    } catch (error) {
      if (this.#isInitActive(generation)) {
        this.#actual = 'unavailable';
        this.#showUnavailableNotice();
      }
      throw error;
    }

    return this.#isInitActive(generation) ? this.#actual : 'unavailable';
  }
  async #initializeRenderer(forceWebGL: boolean, generation: number): Promise<InitializedBackend<WebGPURenderer>> {
    if (!this.#isInitActive(generation)) {
      throw new BackendUnavailableError('Renderer initialization is no longer active.');
    }
    const renderer = new WebGPURenderer({
      canvas: this.#canvas,
      antialias: true,
      forceWebGL,
      trackTimestamp: true,
    });
    try {
      try {
        await renderer.init();
      } catch (error) {
        throw new BackendUnavailableError('Renderer backend initialization failed.', { cause: error });
      }
      if (!this.#isInitActive(generation)) {
        throw new BackendUnavailableError('Renderer initialization was cancelled.');
      }

      const actual = this.#resolveActualBackend(renderer);
      if (actual === 'unavailable') {
        throw new BackendUnavailableError('Renderer initialized without a supported backend.');
      }
      this.#renderer = renderer;
      this.#actual = actual;
      this.#createScene();
      this.#createPipeline(this.#config.particleCount, this.#config);
      if (this.#buffers) {
        try {
          await renderer.compute(this.#buffers.initKernel);
        } catch (error) {
          throw new BackendUnavailableError('Renderer could not initialize the particle pipeline.', { cause: error });
        }
      }
      if (!this.#isInitActive(generation)) {
        throw new BackendUnavailableError('Renderer initialization was cancelled.');
      }

      this.#gpuTimingSupported = renderer.hasFeature('timestamp-query');
      try {
        await renderer.setAnimationLoop(this.#onFrame);
      } catch (error) {
        throw new BackendUnavailableError('Renderer could not start its animation loop.', { cause: error });
      }
      if (!this.#isInitActive(generation)) {
        throw new BackendUnavailableError('Renderer initialization was cancelled.');
      }
      return { actual, instance: renderer };
    } catch (error) {
      if (this.#renderer === renderer) this.#releaseRenderer();
      else this.#disposeRenderer(renderer);
      throw error;
    }
  }
  #isInitActive(generation: number): boolean {
    return !this.#disposed && generation === this.#initGeneration;
  }
  #resolveActualBackend(renderer: WebGPURenderer): ActualBackend {
    const backend = renderer.backend as { isWebGPUBackend?: boolean; isWebGLBackend?: boolean };
    if (backend.isWebGPUBackend === true) return 'webgpu';
    if (backend.isWebGLBackend === true) return 'webgl2';
    return 'unavailable';
  }

  #disposeRenderer(renderer: WebGPURenderer): void {
    void Promise.resolve()
      .then(() => renderer.setAnimationLoop(null))
      .catch(() => undefined)
      .then(() => renderer.dispose())
      .catch(() => undefined);
  }
  #watchCompute(
    run: () => Promise<unknown> | undefined,
    renderer: WebGPURenderer,
    sampleGpuTime = false,
  ): boolean {
    let task: Promise<unknown> | undefined;
    try {
      task = run();
    } catch {
      this.#handleComputeFailure(renderer);
      return false;
    }
    if (task) {
      void task.then(() => {
        if (sampleGpuTime) this.#resolveGpuTime(renderer);
      }).catch(() => this.#handleComputeFailure(renderer));
    }
    return this.#renderer === renderer && !this.#disposed;
  }

  #resolveGpuTime(renderer: WebGPURenderer): void {
    if (!this.#gpuTimingSupported || this.#gpuTimingInFlight || this.#renderer !== renderer || this.#disposed) return;
    this.#gpuTimingInFlight = true;
    void renderer.resolveTimestampsAsync('compute')
      .then((durationMs) => {
        if (this.#renderer !== renderer || this.#disposed) return;
        if (durationMs !== undefined && durationMs !== null && Number.isFinite(durationMs) && durationMs > 0) {
          this.#gpuTimeMs = durationMs;
          this.#gpuTimingAvailable = true;
        } else {
          this.#gpuTimeMs = null;
          this.#gpuTimingAvailable = false;
        }
      })
      .catch(() => {
        if (this.#renderer !== renderer || this.#disposed) return;
        this.#gpuTimeMs = null;
        this.#gpuTimingAvailable = false;
      })
      .finally(() => {
        this.#gpuTimingInFlight = false;
      });
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
    const renderer = this.#renderer;

    if (countChanged && renderer) this.#createPipeline(config.particleCount, config);
    this.#config = { ...config };
    this.#updateUniforms();
    if (this.#material) {
      this.#material.color = new Color(config.particleColor);
      this.#material.size = config.particleSize;
    }

    if (renderer && countChanged && this.#buffers) {
      this.#watchCompute(() => renderer.compute(this.#buffers!.initKernel), renderer);
    } else if (renderer && modeChanged) {
      this.#selectComputeKernel();
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
    const gpuTimingAvailable = this.#gpuTimingAvailable && this.#gpuTimeMs !== null;
    return {
      requested: this.#requested,
      actual: this.#actual,
      running: this.#running,
      gpuTimingAvailable,
      fps: this.#fps > 0 ? this.#fps : null,
      gpuTimeMs: gpuTimingAvailable ? this.#gpuTimeMs : null,
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

  #createPipeline(count: number, config: Readonly<LabConfig>): void {
    if (!Number.isInteger(count) || count <= 0) throw new RangeError('Particle count must be a positive integer.');
    const scene = this.#scene;
    if (!this.#renderer || !scene) throw new Error('Renderer scene is not initialized.');

    let buffers: ParticleBuffers | null = null;
    let material: PointsNodeMaterial | null = null;
    let points: Sprite | null = null;
    let computeKernel: ReturnType<typeof createAttractorKernel> | ReturnType<typeof createVortexKernel> | null = null;
    try {
      buffers = createParticleBuffers(count);
      material = new PointsNodeMaterial({
        color: config.particleColor,
        size: config.particleSize,
        positionNode: buffers.positions.toAttribute(),
      });
      points = new Sprite(material);
      points.count = count;
      computeKernel = config.mode === 'attractor'
        ? createAttractorKernel(buffers)
        : createVortexKernel(buffers);
      scene.add(points);
    } catch (error) {
      if (points) scene.remove(points);
      this.#disposePipeline(material, buffers);
      throw error;
    }

    const previousPoints = this.#points;
    const previousMaterial = this.#material;
    const previousBuffers = this.#buffers;
    this.#points = points;
    this.#material = material;
    this.#buffers = buffers;
    this.#computeKernel = computeKernel;
    this.#updateUniforms(buffers, config);

    if (previousPoints) scene.remove(previousPoints);
    this.#disposePipeline(previousMaterial, previousBuffers);
  }

  #updateUniforms(
    buffers: ParticleBuffers | null = this.#buffers,
    config: Readonly<LabConfig> = this.#config,
  ): void {
    if (!buffers) return;
    const { uniforms } = buffers;
    uniforms.strength.value = config.strength;
    uniforms.delta.value = 0;
    uniforms.radius.value = DEFAULT_ATTRACTOR_RADIUS;
    uniforms.damping.value = DEFAULT_ATTRACTOR_DAMPING;
    uniforms.vortexDamping.value = DEFAULT_VORTEX_DAMPING;
  }

  #selectComputeKernel(buffers: ParticleBuffers | null = this.#buffers, config: Readonly<LabConfig> = this.#config): void {
    if (!buffers) return;
    this.#computeKernel = config.mode === 'attractor'
      ? createAttractorKernel(buffers)
      : createVortexKernel(buffers);
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
          this.#computeFrames += 1;
          const sampleGpuTime = this.#computeFrames % GPU_TIMING_SAMPLE_INTERVAL_FRAMES === 0;
          if (!this.#watchCompute(() => renderer.compute(this.#computeKernel!), renderer, sampleGpuTime)) return;
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

  #disposePipeline(material: PointsNodeMaterial | null, buffers: ParticleBuffers | null): void {
    material?.dispose();
    buffers?.positions.value.dispose();
    buffers?.velocities.value.dispose();
    buffers?.ages.value.dispose();
    buffers?.seeds.value.dispose();
  }

  #geometryAndMaterialDispose(): void {
    const material = this.#material;
    const buffers = this.#buffers;
    this.#material = null;
    this.#points = null;
    this.#buffers = null;
    this.#disposePipeline(material, buffers);
  }

  #releaseRenderer(): void {
    const renderer = this.#renderer;
    if (renderer) this.#disposeRenderer(renderer);
    this.#geometryAndMaterialDispose();
    this.#renderer = null;
    this.#scene = null;
    this.#camera = null;
    this.#buffers = null;
    this.#computeKernel = null;
    this.#gpuTimingSupported = false;
    this.#gpuTimingAvailable = false;
    this.#gpuTimingInFlight = false;
    this.#gpuTimeMs = null;
    this.#computeFrames = 0;
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
