import {
  Color,
  PerspectiveCamera,
  Sprite,
  Scene,
  Vector3,
} from 'three/webgpu';
import { PointsNodeMaterial, WebGPURenderer } from 'three/webgpu';
import type { ActualBackend } from '../core/types/backend.ts';
import { MAX_GPU_MEASUREMENT_AGE_MS, type RendererPort, type RendererStatus, type RendererTarget } from '../core/renderer/RendererPort.ts';
import type { LabConfig } from '../presets/preset.ts';
import { DEFAULT_ATTRACTOR_DAMPING, DEFAULT_ATTRACTOR_RADIUS, resolveVortexDamping } from './simulation.ts';
import { createAttractorKernel } from './shared/attractorKernel.ts';
import { createVortexKernel } from './shared/vortexKernel.ts';
import { createParticleBuffers, type ParticleBuffers } from './shared/particleBuffers.ts';
import { BackendUnavailableError, startBackend, type InitializedBackend } from './backend/fallback.ts';

const MAX_FRAME_DELTA = 0.05;
const GPU_TIMING_SAMPLE_INTERVAL_FRAMES = 30;
const THREE_NO_WEBGPU_ADAPTER_MESSAGE = 'THREE.WebGPUBackend: Unable to create WebGPU adapter.';

/** Three r186.1 emits this exact generic Error only when requestAdapter() returns null. */
function isThreeNoWebGpuAdapterError(error: unknown): boolean {
  return error instanceof Error && error.message === THREE_NO_WEBGPU_ADAPTER_MESSAGE;
}

