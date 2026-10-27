import { expect, test } from 'vitest';
import { DEFAULT_CONFIG, cloneConfig, parsePresetDocument, serializePresetDocument, parsePreset, serializePreset } from '../../src/presets/preset.ts';
import type { PresetDocument } from '../../src/presets/preset.ts';

const document = (): PresetDocument => ({ schemaVersion: 2, app: '3D-WEB-05', config: cloneConfig(DEFAULT_CONFIG) });
const rejected = (edit: (d: any) => void, message?: RegExp): void => {
  const d = document(); edit(d);
  expect(() => parsePresetDocument(JSON.stringify(d))).toThrow(message);
};
test.each(['attractor', 'vortex'] as const)('valid %s v2 preserves every group', mode => {
  const d = document(); d.config.mode = mode;
  d.config.modes.attractor.attractorRadius = 8;
  d.config.modes.vortex.vortexDamping = 0.9;
  expect(parsePresetDocument(serializePresetDocument(d))).toEqual(d);
  expect(parsePreset(serializePreset(d.config))).toEqual(d.config);
});
test('name optional, retained verbatim, never generated or inserted into engine config', () => {
  const d = document(); expect(parsePresetDocument(serializePresetDocument(d))).not.toHaveProperty('name');
  d.name = 'Đám mây TV4';
  expect(parsePresetDocument(serializePresetDocument(d))).toEqual(d);
  expect(parsePreset(serializePresetDocument(d))).not.toHaveProperty('name');
});
test.each(['', 'a'.repeat(81), null, 3])('invalid name %s', name => rejected(d => { d.name = name; }));
test.each(['a', 'a'.repeat(80)])('name boundary accepted (%s)', name => {
  const d = document(); d.name = name; expect(parsePresetDocument(serializePresetDocument(d)).name).toBe(name);
});
test('malformed JSON and v1 give clear errors; no migration', () => {
  expect(() => parsePresetDocument('{invalid')).toThrow(/JSON/);
  rejected(d => { d.schemaVersion = 1; }, /v1.*không được hỗ trợ/);
  rejected(d => { d.schemaVersion = 3; });
  rejected(d => { d.app = 'other'; });
});
const objectPaths = ['', 'config', 'config.simulation', 'config.modes', 'config.modes.attractor',
  'config.modes.vortex', 'config.rendering', 'config.camera'];
const at = (d: any, path: string): any => path ? path.split('.').reduce((o, key) => o[key], d) : d;
test.each(objectPaths)('unknown keys rejected at %s', path => rejected(d => { at(d, path).unknown = true; }, /không được hỗ trợ/));
test.each(objectPaths)('every required property rejected when absent at %s', path => {
  for (const key of Object.keys(at(document(), path))) {
    if (key === 'name') continue;
    rejected(d => { delete at(d, path)[key]; }, /thiếu trường/);
  }
});
test.each([1000, 1500, 65536, 500000])('valid count %s', particleCount => {
  const d = document(); d.config.simulation.particleCount = particleCount;
  expect(parsePresetDocument(serializePresetDocument(d)).config.simulation.particleCount).toBe(particleCount);
});
test.each([999, 500001, 1000.5])('invalid count %s', n => rejected(d => { d.config.simulation.particleCount = n; }, /Số particle/));
const ranges: Array<[string, number, number]> = [
  ['simulation.spawnRadius', 1, 100], ['simulation.particleSize', 1, 8], ['simulation.lifetime', 0.5, 20],
  ['simulation.speed', 0.1, 3], ['modes.attractor.attractorStrength', 0.2, 4],
  ['modes.attractor.attractorRadius', 0.5, 50], ['modes.attractor.attractorDamping', 0.8, 1],
  ['modes.vortex.vortexStrength', 0.2, 4], ['modes.vortex.vortexDamping', 0.8, 1],
  ['rendering.opacity', 0.05, 1], ['camera.distance', 5, 500],
];
test.each(ranges)('%s boundaries, out of range, precision and nonfinite', (path, low, high) => {
  const parts = path.split('.'); const key = parts.pop()!;
  for (const value of [low, high]) {
    const d = document(); at(d.config, parts.join('.'))[key] = value;
    expect(parsePresetDocument(serializePresetDocument(d))).toEqual(d);
  }
  for (const value of [low - 0.001, high + 0.001, low + 0.0001, NaN, Infinity, -Infinity]) {
    rejected(d => { at(d.config, parts.join('.'))[key] = value; });
    const d = document(); at(d.config, parts.join('.'))[key] = value;
    expect(() => serializePresetDocument(d)).toThrow();
  }
});
test('color, mode, backend, boolean validation', () => {
  for (const key of ['particleColor', 'backgroundColor']) {
    for (const bad of ['red', '#abc', '#gggggg', '<script>']) rejected(d => { d.config.rendering[key] = bad; }, /Màu/);
  }
  rejected(d => { d.config.mode = 'flow'; }, /mode/);
  rejected(d => { d.config.backendPreference = 'cpu'; }, /backend/);
  rejected(d => { d.config.camera.enabled = 1; });
  rejected(d => { d.config.camera.autoRotate = 'true'; });
  rejected(d => { d.config.rendering.additiveBlend = null; });
});
test('disabled camera with autoRotate preference is valid', () => {
  const d = document(); d.config.camera.enabled = false; d.config.camera.autoRotate = true;
  expect(parsePresetDocument(serializePresetDocument(d))).toEqual(d);
});
