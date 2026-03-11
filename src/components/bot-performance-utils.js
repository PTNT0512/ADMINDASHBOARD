const DEFAULT_SETTINGS_CACHE_TTL_MS = 1500;
const DEFAULT_ACCOUNT_PROJECTION = 'userId balance status totalBet totalDeposit vipPoints token';

function toPositiveInt(value, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
}

function createSettingsCache(SettingModel, ttlMs = toPositiveInt(process.env.BOT_SETTINGS_CACHE_TTL_MS, DEFAULT_SETTINGS_CACHE_TTL_MS)) {
  let snapshot = null;
  let expiresAt = 0;
  let inflight = null;

  const load = async () => {
    const doc = await SettingModel.findOne({}).lean();
    snapshot = doc || null;
    expiresAt = Date.now() + ttlMs;
    return snapshot;
  };

  return {
    async get(forceRefresh = false) {
      const now = Date.now();
      if (!forceRefresh && snapshot && now < expiresAt) return snapshot;
      if (!forceRefresh && inflight) return inflight;
      inflight = load()
        .catch((error) => {
          throw error;
        })
        .finally(() => {
          inflight = null;
        });
      return inflight;
    },
    invalidate() {
      snapshot = null;
      expiresAt = 0;
      inflight = null;
    },
  };
}

function createKeyedSerialExecutor() {
  const tails = new Map();

  return async function runWithKey(key, task) {
    const queueKey = String(key || 'global');
    const previous = tails.get(queueKey) || Promise.resolve();
    let release;
    const gate = new Promise((resolve) => {
      release = resolve;
    });
    const tail = previous.catch(() => {}).then(() => gate);
    tails.set(queueKey, tail);

    try {
      await previous.catch(() => {});
      return await task();
    } finally {
      release();
      if (tails.get(queueKey) === tail) {
        tails.delete(queueKey);
      }
    }
  };
}

async function debitAccountForBet(AccountModel, {
  userId,
  amount,
  totalBetAmount = amount,
  projection = DEFAULT_ACCOUNT_PROJECTION,
} = {}) {
  const betAmount = Number(amount || 0);
  const totalBet = Number(totalBetAmount || 0);
  if (!Number.isFinite(betAmount) || betAmount <= 0) {
    return { ok: false, reason: 'invalid_amount' };
  }

  const account = await AccountModel.findOneAndUpdate(
    {
      userId,
      status: { $ne: 0 },
      balance: { $gte: betAmount },
    },
    {
      $inc: {
        balance: -betAmount,
        totalBet,
      },
    },
    {
      new: true,
      projection,
    },
  ).lean();

  if (account) {
    return { ok: true, account };
  }

  const fallback = await AccountModel.findOne({ userId }, projection).lean();
  if (!fallback) return { ok: false, reason: 'missing' };
  if (fallback.status === 0) return { ok: false, reason: 'blocked', account: fallback };
  if (Number(fallback.balance || 0) < betAmount) return { ok: false, reason: 'insufficient', account: fallback };
  return { ok: false, reason: 'unknown', account: fallback };
}

async function creditAccountBalance(AccountModel, userId, amount, projection = DEFAULT_ACCOUNT_PROJECTION) {
  const creditAmount = Number(amount || 0);
  if (!Number.isFinite(creditAmount) || creditAmount === 0) {
    return AccountModel.findOne({ userId }, projection).lean();
  }

  return AccountModel.findOneAndUpdate(
    { userId },
    { $inc: { balance: creditAmount } },
    { new: true, projection },
  ).lean();
}

module.exports = {
  createSettingsCache,
  createKeyedSerialExecutor,
  debitAccountForBet,
  creditAccountBalance,
  toPositiveInt,
};
