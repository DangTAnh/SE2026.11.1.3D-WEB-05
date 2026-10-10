# Overlay — TV4

statusOverlay.ts render UiRuntimeState vào backend, FPS, GPU timing và notice. FPS mặc định chỉ là **Canvas2D preview**, không phải benchmark.

TV1/TV3/TV5 cần cung cấp adapter dữ liệu thật. Khi chưa có số đo, giữ null và hiển thị “Không khả dụng”; không tạo số fixture.
