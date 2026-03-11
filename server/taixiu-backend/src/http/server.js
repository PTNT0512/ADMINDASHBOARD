"use strict";

const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const User = require("../db/models/User");
const GameSession = require("../db/models/GameSession");
const Bet = require("../db/models/Bet");
const BauCuaSession = require("../db/models/BauCuaSession");
const BauCuaBet = require("../db/models/BauCuaBet");
const MiniPokerSpin = require("../db/models/MiniPokerSpin");
const XocDiaSession = require("../db/models/XocDiaSession");
const XocDiaBet = require("../db/models/XocDiaBet");
const userService = require("../services/user-service");

const HISTORY_PAGE_SIZE = 10;

const CONTROL_GAME_KEYS = ["double", "md5", "minipoker", "baucua", "xocdia"];

function toInt(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

function formatTimestamp(value) {
  const d = value ? new Date(value) : null;
  if (!d || Number.isNaN(d.getTime())) {
    return "";
  }
  const pad2 = (n) => (n < 10 ? `0${n}` : `${n}`);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
}

function getGameKeyFromQuery(query) {
  const raw = String(query.game || query.type || "").trim().toLowerCase();
  if (raw === "double" || raw === "taixiudouble" || raw === "txdouble") {
    return "double";
  }
  if (raw === "md5" || raw === "taixiumd5") {
    return "md5";
  }

  const txType = toInt(query.txType, 0);
  if (txType === 2) {
    return "double";
  }
  return "";
}

function normalizeControlGameKey(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) return "";
  if (raw === "double" || raw === "taixiudouble" || raw === "txdouble") return "double";
  if (raw === "md5" || raw === "taixiumd5") return "md5";
  if (raw === "minipoker" || raw === "mini_poker" || raw === "mini-poker") return "minipoker";
  if (raw === "baucua" || raw === "bau_cua" || raw === "bau-cua") return "baucua";
  if (raw === "xocdia" || raw === "xoc_dia" || raw === "xoc-dia") return "xocdia";
  return "";
}
function formatResultPhien(session) {
  if (!session || session.dice1 == null || session.dice2 == null || session.dice3 == null) {
    return "Cho ket qua";
  }
  const total = Number(session.dice1 || 0) + Number(session.dice2 || 0) + Number(session.dice3 || 0);
  const resultDoor = session.resultDoor == null ? (total >= 11 ? 1 : 0) : session.resultDoor;
  const doorText = resultDoor === 1 ? "TAI" : "XIU";
  return `${doorText} ${total}`;
}

async function loadSessionMapByBets(bets, forcedGameKey) {
  if (!Array.isArray(bets) || bets.length === 0) {
    return new Map();
  }
  const pairs = [];
  for (const bet of bets) {
    if (!bet || bet.referenceId == null) continue;
    const gameKey = forcedGameKey || bet.gameKey;
    pairs.push({ referenceId: Number(bet.referenceId), gameKey: String(gameKey || "") });
  }
  if (!pairs.length) {
    return new Map();
  }

  const orFilters = [];
  for (const pair of pairs) {
    if (!pair.gameKey) continue;
    orFilters.push({ referenceId: pair.referenceId, gameKey: pair.gameKey });
  }
  if (!orFilters.length) {
    return new Map();
  }

  const sessions = await GameSession.find({ $or: orFilters }, { gameKey: 1, referenceId: 1, dice1: 1, dice2: 1, dice3: 1, resultDoor: 1 })
    .lean();

  const map = new Map();
  for (const session of sessions) {
    map.set(`${session.gameKey}:${session.referenceId}`, session);
  }
  return map;
}

function normalizeBauCuaValues(values) {
  const out = [0, 0, 0, 0, 0, 0];
  if (!Array.isArray(values)) return out;
  for (let i = 0; i < 6; i += 1) {
    out[i] = Math.max(0, toInt(values[i], 0));
  }
  return out;
}

function calcBauCuaPrizeArray(betValues, session) {
  const prizes = [0, 0, 0, 0, 0, 0];
  if (!session || session.dice1 == null || session.dice2 == null || session.dice3 == null) {
    return prizes;
  }
  const dices = [toInt(session.dice1, 0), toInt(session.dice2, 0), toInt(session.dice3, 0)];
  const counts = [0, 0, 0, 0, 0, 0];
  for (const dice of dices) {
    if (dice >= 0 && dice < 6) counts[dice] += 1;
  }
  const xPot = toInt(session.xPot, 0);
  const xValue = toInt(session.xValue, 0);
  for (let i = 0; i < 6; i += 1) {
    const bet = Math.max(0, toInt(betValues[i], 0));
    let prize = bet * counts[i];
    if (xValue > 1 && i === xPot && counts[i] > 0) {
      prize += bet * counts[i] * (xValue - 1);
    }
    prizes[i] = prize;
  }
  return prizes;
}

const BAUCUA_DOOR_LABELS = ["Bau", "Cua", "Tom", "Ca", "Ga", "Nai"];
const XOCDIA_DOOR_LABELS = ["Chan", "Le", "4 Trang", "4 Do", "3 Do 1 Trang", "3 Trang 1 Do"];

