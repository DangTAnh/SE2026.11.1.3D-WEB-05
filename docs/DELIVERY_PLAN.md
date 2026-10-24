# DELIVERY PLAN — TV4 pre-integration

## Wave 1 — hoàn thiện độc lập engine

- Tách template, controls, notifications, runtime overlay/state.
- Chốt preset JSON Schema v1 và unit tests.
- Hoàn thiện state/error/accessibility/responsive.
- Cập nhật tài liệu, ownership, test cases và handover.

**Exit gate:** typecheck, unit tests, build đạt; desktop/mobile và state fixture không có lỗi chặn.

**Bổ sung 11/10/2026:** Ajv, Vitest, Playwright Chromium và axe-core đã tự động hóa validation, unit test, UI fixture, accessibility và ảnh minh chứng. E2E engine/benchmark thật vẫn thuộc Wave 3.

## Wave 2 — contract review cùng nhóm

- TV1: adapter lifecycle và actual backend state.
- TV2/TV3: mode, ranges, backend transition/fallback reason.
- TV5: PerformanceSnapshot và test/benchmark policy.

**Exit gate:** interface và owner được ghi bằng quyết định chung; không còn field mơ hồ.

## Wave 3 — integration

- Thay Canvas2D mock bằng engine port tại composition root.
- Nối actual backend và metrics thật.
- Mở rộng E2E fixture hiện có sang engine ready/fallback/error và metric thật.

**Exit gate:** UI không import chi tiết engine; không có metric giả; regression checks đạt.

## Wave 4 — PR và release evidence

- Chụp evidence cuối trên engine thật.
- Cập nhật báo cáo kiểm thử.
- Commit/push trên nhánh feat/tv4-week1-ui-ux, tạo PR vào nhánh nhóm xác nhận.

Không chỉnh trực tiếp main hoặc develop; không mở PR cho đến khi người dùng cho phép.
