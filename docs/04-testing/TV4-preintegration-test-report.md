# Báo cáo kiểm thử TV4 pre-integration

**Ngày chạy:** 10/10/2026
**Nhánh:** feat/tv4-week1-ui-ux
**Môi trường:** Windows, Node theo repo, Vite 6.4.4, Chrome headless local.

## Kết quả tự động

| Hạng mục | Kết quả |
|---|---|
| npm run typecheck | Đạt |
| npm test | Đạt 17/17 |
| npm run build | Đạt; 14 modules transformed |
| JS bundle | 21.35 kB, gzip 7.32 kB |
| CSS bundle | 11.95 kB, gzip 3.69 kB |

## Kết quả trực quan

| Ảnh | Nội dung xác minh | Kết quả |
|---|---|---|
| preintegration-desktop-1440x1000.png | desktop default, two-column | Đạt |
| state-fallback-1440x1000.png | warning fallback và nhãn UI fixture | Đạt |
| preintegration-mobile-500x844.png | mobile stack, cards không tràn ngang | Đạt |
| state-error-500x844.png | alert error, không lộ stack trace | Đạt |

- Canvas2D mock được ghi rõ, không bị trình bày như WebGPU.
- Fallback/error có nội dung chữ, không chỉ dựa vào màu.
- Mobile 500 px không có tràn ngang; có cuộn dọc theo thiết kế.
- Fixture WebGPU/WebGL2 không hiển thị số FPS/GPU timing giả.

## Giới hạn

- Chrome headless cần no-sandbox để ghi ảnh trong môi trường kiểm thử cục bộ bị giới hạn quyền; chỉ truy cập 127.0.0.1.
- Chưa có automation DOM/E2E; keyboard/import file vẫn nằm trong checklist manual.
- Ảnh chứng minh UI state, không chứng minh engine WebGPU/WebGL2 hoặc benchmark.
