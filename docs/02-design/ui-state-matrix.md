# Ma trận trạng thái UI runtime — TV4

**Cập nhật:** 24/10/2026. UI chiếu trạng thái từ `RendererPort.getStatus()`;
production không còn Canvas2D mock hoặc `?uiState=` fixture. Trang được chuẩn bị
với nội dung tĩnh `unsupported` cho tới khi port được gắn và trạng thái thật
được đọc. Test dùng FakeRenderer được inject riêng tại
`tests/e2e/fixtures/renderer-port.html`.

| Phase | Nguồn trạng thái | Backend hiển thị | Controls simulation | FPS/GPU timing |
|---|---|---|---|---|
| ready | `actual: webgpu`, hoặc WebGL2 được yêu cầu rõ | Giá trị `actual` | Bật | Chỉ số hữu hạn/hợp lệ khi `running` |
| fallback | `actual: webgl2`, `requested` khác `webgl2` | WebGL2 fallback | Bật; warning | Cùng quy tắc; thiếu timing là `null` |
| unsupported | thiếu port hoặc `actual: unavailable` | Không khả dụng | Khóa | Không khả dụng |
| error | đọc trạng thái port hoặc apply config lỗi | Lỗi renderer | Khóa | Không khả dụng |

`requested` chỉ giải thích lựa chọn/fallback, không thay thế `actual`. Khi dừng,
UI xóa FPS và GPU timing cũ. Khi `running` nhưng FPS không hợp lệ, số đo và
nhãn “Dữ liệu từ renderer” đều biến mất. Zero là số đo hợp lệ nếu producer
báo timing có sẵn; `null` với `gpuTimingAvailable: false` nghĩa là chưa đo.

Test UI kiểm ready → fallback → unsupported → error → recovery bằng
`window.uiTest.setStatus()`/`setFailure()` trên FakeRenderer. Các nhãn và số đo
trong harness là đầu vào test, không phải bằng chứng WebGPU/WebGL2 thật. UI
không hiển thị stack trace, driver nội bộ hoặc dữ liệu giả như benchmark.

TV1/TV3 sở hữu contract/backend của port; TV5 sở hữu producer và chứng cứ số
đo; TV4 sở hữu phần chiếu trạng thái, nội dung và accessibility.
