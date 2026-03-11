const { spawn, execFileSync } = require('child_process');
const path = require('path');
const { loadAdminAppEnv } = require('../src/load-shared-env.js');

loadAdminAppEnv({ mode: 'dashboard', includeMode: true, includeApiBank: true });

const root = path.resolve(__dirname, '..');
const isWin = process.platform === 'win32';
const nodeBin = process.execPath;

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

const rendererHost = String(process.env.DASHBOARD_HOST || '127.0.0.1').trim() || '127.0.0.1';
const rendererPort = readInt(process.env.DASHBOARD_PORT, 55173);
const webHost = String(process.env.DASHBOARD_WEB_HOST || rendererHost || '127.0.0.1').trim() || '127.0.0.1';
const webPort = readInt(process.env.DASHBOARD_WEB_PORT || process.env.API_PORT || process.env.GAME_ADMIN_PORT, 4001);
const apiBaseHost = webHost === '0.0.0.0' ? '127.0.0.1' : webHost;
const killPorts = unique([String(rendererPort), String(webPort), '55173', '5173']);

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

const rendererEnv = {
  ...process.env,
  VITE_APP_MODE: 'dashboard',
  DASHBOARD_HOST: rendererHost,
  DASHBOARD_PORT: String(rendererPort),
  VITE_DASHBOARD_API_URL: `http://${apiBaseHost}:${webPort}`,
};

const webEnv = {
  ...process.env,
  NODE_ENV: process.env.NODE_ENV || 'development',
  VITE_APP_MODE: 'dashboard',
  DASHBOARD_WEB_ONLY: '1',
  DASHBOARD_WEB_HOST: webHost,
  DASHBOARD_WEB_PORT: String(webPort),
  API_PORT: String(webPort),
  GAME_ADMIN_PORT: String(webPort),
};

const rendererProc = spawnTool(nodeBin, ['scripts/run-dashboard-dev.cjs', '--renderer-only'], { env: rendererEnv });
children.push(rendererProc);
rendererProc.on('exit', (code) => {
  if (!shuttingDown) {
    console.error('[dashboard-web-dev] renderer exited with code ' + code);
    stopChildren(Number.isInteger(code) ? code : 1);
  }
});

const webProc = spawnTool(nodeBin, ['scripts/dashboard-web-server.cjs'], { env: webEnv });
children.push(webProc);
webProc.on('exit', (code) => {
  if (!shuttingDown) {
    console.error('[dashboard-web-dev] web server exited with code ' + code);
    stopChildren(Number.isInteger(code) ? code : 1);
  }
});
