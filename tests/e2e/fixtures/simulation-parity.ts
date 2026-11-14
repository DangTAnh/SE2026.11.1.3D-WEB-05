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
import { Fn, instanceIndex, uniform, vec3 } from 'three/tsl';
import { WebGPURenderer } from 'three/webgpu';
import {
  DEFAULT_ATTRACTOR_DAMPING,
  DEFAULT_ATTRACTOR_RADIUS,
  step,
} from '../../../src/simulations/simulation.ts';
import type { SimulationMode } from '../../../src/simulations/shared/attributes.ts';
import { createAttractorKernel } from '../../../src/simulations/shared/attractorKernel.ts';
import { createParticleBuffers, type ParticleBuffers } from '../../../src/simulations/shared/particleBuffers.ts';
import { createVortexKernel } from '../../../src/simulations/shared/vortexKernel.ts';
import {
  assertSeedsUnchanged,
  maxDelta,
  ParityValidationError,
  validateScalarReadback,
  validateVec3Readback,
} from './parityValidation.ts';

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
  /**
   * Test-only initial state injected after the init kernel, used to make the
   * zero-delta case non-vacuous. The harness re-reads and asserts the values
   * reached the GPU before stepping.
   */
  prime?: { age?: number; velocity?: readonly [number, number, number] };
  /** Test-only readback corruption, used to prove validation rejects it. */
  fault?: 'empty' | 'truncated' | 'nan';
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
  prime: { age?: number; velocity?: readonly [number, number, number] } | null;
  fault: 'empty' | 'truncated' | 'nan' | null;
}

interface ReadbackState {
  positions: Float32Array;
  velocities: Float32Array;
  ages: Float32Array;
  seeds: Uint32Array;
}

