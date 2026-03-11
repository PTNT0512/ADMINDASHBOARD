const { spawn, execFileSync } = require('child_process');
const http = require('http');
const path = require('path');
const { loadAdminAppEnv } = require('../src/load-shared-env.js');

loadAdminAppEnv({ mode: 'dashboard', includeMode: true, includeApiBank: true });

const root = path.resolve(__dirname, '..');
const isWin = process.platform === 'win32';
const nodeBin = process.execPath;
const rendererOnly = process.argv.includes('--renderer-only');
const viteBin = path.join(root, 'node_modules', '.bin', isWin ? 'vite.cmd' : 'vite');
const electronBin = path.join(root, 'node_modules', '.bin', isWin ? 'electron.cmd' : 'electron');

const readInt = (value, fallback) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 && parsed < 65536 ? parsed : fallback;
};

const unique = (items) => Array.from(new Set(items.filter(Boolean)));

const spawnTool = (command, args, options = {}) => {
  const baseOptions = {
    cwd: root,
    env: options.env || process.env,
    stdio: 'inherit',
  };

  if (isWin) {
    return spawn(command, args, {
      ...baseOptions,
      shell: true,
    });
  }

  return spawn(command, args, baseOptions);
};

const waitForUrl = (url, timeoutMs = 45000) => new Promise((resolve, reject) => {
  const deadline = Date.now() + timeoutMs;
  const probe = () => {
    const req = http.get(url, (res) => {
      res.resume();
      if (res.statusCode && res.statusCode >= 200 && res.statusCode < 500) {
        resolve();
        return;
      }
      retry(new Error('Unexpected status ' + (res.statusCode || 0)));
    });
    req.on('error', retry);
    req.setTimeout(2500, () => req.destroy(new Error('Timeout')));
  };

  const retry = (error) => {
    if (Date.now() >= deadline) {
      reject(error);
      return;
    }
    setTimeout(probe, 500);
  };

  probe();
});

const host = String(process.env.DASHBOARD_HOST || '127.0.0.1').trim() || '127.0.0.1';
const port = readInt(process.env.DASHBOARD_PORT, 55173);
const waitHost = host === '0.0.0.0' ? '127.0.0.1' : host;
const killPorts = unique([String(port), '55173', '5173']);
const sharedEnv = {
  ...process.env,
  ENABLE_UPDATER_IN_DEV: process.env.ENABLE_UPDATER_IN_DEV || '1',
  NODE_OPTIONS: process.env.NODE_OPTIONS || '--max-old-space-size=2048',
  VITE_APP_MODE: 'dashboard',
  DASHBOARD_HOST: host,
  DASHBOARD_PORT: String(port),
};

let shuttingDown = false;
const children = [];

const stopChildren = (code) => {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) {
    if (!child || child.killed) continue;
    try {
      child.kill('SIGTERM');
    } catch (_) {}
  }
  setTimeout(() => process.exit(code), 300);
};

process.on('SIGINT', () => stopChildren(0));
process.on('SIGTERM', () => stopChildren(0));

try {
  execFileSync(nodeBin, [path.join(root, 'scripts', 'kill-dev-ports.cjs'), ...killPorts], {
    cwd: root,
    stdio: 'inherit',
  });
} catch (_) {}

const viteProc = spawnTool(viteBin, ['--host', host, '--port', String(port), '--strictPort'], { env: sharedEnv });
children.push(viteProc);

viteProc.on('exit', (code) => {
  if (!shuttingDown) {
    console.error('[dashboard-dev] vite exited with code ' + code);
    stopChildren(Number.isInteger(code) ? code : 1);
  }
});

if (!rendererOnly) {
  waitForUrl('http://' + waitHost + ':' + port + '/@vite/client').then(() => {
    console.log('[dashboard-dev] renderer ready -> http://' + waitHost + ':' + port);
    const electronEnv = { ...sharedEnv };
    delete electronEnv.ELECTRON_RUN_AS_NODE;

    const electronProc = spawnTool(electronBin, ['electron/dashboard.cjs'], { env: electronEnv });
    children.push(electronProc);

    electronProc.on('exit', (code) => {
      stopChildren(Number.isInteger(code) ? code : 0);
    });
  }).catch((error) => {
    console.error('[dashboard-dev] renderer not ready:', error && error.message ? error.message : error);
    stopChildren(1);
  });
}
