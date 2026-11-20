/**
 * Shared particle attribute layout and deterministic initial state.
 * The layout is backend-agnostic: the renderer adapter maps these arrays to
 * GPU storage buffers. No DOM and no `three` import belong here.
 */

export type SimulationMode = 'attractor' | 'vortex';

export interface SimulationConfig {
  readonly mode: SimulationMode;
  readonly particleCount: number;
  readonly speed: number;
  readonly strength: number;
  readonly spawnRadius?: number;
  /** Simulation seconds; when `age >= lifetime` the particle respawns. */
  readonly lifetime?: number;
  readonly attractorRadius?: number;
  readonly attractorDamping?: number;
  /**
   * Per-step velocity multiplier for the vortex mode, in `(0, 1]`.
   * Public vortex parameter (preset v2 `modes.vortex.vortexDamping`); the
   * reference step and both adapters share `DEFAULT_VORTEX_DAMPING`.
   */
  readonly vortexDamping?: number;
}

export interface ParticleState {
  readonly count: number;
  readonly positions: Float32Array;
  readonly velocities: Float32Array;
  readonly ages: Float32Array;
  readonly seeds: Uint32Array;
}

/** One shared attribute set for both backends (architecture.md §4). */
export const PARTICLE_ATTRIBUTES = Object.freeze({
  position: { itemSize: 3, array: 'positions' },
  velocity: { itemSize: 3, array: 'velocities' },
  age: { itemSize: 1, array: 'ages' },
  seed: { itemSize: 1, array: 'seeds' },
} as const);

export const DEFAULT_SPAWN_RADIUS = 10;
/** Simulation seconds before a particle respawns. Matches the v2 default. */
export const DEFAULT_LIFETIME = 6;

/**
 * PCG hash used by `three/tsl`'s `hash()` node, reimplemented with exact
 * uint32 arithmetic. CPU respawn must produce the same random sequence as the
 * TSL kernels when both start from the same `seeds` value.
 * @see node_modules/three/src/nodes/math/Hash.js
 */
export function pcgHash(seed: number): number {
  const state = (Math.imul(seed >>> 0, 747796405) + 2891336453) >>> 0;
  const word = Math.imul((state >>> ((state >>> 28) + 4)) ^ state, 277803737) >>> 0;
  const result = ((word >>> 22) ^ word) >>> 0;
  return result / 2 ** 32;
}

/**
 * Deterministic respawn position from a particle seed. Uses the same uniform
 * sphere sampling and hash indices as the TSL respawn branch, so CPU and GPU
 * respawn agree up to float tolerance.
 */
export function spawnPositionFromSeed(
  seed: number,
  spawnRadius = DEFAULT_SPAWN_RADIUS,
): readonly [number, number, number] {
  const u = pcgHash(seed);
  const v = pcgHash(seed + 1);
  const w = pcgHash(seed + 2);
  const z = u * 2 - 1;
  const phi = v * Math.PI * 2;
  const ring = Math.sqrt(1 - z * z);
  const radial = spawnRadius * Math.cbrt(w);
  return [Math.cos(phi) * ring * radial, z * radial, Math.sin(phi) * ring * radial];
}

function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 0x100000000;
  };
}

function assertConfig(config: SimulationConfig): void {
  if (!Number.isInteger(config.particleCount) || config.particleCount < 0) {
    throw new TypeError('particleCount must be a non-negative integer');
  }
  if (!Number.isFinite(config.speed) || config.speed <= 0) {
    throw new TypeError('speed must be a finite positive number');
  }
  if (!Number.isFinite(config.strength) || config.strength < 0) {
    throw new TypeError('strength must be a finite non-negative number');
  }
  if (config.spawnRadius !== undefined && (!Number.isFinite(config.spawnRadius) || config.spawnRadius < 0)) {
    throw new TypeError('spawnRadius must be a finite non-negative number');
  }
  if (config.lifetime !== undefined && (!Number.isFinite(config.lifetime) || config.lifetime <= 0)) {
    throw new TypeError('lifetime must be a finite positive number');
  }
}

/** Deterministic initial state: the same (config, seed) always produces the same arrays. */
export function createState(config: SimulationConfig, seed = 1): ParticleState {
  assertConfig(config);
  const count = config.particleCount;
  const positions = new Float32Array(count * 3);
  const velocities = new Float32Array(count * 3);
  const ages = new Float32Array(count);
  const seeds = new Uint32Array(count);
  const random = mulberry32(seed);
  const spawnRadius = config.spawnRadius ?? DEFAULT_SPAWN_RADIUS;

  for (let i = 0; i < count; i += 1) {
    const theta = random() * Math.PI * 2;
    const z = random() * 2 - 1;
    const ring = Math.sqrt(1 - z * z);
    const radius = spawnRadius * Math.cbrt(random());
    const offset = i * 3;
    positions[offset] = Math.cos(theta) * ring * radius;
    positions[offset + 1] = z * radius;
    positions[offset + 2] = Math.sin(theta) * ring * radius;
    seeds[i] = Math.floor(random() * 0x100000000) >>> 0;
  }

  return { count, positions, velocities, ages, seeds };
}
