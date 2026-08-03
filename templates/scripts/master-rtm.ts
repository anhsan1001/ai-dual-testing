/**
 * Master RTM Aggregator — AI Dual-Track Testing
 *
 * Aggregates individual .rtm.json files and cross-validates against requirements.json.
 * Usage: npx tsx .ai-testing/scripts/master-rtm.ts
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync } from 'fs';
import { resolve } from 'path';

// ─── Types ───────────────────────────────────────────────
interface Requirement {
  id: string;
  description: string;
  acceptanceCriteria: string;
  testCases: string;
  status: '✅' | '❌' | '⚠️' | 'Chưa test';
  round: number;
  notes: string;
}

interface FeatureRTM {
  feature: string;
  requirements: Requirement[];
}

// ─── Paths ───────────────────────────────────────────────
const ROOT = resolve(process.cwd(), '.ai-testing');
const REPORTS_DIR = resolve(ROOT, 'reports');
const REQUIREMENTS_PATH = resolve(ROOT, 'configs', 'requirements.json');
const MASTER_MD_PATH = resolve(REPORTS_DIR, 'master-rtm.md');

// ─── Load baseline requirements ──────────────────────────
function loadBaselineRequirements(): { ids: string[]; count: number } {
  if (!existsSync(REQUIREMENTS_PATH)) {
    console.warn('⚠️  requirements.json not found. Cannot cross-validate.');
    return { ids: [], count: 0 };
  }
  try {
    const data = JSON.parse(readFileSync(REQUIREMENTS_PATH, 'utf-8'));
    const reqs = data.requirements || [];
    return { ids: reqs.map((r: any) => r.id), count: reqs.length };
  } catch {
    return { ids: [], count: 0 };
  }
}

// ─── Scan .rtm.json files ────────────────────────────────
function scanRTMFiles(): FeatureRTM[] {
  const features: FeatureRTM[] = [];
  if (!existsSync(REPORTS_DIR)) return features;

  const files = readdirSync(REPORTS_DIR).filter(
    (f) => f.endsWith('.rtm.json')
  );

  for (const file of files) {
    try {
      const data: FeatureRTM = JSON.parse(readFileSync(resolve(REPORTS_DIR, file), 'utf-8'));
      if (data.feature && data.requirements) features.push(data);
    } catch (e) {
      console.warn(`⚠️  Could not parse ${file}: ${(e as Error).message}`);
    }
  }
  return features;
}

// ─── Generate Markdown ───────────────────────────────────
function generateMarkdown(features: FeatureRTM[], baseline: { ids: string[]; count: number }): string {
  const lines: string[] = ['# 📋 Master RTM', '', `> Updated: ${new Date().toISOString().slice(0, 19)}`, ''];

  let totalReqs = 0, totalPassed = 0, totalFailed = 0, totalPending = 0;
  const allRtmIds = new Set<string>();

  for (const f of features) {
    for (const r of f.requirements) {
      totalReqs++;
      allRtmIds.add(r.id);
      if (r.status === '✅') totalPassed++;
      else if (r.status === '❌') totalFailed++;
      else totalPending++;
    }
  }

  // Use baseline count as denominator
  const denominator = baseline.count > 0 ? baseline.count : totalReqs;
  const pct = denominator > 0 ? Math.round((totalPassed / denominator) * 1000) / 10 : 0;

  lines.push('## Summary', '', '| Metric | Value |', '|--------|-------|');
  lines.push(`| Features | ${features.length} |`);
  lines.push(`| Baseline Requirements | ${baseline.count} |`);
  lines.push(`| Tested Requirements | ${totalReqs} |`);
  lines.push(`| ✅ Passed | ${totalPassed} |`);
  lines.push(`| ❌ Failed | ${totalFailed} |`);
  lines.push(`| ⚠️ Pending | ${totalPending} |`);
  lines.push(`| **Coverage** | **${pct}%** ${pct >= 95 ? '✅' : '❌'} |`, '');

  // Cross-validation section
  if (baseline.count > 0) {
    const missingInRtm = baseline.ids.filter(id => !allRtmIds.has(id));
    const orphanInRtm = [...allRtmIds].filter(id => !baseline.ids.includes(id));

    if (missingInRtm.length > 0 || orphanInRtm.length > 0) {
      lines.push('## ⚠️ Cross-Validation Issues', '');
      if (missingInRtm.length > 0) {
        lines.push(`**Missing from RTM** (in requirements.json but not tested): ${missingInRtm.join(', ')}`, '');
      }
      if (orphanInRtm.length > 0) {
        lines.push(`**Orphan in RTM** (tested but not in requirements.json): ${orphanInRtm.join(', ')}`, '');
      }
    }
  }

  lines.push('---');

  for (const f of features) {
    const fp = f.requirements.filter(r => r.status === '✅').length;
    const ft = f.requirements.length;
    lines.push('', `## ${f.feature}`, '', `**Coverage: ${fp}/${ft} = ${ft > 0 ? Math.round(fp/ft*1000)/10 : 0}%**`, '');
    lines.push('| ID | Requirement | AC | Tests | Status | Notes |');
    lines.push('|----|-----------|----|----|--------|-------|');
    for (const r of f.requirements) {
      lines.push(`| ${r.id} | ${r.description} | ${r.acceptanceCriteria} | ${r.testCases} | ${r.status} | ${r.notes || '—'} |`);
    }
    lines.push('', '---');
  }
  return lines.join('\n');
}

// ─── Main ────────────────────────────────────────────────
function main() {
  console.log('📋 Master RTM Aggregator\n');

  const baseline = loadBaselineRequirements();
  if (baseline.count > 0) {
    console.log(`📌 Baseline: ${baseline.count} requirements from requirements.json`);
  }

  const features = scanRTMFiles();

  if (features.length === 0) {
    console.log('⚠️  No .rtm.json files found in .ai-testing/reports/');
    console.log('   AI must create these in STEP 4 before running verify.\n');
    return;
  }

  console.log(`📂 Found ${features.length} feature(s)`);
  if (!existsSync(REPORTS_DIR)) mkdirSync(REPORTS_DIR, { recursive: true });
  writeFileSync(MASTER_MD_PATH, generateMarkdown(features, baseline), 'utf-8');
  console.log(`📝 Written to: ${MASTER_MD_PATH}`);

  let total = 0, passed = 0;
  for (const f of features) for (const r of f.requirements) { total++; if (r.status === '✅') passed++; }
  const denominator = baseline.count > 0 ? baseline.count : total;
  const pct = denominator > 0 ? Math.round((passed / denominator) * 1000) / 10 : 0;

  console.log(`\n   Coverage: ${passed}/${denominator} = ${pct}%\n`);
}

main();
