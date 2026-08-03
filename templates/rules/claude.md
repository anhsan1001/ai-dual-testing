<!-- AI Dual-Track Testing Skill — injected by ai-dual-testing -->

## AI Testing — Execution Contract Verification Skill

> [!CRITICAL] THỰC THI TỰ ĐỘNG — KHÔNG HỎI XÁC NHẬN
> KHÔNG xuất ra "Action Plan" hay hỏi "Bạn có muốn... không?".
> Phân chia nhiệm vụ cho các Subagent chuyên trách. PHẢI hoàn thành 100% các bước dưới đây.

### Khi nào kích hoạt
- Khi user nói "verify", "kiểm tra", "test lại", "check coverage"
- Khi user nói "verify feature X"

---

### EXECUTION CONTRACT — 5 BƯỚC BẮT BUỘC

> [!CRITICAL] MỌI BƯỚC ĐỀU BẮT BUỘC. KHÔNG ĐƯỢC SKIP BƯỚC NÀO.
> Sau mỗi bước, PHẢI xuất checkpoint theo format:
> `[STEP-N] ✅ Mô tả kết quả`
> Nếu bước thất bại: `[STEP-N] ❌ Lý do thất bại`

#### STEP 1: Lock Requirements (Chống trôi kết quả)

**Tool calls bắt buộc:** `read_file` → `.ai-testing/configs/requirements.json`

1. Đọc file `.ai-testing/configs/requirements.json`
2. Nếu `locked: true` → Dùng đúng danh sách requirements đã lock. KHÔNG thêm/bớt/đổi ID.
3. Nếu `locked: false` hoặc `requirements: []`:
   - Đọc requirement từ conversation context / PRD / README
   - Lập danh sách cố định với ID: R01, R02, R03...
   - Ghi vào `requirements.json` với `locked: true`, `lockedAt: <timestamp>`
   - Format mỗi requirement:
     ```json
     { "id": "R01", "description": "Mô tả", "acceptanceCriteria": "Điều kiện", "priority": "HIGH", "type": "FUNCTIONAL" }
     ```
4. Output: `[STEP-1] ✅ Requirements locked: {N} items`

#### STEP 2: Code Mapping (Phân tích Codebase)

**Tool calls bắt buộc:** `read_file` hoặc `grep_search` cho TỪNG requirement

1. Với MỖI requirement từ Step 1, đọc source code để xác định:
   - **✅ PASS**: Code có xử lý đúng theo requirement
   - **❌ FAIL**: Code thiếu logic hoặc xử lý sai
   - **⚠️ PARTIAL**: Code có nhưng chưa đầy đủ
2. Ghi lại: Requirement ID → File path → Status
3. Output: `[STEP-2] ✅ Code mapping done: {passed}/{total} PASS, {failed}/{total} FAIL`

#### STEP 3: Test Execution (Chạy Vitest + Playwright)

**Tool calls bắt buộc:**
- `run_command` → `npx vitest run` (nếu có vitest)
- `write_to_file` → `.ai-testing/e2e/{feature}.spec.ts` (tạo E2E test)
- `run_command` → `npx playwright test .ai-testing/e2e/ --config .ai-testing/configs/playwright.config.ts`

> [!IMPORTANT] PHẢI chạy test cho cả phần PASS và FAIL từ Step 2.
> Phần PASS → verify đúng. Phần FAIL → confirm thiếu.

1. Chạy unit test: `npx vitest run` (nếu project có vitest)
2. Tạo E2E test files trong `.ai-testing/e2e/{feature}.spec.ts`
3. Chạy Playwright: `npx playwright test .ai-testing/e2e/ --config .ai-testing/configs/playwright.config.ts`
4. Chụp screenshot: Mobile (375px), Tablet (768px), Desktop (1920px)
5. Output: `[STEP-3] ✅ Tests run: {N} spec files, {M} screenshots captured`

#### STEP 4: Viết RTM Files (BẮT BUỘC trước khi gọi verify.ts)

**Tool calls bắt buộc:** `write_to_file` → `.ai-testing/reports/{feature}.rtm.json`

> [!CRITICAL] PHẢI tạo file .rtm.json TRƯỚC khi chạy verify.ts.
> Đây là bước quan trọng nhất mà trước đây thường bị skip.

1. Với MỖI feature đã test, tạo file `.ai-testing/reports/{feature}.rtm.json`:
   ```json
   {
     "feature": "tên feature",
     "testedAt": "ISO timestamp",
     "requirements": [
       {
         "id": "R01",
         "description": "Mô tả requirement",
         "acceptanceCriteria": "Điều kiện chấp nhận",
         "testCases": "Tên test case đã chạy",
         "status": "✅",
         "round": 1,
         "notes": "Ghi chú kết quả"
       }
     ]
   }
   ```
2. Requirement IDs trong .rtm.json PHẢI khớp 1:1 với requirements.json
3. Status chỉ được dùng: `✅` (pass), `❌` (fail), `⚠️` (partial/warning)
4. Output: `[STEP-4] ✅ RTM files written: {file1}, {file2}...`

#### STEP 5: Master Report (Tổng hợp)

**Tool calls bắt buộc:** `run_command` → `npx tsx .ai-testing/scripts/verify.ts`

1. Chạy: `npx tsx .ai-testing/scripts/verify.ts`
2. Đọc output và trình bày cho user:
   - **Bảng RTM** (Requirement Traceability Matrix)
   - **Gap Report** (Severity: 🔴 High, 🟡 Medium, 🟢 Low)
   - **Coverage %** (Requirement Coverage + Code Coverage)
3. Output: `[STEP-5] ✅ verify.ts executed: {pct}% coverage`

> [!IMPORTANT] KHÔNG tự ý sửa code — chỉ báo cáo kết quả và chờ user quyết định.

---

### Non-Functional Checks (Bắt buộc — dùng tool calls)

| Check | Tool call bắt buộc |
|-------|--------------------|
| Security | `grep_search` tìm `innerHTML`, `eval(`, `dangerouslySetInnerHTML`, hardcoded secrets |
| Performance | Đọc build output hoặc chạy `du -sh dist/` nếu có |
| Accessibility | `grep_search` tìm `aria-label`, `role=`, `tabIndex` trong components |
| SEO | `grep_search` tìm `<title>`, `<meta`, `<h1` trong pages |
| Error UX | `grep_search` tìm `loading`, `error`, `empty` states |
| Mobile | `grep_search` tìm `@media`, responsive breakpoints |

---

### Quy tắc bắt buộc
1. PHẢI hoàn thành đủ 5 STEP với checkpoint output.
2. PHẢI tạo `.rtm.json` files TRƯỚC khi gọi `verify.ts`.
3. PHẢI dùng requirement IDs từ `requirements.json` — KHÔNG tự sinh ID mới.
4. PHẢI chụp screenshot nếu có Playwright và có UI.
5. File test E2E PHẢI lưu trong `.ai-testing/e2e/` — KHÔNG tạo trong `src/`.
6. KHÔNG skip bước nào. Nếu bước thất bại → ghi checkpoint ❌ và tiếp tục bước sau.
