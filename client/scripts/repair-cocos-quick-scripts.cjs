const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const quickScriptsRoot = path.join(projectRoot, 'temp', 'quick-scripts');
const srcAssets = path.join(quickScriptsRoot, 'src', 'assets');
const dstAssets = path.join(quickScriptsRoot, 'dst', 'assets');

function copyRecursive(src, dst) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    fs.mkdirSync(dst, { recursive: true });
    for (const entry of fs.readdirSync(src)) {
      copyRecursive(path.join(src, entry), path.join(dst, entry));
    }
    return;
  }
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.copyFileSync(src, dst);
}

if (!fs.existsSync(srcAssets)) {
  console.error('[repair-cocos-quick-scripts] Missing:', srcAssets);
  process.exit(1);
}

copyRecursive(srcAssets, dstAssets);
console.log('[repair-cocos-quick-scripts] Mirrored src/assets -> dst/assets');
