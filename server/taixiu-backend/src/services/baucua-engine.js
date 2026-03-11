"use strict";

const BinaryReader = require("../protocol/binary-reader");
const BinaryWriter = require("../protocol/binary-writer");
const BauCuaSession = require("../db/models/BauCuaSession");
const BauCuaBet = require("../db/models/BauCuaBet");
const User = require("../db/models/User");
const userService = require("./user-service");
const { randInt } = require("../utils/random");

const BAUCUA_DOOR_COUNT = 6;
const MAX_BET_PER_REQUEST = 1000000;

function clampRoom(value) {
  const room = Number(value);
  if (!Number.isFinite(room)) return 0;
  return Math.max(0, Math.min(2, Math.trunc(room)));
}

function safeInt(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

function normalizeBetValues(raw) {
  const values = String(raw || "")
    .split(",")
    .map((item) => {
      const n = safeInt(item, 0);
      return n > 0 ? n : 0;
    });
  while (values.length < BAUCUA_DOOR_COUNT) values.push(0);
  if (values.length > BAUCUA_DOOR_COUNT) {
    return values.slice(0, BAUCUA_DOOR_COUNT);
  }
  return values;
}

function sumValues(values) {
  let sum = 0;
  for (const value of values) {
    sum += safeInt(value, 0);
  }
  return sum;
}

function makeDoorCounts(dices) {
  const counts = [0, 0, 0, 0, 0, 0];
  for (const dice of dices || []) {
    if (dice >= 0 && dice < BAUCUA_DOOR_COUNT) {
      counts[dice] += 1;
    }
  }
  return counts;
}

function toCsv(values) {
  return (values || []).map((item) => `${safeInt(item, 0)}`).join(",");
}

class BauCuaEngine {
  constructor(options = {}) {
    this.cmd = options.cmd;
    this.betDurationSec = Math.max(5, safeInt(options.betDurationSec, 40));
    this.resultDurationSec = Math.max(3, safeInt(options.resultDurationSec, 10));
    this.historyLimit = Math.max(10, safeInt(options.historyLimit, 100));
    this.defaultCoin = Math.max(10000, safeInt(options.defaultCoin, 1000000000));

    this.clients = new Set();
    this.clientRooms = new Map(); // client.id -> room
    this.currentUserBets = new Map(); // userId -> [6]
    this.tickTimer = null;
    this.tickLock = false;
    this.histories = [];
    this.state = null;
    this.forcedNextResult = null;
  }

  async init() {
    const historyDocs = await BauCuaSession.find({ dice1: { $ne: null } })
      .sort({ referenceId: -1 })
      .limit(this.historyLimit)
      .lean();
    this.histories = historyDocs.reverse().map((item) => ({
      referenceId: item.referenceId,
      dices: [safeInt(item.dice1, 0), safeInt(item.dice2, 0), safeInt(item.dice3, 0)],
      xPot: safeInt(item.xPot, 0),
      xValue: safeInt(item.xValue, 0)
    }));

    if (!this.histories.length) {
      const seedRef = this._initialReference() - 10;
      const now = Date.now();
      const seedDocs = [];
      for (let i = 0; i < 10; i += 1) {
        const referenceId = seedRef + i;
        const dices = [randInt(0, 5), randInt(0, 5), randInt(0, 5)];
        this.histories.push({
          referenceId,
          dices,
          xPot: 0,
          xValue: 0
        });
        seedDocs.push({
          referenceId,
          phase: "result",
          bettingState: false,
          remainTime: 0,
          potValues: [0, 0, 0, 0, 0, 0],
          dice1: dices[0],
          dice2: dices[1],
          dice3: dices[2],
          xPot: 0,
          xValue: 0,
          startedAt: new Date(now - (10 - i) * 60000),
          resultAt: new Date(now - (10 - i) * 60000 + 30000),
          endedAt: new Date(now - (10 - i) * 60000 + 45000)
        });
      }
      try {
        await BauCuaSession.insertMany(seedDocs, { ordered: false });
      } catch (_error) {
        // Ignore duplicate key errors in case seed docs were inserted previously.
      }
    }

    const latest = await BauCuaSession.findOne().sort({ referenceId: -1 }).lean();
    const nextReference = latest ? latest.referenceId + 1 : this._initialReference();
    this.state = await this._createFreshBettingState(nextReference);
  }

  start() {
    if (this.tickTimer) return;
    this.tickTimer = setInterval(() => {
      void this._safeTick();
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
    console.log(
      `[baucua] subscribe: client=${client.id} room=${room} ref=${this.state ? this.state.referenceId : "n/a"}`
    );
    await this._sendGameInfo(client);
  }

  handleUnsubscribe(client) {
    this.clients.delete(client);
  }

  handleChangeRoom(client, payload) {
    let room = 0;
    try {
      const reader = new BinaryReader(payload);
      if (reader.remaining() > 0) {
        reader.readByte(); // old room (unused)
      }
      if (reader.remaining() > 0) {
        room = clampRoom(reader.readByte());
      }
    } catch (_error) {
      room = 0;
    }
    this.clientRooms.set(client.id, room);
  }

  async handleBet(client, payload) {
    const currentCoin = client.user ? Math.floor(client.user.coin || 0) : 0;
    if (!client.user) {
      this._sendBetAck(client, 100, currentCoin);
      return;
    }

    if (!this.state || !this.state.bettingState || this.state.remainTime <= 0) {
      this._sendBetAck(client, 101, currentCoin);
      return;
    }

    let betValues = [0, 0, 0, 0, 0, 0];
    try {
      const reader = new BinaryReader(payload);
      betValues = normalizeBetValues(reader.readString());
    } catch (_error) {
      this._sendBetAck(client, 100, currentCoin);
      return;
    }

    const totalBet = sumValues(betValues);
    if (totalBet <= 0) {
      this._sendBetAck(client, 100, currentCoin);
      return;
    }
    if (totalBet > MAX_BET_PER_REQUEST) {
      this._sendBetAck(client, 103, currentCoin);
      return;
    }

    const updatedUser = await userService.tryDebit(client.user._id, totalBet);
    if (!updatedUser) {
      this._sendBetAck(client, 102, currentCoin);
      return;
    }
    client.user.coin = Math.floor(updatedUser.coin || 0);

    const userId = String(client.user._id);
    const currentEntry = this._getUserBetEntry(userId);
    for (let i = 0; i < BAUCUA_DOOR_COUNT; i += 1) {
      currentEntry[i] += betValues[i];
      this.state.potValues[i] += betValues[i];
    }
    this.currentUserBets.set(userId, currentEntry);

    await BauCuaBet.create({
      referenceId: this.state.referenceId,
      userId: client.user._id,
      nickname: client.user.nickname,
      room: this._getRoom(client),
      betValues,
      totalBet,
      prize: 0,
      status: "pending"
    });

    this._sendBetAck(client, 1, client.user.coin);
  }

  async _safeTick() {
    if (this.tickLock || !this.state) return;
    this.tickLock = true;
    try {
      await this._tick();
    } catch (error) {
      console.error("[baucua] tick error:", error.message);
    } finally {
      this.tickLock = false;
    }
  }

  async _tick() {
    if (!this.state) return;

    if (this.state.bettingState) {
      this._simulateExternalTraffic();
      this.state.remainTime -= 1;
      if (this.state.remainTime <= 0) {
        await this._transitionToResult();
        return;
      }
      this._persistLiveState();
      this._broadcastUpdate();
      return;
    }

    this.state.remainTime -= 1;
    if (this.state.remainTime <= 0) {
      await this._transitionToNewRound();
      return;
    }
    this._persistLiveState();
    this._broadcastUpdate();
  }

  async _transitionToResult() {
    this.state.phase = "result";
    this.state.bettingState = false;
    this.state.remainTime = this.resultDurationSec;
    const forced = this.forcedNextResult;
    if (forced) {
      this.state.dices = [forced.dice1, forced.dice2, forced.dice3];
      this.state.xPot = forced.xPot;
      this.state.xValue = forced.xValue;
      this.forcedNextResult = null;
    } else {
      this.state.dices = [randInt(0, 5), randInt(0, 5), randInt(0, 5)];

      if (randInt(1, 100) <= 20) {
        this.state.xPot = randInt(0, 5);
        this.state.xValue = randInt(2, 5);
      } else {
        this.state.xPot = 0;
        this.state.xValue = 0;
      }
    }

    const settleMap = await this._settleCurrentRound();

    this.histories.push({
      referenceId: this.state.referenceId,
      dices: this.state.dices.slice(0, 3),
      xPot: this.state.xPot,
      xValue: this.state.xValue
    });
    if (this.histories.length > this.historyLimit) {
      this.histories.splice(0, this.histories.length - this.historyLimit);
    }

    await BauCuaSession.updateOne(
      { _id: this.state.sessionDocId },
      {
        $set: {
          phase: "result",
          bettingState: false,
          remainTime: this.state.remainTime,
          dice1: this.state.dices[0],
          dice2: this.state.dices[1],
          dice3: this.state.dices[2],
          xPot: this.state.xPot,
          xValue: this.state.xValue,
          resultAt: new Date(),
          potValues: this.state.potValues
        }
      }
    );

    console.log(
      `[round][baucua] RESULT #${this.state.referenceId} ` +
        `dices=${this.state.dices.join("-")} xPot=${this.state.xPot} xValue=${this.state.xValue}`
    );

    this._broadcastResult();
    this._broadcastPrizes(settleMap);
    this._broadcastUpdate();
  }

  async _transitionToNewRound() {
    const oldId = this.state.sessionDocId;
    const nextReference = this.state.referenceId + 1;

    if (oldId) {
      await BauCuaSession.updateOne(
        { _id: oldId },
        {
          $set: {
            endedAt: new Date(),
            remainTime: 0
          }
        }
      );
    }

    this.currentUserBets.clear();
    this.state = await this._createFreshBettingState(nextReference);
    this._broadcastNewRound();
    this._broadcastUpdate();
  }

  async _createFreshBettingState(referenceId) {
    const potValues = [];
    for (let i = 0; i < BAUCUA_DOOR_COUNT; i += 1) {
      potValues.push(randInt(3000000, 12000000));
    }

    const created = await BauCuaSession.create({
      referenceId,
      phase: "betting",
      bettingState: true,
      remainTime: this.betDurationSec,
      potValues,
      xPot: 0,
      xValue: 0,
      startedAt: new Date()
    });

    console.log(`[round][baucua] START #${referenceId} bet=${this.betDurationSec}s result=${this.resultDurationSec}s`);

    return {
      sessionDocId: created._id,
      referenceId,
      phase: "betting",
      bettingState: true,
      remainTime: this.betDurationSec,
      potValues,
      dices: [0, 0, 0],
      xPot: 0,
      xValue: 0
    };
  }

  _simulateExternalTraffic() {
    for (let i = 0; i < BAUCUA_DOOR_COUNT; i += 1) {
      this.state.potValues[i] += randInt(5000, 250000);
    }
  }

  async _settleCurrentRound() {
    const bets = await BauCuaBet.find({
      referenceId: this.state.referenceId,
      status: "pending"
    }).lean();
    if (!bets.length) {
      return new Map();
    }

    const counts = makeDoorCounts(this.state.dices);
    const bulk = [];
    const participants = new Set();
    const creditByUser = new Map();
    const now = new Date();

    for (const bet of bets) {
      const userId = String(bet.userId);
      participants.add(userId);

      const betValues = normalizeBetValues(toCsv(bet.betValues || []));
      let prize = 0;
      for (let i = 0; i < BAUCUA_DOOR_COUNT; i += 1) {
        prize += betValues[i] * counts[i];
      }
      if (this.state.xValue > 1 && this.state.xPot >= 0 && this.state.xPot < BAUCUA_DOOR_COUNT && counts[this.state.xPot] > 0) {
        prize += betValues[this.state.xPot] * counts[this.state.xPot] * (this.state.xValue - 1);
      }

      bulk.push({
        updateOne: {
          filter: { _id: bet._id },
          update: {
            $set: {
              prize,
              status: prize > 0 ? "win" : "lose",
              settledAt: now
            }
          }
        }
      });

      if (prize > 0) {
        creditByUser.set(userId, (creditByUser.get(userId) || 0) + prize);
      }
    }

    if (bulk.length) {
      await BauCuaBet.bulkWrite(bulk, { ordered: false });
    }

    const currentMoneyByUser = new Map();
    for (const [userId, amount] of creditByUser.entries()) {
      const user = await userService.credit(userId, amount);
      if (user) {
        currentMoneyByUser.set(userId, Math.floor(user.coin || 0));
      }
    }

    const missingIds = [...participants].filter((id) => !currentMoneyByUser.has(id));
    if (missingIds.length) {
      const docs = await User.find({ _id: { $in: missingIds } }, { coin: 1 }).lean();
      for (const item of docs) {
        currentMoneyByUser.set(String(item._id), Math.floor(item.coin || 0));
      }
    }

    const result = new Map();
    for (const userId of participants) {
      result.set(userId, {
        prize: creditByUser.get(userId) || 0,
        currentMoney: currentMoneyByUser.get(userId) || 0
      });
    }
    return result;
  }

  async _sendGameInfo(client) {
    const userId = client.user ? String(client.user._id) : "";
    const userBets = this._getUserBetEntry(userId);
    const room = this._getRoom(client);
    const history = this._buildHistoryString();
    const writer = new BinaryWriter();
    writer.writeLong(this.state.referenceId);
    writer.writeByte(this.state.remainTime);
    writer.writeBool(this.state.bettingState);
    writer.writeString(toCsv(this.state.potValues));
    writer.writeString(toCsv(userBets));
    writer.writeString(history);
    writer.writeByte(this.state.dices[0] || 0);
    writer.writeByte(this.state.dices[1] || 0);
    writer.writeByte(this.state.dices[2] || 0);
    writer.writeByte(this.state.xPot || 0);
    writer.writeByte(this.state.xValue || 0);
    writer.writeByte(room);
    console.log(`[baucua] send INFO: client=${client.id} ref=${this.state.referenceId} historyLen=${history ? history.length : 0}`);
    client.sendPacket(this.cmd.INFO, 0, writer.toBuffer());
  }

  _broadcastUpdate() {
    const writer = new BinaryWriter();
    writer.writeString(toCsv(this.state.potValues));
    writer.writeByte(this.state.remainTime);
    writer.writeByte(this.state.bettingState ? 1 : 0);
    const payload = writer.toBuffer();
    this._forEachClient((client) => {
      client.sendPacket(this.cmd.UPDATE, 0, payload);
    });
  }

  _broadcastResult() {
    const writer = new BinaryWriter();
    writer.writeByte(this.state.dices[0] || 0);
    writer.writeByte(this.state.dices[1] || 0);
    writer.writeByte(this.state.dices[2] || 0);
    writer.writeByte(this.state.xPot || 0);
    writer.writeByte(this.state.xValue || 0);
    const payload = writer.toBuffer();
    this._forEachClient((client) => {
      client.sendPacket(this.cmd.RESULT, 0, payload);
    });
  }

  _broadcastPrizes(settleMap) {
    this._forEachClient((client) => {
      if (!client.user) return;
      const userId = String(client.user._id);
      const settled = settleMap.get(userId);
      if (!settled || settled.prize <= 0) return;
      client.user.coin = settled.currentMoney;

      const writer = new BinaryWriter();
      writer.writeLong(settled.prize);
      writer.writeLong(settled.currentMoney);
      writer.writeByte(this._getRoom(client));
      client.sendPacket(this.cmd.PRIZE, 0, writer.toBuffer());
    });
  }

  _broadcastNewRound() {
    const writer = new BinaryWriter();
    writer.writeLong(this.state.referenceId);
    const payload = writer.toBuffer();
    this._forEachClient((client) => {
      client.sendPacket(this.cmd.NEW_GAME, 0, payload);
    });
  }

  _sendBetAck(client, resultCode, currentMoney) {
    const writer = new BinaryWriter();
    writer.writeByte(resultCode);
    writer.writeLong(currentMoney);
    client.sendPacket(this.cmd.BET, 0, writer.toBuffer());
  }

  _persistLiveState() {
    if (!this.state || !this.state.sessionDocId) return;
    void BauCuaSession.updateOne(
      { _id: this.state.sessionDocId },
      {
        $set: {
          phase: this.state.phase,
          bettingState: this.state.bettingState,
          remainTime: this.state.remainTime,
          potValues: this.state.potValues
        }
      }
    ).catch(() => {});
  }

  _buildHistoryString() {
    if (!this.histories.length) return "";
    const chunks = [];
    for (const item of this.histories) {
      chunks.push(
        `${safeInt(item.dices[0], 0)}`,
        `${safeInt(item.dices[1], 0)}`,
        `${safeInt(item.dices[2], 0)}`,
        `${safeInt(item.xPot, 0)}`,
        `${safeInt(item.xValue, 0)}`
      );
    }
    return chunks.join(",");
  }

  _forEachClient(callback) {
    for (const client of this.clients) {
      if (!client.isOpen()) continue;
      callback(client);
    }
  }

  _getRoom(client) {
    if (!client || !client.id) return 0;
    return clampRoom(this.clientRooms.get(client.id) || 0);
  }

  _getUserBetEntry(userId) {
    if (!userId) return [0, 0, 0, 0, 0, 0];
    const value = this.currentUserBets.get(userId);
    if (!Array.isArray(value) || value.length !== BAUCUA_DOOR_COUNT) {
      return [0, 0, 0, 0, 0, 0];
    }
    return value.slice(0, BAUCUA_DOOR_COUNT);
  }

  setForcedNextResult(payload = {}) {
    const d1 = Number(payload.dice1);
    const d2 = Number(payload.dice2);
    const d3 = Number(payload.dice3);
    if (![d1, d2, d3].every((n) => Number.isInteger(n) && n >= 0 && n <= 5)) {
      throw new Error("dice must be integers in range 0..5");
    }

    let xValue = Number(payload.xValue);
    let xPot = Number(payload.xPot);
    if (!Number.isInteger(xValue) || xValue < 0 || xValue > 5) {
      xValue = 0;
    }
    if (xValue <= 1) {
      xValue = 0;
      xPot = 0;
    } else if (!Number.isInteger(xPot) || xPot < 0 || xPot > 5) {
      throw new Error("xPot must be integer in range 0..5 when xValue > 1");
    }

    this.forcedNextResult = {
      dice1: d1,
      dice2: d2,
      dice3: d3,
      xPot,
      xValue
    };
    return this.getControlSnapshot();
  }

  clearForcedNextResult() {
    this.forcedNextResult = null;
    return this.getControlSnapshot();
  }

  getControlSnapshot() {
    return {
      game: "baucua",
      referenceId: this.state ? Number(this.state.referenceId || 0) : 0,
      phase: this.state ? String(this.state.phase || "") : "",
      bettingState: !!(this.state && this.state.bettingState),
      remainTime: this.state ? Number(this.state.remainTime || 0) : 0,
      forcedNextResult: this.forcedNextResult
        ? {
            dice1: Number(this.forcedNextResult.dice1 || 0),
            dice2: Number(this.forcedNextResult.dice2 || 0),
            dice3: Number(this.forcedNextResult.dice3 || 0),
            xPot: Number(this.forcedNextResult.xPot || 0),
            xValue: Number(this.forcedNextResult.xValue || 0)
          }
        : null
    };
  }

  _initialReference() {
    return 500000;
  }
}

module.exports = BauCuaEngine;
