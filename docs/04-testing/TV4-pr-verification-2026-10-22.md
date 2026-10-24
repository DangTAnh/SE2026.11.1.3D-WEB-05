# TV4 — kiểm tra trước PR, 22/10/2026

Phạm vi: bản sao độc lập của ba commit TV4, đã chuyển lên baseline
`develop@99f2398`. Product tree tại `0b5b6bd` trùng TV4 gốc `3c2b00e`.
Không sửa code, dependency hoặc test để đạt kết quả này.

Môi trường: Windows, Node.js `22.16.0`, npm `11.10.1`;
Vitest `5.0.3`, Playwright `1.64.0`, Vite `6.4.4` theo lockfile.

| Lệnh/kiểm tra thực chạy ngày 22/10 | Kết quả |
|---|---|
| `npm ci --no-audit --no-fund` | PASS, 46 packages |
| `npm run verify` | PASS, exit 0 |
| `npm run typecheck` | PASS |
| `npm run typecheck:tests` | PASS |
| `npm test` | PASS, 2 file, 17/17 tests |
| `npm run test:e2e` | PASS, 10/10 tests, 6 workers, 18.3s |
| Accessibility trong E2E | PASS, desktop/mobile × 4 trạng thái, 0 axe violations |
| `npm run build` | PASS, 190 modules transformed |
| `git diff --check origin/develop HEAD` | PASS trước cập nhật tài liệu |

Desktop Chromium: viewport 1440×1000. Mobile Chromium: viewport 500×844,
touch/mobile emulation; không phải kiểm tra trên điện thoại vật lý.
Test `@evidence` bị loại theo script chính thức; không tạo lại ảnh lịch sử.
Không tăng timeout, không thêm retry hoặc giảm worker để đạt lần chạy này.

Kết quả chỉ chứng minh UI mock/fixtures/preset/build. WebGPU/WebGL2 thật,
physics, GPU timing, benchmark, Firefox/WebKit và kiểm tra accessibility thủ
công **NOT_RUN**. Không có CI workflow trong nhánh TV4/develop tại thời điểm
chuẩn bị PR; workflow của TV1 chưa được tích hợp.

BL01 lịch sử vẫn OPEN. Một lần E2E xanh không chứng minh nguyên nhân flaky
cũ đã được giải quyết. R-GL-LIFECYCLE không thuộc phạm vi UI test này.
