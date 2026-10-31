import { MAX_GPU_MEASUREMENT_AGE_MS, type RendererStatus } from '../../core/renderer/RendererPort.ts';
import type { ActualBackend } from '../../core/types/backend.ts';

export type RuntimePhase = 'initializing' | 'ready' | 'fallback' | 'unsupported' | 'error';
export type RuntimeNoticeTone = 'info' | 'warning' | 'error';

export interface RuntimeNotice {
  title: string;
  message: string;
  tone: RuntimeNoticeTone;
}

/** UI projection of renderer facts; contains no synthetic backend or metrics. */
export interface UiRuntimeState {
  phase: RuntimePhase;
  actualBackend: ActualBackend;
  backendLabel: string;
  backendDetail: string;
  fps: number | null;
  fpsDetail: string;
  gpuTimeMs: number | null;
  gpuTimingAvailable: boolean;
  gpuTimingDetail: string;
  controlsDisabled: boolean;
  notice?: RuntimeNotice;
}

/** Composition has prepared the canvas but has not supplied an initialized port yet. */
export function createInitializingRuntimeState(): UiRuntimeState {
  return {
    phase: 'initializing', actualBackend: 'unavailable',
    backendLabel: 'Đang khởi tạo', backendDetail: 'Đang chờ renderer xác nhận backend',
    fps: null, fpsDetail: 'Chưa có số đo', gpuTimeMs: null,
    gpuTimingAvailable: false, gpuTimingDetail: 'Không khả dụng', controlsDisabled: true,
    notice: { tone: 'info', title: 'Đang khởi tạo renderer',
      message: 'Số đo sẽ xuất hiện khi renderer sẵn sàng và báo dữ liệu hợp lệ.' },
  };
}

export function formatFps(state: UiRuntimeState): string {
  return state.fps === null ? '—' : `${Math.round(state.fps)} FPS`;
}

export function formatGpuTiming(state: UiRuntimeState): string {
  if (!state.gpuTimingAvailable || state.gpuTimeMs === null) return 'Không khả dụng';
  if (state.gpuTimeMs < 0.005) return '<0.01 ms';
  return `${state.gpuTimeMs.toFixed(2)} ms`;
}

export function createRendererRuntimeState(status?: RendererStatus, failed = false): UiRuntimeState {
  if (failed || !status || status.actual === 'unavailable') {
    return {
      phase: failed ? 'error' : 'unsupported', actualBackend: 'unavailable',
      backendLabel: failed ? 'Lỗi renderer' : 'Không khả dụng',
      backendDetail: failed ? 'Không đọc được trạng thái renderer'
        : status ? 'Không có backend đồ họa phù hợp' : 'Renderer chưa được kết nối',
      fps: null, fpsDetail: 'Mô phỏng chưa chạy', gpuTimeMs: null,
      gpuTimingAvailable: false, gpuTimingDetail: 'Không khả dụng',
      controlsDisabled: true,
      notice: {
        tone: 'error', title: failed ? 'Renderer gặp lỗi' : 'Renderer chưa sẵn sàng',
        message: 'Bạn vẫn có thể nhập và xuất preset. Mô phỏng cần renderer được khởi tạo từ ứng dụng.',
      },
    };
  }
  const fallback = status.actual === 'webgl2' && status.requested !== 'webgl2';
  const measurementAgeMs = status.measurementAgeMs;
  const gpuTimingAvailable = status.running && status.gpuTimingAvailable && status.gpuTimeMs !== null
    && Number.isFinite(status.gpuTimeMs) && status.gpuTimeMs > 0
    && measurementAgeMs !== null && Number.isFinite(measurementAgeMs)
    && measurementAgeMs >= 0 && measurementAgeMs <= MAX_GPU_MEASUREMENT_AGE_MS;
  const fps = status.running && status.fps !== null && Number.isFinite(status.fps) && status.fps >= 0
    ? status.fps : null;
  return {
    phase: fallback ? 'fallback' : 'ready', actualBackend: status.actual,
    backendLabel: status.actual === 'webgpu' ? 'WebGPU' : fallback ? 'WebGL2 fallback' : 'WebGL2',
    backendDetail: fallback ? 'Renderer báo đang dùng WebGL2 thay cho WebGPU' : 'Backend do renderer báo cáo',
    fps,
    fpsDetail: !status.running ? 'Mô phỏng đang tạm dừng'
      : fps === null ? 'Không có số đo hợp lệ' : 'Dữ liệu từ renderer',
    gpuTimeMs: gpuTimingAvailable ? status.gpuTimeMs : null,
    gpuTimingAvailable,
    gpuTimingDetail: !status.running ? 'Mô phỏng đang tạm dừng'
      : gpuTimingAvailable ? 'Dữ liệu từ renderer' : 'Không khả dụng',
    controlsDisabled: false,
    ...(fallback ? { notice: { tone: 'warning' as const, title: 'Đã chuyển sang WebGL2',
      message: 'Backend thực tế do renderer xác nhận; lựa chọn mới chỉ áp dụng khi khởi tạo lại.' } } : {}),
  };
}
