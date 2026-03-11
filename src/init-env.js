const fs = require('fs');
const os = require('os');
const path = require('path');

const ENV_LOG_FILE = path.join(os.tmpdir(), 'lasvegas-env-loader.log');
let fatalHooksAttached = false;
const NETWORK_REJECTION_LOG_COOLDOWN_MS = 30000;
const networkRejectionState = { key: '', at: 0 };

const appendFallbackLog = (line) => {
  try {
    fs.appendFileSync(ENV_LOG_FILE, `${line}\n`, 'utf8');
  } catch (_) {
    // Ignore fallback logging failures.
  }
};

const safeWrite = (stream, line) => {
  try {
    if (!stream || stream.destroyed || stream.writable === false) return false;
    stream.write(`${line}\n`);
    return true;
  } catch (error) {
    if (error && (error.code === 'EPIPE' || error.code === 'ERR_STREAM_DESTROYED')) {
      appendFallbackLog(`[${new Date().toISOString()}] ${line}`);
      return false;
    }
    appendFallbackLog(`[${new Date().toISOString()}] [stream-write-error] ${line}`);
    return false;
  }
};

const safeLog = (line, options = {}) => {
  const useErrorStream = options.error === true;
  const stream = useErrorStream ? process.stderr : process.stdout;
  const written = safeWrite(stream, line);
  if (!written) {
    appendFallbackLog(`[${new Date().toISOString()}] ${line}`);
  }
};

const formatRejectionReason = (reason) => {
  const code = reason && reason.code ? String(reason.code) : '';
  const message = reason && reason.message ? String(reason.message) : String(reason || '');
  return `${code} ${message}`.trim();
};

const isRecoverableNetworkRejection = (reason) => {
  const payload = formatRejectionReason(reason).toUpperCase();
  return [
    'ECONNRESET',
    'ETIMEDOUT',
    'ESOCKETTIMEDOUT',
    'SOCKET HANG UP',
    'ECONNREFUSED',
    'EAI_AGAIN',
    'ENOTFOUND',
    'EFATAL',
  ].some((marker) => payload.includes(marker));
};

const shouldLogRecoverableRejection = (reason) => {
  const key = formatRejectionReason(reason).toUpperCase() || 'UNKNOWN_NETWORK_REJECTION';
  const now = Date.now();
  const isSame = networkRejectionState.key === key;
  if (isSame && now - networkRejectionState.at < NETWORK_REJECTION_LOG_COOLDOWN_MS) return false;
  networkRejectionState.key = key;
  networkRejectionState.at = now;
  return true;
};

const attachFatalHooksOnce = () => {
  if (fatalHooksAttached) return;
  fatalHooksAttached = true;

  process.on('uncaughtException', (error) => {
    const detail = error && error.stack ? error.stack : String(error);
    safeLog(`[EnvLoader] uncaughtException: ${detail}`, { error: true });
  });

  process.on('unhandledRejection', (reason) => {
    if (isRecoverableNetworkRejection(reason)) {
      if (shouldLogRecoverableRejection(reason)) {
        safeLog(`[EnvLoader] unhandledRejection (network): ${formatRejectionReason(reason)}`, { error: true });
      }
      return;
    }
    const detail = reason && reason.stack ? reason.stack : String(reason);
    safeLog(`[EnvLoader] unhandledRejection: ${detail}`, { error: true });
  });
};

attachFatalHooksOnce();

const { loadAdminAppEnv } = require('./load-shared-env.js');
const envMode = String(process.env.VITE_APP_MODE || 'dashboard').trim() || 'dashboard';
const envState = loadAdminAppEnv({
  mode: envMode,
  includeMode: true,
  includeApiBank: true,
});

if (Array.isArray(envState.loaded) && envState.loaded.length > 0) {
  envState.loaded.forEach((loadedPath) => {
    safeLog(`[EnvLoader] loaded env from: ${loadedPath}`);
  });
} else {
  safeLog(`[EnvLoader] no env file found. Checked: ${envState.candidates.join(', ')}`, { error: true });
}
