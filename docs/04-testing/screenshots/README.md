# Ảnh minh chứng UI tuần 1 — TV4

- `desktop-1440x1000.png`: giao diện desktop hai cột tại viewport 1440 × 1000.
- `mobile-500x844.png`: giao diện mobile một cột tại viewport 500 × 844.

Ảnh được chụp từ UI prototype chạy local bằng Vite ngày 09/10/2026. Responsive cũng đã được kiểm tra trực tiếp ở viewport 390 × 844; ảnh lưu dùng 500 px để tránh giới hạn chiều rộng tối thiểu của Edge headless. Đây là Canvas2D mock, không phải bằng chứng WebGPU/WebGL2 hoặc benchmark GPU.

## Pre-integration v0.2 — 10/10/2026

- `preintegration-desktop-1440x1000.png`: desktop default sau khi tách module/state.
- `state-fallback-1440x1000.png`: fixture fallback WebGL2, có warning và nhãn UI fixture.
- `preintegration-mobile-500x844.png`: mobile default, kiểm tra card/scroll.
- `state-error-500x844.png`: mobile error, alert không lộ stack trace.

Các ảnh fixture chỉ là bằng chứng UI, không phải bằng chứng backend GPU thật.