interface CpuState extends ReadbackState {
  count: number;
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
    prime: options.prime ?? null,
    fault: options.fault ?? null,
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

/**
 * Read one channel back and unpack it using the layout the backend actually
 * allocated. `itemSize` is 3 for packed WebGL2 vec3 storage and 4 for the
 * per-particle vec4 padding Three applies on WebGPU, so the harness must not
 * assume `count * 3` floats.
 */
async function readState(
  renderer: WebGPURenderer,
  system: ParticleBuffers,
  count: number,
): Promise<ReadbackState> {
  const positions = validateVec3Readback(
    'positions',
    new Float32Array(await renderer.getArrayBufferAsync(system.positions.value)),
    count,
    system.positions.value.itemSize,
  );
  const velocities = validateVec3Readback(
    'velocities',
    new Float32Array(await renderer.getArrayBufferAsync(system.velocities.value)),
    count,
    system.velocities.value.itemSize,
  );
  const ages = validateScalarReadback(
    'ages',
    new Float32Array(await renderer.getArrayBufferAsync(system.ages.value)),
    count,
  );
  const seeds = validateScalarReadback(
    'seeds',
    new Uint32Array(await renderer.getArrayBufferAsync(system.seeds.value)),
    count,
  );
  return { positions, velocities, ages, seeds };
}

/**
 * Test-only readback corruption. The wrapper is installed on the renderer, so
 * it exercises the same validation path as a real backend returning a bad
 * buffer.
 */
function installFaultInjection(
  renderer: WebGPURenderer,
  fault: NonNullable<ResolvedParityOptions['fault']>,
): void {
  const original = renderer.getArrayBufferAsync.bind(renderer) as (
    attribute: unknown,
    target?: unknown,
    offset?: number,
    count?: number,
  ) => Promise<ArrayBuffer>;

  const faulted = async (
    attribute: unknown,
    target?: unknown,
    offset?: number,
    count?: number,
  ): Promise<ArrayBuffer> => {
    const buffer = await original(attribute, target, offset, count);
    if (fault === 'empty') return new ArrayBuffer(0);
    if (fault === 'truncated') return buffer.slice(0, Math.max(0, buffer.byteLength - 4));
    const floats = new Float32Array(buffer.slice(0));
    if (floats.length === 0) return new ArrayBuffer(0);
    floats[0] = Number.NaN;
    return floats.buffer;
  };

  (renderer as unknown as { getArrayBufferAsync: typeof faulted }).getArrayBufferAsync = faulted;
}

/**
 * Test-only GPU kernel that writes the primed state. Uploading a storage
 * buffer by mutating `.array` is backend-dependent; a compute kernel is the
 * same path the simulation itself uses, so the harness cannot prime only the
 * CPU copy by accident.
 */
function createPrimeKernel(
  system: ParticleBuffers,
  prime: NonNullable<ResolvedParityOptions['prime']>,
) {
  const { ages, velocities, count } = system;
  const ageValue = uniform(prime.age ?? 0);
  const vx = uniform(prime.velocity?.[0] ?? 0);
  const vy = uniform(prime.velocity?.[1] ?? 0);
  const vz = uniform(prime.velocity?.[2] ?? 0);

  return Fn(() => {
    if (prime.age !== undefined) {
      ages.element(instanceIndex).assign(ageValue);
    }
    if (prime.velocity !== undefined) {
      velocities.element(instanceIndex).assign(vec3(vx, vy, vz));
    }
  })().compute(count);
}

/** Apply the same prime values to the CPU reference state. */
function primeCpuState(
  cpuState: CpuState,
  prime: NonNullable<ResolvedParityOptions['prime']>,
): void {
  const { count } = cpuState;
  if (prime.age !== undefined) {
    cpuState.ages.fill(prime.age, 0, count);
  }
  if (prime.velocity !== undefined) {
    for (let i = 0; i < count; i += 1) {
      cpuState.velocities.set(prime.velocity, i * 3);
    }
  }
}

/** Reject a zero-delta case that cannot distinguish a guarded step from a no-op. */
function assertNonVacuousZeroDelta(
  mode: SimulationMode,
  state: ReadbackState,
  count: number,
  lifetime: number,
  radius: number,
): void {
  let nonzeroVelocity = false;
  let expired = false;
  let outside = false;

  for (let i = 0; i < count; i += 1) {
    const offset = i * 3;
    if (
      state.velocities[offset] !== 0
      || state.velocities[offset + 1] !== 0
      || state.velocities[offset + 2] !== 0
    ) {
      nonzeroVelocity = true;
    }
    if (state.ages[i]! >= lifetime) expired = true;
    if (
      Math.hypot(
        state.positions[offset]!,
        state.positions[offset + 1]!,
        state.positions[offset + 2]!,
      ) > radius
    ) {
      outside = true;
    }
  }

  if (!nonzeroVelocity) {
    throw new ParityValidationError('zero-delta case is vacuous: every velocity is zero');
  }
  if (!expired) {
    throw new ParityValidationError('zero-delta case is vacuous: no particle is at or past lifetime');
  }
  if (mode === 'attractor' && !outside) {
    throw new ParityValidationError('zero-delta attractor case is vacuous: no particle is outside radius');
  }
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
  const {
    backend, mode, count, steps, dt, lifetime, spawnRadius, strength,
    vortexDamping, tolerance, prime, fault,
  } = options;

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

    if (fault !== null) installFaultInjection(renderer, fault);

    const system = createParticleBuffers(count);
    system.uniforms.spawnRadius.value = spawnRadius;
    system.uniforms.lifetime.value = lifetime;
    system.uniforms.strength.value = strength;
    system.uniforms.radius.value = DEFAULT_ATTRACTOR_RADIUS;
    system.uniforms.damping.value = DEFAULT_ATTRACTOR_DAMPING;
    system.uniforms.vortexDamping.value = vortexDamping;

    await renderer.compute(system.initKernel);
    if (deviceLost) return skipped(options, `${backend} unavailable: device lost during init`);

    const initialState = await readState(renderer, system, count);

    const cpuState: CpuState = {
      count,
      positions: initialState.positions.slice(),
      velocities: initialState.velocities.slice(),
      ages: initialState.ages.slice(),
      seeds: initialState.seeds.slice(),
    };

    if (prime !== null) {
      primeCpuState(cpuState, prime);
      await renderer.compute(createPrimeKernel(system, prime));
      if (deviceLost) return skipped(options, `${backend} unavailable: device lost during prime`);
    }
    if (dt === 0) {
      assertNonVacuousZeroDelta(mode, cpuState, count, lifetime, DEFAULT_ATTRACTOR_RADIUS);
    }

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

    const finalState = await readState(renderer, system, count);
    assertSeedsUnchanged(initialState.seeds, finalState.seeds);

    const positionDelta = maxDelta('positions', finalState.positions, cpuState.positions);
    const velocityDelta = maxDelta('velocities', finalState.velocities, cpuState.velocities);
    const ageDelta = maxDelta('ages', finalState.ages, cpuState.ages);
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

