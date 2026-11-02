# Reflection — BẢN NHÁP, sinh viên tự xác nhận

Tôi tăng mức tin cậy của thay đổi bằng bằng chứng thực thi trên schema v2. Test RED chạy trước production patch: nhập và xuất document thành công, sau đó thất bại vì thiếu Undo. GREEN kiểm tra khôi phục cấu hình lồng và tên preset. Sau đồng bộ dev, regression ghi nhận 336 unit/integration PASS, 84 E2E PASS và 12 capability SKIP; tôi phân biệt lần chạy này với các kết quả cũ.

Tôi dùng BVA theo schema thật, xét dưới, tại và trên biên, đồng thời kiểm tra độ chính xác số thập phân. Negative test kiểm tra cả state và history. Mutation chỉ bỏ guard tại Undo khiến AUTH2 thất bại; guard vẫn có trong branch cuối. Coverage 100% chỉ thuộc importUndo.ts và presetFile.ts, không đại diện toàn ứng dụng.

AI giúp lập kế hoạch và rà soát, nhưng tôi phải sửa ít nhất hai assumptions. Snapshot chỉ chứa LabConfig sẽ mất tên preset; rollback mọi exception lại sai khi reset lỗi sau lúc cấu hình đã commit. Tôi chuyển sang snapshot toàn document và phân biệt lỗi sau commit. Assertion toast cũng được đặt trước export để tránh mất dấu kết quả cần kiểm tra.

Tôi giữ các log lỗi HMR và xung đột artifact thay vì xóa chúng. Chạy lặp không thay thế review rủi ro timing hoặc shared state. FakeRenderer chứng minh hành vi UI/port, chưa chứng minh GPU thật. Browser queue p95 khoảng 13,348 giây vượt mục tiêu 5 giây; service-only thấp hơn không xóa thời gian chờ. Real 200-user SLO chưa được chứng minh. Rollback GPU bất đồng bộ còn giới hạn vì callback phục hồi không bảo đảm mọi side effect. Human review vẫn pending; tôi cần tự xác nhận bản nháp này và nhờ thành viên khác review trước khi merge.

Word count: 301 (Python whitespace split; body only).
