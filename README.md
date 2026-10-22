# 3D-WEB-05 — GPU Particle Lab

Tiến độ GitHub ngày 22/10/2026 và các điểm cần review trước tích hợp:
[snapshot dự án](docs/05-management/github-progress-2026-10-22.md).

> **Scaffold tuần 1 + UI pre-integration của TV4**, chưa phải sản phẩm GPU cuối cùng. README này là bản tạm, TV1 nên tiếp quản để bổ sung thông tin chung.

## Mục tiêu đề tài

Ứng dụng web trình diễn hàng chục nghìn particle với GPU simulation trên WebGPU, fallback WebGL2, tối thiểu hai simulation modes, bảng điều khiển, FPS / GPU timing (nếu khả dụng), export/import preset JSON và benchmark giữa hai backend.

## Chạy UI prototype

Cần **Node.js >=22.16** và npm. Dùng terminal ở thư mục repo:

```bash
npm install
npm run dev
```

Truy cập đường dẫn do Vite hiển thị (thường là `http://localhost:5173`). Các lệnh khác:

```bash
npm run typecheck
npm run typecheck:tests
npm test
npx playwright install chromium
npm run test:e2e
npm run test:a11y
npm run evidence:screenshots
npm run build
npm run preview
```

`npm run verify` chạy toàn bộ typecheck, unit test, E2E/accessibility và production build. Playwright chỉ cần cài Chromium một lần trên mỗi máy. Lệnh `evidence:screenshots` tạo bốn ảnh `automated-*` trong thư mục `docs/04-testing/screenshots`.

### Phần đã làm được

- Giao diện responsive và prototype Canvas 2D, có chọn **Attractor/Vortex** để mô phỏng trực quan.
- Controls: particle count, speed, size, color, strength, backend preference (chỉ là lựa chọn UI).
- Tạm dừng / tiếp tục / reset preview, khôi phục cấu hình mặc định.
- Export/import preset JSON dùng JSON Schema v1 qua Ajv và có unit tests bằng Vitest.
- Hiển thị **backend thật hiện tại là Canvas 2D mock**, FPS của **Canvas 2D preview**, GPU timing = "Không khả dụng".
- Có fixture kiểm thử initializing/ready/fallback/unsupported/error bằng query uiState, không tạo metric giả.
- Đã tách controls, overlay, notification, template và runtime view-model để dễ ghép engine.
- Có JSON Schema preset v1, design tokens, state matrix và test cases pre-integration.
- Có Playwright E2E desktop/mobile, axe-core accessibility scan và quy trình tạo ảnh minh chứng tự động.

### Chưa triển khai — trách nhiệm của TV1/TV2/TV3/TV5

- **KHÔNG** có WebGPU/Three.js/TSL, compute shader hoặc WebGL2 fallback thật.
- **KHÔNG** có GPU FPS/GPU timing hay benchmark WebGPU vs WebGL2.
- Slider particle count lưu cấu hình mục tiêu nhưng preview Canvas2D có giới hạn tối đa 600 chấm để không gây hiểu nhầm.
- **KHÔNG** có simulation physics đúng theo engine sản xuất.

Không được báo cáo đây là phần WebGPU/WebGL2 đã hoàn thành.

## Quyền sở hữu module (đề xuất, chờ nhóm xác nhận)

| Thành viên | Code | Tài liệu chính |
|---|---|---|
| TV1 | `src/core/`, bootstrap / integration | `docs/01-requirements/SRS.md`, `docs/02-design/architecture.md`, quản lý |
| TV2 | `src/simulations/webgpu/`, `src/simulations/shared/` cùng TV3 | thiết kế và nghiên cứu WebGPU |
| TV3 | `src/simulations/webgl2/`, shared cùng TV2 | fallback và tương thích |
| **TV4** | `src/ui/`, `src/presets/` | use cases, UI requirements, wireframe, interaction spec |
| TV5 | `src/perf/`, `tests/` (testing tổng thể) | test plan, test environments, benchmark |

Các thư mục trống có `.gitkeep` để Git theo dõi. **Không có nghĩa là phần việc tương ứng đã được triển khai**.

## Tài liệu TV4

- [`docs/01-requirements/use-cases.md`](docs/01-requirements/use-cases.md)
- [`docs/01-requirements/ui-requirements.md`](docs/01-requirements/ui-requirements.md)
- [`docs/02-design/ui-wireframes.md`](docs/02-design/ui-wireframes.md)
- [`docs/02-design/ui-description.md`](docs/02-design/ui-description.md)
- [`docs/02-design/ui-interaction-spec.md`](docs/02-design/ui-interaction-spec.md)
- [`docs/02-design/ui-state-matrix.md`](docs/02-design/ui-state-matrix.md)
- [`docs/02-design/design-tokens.md`](docs/02-design/design-tokens.md)
- [`docs/02-design/preset-schema-v1.schema.json`](docs/02-design/preset-schema-v1.schema.json)
- [`docs/05-management/TV4-week1-handover.md`](docs/05-management/TV4-week1-handover.md)
- [`docs/05-management/TV4-pre-integration-handover.md`](docs/05-management/TV4-pre-integration-handover.md)
- [`docs/04-testing/TV4-week1-test-report.md`](docs/04-testing/TV4-week1-test-report.md)
- [`docs/04-testing/TV4-ui-test-cases.md`](docs/04-testing/TV4-ui-test-cases.md)
- [`docs/04-testing/TV4-preintegration-test-report.md`](docs/04-testing/TV4-preintegration-test-report.md)
- [`docs/04-testing/TV4-tooling-upgrade-test-report.md`](docs/04-testing/TV4-tooling-upgrade-test-report.md)
- [`docs/03-research/tooling-adoption.md`](docs/03-research/tooling-adoption.md)
- [`docs/PROJECT_STATUS.md`](docs/PROJECT_STATUS.md)
- [`docs/DELIVERY_PLAN.md`](docs/DELIVERY_PLAN.md)
- [`docs/RISK_REGISTER.md`](docs/RISK_REGISTER.md)

## Lưu ý tích hợp

`src/main.ts` là bootstrap tạm cho việc demo tuần 1. `src/presets/preset.ts` đề xuất contract `LabConfig`, cần **TV1 + TV2 + TV3 review** trước khi nối renderer thật. Giao diện không tự suy đoán trạng thái WebGPU; chỉ dùng dữ liệu thực tế từ engine sau khi tích hợp.

## Nhánh đề xuất

`feat/tv4-week1-ui-ux` → PR vào nhánh tích hợp của nhóm (hoặc `main` nếu TV1 xác nhận). Không push trực tiếp lên `main`.
