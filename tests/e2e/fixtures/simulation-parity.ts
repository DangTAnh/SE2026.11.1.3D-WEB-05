/**
 * Real GPU readback harness for #50.
 *
 * The harness initializes the shared particle buffers on the GPU, reads the
 * initial state back, then steps the GPU kernel and the CPU reference from that
 * *same* state. It never claims parity from a node-graph test or a FakeRenderer.
 *
 * Run from `tests/e2e/simulation-parity.spec.ts`; results are returned as JSON
 * and attached to the Playwright report.
 */
import { WebGPURenderer } from 'three/webgpu';
import {
  DEFAULT_ATTRACTOR_DAMPING,
  DEFAULT_ATTRACTOR_RADIUS,
  step,
} from '../../../src/simulations/simulation.ts';
import type { SimulationMode } from '../../../src/simulations/shared/attributes.ts';
import { createAttractorKernel } from '../../../src/simulations/shared/attractorKernel.ts';
import { createParticleBuffers } from '../../../src/simulations/shared/particleBuffers.ts';
import { createVortexKernel } from '../../../src/simulations/shared/vortexKernel.ts';

export type ParityBackend = 'webgl2' | 'webgpu';

export interface ParityOptions {
  backend: ParityBackend;
  mode: SimulationMode;
  count?: number;
  steps?: number;
  dt?: number;
  lifetime?: number;
  spawnRadius?: number;
  strength?: number;
  vortexDamping?: number;
  /** Absolute tolerance per channel; defaults are tight enough for a pure step. */
  tolerance?: { position?: number; velocity?: number; age?: number };
}

interface ResolvedParityOptions {
  backend: ParityBackend;
  mode: SimulationMode;
  count: number;
  steps: number;
  dt: number;
  lifetime: number;
  spawnRadius: number;
  strength: number;
  vortexDamping: number;
  tolerance: { position: number; velocity: number; age: number };
}

export interface ParityResult {
  status: 'passed' | 'failed' | 'skipped';
  backend: ParityBackend;
  mode: SimulationMode;
  steps: number;
  dt: number;
  lifetime: number;
  spawnRadius: number;
  tolerance: { position: number; velocity: number; age: number };
  maxPositionDelta: number | null;
  maxVelocityDelta: number | null;
  maxAgeDelta: number | null;
  reason: string | null;
}

declare global {
  interface Window {
    parityTest: { run: (options: ParityOptions) => Promise<ParityResult> };
  }
}

const DEFAULT_TOLERANCE = { position: 5e-5, velocity: 5e-5, age: 1e-5 };

function resolveOptions(options: ParityOptions): ResolvedParityOptions {
  return {
    backend: options.backend,
    mode: options.mode,
    count: options.count ?? 64,
    steps: options.steps ?? 40,
    dt: options.dt ?? 1 / 60,
    lifetime: options.lifetime ?? 0.25,
    spawnRadius: options.spawnRadius ?? 4,
    strength: options.strength ?? 1.5,
    vortexDamping: options.vortexDamping ?? 0.97,
    tolerance: {
      position: options.tolerance?.position ?? DEFAULT_TOLERANCE.position,
      velocity: options.tolerance?.velocity ?? DEFAULT_TOLERANCE.velocity,
      age: options.tolerance?.age ?? DEFAULT_TOLERANCE.age,
    },
  };
}

function skipped(options: ResolvedParityOptions, reason: string): ParityResult {
  return result(options, 'skipped', reason, null, null, null);
}

function result(
  options: ResolvedParityOptions,
  status: ParityResult['status'],
  reason: string | null,
  maxPositionDelta: number | null,
  maxVelocityDelta: number | null,
  maxAgeDelta: number | null,
): ParityResult {
  return {
    status,
    backend: options.backend,
    mode: options.mode,
    steps: options.steps,
    dt: options.dt,
    lifetime: options.lifetime,
    spawnRadius: options.spawnRadius,
    tolerance: options.tolerance,
    maxPositionDelta,
    maxVelocityDelta,
    maxAgeDelta,
    reason,
  };
}

function maxDelta(a: Float32Array, b: Float32Array): number {
  let max = 0;
  for (let i = 0; i < a.length; i += 1) {
    max = Math.max(max, Math.abs(a[i]! - b[i]!));
  }
  return max;
}

function gpuUnavailableReason(backend: ParityBackend, error: unknown): string | null {
  const message = error instanceof Error ? error.message : String(error);
  if (
    message.includes('WebGPU adapter')
    || message.includes('Unable to create WebGPU adapter')
    || message.includes('WebGPU is not available')
    || message.includes('device was lost')
    || message.includes('Device lost')
  ) {
    return `${backend} unavailable: ${message}`;
  }
  return null;
}

