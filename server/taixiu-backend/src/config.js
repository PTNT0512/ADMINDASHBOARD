"use strict";

const fs = require("fs");
const path = require("path");
const { loadAdminAppEnv } = require("../../../src/load-shared-env.js");

loadAdminAppEnv({
  includeMode: false,
  includeApiBank: false,
  extraPaths: [
    path.resolve(__dirname, "../.env"),
    path.resolve(process.cwd(), ".env"),
  ],
});

const BACKEND_ROOT = path.resolve(__dirname, "..");

function toNumber(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function toBool(value, fallback = false) {
  if (value == null) return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "y", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "n", "off"].includes(normalized)) return false;
  return fallback;
}

function normalizeString(value) {
  return String(value || "").trim();
}

function pickFirstString(...values) {
  for (const value of values) {
    const normalized = normalizeString(value);
    if (normalized) return normalized;
  }
  return "";
}

function toOptionalNumber(value, fallback = null) {
  const normalized = normalizeString(value);
  if (!normalized) return fallback;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : fallback;
}

function resolveOptionalPath(rawValue) {
  const value = normalizeString(rawValue);
  if (!value) return "";
  return path.isAbsolute(value) ? value : path.resolve(BACKEND_ROOT, value);
}

function pickFirstExistingPath(paths) {
  for (const item of paths) {
    if (!item) continue;
    try {
      if (fs.existsSync(item)) {
        return item;
      }
    } catch (_error) {
      // ignore bad path and continue.
    }
  }
  return paths[0] || "";
}

const explicitWebRoot = resolveOptionalPath(
  pickFirstString(process.env.TAIXIU_WEB_BUILD_DIR, process.env.WEB_BUILD_DIR)
);
const fallbackWebRoot = pickFirstExistingPath([
  path.resolve(BACKEND_ROOT, "../../client/build/web-mobile"),
  path.resolve(BACKEND_ROOT, "build/web-mobile"),
  path.resolve(BACKEND_ROOT, "web-mobile")
]);

const appHost = pickFirstString(process.env.TAIXIU_APP_HOST, process.env.HOST, "0.0.0.0");
const appPort = toNumber(pickFirstString(process.env.TAIXIU_APP_PORT, process.env.PORT), 18082);
const publicHost = pickFirstString(process.env.TAIXIU_PUBLIC_HOST, process.env.PUBLIC_HOST);
const publicPort = toOptionalNumber(pickFirstString(process.env.TAIXIU_PUBLIC_PORT, process.env.PUBLIC_PORT), null);
const publicWsHost = pickFirstString(process.env.TAIXIU_PUBLIC_WS_HOST, process.env.PUBLIC_WS_HOST, publicHost);
const publicWsPort = toOptionalNumber(
  pickFirstString(process.env.TAIXIU_PUBLIC_WS_PORT, process.env.PUBLIC_WS_PORT),
  publicPort
);
const publicApiHost = pickFirstString(
  process.env.TAIXIU_PUBLIC_API_HOST,
  process.env.PUBLIC_API_HOST,
  publicHost,
  publicWsHost
);
const publicApiPort = toOptionalNumber(
  pickFirstString(process.env.TAIXIU_PUBLIC_API_PORT, process.env.PUBLIC_API_PORT),
  publicPort != null ? publicPort : publicWsPort
);

module.exports = {
  app: {
    host: appHost,
    port: appPort,
    wsPath: pickFirstString(process.env.TAIXIU_WS_PATH, process.env.WS_PATH, "/websocket"),
    enableWebClient: toBool(
      process.env.TAIXIU_ENABLE_WEB_CLIENT != null
        ? process.env.TAIXIU_ENABLE_WEB_CLIENT
        : process.env.ENABLE_WEB_CLIENT,
      true
    ),
    webRoot: explicitWebRoot || fallbackWebRoot,
    publicClient: {
      host: publicHost,
      port: publicPort,
      wsHost: publicWsHost,
      wsPort: publicWsPort,
      wsSecure: toBool(
        process.env.TAIXIU_PUBLIC_WS_SECURE != null
          ? process.env.TAIXIU_PUBLIC_WS_SECURE
          : process.env.PUBLIC_WS_SECURE,
        false
      ),
      apiHost: publicApiHost,
      apiPort: publicApiPort,
      apiSecure: toBool(
        process.env.TAIXIU_PUBLIC_API_SECURE != null
          ? process.env.TAIXIU_PUBLIC_API_SECURE
          : process.env.PUBLIC_API_SECURE,
        false
      ),
      apiPath: normalizeString(
        process.env.TAIXIU_PUBLIC_API_PATH || process.env.PUBLIC_API_PATH || "/api"
      ) || "/api"
    }
  },
  mongo: {
    uri: pickFirstString(process.env.TAIXIU_MONGODB_URI, process.env.MONGODB_URI, "mongodb://127.0.0.1:27017/lasvegas")
  },
  game: {
    defaultCoin: toNumber(process.env.DEFAULT_USER_COIN, 1000000000),
    historyLimit: toNumber(process.env.SESSION_HISTORY_LIMIT, 100),
    double: {
      betDurationSec: toNumber(process.env.BET_DURATION_DOUBLE, 60),
      resultDurationSec: toNumber(process.env.RESULT_DURATION_DOUBLE, 15),
      enableJackpot: toBool(process.env.ENABLE_JACKPOT_DOUBLE, false)
    },
    md5: {
      betDurationSec: toNumber(process.env.BET_DURATION_MD5, 55),
      resultDurationSec: toNumber(process.env.RESULT_DURATION_MD5, 15)
    },
    baucua: {
      betDurationSec: toNumber(process.env.BET_DURATION_BAUCUA, 40),
      resultDurationSec: toNumber(process.env.RESULT_DURATION_BAUCUA, 10)
    },
    xocdia: {
      startDurationSec: toNumber(process.env.START_DURATION_XOCDIA, 2),
      betDurationSec: toNumber(process.env.BET_DURATION_XOCDIA, 20),
      refundDurationSec: toNumber(process.env.REFUND_DURATION_XOCDIA, 3),
      resultDurationSec: toNumber(process.env.RESULT_DURATION_XOCDIA, 6),
      enableBotTraffic: toBool(process.env.ENABLE_BOT_XOCDIA, true),
      botBetMin: toNumber(process.env.BOT_BET_MIN_XOCDIA, 5000),
      botBetMax: toNumber(process.env.BOT_BET_MAX_XOCDIA, 250000),
      botBurstMin: toNumber(process.env.BOT_BURST_MIN_XOCDIA, 1),
      botBurstMax: toNumber(process.env.BOT_BURST_MAX_XOCDIA, 3)
    }
  }
};
