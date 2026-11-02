# VT121 reflection draft — sinh viên cần review

Độ tin cậy của thay đổi tăng nhờ kiểm chứng trên schema v2 thay vì suy từ kết quả v1. Test RED chạy trước production patch, nhập và xuất document thành công rồi thất bại vì thiếu Undo. Cùng luồng đó chuyển sang GREEN, so sánh toàn bộ cấu hình lồng, metadata và yêu cầu gửi tới RendererPort. Đây là bằng chứng mạnh hơn việc chỉ thấy nút xuất hiện.

BVA dựa trên schema thật giúp loại bỏ giả định particle count phải chia hết cho một nghìn. Test negative không chỉ yêu cầu exception mà còn kiểm tra state và lịch sử trước thao tác. Mutation bỏ guard riêng tại Undo làm test unauthorized thất bại, cho thấy test phát hiện được lỗi đã chọn. Tuy vậy, Symbol chỉ kiểm tra quyền gọi nội bộ, không chứng minh bảo mật giữa tài khoản.

AI hỗ trợ tách controller, xây dựng portfolio và rà diff, nhưng cần kiểm soát các giả định trông hợp lý. Snapshot chỉ chứa LabConfig sẽ làm mất tên preset. Rollback mọi exception cũng sai khi reset thất bại sau khi cấu hình đã commit. Review độc lập còn phát hiện assertion toast có thể bị thao tác export che khuất; test đã được bổ sung.

Những giới hạn phải giữ rõ gồm rollback lỗi, side effect GPU bất đồng bộ và baseline dev mới nhất chưa fetch được. Coverage nguồn chỉ áp dụng hai module được chọn. Benchmark Node và browser harness không đại diện hai trăm người dùng thật. Transport kiểm thử không chứng minh triển khai HTTP. Test tiếp theo có giá trị cao nhất là đồng bộ dev hiện hành, chạy lại integration và workload trình duyệt trên môi trường mạng hoạt động, rồi để thành viên nhóm review trước quyết định merge.

Word count: 301 (Python whitespace split; excluding title and this note).
