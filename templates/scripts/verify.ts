/**
 * Verify Script — AI Dual-Track Testing
 *
 * Orchestrates: Pre-validate → Run Tests → Aggregate RTM → Generate Coverage Report.
 * Usage: npx tsx .ai-testing/scripts/verify.ts
 * Exit: 0 = PASS, 1 = FAIL
 */

import { existsSync, readdirSync, readFileSync, mkdirSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { execSync } from 'child_process';

const CWD = process.cwd();
const ROOT = resolve(CWD, '.ai-testing');
const REPORTS_DIR = resolve(ROOT, 'reports');
const SCREENSHOTS_DIR = resolve(REPORTS_DIR, 'screenshots');
const PKG_PATH = resolve(CWD, 'package.json');
const REQUIREMENTS_PATH = resolve(ROOT, 'configs', 'requirements.json');

function runCommandQuietly(cmd: string) {
  try {
    console.log(`   $ ${cmd}`);
    execSync(cmd, { cwd: CWD, stdio: 'inherit' });
    return true;
  } catch (e) {
    console.warn(`   ⚠️ Command exited with errors: ${cmd}`);
    return false;
  }
}

// ─── PRE-VALIDATION ──────────────────────────────────────
function preValidate(): { valid: boolean; reqCount: number; reqIds: string[] } {
  console.log('\n🔍 Pre-validation...\n');
  let hasErrors = false;

  // Check requirements.json exists and has items
  if (!existsSync(REQUIREMENTS_PATH)) {
    console.error('❌ FAIL: .ai-testing/configs/requirements.json not found.');
    console.error('   AI must create requirements.json in STEP 1 before running verify.');
    hasErrors = true;
    return { valid: false, reqCount: 0, reqIds: [] };
  }

  let reqData: any;
  try {
    reqData = JSON.parse(readFileSync(REQUIREMENTS_PATH, 'utf-8'));
  } catch (e) {
    console.error('❌ FAIL: requirements.json is not valid JSON.');
    return { valid: false, reqCount: 0, reqIds: [] };
  }

  const reqs = reqData.requirements || [];
  if (reqs.length === 0) {
    console.error('❌ FAIL: requirements.json has 0 requirements.');
    console.error('   AI must populate requirements in STEP 1 before running verify.');
    hasErrors = true;
    return { valid: false, reqCount: 0, reqIds: [] };
  }

  const reqIds = reqs.map((r: any) => r.id);
  console.log(`   ✅ requirements.json: ${reqs.length} requirements (locked: ${reqData.locked || false})`);

  // Check .rtm.json files exist
  const rtmFiles = existsSync(REPORTS_DIR)
    ? readdirSync(REPORTS_DIR).filter(f => f.endsWith('.rtm.json'))
    : [];

  if (rtmFiles.length === 0) {
    console.warn('   ⚠️ WARNING: No .rtm.json files in reports/. AI must create these in STEP 4.');
  } else {
    console.log(`   ✅ RTM files: ${rtmFiles.length} found`);

    // Cross-validate: check RTM requirement IDs match requirements.json
    const rtmReqIds = new Set<string>();
    for (const file of rtmFiles) {
      try {
        const data = JSON.parse(readFileSync(resolve(REPORTS_DIR, file), 'utf-8'));
        for (const r of data.requirements || []) {
          rtmReqIds.add(r.id);
        }
      } catch {}
    }

    const missingInRtm = reqIds.filter((id: string) => !rtmReqIds.has(id));
    const orphanInRtm = [...rtmReqIds].filter(id => !reqIds.includes(id));

    if (missingInRtm.length > 0) {
      console.warn(`   ⚠️ Requirements missing from RTM: ${missingInRtm.join(', ')}`);
    }
    if (orphanInRtm.length > 0) {
      console.warn(`   ⚠️ Orphan IDs in RTM (not in requirements.json): ${orphanInRtm.join(', ')}`);
    }
  }

  return { valid: !hasErrors, reqCount: reqs.length, reqIds };
}

function main() {
  console.log('\n🔍 AI Dual-Track Verification Runner\n');
  console.log('═'.repeat(50));

  // Ensure dirs exist
  if (!existsSync(REPORTS_DIR)) mkdirSync(REPORTS_DIR, { recursive: true });
  if (!existsSync(SCREENSHOTS_DIR)) mkdirSync(SCREENSHOTS_DIR, { recursive: true });

  // PRE-VALIDATE
  const validation = preValidate();
  if (!validation.valid) {
    console.error('\n' + '═'.repeat(50));
    console.error('\n❌ Pre-validation FAILED. Fix issues above before running verify.\n');
    process.exit(1);
  }

  // 1. Detect Installed Test Tools
  let hasVitest = false;
  let hasPlaywright = false;

  if (existsSync(PKG_PATH)) {
    try {
      const pkg = JSON.parse(readFileSync(PKG_PATH, 'utf-8'));
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };
      hasVitest = !!deps['vitest'];
      hasPlaywright = !!deps['@playwright/test'];
    } catch {}
  }

  // 2. Execute Automated Tests if available
  if (hasVitest) {
    console.log('\n⚡ Running Vitest Unit Tests...');
    runCommandQuietly('npx vitest run');
  }

  const e2eDir = resolve(ROOT, 'e2e');
  if (!existsSync(e2eDir)) mkdirSync(e2eDir, { recursive: true });
  let e2eSpecs = readdirSync(e2eDir).filter(f => f.endsWith('.spec.ts') || f.endsWith('.spec.js'));

  if (hasPlaywright) {
    // If no spec files exist, auto-create a default smoke spec
    if (e2eSpecs.length === 0) {
      const smokeSpecPath = resolve(e2eDir, 'smoke.spec.ts');
      const smokeContent = `import { test, expect } from '@playwright/test';

test('Smoke E2E Test — Homepage UI verification & screenshot', async ({ page }) => {
  const response = await page.goto('/');
  expect(response?.status() || 200).toBeLessThan(400);
  await page.screenshot({ path: '.ai-testing/reports/screenshots/homepage-smoke.png', fullPage: true });
});
`;
      try {
        writeFileSync(smokeSpecPath, smokeContent, 'utf-8');
        console.log('   ✅ Auto-created .ai-testing/e2e/smoke.spec.ts');
        e2eSpecs = ['smoke.spec.ts'];
      } catch (e) {}
    }

    console.log(`\n🎭 Running Playwright E2E Tests (${e2eSpecs.length} spec file(s))...`);
    const configFile = resolve(ROOT, 'configs', 'playwright.config.ts');
    const configFlag = existsSync(configFile) ? `--config "${configFile}"` : '';
    runCommandQuietly(`npx playwright test "${e2eDir}" ${configFlag}`);
  }

  // 3. Parse RTM files
  const rtmFiles = existsSync(REPORTS_DIR)
    ? readdirSync(REPORTS_DIR).filter(f => f.endsWith('.rtm.json'))
    : [];

  if (rtmFiles.length === 0) {
    console.log('\n⚠️  No .rtm.json files found in .ai-testing/reports/');
    console.log('   AI must create these files in STEP 4 before running verify.\n');
  } else {
    let totalReqs = 0, passed = 0, failed = 0, pending = 0;
    const features: Array<{name: string, passed: number, total: number, gaps: string[]}> = [];

    for (const file of rtmFiles) {
      try {
        const data = JSON.parse(readFileSync(resolve(REPORTS_DIR, file), 'utf-8'));
        const fPassed = (data.requirements || []).filter((r: any) => r.status === '✅').length;
        const fFailed = (data.requirements || []).filter((r: any) => r.status === '❌').length;
        const fTotal = (data.requirements || []).length;
        const gaps = (data.requirements || [])
          .filter((r: any) => r.status !== '✅')
          .map((r: any) => `${r.id}: ${r.description} (${r.status})`);

        features.push({ name: data.feature || file, passed: fPassed, total: fTotal, gaps });
        totalReqs += fTotal;
        passed += fPassed;
        failed += fFailed;
        pending += fTotal - fPassed - fFailed;
      } catch (e) {
        console.warn(`⚠️  Could not parse ${file}`);
      }
    }

    // Use requirements.json count as denominator for accurate coverage
    const baselineCount = validation.reqCount;
    const pct = baselineCount > 0 ? Math.round((passed / baselineCount) * 1000) / 10 : 0;

    console.log(`\n📋 Features tested: ${features.length}`);
    console.log(`📊 Requirements: ${passed}/${baselineCount} = ${pct}% (baseline from requirements.json)`);

    if (totalReqs < baselineCount) {
      console.warn(`⚠️  Only ${totalReqs}/${baselineCount} requirements found in RTM files. Missing requirements not tested.`);
    }

    for (const f of features) {
      const fPct = f.total > 0 ? Math.round((f.passed / f.total) * 1000) / 10 : 0;
      const icon = fPct >= 95 ? '✅' : fPct >= 70 ? '🟡' : '❌';
      console.log(`\n   ${icon} ${f.name}: ${f.passed}/${f.total} = ${fPct}%`);
      if (f.gaps.length > 0) {
        for (const gap of f.gaps) {
          console.log(`      ❌ ${gap}`);
        }
      }
    }
  }

  // 4. Aggregate Master RTM & Coverage Report
  const masterRtmScript = resolve(ROOT, 'scripts', 'master-rtm.ts');
  if (existsSync(masterRtmScript)) {
    console.log('\n📝 Generating Master RTM...');
    runCommandQuietly(`npx tsx "${masterRtmScript}"`);
  }

  const coverageReportScript = resolve(ROOT, 'scripts', 'coverage-report.ts');
  if (existsSync(coverageReportScript)) {
    console.log('\n📊 Generating Dual Coverage Report...');
    runCommandQuietly(`npx tsx "${coverageReportScript}"`);
  }

  // 5. Check screenshots
  const screenshots = existsSync(SCREENSHOTS_DIR)
    ? readdirSync(SCREENSHOTS_DIR).filter(f => f.endsWith('.png') || f.endsWith('.jpg'))
    : [];

  if (screenshots.length > 0) {
    console.log(`\n📸 Screenshots: ${screenshots.length} file(s) in .ai-testing/reports/screenshots/`);
  }

  // 6. Final verdict
  const rtmFilesFinal = existsSync(REPORTS_DIR)
    ? readdirSync(REPORTS_DIR).filter(f => f.endsWith('.rtm.json'))
    : [];
  let finalPassed = 0, finalTotal = 0;
  for (const file of rtmFilesFinal) {
    try {
      const data = JSON.parse(readFileSync(resolve(REPORTS_DIR, file), 'utf-8'));
      for (const r of data.requirements || []) {
        finalTotal++;
        if (r.status === '✅') finalPassed++;
      }
    } catch {}
  }

  const finalPct = validation.reqCount > 0 ? Math.round((finalPassed / validation.reqCount) * 1000) / 10 : 0;
  const overallPass = finalPct >= 95;

  console.log('\n' + '═'.repeat(50));
  console.log(`\n🏁 Verification Complete: ${finalPassed}/${validation.reqCount} = ${finalPct}% ${overallPass ? '✅ PASS' : '❌ FAIL'}\n`);

  process.exit(overallPass ? 0 : 1);
}

main();
