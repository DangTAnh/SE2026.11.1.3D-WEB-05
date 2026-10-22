# Đề xuất Preset Schema v2 — 3D-WEB-05 (cần review)

**Trạng thái:** đề xuất, chưa chốt. **Người review:** TV4 (chủ `src/presets`), TV1 (chủ `src/core`, `src/main.ts`,
`.github/`), có ý kiến từ TV2/TV3/TV5 nếu liên quan.
**Chặn:** việc này chặn port engine (kernel GPU) + UI + perf, vì ai cũng đọc `LabConfig`.

## 1. Vì sao cần v2

1. **Mode thứ hai chưa đúng hợp đồng MVP.** v1 có `attractor | vortex`. Hợp đồng yêu cầu mode 2 là
   **curl-noise flow field**; `vortex` (trường xoáy) không phải curl noise → phải định nghĩa lại và đổi tên.
2. **Đổi mode là mất tham số.** v1 dùng chung `strength`/`speed` cho hai mode → không thể có bộ tham số riêng
   theo mode, và preset không round-trip được trạng thái của **cả hai** mode (luật chống drift trong tài liệu của
   nhóm: export phải là *toàn bộ*, không phải "mode đang bật").
3. **Thiếu tham số MVP:** lifetime (respawn), spawn radius, rendering (background/opacity/additive), camera
   (auto-rotate/distance/enabled).

Ngoài ra: `particleCount` với `multipleOf: 1000` chặn các giá trị luỹ thừa 2 (65536 — thân thiện GPU, mặc định
đang dùng), và `RendererPort.applyConfig(config: Readonly<LabConfig>)` cần `mode` nằm **trong** config để adapter
nhận một object duy nhất.

## 2. Thay đổi so với v1

| # | v1 | v2 | Lý do |
| - | -- | -- | ----- |
| 1 | `config.mode: attractor \| vortex` | `config.mode: orbit \| flow` | hợp đồng MVP; `attractor` ≈ `orbit` (đổi tên thuần), `flow` = curl-noise |
| 2 | `config.strength` (dùng chung) | `config.modes.{orbit,flow}.*` — mỗi mode một bộ, key có tiền tố mode | chống drift; round-trip được cả hai mode |
| 3 | `config.speed` | `config.simulation.speed` — hệ số thời gian, nhân vào `delta` | giữ field của TV4, định nghĩa rõ nghĩa |
| 4 | `config.particleSize` 1–8 | giữ 1–8, **đơn vị do adapter định nghĩa** | không rò chi tiết backend vào schema; E-06 đo parity giữa WebGPU/WebGL2 |
| 5 | `particleCount` `multipleOf 1000`, max 50 000 | bỏ `multipleOf`, max 500 000 | cho phép 65536; trần theo research; default để E-16 đo rồi chốt |
| 6 | — | `simulation.spawnRadius`, `simulation.lifetime` | MVP: spawn + respawn khi chết |
| 7 | `config.particleColor` | `rendering.{backgroundColor,particleColor,opacity,additiveBlend}` | gom nhóm rendering, khớp folder GUI |
| 8 | — | `camera.{enabled,autoRotate,distance}` | MVP: orbit camera controls |
| 9 | `{schemaVersion, app, config}` | thêm `name?` ở root (optional) | metadata cho thư viện preset; **không** tính vào round-trip |
| 10 | `mode` trong `config` | **giữ** trong `config` | `applyConfig(config)` một object; tính "structural" do adapter xử lý, không do layout file |
| 11 | serialize tự do | thứ tự key theo schema, `JSON.stringify(…, null, 2)` + `\n`, bỏ `name` khi rỗng | round-trip byte-stable |

## 3. Schema và ví dụ

- **Schema:** [`preset-schema-v2.schema.json`](./preset-schema-v2.schema.json) (JSON Schema draft 2020-12,
  `additionalProperties: false`, `required` đầy đủ ở mọi tầng).
- **Ví dụ hợp lệ:**

```json
{
  "schemaVersion": 2,
  "app": "3D-WEB-05",
  "name": "orbit swarm",
  "config": {
    "mode": "orbit",
    "backendPreference": "auto",
    "simulation": { "particleCount": 65536, "spawnRadius": 12, "particleSize": 2.5, "lifetime": 6, "speed": 1.2 },
    "modes": {
      "orbit": { "orbitStrength": 12, "orbitRadius": 6, "orbitDamping": 0.98 },
      "flow": { "flowStrength": 12, "flowNoiseScale": 1.5, "flowDamping": 0.98 }
    },
    "rendering": { "backgroundColor": "#0b0e14", "particleColor": "#ffffff", "opacity": 0.6, "additiveBlend": true },
    "camera": { "enabled": true, "autoRotate": true, "distance": 42 }
  }
}
```

## 4. Mapping từ bộ tham số đã implement (17 key của engine) sang v2

