# Reflection - AI-assisted draft, student to confirm

Confidence của tôi tăng khi kiểm tra được sự khác nhau giữa một request thất bại và một lần ghi chưa biết kết quả. Mất response sau commit không có nghĩa dữ liệu chưa lưu. Test đếm effect trên ledger độc lập giúp tôi tránh kết luận từ số lần gọi retry. Property-based testing mở rộng các chuỗi lỗi và tìm được phản ví dụ nhỏ, thay vì chỉ chạy một kịch bản thuận lợi.

Mutation cố ý trả success khi persistence thất bại làm T04 và T13 thất bại. Evidence này hữu ích hơn lời giải thích rằng code trông hợp lý. Tuy nhiên, review còn tìm ra oracle có thể bắt chính assertion của nó. Một test chạy qua nhiều nhánh vẫn có thể bỏ lọt lỗi. Tôi sửa cách thu kết quả promise, đưa assertion ra ngoài catch và kiểm tra từng trường receipt độc lập. Coverage hoàn chỉnh vì vậy chỉ là dữ kiện về đường chạy.

Giới hạn quan trọng là repository chưa có dịch vụ lưu thật. Ledger trong harness bảo đảm commit và dedupe nguyên tử trong một event loop; nó chưa chứng minh giao dịch cơ sở dữ liệu hay độ bền sau crash. Năm lượt tải đạt mục tiêu với 80 tác vụ nhưng dùng I/O giả lập, không phải 80 người dùng thực. Client còn giữ key trong bộ nhớ và không giải quyết adapter treo vô hạn.

Lượt AI chỉ nhận context module giúp plan tập trung, nhưng có thể ngầm giả định server và idempotency đã tồn tại. Đối chiếu architecture đã sửa giả định đó. Test tiếp theo có giá trị cao nhất là contract test trên adapter lưu thật: commit xong rồi ngắt kết nối, khởi động lại client và service, gửi lại cùng key, xác nhận chỉ có một effect bền vững. Tôi cần đọc lại mọi dòng code và reflection trước khi chịu trách nhiệm nộp bài.
