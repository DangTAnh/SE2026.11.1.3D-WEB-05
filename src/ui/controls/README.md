# Controls — TV4

`controlBindings.ts` render và bind các controls hiện hữu với nested `LabConfig`.
Module chỉ phát thay đổi qua callback; UI gửi config tới `RendererPort`, không import engine.

Strength chỉ sửa nhóm mode đang hoạt động; đổi mode giữ nguyên nhóm còn lại.
Particle count hỗ trợ mọi số nguyên 1.000–500.000, gồm default 65.536.
Các numeric controls khác giữ được precision 0.001 của preset v2.

UI lưu `name` riêng dưới dạng metadata của `PresetDocument`: import/export giữ
nguyên name, config edit và Reset mô phỏng giữ name, Khôi phục mặc định xóa name.
Import document không có name cũng xóa name cũ. RendererPort chỉ nhận LabConfig.
Nếu apply thất bại, cả config và metadata cũ được giữ; nếu apply thành công nhưng
Reset thất bại, document mới vẫn được giữ và UI thông báo lỗi Reset.

Không thêm controls cho các field mới trong #16; phần đó thuộc #56.
