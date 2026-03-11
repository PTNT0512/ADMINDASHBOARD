const API_URL = 'http://localhost:4001/api/game/win-rates';

const DEFAULT_WIN_RATES = {
  booms: 35,
  plinko: 45,
  roulette: 38,
  xeng: 40,
  trading: 50,
  lottery: 42,
  lode: 45,
  xoso1phut: 44,
};

let cache = { ...DEFAULT_WIN_RATES };
let lastFetchAt = 0;
let inflight = null;
const CACHE_TTL_MS = 30 * 1000;

const clamp = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
};

const normalize = (payload = {}) => {
  const next = { ...DEFAULT_WIN_RATES };
  Object.entries(payload || {}).forEach(([key, value]) => {
    if (Object.prototype.hasOwnProperty.call(next, key)) {
      next[key] = clamp(value);
    }
  });
  return next;
};

export const refreshWinRates = async (force = false) => {
  const now = Date.now();
  if (!force && now - lastFetchAt < CACHE_TTL_MS) return cache;
  if (inflight) return inflight;

  inflight = fetch(API_URL)
    .then((res) => res.json())
    .then((json) => {
      if (json?.success && json?.data) {
        cache = normalize(json.data);
        lastFetchAt = Date.now();
      }
      return cache;
    })
    .catch(() => cache)
    .finally(() => {
      inflight = null;
    });

  return inflight;
};

export const getWinRate = (gameId) => {
  const key = String(gameId || '').trim();
  if (!Object.prototype.hasOwnProperty.call(cache, key)) return 50;
  return clamp(cache[key]);
};

export const shouldPlayerWin = (gameId, fallbackRate = null) => {
  if (Date.now() - lastFetchAt > CACHE_TTL_MS && !inflight) {
    refreshWinRates().catch(() => {});
  }
  const rate = fallbackRate === null ? getWinRate(gameId) : clamp(fallbackRate);
  return Math.random() * 100 < rate;
};

export const pickByWinRate = (gameId, winCandidates = [], loseCandidates = [], fallbackRate = null) => {
  const shouldWin = shouldPlayerWin(gameId, fallbackRate);
  const winPool = Array.isArray(winCandidates) ? winCandidates.filter((x) => x !== undefined && x !== null) : [];
  const losePool = Array.isArray(loseCandidates) ? loseCandidates.filter((x) => x !== undefined && x !== null) : [];

  const pool = shouldWin
    ? (winPool.length ? winPool : losePool)
    : (losePool.length ? losePool : winPool);

  if (!pool.length) return null;
  return pool[Math.floor(Math.random() * pool.length)];
};

export const getDefaultWinRates = () => ({ ...DEFAULT_WIN_RATES });
