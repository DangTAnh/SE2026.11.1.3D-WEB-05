# Đề xuất Preset Schema v2 — 3D-WEB-05 (bản cập nhật sau review)

**Trạng thái:** đã cập nhật theo comment review của TV4 và TV1 ngày 2026-10-24; chờ Approve chính thức
trên PR trước khi merge.
**Phạm vi PR này:** chỉ `docs/02-design/**`; không đụng code, không thêm dependency.
**Chặn:** việc này chặn port engine (kernel GPU) + UI + perf, vì mọi bên đều đọc `LabConfig`.

## 1. Kết luận từ review

| # | Kết luận | Ghi chú |
| - | -------- | ------- |
| 1 | **MVP dùng `attractor` + `vortex`.** Flow/curl-noise là phần mở rộng sau MVP. Không map `vortex` → `flow`. | Theo `docs/01-requirements/mvp-acceptance.md:11`, `use-cases.md:59`, `ui-requirements.md:24,49` |
| 2 | `attractor` là tên mode sản phẩm; `orbit` chỉ là tên kernel hiện tại. Công thức orbit hiện tại là một biến thể quỹ đạo của attractor, **chưa phải** định nghĩa chung của attractor. | TV2 xác nhận công thức khi port engine; xem §5 |
| 3 | `particleCount` bỏ `multipleOf`, khoảng 1.000–500.000, mặc định 65.536; GUI có thể giữ step 1.000 nhưng không được tự làm tròn khi import. | Giới hạn schema không phải cam kết hiệu năng ở 500.000 |
| 4 | `particleSize` giữ 1–8; đơn vị do adapter quyết định; E-06 đo parity WebGPU/WebGL2 trước benchmark. | |
| 5 | `speed` là hệ số thời gian toàn cục, nhân vào `delta`. | |
| 6 | `name` là metadata optional ở root. | Không tính vào round-trip |
| 7 | Preset v1 bị **từ chối** kèm thông báo rõ; không tự migrate `vortex` → `flow` và không tự điền tham số thiếu. | |
| 8 | Unknown-key policy là **reject** (`additionalProperties: false`). | TV1 cập nhật contract test đang pin hành vi drop + `docs/architecture.md` |
| 9 | TV4 cập nhật validator/thông báo lỗi, UI/preset examples và hai bộ preset tests; TV1 review phần contract và cập nhật `configHash`/measurement tests. | |

## 2. Vì sao cần v2

1. **Đổi mode là mất tham số.** v1 dùng chung `strength` cho cả hai mode → không thể có bộ tham số riêng
   theo mode, và preset không round-trip được trạng thái của **cả hai** mode.
2. **Thiếu tham số MVP:** lifetime (respawn), spawn radius, rendering (background/opacity/additive), camera
   (enabled/auto-rotate/distance).
3. **`particleCount` với `multipleOf: 1000`** chặn các giá trị luỹ thừa 2 (65.536 — thân thiện GPU, mặc định
   đang dùng).
4. **`RendererPort.applyConfig(config: Readonly<LabConfig>)`** cần `mode` nằm **trong** config để adapter
   nhận một object duy nhất.

## 3. Thay đổi so với v1

| # | v1 | v2 | Lý do |
| - | -- | -- | ----- |
| 1 | `config.mode: attractor \| vortex` | giữ nguyên `config.mode: attractor \| vortex` | MVP đã chốt; `orbit` là tên kernel nội bộ của attractor, không đưa vào preset |
| 2 | `config.strength` (dùng chung) | `config.modes.attractor.*` + `config.modes.vortex.vortexStrength` | mỗi mode một bộ; round-trip được cả hai mode |
| 3 | `config.speed` | `config.simulation.speed` — hệ số thời gian, nhân vào `delta` | định nghĩa rõ nghĩa |
| 4 | `config.particleSize` 1–8 | giữ 1–8, **đơn vị do adapter định nghĩa** | không rò chi tiết backend vào schema; E-06 đo parity |
| 5 | `particleCount` `multipleOf 1000`, max 50.000 | bỏ `multipleOf`, max 500.000, default 65.536 | cho phép 65.536; trần theo research |
| 6 | — | `simulation.spawnRadius`, `simulation.lifetime` | MVP: spawn + respawn khi chết |
| 7 | `config.particleColor` | `rendering.{backgroundColor,particleColor,opacity,additiveBlend}` | gom nhóm rendering, khớp folder GUI |
| 8 | — | `camera.{enabled,autoRotate,distance}` | MVP: orbit camera controls |
| 9 | `{schemaVersion, app, config}` | thêm `name?` ở root (optional, 1–80 ký tự) | metadata cho thư viện preset; **không** tính vào round-trip |
| 10 | `mode` trong `config` | **giữ** trong `config` | `applyConfig(config)` một object; tính "structural" do adapter xử lý |
| 11 | serialize tự do | thứ tự key theo schema, `JSON.stringify(…, null, 2)` + `\n`, bỏ `name` khi rỗng | round-trip byte-stable |

