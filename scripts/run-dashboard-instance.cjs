const { spawn, execFileSync } = require('child_process');
const http = require('http');
const path = require('path');

const root = path.resolve(__dirname, '..');
const isWin = process.platform === 'win32';
const npxBin = isWin ? 'npx.cmd' : 'npx';
const nodeBin = process.execPath;

const normalizeInstanceId = (value, fallback) => {
  const normalized = String(value || fallback)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return normalized || fallback;
};

const parseArgs = (argv) => {
  const options = {};
  for (const arg of argv) {
    if (!arg.startsWith('--')) continue;
    const eqIndex = arg.indexOf('=');
    if (eqIndex >= 0) {
      options[arg.slice(2, eqIndex)] = arg.slice(eqIndex + 1);
    } else {
      options[arg.slice(2)] = '1';
    }
  }
  return options;
};

const readInt = (value, fallback) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 && parsed < 65536 ? parsed : fallback;
};

const args = parseArgs(process.argv.slice(2));
const instance = normalizeInstanceId(args.instance, 'server1');
const host = String(args.host || '127.0.0.1').trim() || '127.0.0.1';
const dashboardPort = readInt(args['dashboard-port'], 55173);
const apiPort = readInt(args['api-port'], 4001);
const clean = !['0', 'false', 'no'].includes(String(args.clean || '1').trim().toLowerCase());

const killPorts = () => {
  if (!clean) return;
  try {
    execFileSync(nodeBin, [path.join(root, 'scripts', 'kill-dev-ports.cjs'), String(dashboardPort), String(apiPort)], {
      cwd: root,
      stdio: 'inherit',
    });
  } catch (_) {}
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
      retry(new Error(`Unexpected status ${res.statusCode || 0}`));
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

const children = [];
let shuttingDown = false;

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

const sharedEnv = {
  ...process.env,
  ENABLE_UPDATER_IN_DEV: '1',
  NODE_OPTIONS: process.env.NODE_OPTIONS || '--max-old-space-size=2048',
  VITE_APP_MODE: 'dashboard',
  DASHBOARD_HOST: host,
  DASHBOARD_PORT: String(dashboardPort),
  API_PORT: String(apiPort),
  DASHBOARD_INSTANCE_ID: instance,
  DASHBOARD_MULTI_INSTANCE: '1',
};

killPorts();

const viteProc = spawn(npxBin, ['vite', '--host', host, '--port', String(dashboardPort), '--strictPort'], {
  cwd: root,
  env: sharedEnv,
  stdio: 'inherit',
});
children.push(viteProc);

viteProc.on('exit', (code) => {
  if (!shuttingDown) {
    console.error(`[instance:${instance}] vite exited with code ${code}`);
    stopChildren(Number.isInteger(code) ? code : 1);
  }
});

waitForUrl(`http://${host}:${dashboardPort}/@vite/client`).then(() => {
  console.log(`[instance:${instance}] renderer ready -> http://${host}:${dashboardPort}`);
  console.log(`[instance:${instance}] api ready target -> http://${host}:${apiPort}`);

  const electronProc = spawn(npxBin, ['electron', 'electron/dashboard.cjs'], {
    cwd: root,
    env: sharedEnv,
    stdio: 'inherit',
  });
  children.push(electronProc);

  electronProc.on('exit', (code) => {
    stopChildren(Number.isInteger(code) ? code : 0);
  });
}).catch((error) => {
  console.error(`[instance:${instance}] vite renderer not ready:`, error && error.message ? error.message : error);
  stopChildren(1);
});
