# PDF update data — BT3 VT-121

Trang đầu:
- Trần Duy Anh
- MSSV 23001828
- TV4; VT-121; SE2026-T30; 3D-WEB-05
- Repository: https://github.com/DangTAnh/SE2026.11.1.3D-WEB-05
- Baseline: 2389f0f550b33899801e1ab07c6312baea0c9faf
- Draft PR: https://github.com/DangTAnh/SE2026.11.1.3D-WEB-05/pull/81

Cam kết nguyên văn:
“Tôi chịu trách nhiệm về toàn bộ code, test và nội dung bài làm; tôi đã khai báo việc sử dụng AI.”

Tối đa8 trang nội dung chính; phụ lục AI Usage Log và log không tính giới hạn. ChatGPT tạo PDF sau; Codex không tạo/chỉnh PDF. Sinh viên xác nhận reflection.

## Nội dung và nguồn

Specification/AC/invariant/NFR: VT121-test-strategy.md. AC1 validated complete snapshot after commit; AC2 restore predecessor exactly once; AC3 invalid input preserves state/history; AC4 internal capability; AC5 stale reads/edit invalidation and conditional recovery. Invariant: full validated document/name restored, history unchanged on rejected input/unauthorized access; no universal GPU atomicity. NFR: accessible native Undo/live region; p95 target5s for200 tasks/users, distinguish measured scopes. No framework/dependency/schema/backend changes.

Plan: VT121-initial-plan-original.md and VT121-plan-review.md. Revisions: LabConfig-only snapshot→full PresetDocument including name; generic rollback→CommittedPresetError for reset after committed configuration, justified by existing ui-port contract. Also replace v1 BVA with actual v2 boundaries.

Portfolio (>=10 cases): S1 snapshot, S2 sequence, S3 edit, S4 malformed snapshot; B1 count999/1000/1001/499999/500000/500001; B2 speed.099/.1/.101/2.999/3/3.001; B3 size; B4/B5 strengths; B6 malformed/version; B7 name0/1/80/81; FILE1 bytes0/1/999999/1000000/1000001; AUTH1–3; FAIL1–5; RACE1/2; E1–4. Full expected results, levels and paths in VT121-test-strategy.md, included in handoff.

RED bfd1247→patch/GREEN e808d70: output/VT121-final/logs/03-red.log exit1 missing Undo after valid import/export; output/VT121-final/logs/04-green-final-feature.log exit0. Post-dev integration merge247781d: historical336 unit/integration PASS,84 E2E PASS/12 capability SKIP,8focused PASS retries0; commands/exits in publication-result.json. New finalization results/HEAD/CI in external VT121-final-review.md and VT121-pr-ci-status.md.

Mutation: exact output/VT121-final/VT121-v2-mutation.patch removes Undo guard only; AUTH2 killed exit1, output/VT121-final/logs/06-mutation.log; final source safe. Coverage100% line/branch/function only importUndo.ts/presetFile.ts, output/VT121-final/logs/07-coverage-final.log; whole-app NOT_MEASURED. Flaky sources: HMR timing and shared artifact ENOENT. Real repeated logs08-unit-1..3.log and08-e2e-1..3.log; preserve failed05-regression*.log as history.

Performance: Node5×200 jobs synthetic p9532.678–36.323ms; browser200 jobs/pool10 queue p9513.347999s >5s (measured target NOT_MET), service-only .894348s. Real200-user SLO NOT_VERIFIED. Raw09-* logs and VT121-performance-results.md. FakeRenderer is UI/port evidence, not GPU measurement.

Traceability: VT121-traceability.md maps AC/Risk→Case→File→Commit→Actual→Evidence. AI Usage: VT121-ai-usage-log.md and preserved original plan/revisions. Human review PENDING; AI review supplementary.

## Reflection nháp

