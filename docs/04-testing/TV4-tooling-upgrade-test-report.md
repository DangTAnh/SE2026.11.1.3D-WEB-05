# Báo cáo kiểm thử nâng cấp công cụ TV4

**Ngày chạy:** 11/10/2026
**Nhánh:** `feat/tv4-week1-ui-ux`
**Môi trường:** Windows, Node >=22.16, Vite 6.4.4, Chromium 156 do Playwright quản lý.

## Phạm vi thay đổi

- Ajv thay validation preset viết tay và compile trực tiếp JSON Schema v1.
- Vitest thay Node test runner, giữ 17 case hành vi.
- Playwright tự động hóa interaction, responsive, runtime fixtures và preset import/export.
- axe-core quét WCAG A/AA trên desktop/mobile.
- Playwright tạo bốn ảnh minh chứng `automated-*` mà không ghi đè ảnh lịch sử.

## Kết quả

| Kiểm tra | Kết quả |
|---|---|
| `npm run typecheck` | Đạt |
| `npm test` | Đạt 17/17, 2 test files |
| `npm run test:e2e` | Đạt 10/10 trên desktop/mobile Chromium |
| axe-core WCAG A/AA | Đạt 2 viewport × 4 state, không còn violation tự động |
| `npm run evidence:screenshots` | Đạt 2/2 test, tạo 4 ảnh |
| `npm run build` | Đạt, Vite 6.4.4 |
| Dependency audit lúc cài | 0 vulnerability được npm báo cáo |

## Lỗi được phát hiện và xử lý

Lần chạy axe-core đầu phát hiện chữ phụ ở info card, scale và footer có contrast 4.04–4.4:1, thấp hơn ngưỡng WCAG AA 4.5:1. Các màu chữ phụ đã được nâng nhẹ trong `tokens.css`; lần chạy lại đạt trên cả hai viewport.

## Ảnh tự động

- `automated-desktop-1440x1000.png`
- `automated-fallback-1440x1000.png`
- `automated-mobile-500x844.png`
- `automated-error-500x844.png`

## Giới hạn còn lại

- Chỉ Chromium được cài để giảm dung lượng và thời gian; Firefox/WebKit được hoãn.
- axe-core không chứng minh trải nghiệm screen reader hoặc toàn bộ luồng keyboard.
- Các fixture không chứng minh backend WebGPU/WebGL2, GPU timing hay benchmark thật.
- Ajv làm bundle lớn hơn baseline; cần đánh giá lại sau khi engine thật được ghép và có ngân sách hiệu năng tổng thể.
