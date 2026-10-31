# Thiết kế tương tác & Integration Contract — Preset v2

Tài liệu mô tả implementation trên nhánh #16 / PR #76, chưa phải xác nhận
release. Thay thế thiết kế prototype v0.2. Contract dùng chung thuộc TV1;
TV2 review ranges/defaults, TV3 lifecycle và TV5 bằng chứng kiểm thử.
Owner review trên revision mới và independent human approval vẫn cần thiết.

## 1. Luồng dữ liệu

UI controls → nested `LabConfig` → injected `RendererPort` → adapter và shared
simulation. UI nhận `RendererStatus` qua polling; collector lấy snapshot qua
port. Preset import/export giữ toàn bộ document. UI không import backend hoặc
simulation internals. Composition root sở hữu init và `RendererSession`.
Chỉ có một renderer với shared TSL pipeline cho WebGPU/WebGL2.

Nguồn sự thật: [preset.ts](../../src/presets/preset.ts),
[schema v2](preset-schema-v2.schema.json),
[defaults/ranges và quyết định owner](preset-schema-v2-proposal.md),
[RendererPort](../../src/core/renderer/RendererPort.ts) và
[architecture](../architecture.md).

## 2. State và cấu hình hiện hành

`PresetDocument = { schemaVersion: 2, app: "3D-WEB-05", name?: string, config: LabConfig }`.
`name` là metadata 1–80 ký tự; không truyền vào renderer hoặc configHash.
`LabConfig` gồm `mode`, `backendPreference` và các nhóm bắt buộc
`simulation`, `modes` (cả attractor và vortex), `rendering`, `camera`.
Existing controls đọc/ghi nested fields; strength chỉ cập nhật mode đang bật.
Controls mới thuộc #56; FPS freshness độc lập thuộc #55, ngoài scope #16.

| Nhóm/field | Range | Default |
|---|---|---|
| mode / backendPreference | attractor hoặc vortex / auto, webgpu, webgl2 | attractor / auto |
| simulation.particleCount | integer 1000–500000, không bước 1000 | 65536 |
| simulation.spawnRadius | 1–100 world units | 10 |
| simulation.particleSize | 1–8 adapter units | 2.5 |
| simulation.lifetime | 0.5–20 giây mô phỏng | 6 |
| simulation.speed | 0.1–3 | 1.2 |
| modes.attractor.attractorStrength | 0.2–4 | 1.5 |
| modes.attractor.attractorRadius | 0.5–50, ngưỡng damping | 6 |
| modes.attractor.attractorDamping | 0.8–1, per step | 0.98 |
| modes.vortex.vortexStrength / vortexDamping | 0.2–4 / 0.8–1 | 1.5 / 0.99 |
| rendering.backgroundColor / particleColor | #RRGGBB | #07111f / #6ce6ff |
| rendering.opacity / additiveBlend | 0.05–1 / boolean | 1 / false |
| camera.enabled / autoRotate | boolean; autoRotate chỉ hiệu lực khi enabled | true / false |
| camera.distance | 5–500 world units | 30 |

Các số ngoài particleCount có precision 0.001. Speed nhân clamped delta đúng
một lần; lifetime là simulated time, wall-clock xấp xỉ lifetime/speed.
Spawn radius dùng cho init/respawn. Không có vortexRadius hoặc flow mode.
Defaults deep-frozen; `cloneConfig` tạo snapshot độc lập.

## 3. Port, backend và metrics

`RendererPort` có `init`, optional `resize`, synchronous `applyConfig`, `start`,
`pause`, `reset`, `getStatus`, `dispose`. Count change có thể rebuild/reseed
buffers; không cần gọi reset thêm cho count change. UI được inject port và
không tự init concrete adapter.

