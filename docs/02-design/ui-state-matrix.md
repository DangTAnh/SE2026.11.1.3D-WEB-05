# Ma trận trạng thái UI runtime — TV4 v0.2

**Cập nhật:** 10/10/2026
**Phạm vi:** view-model và nội dung hiển thị của UI; không phải contract engine đã chốt.

## Trạng thái và hành vi

| Fixture | Phase | Backend hiển thị | Controls simulation | FPS/GPU timing | Thông báo |
|---|---|---|---|---|---|
| canvas-mock | ready | Canvas 2D (mockup) | Bật | FPS preview thật; GPU N/A | Không |
| initializing | initializing | Đang khởi tạo | Khóa | Không có số | Info, chờ Core |
| ready-webgpu | ready | WebGPU (fixture UI) | Bật | Không tạo số giả | Info, ghi rõ fixture |
| fallback-webgl2 | fallback | WebGL2 fallback (fixture UI) | Bật | Không tạo số giả | Warning + lý do minh họa |
| unsupported | unsupported | Không khả dụng | Khóa | Không khả dụng | Alert, hướng dẫn an toàn |
| error | error | Lỗi khởi tạo | Khóa | Không khả dụng | Alert, không lộ stack trace |

Mở fixture bằng query, ví dụ /?uiState=fallback-webgl2 hoặc /?uiState=error. Query lạ quay về canvas-mock.

## Quy tắc nội dung

- Luôn tách backend được yêu cầu và backend thực tế.
- Chỉ hiển thị FPS/GPU timing khi adapter cung cấp số đo thật. Fixture không có số giả.
- Error/unsupported dùng role alert; trạng thái thường dùng role status.
- Khi initializing/error/unsupported, khóa control simulation nhưng vẫn cho import/export preset và đổi backend preference.
- Không hiển thị stack trace, tên driver nội bộ hoặc dữ liệu có thể gây nhầm là benchmark.

## Ranh giới tích hợp

src/ui/state/runtimeState.ts là view-model nội bộ của TV4. TV1/TV3/TV5 có thể viết adapter từ trạng thái engine/performance thật sang UiRuntimeState; engine không nên import module DOM.

- TV1/TV3 cấp phase, actualBackend, backendDetail và lý do fallback/lỗi an toàn.
- TV5 cấp fps, gpuTimeMs, gpuTimingAvailable và mô tả unavailable.
- TV4 chịu trách nhiệm render, nội dung, accessibility và trạng thái controls.
