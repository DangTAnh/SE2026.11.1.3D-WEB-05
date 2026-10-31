import { expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { DEFAULT_CONFIG, cloneConfig, parsePresetDocument, serializePresetDocument } from '../../src/presets/preset.ts';
import { DEFAULT_LIFETIME, DEFAULT_SPAWN_RADIUS } from '../../src/simulations/shared/attributes.ts';
import { DEFAULT_ATTRACTOR_DAMPING, DEFAULT_ATTRACTOR_RADIUS, DEFAULT_VORTEX_DAMPING } from '../../src/simulations/simulation.ts';

test('defaults match TV2 and shared simulation constants', () => {
  expect(DEFAULT_CONFIG.simulation).toEqual({ particleCount: 65536, spawnRadius: DEFAULT_SPAWN_RADIUS,
    particleSize: 2.5, lifetime: DEFAULT_LIFETIME, speed: 1.2 });
  expect(DEFAULT_CONFIG.modes).toEqual({ attractor: { attractorStrength: 1.5,
    attractorRadius: DEFAULT_ATTRACTOR_RADIUS, attractorDamping: DEFAULT_ATTRACTOR_DAMPING },
    vortex: { vortexStrength: 1.5, vortexDamping: DEFAULT_VORTEX_DAMPING } });
});
test('deep copy isolates all nested groups; defaults frozen at every level', () => {
  const a = cloneConfig(DEFAULT_CONFIG), b = cloneConfig(DEFAULT_CONFIG);
  a.simulation.speed = 2; a.modes.attractor.attractorRadius = 9;
  a.modes.vortex.vortexDamping = 0.8; a.camera.distance = 500; a.rendering.opacity = 0.5;
  expect(b).toEqual(DEFAULT_CONFIG);
  for (const group of [DEFAULT_CONFIG, DEFAULT_CONFIG.simulation, DEFAULT_CONFIG.modes,
    DEFAULT_CONFIG.modes.attractor, DEFAULT_CONFIG.modes.vortex, DEFAULT_CONFIG.rendering, DEFAULT_CONFIG.camera]) {
    expect(Object.isFrozen(group)).toBe(true);
  }
});
const reverse = (value: unknown): unknown => typeof value === 'object' && value !== null
  ? Object.fromEntries(Object.entries(value).reverse().map(([k, v]) => [k, reverse(v)])) : value;
test('serialization order is stable at every level, indent 2, newline, exact repeated bytes', () => {
  const d = { schemaVersion: 2 as const, app: '3D-WEB-05' as const, name: 'named', config: cloneConfig(DEFAULT_CONFIG) };
  const first = serializePresetDocument(d);
  expect(first).toBe(serializePresetDocument(parsePresetDocument(JSON.stringify(reverse(d)))));
  expect(first).toBe(serializePresetDocument(parsePresetDocument(first)));
  expect(first.startsWith('{\n  "schemaVersion": 2,\n  "app": "3D-WEB-05",\n  "name": "named",\n  "config": {\n')).toBe(true);
  expect(first.endsWith('\n')).toBe(true);
  const parsed = parsePresetDocument(first); parsed.config.modes.vortex.vortexStrength = 3;
  expect(d.config.modes.vortex.vortexStrength).toBe(1.5);
});
test.each(['attractor', 'vortex'])('published %s example validates and serializes byte-identically', mode => {
  const text = readFileSync(new URL(`../../public/examples/${mode}-preset.json`, import.meta.url), 'utf8');
  const document = parsePresetDocument(text);
  expect(document.config.mode).toBe(mode);
  expect(serializePresetDocument(document)).toBe(text);
});
