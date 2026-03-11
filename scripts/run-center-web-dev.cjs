const { spawn, execFileSync } = require('child_process');
const path = require('path');
const { loadAdminAppEnv } = require('../src/load-shared-env.js');

loadAdminAppEnv({ mode: 'center', includeMode: true, includeApiBank: true });

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

const rendererHost = String(process.env.CENTER_HOST || '127.0.0.1').trim() || '127.0.0.1';
const rendererPort = readInt(process.env.CENTER_PORT, 55174);
const webHost = String(process.env.CENTER_WEB_HOST || rendererHost || '127.0.0.1').trim() || '127.0.0.1';
const webPort = readInt(process.env.CENTER_WEB_PORT, 56174);
const webApiHost = String(process.env.CENTER_WEB_API_HOST || webHost || '127.0.0.1').trim() || '127.0.0.1';
const webApiPort = readInt(process.env.CENTER_WEB_API_PORT, 56175);
const apiBaseHost = webHost === '0.0.0.0' ? '127.0.0.1' : webHost;
const killPorts = unique([String(rendererPort), String(webPort), String(webApiPort), '55174', '5174']);

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
  VITE_APP_MODE: 'center',
  CENTER_HOST: rendererHost,
  CENTER_PORT: String(rendererPort),
  VITE_CENTER_API_URL: `http://${apiBaseHost}:${webPort}`,
};

const webEnv = {
  ...process.env,
  NODE_ENV: process.env.NODE_ENV || 'development',
  VITE_APP_MODE: 'center',
  CENTER_WEB_ONLY: '1',
  CENTER_WEB_HOST: webHost,
  CENTER_WEB_PORT: String(webPort),
  CENTER_WEB_API_HOST: webApiHost,
  CENTER_WEB_API_PORT: String(webApiPort),
};

const rendererProc = spawnTool(nodeBin, ['scripts/run-center-dev.cjs', '--renderer-only'], { env: rendererEnv });
children.push(rendererProc);
rendererProc.on('exit', (code) => {
  if (!shuttingDown) {
    console.error('[center-web-dev] renderer exited with code ' + code);
    stopChildren(Number.isInteger(code) ? code : 1);
  }
});

const webProc = spawnTool(nodeBin, ['scripts/center-web-server.cjs'], { env: webEnv });
children.push(webProc);
webProc.on('exit', (code) => {
  if (!shuttingDown) {
    console.error('[center-web-dev] web server exited with code ' + code);
    stopChildren(Number.isInteger(code) ? code : 1);
  }
});
