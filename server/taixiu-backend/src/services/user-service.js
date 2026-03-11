"use strict";

const User = require("../db/models/User");
const Account = require("../db/models/Account");

function toSafeMoney(value, fallback = 0) {
  const n = Number(value);
  if (!Number.isFinite(n)) return Math.max(0, Math.floor(fallback || 0));
  return Math.max(0, Math.floor(n));
}

function normalizeNickname(raw) {
  const base = String(raw || "")
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^a-zA-Z0-9_.-]/g, "");
  return base.slice(0, 24);
}

function isAccountTokenFormat(token) {
  return /^[a-f0-9]{64}$/i.test(String(token || ""));
}

function buildNicknameFromAccount(account, preferredNickname) {
  const preferred = normalizeNickname(preferredNickname);
  if (preferred) {
    return preferred;
  }

  const userId = Number(account && account.userId);
  if (Number.isFinite(userId) && userId > 0) {
    return `u${Math.floor(userId)}`;
  }

  const rawId = account && account._id ? String(account._id) : "";
  const suffix = rawId ? rawId.slice(-8) : "guest";
  return `acc_${suffix}`;
}

function extractAccountUserId(userDoc) {
  if (!userDoc) {
    return null;
  }

  const nickname = String(userDoc.nickname || "");
  const match = /^u(\d+)$/.exec(nickname);
  if (!match) {
    return null;
  }

  const userId = Number(match[1]);
  if (!Number.isFinite(userId) || userId <= 0) {
    return null;
  }

  return Math.floor(userId);
}

async function syncLinkedAccountBalance(userDoc) {
  if (!userDoc) {
    return null;
  }

  const balance = toSafeMoney(userDoc.coin, 0);
  const token = String(userDoc.accessToken || "").trim();

  if (token && isAccountTokenFormat(token)) {
    const accountByToken = await Account.findOneAndUpdate(
      { token },
      { $set: { balance } },
      { new: true }
    );
    if (accountByToken) {
      return accountByToken;
    }
  }

  const accountUserId = extractAccountUserId(userDoc);
  if (!accountUserId) {
    return null;
  }

  return Account.findOneAndUpdate(
    { userId: accountUserId },
    { $set: { balance } },
    { new: true }
  );
}

async function syncLinkedAccountBalanceSafe(userDoc) {
  try {
    await syncLinkedAccountBalance(userDoc);
  } catch (error) {
    const nickname = userDoc && userDoc.nickname ? String(userDoc.nickname) : "unknown";
    const msg = error && error.message ? error.message : error;
    console.error(`[account-sync] failed for ${nickname}:`, msg);
  }
}

async function findAccountByToken(accessToken) {
  const safeToken = String(accessToken || "").trim();
  if (!safeToken) {
    return null;
  }
  return Account.findOne({ token: safeToken }, { userId: 1, balance: 1, status: 1, token: 1 }).lean();
}

async function findOrCreateUserByToken({ nickname, accessToken, defaultCoin }) {
  const safeToken = String(accessToken || "").trim();
  if (!safeToken) {
    return null;
  }

  const account = await findAccountByToken(safeToken);
  if (!account) {
    return null;
  }

  if (Number(account.status || 1) === 0) {
    throw new Error("account is locked");
  }

  const safeDefaultCoin = toSafeMoney(defaultCoin, 1000000000);
  const resolvedNickname = buildNicknameFromAccount(account, nickname);
  const syncedCoin = toSafeMoney(account.balance, safeDefaultCoin);

  const now = new Date();
  const user = await User.findOneAndUpdate(
    { nickname: resolvedNickname },
    {
      $set: {
        accessToken: safeToken,
        coin: syncedCoin,
        updatedAt: now
      },
      $setOnInsert: {
        vipPoint: 0,
        userType: 0,
        createdAt: now
      }
    },
    { new: true, upsert: true }
  );

  return { user, account, resolvedNickname, syncedCoin };
}

async function findOrCreateUser({ nickname, accessToken, defaultCoin }) {
  const safeNickname = normalizeNickname(nickname);
  const safeToken = String(accessToken || "").trim();
  const safeDefaultCoin = toSafeMoney(defaultCoin, 1000000000);

  if (safeToken) {
    const tokenLogin = await findOrCreateUserByToken({
      nickname: safeNickname,
      accessToken: safeToken,
      defaultCoin: safeDefaultCoin
    });
    if (tokenLogin && tokenLogin.user) {
      return tokenLogin.user;
    }
    if (isAccountTokenFormat(safeToken)) {
      throw new Error("invalid accessToken");
    }
  }

  if (!safeNickname) {
    throw new Error("nickname is required");
  }

  const now = new Date();
  const user = await User.findOneAndUpdate(
    { nickname: safeNickname },
    {
      $set: { accessToken: safeToken, updatedAt: now },
      $setOnInsert: { coin: safeDefaultCoin, createdAt: now }
    },
    { new: true, upsert: true }
  );
  return user;
}

async function getUserById(id) {
  return User.findById(id);
}

async function tryDebit(userId, amount) {
  if (amount <= 0) {
    throw new Error("debit amount must be > 0");
  }

  const updatedUser = await User.findOneAndUpdate(
    { _id: userId, coin: { $gte: amount } },
    { $inc: { coin: -amount } },
    { new: true }
  );

  if (updatedUser) {
    await syncLinkedAccountBalanceSafe(updatedUser);
  }

  return updatedUser;
}

async function credit(userId, amount) {
  let updatedUser = null;

  if (amount <= 0) {
    updatedUser = await User.findById(userId);
  } else {
    updatedUser = await User.findByIdAndUpdate(userId, { $inc: { coin: amount } }, { new: true });
  }

  if (updatedUser) {
    await syncLinkedAccountBalanceSafe(updatedUser);
  }

  return updatedUser;
}

async function creditByNickname(nickname, amount) {
  const updatedUser = await User.findOneAndUpdate({ nickname }, { $inc: { coin: amount } }, { new: true });
  if (updatedUser) {
    await syncLinkedAccountBalanceSafe(updatedUser);
  }
  return updatedUser;
}

module.exports = {
  findAccountByToken,
  findOrCreateUserByToken,
  findOrCreateUser,
  getUserById,
  tryDebit,
  credit,
  creditByNickname
};
