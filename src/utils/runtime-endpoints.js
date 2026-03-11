const trimTrailingSlash = (value) => String(value || '').replace(/\/+$/, '');

const readProcessEnv = (name) => {
  try {
    if (typeof process !== 'undefined' && process && process.env && process.env[name]) {
      return String(process.env[name]);
    }
  } catch (_) {}
  return '';
};

const readViteEnv = (name) => {
  try {
    if (typeof import.meta !== 'undefined' && import.meta && import.meta.env && import.meta.env[name]) {
      return String(import.meta.env[name]);
    }
  } catch (_) {}
  return '';
};

const normalizeBaseUrl = (value, fallback) => {
  const raw = String(value || '').trim();
  if (!raw) return fallback;
  const withProtocol = /^https?:\/\//i.test(raw) ? raw : `http://${raw}`;
  return trimTrailingSlash(withProtocol);
};

const getBrowserOriginFallback = () => {
  try {
    if (typeof window !== 'undefined' && window.location && /^https?:$/i.test(window.location.protocol)) {
      return trimTrailingSlash(window.location.origin);
    }
  } catch (_) {}
  return '';
};

const getAppMode = () => {
  const rawMode = String(
    readViteEnv('VITE_APP_MODE') || readProcessEnv('VITE_APP_MODE') || (typeof window !== 'undefined' ? window.ADMIN_APP_MODE || '' : ''),
  ).trim().toLowerCase();
  return rawMode === 'center' ? 'center' : 'dashboard';
};

const getWindowCandidates = (mode) => {
  if (mode === 'center') {
    return [window.CENTER_API_URL, window.ADMIN_API_URL, window.SOCKET_API_URL];
  }
  return [window.DASHBOARD_API_URL, window.ADMIN_API_URL, window.SOCKET_API_URL];
};

const getViteCandidates = (mode) => {
  if (mode === 'center') {
    return ['VITE_CENTER_API_URL', 'VITE_ADMIN_API_URL', 'VITE_SOCKET_API_URL'];
  }
  return ['VITE_DASHBOARD_API_URL', 'VITE_ADMIN_API_URL', 'VITE_SOCKET_API_URL'];
};

const getProcessCandidates = (mode) => {
  if (mode === 'center') {
    return ['CENTER_API_URL', 'ADMIN_API_URL', 'SOCKET_API_URL', 'API_BASE_URL'];
  }
  return ['DASHBOARD_API_URL', 'ADMIN_API_URL', 'SOCKET_API_URL', 'API_BASE_URL'];
};

const resolveRemoteBase = (mode = getAppMode()) => {
  const fromWindow = typeof window !== 'undefined'
    ? String(getWindowCandidates(mode).find((item) => String(item || '').trim()) || '').trim()
    : '';

  const fromVite = String(
    getViteCandidates(mode)
      .map((key) => readViteEnv(key))
      .find((item) => String(item || '').trim()) || '',
  ).trim();

  const fromProcess = String(
    getProcessCandidates(mode)
      .map((key) => readProcessEnv(key))
      .find((item) => String(item || '').trim()) || '',
  ).trim();

  return fromWindow || fromVite || fromProcess || getBrowserOriginFallback();
};

const getDefaultBaseForMode = (mode = getAppMode()) => {
  return mode === 'center' ? 'http://localhost:56174' : 'http://localhost:4001';
};

export const getAdminApiBaseUrl = (mode = getAppMode()) => normalizeBaseUrl(resolveRemoteBase(mode), getDefaultBaseForMode(mode));
export const getAdminSocketBaseUrl = (mode = getAppMode()) => normalizeBaseUrl(resolveRemoteBase(mode), getDefaultBaseForMode(mode));
export const getDashboardApiBaseUrl = () => getAdminApiBaseUrl(getAppMode());
export const getDashboardSocketBaseUrl = () => getAdminSocketBaseUrl(getAppMode());
