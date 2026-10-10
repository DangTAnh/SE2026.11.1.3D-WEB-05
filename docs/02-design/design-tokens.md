# Design tokens UI — TV4 v0.2

Nguồn runtime: src/ui/styles/tokens.css.

| Nhóm | Token | Giá trị | Dùng cho |
|---|---|---:|---|
| Nền | --ui-bg | #090f1d | nền ứng dụng |
| Surface | --ui-surface | #101a2b | panel |
| Surface | --ui-surface-raised | #111d2e | card |
| Viền | --ui-border | #26364b | phân vùng |
| Chữ | --ui-text | #e7eefc | nội dung chính |
| Chữ | --ui-muted | #91a2b7 | mô tả |
| Trạng thái | --ui-accent | #74e5f4 | focus/active |
| Trạng thái | --ui-success | #69e2c1 | ready |
| Trạng thái | --ui-warning | #f2c76e | fallback |
| Trạng thái | --ui-danger | #ff8ea8 | error/unsupported |

Spacing dùng thang 4, 8, 12, 16, 24 px. Radius chuẩn 8 và 12 px.

## Responsive và accessibility

- Desktop: hai cột lab và control panel.
- Dưới 930 px: panel xuống dưới vùng preview.
- Dưới 640 px: rail và typography thu gọn.
- Dưới 390 px: giảm padding, preset actions xếp dọc.
- Touch target chính tối thiểu 44 px.
- Focus dùng outline 2 px, không chỉ dựa vào màu.
- prefers-reduced-motion tắt chuyển động không cần thiết.

TV4 sở hữu token UI. Thành viên khác dùng token thay vì thêm mã màu rời.
