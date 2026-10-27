import { expect, test } from 'vitest';
import { DEFAULT_CONFIG, parsePreset, serializePreset } from '../../src/presets/preset.ts';

const makePreset = (): Record<string, any> => JSON.parse(serializePreset({ ...DEFAULT_CONFIG }));

test('xuất JSON và import trở lại giữ nguyên cấu hình', () => {
  const original = { ...DEFAULT_CONFIG, mode: 'vortex' as const, backendPreference: 'webgl2' as const };
  expect(parsePreset(serializePreset(original))).toEqual(original);
});

test('JSON không hợp lệ bị từ chối', () => {
  expect(() => parsePreset('{invalid')).toThrow(/JSON/);
});

test('preset sai schema bị từ chối', () => {
  const preset = { schemaVersion: 2, app: '3D-WEB-05', config: makePreset().config };
  expect(() => parsePreset(JSON.stringify(preset))).toThrow(/định dạng/);
});

test('không chấp nhận số particle vượt phạm vi', () => {
  const data = makePreset();
  data.config.particleCount = 100000000;
  expect(() => parsePreset(JSON.stringify(data))).toThrow(/Số particle/);
});

test('chấp nhận hai biên particle hợp lệ', () => {
  const low = makePreset();
  low.config.particleCount = 1000;
  const high = makePreset();
  high.config.particleCount = 50000;
  expect(parsePreset(JSON.stringify(low)).particleCount).toBe(1000);
  expect(parsePreset(JSON.stringify(high)).particleCount).toBe(50000);
});

test('không chấp nhận particle không theo bước 1.000', () => {
  const data = makePreset();
  data.config.particleCount = 1500;
  expect(() => parsePreset(JSON.stringify(data))).toThrow(/Số particle/);
});

test('không chấp nhận màu sai định dạng', () => {
  const data = makePreset();
  data.config.particleColor = '<script>';
  expect(() => parsePreset(JSON.stringify(data))).toThrow(/Màu/);
});

test('không chấp nhận hệ số ngoài phạm vi', () => {
  const data = makePreset();
  data.config.strength = Infinity;
  expect(() => parsePreset(JSON.stringify(data))).toThrow(/Cường độ/);
});

test('không chấp nhận backend hoặc mode ngoài danh sách', () => {
  const backend = makePreset();
  backend.config.backendPreference = 'canvas2d';
  expect(() => parsePreset(JSON.stringify(backend))).toThrow(/backend/);

  const mode = makePreset();
  mode.config.mode = 'free';
  expect(() => parsePreset(JSON.stringify(mode))).toThrow(/mode/);
});

test('không chấp nhận trường thừa hoặc thiếu trường bắt buộc', () => {
  const extra = makePreset();
  extra.config.debug = true;
  expect(() => parsePreset(JSON.stringify(extra))).toThrow(/không được hỗ trợ/);

  const missing = makePreset();
  delete missing.config.speed;
  expect(() => parsePreset(JSON.stringify(missing))).toThrow(/thiếu trường/);
});

test('không chấp nhận tốc độ và kích thước ngoài phạm vi', () => {
  const speed = makePreset();
  speed.config.speed = 3.1;
  expect(() => parsePreset(JSON.stringify(speed))).toThrow(/Tốc độ/);

  const size = makePreset();
  size.config.particleSize = 0.5;
  expect(() => parsePreset(JSON.stringify(size))).toThrow(/Kích thước/);
});
