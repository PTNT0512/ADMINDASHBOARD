const fs = require('fs');
const path = require('path');

const clientRoot = path.resolve(__dirname, '..');
const envCandidates = [
  process.env.SHARED_ENDPOINT_ENV_FILE ? path.resolve(process.env.SHARED_ENDPOINT_ENV_FILE) : '',
  path.resolve(clientRoot, '../.env'),
  path.resolve(clientRoot, '../server/taixiu-backend/.env'),
].filter(Boolean);
const targetPath = path.resolve(clientRoot, 'assets/Loading/src/ClientEndpointConfig.ts');

function parseEnvFile(filePath) {
  const out = {};
  if (!fs.existsSync(filePath)) return out;
  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = String(line || '').trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    out[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
  }
  return out;
}

function readBool(value, fallback) {
  if (value == null || value === '') return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (['1', 'true', 'yes', 'y', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'n', 'off'].includes(normalized)) return false;
  return fallback;
}

function readPort(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : fallback;
}

function firstNonEmpty(...values) {
  for (const value of values) {
    const normalized = String(value || '').trim();
    if (normalized) return normalized;
  }
  return '';
}

const env = Object.assign({}, ...envCandidates.map(parseEnvFile));
const publicHost = firstNonEmpty(env.TAIXIU_PUBLIC_HOST, env.PUBLIC_HOST, 'localhost');
const publicPort = readPort(firstNonEmpty(env.TAIXIU_PUBLIC_PORT, env.PUBLIC_PORT, env.TAIXIU_APP_PORT, env.PORT), 18082);
const wsHost = firstNonEmpty(env.TAIXIU_PUBLIC_WS_HOST, env.PUBLIC_WS_HOST, publicHost);
const wsPort = readPort(firstNonEmpty(env.TAIXIU_PUBLIC_WS_PORT, env.PUBLIC_WS_PORT, String(publicPort)), publicPort);
const apiHost = firstNonEmpty(env.TAIXIU_PUBLIC_API_HOST, env.PUBLIC_API_HOST, publicHost, wsHost);
const apiPort = readPort(firstNonEmpty(env.TAIXIU_PUBLIC_API_PORT, env.PUBLIC_API_PORT, String(publicPort), String(wsPort)), publicPort);
const wsSecure = readBool(env.TAIXIU_PUBLIC_WS_SECURE != null ? env.TAIXIU_PUBLIC_WS_SECURE : env.PUBLIC_WS_SECURE, false);
const apiSecure = readBool(env.TAIXIU_PUBLIC_API_SECURE != null ? env.TAIXIU_PUBLIC_API_SECURE : env.PUBLIC_API_SECURE, false);
const apiPathRaw = firstNonEmpty(env.TAIXIU_PUBLIC_API_PATH, env.PUBLIC_API_PATH, '/api');
const apiPath = apiPathRaw.startsWith('/') ? apiPathRaw : `/${apiPathRaw}`;

let raw = fs.readFileSync(targetPath, 'utf8');
raw = raw.replace(/static readonly WS_HOST = ".*?";/, `static readonly WS_HOST = "${wsHost}";`);
raw = raw.replace(/static readonly WS_PORT = \d+;/, `static readonly WS_PORT = ${wsPort};`);
raw = raw.replace(/static readonly WS_SECURE = (true|false);/, `static readonly WS_SECURE = ${wsSecure};`);
raw = raw.replace(/static readonly API_HOST = ".*?";/, `static readonly API_HOST = "${apiHost}";`);
raw = raw.replace(/static readonly API_PORT = \d+;/, `static readonly API_PORT = ${apiPort};`);
raw = raw.replace(/static readonly API_SECURE = (true|false);/, `static readonly API_SECURE = ${apiSecure};`);
raw = raw.replace(/static readonly API_PATH = ".*?";/, `static readonly API_PATH = "${apiPath}";`);
fs.writeFileSync(targetPath, raw, 'utf8');

console.log(JSON.stringify({
  envCandidates,
  targetPath,
  wsHost,
  wsPort,
  wsSecure,
  apiHost,
  apiPort,
  apiSecure,
  apiPath
}, null, 2));
