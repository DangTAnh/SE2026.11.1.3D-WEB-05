import { Fn, instanceIndex, vec3 } from 'three/tsl';
import type { ParticleBuffers } from './particleBuffers.ts';

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

    const toCenter = position.negate().normalize();
    const tangent = toCenter.cross(vec3(0, 1, 0));

    velocity.addAssign(tangent.mul(uniforms.strength).mul(uniforms.delta));
    velocity.assign(velocity.mul(uniforms.vortexDamping));
    position.addAssign(velocity.mul(uniforms.delta));
    age.addAssign(uniforms.delta);
  })()
    .compute(count)
    .setName('Vortex');
}
