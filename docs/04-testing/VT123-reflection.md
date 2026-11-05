# VT-123 — Reflection

Điều làm tôi tin hơn vào kết quả không phải coverage 100%, mà là việc mutation
xóa khối kiểm tra CAS sau await bị ba test bắt được, trong đó T09 chèn một
submit của editor vào đúng cửa sổ read → await → write. Promise gate thay cho
sleep giúp kết quả lặp lại 20/20 lần, không phụ thuộc tốc độ máy. 40 tác vụ đồng
thời cho p95 256–300 ms, dưới ngưỡng 1,5 giây, cho thấy harness chạy được và
contract không bị tuần tự hóa quá mức.

Tuy vậy, điều quan trọng nhất vẫn chưa được chứng minh: đây là mô hình trong bộ
nhớ, một tiến trình, không có server, xác thực hay cơ sở dữ liệu. Repo ghi rõ
server/auth/persistence ngoài phạm vi, nên reviewer chỉ là đầu vào phân quyền do
caller cung cấp, không phải danh tính đã xác thực. Triển khai thật phải có cùng
điều kiện CAS ở tầng lưu trữ; nếu không, race giữa hai tiến trình vẫn còn. p95
1,5 giây mới đo trên dữ liệu giả lập với độ trễ 1 ms, chưa phản ánh mạng, DB hay
tải trình duyệt.

Điểm yếu thứ hai: test do AI sinh ra có thể trông đúng mà vẫn sai. T02 ban đầu
dùng shape phẳng của preset v1 (`document.simulation`) thay vì v2
(`document.config.simulation`); `toThrow(TypeError)` vẫn xanh vì gán vào
`undefined` cũng ném TypeError. Chỉ khi đọc lại kiểu dữ liệu thật và sửa đường
dẫn, test mới kiểm tra đúng tính bất biến. Tương tự, kế hoạch đầu định dùng
`configHash` làm danh tính, nhưng hàm này bỏ qua màu, backend và tên preset —
đổi mỗi màu sẽ được duyệt nhầm.

Test giá trị nhất là integration test với store thật (hoặc hai tiến trình) dùng
conditional write, chạy 40 client đồng thời và kiểm tra không approval nào áp
lên nội dung khác hash đã đọc. Test đó biến contract từ mô hình thành bằng chứng
về hệ thống thực.
