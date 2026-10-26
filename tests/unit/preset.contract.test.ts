/**
 * Observable contract of the preset payload — pins CURRENT behavior before refactoring.
 * If a test here fails, the refactor changed observable behavior, not just structure.
 */
import { test } from 'vitest';
import assert from 'node:assert/strict';
import { DEFAULT_CONFIG, parsePreset, serializePreset } from '../../src/presets/preset.ts';
import type { LabConfig } from '../../src/presets/preset.ts';
import { DEFAULT_LIFETIME, DEFAULT_SPAWN_RADIUS } from '../../src/simulations/shared/attributes.ts';
import { DEFAULT_VORTEX_DAMPING } from '../../src/simulations/simulation.ts';

const presetOf = (config: LabConfig) => JSON.parse(serializePreset(config)) as Record<string, unknown>;

test('contract: exported JSON has exactly three top-level keys and the full config key set', () => {
  const out = presetOf({ ...DEFAULT_CONFIG });
  assert.deepEqual(Object.keys(out).sort(), ['app', 'config', 'schemaVersion']);
  assert.equal(out.schemaVersion, 1);
  assert.equal(out.app, '3D-WEB-05');
  assert.deepEqual(Object.keys(out.config as object).sort(), [
    'backendPreference', 'mode', 'particleColor', 'particleCount', 'particleSize', 'speed', 'strength',
  ]);
});

test('contract: spawnRadius and lifetime share the simulation defaults and v1 drops them (#48)', () => {
  assert.equal(DEFAULT_CONFIG.spawnRadius, DEFAULT_SPAWN_RADIUS);
  assert.equal(DEFAULT_CONFIG.lifetime, DEFAULT_LIFETIME);

  const raw = presetOf({ ...DEFAULT_CONFIG });
  const config = raw.config as Record<string, unknown>;
  assert.equal('spawnRadius' in config, false);
  assert.equal('lifetime' in config, false);

  const imported = parsePreset(serializePreset({
    ...DEFAULT_CONFIG,
    spawnRadius: 20,
    lifetime: 2,
  }));
  assert.equal(imported.spawnRadius, DEFAULT_SPAWN_RADIUS);
  assert.equal(imported.lifetime, DEFAULT_LIFETIME);
});

test('contract: parse -> serialize -> parse is idempotent', () => {
  const once = parsePreset(serializePreset({ ...DEFAULT_CONFIG }));
  const twice = parsePreset(serializePreset(once));
  assert.deepEqual(twice, once);
});

test('contract: vortexDamping has one default and v1 cannot persist it (#49)', () => {
  assert.equal(DEFAULT_CONFIG.vortexDamping, DEFAULT_VORTEX_DAMPING);

  const raw = presetOf({ ...DEFAULT_CONFIG });
  assert.equal('vortexDamping' in (raw.config as object), false, 'the frozen v1 payload must not grow');

  // Parsing a v1 payload applies the public default; a programmatic value is not round-tripped.
  const imported = parsePreset(serializePreset({ ...DEFAULT_CONFIG, vortexDamping: 0.9 }));
  assert.equal(imported.vortexDamping, DEFAULT_VORTEX_DAMPING);

  // A v1 file that tries to set it is still rejected as an unknown key.
  const extra = presetOf({ ...DEFAULT_CONFIG });
  (extra.config as Record<string, unknown>).vortexDamping = 0.9;
  assert.throws(() => parsePreset(JSON.stringify(extra)), /không được hỗ trợ/);
});

test('contract: particleCount boundaries 1000 and 50000 are valid; 999, 50001 and off-step values are rejected', () => {
  for (const count of [1000, 50000]) {
    assert.equal(parsePreset(serializePreset({ ...DEFAULT_CONFIG, particleCount: count })).particleCount, count);
  }
  for (const count of [999, 50001, 1500]) {
    assert.throws(() => parsePreset(serializePreset({ ...DEFAULT_CONFIG, particleCount: count })));
  }
});

test('contract: unknown config keys are rejected before reaching the result', () => {
  for (const key of ['isAdmin', '__proto__x']) {
    const raw = presetOf({ ...DEFAULT_CONFIG });
    (raw.config as Record<string, unknown>)[key] = true;
    assert.throws(() => parsePreset(JSON.stringify(raw)), /không được hỗ trợ/);
  }
});

test('contract: parse returns a fresh object and keeps no reference to the input data', () => {
  const raw = presetOf({ ...DEFAULT_CONFIG });
  const parsed = parsePreset(JSON.stringify(raw));
  parsed.particleCount = 1000;
  assert.equal((raw.config as Record<string, unknown>).particleCount, DEFAULT_CONFIG.particleCount);
});

test('contract: color case is preserved; only the #RRGGBB shape is validated', () => {
  assert.equal(parsePreset(serializePreset({ ...DEFAULT_CONFIG, particleColor: '#ABCDEF' })).particleColor, '#ABCDEF');
  assert.equal(parsePreset(serializePreset({ ...DEFAULT_CONFIG, particleColor: '#abcdef' })).particleColor, '#abcdef');
  for (const bad of ['#ABC', 'red', '#GGGGGG', '<script>']) {
    assert.throws(() => parsePreset(serializePreset({ ...DEFAULT_CONFIG, particleColor: bad })));
  }
});

test('contract: key order and two-space indentation of the output stay stable', () => {
  const text = serializePreset({ ...DEFAULT_CONFIG });
  assert.match(text, /\n  "schemaVersion": 1,/);
  assert.ok(text.endsWith('\n'));
});
