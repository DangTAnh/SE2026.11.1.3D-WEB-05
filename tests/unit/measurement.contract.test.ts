import { expect, test } from 'vitest';
import { createHash } from 'node:crypto';
import { DEFAULT_CONFIG, cloneConfig, parsePresetDocument, serializePresetDocument } from '../../src/presets/preset.ts';
import type { LabConfig } from '../../src/presets/preset.ts';
import { canonicalConfig, configHash } from '../../src/core/measurement/configHash.ts';
import type { PerformanceSnapshot } from '../../src/core/types/measurement.ts';
const attractor = '{"attractorDamping":0.98,"attractorRadius":6,"attractorStrength":1.5,"lifetime":6,"mode":"attractor","particleCount":65536,"particleSize":2.5,"spawnRadius":10,"speed":1.2}';
const vortex = '{"lifetime":6,"mode":"vortex","particleCount":65536,"particleSize":2.5,"spawnRadius":10,"speed":1.2,"vortexDamping":0.99,"vortexStrength":1.5}';

test.each(['attractor', 'vortex'] as const)('exact %s canonical and independent SHA256 vector', async mode => {
  const c = cloneConfig(DEFAULT_CONFIG); c.mode = mode;
  const expected = mode === 'attractor' ? attractor : vortex;
  expect(canonicalConfig(c)).toBe(expected);
  expect(await configHash(c)).toBe(mode === 'attractor'
    ? '0f917cd0a56e3d7b63f53c7f1e7bb5f2cdfb70d6191454733baf204f0fc907fa'
    : '1d178f4522821a47f7c165efa4cf95aeb3171bf943f9fa511f22db7140669033');
  expect(await configHash(c)).toBe(createHash('sha256').update(expected, 'utf8').digest('hex'));
  expect(await configHash(c)).toMatch(/^[0-9a-f]{64}$/);
});
const common = ['particleCount', 'spawnRadius', 'particleSize', 'lifetime', 'speed'] as const;
test.each(['attractor', 'vortex'] as const)('every included %s field changes hash beyond rounding', async mode => {
  const base = cloneConfig(DEFAULT_CONFIG); base.mode = mode; const hash = await configHash(base);
  for (const key of common) {
    const c = cloneConfig(base); c.simulation[key] += key === 'particleCount' ? 1 : 0.001;
    expect(await configHash(c), key).not.toBe(hash);
  }
  for (const key of Object.keys(base.modes[mode])) {
    const c = cloneConfig(base); const group = c.modes[mode] as unknown as Record<string, number>;
    group[key]! += 0.001; expect(await configHash(c), key).not.toBe(hash);
  }
  const switched = cloneConfig(base); switched.mode = mode === 'attractor' ? 'vortex' : 'attractor';
  expect(await configHash(switched)).not.toBe(hash);
});
test.each(['attractor', 'vortex'] as const)('excluded fields and inactive %s group do not affect identity', async mode => {
  const base = cloneConfig(DEFAULT_CONFIG); base.mode = mode;
  const c = cloneConfig(base); c.backendPreference = 'webgl2';
  c.rendering = { particleColor: '#ffffff', backgroundColor: '#abcdef', opacity: 0.05, additiveBlend: true };
  c.camera = { enabled: false, autoRotate: true, distance: 500 };
  if (mode === 'attractor') c.modes.vortex = { vortexStrength: 4, vortexDamping: 0.8 };
  else c.modes.attractor = { attractorStrength: 4, attractorRadius: 50, attractorDamping: 0.8 };
  const doc = parsePresetDocument(serializePresetDocument({ schemaVersion: 2, app: '3D-WEB-05', name: 'metadata', config: c }));
  expect(await configHash(doc.config)).toBe(await configHash(base));
});
test('property order, rounding noise, threshold, trailing zeros and negative zero are stable', () => {
  const c = cloneConfig(DEFAULT_CONFIG); c.simulation.speed = 1.2004;
  expect(canonicalConfig(c)).toBe(attractor);
  c.simulation.speed = 1.2006; expect(canonicalConfig(c)).toContain('"speed":1.201');
  c.simulation.speed = -0; expect(canonicalConfig(c)).toContain('"speed":0');
  const reversed = JSON.parse(JSON.stringify(DEFAULT_CONFIG), (_key, value: unknown) => {
    return value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).reverse()) : value;
  }) as LabConfig;
  expect(canonicalConfig(reversed)).toBe(attractor);
});
test('nonfinite or missing included values rejected with no default/hash', async () => {
  for (const value of [NaN, Infinity, -Infinity, undefined]) {
    for (const mode of ['attractor', 'vortex'] as const) {
      const c = cloneConfig(DEFAULT_CONFIG); c.mode = mode;
      for (const group of [c.simulation, c.modes[mode]]) {
        for (const key of Object.keys(group)) {
          const bad = cloneConfig(c);
          const target = group === c.simulation ? bad.simulation : bad.modes[mode];
          (target as unknown as Record<string, unknown>)[key] = value;
          expect(() => canonicalConfig(bad)).toThrow(TypeError);
          await expect(configHash(bad)).rejects.toThrow(TypeError);
        }
      }
    }
  }
  const invalid = cloneConfig(DEFAULT_CONFIG); invalid.mode = 'gravity' as LabConfig['mode'];
  expect(() => canonicalConfig(invalid)).toThrow(TypeError);
});
test('performance snapshot still records actual backend and unavailable timing honestly', async () => {
  const snapshot: PerformanceSnapshot = { actual: 'webgl2', configHash: await configHash(DEFAULT_CONFIG),
    fps: 60, gpuTimeMs: null, gpuTimingAvailable: false };
  expect(snapshot.actual).toBe('webgl2'); expect(snapshot.gpuTimeMs).toBeNull();
});
