---
name: ai-dual-testing
description: Smart dual-track verification skill powered by multi-agent subtask delegation. Trigger with "verify" to test and report coverage.
---

## AI Testing — Multi-Agent Smart Verification Skill

> [!CRITICAL] THỰC THI TỰ ĐỘNG BẰNG SUBAGENTS — KHÔNG HỎI XÁC NHẬN
> KHÔNG xuất ra "Action Plan" hay hỏi "Bạn có muốn... không?".
> Phân chia nhiệm vụ cho các Subagent chuyên trách để thực thi 100% công việc không bị quá tải context!

### Khi nào kích hoạt
- Khi user nói "verify", "kiểm tra", "test lại", "check coverage"
- Khi user nói "verify feature X" 

### Mô hình Phân chia Subagent (Multi-Agent Subtask Delegation)

1. **Subagent 1: `code-mapper` (Phân tích Codebase & Scope)**
   - **Nhiệm vụ**: Đọc Requirements + Đọc mã nguồn `src/`.
   - **Output**: Bảng Code Mapping (Requirement -> File Path -> Code Status: ✅ / ❌ / ⚠️).

2. **Subagent 2: `test-runner` (Chạy Playwright / Vitest & Chụp ảnh)**
   - **Nhiệm vụ**: Với các tính năng PASS ở Subagent 1:
     - Tạo/cập nhật `.ai-testing/e2e/{feature}.spec.ts`.
     - Chạy `npx playwright test .ai-testing/e2e/{feature}.spec.ts --config .ai-testing/configs/playwright.config.ts`.
     - Chụp ảnh màn hình lưu vào `.ai-testing/reports/screenshots/`.

3. **Subagent 3: `report-aggregator` (Tổng hợp Master RTM & Coverage)**
   - **Nhiệm vụ**: Gọi `npx tsx .ai-testing/scripts/verify.ts` để sinh RTM JSON, `master-rtm.md`, và `coverage-report.md`.

---

### Quy trình Smart Verification (4 bước)

#### Bước 1: Đọc Requirements & Khóa Baseline (`code-mapper`)
- **Khóa danh sách Requirement cố định (Chống trôi kết quả giữa các lần chạy)**:
  1. Kiểm tra file `.ai-testing/configs/requirements.json`. Nếu chưa có, AI đọc requirement ban đầu, lập danh sách cố định (`R01`, `R02`, `R03`...) và lưu vào `.ai-testing/configs/requirements.json`.
  2. Ở mọi lần verify sau: **BẮT BUỘC ĐỌC DANH SÁCH TỪ `.ai-testing/configs/requirements.json`**. KHÔNG tự sinh lại ID ngẫu nhiên hay đổi số lượng requirement.

#### Bước 2: Code Mapping (`code-mapper`)
- Đọc source code và tìm vị trí xử lý cho từng Requirement:
  - **Đã implement**: Code có xử lý đúng theo spec → Đánh dấu PASS Code Mapping (✅), chuyển sang Bước 3.
  - **Thiếu logic / Chưa implement**: Code không tìm thấy hoặc xử lý sai → Đánh dấu ❌ THIẾU / ⚠️ CHƯA IMPLEMENT và tạo Gap Item ngay.

#### Bước 3: Dynamic Verification & Playwright/Vitest Run (`test-runner`)
- **Vitest**: Chạy unit test (`npx vitest run`).
- **Playwright E2E (Chỉ chạy cho Feature Code có UI)**:
  - Tạo `.ai-testing/e2e/{feature-name}.spec.ts` bằng tool `write_to_file`.
  - Chạy ngay `npx playwright test .ai-testing/e2e/{feature-name}.spec.ts --config .ai-testing/configs/playwright.config.ts`.
  - Chụp ảnh màn hình bằng chứng UI (Mobile 375px, Tablet 768px, Desktop 1920px).

#### Bước 4: Master Reporting (`report-aggregator`)
1. Chạy lệnh tổng hợp duy nhất: `npx tsx .ai-testing/scripts/verify.ts`.
2. Trả ra cho User:
   - **Bảng RTM (Requirement Traceability Matrix)**.
   - **Bảng Gap Report (Phân cấp Severity 🔴 High, 🟡 Medium)**.
   - **Tỷ lệ % Coverage** (Requirement Coverage + Code Coverage).
   - **Lưu ý**: KHÔNG tự ý sửa code — báo cáo kết quả và chờ user quyết định.

### Non-Functional Checklist (bắt buộc kiểm tra)
- [ ] Security: XSS, injection, auth bypass, sensitive data
- [ ] Performance: Bundle size, lazy loading, render time
- [ ] Accessibility: ARIA labels, keyboard nav, focus management, contrast
- [ ] SEO: Meta tags, semantic HTML, heading hierarchy
- [ ] Error UX: Loading state, empty state, error message
- [ ] Mobile: Responsive layout, touch targets ≥ 44px

### Quy tắc bắt buộc
1. PHẢI thực thi tự động 100% bằng subagent delegation hoặc tool calls liên tục.
2. PHẢI chụp screenshot nếu có Playwright và có UI.
3. PHẢI chạy `npx tsx .ai-testing/scripts/verify.ts` để tổng hợp báo cáo.
4. QUẢN LÝ FILE TEST CHUẨN: Không tự ý tạo file test trong `src/`. Tất cả file test E2E cho Playwright PHẢI lưu trong `.ai-testing/e2e/{feature}.spec.ts` (đã git-ignore).
