# RISK REGISTER — 3D-WEB-05

| ID | Rủi ro | Mức | Tín hiệu | Giảm thiểu | Owner |
|---|---|---|---|---|---|
| R-001 | main/develop và feature khác lịch sử gốc | Cao | merge báo unrelated histories | TV1 chọn seed/cherry-pick; không force/rewrite | TV1 |
| R-002 | Contract config/engine chưa chốt | Trung bình | field/range đổi khi ghép | giữ UI adapter độc lập; review schema trước Wave 3 | TV1/2/3/4 |
| R-003 | UI gây hiểu nhầm fixture là WebGPU thật | Cao | ảnh/báo cáo có số giả | nhãn UI FIXTURE; metric null; cấm báo benchmark | TV4/5 |
| R-004 | Chưa có DOM/E2E framework | Trung bình | regression tương tác chỉ test tay | state fixtures ổn định; TV5 thêm Playwright/Vitest | TV5 |
| R-005 | Accessibility regression khi ghép engine | Trung bình | focus/alert/disabled bị mất | giữ semantics; checklist keyboard/reduced motion | TV4 |
| R-006 | Preset v1 thay đổi không tương thích | Trung bình | import file cũ thất bại | version rõ, schema trong repo, thay bằng schema v2 | TV4/TV1 |
