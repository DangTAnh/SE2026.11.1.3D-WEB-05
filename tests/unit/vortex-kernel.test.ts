import { expect, test } from 'vitest';
import { createParticleBuffers } from '../../src/simulations/shared/particleBuffers.ts';
import { createAttractorKernel } from '../../src/simulations/shared/attractorKernel.ts';
import { createVortexKernel } from '../../src/simulations/shared/vortexKernel.ts';
import { DEFAULT_VORTEX_DAMPING } from '../../src/simulations/simulation.ts';

test('vortex kernel is a named compute node over the shared buffers', () => {
  const system = createParticleBuffers(8);
  const kernel = createVortexKernel(system);

  expect(kernel.name).toBe('Vortex');
});

test('vortex and attractor kernels stay distinct over the same buffers', () => {
  const system = createParticleBuffers(8);
  system.uniforms.damping.value = DEFAULT_VORTEX_DAMPING;

  const vortex = createVortexKernel(system);
  const attractor = createAttractorKernel(system);

  expect(vortex.name).toBe('Vortex');
  expect(attractor.name).toBe('Attractor');
  expect(vortex.name).not.toBe(attractor.name);
});