function hasWebGpuApi(): boolean {
  if (typeof navigator === 'undefined') return false;
  const gpu = (navigator as Navigator & { gpu?: { requestAdapter?: unknown } }).gpu;
  return typeof gpu?.requestAdapter === 'function';
}

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
  #gpuTimeSampledAt: number | null = null;
  #measurementGeneration = 0;
  #gpuTimingRequestId = 0;
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
    this.#clearGpuTiming();
    this.#requested = this.#config.backendPreference;
    this.#target = target;

    const started = await startBackend<WebGPURenderer>(
      this.#requested,
      {
        webgpu: () => this.#initializeRenderer(false, generation),
        webgl2: () => this.#initializeRenderer(true, generation),
      },
    );
    if (!this.#isInitActive(generation)) return 'unavailable';
    this.#renderer = started.instance;
    this.#actual = started.actual;
    if (!this.#renderer) this.#showUnavailableNotice();

    return this.#isInitActive(generation) ? this.#actual : 'unavailable';
  }
  async #initializeRenderer(forceWebGL: boolean, generation: number): Promise<InitializedBackend<WebGPURenderer>> {
    if (!this.#isInitActive(generation)) {
      throw new BackendUnavailableError('Renderer initialization is no longer active.');
    }

    if (!forceWebGL && !hasWebGpuApi()) {
      throw new BackendUnavailableError('WebGPU is not available in this browser.');
    }

    const options: ConstructorParameters<typeof WebGPURenderer>[0] = {
      canvas: this.#canvas,
      antialias: true,
      forceWebGL,
      trackTimestamp: true,
    };
    if (forceWebGL) {
      const context = this.#canvas.getContext('webgl2', {
        antialias: true,
        alpha: true,
        depth: true,
        stencil: false,
      });
      if (context === null) {
        throw new BackendUnavailableError('WebGL2 context is not available in this browser.');
      }
      options.context = context;
    }

    const renderer = new WebGPURenderer(options);
    let rendererInitialized = false;
    let deviceLost = false;
    const onDeviceLost = renderer.onDeviceLost;
    renderer.onDeviceLost = (info) => {
      deviceLost = true;
      onDeviceLost.call(renderer, info);
    };

    // WebGPURenderer otherwise catches every WebGPU init error and silently
    // switches to WebGL2. Keep classification here so unknown errors propagate.
    if (!forceWebGL) {
      (renderer as WebGPURenderer & { _getFallback: ((error: unknown) => unknown) | null })._getFallback = null;
    }

    try {
      try {
        await renderer.init();
        rendererInitialized = true;
      } catch (error) {
        if (deviceLost || (!forceWebGL && isThreeNoWebGpuAdapterError(error))) {
          throw new BackendUnavailableError('Renderer backend/device is unavailable.', { cause: error });
        }
        throw error;
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
          if (deviceLost) {
            throw new BackendUnavailableError('Renderer device was lost while initializing the particle pipeline.', { cause: error });
          }
          throw error;
        }
      }
      if (!this.#isInitActive(generation)) {
        throw new BackendUnavailableError('Renderer initialization was cancelled.');
      }

      this.#gpuTimingSupported = renderer.hasFeature('timestamp-query');
      try {
        await renderer.setAnimationLoop(this.#onFrame);
      } catch (error) {
        if (deviceLost) {
          throw new BackendUnavailableError('Renderer device was lost while starting its animation loop.', { cause: error });
        }
        throw error;
      }
      if (!this.#isInitActive(generation)) {
        throw new BackendUnavailableError('Renderer initialization was cancelled.');
      }
      return { actual, instance: renderer };
    } catch (error) {
      if (this.#renderer === renderer) this.#releaseRenderer();
      else await this.#disposeRenderer(renderer, rendererInitialized);
      if (!(error instanceof BackendUnavailableError)) {
        console.error('Unexpected renderer initialization error.', error);
      }
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

  async #disposeRenderer(renderer: WebGPURenderer, initialized = true): Promise<void> {
    if (!initialized) {
      // Three r186.1's Renderer.dispose() calls setAnimationLoop(null) without
      // awaiting it. Before successful init, that retries the rejected init and
      // leaks an unhandled rejection. The partial backend owns the only resources
      // created so far, so dispose it directly and finish before trying fallback.
      // This also completes before startBackend can construct WebGLBackend on the same canvas.
      try {
        await (renderer.backend as typeof renderer.backend & { dispose: () => Promise<void> }).dispose();
      } catch {
        // Keep cleanup best-effort; the original initialization error is reported.
      }
      return;
    }

    try {
      await renderer.setAnimationLoop(null);
    } catch {
      // Disposal must continue even if stopping the loop fails.
    }
    try {
      await renderer.dispose();
    } catch {
      // Cleanup errors must not replace the initialization/runtime error.
    }
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
    const measurementGeneration = this.#measurementGeneration;
    const requestId = ++this.#gpuTimingRequestId;
    void renderer.resolveTimestampsAsync('compute')
      .then((durationMs) => {
        if (this.#renderer !== renderer || this.#disposed || measurementGeneration !== this.#measurementGeneration) return;
        if (durationMs !== undefined && durationMs !== null && Number.isFinite(durationMs) && durationMs > 0) {
          this.#gpuTimeMs = durationMs;
          this.#gpuTimingAvailable = true;
          this.#gpuTimeSampledAt = performance.now();
        } else {
          this.#gpuTimeMs = null;
          this.#gpuTimingAvailable = false;
          this.#gpuTimeSampledAt = null;
        }
      })
      .catch(() => {
        if (this.#renderer !== renderer || this.#disposed || measurementGeneration !== this.#measurementGeneration) return;
        this.#gpuTimeMs = null;
        this.#gpuTimingAvailable = false;
        this.#gpuTimeSampledAt = null;
      })
      .finally(() => {
        if (requestId === this.#gpuTimingRequestId) this.#gpuTimingInFlight = false;
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
    this.#clearGpuTiming();
  }

  resize(target: RendererTarget): void {
    this.#target = target;
    this.#resize();
  }

  reset(): void {
    if (!this.#renderer || this.#disposed) return;
    this.#clearGpuTiming();
    if (this.#buffers) this.#watchCompute(() => this.#renderer!.compute(this.#buffers!.initKernel), this.#renderer);
  }

  getStatus(): RendererStatus {
    const measurementAgeMs = this.#gpuTimeSampledAt === null
      ? null
      : performance.now() - this.#gpuTimeSampledAt;
    const gpuTimingAvailable = this.#gpuTimingAvailable
      && this.#gpuTimeMs !== null
      && measurementAgeMs !== null
      && Number.isFinite(measurementAgeMs)
      && measurementAgeMs >= 0
      && measurementAgeMs <= MAX_GPU_MEASUREMENT_AGE_MS;
    return {
      requested: this.#requested,
      actual: this.#actual,
      running: this.#running,
      gpuTimingAvailable,
      measurementAgeMs,
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
    uniforms.vortexDamping.value = resolveVortexDamping(config.vortexDamping);
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
    if (renderer) void this.#disposeRenderer(renderer);
    this.#geometryAndMaterialDispose();
    this.#renderer = null;
    this.#scene = null;
    this.#camera = null;
    this.#buffers = null;
    this.#computeKernel = null;
    this.#gpuTimingSupported = false;
    this.#clearGpuTiming();
    this.#computeFrames = 0;
  }

  #clearGpuTiming(): void {
    this.#measurementGeneration += 1;
    this.#gpuTimingRequestId += 1;
    this.#gpuTimingAvailable = false;
    this.#gpuTimingInFlight = false;
    this.#gpuTimeMs = null;
    this.#gpuTimeSampledAt = null;
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
