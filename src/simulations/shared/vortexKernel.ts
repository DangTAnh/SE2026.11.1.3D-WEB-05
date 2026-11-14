import { Fn, If, instanceIndex, vec3 } from 'three/tsl';
import type { ParticleBuffers } from './particleBuffers.ts';
import { respawnExpiredParticles } from './respawn.ts';

/**
 * Vortex compute kernel. The CPU reference for the same formula is `step()`
 * with `mode: 'vortex'` in `../simulation.ts`; the adapter only has to set
 * `delta = dt * speed` and `strength` — damping comes from `uniforms.vortexDamping`.
 */
export function createVortexKernel(system: ParticleBuffers) {
  const { positions, velocities, ages, uniforms, count } = system;

  return Fn(() => {
    const position = positions.element(instanceIndex);
    const velocity = velocities.element(instanceIndex);
    const age = ages.element(instanceIndex);

    // Reference step trả sớm khi dt * speed === 0. Giữ nguyên velocity/position
    // (kể cả damping) khi delta = 0; age vẫn cộng delta ở ngoài guard.
    const distance = position.length();
    If(uniforms.delta.greaterThan(0), () => {
      // Hạt đúng tâm đứng yên để tránh normalize(0) → NaN.
      If(distance.greaterThan(1e-6), () => {
        const toCenter = position.negate().normalize();
        const tangent = toCenter.cross(vec3(0, 1, 0));

        velocity.addAssign(tangent.mul(uniforms.strength).mul(uniforms.delta));
        velocity.assign(velocity.mul(uniforms.vortexDamping));
        position.addAssign(velocity.mul(uniforms.delta));
      });
    });
    age.addAssign(uniforms.delta);
    If(uniforms.delta.greaterThan(0), () => {
      respawnExpiredParticles(system);
    });
  })()
    .compute(count)
    .setName('Vortex');
}
