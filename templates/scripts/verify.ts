/**
 * Verify Script — AI Dual-Track Testing
 *
 * Orchestrates: Run Test Runners (Vitest / Playwright) → Aggregate RTM → Generate Coverage Report.
 * Usage: npx tsx .ai-testing/scripts/verify.ts
 */

import { existsSync, readdirSync, readFileSync, mkdirSync } from 'fs';
import { resolve } from 'path';
import { execSync } from 'child_process';

const CWD = process.cwd();
const ROOT = resolve(CWD, '.ai-testing');
const REPORTS_DIR = resolve(ROOT, 'reports');
const SCREENSHOTS_DIR = resolve(REPORTS_DIR, 'screenshots');
const PKG_PATH = resolve(CWD, 'package.json');

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

function main() {
  console.log('\n🔍 AI Dual-Track Verification Runner\n');
  console.log('═'.repeat(50));

  // Ensure dirs exist
  if (!existsSync(REPORTS_DIR)) mkdirSync(REPORTS_DIR, { recursive: true });
  if (!existsSync(SCREENSHOTS_DIR)) mkdirSync(SCREENSHOTS_DIR, { recursive: true });

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
    // If no spec files exist, auto-create a default smoke spec so Playwright ALWAYS runs!
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
        const { writeFileSync } = require('fs');
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

  // 3. Check RTM files
  const rtmFiles = existsSync(REPORTS_DIR)
    ? readdirSync(REPORTS_DIR).filter(f => f.endsWith('.rtm.json'))
    : [];

  if (rtmFiles.length === 0) {
    console.log('\n⚠️  No .rtm.json files found in .ai-testing/reports/');
    console.log('   AI will generate RTM data and re-run.\n');
  } else {
    // 4. Parse RTM
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

    // 5. Print results
    const pct = totalReqs > 0 ? Math.round((passed / totalReqs) * 1000) / 10 : 0;

    console.log(`\n📋 Features tested: ${features.length}`);
    console.log(`📊 Requirements: ${passed}/${totalReqs} = ${pct}%`);

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

  // 6. Aggregate Master RTM & Coverage Report
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

  // 7. Check screenshots
  const screenshots = existsSync(SCREENSHOTS_DIR)
    ? readdirSync(SCREENSHOTS_DIR).filter(f => f.endsWith('.png') || f.endsWith('.jpg'))
    : [];

  if (screenshots.length > 0) {
    console.log(`\n📸 Screenshots: ${screenshots.length} file(s) in .ai-testing/reports/screenshots/`);
  }

  console.log('\n' + '═'.repeat(50));
  console.log(`\n🏁 Verification Orchestration Complete.\n`);
}

main();

