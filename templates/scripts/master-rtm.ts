/**
 * Master RTM Aggregator — AI Dual-Track Testing
 *
 * Aggregates individual .rtm.json files from reports/ into a single Master RTM.
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

interface MasterData {
  lastUpdated: string;
  features: FeatureRTM[];
}

// ─── Paths (portable — uses cwd) ─────────────────────────
const ROOT = resolve(process.cwd(), '.ai-testing');
const REPORTS_DIR = resolve(ROOT, 'reports');
const MASTER_MD_PATH = resolve(REPORTS_DIR, 'master-rtm.md');

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
function generateMarkdown(features: FeatureRTM[]): string {
  const lines: string[] = ['# 📋 Master RTM', '', `> Updated: ${new Date().toISOString().slice(0, 19)}`, ''];

  let totalReqs = 0, totalPassed = 0, totalFailed = 0, totalPending = 0;
  for (const f of features) {
    for (const r of f.requirements) {
      totalReqs++;
      if (r.status === '✅') totalPassed++;
      else if (r.status === '❌') totalFailed++;
      else totalPending++;
    }
  }

  const pct = totalReqs > 0 ? Math.round((totalPassed / totalReqs) * 1000) / 10 : 0;
  lines.push('## Summary', '', '| Metric | Value |', '|--------|-------|');
  lines.push(`| Features | ${features.length} |`);
  lines.push(`| Requirements | ${totalReqs} |`);
  lines.push(`| ✅ Passed | ${totalPassed} |`);
  lines.push(`| ❌ Failed | ${totalFailed} |`);
  lines.push(`| ⚠️ Pending | ${totalPending} |`);
  lines.push(`| **Coverage** | **${pct}%** ${pct >= 95 ? '✅' : '❌'} |`, '', '---');

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
  const features = scanRTMFiles();

  if (features.length === 0) {
    console.log('⚠️  No .rtm.json files found in .ai-testing/reports/');
    console.log('   AI will create these when running verify.\n');
    return;
  }

  console.log(`📂 Found ${features.length} feature(s)`);
  if (!existsSync(REPORTS_DIR)) mkdirSync(REPORTS_DIR, { recursive: true });
  writeFileSync(MASTER_MD_PATH, generateMarkdown(features), 'utf-8');
  console.log(`📝 Written to: ${MASTER_MD_PATH}`);

  let total = 0, passed = 0;
  for (const f of features) for (const r of f.requirements) { total++; if (r.status === '✅') passed++; }
  const pct = total > 0 ? Math.round((passed / total) * 1000) / 10 : 0;

  console.log(`\n   Coverage: ${passed}/${total} = ${pct}%\n`);
}

main();
