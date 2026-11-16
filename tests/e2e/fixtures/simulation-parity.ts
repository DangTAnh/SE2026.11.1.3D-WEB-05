/**
 * Real GPU readback harness for #50, extended for #96.
 *
 * The harness initializes the shared particle buffers on the GPU, reads the
 * initial state back, then steps the GPU kernel and the CPU reference from that
 * *same* state. It never claims parity from a node-graph test or a FakeRenderer.
 *
 * #96 adds explicit attractor radius/damping and speed inputs, mirrors the
 * adapter's `delta = clamp(rawDt) * speed` mapping exactly once on both sides,
 * and adds a CPU control run that proves the damping branch is conditional.
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
import type { SimulationConfig, SimulationMode } from '../../../src/simulations/shared/attributes.ts';
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

/**
 * Preset schema v2 bounds, quoted here because the fixture bypasses the preset
 * parser and must still reject values the product never sends to a kernel.
 */
const SPEED_RANGE = { min: 0.1, max: 3 } as const;
const ATTRACTOR_RADIUS_RANGE = { min: 0.5, max: 50 } as const;
const ATTRACTOR_DAMPING_RANGE = { min: 0.8, max: 1 } as const;

/**
 * Mirrors `MAX_FRAME_DELTA` in `src/simulations/rendererAdapter.ts`. The adapter
 * clamps the raw frame delta before multiplying by speed; the harness must use
 * the same effective delta or a non-unit-speed case would not reproduce the
 * production mapping.
 */
const MAX_FRAME_DELTA = 0.05;

/**
 * Non-vacuity floor for the damping control run. Damping 0.8 vs identity must
 * move a primed state by more than float32 rounding (observed pure-step deltas
 * are below 1e-6) or the case does not prove anything.
 */
const DAMPING_EFFECT_EPSILON = 1e-5;

export interface ParityOptions {
  backend: ParityBackend;
  mode: SimulationMode;
  count?: number;
  steps?: number;
  /** Raw frame delta; the harness clamps it to [0, MAX_FRAME_DELTA] like the adapter. */
  dt?: number;
  lifetime?: number;
  spawnRadius?: number;
  strength?: number;
  /** Attractor damping threshold; schema v2 range [0.5, 50]. */
  attractorRadius?: number;
  /** Attractor damping factor outside the radius; schema v2 range [0.8, 1]. */
  attractorDamping?: number;
  /** Global time multiplier; schema v2 range [0.1, 3]. Applied once to clamped dt. */
  speed?: number;
  vortexDamping?: number;
  /** Absolute tolerance per channel; defaults are tight enough for a pure step. */
  tolerance?: { position?: number; velocity?: number; age?: number };
  /**
   * Test-only initial state injected after the init kernel, used to make the
   * zero-delta and damping cases non-vacuous. The harness re-reads and asserts
   * the values reached the GPU before stepping.
   */
  prime?: {
    age?: number;
    position?: readonly [number, number, number];
    velocity?: readonly [number, number, number];
  };
  /**
   * Attractor non-vacuity assertion, evaluated on deterministic CPU runs from
   * the primed state with the same clamped dt:
   * - `changes-result`: every particle starts outside the radius and damping
   *   < 1 must produce a different final state than identity damping;
   * - `no-effect`: every particle starts inside the radius and damping < 1 must
   *   produce the exact same final state as identity damping.
   */
  expectDamping?: 'changes-result' | 'no-effect';
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
  attractorRadius: number;
  attractorDamping: number;
  speed: number;
  vortexDamping: number;
  tolerance: { position: number; velocity: number; age: number };
  prime: NonNullable<ParityOptions['prime']> | null;
  expectDamping: 'changes-result' | 'no-effect' | null;
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
  count: number;
  steps: number;
  /** Raw frame delta supplied by the case. */
  dt: number;
  /** `clamp(dt, 0, MAX_FRAME_DELTA) * speed`, applied exactly once on both sides. */
  effectiveDelta: number;
  lifetime: number;
  spawnRadius: number;
  strength: number;
  speed: number;
  attractorRadius: number;
  attractorDamping: number;
  vortexDamping: number;
  tolerance: { position: number; velocity: number; age: number };
  prime: NonNullable<ParityOptions['prime']> | null;
  expectDamping: 'changes-result' | 'no-effect' | null;
  /** Max CPU position/velocity difference between the case and identity damping. */
  dampingControlDelta: number | null;
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
    attractorRadius: options.attractorRadius ?? DEFAULT_ATTRACTOR_RADIUS,
    attractorDamping: options.attractorDamping ?? DEFAULT_ATTRACTOR_DAMPING,
    speed: options.speed ?? 1,
    vortexDamping: options.vortexDamping ?? 0.97,
    tolerance: {
      position: options.tolerance?.position ?? DEFAULT_TOLERANCE.position,
      velocity: options.tolerance?.velocity ?? DEFAULT_TOLERANCE.velocity,
      age: options.tolerance?.age ?? DEFAULT_TOLERANCE.age,
    },
    prime: options.prime ?? null,
    expectDamping: options.expectDamping ?? null,
    fault: options.fault ?? null,
  };
}

