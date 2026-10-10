# Test cases UI pre-integration — TV4

**Cập nhật:** 10/10/2026

## Tự động hóa hiện có

| ID | Truy vết | Case | Kết quả mong đợi |
|---|---|---|---|
| UT-P01 | UI-FR-06/07 | export/import roundtrip | giữ nguyên config |
| UT-P02 | UI-FR-07 | JSON/schema/app sai | từ chối, thông báo rõ |
| UT-P03 | UI-FR-07 | min/max/step/range sai | từ chối |
| UT-P04 | UI-FR-07 | mode/backend/màu sai | từ chối |
| UT-P05 | UI-FR-07 | trường thừa/thiếu | từ chối theo schema v1 |
| UT-S01 | UI-FR-10 | query fixture hợp lệ/lạ | chọn đúng state/default |
| UT-S02 | UI-FR-04/05 | fixture WebGPU/WebGL2 | không tạo metric giả |
| UT-S03 | UI-FR-10 | initializing/error/unsupported | khóa simulation controls |
| UT-S04 | UI-FR-05 | Canvas preview FPS | chỉ state mock được nhận FPS |

## Checklist trình duyệt

| ID | Viewport/state | Thao tác | Tiêu chí đạt |
|---|---|---|---|
| UI-01 | Desktop 1440×1000 | mở mặc định | không tràn; backend ghi Canvas2D mock |
| UI-02 | Mobile 500×844 | cuộn toàn trang | panel truy cập được; không tràn ngang |
| UI-03 | Mobile 390×844 | kiểm tra preset actions | nút xếp dọc, touch target đủ |
| UI-04 | initializing | thử mode/slider/pause/reset | control simulation bị khóa |
| UI-05 | ready-webgpu | quan sát metrics | backend có nhãn fixture, FPS là dấu gạch |
| UI-06 | fallback-webgl2 | quan sát banner | warning có chữ và màu; nêu lý do |
| UI-07 | unsupported | tab qua controls | alert đọc được; export/import còn dùng |
| UI-08 | error | quan sát banner | không có stack trace/thông tin nội bộ |
| UI-09 | mặc định | keyboard Tab | focus nhìn thấy rõ |
| UI-10 | reduced motion | bật preference | UI không có motion không cần thiết |
| UI-11 | preset | import file lớn/sai schema | state cũ giữ nguyên, toast error |
| UI-12 | preset | export rồi import | control phục hồi đúng |

DOM/browser automation chưa thêm vì repo chưa có framework DOM/E2E. Các fixture cho phép TV5 nối Playwright/Vitest sau mà không cần mock engine.
