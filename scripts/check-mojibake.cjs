const fs = require('fs');
const path = require('path');
const { normalizeMojibakeText } = require('../src/utils/telegram-bot-normalizer.js');

const ROOT = process.cwd();
const TARGETS = process.argv.slice(2).filter((arg) => !arg.startsWith('--'));
const FAIL_ON_MATCH = process.argv.includes('--fail-on-match');
const SEARCH_ROOTS = TARGETS.length ? TARGETS : ['src', 'electron', 'scripts'];
const EXCLUDED_DIRS = new Set(['node_modules', '.git', 'dist', 'build', 'dist_electron', '.vite', '.vite-dashboard']);
const TEXT_EXTENSIONS = new Set(['.js', '.jsx', '.cjs', '.mjs', '.ts', '.tsx', '.json', '.css', '.scss', '.html', '.md', '.txt', '.env', '.example']);

const shouldScanFile = (filePath) => {
  const ext = path.extname(filePath).toLowerCase();
  return TEXT_EXTENSIONS.has(ext);
};

const walk = (targetPath, files = []) => {
  if (!fs.existsSync(targetPath)) return files;

  const stat = fs.statSync(targetPath);
  if (stat.isFile()) {
    if (shouldScanFile(targetPath)) files.push(targetPath);
    return files;
  }

  for (const entry of fs.readdirSync(targetPath, { withFileTypes: true })) {
    if (EXCLUDED_DIRS.has(entry.name)) continue;
    const fullPath = path.join(targetPath, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath, files);
      continue;
    }
    if (shouldScanFile(fullPath)) files.push(fullPath);
  }
  return files;
};

const findings = [];
for (const root of SEARCH_ROOTS) {
  walk(path.join(ROOT, root)).forEach((filePath) => {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split(/\r?\n/);
    lines.forEach((line, index) => {
      const normalized = normalizeMojibakeText(line);
      if (!normalized || normalized === line) return;
      findings.push({
        file: path.relative(ROOT, filePath),
        line: index + 1,
        before: line.trim().slice(0, 180),
        after: normalized.trim().slice(0, 180),
      });
    });
  });
}

if (!findings.length) {
  console.log('No mojibake lines found.');
  process.exit(0);
}

console.log(`Found ${findings.length} mojibake line candidates:`);
for (const finding of findings) {
  console.log(`${finding.file}:${finding.line}`);
  console.log(`  before: ${finding.before}`);
  console.log(`  after : ${finding.after}`);
}

process.exit(FAIL_ON_MATCH ? 1 : 0);