Tôi tăng mức tin cậy của thay đổi bằng bằng chứng thực thi trên schema v2. Test RED chạy trước production patch: nhập và xuất document thành công, sau đó thất bại vì thiếu Undo. GREEN kiểm tra khôi phục cấu hình lồng và tên preset. Sau đồng bộ dev, regression ghi nhận 336 unit/integration PASS, 84 E2E PASS và 12 capability SKIP; tôi phân biệt lần chạy này với các kết quả cũ.

Tôi dùng BVA theo schema thật, xét dưới, tại và trên biên, đồng thời kiểm tra độ chính xác số thập phân. Negative test kiểm tra cả state và history. Mutation chỉ bỏ guard tại Undo khiến AUTH2 thất bại; guard vẫn có trong branch cuối. Coverage 100% chỉ thuộc importUndo.ts và presetFile.ts, không đại diện toàn ứng dụng.

AI giúp lập kế hoạch và rà soát, nhưng tôi phải sửa ít nhất hai assumptions. Snapshot chỉ chứa LabConfig sẽ mất tên preset; rollback mọi exception lại sai khi reset lỗi sau lúc cấu hình đã commit. Tôi chuyển sang snapshot toàn document và phân biệt lỗi sau commit. Assertion toast cũng được đặt trước export để tránh mất dấu kết quả cần kiểm tra.

Tôi giữ các log lỗi HMR và xung đột artifact thay vì xóa chúng. Chạy lặp không thay thế review rủi ro timing hoặc shared state. FakeRenderer chứng minh hành vi UI/port, chưa chứng minh GPU thật. Browser queue p95 khoảng 13,348 giây vượt mục tiêu 5 giây; service-only thấp hơn không xóa thời gian chờ. Real 200-user SLO chưa được chứng minh. Rollback GPU bất đồng bộ còn giới hạn vì callback phục hồi không bảo đảm mọi side effect. Human review vẫn pending; tôi cần tự xác nhận bản nháp này và nhờ thành viên khác review trước khi merge.

Word count: 301; whitespace split.

## Publication verification — 02/11/2026

VERIFIED: [PR #81](https://github.com/DangTAnh/SE2026.11.1.3D-WEB-05/pull/81) OPEN, isDraft=true, base=dev, published HEAD 247781de4c90df52f54a6e0327e3dfaf7931a0d0. Fetch succeeded; merge-base with current origin/dev is 8f7c3eeb74c7a9501332b265fa16a6aa552aa2b3. Dev synchronization completed in merge commit 247781de4c90df52f54a6e0327e3dfaf7931a0d0. No rebase/force-push/merge of PR.

VERIFIED historical post-publication execution at that merge: 336 unit/integration PASS; 84 E2E PASS, 12 capability SKIP; 8 focused Undo PASS retries=0; typechecks/build PASS. Commands and exit0 are preserved in external handoff output/VT121-final/logs/publication-result.json and publication-original.log. These are not new executions in finalization.

VERIFIED CI on published merge: CI verify SUCCESS [run 41412349557](https://github.com/DangTAnh/SE2026.11.1.3D-WEB-05/actions/runs/41412349557); CodeQL SUCCESS. Finalization HEAD checks must be read separately from external VT121-pr-ci-status.md; do not transfer this PASS to a later SHA. Human review PENDING: reviews=[], reviewRequests=[] at API inspection. New finalization verification is logged separately. Overall REVIEW_PENDING; real-user SLO NOT_VERIFIED.

VERIFIED finalization rerun: `npx playwright test tests/e2e/undoImportV2.spec.ts --config=playwright.vt121.config.ts --workers=1 --retries=0`, optional transport enabled after external-request fix, 8 PASS, exit0. Raw log: `output/VT121-final/logs/11-finalization-focused.log`. Normal HTTP full verify is separate, tracked in external final-review/status; no new performance claim from this run.

VERIFIED finalization G0: `npm run build` (source/test typechecks + Vite build), exit0. Raw log: `output/VT121-final/logs/11-finalization-build.log`. Existing chunk-size warning retained; no dependency/config tuning to suppress it.
