/**
 * Verify Script — AI Dual-Track Testing
 *
 * Orchestrates: scan RTM → run coverage → output summary.
 * AI calls this after generating RTM + running tests.
 *
 * Usage: npx tsx .ai-testing/scripts/verify.ts
 */

import { existsSync, readdirSync, readFileSync, mkdirSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(process.cwd(), '.ai-testing');
const REPORTS_DIR = resolve(ROOT, 'reports');
const SCREENSHOTS_DIR = resolve(REPORTS_DIR, 'screenshots');

function main() {
  console.log('\n🔍 AI Dual-Track Verification\n');
  console.log('═'.repeat(50));

  // Ensure dirs exist
  if (!existsSync(REPORTS_DIR)) mkdirSync(REPORTS_DIR, { recursive: true });
  if (!existsSync(SCREENSHOTS_DIR)) mkdirSync(SCREENSHOTS_DIR, { recursive: true });

  // 1. Check RTM files
  const rtmFiles = existsSync(REPORTS_DIR)
    ? readdirSync(REPORTS_DIR).filter(f => f.endsWith('.rtm.json'))
    : [];

  if (rtmFiles.length === 0) {
    console.log('\n⚠️  No RTM data found.');
    console.log('   AI should create .rtm.json files in .ai-testing/reports/ first.');
    console.log('   Then run this script again.\n');
    process.exit(1);
  }

  // 2. Parse RTM
  let totalReqs = 0, passed = 0, failed = 0, pending = 0;
  const features: Array<{name: string, passed: number, total: number, gaps: string[]}> = [];

  for (const file of rtmFiles) {
    try {
      const data = JSON.parse(readFileSync(resolve(REPORTS_DIR, file), 'utf-8'));
      const fPassed = data.requirements.filter((r: any) => r.status === '✅').length;
      const fFailed = data.requirements.filter((r: any) => r.status === '❌').length;
      const fTotal = data.requirements.length;
      const gaps = data.requirements
        .filter((r: any) => r.status !== '✅')
        .map((r: any) => `${r.id}: ${r.description} (${r.status})`);

      features.push({ name: data.feature, passed: fPassed, total: fTotal, gaps });
      totalReqs += fTotal;
      passed += fPassed;
      failed += fFailed;
      pending += fTotal - fPassed - fFailed;
    } catch (e) {
      console.warn(`⚠️  Could not parse ${file}`);
    }
  }

  // 3. Print results
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

  // 4. Check screenshots
  const screenshots = existsSync(SCREENSHOTS_DIR)
    ? readdirSync(SCREENSHOTS_DIR).filter(f => f.endsWith('.png') || f.endsWith('.jpg'))
    : [];

  if (screenshots.length > 0) {
    console.log(`\n📸 Screenshots: ${screenshots.length} files in .ai-testing/reports/screenshots/`);
  }

  // 5. Overall
  console.log('\n' + '═'.repeat(50));
  console.log(`\n🏁 Overall: ${pct >= 95 ? '✅ PASS' : '❌ FAIL'} (${pct}%)\n`);

  process.exit(pct >= 95 ? 0 : 1);
}

main();
