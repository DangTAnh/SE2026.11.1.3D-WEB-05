import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createRuntimeState,
  formatFps,
  formatGpuTiming,
  resolveRuntimeFixture,
  withPreviewFps,
} from '../../src/ui/state/runtimeState.ts';

test('query không hợp lệ quay về Canvas2D mock', () => {
  assert.equal(resolveRuntimeFixture('?uiState=unknown'), 'canvas-mock');
  assert.equal(resolveRuntimeFixture(''), 'canvas-mock');
});

test('fixture nhận đúng từ query string', () => {
  assert.equal(resolveRuntimeFixture('?foo=1&uiState=fallback-webgl2'), 'fallback-webgl2');
  assert.equal(resolveRuntimeFixture('?uiState=error'), 'error');
});

test('trạng thái lỗi và unsupported khóa điều khiển', () => {
  for (const fixture of ['initializing', 'unsupported', 'error'] as const) {
    const state = createRuntimeState(fixture);
    assert.equal(state.controlsDisabled, true);
    assert.equal(state.fps, null);
    assert.equal(state.gpuTimeMs, null);
  }
});

test('fixture backend không tạo số hiệu năng giả', () => {
  for (const fixture of ['ready-webgpu', 'fallback-webgl2'] as const) {
    const state = createRuntimeState(fixture);
    assert.equal(formatFps(state), '—');
    assert.equal(formatGpuTiming(state), 'Không khả dụng');
    assert.match(state.fpsDetail, /Không tạo|Chờ/);
  }
});

test('chỉ Canvas2D mock nhận FPS từ preview', () => {
  const canvas = withPreviewFps(createRuntimeState('canvas-mock'), 59.6);
  assert.equal(formatFps(canvas), '60 FPS');

  const fixture = createRuntimeState('ready-webgpu');
  assert.equal(withPreviewFps(fixture, 60), fixture);
});

test('GPU timing chỉ hiển thị khi adapter xác nhận khả dụng', () => {
  const state = {
    ...createRuntimeState('ready-webgpu'),
    gpuTimingAvailable: true,
    gpuTimeMs: 4.126,
  };
  assert.equal(formatGpuTiming(state), '4.13 ms');
});
