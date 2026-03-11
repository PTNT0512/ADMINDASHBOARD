"use strict";

const BinaryReader = require("../protocol/binary-reader");
const BinaryWriter = require("../protocol/binary-writer");
const MiniPokerSpin = require("../db/models/MiniPokerSpin");
const userService = require("./user-service");
const { randInt } = require("../utils/random");

const ROOM_COUNT = 3;
const BASE_JACKPOTS = [5000000, 50000000, 500000000];

const MINIPOKER_WIN_RESULT_POOL = [
  { type: 2, weight: 6 },
  { type: 3, weight: 17 },
  { type: 4, weight: 35 },
  { type: 5, weight: 80 },
  { type: 6, weight: 160 },
  { type: 7, weight: 450 },
  { type: 8, weight: 850 },
  { type: 9, weight: 1600 }
];

const MINIPOKER_LOSE_RESULT_POOL = [
  { type: 10, weight: 5700 },
  { type: 11, weight: 1100 }
];

function clampRoom(value) {
  const room = Number(value);
  if (!Number.isFinite(room)) return 0;
  return Math.max(0, Math.min(ROOM_COUNT - 1, Math.trunc(room)));
}

function safeInt(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

function safeNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function clampPercent(value, fallback = 0) {
  const n = safeNumber(value, fallback);
  if (n < 0) return 0;
  if (n > 100) return 100;
  return Math.round(n * 10000) / 10000;
}

function pickWeightedResult(pool, fallback = 10) {
  if (!Array.isArray(pool) || pool.length === 0) {
    return fallback;
  }
  let total = 0;
  for (const item of pool) {
    total += Math.max(0, safeInt(item.weight, 0));
  }
  if (total <= 0) return fallback;

  let roll = randInt(1, total);
  for (const item of pool) {
    const weight = Math.max(0, safeInt(item.weight, 0));
    if (weight <= 0) continue;
    roll -= weight;
    if (roll <= 0) {
      return safeInt(item.type, fallback);
    }
  }
  return fallback;
}

function shuffle(items) {
  const arr = items.slice();
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = randInt(0, i);
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
  return arr;
}

function makeUniqueRanks(excludes = [], count = 1, min = 1, max = 13) {
  const used = new Set(excludes.map((v) => safeInt(v, 0)));
  const out = [];
  while (out.length < count) {
    const v = randInt(min, max);
    if (used.has(v)) continue;
    used.add(v);
    out.push(v);
  }
  return out;
}

function makeCardsForResult(resultType) {
  // 1: jackpot, 2: thung pha sanh, 3: tu quy, 4: cu lu, 5: thung, 6: sanh, 7: sam, 8: hai doi, 9: doi J+, 10: khong an, 11: doi thuong
  switch (resultType) {
    case 1: {
      const rank = randInt(1, 13);
      return [rank, rank, rank, rank, rank];
    }
    case 2:
    case 6: {
      const start = randInt(1, 9);
      return shuffle([start, start + 1, start + 2, start + 3, start + 4]);
    }
    case 3: {
      const rank4 = randInt(1, 13);
      const kicker = makeUniqueRanks([rank4], 1)[0];
      return shuffle([rank4, rank4, rank4, rank4, kicker]);
    }
    case 4: {
      const rank3 = randInt(1, 13);
      const rank2 = makeUniqueRanks([rank3], 1)[0];
      return shuffle([rank3, rank3, rank3, rank2, rank2]);
    }
    case 5: {
      return shuffle(makeUniqueRanks([], 5));
    }
    case 7: {
      const rank3 = randInt(1, 13);
      const kickers = makeUniqueRanks([rank3], 2);
      return shuffle([rank3, rank3, rank3, kickers[0], kickers[1]]);
    }
    case 8: {
      const p1 = randInt(1, 13);
      const p2 = makeUniqueRanks([p1], 1)[0];
      const kicker = makeUniqueRanks([p1, p2], 1)[0];
      return shuffle([p1, p1, p2, p2, kicker]);
    }
    case 9: {
      const pairRank = randInt(11, 13);
      const kickers = makeUniqueRanks([pairRank], 3);
      return shuffle([pairRank, pairRank, kickers[0], kickers[1], kickers[2]]);
    }
    case 11: {
      const pairRank = randInt(1, 10);
      const kickers = makeUniqueRanks([pairRank], 3);
      return shuffle([pairRank, pairRank, kickers[0], kickers[1], kickers[2]]);
    }
    case 10:
    default: {
      let cards = makeUniqueRanks([], 5);
      cards = shuffle(cards);
      // avoid accidental straight
      const sorted = cards.slice().sort((a, b) => a - b);
      const isStraight = sorted[4] - sorted[0] === 4 && new Set(sorted).size === 5;
      if (isStraight) {
        cards[0] = 13;
      }
      return cards;
    }
  }
}

class MiniPokerEngine {
  constructor(options = {}) {
    this.cmd = options.cmd;
    this.clients = new Set();
    this.clientRooms = new Map(); // client.id -> room index
    this.tickTimer = null;
    this.historyLimit = Math.max(10, safeInt(options.historyLimit, 100));
    this.jackpotByRoom = BASE_JACKPOTS.slice(0, ROOM_COUNT);
    this.jackpotRatePercent = clampPercent(options.jackpotRatePercent, 0.02);
    this.winRatePercent = clampPercent(options.winRatePercent, 43);
    if (this.winRatePercent < this.jackpotRatePercent) {
      this.winRatePercent = this.jackpotRatePercent;
    }
  }

  async init() {
    const topWin = await MiniPokerSpin.findOne({ result: 1 }).sort({ createdAt: -1 }).lean();
    if (topWin && Number.isFinite(topWin.room) && topWin.room >= 0 && topWin.room < ROOM_COUNT) {
      this.jackpotByRoom[topWin.room] = Math.max(BASE_JACKPOTS[topWin.room], safeInt(topWin.prize, BASE_JACKPOTS[topWin.room]));
    }
  }

  start() {
    if (this.tickTimer) return;
    this.tickTimer = setInterval(() => {
      this._tickJackpots();
    }, 1000);
  }

  stop() {
    if (!this.tickTimer) return;
    clearInterval(this.tickTimer);
    this.tickTimer = null;
  }

  detachClient(client) {
    this.clients.delete(client);
    if (client && client.id) {
      this.clientRooms.delete(client.id);
    }
  }

  async handleSubscribe(client, payload) {
    let room = 0;
    try {
      const reader = new BinaryReader(payload);
      if (reader.remaining() > 0) {
        room = clampRoom(reader.readByte());
      }
    } catch (_error) {
      room = 0;
    }
    this.clients.add(client);
    this.clientRooms.set(client.id, room);
    this._sendJackpot(client, room);
  }

  handleUnsubscribe(client) {
    this.clients.delete(client);
  }

  handleChangeRoom(client, payload) {
    let room = 0;
    try {
      const reader = new BinaryReader(payload);
      if (reader.remaining() > 0) {
        reader.readByte(); // old room
      }
      if (reader.remaining() > 0) {
        room = clampRoom(reader.readByte());
      }
    } catch (_error) {
      room = 0;
    }
    this.clientRooms.set(client.id, room);
    this._sendJackpot(client, room);
  }

  async handleSpin(client, payload) {
    const currentCoin = client.user ? Math.floor(client.user.coin || 0) : 0;
    if (!client.user) {
      this._sendSpin(client, 100, 0, makeCardsForResult(10), currentCoin);
      return;
    }

    let betValue = 0;
    try {
      const reader = new BinaryReader(payload);
      betValue = safeInt(reader.readLong(), 0);
      if (reader.remaining() > 0) {
        reader.readShort(); // moneyType
      }
    } catch (_error) {
      this._sendSpin(client, 100, 0, makeCardsForResult(10), currentCoin);
      return;
    }

    if (betValue <= 0) {
      this._sendSpin(client, 100, 0, makeCardsForResult(10), currentCoin);
      return;
    }

    const room = this._getRoom(client);
    const updatedUser = await userService.tryDebit(client.user._id, betValue);
    if (!updatedUser) {
      this._sendSpin(client, 102, 0, makeCardsForResult(10), currentCoin);
      return;
    }
    client.user.coin = Math.floor(updatedUser.coin || 0);
    this.jackpotByRoom[room] += Math.max(100, Math.floor(betValue * 0.02));

    const resultType = this._rollResultType();
    const cards = makeCardsForResult(resultType);
    let prize = this._calculatePrize(resultType, betValue, room);

    if (prize > 0) {
      const credited = await userService.credit(client.user._id, prize);
      if (credited) {
        client.user.coin = Math.floor(credited.coin || 0);
      }
    }

    await MiniPokerSpin.create({
      userId: client.user._id,
      nickname: client.user.nickname,
      room,
      betValue,
      result: resultType,
      prize,
      cards,
      currentMoney: client.user.coin
    });

    this._sendSpin(client, resultType, prize, cards, client.user.coin);
    this._broadcastJackpot(room);
  }

  _tickJackpots() {
    for (let room = 0; room < ROOM_COUNT; room += 1) {
      this.jackpotByRoom[room] += randInt(1000, 20000);
      this._broadcastJackpot(room);
    }
  }

  _rollResultType() {
    const jackpotChance = clampPercent(this.jackpotRatePercent, 0) / 100;
    const winChance = Math.max(jackpotChance, clampPercent(this.winRatePercent, 0) / 100);
    const roll = Math.random();

    if (roll < jackpotChance) {
      return 1;
    }
    if (roll < winChance) {
      return pickWeightedResult(MINIPOKER_WIN_RESULT_POOL, 9);
    }
    return pickWeightedResult(MINIPOKER_LOSE_RESULT_POOL, 10);
  }

  setControlRates(payload = {}) {
    const jackpotRatePercent = clampPercent(payload.jackpotRatePercent, this.jackpotRatePercent);
    const winRatePercent = clampPercent(payload.winRatePercent, this.winRatePercent);
    if (winRatePercent < jackpotRatePercent) {
      throw new Error("winRatePercent must be >= jackpotRatePercent");
    }
    this.jackpotRatePercent = jackpotRatePercent;
    this.winRatePercent = winRatePercent;
    return this.getControlSnapshot();
  }

  getControlSnapshot() {
    return {
      game: "minipoker",
      jackpotRatePercent: Number(this.jackpotRatePercent || 0),
      winRatePercent: Number(this.winRatePercent || 0),
      jackpots: this.jackpotByRoom.slice(0, ROOM_COUNT).map((item) => Math.max(0, safeInt(item, 0)))
    };
  }

  _calculatePrize(resultType, betValue, room) {
    switch (resultType) {
      case 1: {
        const jackpot = this.jackpotByRoom[room];
        this.jackpotByRoom[room] = BASE_JACKPOTS[room];
        return jackpot;
      }
      case 2:
        return betValue * 250;
      case 3:
        return betValue * 100;
      case 4:
        return betValue * 40;
      case 5:
        return betValue * 20;
      case 6:
        return betValue * 12;
      case 7:
        return betValue * 6;
      case 8:
        return betValue * 3;
      case 9:
        return betValue * 2;
      case 11:
        return 0;
      case 10:
      default:
        return 0;
    }
  }

  _sendSpin(client, result, prize, cards, currentMoney) {
    const writer = new BinaryWriter();
    writer.writeShort(result);
    writer.writeLong(prize);
    writer.writeByte(cards[0] || 1);
    writer.writeByte(cards[1] || 1);
    writer.writeByte(cards[2] || 1);
    writer.writeByte(cards[3] || 1);
    writer.writeByte(cards[4] || 1);
    writer.writeLong(currentMoney);
    client.sendPacket(this.cmd.SPIN, 0, writer.toBuffer());
  }

  _sendJackpot(client, room) {
    const writer = new BinaryWriter();
    writer.writeLong(this.jackpotByRoom[room] || BASE_JACKPOTS[room]);
    writer.writeByte(room === 1 ? 1 : 0);
    client.sendPacket(this.cmd.UPDATE_JACKPOT, 0, writer.toBuffer());
  }

  _broadcastJackpot(room) {
    for (const client of this.clients) {
      if (!client.isOpen()) continue;
      if (this._getRoom(client) !== room) continue;
      this._sendJackpot(client, room);
    }
  }

  _getRoom(client) {
    if (!client || !client.id) return 0;
    return clampRoom(this.clientRooms.get(client.id) || 0);
  }
}

module.exports = MiniPokerEngine;

