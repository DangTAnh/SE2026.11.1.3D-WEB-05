# Dữ liệu cập nhật PDF BT3_23001828_VT-121.pdf

Ngày kiểm chứng02/11/2026. Không tự sửa PDF. Trần Duy Anh—23001828, TV4, SE2026-T30. Trạng thái tổng: **PARTIAL_COMPLETE**, không ghi FULLY_COMPLETE.

## Git và tích hợp

| Mục | Dữ liệu | Trạng thái |
|---|---|---|
| Repository | https://github.com/DangTAnh/SE2026.11.1.3D-WEB-05 | VERIFIED origin local; API hiện tại BLOCKED |
| Branch chính | feat/tv4-bt3-vt121-undo-import-v2 | VERIFIED local; chưa push |
| Target dự kiến | dev theo AGENTS/CONTRIBUTING | PARTIAL, remote HEAD chưa xác minh |
| Baseline thực đo | 2389f0f550b33899801e1ab07c6312baea0c9faf | VERIFIED cached origin/dev; không gọi là mới nhất |
| RED v2 | bfd124749412e93d32b4048d0fd6173bb4f58cb9 | VERIFIED test chạy trước production patch, fail thiếu Undo |
| GREEN v2 | e808d70a792ffb377c8b310f8f9e0bb441ba5dc0 | VERIFIED code/feature tests |
| Verification HEAD | e7b72e7b169de05617a99508e310bdf7c8f59df0 | VERIFIED, tách artifact từng campaign |
| Final delivery HEAD | xem ledger cuối handoff/results.json sau commit tài liệu | được bổ sung ở gói cuối |
| Draft PR URL/isDraft | chưa tạo/chưa xác minh | BLOCKED_NETWORK, không tự điền URL |
| CI/human review | NOT_RUN/HUMAN_REVIEW_PENDING | không thay bằng AI review |

Lịch sử v1 được giữ nguyên, không trộn PASS sang v2: RED7da2ad25c1a1744a229a55e6c759e1e596f05f02; GREEN388b915c741635d8d55b28287a161eebab892997; evidence2f8bc2cd6650476d15d8a72ba206f237378296dc. Các kết quả70,41% bundle hoặc p95 dưới2ms cũ không phải kết quả v2 hiện tại.

## Bảng kết quả được phép đưa vào PDF

| Kiểm chứng | Kết quả thực | Nhãn |
|---|---|---|
| Baseline v2 |241 tests PASS, typechecks PASS | VERIFIED |
| RED trước sửa | E1 import/export đúng; FAIL vì không có Undo; exit1 | VERIFIED expected RED |
| GREEN trọng tâm |312 unit/integration;8 E2E desktop/mobile PASS | VERIFIED |
| Full verify cuối |312 unit/integration;84 E2E PASS,8 capability SKIP,0 FAIL; typechecks/build PASS; exit0 | VERIFIED trong transport mô tả |
| Mutation | chỉ bỏ Undo guard; AUTH2 FAIL; mutation KILLED; đã xóa worktree/branch tạm | VERIFIED |
| Coverage |100% line/branch/function của importUndo.ts và presetFile.ts bằng Node trực tiếp source; toàn app NOT_MEASURED | VERIFIED phạm vi chọn |
| Flaky/order |3×312 unit với seed121–123;3×8 E2E PASS, retries0 | VERIFIED; giữ cả lỗi hạ tầng đã phát hiện |
| Node200 tasks |5 vòng,0 lỗi; p9532.678–36.323ms | VERIFIED synthetic, không phải200 users |
| Browser200 jobs/pool10 |0 lỗi chức năng; queue p9513.347999s >5s; service-only p950.894348s | VERIFIED phép đo; KHÔNG đạt mốc5s theo queue trong harness |
|200 users thực end-to-end | chưa đo200 browser contexts đồng thời | NOT_VERIFIED/NOT_RUN |
| API | repo không có API/auth server | NOT_APPLICABLE |
| Fetch/push/PR | DNS lỗi; không có HTTP401/403 để kết luận auth | BLOCKED_NETWORK |
| Physical GPU recovery/performance | test UI/port và headless không chứng minh phần cứng thật | NOT_VERIFIED |

