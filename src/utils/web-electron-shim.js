import io from 'socket.io-client';
import { getAdminApiBaseUrl, getAdminSocketBaseUrl } from './runtime-endpoints';
import { normalizePayload } from './mojibake';

const resolveAppMode = () => {
  try {
    const rawMode = String(import.meta.env?.VITE_APP_MODE || window?.ADMIN_APP_MODE || '').trim().toLowerCase();
    if (rawMode === 'center') return 'center';
  } catch (_) {}
  return 'dashboard';
};

const APP_MODE = resolveAppMode();
const WEB_MODE_CONFIG = APP_MODE === 'center'
  ? {
      sessionStorageKey: 'centerWebSessionToken',
      eventName: 'center:ipc-event',
      namespace: '/center-web',
      invokePath: '/api/center/invoke',
      sessionHeader: 'x-center-session-token',
      issueSessionChannel: 'verify-otp',
      clearHook: '__centerWebClearSessionToken',
    }
  : {
      sessionStorageKey: 'dashboardWebSessionToken',
      eventName: 'dashboard:ipc-event',
      namespace: '/dashboard-web',
      invokePath: '/api/dashboard/invoke',
      sessionHeader: 'x-dashboard-session-token',
      issueSessionChannel: 'login-request',
      clearHook: '__dashboardWebClearSessionToken',
    };

const isElectronRuntime = () => {
  try {
    return !!(window && window.process && window.process.versions && window.process.versions.electron);
  } catch (_) {
    return false;
  }
};

const readSessionToken = () => {
  try {
    return String(localStorage.getItem(WEB_MODE_CONFIG.sessionStorageKey) || '').trim();
  } catch (_) {
    return '';
  }
};

const writeSessionToken = (token) => {
  try {
    const normalized = String(token || '').trim();
    if (normalized) {
      localStorage.setItem(WEB_MODE_CONFIG.sessionStorageKey, normalized);
    } else {
      localStorage.removeItem(WEB_MODE_CONFIG.sessionStorageKey);
    }
  } catch (_) {}
};

if (typeof window !== 'undefined' && !isElectronRuntime()) {
  const nativeRequire = typeof window.require === 'function' ? window.require.bind(window) : null;
  const listeners = new Map();
  let appSocket = null;

  const totalListenerCount = () => {
    let total = 0;
    listeners.forEach((bucket) => {
      total += bucket.size;
    });
    return total;
  };

  const teardownSocketIfIdle = () => {
    if (appSocket && totalListenerCount() === 0) {
      appSocket.disconnect();
      appSocket = null;
    }
  };

  const bindSocket = () => {
    if (appSocket || totalListenerCount() === 0) return;
    const token = readSessionToken();
    if (!token) return;

    appSocket = io(`${getAdminSocketBaseUrl(APP_MODE)}${WEB_MODE_CONFIG.namespace}`, {
      transports: ['websocket', 'polling'],
      auth: { token },
    });

    appSocket.on(WEB_MODE_CONFIG.eventName, (payload = {}) => {
      const channel = String(payload.channel || '').trim();
      const args = normalizePayload(Array.isArray(payload.args) ? payload.args : []);
      const bucket = listeners.get(channel);
      if (!bucket || bucket.size === 0) return;
      bucket.forEach((listener) => {
        try {
          listener({}, ...args);
        } catch (error) {
          console.error(`[${APP_MODE}-web-shim] listener failed for ${channel}:`, error);
        }
      });
    });

    appSocket.on('connect_error', (error) => {
      const message = String(error?.message || '');
      if (message && !/unauthorized/i.test(message)) {
        console.warn(`[${APP_MODE}-web-shim] socket connect_error:`, message);
      }
    });
  };

  const refreshSocket = () => {
    if (appSocket) {
      appSocket.disconnect();
      appSocket = null;
    }
    bindSocket();
  };

  const clearSession = () => {
    writeSessionToken('');
    refreshSocket();
  };

  const ipcRendererShim = {
    invoke: async (channel, ...args) => {
      const headers = { 'Content-Type': 'application/json' };
      const token = readSessionToken();
      if (token) headers[WEB_MODE_CONFIG.sessionHeader] = token;

      const response = await fetch(`${getAdminApiBaseUrl(APP_MODE)}${WEB_MODE_CONFIG.invokePath}`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ channel, args }),
      });

      const data = normalizePayload(await response.json().catch(() => ({
        success: false,
        message: `Loi HTTP: ${response.status}`,
      })));

      if (channel === WEB_MODE_CONFIG.issueSessionChannel && data?.success && data?.sessionToken) {
        writeSessionToken(data.sessionToken);
        refreshSocket();
      } else if (data?.code === 'UNAUTHORIZED') {
        clearSession();
      }

      return data;
    },
    on: (channel, listener) => {
      if (!listeners.has(channel)) listeners.set(channel, new Set());
      listeners.get(channel).add(listener);
      bindSocket();
      return ipcRendererShim;
    },
    removeListener: (channel, listener) => {
      const bucket = listeners.get(channel);
      if (!bucket) return ipcRendererShim;
      bucket.delete(listener);
      if (bucket.size === 0) listeners.delete(channel);
      teardownSocketIfIdle();
      return ipcRendererShim;
    },
    off: (channel, listener) => ipcRendererShim.removeListener(channel, listener),
  };

  window.__adminWebClearSessionToken = clearSession;
  window[WEB_MODE_CONFIG.clearHook] = clearSession;
  if (APP_MODE === 'dashboard') {
    window.__dashboardWebClearSessionToken = clearSession;
  } else {
    window.__centerWebClearSessionToken = clearSession;
  }

  window.ipcRenderer = window.ipcRenderer || ipcRendererShim;
  window.electron = window.electron || {};
  window.electron.ipcRenderer = window.electron.ipcRenderer || ipcRendererShim;
  window.require = (moduleName) => {
    if (moduleName === 'electron') {
      return { ipcRenderer: ipcRendererShim };
    }
    if (nativeRequire) return nativeRequire(moduleName);
    throw new Error(`Module ${moduleName} is not available in ${APP_MODE} web mode.`);
  };
}