`RendererStatus` gồm requested, actual, running, gpuTimingAvailable,
measurementAgeMs, fps và gpuTimeMs. `actual` là backend thật; requested chỉ là
preference. Không dùng preference làm bằng chứng đã chạy backend.
GPU timing unavailable dùng false/null, không dùng zero thay số đo.
PR #62 đã merge: GPU age monotonic tính từ compute submission, gồm readback;
quá 2000 ms thì timing unavailable/null, query mỗi 10 compute frames.
Pause/reset/re-init clear timing; pending session có age/FPS/timing null.
Collector bỏ snapshot paused và giữ FPS hợp lệ khi chỉ GPU timing stale.
Age này không xác nhận FPS freshness (#55).

Backend preference có hiệu lực ở init tiếp theo. Nút Apply gọi RendererSession
để stage adapter/canvas, commit khi candidate sẵn sàng và rollback khi lỗi;
config và running intent được bảo toàn. WebGPU runtime loss thử WebGL2 một lần
trên canvas mới; WebGL2 context loss là terminal unavailable, không retry loop
hoặc CPU fallback. UI chỉ hiển thị actual và trạng thái do port báo.

`PerformanceSnapshot` giữ actual, configHash, fps, gpuTimeMs,
gpuTimingAvailable. Hash là active-workload identity: mode + simulation +
nhóm mode đang chạy, flat/alphabetical/compact, round 3 decimals, SHA-256
lowercase. Inactive mode, backend request, rendering/camera và metadata không
vào hash; benchmark vẫn phải giữ full validated config bên cạnh hash.

## 4. Preset JSON v2 và import/export

Ví dụ đầy đủ khớp default hiện hành:

```json
{
  "schemaVersion": 2,
  "app": "3D-WEB-05",
  "config": {
    "mode": "attractor",
    "backendPreference": "auto",
    "simulation": { "particleCount": 65536, "spawnRadius": 10, "particleSize": 2.5, "lifetime": 6, "speed": 1.2 },
    "modes": {
      "attractor": { "attractorStrength": 1.5, "attractorRadius": 6, "attractorDamping": 0.98 },
      "vortex": { "vortexStrength": 1.5, "vortexDamping": 0.99 }
    },
    "rendering": { "backgroundColor": "#07111f", "particleColor": "#6ce6ff", "opacity": 1, "additiveBlend": false },
    "camera": { "enabled": true, "autoRotate": false, "distance": 30 }
  }
}
```

- Reject v1 rõ ràng, không tự migrate hoặc điền field thiếu. Reject unknown
  keys mọi cấp, missing fields, nonfinite/out-of-range/finer-than-0.001 values.
  Count 65536/500000 hợp lệ; file trên 1 MB bị UI từ chối.
- UI dùng parsePresetDocument/serializePresetDocument để giữ name và cả hai
  mode groups. Config-only helpers dành cho caller không cần metadata.
- Import lỗi hoặc apply lỗi giữ document/config/name cũ. Import thành công
  cập nhật controls/config/name cùng nhau; nếu chỉ reset sau apply thất bại,
  giữ config/name mới đã apply và báo lỗi reset.
- Edit, mode switch, backend Apply và simulation Reset giữ name. Restore
  defaults hoặc import document không có name xóa name cũ.
- Serialization có thứ tự key cố định từng cấp, indent 2 và LF cuối file.

## 5. Acceptance paths và giới hạn bằng chứng

| Case | Thao tác | Mong đợi |
|---|---|---|
| UI-01 | Chọn Vortex | Mode/strength binding đổi; inactive group còn nguyên |
| UI-02 | Sửa speed, size, color, count | Port nhận nested config; count rebuild đúng lifecycle |
| UI-03 | Chọn backend rồi Apply | Requested tách actual; stage/rollback giữ config và pause |
| UI-04 | Export/import v2 có name | Full document round-trip, ổn định serialization |
| UI-05 | Import v1/unknown/missing/invalid | Báo lỗi, không sửa document cũ |
| UI-06 | Restore defaults | Controls về defaults, name được xóa |
| UI-07 | Pause/resume/reset | Port nhận lifecycle tương ứng; config/name được giữ |
| UI-08 | Desktop/mobile resize | Canvas/panel truy cập được, resize theo stable host |
| UI-09 | Timing stale/unavailable | false/null timing; giữ FPS hợp lệ nếu chỉ GPU stale |
| UI-10 | Fixture state và production loss | Fixture kiểm tra UI; production WebGL2 loss báo unavailable |

FakeRenderer/fixtures chỉ chứng minh caller behavior. Production WebGL2 chạy
trong Chromium software rendering không phải physical GPU/WebGPU acceptance.
Physical WebGPU/parity/timestamp freshness và v2-default fair benchmark vẫn
cần bằng chứng riêng; xem [project status](../PROJECT_STATUS.md).

## 6. Historical / Superseded

Prototype v0.2 từng dùng flat LabConfig, schemaVersion 1, 1000–50000 particles
bước 1000 và Canvas2D giới hạn 600 particles. Những mô tả và acceptance mock đó
đã bị thay thế; không phải runtime hiện hành. [Schema v1](preset-schema-v1.schema.json)
chỉ giữ làm tham chiếu lịch sử, parser hiện hành từ chối nó. Canvas2D mock đã
được gỡ; UI dùng initialized real adapter qua port. `?uiState` trong regression
test kiểm tra production bỏ qua query cũ, không tạo production fixture state.
