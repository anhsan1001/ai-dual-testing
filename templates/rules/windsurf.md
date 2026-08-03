<!-- AI Dual-Track Testing Skill — injected by ai-dual-testing -->

## AI Testing — Dual-Track Verification Skill

### Khi nào kích hoạt
- Khi user nói "verify", "kiểm tra", "test lại", "check coverage"
- Khi user nói "verify feature X" 

### Quy trình verify (5 bước)

#### Bước 1: Xác định scope
- Đọc lại requirement/yêu cầu ban đầu từ conversation
- Xác định tất cả files đã tạo/sửa trong feature này
- List tất cả acceptance criteria từ requirement

#### Bước 2: Sinh RTM + Test Cases
Với MỖI requirement từ conversation, tạo:
- Acceptance Criteria dạng Given-When-Then
- Test cases đủ 4 loại: Happy Path, Edge Case, Error Case, Boundary
- Bảng RTM: Requirement → AC → Test Case → Status

Lưu vào `.ai-testing/reports/{feature-name}.rtm.json` theo format:
```json
{
  "feature": "Feature Name",
  "requirements": [
    {
      "id": "R01",
      "description": "Mô tả requirement",
      "acceptanceCriteria": "AC-01",
      "testCases": "TC001,TC002",
      "status": "✅",
      "round": 1,
      "notes": ""
    }
  ]
}
```

#### Bước 3: Detect tools & chạy test

**TRƯỚC KHI TEST, kiểm tra package.json xem có gì:**
- Có `vitest` trong devDependencies? → Chạy unit test: `npx vitest run`
- Có `@playwright/test` trong devDependencies? → Chạy E2E: `npx playwright test`
- Không có cả hai? → Bỏ qua chạy test, CHỈ review code vs requirement

**Adapt theo tool có sẵn:**
| Có Vitest | Có Playwright | AI làm gì |
|-----------|--------------|----------|
| ❌ | ❌ | Review code → RTM + Gap Report (không chạy test) |
| ✅ | ❌ | Chạy unit test, skip E2E |
| ❌ | ✅ | Chạy E2E + screenshot, skip unit test |
| ✅ | ✅ | Full: unit test + E2E + screenshot |

**Nếu có Playwright:**
- **PHẢI viết file E2E spec**: Tạo/cập nhật file test `.ai-testing/e2e/{feature-name}.spec.ts` chứa các kịch bản test (Happy Path, UI, Responsive) dựa trên RTM ở Bước 2.
- Chạy: `npx playwright test .ai-testing/e2e/{feature-name}.spec.ts`
- PHẢI chụp screenshot từng bước quan trọng lưu vào `.ai-testing/reports/screenshots/`
- Test responsive: mobile 375px, tablet 768px, desktop 1920px

**Nếu không có test tool nào:**
- Review code thủ công: đọc từng file, so sánh với requirement
- Đánh status mỗi requirement: ✅ đúng / ❌ sai hoặc thiếu / ⚠️ chưa implement
- Vẫn tạo RTM và Gap Report như bình thường

#### Bước 4: Đánh giá & Gap Report
So sánh code với RTM:
- ✅ Implement đúng và đầy đủ
- ❌ Implement sai hoặc thiếu logic  
- ⚠️ Chưa implement

Tạo Gap Report:
| Gap-ID | Type | Requirement | Mô tả | Severity |
|--------|------|------------|-------|----------|
| G01 | Logic | R03 | Thiếu xử lý timeout | 🔴 High |
| G02 | UI | R01 | Button quá nhỏ mobile | 🟡 Medium |

Type: Logic | UI | Security | A11y | Performance

Chạy: `npx tsx .ai-testing/scripts/coverage-report.ts`

#### Bước 5: Báo cáo cho user
Output bảng RTM + Gap Report + Coverage %:
- Nếu PASS → "✅ Feature verified — Coverage X%"
- Nếu FAIL → danh sách gaps + severity, hỏi user muốn fix gì
- KHÔNG tự fix — user quyết định

### Non-Functional Checklist (bắt buộc kiểm tra)
- [ ] Security: XSS, injection, auth bypass, sensitive data
- [ ] Performance: Bundle size, lazy loading, render time
- [ ] Accessibility: ARIA labels, keyboard nav, focus management, contrast
- [ ] SEO: Meta tags, semantic HTML, heading hierarchy
- [ ] Error UX: Loading state, empty state, error message
- [ ] Mobile: Responsive layout, touch targets ≥ 44px

### Quy tắc bắt buộc
1. PHẢI đọc lại requirement GỐC từ conversation, không suy luận từ code
2. PHẢI có test cases cho Edge Case + Error Case, không chỉ Happy Path
3. PHẢI chụp screenshot nếu có UI VÀ có Playwright. Nếu không có Playwright → ghi note trong report
4. PHẢI chạy `npx tsx .ai-testing/scripts/coverage-report.ts` để report
5. KHÔNG được skip Non-Functional checklist
6. KHÔNG tự fix code — chỉ report gaps cho user
7. THỰC THI TRỰC TIẾP: Chạy liên tục cả 5 bước bằng tool calls, KHÔNG tạo plan file hay dừng chờ xác nhận ở các bước trung gian.
8. QUẢN LÝ FILE TEST CHUẨN: Không tự ý tạo các file test phụ trong thư mục mã nguồn chính (`src/`). Tất cả file test E2E cho Playwright PHẢI viết và lưu gọn trong `.ai-testing/e2e/{feature}.spec.ts` (đã được git-ignore toàn bộ).