**Vortex trong MVP:** v1 và mock UI chỉ có `strength` cho vortex. v2 giữ đúng một trường
`vortexStrength`; TV2 bổ sung trường khác nếu công thức vortex cần, trước khi preset mẫu được chốt.
**Flow/curl-noise:** các key `flowStrength`, `noiseScale`, `flowDamping` của engine tham chiếu **không**
nằm trong v2; chúng sẽ trở lại trong một schema version sau khi TV2 triển khai flow như phần mở rộng.

## 4. Schema và ví dụ

- **Schema:** [`preset-schema-v2.schema.json`](./preset-schema-v2.schema.json) (JSON Schema draft 2020-12,
  `additionalProperties: false`, `required` đầy đủ ở mọi tầng).
- **Ví dụ hợp lệ:**

```json
{
  "schemaVersion": 2,
  "app": "3D-WEB-05",
  "name": "attractor swarm",
  "config": {
    "mode": "attractor",
    "backendPreference": "auto",
    "simulation": { "particleCount": 65536, "spawnRadius": 12, "particleSize": 2.5, "lifetime": 6, "speed": 1.2 },
    "modes": {
      "attractor": { "attractorStrength": 12, "attractorRadius": 6, "attractorDamping": 0.98 },
      "vortex": { "vortexStrength": 12 }
    },
    "rendering": { "backgroundColor": "#0b0e14", "particleColor": "#ffffff", "opacity": 0.6, "additiveBlend": true },
    "camera": { "enabled": true, "autoRotate": true, "distance": 42 }
  }
}
```

**Quy ước thời gian:** kernel cộng `delta * speed` vào tuổi hạt; `lifetime` tính bằng giây mô phỏng, nên
`speed` cao làm hạt chết nhanh hơn. `spawnRadius` và `camera.distance` dùng cùng đơn vị world space;
`particleSize` do adapter quy đổi. `camera.autoRotate` chỉ có hiệu lực khi `camera.enabled = true`.

## 5. Mapping từ bộ tham số engine tham chiếu sang v2

| Key đang chạy | Đường dẫn v2 | Ghi chú |
| ------------- | ------------ | ------- |
| `mode` | `config.mode` | Engine đang dùng `orbit`; preset/UI dùng `attractor`. Flow không có trong v2 |
| `particleCount` | `config.simulation.particleCount` | Kích thước storage buffer + `object.count` |
| `spawnRadius` | `config.simulation.spawnRadius` | Uniform của kernel init (spawn) |
| `pointSize` | `config.simulation.particleSize` | `material.scaleNode`; đơn vị do adapter định nghĩa |
| `lifetime` | `config.simulation.lifetime` | Uniform respawn (M3) |
| `orbitStrength` | `config.modes.attractor.attractorStrength` | Kernel `orbit` là implementation của attractor |
| `orbitRadius` | `config.modes.attractor.attractorRadius` | Ngưỡng damping ngoài quỹ đạo |
| `damping` | `config.modes.attractor.attractorDamping` | Đổi tên theo tiền tố mode |
| `flowStrength` | — | Flow/curl-noise là extension; không có trong v2 |
| `noiseScale` | — | Flow/curl-noise là extension; không có trong v2 |
| `flowDamping` | — | Flow/curl-noise là extension; không có trong v2 |
| `backgroundColor` | `config.rendering.backgroundColor` | `scene.background` |
| `opacity` | `config.rendering.opacity` | `material.opacityNode` |
| `additiveBlend` | `config.rendering.additiveBlend` | Blending của material |
| — | `config.rendering.particleColor` | Từ v1 của TV4; `material.colorNode` |
| `cameraEnabled` | `config.camera.enabled` | Bật/tắt OrbitControls |
| `cameraAutoRotate` | `config.camera.autoRotate` | OrbitControls |
| `cameraDistance` | `config.camera.distance` | OrbitControls |
| — | `config.backendPreference` | Từ v1 của TV4; `RendererPort.init()` |
| — | `config.simulation.speed` | Từ v1 của TV4; nhân vào `delta` |
| v1 `strength` | `config.modes.vortex.vortexStrength` | Tách khỏi attractor; TV2 xác nhận thêm trường nếu cần |

**Quan hệ `orbit` ↔ `attractor`:** kernel hiện tại tính `tangent = normalize(-position) × (0, 1, 0)`,
cộng `tangent * orbitStrength * delta` vào velocity, nhân `damping` khi `|position| > orbitRadius`, rồi
tích phân vị trí. Đây là biến thể quỹ đạo (tangential), **không** phải lực hút xuyên tâm thuần; TV2 chốt
công thức attractor cuối cùng trước khi port. Nếu công thức khác, chỉ đổi kernel — schema vẫn giữ tên
`attractor`.

`orbit` hiện là kernel duy nhất đã chạy; `vortex` mới có trong mock UI và chưa có kernel GPU. Vì vậy bảng
này **không** khẳng định engine đã có đủ hai mode — phần port kernel vẫn là việc của TV2.

## 6. Bằng chứng validate

Ajv 2020-12 với `{ allErrors: true, strict: true }` — đúng cách `src/presets/preset.ts` đang dùng:
**17/17 case PASS**.

