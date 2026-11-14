/** Active workload identity, per TV1 decision on Issue #16 (27/10/2026). */
import type { LabConfig } from '../../presets/preset.ts';

function round(value: number, field: string): number {
  if (!Number.isFinite(value)) throw new TypeError(`configHash: ${field} must be a finite number`);
  return Number(value.toFixed(3));
}
/** Flat alphabetical JSON; only simulation and the active mode group enter the hash. */
export function canonicalConfig(config: Readonly<LabConfig>): string {
  if (config.mode !== 'attractor' && config.mode !== 'vortex') {
    throw new TypeError('configHash: mode must be "attractor" or "vortex"');
  }
  const active = config.mode === 'attractor' ? config.modes.attractor : config.modes.vortex;
  const fields: Record<string, number | string> = { ...config.simulation, ...active, mode: config.mode };
  // Explicit projection prevents any unexpected simulation/mode property entering identity.
  const keys = ['lifetime', 'mode', 'particleCount', 'particleSize', 'spawnRadius', 'speed',
    ...(config.mode === 'attractor' ? ['attractorDamping', 'attractorRadius', 'attractorStrength']
      : ['vortexDamping', 'vortexStrength'])].sort();
  return JSON.stringify(Object.fromEntries(keys.map(key => [key,
    key === 'mode' ? config.mode : round(fields[key] as number, key)])));
}
export async function configHash(config: Readonly<LabConfig>): Promise<string> {
  const bytes = new TextEncoder().encode(canonicalConfig(config));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}