function toSafeInt(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

function toSafeAmount(value) {
  return Math.max(0, toSafeInt(value, 0));
}

function normalizeDoorTotals(values, labels) {
  const source = Array.isArray(values) ? values : [];
  return labels.map((label, index) => ({
    doorId: index,
    label,
    totalBet: toSafeAmount(source[index])
  }));
}

function sumDoorTotals(doorTotals) {
  if (!Array.isArray(doorTotals)) return 0;
  return doorTotals.reduce((total, item) => total + toSafeAmount(item && item.totalBet), 0);
}

function formatTxResultText(d1, d2, d3) {
  if (d1 == null || d2 == null || d3 == null) return "Chua co ket qua";
  const dice1 = toSafeInt(d1, 0);
  const dice2 = toSafeInt(d2, 0);
  const dice3 = toSafeInt(d3, 0);
  const total = dice1 + dice2 + dice3;
  const doorText = total >= 11 ? "TAI" : "XIU";
  return `${doorText} ${total} (${dice1}-${dice2}-${dice3})`;
}

function formatBauCuaResultText(d1, d2, d3, xPot, xValue) {
  if (d1 == null || d2 == null || d3 == null) return "Chua co ket qua";
  const dices = [toSafeInt(d1, -1), toSafeInt(d2, -1), toSafeInt(d3, -1)];
  const names = dices.map((idx) => BAUCUA_DOOR_LABELS[idx] || `${idx}`);
  const safeXValue = toSafeInt(xValue, 0);
  const safeXPot = toSafeInt(xPot, 0);
  const xText = safeXValue > 1 ? ` | X${safeXValue} ${BAUCUA_DOOR_LABELS[safeXPot] || safeXPot}` : "";
  return `${names.join(', ')}${xText}`;
}

function formatXocDiaResultText(diceIds) {
  if (!Array.isArray(diceIds) || diceIds.length < 4) return "Chua co ket qua";
  const arr = diceIds.slice(0, 4).map((item) => toSafeInt(item, 0));
  const redCount = arr.reduce((total, item) => total + (item === 1 ? 1 : 0), 0);
  const whiteCount = 4 - redCount;
  const parity = redCount % 2 === 0 ? "Chan" : "Le";
  return `${parity} (${redCount} do - ${whiteCount} trang)`;
}

function mapDoubleDoorBets(row) {
  return [
    { doorId: 1, label: "Tai", totalBet: toSafeAmount(row && row.taiBet) },
    { doorId: 0, label: "Xiu", totalBet: toSafeAmount(row && row.xiuBet) }
  ];
}

function mapBauCuaDoorBets(row) {
  return BAUCUA_DOOR_LABELS.map((label, idx) => ({
    doorId: idx,
    label,
    totalBet: toSafeAmount(row && row[`door${idx}Bet`])
  }));
}

function mapXocDiaDoorBets(row) {
  return XOCDIA_DOOR_LABELS.map((label, idx) => ({
    doorId: idx,
    label,
    totalBet: toSafeAmount(row && row[`door${idx}Bet`])
  }));
}

async function buildDoubleMd5ControlDetails(gameKey, snapshot) {
  const referenceId = toSafeInt(snapshot && snapshot.referenceId, 0);
  const session = referenceId > 0
    ? await GameSession.findOne({ gameKey, referenceId }).lean()
    : null;

  const grouped = referenceId > 0
    ? await Bet.aggregate([
        { $match: { gameKey, referenceId } },
        {
          $group: {
            _id: { userId: "$userId", nickname: "$nickname" },
            totalBet: { $sum: { $ifNull: ["$amount", 0] } },
            taiBet: { $sum: { $cond: [{ $eq: ["$door", 1] }, { $ifNull: ["$amount", 0] }, 0] } },
            xiuBet: { $sum: { $cond: [{ $eq: ["$door", 0] }, { $ifNull: ["$amount", 0] }, 0] } },
            betCount: { $sum: 1 },
            lastBetAt: { $max: "$createdAt" }
          }
        },
        { $sort: { totalBet: -1, lastBetAt: -1, "_id.nickname": 1 } },
        { $limit: 500 }
      ])
    : [];

  const doorTotals = normalizeDoorTotals([
    grouped.reduce((sum, row) => sum + toSafeAmount(row && row.taiBet), 0),
    grouped.reduce((sum, row) => sum + toSafeAmount(row && row.xiuBet), 0)
  ], ["Tai", "Xiu"]);

  const playerBets = grouped.map((row) => ({
    userId: row && row._id && row._id.userId ? String(row._id.userId) : "",
    nickname: String(row && row._id && row._id.nickname ? row._id.nickname : ""),
    totalBet: toSafeAmount(row && row.totalBet),
    betCount: toSafeInt(row && row.betCount, 0),
    lastBetTime: formatTimestamp(row && row.lastBetAt),
    doorBets: mapDoubleDoorBets(row)
  }));

  return {
    sessionInfo: {
      referenceId,
      sessionTime: formatTimestamp(session && (session.startedAt || session.createdAt)),
      phase: String((snapshot && snapshot.phase) || (session && session.phase) || ""),
      remainTime: toSafeInt(snapshot && snapshot.remainTime, session ? session.remainTime : 0),
      result: formatTxResultText(session && session.dice1, session && session.dice2, session && session.dice3),
      doorTotals,
      totalBet: sumDoorTotals(doorTotals)
    },
    playerBets
  };
}
async function buildBauCuaControlDetails(snapshot) {
  const referenceId = toSafeInt(snapshot && snapshot.referenceId, 0);
  const session = referenceId > 0
    ? await BauCuaSession.findOne({ referenceId }).lean()
    : null;

  const grouped = referenceId > 0
    ? await BauCuaBet.aggregate([
        { $match: { referenceId } },
        {
          $group: {
            _id: { userId: "$userId", nickname: "$nickname" },
            totalBet: { $sum: { $ifNull: ["$totalBet", 0] } },
            door0Bet: { $sum: { $ifNull: [{ $arrayElemAt: ["$betValues", 0] }, 0] } },
            door1Bet: { $sum: { $ifNull: [{ $arrayElemAt: ["$betValues", 1] }, 0] } },
            door2Bet: { $sum: { $ifNull: [{ $arrayElemAt: ["$betValues", 2] }, 0] } },
            door3Bet: { $sum: { $ifNull: [{ $arrayElemAt: ["$betValues", 3] }, 0] } },
            door4Bet: { $sum: { $ifNull: [{ $arrayElemAt: ["$betValues", 4] }, 0] } },
            door5Bet: { $sum: { $ifNull: [{ $arrayElemAt: ["$betValues", 5] }, 0] } },
            betCount: { $sum: 1 },
            lastBetAt: { $max: "$createdAt" }
          }
        },
        { $sort: { totalBet: -1, lastBetAt: -1, "_id.nickname": 1 } },
        { $limit: 500 }
      ])
    : [];

  const doorTotals = normalizeDoorTotals(
    BAUCUA_DOOR_LABELS.map((_, idx) =>
      grouped.reduce((sum, row) => sum + toSafeAmount(row && row[`door${idx}Bet`]), 0)
    ),
    BAUCUA_DOOR_LABELS
  );

  const playerBets = grouped.map((row) => ({
    userId: row && row._id && row._id.userId ? String(row._id.userId) : "",
    nickname: String(row && row._id && row._id.nickname ? row._id.nickname : ""),
    totalBet: toSafeAmount(row && row.totalBet),
    betCount: toSafeInt(row && row.betCount, 0),
    lastBetTime: formatTimestamp(row && row.lastBetAt),
    doorBets: mapBauCuaDoorBets(row)
  }));

  return {
    sessionInfo: {
      referenceId,
      sessionTime: formatTimestamp(session && (session.startedAt || session.createdAt)),
      phase: String((snapshot && snapshot.phase) || (session && session.phase) || ""),
      remainTime: toSafeInt(snapshot && snapshot.remainTime, session ? session.remainTime : 0),
      result: formatBauCuaResultText(
        session && session.dice1,
        session && session.dice2,
        session && session.dice3,
        session && session.xPot,
        session && session.xValue
      ),
      doorTotals,
      totalBet: sumDoorTotals(doorTotals)
    },
    playerBets
  };
}
async function buildXocDiaControlDetails(snapshot) {
  const referenceId = toSafeInt(snapshot && snapshot.referenceId, 0);
  const roomId = toSafeInt(snapshot && snapshot.roomId, 0);
  const sessionFilter = roomId > 0 ? { referenceId, roomId } : { referenceId };
  const session = referenceId > 0
    ? await XocDiaSession.findOne(sessionFilter).sort({ updatedAt: -1 }).lean()
    : null;
  const betFilter = { referenceId };
  if (roomId > 0) {
    betFilter.roomId = roomId;
  }

  const grouped = referenceId > 0
    ? await XocDiaBet.aggregate([
        { $match: betFilter },
        {
          $group: {
            _id: { userId: "$userId", nickname: "$nickname" },
            totalBet: { $sum: { $ifNull: ["$amount", 0] } },
            door0Bet: { $sum: { $cond: [{ $eq: ["$doorId", 0] }, { $ifNull: ["$amount", 0] }, 0] } },
            door1Bet: { $sum: { $cond: [{ $eq: ["$doorId", 1] }, { $ifNull: ["$amount", 0] }, 0] } },
            door2Bet: { $sum: { $cond: [{ $eq: ["$doorId", 2] }, { $ifNull: ["$amount", 0] }, 0] } },
            door3Bet: { $sum: { $cond: [{ $eq: ["$doorId", 3] }, { $ifNull: ["$amount", 0] }, 0] } },
            door4Bet: { $sum: { $cond: [{ $eq: ["$doorId", 4] }, { $ifNull: ["$amount", 0] }, 0] } },
            door5Bet: { $sum: { $cond: [{ $eq: ["$doorId", 5] }, { $ifNull: ["$amount", 0] }, 0] } },
            betCount: { $sum: 1 },
            lastBetAt: { $max: "$createdAt" }
          }
        },
        { $sort: { totalBet: -1, lastBetAt: -1, "_id.nickname": 1 } },
        { $limit: 500 }
      ])
    : [];

  const doorTotals = normalizeDoorTotals(
    XOCDIA_DOOR_LABELS.map((_, idx) =>
      grouped.reduce((sum, row) => sum + toSafeAmount(row && row[`door${idx}Bet`]), 0)
    ),
    XOCDIA_DOOR_LABELS
  );

  const playerBets = grouped.map((row) => ({
    userId: row && row._id && row._id.userId ? String(row._id.userId) : "",
    nickname: String(row && row._id && row._id.nickname ? row._id.nickname : ""),
    totalBet: toSafeAmount(row && row.totalBet),
    betCount: toSafeInt(row && row.betCount, 0),
    lastBetTime: formatTimestamp(row && row.lastBetAt),
    doorBets: mapXocDiaDoorBets(row)
  }));

  return {
    sessionInfo: {
      referenceId,
      roomId,
      sessionTime: formatTimestamp(session && (session.startedAt || session.createdAt)),
      phase: String((snapshot && snapshot.phase) || (session && session.phase) || ""),
      remainTime: toSafeInt(snapshot && snapshot.remainTime, session ? session.remainTime : 0),
      result: formatXocDiaResultText(session && session.diceIds),
      doorTotals,
      totalBet: sumDoorTotals(doorTotals)
    },
    playerBets
  };
}
async function buildMiniPokerControlDetails(snapshot) {
  const recent = await MiniPokerSpin.find({})
    .sort({ createdAt: -1, _id: -1 })
    .limit(200)
    .lean();

  const latest = recent.length > 0 ? recent[0] : null;
  const roomTotals = [0, 0, 0];
  const playerMap = new Map();

  for (const spin of recent) {
    const room = Math.max(0, Math.min(2, toSafeInt(spin && spin.room, 0)));
    const betValue = toSafeAmount(spin && spin.betValue);
    roomTotals[room] += betValue;

    const key = `${spin && spin.userId ? String(spin.userId) : ""}::${String(spin && spin.nickname ? spin.nickname : "")}`;
    if (!playerMap.has(key)) {
      playerMap.set(key, {
        userId: spin && spin.userId ? String(spin.userId) : "",
        nickname: String(spin && spin.nickname ? spin.nickname : ""),
        totalBet: 0,
        betCount: 0,
        lastBetAt: null,
        roomBets: [0, 0, 0]
      });
    }
    const row = playerMap.get(key);
    row.totalBet += betValue;
    row.betCount += 1;
    row.roomBets[room] += betValue;
    if (!row.lastBetAt || (spin && spin.createdAt && new Date(spin.createdAt).getTime() > new Date(row.lastBetAt).getTime())) {
      row.lastBetAt = spin ? spin.createdAt : null;
    }
  }

  const playerBets = [...playerMap.values()]
    .sort((a, b) => {
      const diff = toSafeAmount(b.totalBet) - toSafeAmount(a.totalBet);
      if (diff !== 0) return diff;
      return String(a.nickname || "").localeCompare(String(b.nickname || ""));
    })
    .map((row) => ({
      userId: row.userId,
      nickname: row.nickname,
      totalBet: toSafeAmount(row.totalBet),
      betCount: toSafeInt(row.betCount, 0),
      lastBetTime: formatTimestamp(row.lastBetAt),
      doorBets: [
        { doorId: 0, label: "Room 1", totalBet: toSafeAmount(row.roomBets[0]) },
        { doorId: 1, label: "Room 2", totalBet: toSafeAmount(row.roomBets[1]) },
        { doorId: 2, label: "Room 3", totalBet: toSafeAmount(row.roomBets[2]) }
      ]
    }));

  const doorTotals = [
    { doorId: 0, label: "Room 1", totalBet: toSafeAmount(roomTotals[0]) },
    { doorId: 1, label: "Room 2", totalBet: toSafeAmount(roomTotals[1]) },
    { doorId: 2, label: "Room 3", totalBet: toSafeAmount(roomTotals[2]) }
  ];

  return {
    sessionInfo: {
      referenceId: latest ? String(latest._id || "") : "",
      sessionTime: formatTimestamp(latest && latest.createdAt),
      phase: "rolling",
      remainTime: 0,
      result: latest ? `Result ${toSafeInt(latest.result, 10)} | Prize ${toSafeAmount(latest.prize)}` : "Chua co du lieu",
      doorTotals,
      totalBet: sumDoorTotals(doorTotals),
      scope: "last_200_spins"
    },
    playerBets
  };
}

async function buildControlDetails(gameKey, snapshot) {
  if (!snapshot || typeof snapshot !== "object") {
    return {
      sessionInfo: {
        referenceId: 0,
        sessionTime: "",
        phase: "",
        remainTime: 0,
        result: "Chua co du lieu",
        doorTotals: [],
        totalBet: 0
      },
      playerBets: []
    };
  }

  if (gameKey === "double" || gameKey === "md5") {
    return buildDoubleMd5ControlDetails(gameKey, snapshot);
  }
  if (gameKey === "baucua") {
    return buildBauCuaControlDetails(snapshot);
  }
  if (gameKey === "xocdia") {
    return buildXocDiaControlDetails(snapshot);
  }
  if (gameKey === "minipoker") {
    return buildMiniPokerControlDetails(snapshot);
  }

  return {
    sessionInfo: {
      referenceId: toSafeInt(snapshot.referenceId, 0),
      sessionTime: "",
      phase: String(snapshot.phase || ""),
      remainTime: toSafeInt(snapshot.remainTime, 0),
      result: "Khong ho tro",
      doorTotals: [],
      totalBet: 0
    },
    playerBets: []
  };
}
function normalizeWebRoot(webRoot) {
  const root = String(webRoot || "").trim();
  if (!root) return "";
  return path.resolve(root);
}

function parseRequestOrigin(req) {
  const forwardedProto = String(req.headers["x-forwarded-proto"] || "")
    .split(",")[0]
    .trim()
    .toLowerCase();
  const secure = forwardedProto ? forwardedProto === "https" : req.protocol === "https";

  let host = req.hostname || "localhost";
  let port = secure ? 443 : 80;

  const hostHeader = String(req.headers.host || "").trim();
  if (hostHeader) {
    try {
      const parsed = new URL(`${secure ? "https" : "http"}://${hostHeader}`);
      if (parsed.hostname) host = parsed.hostname;
      if (parsed.port) {
        const parsedPort = toInt(parsed.port, port);
        if (Number.isFinite(parsedPort) && parsedPort > 0) {
          port = parsedPort;
        }
      }
    } catch (_error) {
      // ignore malformed host header
    }
  }

  if ((!Number.isFinite(port) || port <= 0) && req.socket && req.socket.localPort) {
    const socketPort = Number(req.socket.localPort);
    if (Number.isFinite(socketPort) && socketPort > 0) {
      port = socketPort;
    }
  }

  if (!Number.isFinite(port) || port <= 0) {
    port = secure ? 443 : 80;
  }

  return { host, port, secure };
}

function normalizeOptionalString(value) {
  return String(value || "").trim();
}

function buildPublicClientTarget(req, publicClientConfig) {
  const origin = parseRequestOrigin(req);
  const config = publicClientConfig && typeof publicClientConfig === "object" ? publicClientConfig : {};

  const wsHost = normalizeOptionalString(config.wsHost || config.host) || origin.host;
  const wsPort = toInt(config.wsPort != null ? config.wsPort : config.port, origin.port);
  const wsSecure = typeof config.wsSecure === "boolean" ? config.wsSecure : origin.secure;
  const apiHost = normalizeOptionalString(config.apiHost || config.host || wsHost) || origin.host;
  const apiPort = toInt(config.apiPort != null ? config.apiPort : config.port, wsPort);
  const apiSecure = typeof config.apiSecure === "boolean" ? config.apiSecure : wsSecure;
  const apiPathRaw = normalizeOptionalString(config.apiPath || "/api") || "/api";
  const apiPath = apiPathRaw.startsWith("/") ? apiPathRaw : `/${apiPathRaw}`;

  return { wsHost, wsPort, wsSecure, apiHost, apiPort, apiSecure, apiPath };
}

function hasEndpointQuery(req) {
  const query = req && req.query ? req.query : {};
  return !!(query.wsHost || query.wsPort || query.wsSecure || query.apiHost || query.apiPort || query.apiSecure || query.apiPath);
}

function buildRouteRedirectUrl(req, game, publicClientConfig) {
  const params = new URLSearchParams();

  const originalUrl = String(req.originalUrl || req.url || "");
  const qIndex = originalUrl.indexOf("?");
  if (qIndex >= 0 && qIndex < originalUrl.length - 1) {
    const rawQuery = originalUrl.slice(qIndex + 1);
    const rawParams = new URLSearchParams(rawQuery);
    rawParams.forEach((value, key) => {
      if (key) params.set(key, value);
    });
  }

  const source = req.query || {};
  Object.keys(source).forEach((key) => {
    if (params.has(key)) return;
    const value = source[key];
    if (Array.isArray(value)) {
      if (value.length > 0) {
        params.set(key, String(value[0]));
      }
    } else if (value != null) {
      params.set(key, String(value));
    }
  });

  const normalizedGame = String(game || params.get("game") || "").trim().toLowerCase();
  if (normalizedGame) {
    params.set("game", normalizedGame);
  }

  const ordered = new URLSearchParams();
  if (params.has("game")) ordered.set("game", String(params.get("game") || ""));
  if (params.has("token")) ordered.set("token", String(params.get("token") || ""));
  if (params.has("accessToken")) ordered.set("accessToken", String(params.get("accessToken") || ""));
  if (params.has("at")) ordered.set("at", String(params.get("at") || ""));

  params.forEach((value, key) => {
    if (!ordered.has(key)) {
      ordered.set(key, value);
    }
  });

  return `/?${ordered.toString()}`;
}

function sendHtmlIfExists(res, filePath) {
  if (!filePath) return false;
  if (!fs.existsSync(filePath)) return false;
  res.set("Cache-Control", "no-store");
  res.sendFile(filePath);
  return true;
}

function mountWebClient(app, webRoot, publicClientConfig) {
  if (!webRoot || !fs.existsSync(webRoot)) {
    return false;
  }

  const root = path.resolve(webRoot);
  const rootIndex = path.resolve(root, "index.html");
  const hasRootIndex = fs.existsSync(rootIndex);

  const sendEntryIfExists = (res, relativePath) => {
    const abs = path.resolve(root, relativePath);
    if (!abs.startsWith(root)) return false;
    return sendHtmlIfExists(res, abs);
  };

  const handleGameRoute = (game, relativeEntryPath) => (req, res) => {
    if (sendEntryIfExists(res, relativeEntryPath)) return;
    if (hasRootIndex) {
      res.redirect(buildRouteRedirectUrl(req, game, publicClientConfig));
      return;
    }
    res.status(404).send("Web client build not found.");
  };


  app.get(["/", "/index.html"], (req, res) => {
    const requestedGame = normalizeControlGameKey(req && req.query ? req.query.game : "");
    if (sendHtmlIfExists(res, rootIndex)) return;
    res.status(404).send("Web client build not found.");
  });

  app.get(["/dev", "/dev/"], (req, res) => {
    if (sendEntryIfExists(res, "dev/index.html")) return;
    if (hasRootIndex) {
      res.redirect(buildRouteRedirectUrl(req, "double", publicClientConfig));
      return;
    }
    res.status(404).send("Web client build not found.");
  });

  app.get(["/taixiudouble", "/taixiudouble/"], handleGameRoute("double", "taixiudouble/index.html"));
  app.get(["/taixiumd5", "/taixiumd5/"], handleGameRoute("md5", "taixiumd5/index.html"));
  app.get(["/minipoker", "/minipoker/"], handleGameRoute("minipoker", "minipoker/index.html"));
  app.get(["/baucua", "/baucua/"], handleGameRoute("baucua", "baucua/index.html"));
  app.get(["/xocdia", "/xocdia/"], handleGameRoute("xocdia", "xocdia/index.html"));

  app.use(express.static(root, {
    index: false,
    etag: false,
    maxAge: 0,
    redirect: false
  }));
  app.get("/__whoami", (_req, res) => {
    res.json({
      ok: true,
      service: "taixiu-backend",
      webRoot: root,
      routes: ["/", "/dev", "/taixiudouble", "/taixiumd5", "/minipoker", "/baucua", "/xocdia", "/health"]
    });
  });

  return true;
}

function createHttpApp(options = {}) {
  const app = express();
  app.set("trust proxy", true);

  const webRoot = normalizeWebRoot(options.webRoot);
  const enableWebClient = options.enableWebClient !== false;
  const publicClientConfig = options.publicClientConfig && typeof options.publicClientConfig === "object"
    ? options.publicClientConfig
    : {};
  app.locals.webClient = {
    enabled: false,
    root: webRoot
  };

  const engines = options.engines && typeof options.engines === "object" ? options.engines : {};
  const readControlSnapshot = (gameKey) => {
    const normalizedKey = normalizeControlGameKey(gameKey);
    if (!normalizedKey) return null;
    const engine = engines[normalizedKey];
    if (!engine || typeof engine.getControlSnapshot !== "function") return null;
    return engine.getControlSnapshot();
  };

  app.use(cors());
  app.use(express.json({ limit: "1mb" }));

  app.get("/health", async (_req, res) => {
    res.json({
      ok: true,
      time: new Date().toISOString()
    });
  });

  app.get("/api/admin/taixiu/control", async (_req, res) => {
    const data = {};
    for (const gameKey of CONTROL_GAME_KEYS) {
      try {
        data[gameKey] = readControlSnapshot(gameKey);
      } catch (error) {
        data[gameKey] = { game: gameKey, error: error.message };
      }
    }
    res.json({ success: true, data });
  });

  app.get("/api/admin/taixiu/control/:game", async (req, res) => {
    const gameKey = normalizeControlGameKey(req.params.game);
    if (!gameKey) {
      res.status(400).json({ success: false, message: "invalid game" });
      return;
    }
    const engine = engines[gameKey];
    if (!engine || typeof engine.getControlSnapshot !== "function") {
      res.status(404).json({ success: false, message: `engine not ready for ${gameKey}` });
      return;
    }
    try {
      const snapshot = engine.getControlSnapshot();
      const details = await buildControlDetails(gameKey, snapshot);
      const data = {
        ...snapshot,
        sessionInfo: details && details.sessionInfo ? details.sessionInfo : null,
        playerBets: Array.isArray(details && details.playerBets) ? details.playerBets : []
      };
      res.json({ success: true, data });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.post("/api/admin/taixiu/control/:game/force", async (req, res) => {
    const gameKey = normalizeControlGameKey(req.params.game);
    if (!gameKey) {
      res.status(400).json({ success: false, message: "invalid game" });
      return;
    }
    const engine = engines[gameKey];
    if (!engine || typeof engine.setForcedNextResult !== "function") {
      res.status(400).json({ success: false, message: `game ${gameKey} does not support forced next result` });
      return;
    }
    try {
      const data = engine.setForcedNextResult(req.body || {});
      res.json({ success: true, data });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  });

  app.post("/api/admin/taixiu/control/:game/clear", async (req, res) => {
    const gameKey = normalizeControlGameKey(req.params.game);
    if (!gameKey) {
      res.status(400).json({ success: false, message: "invalid game" });
      return;
    }
    const engine = engines[gameKey];
    if (!engine || typeof engine.clearForcedNextResult !== "function") {
      res.status(400).json({ success: false, message: `game ${gameKey} does not support clear forced result` });
      return;
    }
    try {
      const data = engine.clearForcedNextResult(req.body || {});
      res.json({ success: true, data });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  });

  app.get("/api/admin/taixiu/minipoker/rates", async (_req, res) => {
    const engine = engines.minipoker;
    if (!engine || typeof engine.getControlSnapshot !== "function") {
      res.status(404).json({ success: false, message: "minipoker engine not ready" });
      return;
    }
    try {
      const data = engine.getControlSnapshot();
      res.json({ success: true, data });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.post("/api/admin/taixiu/minipoker/rates", async (req, res) => {
    const engine = engines.minipoker;
    if (!engine || typeof engine.setControlRates !== "function") {
      res.status(404).json({ success: false, message: "minipoker engine not ready" });
      return;
    }
    try {
      const data = engine.setControlRates(req.body || {});
      res.json({ success: true, data });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  });

  app.get("/api/dev/users", async (_req, res) => {
    const users = await User.find({}, { nickname: 1, coin: 1, vipPoint: 1, userType: 1, updatedAt: 1 })
      .sort({ updatedAt: -1 })
      .limit(200)
      .lean();
    res.json({
      ok: true,
      count: users.length,
      items: users
    });
  });

  app.post("/api/dev/users/credit", async (req, res) => {
    const nickname = String(req.body?.nickname || "").trim();
    const amount = Number(req.body?.amount || 0);
    if (!nickname || !Number.isFinite(amount) || amount === 0) {
      res.status(400).json({ ok: false, message: "nickname and amount are required" });
      return;
    }
    const user = await userService.creditByNickname(nickname, amount);
    if (!user) {
      res.status(404).json({ ok: false, message: "User not found" });
      return;
    }
    res.json({
      ok: true,
      item: {
        nickname: user.nickname,
        coin: user.coin
      }
    });
  });

  app.get("/api/dev/sessions", async (req, res) => {
    const game = String(req.query.game || "double").toLowerCase();
    const limit = Math.max(1, Math.min(Number(req.query.limit || 20), 200));
    if (!["double", "md5", "baucua", "minipoker", "xocdia"].includes(game)) {
      res.status(400).json({ ok: false, message: "game must be double, md5, baucua, minipoker or xocdia" });
      return;
    }

    let sessions = [];
    if (game === "baucua") {
      sessions = await BauCuaSession.find({
        dice1: { $ne: null },
        dice2: { $ne: null },
        dice3: { $ne: null }
      })
        .sort({ referenceId: -1 })
        .limit(limit)
        .lean();
    } else if (game === "minipoker") {
      sessions = await MiniPokerSpin.find({})
        .sort({ createdAt: -1, _id: -1 })
        .limit(limit)
        .lean();
    } else if (game === "xocdia") {
      sessions = await XocDiaSession.find({})
        .sort({ referenceId: -1 })
        .limit(limit)
        .lean();
    } else {
      sessions = await GameSession.find({ gameKey: game })
        .sort({ referenceId: -1 })
        .limit(limit)
        .lean();
    }

    res.json({
      ok: true,
      count: sessions.length,
      items: sessions
    });
  });

  app.get("/api", async (req, res) => {
    const c = toInt(req.query.c, 0);

    if (c === 199) {
      const token = String(req.query.token || req.query.at || req.query.accessToken || "").trim();
      const nickname = String(req.query.nickname || req.query.un || req.query.username || "").trim();

      if (!token) {
        res.status(400).json({
          success: false,
          message: "token is required"
        });
        return;
      }

      try {
        const result = await userService.findOrCreateUserByToken({
          nickname,
          accessToken: token,
          defaultCoin: 1000000000
        });

        if (!result || !result.user) {
          res.status(401).json({
            success: false,
            message: "invalid token"
          });
          return;
        }

        res.json({
          success: true,
          profile: {
            nickname: String(result.user.nickname || ""),
            accessToken: token,
            coin: Math.max(0, Math.floor(result.user.coin || 0)),
            userId: Number(result.account && result.account.userId ? result.account.userId : 0)
          }
        });
      } catch (error) {
        const message = error && error.message ? error.message : "token login failed";
        const statusCode = message === "account is locked" ? 403 : 500;
        res.status(statusCode).json({
          success: false,
          message
        });
      }
      return;
    }
    if (c === 100) {
      const requestedPage = Math.max(1, toInt(req.query.p, 1));
      const pageSize = HISTORY_PAGE_SIZE;
      const moneyType = Math.max(1, toInt(req.query.mt, 1));
      const nickname = String(req.query.un || "").trim();
      const gameKey = getGameKeyFromQuery(req.query);

      const filter = { moneyType };
      if (nickname) {
        filter.nickname = nickname;
      }
      if (gameKey) {
        filter.gameKey = gameKey;
      }

      const totalItems = await Bet.countDocuments(filter);
      const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
      const page = Math.min(requestedPage, totalPages);
      const skip = (page - 1) * pageSize;

      const bets = await Bet.find(filter)
        .sort({ createdAt: -1, _id: -1 })
        .skip(skip)
        .limit(pageSize)
        .lean();

      const sessionMap = await loadSessionMapByBets(bets, gameKey || "");
      const transactions = bets.map((bet, index) => {
        const session = sessionMap.get(`${bet.gameKey}:${bet.referenceId}`) || null;
        const totalRefund = bet.status === "refund" ? Math.floor(bet.amount || 0) : 0;
        const totalPrize = Math.floor(bet.payout || 0);
        return {
          index: skip + index + 1,
          referenceId: Number(bet.referenceId || 0),
          timestamp: formatTimestamp(bet.createdAt),
          betSide: Number(bet.door || 0),
          resultPhien: formatResultPhien(session),
          betValue: Math.floor(bet.amount || 0),
          totalRefund,
          totalJp: 0,
          totalPrize
        };
      });

      res.json({
        success: true,
        totalPages,
        transactions
      });
      return;
    }

    if (c === 102) {
      const referenceId = toInt(req.query.rid, 0);
      const moneyType = Math.max(1, toInt(req.query.mt, 1));
      const forcedGameKey = getGameKeyFromQuery(req.query);
      if (referenceId <= 0) {
        res.json({
          success: true,
          resultTX: null,
          transactions: []
        });
        return;
      }

      let session = null;
      if (forcedGameKey) {
        session = await GameSession.findOne({ gameKey: forcedGameKey, referenceId, moneyType }).lean();
      } else {
        session = await GameSession.findOne({ referenceId, moneyType }).sort({ updatedAt: -1 }).lean();
      }

      if (!session) {
        res.json({
          success: true,
          resultTX: null,
          transactions: []
        });
        return;
      }

      const bets = await Bet.find({
        gameKey: session.gameKey,
        referenceId,
        moneyType
      })
        .sort({ createdAt: 1, _id: 1 })
        .limit(1000)
        .lean();

      let totalTai = 0;
      let totalXiu = 0;
      let totalRefundTai = 0;
      let totalRefundXiu = 0;

      const transactions = bets.map((bet) => {
        const betValue = Math.floor(bet.amount || 0);
        const refund = bet.status === "refund" ? betValue : 0;
        if (Number(bet.door) === 1) {
          totalTai += betValue;
          totalRefundTai += refund;
        } else {
          totalXiu += betValue;
          totalRefundXiu += refund;
        }
        return {
          betSide: Number(bet.door || 0),
          inputTime: Math.max(0, Math.floor(bet.remainTimeAtBet || 0)),
          username: String(bet.nickname || ""),
          refund,
          betValue,
          jpAmount: 0
        };
      });

      const dice1 = Number(session.dice1 || 0);
      const dice2 = Number(session.dice2 || 0);
      const dice3 = Number(session.dice3 || 0);
      const totalDice = dice1 + dice2 + dice3;
      const result = session.resultDoor == null ? (totalDice >= 11 ? 1 : 0) : Number(session.resultDoor);

      res.json({
        success: true,
        resultTX: {
          referenceId: Number(session.referenceId || 0),
          timestamp: formatTimestamp(session.resultAt || session.endedAt || session.updatedAt || session.createdAt),
          result,
          dice1,
          dice2,
          dice3,
          totalTai,
          totalXiu,
          totalRefundTai,
          totalRefundXiu
        },
        transactions
      });
      return;
    }

    if (c === 121) {
      const requestedPage = Math.max(1, toInt(req.query.p, 1));
      const pageSize = HISTORY_PAGE_SIZE;
      const nickname = String(req.query.un || "").trim();
      const filter = {};
      if (nickname) {
        filter.nickname = nickname;
      }

      const totalItems = await BauCuaBet.countDocuments(filter);
      const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
      const page = Math.min(requestedPage, totalPages);
      const skip = (page - 1) * pageSize;

      const bets = await BauCuaBet.find(filter)
        .sort({ createdAt: -1, _id: -1 })
        .skip(skip)
        .limit(pageSize)
        .lean();

      const refs = [...new Set(bets.map((item) => Number(item.referenceId || 0)).filter((item) => item > 0))];
      const sessions = refs.length
        ? await BauCuaSession.find({ referenceId: { $in: refs } }, { referenceId: 1, dice1: 1, dice2: 1, dice3: 1, xPot: 1, xValue: 1 }).lean()
        : [];
      const sessionMap = new Map();
      for (const session of sessions) {
        sessionMap.set(Number(session.referenceId), session);
      }

      const transactions = bets.map((item, index) => {
        const session = sessionMap.get(Number(item.referenceId || 0)) || null;
        const betValues = normalizeBauCuaValues(item.betValues);
        const prizes = calcBauCuaPrizeArray(betValues, session);
        const dices = session && session.dice1 != null
          ? `${toInt(session.dice1, 0)},${toInt(session.dice2, 0)},${toInt(session.dice3, 0)}`
          : "0,1,2";
        return {
          index: skip + index + 1,
          referenceId: Number(item.referenceId || 0),
          timestamp: formatTimestamp(item.createdAt),
          betValues,
          prizes,
          dices
        };
      });

      res.json({
        success: true,
        totalPages,
        transactions
      });
      return;
    }

    if (c === 140) {
      const requestedPage = Math.max(1, toInt(req.query.p, 1));
      const pageSize = HISTORY_PAGE_SIZE;
      const nickname = String(req.query.un || "").trim();
      const filter = {};
      if (nickname) {
        filter.nickname = nickname;
      }

      const totalItems = await XocDiaBet.countDocuments(filter);
      const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
      const page = Math.min(requestedPage, totalPages);
      const skip = (page - 1) * pageSize;

      const rows = await XocDiaBet.find(filter)
        .sort({ createdAt: -1, _id: -1 })
        .skip(skip)
        .limit(pageSize)
        .lean();

      const transactions = rows.map((item, index) => ({
        index: skip + index + 1,
        transId: `${item.referenceId || 0}-${String(item._id || "").slice(-6)}`,
        transactionTime: formatTimestamp(item.settledAt || item.createdAt),
        moneyExchange: Math.floor(item.netExchange || 0),
        currentMoney: Math.floor(item.currentMoney || 0),
        description: JSON.stringify({
          roomID: `#${Math.floor(item.roomId || 0)}`,
          doorId: Math.floor(item.doorId || 0),
          amount: Math.floor(item.amount || 0),
          payout: Math.floor(item.payout || 0)
        })
      }));

      res.json({
        success: true,
        totalPages,
        transactions
      });
      return;
    }

    if (c === 120) {
      const rows = await BauCuaBet.aggregate([
        { $match: { prize: { $gt: 0 } } },
        {
          $group: {
            _id: "$nickname",
            money: { $sum: "$prize" }
          }
        },
        { $sort: { money: -1, _id: 1 } },
        { $limit: 10 }
      ]);

      res.json({
        success: true,
        topBC: rows.map((row) => ({
          username: String(row._id || ""),
          money: Math.floor(row.money || 0)
        }))
      });
      return;
    }

    if (c === 105) {
      const requestedPage = Math.max(1, toInt(req.query.p, 1));
      const pageSize = HISTORY_PAGE_SIZE;
      const nickname = String(req.query.un || "").trim();
      const filter = {};
      if (nickname) {
        filter.nickname = nickname;
      }

      const totalItems = await MiniPokerSpin.countDocuments(filter);
      const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
      const page = Math.min(requestedPage, totalPages);
      const skip = (page - 1) * pageSize;

      const rows = await MiniPokerSpin.find(filter)
        .sort({ createdAt: -1, _id: -1 })
        .skip(skip)
        .limit(pageSize)
        .lean();

      res.json({
        success: true,
        totalPages,
        results: rows.map((row) => ({
          timestamp: formatTimestamp(row.createdAt),
          betValue: Math.floor(row.betValue || 0),
          cards: Array.isArray(row.cards) ? row.cards.join(",") : "",
          prize: Math.floor(row.prize || 0)
        }))
      });
      return;
    }

    if (c === 106) {
      const requestedPage = Math.max(1, toInt(req.query.p, 1));
      const pageSize = HISTORY_PAGE_SIZE;
      const filter = { prize: { $gt: 0 } };

      const totalItems = await MiniPokerSpin.countDocuments(filter);
      const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
      const page = Math.min(requestedPage, totalPages);
      const skip = (page - 1) * pageSize;

      const rows = await MiniPokerSpin.find(filter)
        .sort({ prize: -1, createdAt: -1, _id: -1 })
        .skip(skip)
        .limit(pageSize)
        .lean();

      res.json({
        success: true,
        totalPages,
        results: rows.map((row) => ({
          ts: formatTimestamp(row.createdAt),
          un: String(row.nickname || ""),
          bv: Math.floor(row.betValue || 0),
          pz: Math.floor(row.prize || 0)
        }))
      });
      return;
    }

    res.status(404).json({
      code: "1-11",
      msg: "Invalid url."
    });
  });

  if (enableWebClient) {
    const mounted = mountWebClient(app, webRoot, publicClientConfig);
    app.locals.webClient = {
      enabled: mounted,
      root: webRoot
    };
  }

  return app;
}

module.exports = {
  createHttpApp
};















