# Bàn giao TV4 — pre-integration

**Ngày:** 10/10/2026
**Cập nhật công cụ:** 11/10/2026
**Nhánh:** feat/tv4-week1-ui-ux

## Thành phần sẵn sàng ghép

- src/ui/app.ts: composition UI tạm.
- src/ui/template.ts: cấu trúc và semantics.
- src/ui/controls/controlBindings.ts: controls và preset actions.
- src/ui/state/runtimeState.ts: view-model và fixtures UI.
- src/ui/overlays/statusOverlay.ts: backend/metrics/notice.
- src/ui/notifications.ts: toast status/error.
- src/ui/styles/tokens.css: tokens/accessibility/responsive.
- src/presets/preset.ts: contract đề xuất và validation JSON Schema v1 qua Ajv.
- tests/unit/: 17 test chạy bằng Vitest.
- tests/e2e/ui.spec.ts: Playwright desktop/mobile, preset, fixtures, axe-core và ảnh evidence.

## Điểm nối dành cho TV1/TV3/TV5

1. Giữ LabConfig là dữ liệu vào; xác nhận field/range trước khi gọi engine.
2. Viết adapter ánh xạ engine status sang UiRuntimeState.
3. Chỉ đưa FPS/GPU timing đã đo thật vào state.
4. Giữ query fixture phục vụ E2E, nhưng không dùng làm bằng chứng engine.
5. Thay bootstrap ở src/main.ts tại composition root; không để engine import module DOM.

## Chưa được xem là hoàn thành

- WebGPU/WebGL2 renderer/fallback thật.
- Physics production và 10k–50k particle thật.
- GPU timing/benchmark.
- E2E trên engine thật, multi-browser và benchmark (automation UI fixture đã có).
- Chiến lược merge với main/develop.

## Tài liệu bắt buộc đọc khi review

- docs/02-design/ui-interaction-spec.md
- docs/02-design/ui-state-matrix.md
- docs/02-design/preset-schema-v1.schema.json
- docs/04-testing/TV4-ui-test-cases.md
- docs/04-testing/TV4-tooling-upgrade-test-report.md
- docs/03-research/tooling-adoption.md
- docs/PROJECT_STATUS.md
- docs/RISK_REGISTER.md
