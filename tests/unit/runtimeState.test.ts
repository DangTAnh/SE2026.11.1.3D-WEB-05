import { expect, test } from 'vitest';
import { createInitializingRuntimeState, createRendererRuntimeState, formatFps, formatGpuTiming } from '../../src/ui/state/runtimeState.ts';
import { MAX_GPU_MEASUREMENT_AGE_MS, type RendererStatus } from '../../src/core/renderer/RendererPort.ts';

const ready: RendererStatus = {
  actual: 'webgpu', requested: 'auto', running: true, fps: 59.6,
  gpuTimingAvailable: true, measurementAgeMs: 0, gpuTimeMs: 4.126,
};

test('pending initialization has no backend claim or measurements and disables simulation controls', () => {
  const state = createInitializingRuntimeState();
  expect(state.phase).toBe('initializing');
  expect(state.actualBackend).toBe('unavailable');
  expect(state.fps).toBeNull();
  expect(state.gpuTimeMs).toBeNull();
  expect(state.controlsDisabled).toBe(true);
  expect(formatGpuTiming(state)).toBe('Không khả dụng');
});

for (const actual of ['webgpu', 'webgl2', 'unavailable'] as const) {
  for (const requested of ['auto', 'webgpu', 'webgl2'] as const) {
    test(`actual ${actual} stays authoritative when requested ${requested}`, () => {
      const state = createRendererRuntimeState({ ...ready, actual, requested });
      expect(state.actualBackend).toBe(actual);
      expect(state.phase).toBe(actual === 'unavailable' ? 'unsupported'
        : actual === 'webgl2' && requested !== 'webgl2' ? 'fallback' : 'ready');
      expect(state.controlsDisabled).toBe(actual === 'unavailable');
      if (actual === 'unavailable') {
        expect(state.fps).toBeNull();
        expect(state.gpuTimeMs).toBeNull();
      }
    });
  }
}

test('ready measurements are formatted from current status', () => {
  const state = createRendererRuntimeState(ready);
  expect(formatFps(state)).toBe('60 FPS');
  expect(formatGpuTiming(state)).toBe('4.13 ms');
});

test('unavailable timing overrides a numeric value from an inconsistent producer', () => {
  const state = createRendererRuntimeState({ ...ready, gpuTimingAvailable: false });
  expect(state.gpuTimeMs).toBeNull();
  expect(formatGpuTiming(state)).toBe('Không khả dụng');
});

test('stale GPU timing is hidden even when the producer still marks it available', () => {
  const state = createRendererRuntimeState({ ...ready, measurementAgeMs: MAX_GPU_MEASUREMENT_AGE_MS + 1 });
  expect(state.gpuTimingAvailable).toBe(false);
  expect(state.gpuTimeMs).toBeNull();
  expect(formatGpuTiming(state)).toBe('Không khả dụng');
});

test('GPU timing without a measurement age is not displayed', () => {
  const state = createRendererRuntimeState({ ...ready, measurementAgeMs: null });
  expect(state.gpuTimingAvailable).toBe(false);
  expect(state.gpuTimeMs).toBeNull();
});

for (const invalid of [null, NaN, Infinity, -1]) {
  test(`invalid metric ${invalid} cannot become a measurement`, () => {
    const state = createRendererRuntimeState({ ...ready, fps: invalid, gpuTimeMs: invalid });
    expect(state.fps).toBeNull();
    expect(state.gpuTimeMs).toBeNull();
    expect(state.gpuTimingAvailable).toBe(false);
    expect(formatFps(state)).toBe('—');
    expect(state.fpsDetail).toBe('Không có số đo hợp lệ');
    expect(formatGpuTiming(state)).toBe('Không khả dụng');
  });
}

test('pause hides the last frame measurements and keeps resume enabled', () => {
  const state = createRendererRuntimeState({ ...ready, running: false });
  expect(state.fps).toBeNull();
  expect(state.gpuTimeMs).toBeNull();
  expect(state.gpuTimingAvailable).toBe(false);
  expect(state.controlsDisabled).toBe(false);
  expect(state.fpsDetail).toContain('tạm dừng');
  expect(state.gpuTimingDetail).toContain('tạm dừng');
});

test('zero timing is unavailable even when the producer marks it available', () => {
  const state = createRendererRuntimeState({ ...ready, gpuTimeMs: 0 });
  expect(state.gpuTimeMs).toBeNull();
  expect(state.gpuTimingAvailable).toBe(false);
  expect(formatGpuTiming(state)).toBe('Không khả dụng');
});

test('a small positive timing is not rounded down to a zero measurement', () => {
  expect(formatGpuTiming(createRendererRuntimeState({ ...ready, gpuTimeMs: 0.004 }))).toBe('<0.01 ms');
});

test('missing renderer and renderer errors stay unavailable with safe explanations', () => {
  expect(createRendererRuntimeState().phase).toBe('unsupported');
  const failure = createRendererRuntimeState(ready, true);
  expect(failure.phase).toBe('error');
  expect(failure.actualBackend).toBe('unavailable');
  expect(failure.fps).toBeNull();
  expect(failure.gpuTimeMs).toBeNull();
  expect(failure.controlsDisabled).toBe(true);
  expect(failure.backendDetail).toBe('Không đọc được trạng thái renderer');
});
