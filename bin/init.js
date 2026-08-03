#!/usr/bin/env node

/**
 * AI Dual-Track Testing — CLI Init
 * 
 * Auto-detects AI tool and injects testing skill.
 * Usage: npx ai-dual-testing
 * 
 * Zero dependencies — Node.js built-ins only.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ─── Config ─────────────────────────────────────────────
const CWD = process.cwd();
const PKG_ROOT = path.resolve(__dirname, '..');
const TEMPLATES = path.join(PKG_ROOT, 'templates');
const AI_TESTING_DIR = path.join(CWD, '.ai-testing');

// ─── Colors (ANSI) ──────────────────────────────────────
const c = {
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  cyan: (s) => `\x1b[36m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
};

// ─── AI Tool Detection ─────────────────────────────────
const AI_TOOLS = [
  {
    name: 'Cursor',
    detect: () => fs.existsSync(path.join(CWD, '.cursorrules')) || fs.existsSync(path.join(CWD, '.cursor')),
    ruleFile: '.cursorrules',
    templateRule: 'cursor.md',
    inject: 'append',
  },
  {
    name: 'Antigravity',
    detect: () => fs.existsSync(path.join(CWD, '.agents')) || fs.existsSync(path.join(CWD, 'AGENTS.md')),
    ruleFile: '.agents/skills/ai-testing/SKILL.md',
    templateRule: 'antigravity.md',
    inject: 'create',  // Create as skill file
  },
  {
    name: 'Claude Code',
    detect: () => fs.existsSync(path.join(CWD, 'CLAUDE.md')),
    ruleFile: 'CLAUDE.md',
    templateRule: 'claude.md',
    inject: 'append',
  },
  {
    name: 'Windsurf',
    detect: () => fs.existsSync(path.join(CWD, '.windsurfrules')),
    ruleFile: '.windsurfrules',
    templateRule: 'windsurf.md',
    inject: 'append',
  },
];

// ─── Detect AI Tool ─────────────────────────────────────
function detectAITool() {
  for (const tool of AI_TOOLS) {
    if (tool.detect()) return tool;
  }
  return null;
}

// ─── Detect Project Type ────────────────────────────────
function detectProject() {
  const pkgPath = path.join(CWD, 'package.json');
  if (!fs.existsSync(pkgPath)) {
    return { framework: 'generic', language: 'javascript' };
  }

  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
  const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };

  let framework = 'generic';
  if (allDeps['next']) framework = 'nextjs';
  else if (allDeps['nuxt']) framework = 'nuxt';
  else if (allDeps['vue']) framework = 'vue';
  else if (allDeps['vite'] || allDeps['@vitejs/plugin-react']) framework = 'vite';
  else if (allDeps['express'] || allDeps['fastify'] || allDeps['hono']) framework = 'node-api';

  const language = fs.existsSync(path.join(CWD, 'tsconfig.json')) ? 'typescript' : 'javascript';
  const hasVitest = !!allDeps['vitest'];
  const hasPlaywright = !!allDeps['@playwright/test'];
  const hasTsx = !!allDeps['tsx'];

  return { framework, language, deps: allDeps, hasVitest, hasPlaywright, hasTsx };
}

// ─── Copy Directory Recursively ─────────────────────────
function copyDirSync(src, dest) {
  if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });

  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

// ─── Inject Rules ───────────────────────────────────────
function injectRules(tool) {
  const templatePath = path.join(TEMPLATES, 'rules', tool.templateRule);
  if (!fs.existsSync(templatePath)) {
    console.log(c.yellow(`   ⚠️  Template not found: ${tool.templateRule}`));
    return false;
  }

  const rules = fs.readFileSync(templatePath, 'utf-8');
  const targetPath = path.join(CWD, tool.ruleFile);
  const MARKER = '<!-- AI-DUAL-TESTING-START -->';
  const MARKER_END = '<!-- AI-DUAL-TESTING-END -->';

  if (tool.inject === 'create') {
    // Create as separate file (Antigravity skill)
    const dir = path.dirname(targetPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(targetPath, rules, 'utf-8');
    console.log(c.green(`   ✅ Created ${tool.ruleFile}`));
    return true;
  }

  // Append mode (Cursor, Claude, Windsurf)
  if (fs.existsSync(targetPath)) {
    const existing = fs.readFileSync(targetPath, 'utf-8');

    // Already injected? Replace
    if (existing.includes(MARKER)) {
      const re = new RegExp(`${MARKER}[\\s\\S]*?${MARKER_END}`, 'g');
      const updated = existing.replace(re, `${MARKER}\n${rules}\n${MARKER_END}`);
      fs.writeFileSync(targetPath, updated, 'utf-8');
      console.log(c.green(`   ✅ Updated rules in ${tool.ruleFile}`));
      return true;
    }

    // Append
    fs.appendFileSync(targetPath, `\n\n${MARKER}\n${rules}\n${MARKER_END}\n`, 'utf-8');
    console.log(c.green(`   ✅ Appended rules to ${tool.ruleFile}`));
  } else {
    // Create new
    fs.writeFileSync(targetPath, `${MARKER}\n${rules}\n${MARKER_END}\n`, 'utf-8');
    console.log(c.green(`   ✅ Created ${tool.ruleFile}`));
  }

  return true;
}

// ─── Scaffold .ai-testing/ ──────────────────────────────
function scaffold() {
  const dirs = [
    path.join(AI_TESTING_DIR, 'scripts'),
    path.join(AI_TESTING_DIR, 'configs'),
    path.join(AI_TESTING_DIR, 'reports', 'screenshots'),
    path.join(AI_TESTING_DIR, 'e2e'),
  ];

  for (const dir of dirs) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  }

  // Copy scripts
  const scriptsDir = path.join(TEMPLATES, 'scripts');
  if (fs.existsSync(scriptsDir)) {
    for (const file of fs.readdirSync(scriptsDir)) {
      const src = path.join(scriptsDir, file);
      const dest = path.join(AI_TESTING_DIR, 'scripts', file);
      fs.copyFileSync(src, dest);
      console.log(c.green(`   ✅ Created .ai-testing/scripts/${file}`));
    }
  }

  // Copy configs
  const configsDir = path.join(TEMPLATES, 'configs');
  if (fs.existsSync(configsDir)) {
    for (const file of fs.readdirSync(configsDir)) {
      const src = path.join(configsDir, file);
      const dest = path.join(AI_TESTING_DIR, 'configs', file);
      if (!fs.existsSync(dest)) {
        fs.copyFileSync(src, dest);
        console.log(c.green(`   ✅ Created .ai-testing/configs/${file}`));
      } else {
        console.log(c.dim(`   ⏭️  Skipped .ai-testing/configs/${file} (exists)`));
      }
    }
  }

  // Create .gitkeep in reports
  const gitkeep = path.join(AI_TESTING_DIR, 'reports', '.gitkeep');
  if (!fs.existsSync(gitkeep)) {
    fs.writeFileSync(gitkeep, '', 'utf-8');
  }
}

// ─── Update .gitignore ──────────────────────────────────
function updateGitignore() {
  const gitignorePath = path.join(CWD, '.gitignore');
  const entries = [
    '# AI Dual-Track Testing — ignore local artifacts & reports',
    '.ai-testing/',
    'test-results/',
    'coverage/',
  ];

  const block = entries.join('\n');

  if (fs.existsSync(gitignorePath)) {
    const content = fs.readFileSync(gitignorePath, 'utf-8');
    if (content.includes('.ai-testing/reports')) {
      return; // Already has entries
    }
    fs.appendFileSync(gitignorePath, `\n\n${block}\n`, 'utf-8');
  } else {
    fs.writeFileSync(gitignorePath, `${block}\n`, 'utf-8');
  }

  console.log(c.green(`   ✅ Updated .gitignore`));
}

// ─── Detect Package Manager ─────────────────────────────
function detectPM() {
  if (fs.existsSync(path.join(CWD, 'pnpm-lock.yaml'))) return 'pnpm';
  if (fs.existsSync(path.join(CWD, 'yarn.lock'))) return 'yarn';
  return 'npm';
}

// ─── Install Testing Tools ──────────────────────────────
function installTestingTools(project) {
  const toInstall = [];

  if (!project.hasVitest) toInstall.push('vitest');
  if (!project.hasPlaywright) toInstall.push('@playwright/test');
  if (!project.hasTsx) toInstall.push('tsx');

  if (toInstall.length === 0) {
    console.log(c.green('   ✅ All testing tools already installed'));
    return;
  }

  const pm = detectPM();
  const installCmd = pm === 'npm'
    ? `npm install -D ${toInstall.join(' ')}`
    : pm === 'yarn'
      ? `yarn add -D ${toInstall.join(' ')}`
      : `pnpm add -D ${toInstall.join(' ')}`;

  console.log(`   Package manager: ${c.bold(pm)}`);
  console.log(`   Installing: ${c.bold(toInstall.join(', '))}`);
  console.log(c.dim(`   $ ${installCmd}`));
  console.log('');

  try {
    execSync(installCmd, { cwd: CWD, stdio: 'inherit' });
    console.log('');
    console.log(c.green('   ✅ Testing tools installed'));

    // Install Playwright browsers if @playwright/test was installed
    if (toInstall.includes('@playwright/test')) {
      console.log('');
      console.log(c.cyan('   📥 Installing Playwright browsers (chromium)...'));
      try {
        execSync('npx playwright install chromium', { cwd: CWD, stdio: 'inherit' });
        console.log(c.green('   ✅ Chromium browser installed'));
      } catch {
        console.log(c.yellow('   ⚠️  Could not install browsers. Run manually: npx playwright install'));
      }
    }
  } catch (e) {
    console.log(c.yellow(`   ⚠️  Install failed. Run manually: ${installCmd}`));
  }
}

// ─── Main ───────────────────────────────────────────────
function main() {
  console.log('');
  console.log(c.bold('🧪 AI Dual-Track Testing'));
  console.log(c.dim('   One-command verification skill for Vibe Code projects'));
  console.log('');

  // 1. Detect AI Tool
  console.log(c.cyan('🔍 Detecting AI tool...'));
  let tool = detectAITool();

  if (!tool) {
    console.log(c.yellow('   No AI tool detected. Using generic AGENTS.md'));
    tool = {
      name: 'Generic',
      ruleFile: 'AGENTS.md',
      templateRule: 'antigravity.md',
      inject: 'append',
    };
  } else {
    console.log(c.green(`   ✅ Found: ${tool.name}`));
  }

  // 2. Detect Project
  console.log('');
  console.log(c.cyan('🔍 Detecting project...'));
  const project = detectProject();
  console.log(`   Framework:   ${c.bold(project.framework)}`);
  console.log(`   Language:    ${c.bold(project.language)}`);
  console.log(`   Vitest:      ${project.hasVitest ? c.green('✅ installed') : c.yellow('❌ not found')}`);
  console.log(`   Playwright:  ${project.hasPlaywright ? c.green('✅ installed') : c.yellow('❌ not found')}`);

  // 3. Check --skip-deps flag
  const skipDeps = process.argv.includes('--skip-deps');

  // 4. Check if already installed
  if (fs.existsSync(path.join(AI_TESTING_DIR, 'scripts', 'verify.ts'))) {
    console.log('');
    console.log(c.yellow('⚠️  .ai-testing/ already exists. Updating rules only...'));
    injectRules(tool);
    if (!skipDeps) {
      console.log('');
      console.log(c.cyan('📦 Checking testing tools...'));
      installTestingTools(project);
    }
    console.log('');
    console.log(c.green('✅ Updated.'));
    console.log('');
    return;
  }

  // 5. Scaffold
  console.log('');
  console.log(c.cyan('📦 Installing AI Testing Skill...'));
  scaffold();

  // 6. Install testing tools
  if (!skipDeps) {
    console.log('');
    console.log(c.cyan('📦 Installing testing tools...'));
    installTestingTools(project);
  } else {
    console.log('');
    console.log(c.dim('   Skipped tool install (--skip-deps)'));
  }

  // 7. Inject rules
  console.log('');
  console.log(c.cyan('📝 Injecting verification rules...'));
  injectRules(tool);

  // 8. Update .gitignore
  console.log('');
  updateGitignore();

  // 9. Done
  console.log('');
  console.log(c.bold(c.green('🎉 Done!')));
  console.log('');
  console.log('   AI sẽ tự biết cách verify khi bạn nói:');
  console.log(c.cyan('   "verify"  "kiểm tra"  "test lại"  "check coverage"'));
  console.log('');
  console.log(c.dim('   Scripts: .ai-testing/scripts/'));
  console.log(c.dim('   Reports: .ai-testing/reports/'));
  console.log(c.dim(`   Rules:   ${tool.ruleFile}`));
  console.log('');
}

main();