Không xóa các lần FAIL: full lần đầu79PASS/8SKIP/5FAIL do HMR; lần chạy song song80PASS/8SKIP/4FAIL do artifact ENOENT. Full độc lập cuối84PASS/8SKIP là execution khác, đã sửa transport/cách chạy, không dùng retries che lỗi. Lần browser benchmark đầu lỗi quoting PowerShell trước khi chạy workload; số đo thực nằm trong09-browser-performance-fixed.log.

## AI review và traceability

Plan gốc đã lưu trước patch. Hai revision từ source: snapshot LabConfig không đủ vì thiếu name; rollback mọi exception sai với reset lỗi sau commit. V2 còn đổi count max500000/no multipleOf và precision. Review AI độc lập phát hiện oracle toast bị export che; đã thêm assertion trước export. HMR và outputDir là lỗi giả định/cách chạy thực, có log FAIL và bản sửa. Symbol chỉ là capability nội bộ, không là authorization nhiều tài khoản.

AC1/2→S1,S2,E1; AC3→B1–B7,FILE1,E2; AC4→AUTH1–AUTH3 và mutation AUTH2; AC5→FAIL1–FAIL5,RACE1/2,S3,E3/E4. Bảng đầy đủ: VT121-test-strategy.md và VT121-traceability.md. Source/test paths và commits có thật trong Git bundle/code snapshot.

## Reflection nháp —301 từ theo whitespace split

Độ tin cậy của thay đổi tăng nhờ kiểm chứng trên schema v2 thay vì suy từ kết quả v1. Test RED chạy trước production patch, nhập và xuất document thành công rồi thất bại vì thiếu Undo. Cùng luồng đó chuyển sang GREEN, so sánh toàn bộ cấu hình lồng, metadata và yêu cầu gửi tới RendererPort. Đây là bằng chứng mạnh hơn việc chỉ thấy nút xuất hiện.

BVA dựa trên schema thật giúp loại bỏ giả định particle count phải chia hết cho một nghìn. Test negative không chỉ yêu cầu exception mà còn kiểm tra state và lịch sử trước thao tác. Mutation bỏ guard riêng tại Undo làm test unauthorized thất bại, cho thấy test phát hiện được lỗi đã chọn. Tuy vậy, Symbol chỉ kiểm tra quyền gọi nội bộ, không chứng minh bảo mật giữa tài khoản.

AI hỗ trợ tách controller, xây dựng portfolio và rà diff, nhưng cần kiểm soát các giả định trông hợp lý. Snapshot chỉ chứa LabConfig sẽ làm mất tên preset. Rollback mọi exception cũng sai khi reset thất bại sau khi cấu hình đã commit. Review độc lập còn phát hiện assertion toast có thể bị thao tác export che khuất; test đã được bổ sung.

Những giới hạn phải giữ rõ gồm rollback lỗi, side effect GPU bất đồng bộ và baseline dev mới nhất chưa fetch được. Coverage nguồn chỉ áp dụng hai module được chọn. Benchmark Node và browser harness không đại diện hai trăm người dùng thật. Transport kiểm thử không chứng minh triển khai HTTP. Test tiếp theo có giá trị cao nhất là đồng bộ dev hiện hành, chạy lại integration và workload trình duyệt trên môi trường mạng hoạt động, rồi để thành viên nhóm review trước quyết định merge.

Sinh viên phải review/chịu trách nhiệm phản ánh cá nhân cuối cùng.

## Evidence và giới hạn cần giữ

Nguồn chính: logs/03-red.log;04-green-final-feature.log;05-regression-isolated.log;06-mutation.log;07-coverage-final.log;08-flaky.log và log từng vòng;09-performance-isolated.log;09-browser-performance-fixed.log;10-github-pr.log. Xem VT121-performance-results.md cho duration/p50/p95/p99/throughput/errors từng vòng và raw200 samples.

Baseline mới nhất còn BLOCKED; rollback chỉ bảo đảm có điều kiện khi callback phục hồi hoạt động; side effects GPU bất đồng bộ chưa chứng minh; FakeRenderer không là GPU benchmark; transport không là HTTP triển khai; queue browser vượt5s; chưa human review, chưa PR. Không yêu cầu ChatGPT ghi PASS cho các mục này. ZIP/Git bundle không thay thế URL Draft PR.
