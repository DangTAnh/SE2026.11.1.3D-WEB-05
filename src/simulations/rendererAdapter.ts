import {
  AdditiveBlending,
  NormalBlending,
  Color,
  PerspectiveCamera,
  Sprite,
  Scene,
  Vector3,
} from 'three/webgpu';
import { PointsNodeMaterial, WebGPURenderer } from 'three/webgpu';
import type { ActualBackend } from '../core/types/backend.ts';
import { MAX_GPU_MEASUREMENT_AGE_MS, type RendererPort, type RendererStatus, type RendererTarget } from '../core/renderer/RendererPort.ts';
import { cloneConfig, type LabConfig } from '../presets/preset.ts';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createAttractorKernel } from './shared/attractorKernel.ts';
import { createVortexKernel } from './shared/vortexKernel.ts';
import { createParticleBuffers, type ParticleBuffers } from './shared/particleBuffers.ts';
import { BackendUnavailableError, startBackend, type InitializedBackend } from './backend/fallback.ts';
import { resolveFreshComputeTime } from './backend/gpuTiming.ts';

const MAX_FRAME_DELTA = 0.05;
// At 60 FPS this samples about 6 times/second; the 2 s freshness window
// nominally covers scenes down to 5 FPS, allowing for asynchronous query resolve.
const GPU_TIMING_SAMPLE_INTERVAL_FRAMES = 10;
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
  #controls: OrbitControls | null = null;
  #controlsRoot: EventTarget | null = null;
  #material: PointsNodeMaterial | null = null;
  #points: Sprite | null = null;
  #buffers: ParticleBuffers | null = null;
  #computeKernel: ReturnType<typeof createAttractorKernel> | ReturnType<typeof createVortexKernel> | null = null;
  #config: Readonly<LabConfig>;
  #actual: ActualBackend = 'unavailable';
  #requested: LabConfig['backendPreference'] = 'auto';
  #initGeneration = 0;
  #runtimeFallbackAttempted = false;
  #runtimeRecoveryInFlight = false;
  #runtimeRecoveryTask: Promise<void> | null = null;
  #deviceLossRenderer: WebGPURenderer | null = null;
  #initializingRenderer: WebGPURenderer | null = null;
  #readyRenderer: WebGPURenderer | null = null;
  #running = false;
  #runningIntent = false;
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
  #onWebGLContextLost = (event: Event): void => {
    event.preventDefault();
    const renderer = this.#renderer ?? this.#initializingRenderer;
    if (!renderer) return;
    this.#deviceLossRenderer = renderer;
    if (this.#readyRenderer === renderer) {
      this.#scheduleRuntimeDeviceLoss(renderer, this.#initGeneration);
    }
  };

  constructor(canvas: HTMLCanvasElement, initialConfig: Readonly<LabConfig>) {
    this.#canvas = canvas;
    this.#config = cloneConfig(initialConfig);
    this.#requested = initialConfig.backendPreference;
    this.#canvas.addEventListener('webglcontextlost', this.#onWebGLContextLost);
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
    this.#runningIntent = false;
    this.#runtimeFallbackAttempted = false;
    this.#runtimeRecoveryInFlight = false;
    this.#runtimeRecoveryTask = null;
    this.#deviceLossRenderer = null;
    this.#initializingRenderer = null;
    this.#readyRenderer = null;
    this.#requested = this.#config.backendPreference;
    this.#target = target;

    const started = await startBackend<WebGPURenderer>(
      this.#requested,
      {
        webgpu: async () => {
          try {
            return await this.#initializeRenderer(false, generation);
          } catch (error) {
            if (error instanceof BackendUnavailableError && this.#isInitActive(generation)) {
              this.#replaceCanvasForRecovery();
            }
            throw error;
          }
        },
        webgl2: () => this.#initializeRenderer(true, generation),
      },
    );
    if (!this.#isInitActive(generation)) return 'unavailable';
    if (this.#runtimeRecoveryTask) await this.#runtimeRecoveryTask;
    if (!this.#isInitActive(generation)) return 'unavailable';
    if (started.instance === null && this.#renderer === null) {
      this.#actual = 'unavailable';
      this.#showUnavailableNotice();
    }

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
    this.#initializingRenderer = renderer;
    let rendererInitialized = false;
    let deviceLost = false;
    let rendererReady = false;
    const onDeviceLost = renderer.onDeviceLost;
    renderer.onDeviceLost = (info) => {
      deviceLost = true;
      onDeviceLost.call(renderer, info);
      if (rendererReady) {
        this.#deviceLossRenderer = renderer;
        this.#scheduleRuntimeDeviceLoss(renderer, generation);
      }
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
      if (this.#deviceLossRenderer === renderer) {
        throw new BackendUnavailableError('Renderer context was lost while initializing the backend.');
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
      this.#createPipeline(this.#config.simulation.particleCount, this.#config);
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
      if (this.#deviceLossRenderer === renderer) {
        throw new BackendUnavailableError('Renderer context was lost while initializing the particle pipeline.');
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
      if (this.#deviceLossRenderer === renderer) {
        throw new BackendUnavailableError('Renderer context was lost while starting its animation loop.');
      }
      if (!this.#isInitActive(generation)) {
        throw new BackendUnavailableError('Renderer initialization was cancelled.');
      }
      if (deviceLost) {
        throw new BackendUnavailableError('Renderer device was lost before initialization completed.');
      }
      rendererReady = true;
      this.#readyRenderer = renderer;
      this.#initializingRenderer = null;
      this.#deviceLossRenderer = null;
      return { actual, instance: renderer };
    } catch (error) {
      if (this.#initializingRenderer === renderer) this.#initializingRenderer = null;
      if (this.#readyRenderer === renderer) this.#readyRenderer = null;
      if (this.#renderer === renderer) this.#clearRendererState();
      await this.#disposeRenderer(renderer, rendererInitialized);
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
    const measurementGeneration = this.#measurementGeneration;
    const sampledAt = sampleGpuTime ? performance.now() : null;
    const submittedFrame = sampleGpuTime && this.#gpuTimingSupported ? renderer.info.frame : null;
    let task: Promise<unknown> | undefined;
    try {
      task = run();
    } catch {
      this.#handleComputeFailure(renderer);
      return false;
    }
    if (task) {
      void task.then(() => {
        if (sampleGpuTime && sampledAt !== null && submittedFrame !== null) {
          this.#resolveGpuTime(renderer, measurementGeneration, sampledAt, submittedFrame);
        }
      }).catch(() => this.#handleComputeFailure(renderer));
    } else if (sampleGpuTime && sampledAt !== null && submittedFrame !== null) {
      // Three r186's initialized compute() submits synchronously and returns
      // undefined; resolve its timestamp query after that submission too.
      this.#resolveGpuTime(renderer, measurementGeneration, sampledAt, submittedFrame);
    }
    return this.#renderer === renderer && !this.#disposed;
  }

  #resolveGpuTime(
    renderer: WebGPURenderer,
    measurementGeneration: number,
    sampledAt: number,
    submittedFrame: number,
  ): void {
    if (!this.#gpuTimingSupported
      || this.#gpuTimingInFlight
      || !this.#running
      || measurementGeneration !== this.#measurementGeneration
      || this.#renderer !== renderer
      || this.#disposed) return;
    this.#gpuTimingInFlight = true;
    const requestId = ++this.#gpuTimingRequestId;
    void resolveFreshComputeTime(renderer, submittedFrame)
      .then((durationMs) => {
        if (this.#renderer !== renderer || this.#disposed || !this.#running
          || measurementGeneration !== this.#measurementGeneration) return;
        if (durationMs !== undefined && durationMs !== null && Number.isFinite(durationMs) && durationMs > 0) {
          this.#gpuTimeMs = durationMs;
          this.#gpuTimingAvailable = true;
          // Age starts when the measured compute was submitted, not when the
          // asynchronous timestamp readback happens to finish.
          this.#gpuTimeSampledAt = sampledAt;
        } else {
          this.#gpuTimeMs = null;
          this.#gpuTimingAvailable = false;
          this.#gpuTimeSampledAt = null;
        }
      })
      .catch(() => {
        if (this.#renderer !== renderer || this.#disposed || !this.#running
          || measurementGeneration !== this.#measurementGeneration) return;
        this.#gpuTimeMs = null;
        this.#gpuTimingAvailable = false;
        this.#gpuTimeSampledAt = null;
      })
      .finally(() => {
        if (requestId === this.#gpuTimingRequestId) this.#gpuTimingInFlight = false;
      });
  }

  #handleComputeFailure(renderer: WebGPURenderer): void {
    if (this.#disposed || this.#renderer !== renderer || this.#deviceLossRenderer === renderer) return;
    this.#running = false;
    this.#actual = 'unavailable';
    this.#releaseRenderer();
    this.#showUnavailableNotice();
  }

  #scheduleRuntimeDeviceLoss(renderer: WebGPURenderer, generation: number): void {
    if (this.#runtimeRecoveryInFlight) return;
    this.#runtimeRecoveryTask = this.#handleRuntimeDeviceLoss(renderer, generation).catch((error: unknown) => {
      if (!this.#isInitActive(generation) || (this.#renderer && this.#renderer !== renderer && this.#readyRenderer === this.#renderer)) return;
      this.#runtimeRecoveryInFlight = false;
      this.#actual = 'unavailable';
      this.#running = false;
      if (this.#renderer) this.#releaseRenderer();
      this.#showUnavailableNotice('The renderer device or context was lost and recovery failed.');
      console.error('Runtime renderer recovery failed.', error);
    });
  }

  async #handleRuntimeDeviceLoss(renderer: WebGPURenderer, generation: number): Promise<void> {
    if (this.#disposed || !this.#isInitActive(generation) || this.#renderer !== renderer || this.#runtimeRecoveryInFlight) return;
    this.#runtimeRecoveryInFlight = true;
    const canFallback = this.#actual === 'webgpu' && !this.#runtimeFallbackAttempted;
    if (canFallback) this.#runtimeFallbackAttempted = true;

    this.#running = false;
    this.#actual = 'unavailable';
    this.#clearRendererState();
    await this.#disposeRenderer(renderer);

    if (!this.#isInitActive(generation)) {
      return;
    }

    if (!canFallback) {
      this.#showUnavailableNotice('The renderer device or context was lost. No further backend recovery is available.');
      this.#runtimeRecoveryInFlight = false;
      return;
    }

    try {
      this.#replaceCanvasForRecovery();
      await this.#initializeRenderer(true, generation);
      if (!this.#isInitActive(generation) || this.getStatus().actual !== 'webgl2' || !this.#renderer) return;
      this.#running = this.#runningIntent;
      if (this.#running) {
        this.#lastFrameAt = 0;
        this.#fpsFrames = 0;
        this.#fpsStartedAt = performance.now();
      }
      this.#unavailableNotice?.remove();
      this.#unavailableNotice = null;
    } catch (error) {
      if (!this.#isInitActive(generation) || (this.#renderer && this.#renderer !== renderer && this.#readyRenderer === this.#renderer)) return;
      this.#actual = 'unavailable';
      this.#running = false;
      if (this.#renderer) this.#releaseRenderer();
      this.#showUnavailableNotice('The WebGPU device was lost and WebGL2 recovery failed.');
      console.error('WebGL2 recovery after runtime device loss failed.', error);
    } finally {
      if (this.#isInitActive(generation)) this.#runtimeRecoveryInFlight = false;
    }
  }

  #replaceCanvasForRecovery(): void {
    const previousCanvas = this.#canvas;
    const parent = previousCanvas.parentElement;
    if (!parent) {
      throw new BackendUnavailableError('Cannot recover the renderer without an attached canvas host.');
    }

    const replacement = previousCanvas.cloneNode(true) as HTMLCanvasElement;
    previousCanvas.removeEventListener('webglcontextlost', this.#onWebGLContextLost);
    previousCanvas.replaceWith(replacement);
    this.#canvas = replacement;
    replacement.addEventListener('webglcontextlost', this.#onWebGLContextLost);
  }

  applyConfig(config: Readonly<LabConfig>): void {
    const countChanged = config.simulation.particleCount !== this.#config.simulation.particleCount;
    const modeChanged = config.mode !== this.#config.mode;
    const renderer = this.#renderer;

    if (countChanged && renderer) this.#createPipeline(config.simulation.particleCount, config);
    const distanceChanged = config.camera.distance !== this.#config.camera.distance;
    this.#config = cloneConfig(config);
    this.#updateUniforms();
    this.#updateAppearance(config, distanceChanged);

    if (renderer && countChanged && this.#buffers) {
      this.#watchCompute(() => renderer.compute(this.#buffers!.initKernel), renderer);
    } else if (renderer && modeChanged) {
      this.#selectComputeKernel();
    }
  }
  start(): void {
    if (this.#disposed) return;
    if (this.#runtimeRecoveryInFlight) {
      this.#runningIntent = true;
      return;
    }
    if (this.#actual === 'unavailable') return;
    this.#runningIntent = true;
    this.#running = true;
    this.#lastFrameAt = 0;
    this.#fpsFrames = 0;
    this.#fpsStartedAt = performance.now();
  }

  pause(): void {
    this.#runningIntent = false;
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
    this.#runningIntent = false;
    this.#canvas.removeEventListener('webglcontextlost', this.#onWebGLContextLost);
    this.#releaseRenderer();
    this.#unavailableNotice?.remove();
    this.#unavailableNotice = null;
  }

  #createScene(): void {
    const renderer = this.#renderer;
    if (!renderer) return;

    const scene = new Scene();
    const camera = new PerspectiveCamera(55, this.#target.width / this.#target.height, 0.1, 200);
    camera.position.set(0, 0, this.#config.camera.distance);
    camera.lookAt(new Vector3(0, 0, 0));
    this.#scene = scene;
    this.#camera = camera;
    this.#controlsRoot = this.#canvas.getRootNode();
    this.#controls = new OrbitControls(camera, this.#canvas);
    this.#controls.minDistance = 5;
    this.#controls.maxDistance = 500;
    this.#updateAppearance(this.#config, true);
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
        color: config.rendering.particleColor,
        size: config.simulation.particleSize,
        opacity: config.rendering.opacity,
        transparent: config.rendering.opacity < 1 || config.rendering.additiveBlend,
        blending: config.rendering.additiveBlend ? AdditiveBlending : NormalBlending,
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
    uniforms.spawnRadius.value = config.simulation.spawnRadius;
    uniforms.lifetime.value = config.simulation.lifetime;
    uniforms.delta.value = 0;
    // Only the active group's values reach the running kernel. Inactive groups
    // remain in the config snapshot for the next mode switch and preset export.
    if (config.mode === 'attractor') {
      uniforms.strength.value = config.modes.attractor.attractorStrength;
      uniforms.radius.value = config.modes.attractor.attractorRadius;
      uniforms.damping.value = config.modes.attractor.attractorDamping;
    } else {
      uniforms.strength.value = config.modes.vortex.vortexStrength;
      uniforms.vortexDamping.value = config.modes.vortex.vortexDamping;
    }
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
        buffers.uniforms.delta.value = delta * this.#config.simulation.speed;
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

    const controlsDelta = this.#lastFrameAt === 0 ? 0 : Math.min(MAX_FRAME_DELTA, Math.max(0, (time - this.#lastFrameAt) / 1000));
    this.#controls?.update(controlsDelta);
    this.#lastFrameAt = time;
    renderer.render(scene, camera);
  };

  #updateAppearance(config: Readonly<LabConfig>, distanceChanged: boolean): void {
    const { rendering, camera, simulation } = config;
    if (this.#scene) this.#scene.background = new Color(rendering.backgroundColor);
    const material = this.#material;
    if (material) {
      material.color.set(rendering.particleColor);
      material.size = simulation.particleSize;
      material.opacity = rendering.opacity;
      const transparent = rendering.opacity < 1 || rendering.additiveBlend;
      const blending = rendering.additiveBlend ? AdditiveBlending : NormalBlending;
      if (material.transparent !== transparent || material.blending !== blending) {
        material.transparent = transparent;
        material.blending = blending;
        material.needsUpdate = true;
      }
    }
    const controls = this.#controls;
    const view = this.#camera;
    if (!controls || !view) return;
    controls.enabled = camera.enabled;
    controls.autoRotate = camera.enabled && camera.autoRotate;
    if (distanceChanged) {
      const direction = view.position.clone().sub(controls.target);
      if (direction.lengthSq() === 0) direction.set(0, 0, 1);
      view.position.copy(controls.target).add(direction.normalize().multiplyScalar(camera.distance));
    }
    // Reserve clipping space for the entire allowed orbit/zoom range, not just
    // the imported distance, so wheel zoom cannot move the camera past far.
    view.far = 500 + 2 * Math.max(simulation.spawnRadius, config.mode === 'attractor' ? config.modes.attractor.attractorRadius : 0);
    view.updateProjectionMatrix();
    controls.update(0);
  }

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
    this.#clearRendererState();
  }

  #clearRendererState(): void {
    const controls = this.#controls;
    controls?.dispose();
    if (controls && this.#controlsRoot) {
      // Three r186.1 disconnect() recomputes canvas.getRootNode(). A session
      // commit detaches the previous canvas before disposing its adapter, so
      // that root is no longer the Document used by connect(). Remove both
      // bound interceptors from the captured registration root as well.
      const interceptors = controls as OrbitControls & {
        _interceptControlDown: EventListener;
        _interceptControlUp: EventListener;
      };
      this.#controlsRoot.removeEventListener('keydown', interceptors._interceptControlDown, { capture: true });
      this.#controlsRoot.removeEventListener('keyup', interceptors._interceptControlUp, { capture: true });
    }
    this.#controls = null;
    this.#controlsRoot = null;
    this.#geometryAndMaterialDispose();
    this.#renderer = null;
    this.#readyRenderer = null;
    this.#initializingRenderer = null;
    this.#deviceLossRenderer = null;
    this.#scene = null;
    this.#camera = null;
    this.#buffers = null;
    this.#computeKernel = null;
    this.#gpuTimingSupported = false;
    this.#clearGpuTiming();
    this.#computeFrames = 0;
    this.#fps = 0;
    this.#fpsFrames = 0;
    this.#fpsStartedAt = 0;
    this.#lastFrameAt = 0;
  }

  #clearGpuTiming(): void {
    this.#measurementGeneration += 1;
    this.#gpuTimingRequestId += 1;
    this.#gpuTimingAvailable = false;
    this.#gpuTimingInFlight = false;
    this.#gpuTimeMs = null;
    this.#gpuTimeSampledAt = null;
  }

  #showUnavailableNotice(message = 'No supported renderer could be initialized in this browser.'): void {
    const notice = document.createElement('div');
    notice.className = 'renderer-unavailable';
    notice.setAttribute('role', 'status');
    notice.textContent = message;
    this.#canvas.insertAdjacentElement('afterend', notice);
    this.#unavailableNotice = notice;
  }
}
