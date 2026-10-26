import { If, hash, instanceIndex, vec3 } from 'three/tsl';
import type { ParticleBuffers } from './particleBuffers.ts';

/**
 * Shared respawn branch for both step kernels (#48).
 *
 * The reference implementation is `spawnPositionFromSeed()` in `attributes.ts`:
 * the same PCG hash (`three/tsl`'s `hash`), the same hash offsets and the same
 * uniform-sphere sampling. Age, position and velocity are reset; the seed is
 * unchanged so the next respawn is deterministic too.
 *
 * Emit this **after** the age increment and **inside** the `delta > 0` guard:
 * a zero-delta step must not respawn a particle that is already expired.
 */
export function respawnExpiredParticles(system: ParticleBuffers): void {
  const { positions, velocities, ages, seeds, uniforms } = system;
  const position = positions.element(instanceIndex);
  const velocity = velocities.element(instanceIndex);
  const age = ages.element(instanceIndex);
  const seed = seeds.element(instanceIndex);

  If(age.greaterThanEqual(uniforms.lifetime), () => {
    // hash(seed), hash(seed+1), hash(seed+2) mirror `spawnPositionFromSeed`:
    // direction (z/phi) from the first two hashes, radial cbrt from the third.
    const u = hash(seed);
    const v = hash(seed.add(1));
    const w = hash(seed.add(2));
    const z = u.mul(2).sub(1);
    const phi = v.mul(Math.PI * 2);
    const rxy = z.mul(z).oneMinus().sqrt();
    const direction = vec3(phi.cos().mul(rxy), z, phi.sin().mul(rxy));
    const radial = w.pow(1 / 3);

    position.assign(direction.mul(uniforms.spawnRadius).mul(radial));
    velocity.assign(vec3(0, 0, 0));
    age.assign(0);
  });
}
