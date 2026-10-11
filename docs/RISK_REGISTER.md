# RISK REGISTER — 3D-WEB-05

| ID | Rủi ro | Mức | Tín hiệu | Giảm thiểu | Owner |
|---|---|---|---|---|---|
| R-001 | main/develop và feature khác lịch sử gốc | Cao | merge báo unrelated histories | TV1 chọn seed/cherry-pick; không force/rewrite | TV1 |
| R-002 | Contract config/engine chưa chốt | Trung bình | field/range đổi khi ghép | giữ UI adapter độc lập; review schema trước Wave 3 | TV1/2/3/4 |
| R-003 | UI gây hiểu nhầm fixture là WebGPU thật | Cao | ảnh/báo cáo có số giả | nhãn UI FIXTURE; metric null; cấm báo benchmark | TV4/5 |
| R-004 | E2E hiện chỉ chạy Chromium và UI fixture | Trung bình | lỗi riêng Firefox/WebKit hoặc engine thật chưa bị bắt | Playwright Chromium ở hai viewport; TV5 mở rộng browser/engine khi tích hợp | TV5 |
| R-005 | Accessibility regression khi ghép engine | Trung bình | focus/alert/disabled bị mất | axe-core A/AA trong Playwright; vẫn giữ checklist keyboard/screen reader/reduced motion | TV4/5 |
| R-006 | Preset v1 thay đổi không tương thích | Trung bình | import file cũ thất bại | version rõ, schema trong repo, thay bằng schema v2 | TV4/TV1 |
| R-007 | JSON Schema và type TypeScript có thể lệch khi contract đổi | Trung bình | Ajv đạt nhưng compiler/type consumer khác | schema là nguồn validation; mọi thay đổi contract phải sửa schema + type + unit/E2E cùng PR | TV1/2/3/4 |