- Hợp lệ: preset attractor đầy đủ ✓ · bỏ `name` ✓ · `particleCount` 65.536 ✓ · `particleCount` 500.000 ✓ ·
  preset vortex chỉ có `vortexStrength` ✓ · `camera.enabled = false` + `autoRotate = true` ✓
- Không hợp lệ: thiếu `lifetime` ✗ · key thừa trong `simulation` ✗ · `particleCount` < 1.000 ✗ ·
  `particleCount` 500.001 ✗ · không phải integer ✗ · màu sai định dạng ✗ · `mode: "flow"` ✗ ·
  thiếu `attractorDamping` ✗ · thiếu `vortexStrength` ✗ · `name` rỗng ✗ · key thừa ở root ✗

Đây là kiểm *schema*; round-trip serializer được kiểm riêng ở engine.

## 7. Quyết định đã chốt và câu hỏi còn mở

### Đã chốt trong review

1. Hai mode MVP là `attractor` + `vortex`; flow/curl-noise để sau MVP.
2. `particleCount` 1.000–500.000, default 65.536, không `multipleOf`; GUI step 1.000 chỉ là presentation.
3. `particleSize` 1–8, đơn vị do adapter quyết định.
4. `speed` nhân vào `delta`.
5. `name` optional ở root.
6. Preset v1 bị từ chối kèm thông báo; không auto-migrate.
7. TV4 cập nhật validator, UI, examples và hai bộ preset tests; TV1 review contract.
8. Unknown-key policy là reject; TV1 cập nhật contract test và `docs/architecture.md`.

### Còn mở trước khi port engine

1. **`configHash` gồm những gì?** Đề xuất: hash `mode` + `simulation` + group của mode đang bật; loại trừ
   group mode còn lại, `rendering`, `camera`, `name`, `backendPreference`. Lý do: hash mô tả công việc GPU
   thực tế, còn preset file đã lưu đầy đủ trạng thái. Nếu nhóm muốn hash định danh toàn bộ preset, phải đổi
   tên khái niệm trong `docs/architecture.md` §5.1 và chấp nhận hash đổi khi sửa mode không bật.
2. **Tham số vortex:** v2 chỉ có `vortexStrength` theo v1/mock. TV2 xác nhận có cần thêm trường (ví dụ
   radius/damping) khi chốt công thức; nếu có, cập nhật schema trong PR port engine trước khi phát hành
   preset mẫu.
3. **Thứ tự merge:** PR này chỉ có docs nhưng tham chiếu `preset-schema-v1.schema.json`, `src/presets`,
   `src/core/measurement` và tests đang nằm ở PR #1 / nhánh TV1. Merge PR #1 trước, hoặc rebase PR này sau
   PR #1, để các đường dẫn trong §8 không bị treo.
4. **Test runner:** nhóm đang có `node --test` (TV1) và vitest (TV4); cần chốt một runner trước PR tích hợp.

## 8. Ảnh hưởng lên code hiện có của nhóm

| File | Việc | Owner |
| ---- | ---- | ----- |
| `src/presets/preset.ts` | `LabConfig`, `DEFAULT_CONFIG`, `parsePreset` theo v2; trỏ schema v2 | TV4 |
| `docs/02-design/preset-schema-v1.schema.json` | giữ nguyên (lịch sử), thêm v2 cạnh nó | TV4 |
| `tests/unit/preset.test.ts` | Case theo v2 | TV4 |
| `tests/unit/preset.contract.test.ts` | Case theo v2; đổi unknown-key từ drop sang reject; bỏ kỳ vọng `particleCount` bước 1.000 | TV4, TV1 review |
| `src/core/measurement/configHash.ts` | Bỏ config phẳng; đọc `simulation` + group mode đang bật; đổi literal mode | TV1 |
| `tests/unit/measurement.contract.test.ts` | `canonicalConfig` và hash cố định theo v2 | TV1 |
| `tests/support/fakeRenderer.ts` + benchmark tests | Dựng config từ `DEFAULT_CONFIG` theo shape mới | TV1 |
| `docs/architecture.md` | §5.1 (configHash), policy unknown-key, ví dụ config | TV1 |
| `src/core/renderer/RendererPort.ts` | **không đổi chữ ký**; shape của `LabConfig` đổi | TV1 |
| `public/examples/attractor-preset.json` | Thay bằng ví dụ v2 | TV4 |
| UI (TV4) | Sinh control từ `PARAM_SPEC`/schema; cập nhật range strength 0–100 và label theo mode | TV4 |

## 9. Việc tiếp theo sau khi chốt

1. Merge PR #1 (hoặc rebase PR này) để có v1/schema/code tham chiếu.
2. TV4 + TV1 Approve PR này sau khi đọc bản cập nhật.
3. Merge PR này, mở issue triển khai schema v2 (TV4) và `configHash` (TV1).
4. TV2 xác nhận công thức `attractor`/`vortex`, bổ sung tham số vortex nếu cần, rồi port engine vào
   `src/simulations/` sau `RendererPort`.
5. Flow/curl-noise (nếu làm) dùng schema version mới, không nhét lại vào v2.
