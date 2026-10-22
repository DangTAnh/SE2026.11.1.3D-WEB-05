# Tiến độ GitHub — 22/10/2026

## Phạm vi và nguồn

Snapshot đọc trực tiếp GitHub và Git ngày 22/10/2026 (Asia/Saigon).
Đây là cập nhật theo từng nhánh, không phải nghiệm thu toàn dự án.

| Nhánh tại thời điểm khảo sát | HEAD | Trạng thái có bằng chứng |
|---|---|---|
| `main`, `develop` | `99f2398` | Commit khởi tạo, tree rỗng; chưa tích hợp sản phẩm |
| `feat/tv4-week1-ui-ux` trên GitHub | `11eedfd` | UI tuần 1, Canvas2D mock, preset và tài liệu UX |
| TV4 cục bộ | `3c2b00e` | Thêm pre-integration `adfca0d` và quality tooling `3c2b00e`; đủ 3 commit TV4 |
| `feat/tv1-architecture-srs` trên GitHub | `bcb9477` | Contracts, measurement tooling, tài liệu kiến trúc/ownership, unit tests và CI |

GitHub chưa có nhánh `dev`; người dùng đã chọn `develop` làm đích PR.
Khi bắt đầu khảo sát, danh sách PR có 0 mở và 0 đóng.
Default branch đang là `feat/tv4-week1-ui-ux`.

## Kết quả và phần còn thiếu

- **TV4:** đã có UI responsive, controls, preset JSON Schema v1/Ajv,
  view-model runtime, status/notification, thiết kế và bộ kiểm thử tự động.
  Bộ kiểm tra ngày 22/10 đạt; xem [biên bản kiểm tra](../04-testing/TV4-pr-verification-2026-10-22.md).
- **TV1:** source có `RendererPort`, backend identity, `PerformanceSnapshot`,
  SHA-256 `configHash`, aggregation/grouping, result validation/serialization,
  Markdown report và architecture fitness checks. Code này đang ở nhánh TV1,
  chưa có trong `develop` hay gói TV4. Các test của TV1 chưa được chạy lại trong phiên này.
- **GPU/simulation:** các nhánh remote khảo sát chưa có renderer adapter,
  Attractor/Vortex GPU thật, WebGL2 fallback thật hay composition nối UI vào engine.
- **Đo hiệu năng:** có tooling xử lý dữ liệu ở TV1, chưa có collector thật,
  bộ kết quả benchmark hai backend hoặc nghiệm thu FR sản phẩm.
- **Tài liệu:** README nhánh TV1 vẫn ghi 24 unit tests dù nhánh đã thêm nhiều
  test sau đó; không dùng số này làm kết quả kiểm tra hiện tại.

Không quy đổi số commit hoặc số file thành phần trăm hoàn thành đề tài.
Master plan/decision POC đang tồn tại riêng trong checkout cục bộ, chưa được
commit/publish; không dùng chúng để khẳng định đã có trên GitHub, cũng không
ghi đè quyết định kiến trúc ngày 22/10 của TV1 bằng tài liệu cũ.
G1/G2 trong master plan cục bộ vẫn chưa được duyệt; phiên cập nhật/PR này
không phê duyệt stack, contracts, physics, ranges hoặc NFR thay nhóm.

## Phương án PR TV4

TV4 gốc và `develop` không có merge-base. GitHub báo “entirely different
commit histories”, nên không mở PR trực tiếp từ nhánh TV4 gốc được.

Nhánh chuẩn bị: `codex/tv4-into-develop`, tạo từ `develop@99f2398`, rồi
cherry-pick đúng ba commit TV4:

| Commit TV4 gốc | Commit trên nhánh chuẩn bị |
|---|---|
| `11eedfd` — week-1 UI | `e701ab6` |
| `adfca0d` — pre-integration | `c8df826` |
| `3c2b00e` — quality tooling | `0b5b6bd` |

Trước cập nhật tài liệu hôm nay, `git diff local/tv4 HEAD` rỗng: tree của
nhánh chuẩn bị khớp hoàn toàn TV4 cục bộ. Sau đó chỉ bổ sung tài liệu tiến độ,
kiểm tra và nội dung PR. Không đưa gói TV1 lưu trữ hoặc thay đổi chưa commit
trong checkout cục bộ vào PR này.

Đích: `develop`. Reviewer đề nghị: `DangTAnh`.
Đưa gói UI prototype vào review không có nghĩa là chấp nhận engine sản phẩm.

## Các điểm cần DangTAnh/nhóm quyết định

1. Chấp nhận baseline UI/preset/tooling trước khi ghép engine.
2. Chốt preset unknown-key policy: TV4/Ajv hiện **reject** trường lạ;
   `tests/unit/preset.contract.test.ts` ở TV1 yêu cầu **drop** trường lạ.
   Đây là khác biệt hành vi có thật, cần quyết định trước tích hợp TV1/TV4.
3. Thống nhất runner: TV4 dùng Vitest/Playwright, TV1 dùng `node:test`.
   Không tự ghép hai bộ test rồi coi `npm test` đã bao phủ cả hai.
4. Ghép lại các file dùng chung (README, package/lock, preset, bootstrap,
   UI specs, ownership) theo nội dung; nhánh TV1 vẫn dựa UI tuần 1 và có
   lịch sử khác `develop`. Không chọn toàn bộ một phía để giải quyết xung đột.
5. Nối `RendererPort`/metrics thật, chốt `LabConfig` và WebGL2 compute path.
   Mốc 29/10 trong nhánh TV1 là đề xuất, chưa phải cam kết TV4.

## Việc kế tiếp

1. Review PR TV4 vào `develop`, với trạng thái reviewer thực tế ghi trên PR.
2. TV1/TV4 chốt khác biệt preset, runner và kế hoạch hợp nhất các file chung.
3. Nhóm duyệt các quyết định còn mở rồi nối engine/collector; chạy E2E GPU
   và benchmark thật trước nghiệm thu. BL01 và R-GL-LIFECYCLE trong hồ sơ
   cục bộ vẫn mở; lần chạy UI xanh hôm nay không tự đóng hai rủi ro đó.
