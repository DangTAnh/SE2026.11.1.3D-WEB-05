import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import {
  createState,
  DEFAULT_LIFETIME,
  DEFAULT_SPAWN_RADIUS,
  PARTICLE_ATTRIBUTES,
  pcgHash,
  spawnPositionFromSeed,
  type ParticleState,
  type SimulationConfig,
} from '../../src/simulations/shared/attributes.ts';
import {
  DEFAULT_VORTEX_DAMPING,
  resolveLifetime,
  resolveVortexDamping,
  step,
} from '../../src/simulations/simulation.ts';

const config: SimulationConfig = {
  mode: 'attractor',
  particleCount: 64,
  speed: 1.25,
  strength: 2,
  spawnRadius: 5,
  attractorRadius: 3,
  attractorDamping: 0.98,
};

const snapshot = (state: ParticleState) => ({
  positions: Array.from(state.positions),
  velocities: Array.from(state.velocities),
  ages: Array.from(state.ages),
  seeds: Array.from(state.seeds),
});

test('layout exposes one shared attribute set for both backends', () => {
  expect(PARTICLE_ATTRIBUTES.position.itemSize).toBe(3);
  expect(PARTICLE_ATTRIBUTES.velocity.itemSize).toBe(3);
  expect(PARTICLE_ATTRIBUTES.age.itemSize).toBe(1);
  expect(PARTICLE_ATTRIBUTES.seed.itemSize).toBe(1);
  expect(PARTICLE_ATTRIBUTES.position.array).toBe('positions');
});

test('same config and seed produce identical initial state', () => {
  expect(snapshot(createState(config, 42))).toEqual(snapshot(createState(config, 42)));
  expect(snapshot(createState(config, 42))).not.toEqual(snapshot(createState(config, 43)));
});

test('step is deterministic and advances age by dt * speed', () => {
  const first = createState(config, 7);
  const second = createState(config, 7);

  for (let i = 0; i < 10; i += 1) {
    step(first, 0.1, config);
    step(second, 0.1, config);
  }

  expect(snapshot(first)).toEqual(snapshot(second));
  expect(first.ages[0]).toBeCloseTo(1.25, 5);
});

test('zero delta is a no-op even when velocity would otherwise be damped', () => {
  for (const mode of ['attractor', 'vortex'] as const) {
    const modeConfig = { ...config, mode };
    const state = createState(modeConfig, 9);
    state.positions.set([10, 0, 0], 0);
    state.velocities.set([1, 0, 0], 0);
    const before = snapshot(state);

    step(state, 0, modeConfig);

    expect(snapshot(state)).toEqual(before);
  }
});

test('both modes stay finite, including a particle at the origin', () => {
  for (const mode of ['attractor', 'vortex'] as const) {
    const state = createState({ ...config, mode }, 3);
    state.positions[0] = 0;
    state.positions[1] = 0;
    state.positions[2] = 0;

    for (let i = 0; i < 120; i += 1) step(state, 1 / 60, { ...config, mode });

    expect(Array.from(state.positions).every(Number.isFinite)).toBe(true);
    expect(Array.from(state.velocities).every(Number.isFinite)).toBe(true);
    expect(Array.from(state.ages).every(Number.isFinite)).toBe(true);
  }
});

test('attractor and vortex diverge after the same number of steps', () => {
  const attractor = createState(config, 11);
  const vortex = createState({ ...config, mode: 'vortex' }, 11);

  for (let i = 0; i < 20; i += 1) {
    step(attractor, 1 / 60, config);
    step(vortex, 1 / 60, { ...config, mode: 'vortex' });
  }

  expect(snapshot(attractor).positions).not.toEqual(snapshot(vortex).positions);
});

test('invalid input is rejected at the state boundary', () => {
  expect(() => createState({ ...config, particleCount: 1.5 })).toThrow(TypeError);
  expect(() => createState({ ...config, speed: 0 })).toThrow(TypeError);
  expect(() => step(createState(config), Number.NaN, config)).toThrow(TypeError);
  expect(() => step(createState(config), -1, config)).toThrow(TypeError);
});

test('step actually moves particles in both modes', () => {
  for (const mode of ['attractor', 'vortex'] as const) {
    const modeConfig = { ...config, mode };
    const state = createState(modeConfig, 11);
    const before = Array.from(state.positions);
    for (let i = 0; i < 30; i += 1) step(state, 1 / 60, modeConfig);
    expect(Array.from(state.positions)).not.toEqual(before);
  }
});

test('strength = 0 keeps positions unchanged while age still advances', () => {
  for (const mode of ['attractor', 'vortex'] as const) {
    const stillConfig = { ...config, mode, strength: 0 };
    const state = createState(stillConfig, 5);
    const before = Array.from(state.positions);

    for (let i = 0; i < 60; i += 1) step(state, 1 / 60, stillConfig);

    expect(Array.from(state.positions)).toEqual(before);
    expect(state.ages[0]).toBeCloseTo((60 / 60) * stillConfig.speed, 5);
  }
});

test('vortex damping is a frozen, validated public parameter (#49)', () => {
  expect(resolveVortexDamping(undefined)).toBe(DEFAULT_VORTEX_DAMPING);
  expect(resolveVortexDamping(0.95)).toBe(0.95);
  for (const invalid of [0, -0.5, 1.01, Number.NaN, Number.POSITIVE_INFINITY]) {
    expect(() => resolveVortexDamping(invalid)).toThrow(TypeError);
  }
});

