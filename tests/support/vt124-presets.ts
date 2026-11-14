import { cloneConfig, DEFAULT_CONFIG, type PresetDocument } from '../../src/presets/preset.ts';

/** VT-124-specific documents; JSON.stringify keeps the expected data independent
 * of the production serializer used by the integration boundary. */
export function vt124Document(name = 'VT124 cloud', mode: 'attractor' | 'vortex' = 'attractor'): PresetDocument {
  const config = cloneConfig(DEFAULT_CONFIG);
  config.mode = mode;
  config.simulation.spawnRadius = 12;
  config.simulation.lifetime = 7;
  config.rendering.opacity = 0.65;
  config.camera.distance = 42;
  return { schemaVersion: 2, app: '3D-WEB-05', name, config };
}