function validateRange(
  name: string,
  value: number,
  range: { readonly min: number; readonly max: number },
): string | null {
  if (!Number.isFinite(value) || value < range.min || value > range.max) {
    return `${name} must be a finite number in [${range.min}, ${range.max}], received ${value}`;
  }
  return null;
}

/**
 * Validate the #96 inputs before any GPU work. An invalid parameter must not
 * become a skipped backend case; it is a failed case with an explicit reason.
 */
function validateOptions(options: ResolvedParityOptions): string | null {
  return validateRange('attractorRadius', options.attractorRadius, ATTRACTOR_RADIUS_RANGE)
    ?? validateRange('attractorDamping', options.attractorDamping, ATTRACTOR_DAMPING_RANGE)
    ?? validateRange('speed', options.speed, SPEED_RANGE)
    ?? (!Number.isFinite(options.dt) || options.dt < 0
      ? `dt must be a finite non-negative number, received ${options.dt}`
      : null)
    ?? (options.expectDamping !== null && options.mode !== 'attractor'
      ? 'expectDamping only applies to attractor mode'
      : null);
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
    count: options.count,
    steps: options.steps,
    dt: options.dt,
    effectiveDelta: Math.min(MAX_FRAME_DELTA, Math.max(0, options.dt)) * options.speed,
    lifetime: options.lifetime,
    spawnRadius: options.spawnRadius,
    strength: options.strength,
    speed: options.speed,
    attractorRadius: options.attractorRadius,
    attractorDamping: options.attractorDamping,
    vortexDamping: options.vortexDamping,
    tolerance: options.tolerance,
    prime: options.prime,
    expectDamping: options.expectDamping,
    dampingControlDelta: null,
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
  const { ages, positions, velocities, count } = system;
  const ageValue = uniform(prime.age ?? 0);
  const px = uniform(prime.position?.[0] ?? 0);
  const py = uniform(prime.position?.[1] ?? 0);
  const pz = uniform(prime.position?.[2] ?? 0);
  const vx = uniform(prime.velocity?.[0] ?? 0);
  const vy = uniform(prime.velocity?.[1] ?? 0);
  const vz = uniform(prime.velocity?.[2] ?? 0);

  return Fn(() => {
    if (prime.age !== undefined) {
      ages.element(instanceIndex).assign(ageValue);
    }
    if (prime.position !== undefined) {
      positions.element(instanceIndex).assign(vec3(px, py, pz));
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
  if (prime.position !== undefined) {
    for (let i = 0; i < count; i += 1) {
      cpuState.positions.set(prime.position, i * 3);
    }
  }
  if (prime.velocity !== undefined) {
    for (let i = 0; i < count; i += 1) {
      cpuState.velocities.set(prime.velocity, i * 3);
    }
  }
}

/** Reject a zero-delta case that cannot distinguish a guarded step from a no-op. */
function assertNonVacuousZeroDelta(
  options: ResolvedParityOptions,
  state: ReadbackState,
): void {
  const { count, lifetime, attractorRadius, mode } = options;
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
      ) > attractorRadius
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

/**
 * Make the #96 damping polarity deterministic. The primed state is uniform, so
 * `changes-result` requires every particle outside the radius with a nonzero
 * velocity, and `no-effect` requires every particle inside it.
 */
function assertDampingPolarity(
  options: ResolvedParityOptions,
  state: ReadbackState,
): void {
  const { expectDamping, mode, attractorRadius, attractorDamping, count } = options;
  if (expectDamping === null) return;
  if (mode !== 'attractor') {
    throw new ParityValidationError('expectDamping only applies to attractor mode');
  }
  if (attractorDamping >= 1) {
    throw new ParityValidationError('expectDamping requires attractorDamping < 1');
  }

  let minDistance = Number.POSITIVE_INFINITY;
  let maxDistance = 0;
  let nonzeroVelocity = false;
  for (let i = 0; i < count; i += 1) {
    const offset = i * 3;
    const distance = Math.hypot(
      state.positions[offset]!,
      state.positions[offset + 1]!,
      state.positions[offset + 2]!,
    );
    minDistance = Math.min(minDistance, distance);
    maxDistance = Math.max(maxDistance, distance);
    if (
      state.velocities[offset] !== 0
      || state.velocities[offset + 1] !== 0
      || state.velocities[offset + 2] !== 0
    ) {
      nonzeroVelocity = true;
    }
  }

  if (expectDamping === 'changes-result') {
    if (minDistance <= attractorRadius) {
      throw new ParityValidationError(
        `damping case is vacuous: particle at distance ${minDistance} is not outside radius ${attractorRadius}`,
      );
    }
    if (!nonzeroVelocity) {
      throw new ParityValidationError('damping case is vacuous: every velocity is zero');
    }
  } else if (maxDistance > attractorRadius) {
    throw new ParityValidationError(
      `conditional-damping case is vacuous: particle at distance ${maxDistance} is outside radius ${attractorRadius}`,
    );
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
    attractorRadius, attractorDamping, speed, vortexDamping, tolerance, prime,
    expectDamping, fault,
  } = options;

  const invalid = validateOptions(options);
  if (invalid !== null) {
    // Parameter errors fail explicitly; they never become a backend skip.
    return result(options, 'failed', invalid, null, null, null);
  }

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
    system.uniforms.radius.value = attractorRadius;
    system.uniforms.damping.value = attractorDamping;
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
      assertNonVacuousZeroDelta(options, cpuState);
    }
    assertDampingPolarity(options, cpuState);

    // CPU control for #96: the same primed state with identity damping. A
    // positive-delta case outside the radius must differ; an inside-radius case
    // must be bit-identical, proving damping is conditional.
    const dampingControlState: CpuState | null = expectDamping === null ? null : {
      count,
      positions: cpuState.positions.slice(),
      velocities: cpuState.velocities.slice(),
      ages: cpuState.ages.slice(),
      seeds: cpuState.seeds.slice(),
    };

    const config: SimulationConfig = {
      mode,
      particleCount: count,
      speed,
      strength,
      spawnRadius,
      lifetime,
      attractorRadius,
      attractorDamping,
      vortexDamping,
    };
    const kernel = mode === 'attractor' ? createAttractorKernel(system) : createVortexKernel(system);

    // Match the adapter: clamp the raw frame delta, then multiply by speed
    // exactly once. The CPU reference receives the clamped dt and performs its
    // own single `dt * speed` inside `step()`.
    const clampedDt = Math.min(MAX_FRAME_DELTA, Math.max(0, dt));
    const effectiveDelta = clampedDt * speed;

    for (let i = 0; i < steps; i += 1) {
      system.uniforms.delta.value = effectiveDelta;
      await renderer.compute(kernel);
      if (deviceLost) return skipped(options, `${backend} unavailable: device lost during step ${i + 1}`);
      step(cpuState, clampedDt, config);
    }

    let dampingControlDelta: number | null = null;
    if (dampingControlState !== null) {
      const identityConfig: SimulationConfig = { ...config, attractorDamping: 1 };
      for (let i = 0; i < steps; i += 1) {
        step(dampingControlState, clampedDt, identityConfig);
      }
      const controlPositionDelta = maxDelta(
        'positions',
        cpuState.positions,
        dampingControlState.positions,
      );
      const controlVelocityDelta = maxDelta(
        'velocities',
        cpuState.velocities,
        dampingControlState.velocities,
      );
      dampingControlDelta = Math.max(controlPositionDelta, controlVelocityDelta);
      if (expectDamping === 'changes-result' && dampingControlDelta <= DAMPING_EFFECT_EPSILON) {
        throw new ParityValidationError(
          `damping case is vacuous: damping ${attractorDamping} changed the state by only ${dampingControlDelta}`,
        );
      }
      if (expectDamping === 'no-effect' && dampingControlDelta !== 0) {
        throw new ParityValidationError(
          `conditional-damping case is vacuous: damping ${attractorDamping} inside radius ${attractorRadius} changed the state by ${dampingControlDelta}`,
        );
      }
    }

    const finalState = await readState(renderer, system, count);
    assertSeedsUnchanged(initialState.seeds, finalState.seeds);

    const positionDelta = maxDelta('positions', finalState.positions, cpuState.positions);
    const velocityDelta = maxDelta('velocities', finalState.velocities, cpuState.velocities);
    const ageDelta = maxDelta('ages', finalState.ages, cpuState.ages);
    const passed = positionDelta <= tolerance.position
      && velocityDelta <= tolerance.velocity
      && ageDelta <= tolerance.age;

    const outcome = result(
      options,
      passed ? 'passed' : 'failed',
      passed ? null : `deltas exceed tolerance (${backend}/${mode}, ${steps} steps)`,
      positionDelta,
      velocityDelta,
      ageDelta,
    );
    outcome.dampingControlDelta = dampingControlDelta;
    return outcome;
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

