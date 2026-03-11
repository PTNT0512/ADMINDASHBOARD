const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const ADMIN_APP_ROOT = path.resolve(__dirname, '..');

function normalizePath(filePath) {
  return filePath ? path.resolve(String(filePath)) : '';
}

function uniquePaths(paths) {
  const out = [];
  const seen = new Set();
  for (const item of paths) {
    const resolved = normalizePath(item);
    if (!resolved || seen.has(resolved)) continue;
    seen.add(resolved);
    out.push(resolved);
  }
  return out;
}

function loadAdminAppEnv(options = {}) {
  const mode = String(options.mode || process.env.VITE_APP_MODE || '').trim();
  const includeRoot = options.includeRoot !== false;
  const includeMode = options.includeMode !== false;
  const includeApiBank = options.includeApiBank !== false;
  const extraPaths = Array.isArray(options.extraPaths) ? options.extraPaths : [];

  const candidates = uniquePaths([
    includeRoot ? path.join(ADMIN_APP_ROOT, '.env') : '',
    includeMode && mode ? path.join(ADMIN_APP_ROOT, `.env.${mode}`) : '',
    includeApiBank ? path.join(ADMIN_APP_ROOT, '.env.apibank') : '',
    ...extraPaths,
  ]);

  const loaded = [];
  for (const filePath of candidates) {
    try {
      if (!fs.existsSync(filePath)) continue;
      dotenv.config({ path: filePath });
      loaded.push(filePath);
    } catch (_error) {
      // Ignore broken env file and continue to next fallback.
    }
  }

  return {
    root: ADMIN_APP_ROOT,
    mode,
    candidates,
    loaded,
  };
}

module.exports = {
  ADMIN_APP_ROOT,
  loadAdminAppEnv,
};
