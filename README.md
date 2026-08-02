# 🧪 AI Dual-Track Testing

> One-command verification skill for Vibe Code projects.

## Install

```bash
npx ai-dual-testing
```

**That's it.** Your AI tool now knows how to verify code.

## What it does

1. **Detects** your AI tool (Cursor, Antigravity, Claude Code, Windsurf)
2. **Injects** testing rules into your AI tool's config
3. **Scaffolds** `.ai-testing/` with scripts and configs

## Usage

After install, tell your AI:

```
verify
verify feature login
kiểm tra
check coverage
```

The AI will:
- Read requirements from conversation context
- Generate RTM (Requirement Traceability Matrix)
- Write and run tests (Vitest + Playwright)
- Capture screenshots for UI evidence
- Report gaps with severity
- **NOT auto-fix** — you decide what to fix

## Output

```
📋 RTM: 8 requirements
✅ R01: Login form hiện đúng
✅ R02: Validation email
❌ R04: Lock sau 5 lần sai → THIẾU
⚠️ R07: Remember me → chưa implement

📊 Coverage: 6/8 = 75% ❌

❌ Gaps:
| Gap | Severity | Mô tả |
|-----|----------|-------|
| G01 | 🔴 High  | Thiếu lock sau 5 lần login sai |
| G02 | 🟡 Medium| Chưa implement Remember Me |
```

## Files created

```
.ai-testing/
├── scripts/
│   ├── verify.ts           ← Main verification script
│   ├── master-rtm.ts       ← RTM aggregator
│   └── coverage-report.ts  ← Dual coverage check
├── configs/
│   └── thresholds.json     ← Coverage thresholds
├── reports/
│   ├── screenshots/        ← Playwright screenshots
│   └── .gitkeep
└── e2e/                    ← Playwright test dir
```

## Supported AI Tools

| Tool | Rule file |
|------|-----------|
| Cursor | `.cursorrules` (appended) |
| Antigravity | `.agents/skills/ai-testing/SKILL.md` |
| Claude Code | `CLAUDE.md` (appended) |
| Windsurf | `.windsurfrules` (appended) |
| None detected | `AGENTS.md` (created) |

## Scripts

```bash
# Run verification summary
npx tsx .ai-testing/scripts/verify.ts

# Aggregate RTM data
npx tsx .ai-testing/scripts/master-rtm.ts

# Generate coverage report
npx tsx .ai-testing/scripts/coverage-report.ts
```

## License

MIT
