/**
 * Deterministic identity of a benchmark configuration (docs/architecture.md §5.1).
 *
 * Hashed fields are the `LabConfig` values that change the work the GPU does:
 * `mode`, `particleCount`, `particleSize`, `speed`, `strength`, `spawnRadius`,
 * `lifetime`, plus `vortexDamping` when `mode` is `vortex` (#48/#49). Excluded,
 * with reasons in §5.1: `backendPreference` (a request — the backend that ran
 * is stored as `actual`), `particleColor` (a per-frame uniform), the inactive
 * mode's parameters, and the preset envelope (`schemaVersion`, `app`).
 *
 * Canonical form: one JSON object, keys in alphabetical order, no whitespace,
 * numbers rounded to 3 decimal places without trailing zeros. SHA-256 over the
 * UTF-8 bytes, lowercase hex, 64 characters.
 *
 * Range validation is `parsePreset`'s job (`src/presets/preset.ts`); this module
 * only refuses values it cannot canonicalize (missing, non-finite, wrong mode).
 * A config that failed `parsePreset` must never reach a sample at all.
 *
 * `LabConfig` is imported as a type only, the same D-06 coupling the renderer
 * port has.
 */
import type { LabConfig } from '../../presets/preset.ts';

function round(value: number, field: string): number {
  if (!Number.isFinite(value)) {
    throw new TypeError(`configHash: ${field} must be a finite number`);
  }
  return Number(value.toFixed(3));
}

/** The exact string that is hashed. Exported so a benchmark can print it. */
export function canonicalConfig(config: Readonly<LabConfig>): string {
  if (config.mode !== 'attractor' && config.mode !== 'vortex') {
    throw new TypeError('configHash: mode must be "attractor" or "vortex"');
  }
  // Insertion order is the canonical order; all keys are non-numeric.
  return JSON.stringify({
    lifetime: round(config.lifetime, 'lifetime'),
    mode: config.mode,
    particleCount: round(config.particleCount, 'particleCount'),
    particleSize: round(config.particleSize, 'particleSize'),
    spawnRadius: round(config.spawnRadius, 'spawnRadius'),
    speed: round(config.speed, 'speed'),
    strength: round(config.strength, 'strength'),
    // The inactive mode's parameters do not change the work that runs.
    ...(config.mode === 'vortex'
      ? { vortexDamping: round(config.vortexDamping, 'vortexDamping') }
      : {}),
  });
}

/** SHA-256 (lowercase hex) of `canonicalConfig(config)`. */
export async function configHash(config: Readonly<LabConfig>): Promise<string> {
  const bytes = new TextEncoder().encode(canonicalConfig(config));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}
