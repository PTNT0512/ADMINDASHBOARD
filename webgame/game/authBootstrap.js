const resolveGameApiBase = () => {
  if (typeof window !== 'undefined') {
    const fromWindow = window.GAME_API_URL || window.API_BASE_URL || window.SOCKET_API_URL;
    if (typeof fromWindow === 'string' && fromWindow.trim()) {
      return fromWindow.trim().replace(/\/+$/, '');
    }
  }
  return 'http://localhost:4001';
};

const GAME_LOGIN_API = `${resolveGameApiBase()}/api/login`;
const GAME_USER_STORAGE_KEY = 'gameCurrentUser';
const GAME_SESSION_STORAGE_KEY = 'gameSessionToken';

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const readStoredUser = () => {
  try {
    const raw = localStorage.getItem(GAME_USER_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    return {
      ...parsed,
      balance: toNumber(parsed.balance, 0),
      vip: toNumber(parsed.vip, 1),
    };
  } catch (error) {
    console.warn('Cannot parse stored game user:', error);
    return null;
  }
};

const writeStoredUser = (user) => {
  try {
    localStorage.setItem(GAME_USER_STORAGE_KEY, JSON.stringify(user));
  } catch (error) {
    console.warn('Cannot persist game user:', error);
  }
};

const resolveAuthInput = () => {
  const params = new URLSearchParams(window.location.search);
  // Preferred login param: ?stargame={token}
  const stargame = (params.get('stargame') || '').trim();
  const gt = (params.get('gt') || '').trim();
  const token = String(stargame || params.get('token') || '').trim();
  return { gt, token, stargame };
};

const applyUser = (user, callbacks = {}) => {
  if (!user || typeof user !== 'object') return null;
  const normalized = {
    ...user,
    balance: toNumber(user.balance, 0),
    vip: toNumber(user.vip, 1),
  };

  if (typeof callbacks.onUser === 'function') callbacks.onUser(normalized);
  if (typeof callbacks.onBalance === 'function') callbacks.onBalance(normalized.balance);

  return normalized;
};

export const bootstrapGameAuth = async (callbacks = {}) => {
  const { gt, token, stargame } = resolveAuthInput();
  if (!gt && !token) {
    const storedUser = readStoredUser();
    const user = applyUser(storedUser, callbacks);
    return { success: Boolean(user), user, fromStorage: Boolean(user) };
  }

  const payload = gt ? { gt } : { token, stargame: stargame || undefined };
  const response = await fetch(GAME_LOGIN_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const data = await response.json();
  if (!data.success || !data.user) {
    return { success: false, message: data.message || 'Dang nhap game that bai' };
  }

  const user = applyUser(data.user, callbacks);
  writeStoredUser(user);

  if (data.sessionToken) {
    localStorage.setItem(GAME_SESSION_STORAGE_KEY, data.sessionToken);
  }

  return { success: true, user, fromStorage: false, sessionToken: data.sessionToken || '' };
};

export const getStoredGameUser = () => readStoredUser();

