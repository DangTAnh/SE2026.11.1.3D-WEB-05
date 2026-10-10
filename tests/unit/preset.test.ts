import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_CONFIG, parsePreset, serializePreset } from '../../src/presets/preset.ts';

const makePreset = (): Record<string, any> => JSON.parse(serializePreset({ ...DEFAULT_CONFIG }));

test('xuất JSON và import trở lại giữ nguyên cấu hình', () => {
  const original = { ...DEFAULT_CONFIG, mode: 'vortex' as const, backendPreference: 'webgl2' as const };
  assert.deepEqual(parsePreset(serializePreset(original)), original);
});

test('JSON không hợp lệ bị từ chối', () => {
  assert.throws(() => parsePreset('{invalid'), /JSON/);
});

test('preset sai schema bị từ chối', () => {
  assert.throws(() => parsePreset(JSON.stringify({ schemaVersion: 2, app: '3D-WEB-05', config: DEFAULT_CONFIG })), /định dạng/);
});

test('không chấp nhận số particle vượt phạm vi', () => {
  const data = makePreset();
  data.config.particleCount = 100000000;
  assert.throws(() => parsePreset(JSON.stringify(data)), /Số particle/);
});

test('chấp nhận hai biên particle hợp lệ', () => {
  const low = makePreset();
  low.config.particleCount = 1000;
  const high = makePreset();
  high.config.particleCount = 50000;
  assert.equal(parsePreset(JSON.stringify(low)).particleCount, 1000);
  assert.equal(parsePreset(JSON.stringify(high)).particleCount, 50000);
});

test('không chấp nhận particle không theo bước 1.000', () => {
  const data = makePreset();
  data.config.particleCount = 1500;
  assert.throws(() => parsePreset(JSON.stringify(data)), /Số particle/);
});

test('không chấp nhận màu sai định dạng', () => {
  const data = makePreset();
  data.config.particleColor = '<script>';
  assert.throws(() => parsePreset(JSON.stringify(data)), /Màu/);
});

test('không chấp nhận hệ số ngoài phạm vi', () => {
  const data = makePreset();
  data.config.strength = Infinity;
  assert.throws(() => parsePreset(JSON.stringify(data)), /Cường độ/);
});

test('không chấp nhận backend hoặc mode ngoài danh sách', () => {
  const backend = makePreset();
  backend.config.backendPreference = 'canvas2d';
  assert.throws(() => parsePreset(JSON.stringify(backend)), /backend/);

  const mode = makePreset();
  mode.config.mode = 'free';
  assert.throws(() => parsePreset(JSON.stringify(mode)), /mode/);
});

test('không chấp nhận trường thừa hoặc thiếu trường bắt buộc', () => {
  const extra = makePreset();
  extra.config.debug = true;
  assert.throws(() => parsePreset(JSON.stringify(extra)), /không được hỗ trợ/);

  const missing = makePreset();
  delete missing.config.speed;
  assert.throws(() => parsePreset(JSON.stringify(missing)), /thiếu trường/);
});

test('không chấp nhận tốc độ và kích thước ngoài phạm vi', () => {
  const speed = makePreset();
  speed.config.speed = 3.1;
  assert.throws(() => parsePreset(JSON.stringify(speed)), /Tốc độ/);

  const size = makePreset();
  size.config.particleSize = 0.5;
  assert.throws(() => parsePreset(JSON.stringify(size)), /Kích thước/);
});