test('step applies the configured vortex damping instead of the default', () => {
  const strongConfig: SimulationConfig = {
    mode: 'vortex',
    particleCount: 1,
    speed: 1,
    strength: 0,
    vortexDamping: 0.5,
  };
  const weakConfig: SimulationConfig = { ...strongConfig, vortexDamping: 0.9 };
  const state = createState(strongConfig, 1);
  state.positions.set([5, 0, 0], 0);
  state.velocities.set([2, 0, 0], 0);

  const strong = { ...state, velocities: state.velocities.slice(), positions: state.positions.slice(), ages: state.ages.slice() };
  const weak = { ...state, velocities: state.velocities.slice(), positions: state.positions.slice(), ages: state.ages.slice() };
  step(strong, 1, strongConfig);
  step(weak, 1, weakConfig);

  expect(strong.velocities[0]).toBeCloseTo(1, 6);
  expect(weak.velocities[0]).toBeCloseTo(1.8, 6);
});

test('lifetime is a validated, shared default (#48)', () => {
  expect(resolveLifetime(undefined)).toBe(DEFAULT_LIFETIME);
  expect(resolveLifetime(0.5)).toBe(0.5);
  for (const invalid of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
    expect(() => resolveLifetime(invalid)).toThrow(TypeError);
    expect(() => createState({ ...config, lifetime: invalid })).toThrow(TypeError);
  }
});

test('seed-based spawn positions are deterministic, bounded and seed-dependent', () => {
  expect(pcgHash(0)).toBe(pcgHash(0));
  expect(pcgHash(1)).not.toBe(pcgHash(2));
  for (const seed of [0, 1, 42, 0xffffffff]) {
    const first = spawnPositionFromSeed(seed, 4);
    const second = spawnPositionFromSeed(seed, 4);
    expect(first).toEqual(second);
    expect(Math.hypot(...first)).toBeLessThanOrEqual(4 + 1e-6);
  }
  expect(spawnPositionFromSeed(7, DEFAULT_SPAWN_RADIUS)).not.toEqual(spawnPositionFromSeed(8, DEFAULT_SPAWN_RADIUS));
});

test('particles respawn deterministically after lifetime in both modes', () => {
  for (const mode of ['attractor', 'vortex'] as const) {
    const respawnConfig: SimulationConfig = {
      ...config,
      mode,
      particleCount: 8,
      speed: 1,
      lifetime: 0.5,
      spawnRadius: 2,
    };
    const first = createState(respawnConfig, 21);
    const second = createState(respawnConfig, 21);

    for (let i = 0; i < 5; i += 1) {
      step(first, 0.1, respawnConfig);
      step(second, 0.1, respawnConfig);
    }

    expect(snapshot(first)).toEqual(snapshot(second));
    expect(first.ages[0]).toBe(0);
    expect(first.velocities.slice(0, 3)).toEqual(new Float32Array(3));
    expect(Math.hypot(first.positions[0]!, first.positions[1]!, first.positions[2]!)).toBeLessThanOrEqual(2 + 1e-5);
    const expected = spawnPositionFromSeed(first.seeds[0]!, 2);
    for (let axis = 0; axis < 3; axis += 1) {
      expect(first.positions[axis]).toBeCloseTo(expected[axis]!, 5);
    }
  }
});

test('zero delta does not respawn an already-expired particle', () => {
  for (const mode of ['attractor', 'vortex'] as const) {
    const state = createState({ ...config, mode, lifetime: 0.5 }, 4);
    state.ages.fill(1);
    const before = snapshot(state);

    step(state, 0, { ...config, mode, lifetime: 0.5 });

    expect(snapshot(state)).toEqual(before);
  }
});

test('reference step does not import DOM or three', () => {
  for (const file of ['src/simulations/simulation.ts', 'src/simulations/shared/attributes.ts']) {
    const source = readFileSync(file, 'utf8');
    expect(source).not.toMatch(/from\s+['"]three/);
    expect(source).not.toMatch(/\b(document|window)\b/);
  }
});

test('golden values give the kernels a numeric baseline', () => {
  const goldenConfig: SimulationConfig = {
    mode: 'attractor',
    particleCount: 4,
    speed: 1,
    strength: 1,
    spawnRadius: 1,
    attractorRadius: 1,
  };
  const attractor = createState(goldenConfig, 123);
  for (let i = 0; i < 60; i += 1) step(attractor, 1 / 60, goldenConfig);

  const vortexConfig: SimulationConfig = { ...goldenConfig, mode: 'vortex' };
  const vortex = createState(vortexConfig, 123);
  for (let i = 0; i < 60; i += 1) step(vortex, 1 / 60, vortexConfig);

  expect(attractor.positions[0]).toBeCloseTo(-0.24403072893619537, 6);
  expect(attractor.positions[1]).toBeCloseTo(-0.5086816549301147, 6);
  expect(attractor.positions[2]).toBeCloseTo(-0.6391481757164001, 6);
  expect(attractor.velocities[0]).toBeCloseTo(-0.7608172297477722, 6);
  expect(attractor.velocities[2]).toBeCloseTo(-0.021382778882980347, 6);

  expect(vortex.positions[0]).toBeCloseTo(-0.17511485517024994, 6);
  expect(vortex.positions[2]).toBeCloseTo(-0.6317195892333984, 6);
  expect(vortex.velocities[0]).toBeCloseTo(-0.5698951482772827, 6);
  expect(vortex.velocities[2]).toBeCloseTo(-0.016484029591083527, 6);
});
