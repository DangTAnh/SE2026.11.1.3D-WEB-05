# [TV4] UI/presets, pre-integration và quality tooling vào develop

## Kết quả

Đưa đầy đủ ba commit TV4 vào baseline `develop`: UI responsive và controls,
Canvas2D mock có nhãn rõ, preset JSON Schema v1/Ajv, runtime view-model,
status/notification, tài liệu UX/bàn giao, Vitest và Playwright/axe-core.
Thêm snapshot tiến độ GitHub và biên bản kiểm tra ngày 22/10/2026.

## Vì sao dùng nhánh này

`feat/tv4-week1-ui-ux` và `develop` không có chung lịch sử nên GitHub không
mở PR trực tiếp được. Nhánh `codex/tv4-into-develop` bắt đầu từ
`develop@99f2398`, cherry-pick đúng `11eedfd`, `adfca0d`, `3c2b00e`.
Tree trước cập nhật tài liệu trùng hoàn toàn TV4 cục bộ `3c2b00e`.
Nhánh TV4 gốc được giữ nguyên; không force-push, không merge unrelated
histories và không đưa code TV1 lưu trữ vào gói này.

## Kiểm tra ngày 22/10/2026

`npm ci` và `npm run verify` PASS trên Windows/Node 22.16.0:

- Typecheck source và tests: PASS.
- Vitest: 17/17 tests.
- Playwright: 10/10 tests desktop/mobile Chromium, 6 workers.
- axe-core trong E2E: 2 viewport × 4 trạng thái, 0 violations.
- Build: PASS, Vite 6.4.4.

[Biên bản](../04-testing/TV4-pr-verification-2026-10-22.md).
Ảnh có sẵn là evidence lịch sử, không tạo lại hôm nay.
Nhánh này chưa có CI workflow; kiểm tra trên là kiểm tra cục bộ.

## Cần DangTAnh review

- [ ] Phạm vi gói UI prototype/preset/tooling và scaffold dùng chung.
- [ ] `LabConfig`/ranges và kế hoạch nối UI qua `RendererPort`.
- [ ] Thống nhất unknown-key policy trước ghép TV1: TV4 reject, contract test
  TV1 hiện yêu cầu drop trường lạ.
- [ ] Thống nhất Vitest/Playwright với `node:test` bên TV1 và giữ đủ tests.
- [ ] Thứ tự tích hợp và nội dung chung README/package/lock/bootstrap/specs;
  không lấy nguyên một phía khi giải quyết xung đột sau này.

## Giới hạn

Chưa có GPU engine, physics production, GPU timing, collector hay benchmark
hai backend. Fixtures không chứng minh fallback/GPU đang chạy.
PR này không duyệt G1/G2 hay nghiệm thu FR GPU; BL01 và R-GL-LIFECYCLE trong
hồ sơ cục bộ vẫn OPEN.

[Tiến độ theo từng nhánh và việc tiếp theo](github-progress-2026-10-22.md).
