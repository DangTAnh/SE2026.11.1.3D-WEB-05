import { expect, test } from 'vitest';
import {
  createState,
  PARTICLE_ATTRIBUTES,
  type ParticleState,
  type SimulationConfig,
} from '../../src/simulations/shared/attributes.ts';
import { step } from '../../src/simulations/simulation.ts';

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
