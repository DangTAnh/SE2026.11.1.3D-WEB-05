import { Fn, hash, instancedArray, instanceIndex, uniform, vec3 } from 'three/tsl';
import { DEFAULT_SPAWN_RADIUS } from './attributes.ts';
import { DEFAULT_ATTRACTOR_DAMPING, DEFAULT_ATTRACTOR_RADIUS, DEFAULT_VORTEX_DAMPING } from '../simulation.ts';

/**
 * Shared GPU buffers and uniforms for both simulation modes. The adapter owns
 * setting `delta = clampedDelta * speed` and the mode-specific uniform values;
 * the kernels only read these uniforms. No DOM, no renderer construction.
 */
export function createParticleBuffers(count: number) {
  if (!Number.isInteger(count) || count <= 0) {
    throw new TypeError('count must be a positive integer');
  }

  const positions = instancedArray(count, 'vec3');
  const velocities = instancedArray(count, 'vec3');
  const ages = instancedArray(count, 'float');
  const seeds = instancedArray(count, 'uint');
  const uniforms = {
    spawnRadius: uniform(DEFAULT_SPAWN_RADIUS),
    strength: uniform(1),
    radius: uniform(DEFAULT_ATTRACTOR_RADIUS),
    damping: uniform(DEFAULT_ATTRACTOR_DAMPING),
    vortexDamping: uniform(DEFAULT_VORTEX_DAMPING),
    delta: uniform(0),
  };

  const initKernel = Fn(() => {
    const position = positions.element(instanceIndex);
    const velocity = velocities.element(instanceIndex);
    const age = ages.element(instanceIndex);
    const seed = seeds.element(instanceIndex);

    // Hash cho hướng đều trên mặt cầu; bán kính lấy cbrt để phân bố đều theo thể tích,
    // khớp `createState()` (radius = spawnRadius * cbrt(random())) ở reference step.
    const direction = vec3(hash(instanceIndex), hash(instanceIndex.add(1)), hash(instanceIndex.add(2)))
      .sub(0.5)
      .normalize();
    const radial = hash(instanceIndex.add(3)).pow(1 / 3);

    position.assign(direction.mul(uniforms.spawnRadius).mul(radial));
    velocity.assign(vec3(0, 0, 0));
    age.assign(0);
    // Cùng miền giá trị với `seeds: Uint32Array` của reference step.
    seed.assign(hash(instanceIndex.add(4)).mul(0xffffffff).toUint());
  })()
    .compute(count)
    .setName('Init Particles');

  return { count, positions, velocities, ages, seeds, uniforms, initKernel };
}

export type ParticleBuffers = ReturnType<typeof createParticleBuffers>;
