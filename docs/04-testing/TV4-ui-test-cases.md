# Test cases UI — TV4

**Cập nhật:** 24/10/2026. Các case runtime dùng FakeRenderer được inject tại
`tests/e2e/fixtures/renderer-port.html`; không dùng query fixture hoặc Canvas2D
mock trong production. Adapter #12 và fallback #13 đã tích hợp; E2E production
WebGL2 kiểm số FPS sống và pause/resume. WebGPU vẫn cần máy có adapter phù hợp.

## Unit test tự động bằng Vitest

| ID | Truy vết | Case | Kết quả mong đợi |
|---|---|---|---|
| UT-P01 | UI-FR-06/07 | export/import roundtrip | giữ nguyên config |
| UT-P02 | UI-FR-07 | JSON/schema/app sai | từ chối, thông báo rõ |
| UT-P03 | UI-FR-07 | min/max/step/range sai | từ chối |
| UT-P04 | UI-FR-07 | mode/backend/màu sai | từ chối |
| UT-P05 | UI-FR-07 | trường thừa/thiếu | từ chối theo schema v1 |
| UT-S01 | UI-FR-10 | `actual`/`requested` qua RendererStatus | chọn đúng ready/fallback/unsupported |
| UT-S02 | UI-FR-04/05 | số đo hợp lệ/không hợp lệ và tạm dừng | không giữ metric cũ hoặc nhãn nguồn sai |
| UT-S03 | UI-FR-10 | error/unsupported | khóa simulation controls |
| UT-S04 | UI-FR-05 | timing không khả dụng/zero không hợp lệ | `null` và `0` hiện “Không khả dụng”; số dương rất nhỏ không bị làm tròn thành 0 |
| UT-S05 | UI-FR-10 | init chưa hoàn tất | loading, không claim backend/metric, khóa controls |

## Checklist trình duyệt

| ID | Viewport/state | Thao tác | Tiêu chí đạt |
|---|---|---|---|
| UI-01 | Desktop 1440×1000 | mở mặc định | không tràn; backend lấy từ port hoặc báo không khả dụng |
| UI-02 | Mobile 500×844 | cuộn toàn trang | panel truy cập được; không tràn ngang |
| UI-03 | Mobile 390×844 | kiểm tra preset actions | nút xếp dọc, touch target đủ |
| UI-04 | unsupported/error | thử mode/slider/pause/reset | control simulation bị khóa |
| UI-05 | ready qua FakeRenderer | quan sát metrics | số đo chỉ hiện khi producer báo hợp lệ |
| UI-06 | fallback qua FakeRenderer | quan sát banner | warning có chữ và màu; nêu lý do |
| UI-07 | unsupported | tab qua controls | alert đọc được; export/import còn dùng |
| UI-08 | error | quan sát banner | không có stack trace/thông tin nội bộ |
| UI-09 | mặc định | keyboard Tab | focus nhìn thấy rõ |
| UI-10 | reduced motion | bật preference | UI không có motion không cần thiết |
| UI-11 | preset | import file lớn/sai schema | state cũ giữ nguyên, toast error |
| UI-12 | preset | export rồi import | control phục hồi đúng |

## Browser automation bằng Playwright + axe-core

| ID | Truy vết | Case tự động | Viewport |
|---|---|---|---|
| E2E-01 | UI-01/02/06/08 | đổi mode, slider, reset và kiểm tra overflow | desktop + mobile |
| E2E-02 | UI-04/05/06/08/10 | fallback/error, banner, backend và disabled controls | desktop + mobile |
| E2E-03 | UI-05/06/07 | import hợp lệ, lỗi giữ state, export đúng schema | desktop + mobile |
| E2E-04 | UI-FR-04/05/10 | init bị giữ bằng Promise rồi hoàn tất; WebGL2 production FPS và pause/resume | desktop + mobile; phân biệt harness với canvas thật |
| A11Y-01 | UI-NFR-02/03 | quét WCAG A/AA bằng axe-core | desktop + mobile |
| EVID-01 | UI-01/02/06/08 | chụp trạng thái port minh họa, ghi rõ là test input | 1440×1000 + 500×844 |

Các mục keyboard/screen reader/reduced-motion vẫn cần checklist thủ công vì axe-core không thể thay thế đánh giá con người. Khi engine thật được ghép, TV5 cần bổ sung E2E/benchmark dựa trên backend và metric thật.