async function run(rawOptions: ParityOptions): Promise<ParityResult> {
  const options = resolveOptions(rawOptions);
  const { backend, mode, count, steps, dt, lifetime, spawnRadius, strength, vortexDamping, tolerance } = options;

  if (backend === 'webgpu' && typeof navigator === 'undefined') {
    return skipped(options, 'WebGPU unavailable: no navigator');
  }
  if (backend === 'webgpu' && !('gpu' in navigator)) {
    return skipped(options, 'WebGPU unavailable: navigator.gpu is missing');
  }

  const canvas = document.createElement('canvas');
  canvas.width = 16;
  canvas.height = 16;
  document.body.append(canvas);

  let renderer: WebGPURenderer | null = null;
  try {
    const rendererOptions: ConstructorParameters<typeof WebGPURenderer>[0] = {
      canvas,
      antialias: false,
      forceWebGL: backend === 'webgl2',
    };
    if (backend === 'webgl2') {
      const context = canvas.getContext('webgl2', { antialias: false, alpha: false, depth: false });
      if (context === null) return skipped(options, 'WebGL2 unavailable: no WebGL2 context');
      rendererOptions.context = context;
    }

    renderer = new WebGPURenderer(rendererOptions);
    let deviceLost = false;
    const previousOnDeviceLost = renderer.onDeviceLost;
    renderer.onDeviceLost = (info) => {
      deviceLost = true;
      previousOnDeviceLost.call(renderer!, info);
    };
    if (backend === 'webgpu') {
      // Keep WebGPU failures visible instead of silently falling back to WebGL2.
      (renderer as WebGPURenderer & { _getFallback: ((error: unknown) => unknown) | null })._getFallback = null;
    }

    await renderer.init();
    const initializedBackend = (renderer.backend as { isWebGPUBackend?: boolean; isWebGLBackend?: boolean });
    const actual = initializedBackend.isWebGPUBackend === true
      ? 'webgpu'
      : initializedBackend.isWebGLBackend === true ? 'webgl2' : 'unavailable';
    if (actual !== backend) {
      return skipped(options, `requested ${backend} but the renderer initialized ${actual}`);
    }

    const system = createParticleBuffers(count);
    system.uniforms.spawnRadius.value = spawnRadius;
    system.uniforms.lifetime.value = lifetime;
    system.uniforms.strength.value = strength;
    system.uniforms.radius.value = DEFAULT_ATTRACTOR_RADIUS;
    system.uniforms.damping.value = DEFAULT_ATTRACTOR_DAMPING;
    system.uniforms.vortexDamping.value = vortexDamping;

    await renderer.compute(system.initKernel);
    if (deviceLost) return skipped(options, `${backend} unavailable: device lost during init`);

    const initialState = {
      positions: new Float32Array(await renderer.getArrayBufferAsync(system.positions.value)),
      velocities: new Float32Array(await renderer.getArrayBufferAsync(system.velocities.value)),
      ages: new Float32Array(await renderer.getArrayBufferAsync(system.ages.value)),
      seeds: new Uint32Array(await renderer.getArrayBufferAsync(system.seeds.value)),
    };

    const cpuState = {
      count,
      positions: initialState.positions.slice(),
      velocities: initialState.velocities.slice(),
      ages: initialState.ages.slice(),
      seeds: initialState.seeds.slice(),
    };
    const config = {
      mode,
      particleCount: count,
      speed: 1,
      strength,
      spawnRadius,
      lifetime,
      attractorRadius: DEFAULT_ATTRACTOR_RADIUS,
      attractorDamping: DEFAULT_ATTRACTOR_DAMPING,
      vortexDamping,
    } as const;
    const kernel = mode === 'attractor' ? createAttractorKernel(system) : createVortexKernel(system);

    for (let i = 0; i < steps; i += 1) {
      system.uniforms.delta.value = dt;
      await renderer.compute(kernel);
      if (deviceLost) return skipped(options, `${backend} unavailable: device lost during step ${i + 1}`);
      step(cpuState, dt, config);
    }

    const finalState = {
      positions: new Float32Array(await renderer.getArrayBufferAsync(system.positions.value)),
      velocities: new Float32Array(await renderer.getArrayBufferAsync(system.velocities.value)),
      ages: new Float32Array(await renderer.getArrayBufferAsync(system.ages.value)),
    };

    const positionDelta = maxDelta(finalState.positions, cpuState.positions);
    const velocityDelta = maxDelta(finalState.velocities, cpuState.velocities);
    const ageDelta = maxDelta(finalState.ages, cpuState.ages);
    const passed = positionDelta <= tolerance.position
      && velocityDelta <= tolerance.velocity
      && ageDelta <= tolerance.age;

    return result(
      options,
      passed ? 'passed' : 'failed',
      passed ? null : `deltas exceed tolerance (${backend}/${mode}, ${steps} steps)`,
      positionDelta,
      velocityDelta,
      ageDelta,
    );
  } catch (error) {
    const unavailable = gpuUnavailableReason(backend, error);
    if (unavailable !== null) return skipped(options, unavailable);
    const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
    return result(options, 'failed', message, null, null, null);
  } finally {
    if (renderer !== null) {
      try {
        await renderer.dispose();
      } catch {
        // Readback already finished; cleanup errors must not rewrite the result.
      }
    }
    canvas.remove();
  }
}

window.parityTest = { run };