| Key đang chạy | Đường dẫn v2 | Dùng ở đâu |
| ------------- | ------------ | ---------- |
| `mode` | `config.mode` | chọn kernel (structural → recompile) |
| `particleCount` | `config.simulation.particleCount` | kích thước storage buffer + `object.count` |
| `spawnRadius` | `config.simulation.spawnRadius` | uniform của kernel init (spawn) |
| `pointSize` | `config.simulation.particleSize` | `material.scaleNode` (đơn vị do adapter định nghĩa) |
| `lifetime` | `config.simulation.lifetime` | uniform respawn (M3) |
| — | `config.simulation.speed` | hệ số nhân `delta` (từ v1 của TV4) |
| `orbitStrength` | `config.modes.orbit.orbitStrength` | uniform kernel `orbit` |
| `orbitRadius` | `config.modes.orbit.orbitRadius` | uniform kernel `orbit` |
| `damping` | `config.modes.orbit.orbitDamping` | uniform kernel `orbit` (**đổi tên** cho nhất quán tiền tố) |
| `flowStrength` | `config.modes.flow.flowStrength` | uniform kernel `flow` |
| `noiseScale` | `config.modes.flow.flowNoiseScale` | uniform `curlNoise` (**đổi tên**) |
| `flowDamping` | `config.modes.flow.flowDamping` | uniform kernel `flow` |
| `backgroundColor` | `config.rendering.backgroundColor` | `scene.background` |
| `opacity` | `config.rendering.opacity` | `material.opacityNode` |
| `additiveBlend` | `config.rendering.additiveBlend` | blending của material |
| — | `config.rendering.particleColor` | `material.colorNode` (từ v1 của TV4) |
| `cameraEnabled` | `config.camera.enabled` | bật/tắt OrbitControls |
| `cameraAutoRotate` | `config.camera.autoRotate` | OrbitControls |
| `cameraDistance` | `config.camera.distance` | OrbitControls |
| — | `config.backendPreference` | `RendererPort.init()` (từ v1 của TV4) |

## 5. Bằng chứng validate

Ajv 2020-12 với `{ allErrors: true, strict: true }` — **đúng cách `src/presets/preset.ts` đang dùng**:
**11/11 case PASS**

- hợp lệ đầy đủ ✓ · `name` bỏ trống ✓ · `particleCount` = 65536 (không còn `multipleOf`) ✓
- thiếu `lifetime` ✗ · key thừa trong `simulation` ✗ · `particleCount` < min ✗ · không phải integer ✗
- màu sai định dạng ✗ · `mode: "vortex"` ✗ · thiếu `orbitDamping` ✗ · key thừa ở root ✗

(Case ⇔ đúng/sai như mong đợi. Đây là kiểm *schema*; round-trip serializer được kiểm riêng ở engine.)

## 6. Câu hỏi cần chốt (kèm khuyến nghị)

1. **`vortex` → `flow` (curl-noise)** — xác nhận? Nếu nhóm muốn giữ chữ `attractor` thì có thể đổi `orbit` →
   `attractor`, nhưng mode 2 **phải** là curl-noise flow.
2. **`particleCount`**: bỏ `multipleOf`, max 500 000, default 65 536 (GUI vẫn step 1000) — OK?
3. **`particleSize` 1–8** giữ nguyên, đơn vị do adapter định nghĩa; E-06 đo rồi chốt hệ số — OK?
4. **`speed`** là hệ số thời gian toàn cục (nhân vào `delta`) — OK?
5. **`name`** optional ở root — giữ?
6. **Preset v1 cũ**: từ chối kèm thông báo (khuyến nghị — `vortex` không map được) hay migrate tự động
   (`attractor`→`orbit`, `vortex`→`flow`, bịa tham số còn thiếu)?
7. **Ai cập nhật** `formatValidationError()` (map thông báo theo path đã đổi) + `tests/unit/preset.test.ts`
   (TV4) + `tests/unit/preset.contract.test.ts` (TV1)? Đề xuất: TV4, cùng PR tích hợp.

## 7. Ảnh hưởng lên code hiện có của nhóm

| File | Việc |
| ---- | ---- |
| `src/presets/preset.ts` | `LabConfig`, `DEFAULT_CONFIG`, `parsePreset` theo v2; trỏ schema v2 |
| `docs/02-design/preset-schema-v1.schema.json` | giữ nguyên (lịch sử), thêm v2 cạnh nó |
| `tests/unit/preset.test.ts`, `tests/unit/preset.contract.test.ts` | case theo v2 |
| `src/core/renderer/RendererPort.ts` | **không đổi chữ ký**; shape của `LabConfig` đổi |
| `public/examples/attractor-preset.json` | thay bằng ví dụ v2 |
| UI (TV4) | sinh control từ spec (schema/`PARAM_SPEC`) thay vì hard-code 7 field |

## 8. Việc tiếp theo sau khi chốt

1. Issue + branch + PR vào `dev` cho schema v2 (theo `CONTRIBUTING.md`).
2. Chốt test runner dùng chung (nhóm đang có **hai**: `node --test` ở TV1, **vitest** ở TV4) — không thể giữ cả hai.
3. Port engine (kernel GPU đang chạy: `orbit` trên WebGPU + fallback WebGL2) vào `src/simulations/` sau `RendererPort`.
