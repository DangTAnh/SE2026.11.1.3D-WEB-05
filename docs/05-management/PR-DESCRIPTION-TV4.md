# [TV4] Week 1 — UI/UX Use Cases + Wireframes + Prototype

## Tóm tắt

- Khởi tạo scaffold thư mục làm việc chung (đề xuất; chưa áp đặt kiến trúc nhóm).
- Phân tích yêu cầu UI, lập danh sách Use Cases và wireframes.
- Dựng trang Particle Lab responsive bằng Vite + TypeScript + Canvas2D **mock**.
- Controls mode/count/speed/size/color/strength và backend preference.
- Export/import preset JSON được Ajv kiểm tra trực tiếp theo JSON Schema v1.
- Bổ sung Vitest, Playwright và axe-core để tự động hóa kiểm thử UI desktop/mobile, accessibility và ảnh minh chứng.

## Hành vi đã kiểm tra

- [x] Chạy UI bằng `npm run dev` trên máy Windows.
- [x] `npm run typecheck`
- [x] `npm run typecheck:tests`
- [x] `npm test` — 17/17 unit tests đạt bằng Vitest.
- [x] `npm run test:e2e` — 10/10 tests đạt trên Chromium desktop/mobile.
- [x] `npm run test:a11y` — 2 viewport × 4 trạng thái, 0 axe-core violation.
- [x] `npm run build`
- [x] Tạo bốn ảnh minh chứng tự động desktop/mobile trong `docs/04-testing/screenshots/`.

Chi tiết mới nhất: `docs/04-testing/TV4-tooling-upgrade-test-report.md`.

## Ngoài phạm vi PR

- WebGPU/Three.js/TSL computation thực; fallback WebGL2; GPU timing và benchmark.

## Cần review từ nhóm

1. TV1: scaffold, bootstrap, dữ liệu chung `LabConfig`.
2. TV2/TV3: mode, cấu hình simulation, backend preference.
3. TV5: hiển thị perf metrics và test cases.

## Lưu ý

`src/main.ts` chỉ là bootstrap tạm của demo TV4. Không merge đè lên bootstrap có sẵn nếu nhóm đã thêm code trước thời điểm PR.
