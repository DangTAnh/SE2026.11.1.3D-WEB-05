/**
 * The configuration contract every layer shares.
 *
 * Lives in the leaf (`docs/architecture.md` §2 rule 1) so `src/core/` never has
 * to reach into the preset domain for it. `src/presets/preset.ts` re-exports
 * these symbols, so existing imports keep working. This module imports nothing,
 * by design.
 */

export type SimulationMode = 'attractor' | 'vortex';

export interface LabConfig {
  mode: SimulationMode;
  backendPreference: 'auto' | 'webgpu' | 'webgl2';
  simulation: { particleCount: number; spawnRadius: number; particleSize: number; lifetime: number; speed: number };
  modes: {
    attractor: { attractorStrength: number; attractorRadius: number; attractorDamping: number };
    vortex: { vortexStrength: number; vortexDamping: number };
  };
  rendering: { backgroundColor: string; particleColor: string; opacity: number; additiveBlend: boolean };
  camera: { enabled: boolean; autoRotate: boolean; distance: number };
}

/** Frozen at every level; cloneConfig returns independent mutable defaults. */
export const DEFAULT_CONFIG: Readonly<LabConfig> = Object.freeze({
  mode: 'attractor', backendPreference: 'auto',
  simulation: Object.freeze({ particleCount: 65536, spawnRadius: 10, particleSize: 2.5, lifetime: 6, speed: 1.2 }),
  modes: Object.freeze({
    attractor: Object.freeze({ attractorStrength: 1.5, attractorRadius: 6, attractorDamping: 0.98 }),
    vortex: Object.freeze({ vortexStrength: 1.5, vortexDamping: 0.99 }),
  }),
  rendering: Object.freeze({ backgroundColor: '#07111f', particleColor: '#6ce6ff', opacity: 1, additiveBlend: false }),
  camera: Object.freeze({ enabled: true, autoRotate: false, distance: 30 }),
});
export function cloneConfig(config: Readonly<LabConfig>): LabConfig { return structuredClone(config); }