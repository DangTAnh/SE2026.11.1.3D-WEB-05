# DELIVERY PLAN — TV4 pre-integration

## Current delivery procedure — 24 October 2026

Follow [CONTRIBUTING](../CONTRIBUTING.md): one assigned Issue, a numbered branch
from latest dev, small English Conventional Commits, G0 before push, PR into
dev, and another person's approval before merge. The older waves below describe
the historical pre-integration plan; their branch/PR instructions are superseded.

TV4 checkpoint, 25 October: #9/#25 merged in #32; #14 source candidate is #33,
now integrating dev `04f1522` with #12/#13/#15. Its runtime dependency is no
longer the placeholder port; updated evidence and independent review gate remain.
#16 waits for TV1 hash scope and TV2/TV3 Vortex mapping. #36 records
workflow/branch corrections; #37 tracks the collector test-clock flake.
See [current checkpoint](05-management/workflow-audit-2026-10-24.md) for evidence
and ordered next actions. No accepted GPU milestone or deployment is claimed.

## Historical plan

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
