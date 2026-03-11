"use strict";

const crypto = require("crypto");
const BinaryWriter = require("../protocol/binary-writer");
const BinaryReader = require("../protocol/binary-reader");
const GameSession = require("../db/models/GameSession");
const Bet = require("../db/models/Bet");
const User = require("../db/models/User");
const chatService = require("./chat-service");
const userService = require("./user-service");
const { BET_ERROR, CHAT_ERROR, MONEY_TYPE } = require("../protocol/constants");
const { randInt, makeDice3 } = require("../utils/random");

const MAX_SAFE_BIGINT = BigInt(Number.MAX_SAFE_INTEGER);
const MIN_SAFE_BIGINT = BigInt(Number.MIN_SAFE_INTEGER);

function bigintToNumber(value) {
  if (typeof value !== "bigint") return Number(value || 0);
  if (value > MAX_SAFE_BIGINT) return Number.MAX_SAFE_INTEGER;
  if (value < MIN_SAFE_BIGINT) return Number.MIN_SAFE_INTEGER;
  return Number(value);
}

function formatHistoriesAsDiceList(histories) {
  if (!Array.isArray(histories) || histories.length === 0) {
    return "1,2,3";
  }
  const flat = [];
  for (const item of histories) {
    flat.push(item.dices[0], item.dices[1], item.dices[2]);
  }
  return flat.join(",");
}

class GameEngine {
  constructor(options) {
    this.gameKey = options.gameKey;
    this.gameId = options.gameId;
    this.moneyType = options.moneyType || MONEY_TYPE;
    this.cmd = options.cmd;
    this.betDurationSec = options.betDurationSec;
    this.resultDurationSec = options.resultDurationSec;
    this.historyLimit = options.historyLimit || 100;
    this.defaultCoin = options.defaultCoin || 1000000000;
    this.enableJackpot = Boolean(options.enableJackpot);
    this.maxBet = 999999999;
    this.minBet = 1000;
    this.lockBetAtSec = this.gameKey === "double" ? 5 : 0;
    this.allowBothDoors = Boolean(options.allowBothDoors);

    this.clients = new Set();
    this.chatClients = new Set();
    this.tickTimer = null;
    this.tickLock = false;
    this.state = null;
    this.histories = [];
    this.currentUserBets = new Map();
    this.forcedNextResult = null;
  }

  async init() {
    const lastSessions = await GameSession.find({ gameKey: this.gameKey, dice1: { $ne: null } })
      .sort({ referenceId: -1 })
      .limit(this.historyLimit)
      .lean();
    this.histories = lastSessions
      .reverse()
      .map((s) => ({ referenceId: s.referenceId, dices: [s.dice1 || 1, s.dice2 || 1, s.dice3 || 1] }));
    if (!this.histories.length) {
      const seedReference = this._initialReference() - 10;
      for (let i = 0; i < 10; i += 1) {
        const dices = makeDice3();
        this.histories.push({
          referenceId: seedReference + i,
          dices
        });
      }
    }

    const latest = await GameSession.findOne({ gameKey: this.gameKey }).sort({ referenceId: -1 }).lean();
    const nextReference = latest ? latest.referenceId + 1 : this._initialReference();
    this.state = await this._createFreshBettingState(nextReference, latest);
  }

  start() {
    if (this.tickTimer) return;
    this.tickTimer = setInterval(() => {
      void this._safeTick();
    }, 1000);
  }

  stop() {
    if (this.tickTimer) {
      clearInterval(this.tickTimer);
      this.tickTimer = null;
    }
  }

  detachClient(client) {
    this.clients.delete(client);
    this.chatClients.delete(client);
  }

  async handleSubscribe(client, payload) {
    const reader = new BinaryReader(payload);
    const gameId = reader.readShort();
    const moneyType = reader.readShort();
    if (gameId !== this.gameId || moneyType !== this.moneyType) {
      return;
    }
    this.clients.add(client);
    await this._sendGameInfo(client);
    this._sendHistories(client);
  }

  handleUnsubscribe(client) {
    this.clients.delete(client);
  }

  async handleSubscribeChat(client) {
    this.chatClients.add(client);
    const messages = await chatService.getRecentMessages(this.gameKey, 20);
    this._sendChatLog(client, this.cmd.SUBSCRIBE_CHAT, messages);
  }

  handleUnsubscribeChat(client) {
    this.chatClients.delete(client);
  }

  async handleSendChat(client, payload) {
    if (!client.user) {
      this._sendChatAck(client, CHAT_ERROR.NO_PERMISSION, "", "");
      return;
    }
    const reader = new BinaryReader(payload);
    const message = reader.readString().trim();
    if (!message) {
      this._sendChatAck(client, CHAT_ERROR.UNKNOWN, client.user.nickname, "");
      return;
    }
    if (message.length > 120) {
      this._sendChatAck(client, CHAT_ERROR.TOO_LONG, client.user.nickname, "");
      return;
    }
    const now = Date.now();
    if (client.user.bannedChatUntil && new Date(client.user.bannedChatUntil).getTime() > now) {
      this._sendChatAck(client, CHAT_ERROR.BANNED, client.user.nickname, "");
      return;
    }

    await chatService.saveMessage(this.gameKey, client.user.nickname, message);
    this._sendChatAck(client, CHAT_ERROR.SUCCESS, client.user.nickname, message);
    this._broadcastChat([{ u: client.user.nickname, m: message }]);
  }

  async handleBet(client, payload) {
    const currentCoin = client.user ? Math.floor(client.user.coin || 0) : 0;
    if (!client.user) {
      this._sendBetAck(client, BET_ERROR.UNKNOWN, currentCoin);
      return;
    }

    const reader = new BinaryReader(payload);
    reader.readInt(); // room id (unused)
    const referenceId = bigintToNumber(reader.readLong());
    const amount = bigintToNumber(reader.readLong());
    const moneyType = reader.readShort();
    const door = reader.readShort();
    const remainTime = reader.readShort();

    if (
      !this.state ||
      !this.state.bettingState ||
      referenceId !== this.state.referenceId ||
      this.state.remainTime <= 0 ||
      remainTime <= 0
    ) {
      this._sendBetAck(client, BET_ERROR.TIMEOUT, currentCoin);
      return;
    }

    if (
      (this.gameKey === "double" && this.state.remainTime <= this.lockBetAtSec) ||
      (this.gameKey === "double" && remainTime <= this.lockBetAtSec)
    ) {
      this._sendBetAck(client, BET_ERROR.TIMEOUT, currentCoin);
      return;
    }

    if (moneyType !== this.moneyType || (door !== 0 && door !== 1) || amount < this.minBet || amount > this.maxBet) {
      this._sendBetAck(client, BET_ERROR.INVALID_BET, currentCoin);
      return;
    }

    const userId = String(client.user._id);
    const entry = this._getUserBetEntry(userId);
    if (!this.allowBothDoors && ((door === 1 && entry.betXiu > 0) || (door === 0 && entry.betTai > 0))) {
      this._sendBetAck(client, BET_ERROR.INVALID_BET, currentCoin);
      return;
    }

    const updatedUser = await userService.tryDebit(client.user._id, amount);
    if (!updatedUser) {
      this._sendBetAck(client, BET_ERROR.NOT_ENOUGH_MONEY, currentCoin);
      return;
    }

    client.user.coin = updatedUser.coin;
    if (door === 1) {
      entry.betTai += amount;
      this.state.potTai += amount;
      this.state.numBetTai += 1;
    } else {
      entry.betXiu += amount;
      this.state.potXiu += amount;
      this.state.numBetXiu += 1;
    }
    this.currentUserBets.set(userId, entry);

    await Bet.create({
      gameKey: this.gameKey,
      gameId: this.gameId,
      referenceId: this.state.referenceId,
      userId: client.user._id,
      nickname: client.user.nickname,
      door,
      amount,
      moneyType,
      remainTimeAtBet: remainTime,
      status: "pending",
      payout: 0
    });

    void GameSession.updateOne(
      { _id: this.state.sessionDocId },
      {
        $set: {
          potTai: this.state.potTai,
          potXiu: this.state.potXiu,
          numBetTai: this.state.numBetTai,
          numBetXiu: this.state.numBetXiu
        }
      }
    ).catch(() => {});

    this._sendBetAck(client, BET_ERROR.SUCCESS, Math.floor(updatedUser.coin));
  }

  async _safeTick() {
    if (this.tickLock || !this.state) return;
    this.tickLock = true;
    try {
      await this._tick();
    } catch (error) {
      // Keep engine alive on transient DB errors.
      console.error(`[${this.gameKey}] tick error:`, error.message);
    } finally {
      this.tickLock = false;
    }
  }

  async _tick() {
    if (!this.state) return;

    if (this.state.bettingState) {
      this._simulateExternalTraffic();
      this.state.remainTime -= 1;
      if (this.gameKey === "double" && this.state.remainTime <= this.lockBetAtSec) {
        this._applyDoubleLockBalance();
      }
      if (this.state.remainTime <= 0) {
        await this._transitionToResult();
        return;
      }
      this._persistLiveState();
      this._broadcastUpdateTime();
      return;
    }

    this.state.remainTime -= 1;
    if (this.state.remainTime <= 0) {
      await this._transitionToNewRound();
      return;
    }
    this._persistLiveState();
    this._broadcastUpdateTime();
  }

  async _transitionToResult() {
    this.state.phase = "result";
    this.state.bettingState = false;
    this.state.remainTime = this.resultDurationSec;

    const forced = this.forcedNextResult;
    const dices = forced ? [forced.dice1, forced.dice2, forced.dice3] : makeDice3();
    this.forcedNextResult = null;

    const score = dices[0] + dices[1] + dices[2];
    const resultDoor = score >= 11 ? 1 : 0; // 1 = Tai, 0 = Xiu
    this.state.dices = dices;
    this.state.resultDoor = resultDoor;
    this.state.md5Code = this._buildMd5Code(this.state.referenceId, dices);

    const settleMap = await this._settleBets(resultDoor);

    this.histories.push({
      referenceId: this.state.referenceId,
      dices: [dices[0], dices[1], dices[2]]
    });
    if (this.histories.length > this.historyLimit) {
      this.histories.splice(0, this.histories.length - this.historyLimit);
    }

    await GameSession.updateOne(
      { _id: this.state.sessionDocId },
      {
        $set: {
          phase: "result",
          bettingState: false,
          remainTime: this.state.remainTime,
          dice1: dices[0],
          dice2: dices[1],
          dice3: dices[2],
          resultDoor,
          md5Code: this.state.md5Code,
          resultAt: new Date(),
          potTai: this.state.potTai,
          potXiu: this.state.potXiu,
          numBetTai: this.state.numBetTai,
          numBetXiu: this.state.numBetXiu
        }
      }
    );

    const totalBets = this.state.potTai + this.state.potXiu;
    console.log(
      `[round][${this.gameKey}] RESULT #${this.state.referenceId} ` +
        `door=${this._doorName(resultDoor)} dices=${dices.join("-")} totalPot=${totalBets} players=${settleMap.size}`
    );

    this._broadcastDicesResult();
    this._broadcastResult(settleMap);
    this._broadcastUpdateTime();
  }

  async _transitionToNewRound() {
    const nextReference = this.state.referenceId + 1;
    const oldSessionId = this.state.sessionDocId;

    if (oldSessionId) {
      await GameSession.updateOne(
        { _id: oldSessionId },
        {
          $set: {
            endedAt: new Date(),
            remainTime: 0
          }
        }
      );
    }

    this.currentUserBets.clear();
    this.state = await this._createFreshBettingState(nextReference, this.state);
    this._broadcastNewGame();
    this._broadcastUpdateTime();
  }

  async _createFreshBettingState(referenceId, prevState) {
    const now = new Date();
    let jackpotTai = prevState && prevState.jackpotTai ? prevState.jackpotTai : 500000000;
    let jackpotXiu = prevState && prevState.jackpotXiu ? prevState.jackpotXiu : 500000000;
    if (this.enableJackpot) {
      jackpotTai += randInt(50000, 600000);
      jackpotXiu += randInt(50000, 600000);
    }

    const potTai = randInt(120000000, 200000000);
    const potXiu = randInt(120000000, 200000000);
    const md5Code = this.gameKey === "md5" ? this._buildMd5Code(referenceId, [randInt(1, 6), randInt(1, 6), randInt(1, 6)]) : "";

    const created = await GameSession.create({
      gameKey: this.gameKey,
      gameId: this.gameId,
      referenceId,
      phase: "betting",
      bettingState: true,
      remainTime: this.betDurationSec,
      moneyType: this.moneyType,
      potTai,
      potXiu,
      numBetTai: randInt(80, 220),
      numBetXiu: randInt(80, 220),
      jackpotTai,
      jackpotXiu,
      md5Code,
      startedAt: now
    });

    console.log(
      `[round][${this.gameKey}] START #${referenceId} ` +
        `bet=${this.betDurationSec}s result=${this.resultDurationSec}s potTai=${potTai} potXiu=${potXiu}`
    );

    return {
      sessionDocId: created._id,
      referenceId,
      phase: "betting",
      bettingState: true,
      remainTime: this.betDurationSec,
      potTai,
      potXiu,
      numBetTai: created.numBetTai,
      numBetXiu: created.numBetXiu,
      jackpotTai,
      jackpotXiu,
      dices: [0, 0, 0],
      resultDoor: 0,
      md5Code,
      hasLockedBalance: false
    };
  }

  _simulateExternalTraffic() {
    if (!this.state || !this.state.bettingState) return;
    if (this.gameKey === "double" && this.state.remainTime <= this.lockBetAtSec) return;
    this.state.potTai += randInt(20000, 800000);
    this.state.potXiu += randInt(20000, 800000);
    this.state.numBetTai += randInt(0, 3);
    this.state.numBetXiu += randInt(0, 3);
  }

  _applyDoubleLockBalance() {
    if (!this.state || this.gameKey !== "double") return;
    if (this.state.hasLockedBalance) return;
    const minPot = Math.min(this.state.potTai, this.state.potXiu);
    this.state.potTai = minPot;
    this.state.potXiu = minPot;
    this.state.hasLockedBalance = true;
    console.log(`[round][${this.gameKey}] LOCK BET #${this.state.referenceId} at ${this.state.remainTime}s, balancedPot=${minPot}`);
  }

  async _settleBets(resultDoor) {
    const bets = await Bet.find({
      gameKey: this.gameKey,
      referenceId: this.state.referenceId,
      status: "pending"
    }).lean();

    if (!bets.length) return new Map();

    const now = new Date();
    const bulk = [];
    const participants = new Set();
    const creditByUser = new Map();

    for (const bet of bets) {
      const userId = String(bet.userId);
      participants.add(userId);
      const isWin = bet.door === resultDoor;
      const payout = isWin ? Math.floor(bet.amount * 1.95) : 0;
      bulk.push({
        updateOne: {
          filter: { _id: bet._id },
          update: {
            $set: {
              status: isWin ? "win" : "lose",
              payout,
              settledAt: now
            }
          }
        }
      });
      if (isWin) {
        creditByUser.set(userId, (creditByUser.get(userId) || 0) + payout);
      }
    }

    if (bulk.length) {
      await Bet.bulkWrite(bulk, { ordered: false });
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
      for (const doc of docs) {
        currentMoneyByUser.set(String(doc._id), Math.floor(doc.coin || 0));
      }
    }

    const resultMap = new Map();
    for (const userId of participants) {
      resultMap.set(userId, {
        totalMoney: creditByUser.get(userId) || 0,
        currentMoney: currentMoneyByUser.get(userId) || 0
      });
    }
    return resultMap;
  }

  async _sendGameInfo(client) {
    if (!this.state) return;
    const userId = client.user ? String(client.user._id) : "";
    const userBet = this._getUserBetEntry(userId);
    const writer = new BinaryWriter();
    writer.writeShort(this.gameId);
    writer.writeShort(this.moneyType);
    writer.writeLong(this.state.referenceId);
    writer.writeShort(this.state.remainTime);
    writer.writeBool(this.state.bettingState);
    writer.writeLong(this.state.potTai);
    writer.writeLong(this.state.potXiu);
    writer.writeLong(userBet.betTai);
    writer.writeLong(userBet.betXiu);
    writer.writeShort(this.state.dices[0] || 0);
    writer.writeShort(this.state.dices[1] || 0);
    writer.writeShort(this.state.dices[2] || 0);
    writer.writeShort(this.resultDurationSec);
    if (this.gameKey === "double") {
      writer.writeLong(this.state.jackpotTai || 0);
      writer.writeLong(this.state.jackpotXiu || 0);
    } else {
      writer.writeString(this.state.md5Code || "");
    }
    client.sendPacket(this.cmd.GAME_INFO, 0, writer.toBuffer());
  }

  _broadcastUpdateTime() {
    if (!this.state) return;
    const writer = new BinaryWriter();
    writer.writeShort(this.state.remainTime);
    writer.writeBool(this.state.bettingState);
    writer.writeLong(this.state.potTai);
    writer.writeLong(this.state.potXiu);
    writer.writeShort(this.state.numBetTai);
    writer.writeShort(this.state.numBetXiu);
    const payload = writer.toBuffer();
    this._forEachGameClient((client) => {
      client.sendPacket(this.cmd.UPDATE_TIME, 0, payload);
    });
  }

  _broadcastDicesResult() {
    if (!this.state) return;
    const writer = new BinaryWriter();
    writer.writeShort(this.state.resultDoor);
    writer.writeShort(this.state.dices[0] || 0);
    writer.writeShort(this.state.dices[1] || 0);
    writer.writeShort(this.state.dices[2] || 0);
    if (this.gameKey === "md5") {
      writer.writeString(this.state.md5Code || "");
    }
    const payload = writer.toBuffer();
    this._forEachGameClient((client) => {
      client.sendPacket(this.cmd.DICES_RESULT, 0, payload);
    });
  }

  _broadcastResult(resultMap) {
    this._forEachGameClient((client) => {
      const userId = client.user ? String(client.user._id) : "";
      const result = resultMap.get(userId);
      const totalMoney = result ? result.totalMoney : 0;
      const currentMoney = result ? result.currentMoney : Math.floor((client.user && client.user.coin) || 0);
      if (client.user) {
        client.user.coin = currentMoney;
      }
      const writer = new BinaryWriter();
      writer.writeShort(this.moneyType);
      writer.writeLong(totalMoney);
      writer.writeLong(currentMoney);
      client.sendPacket(this.cmd.RESULT, 0, writer.toBuffer());
    });
  }

  _broadcastNewGame() {
    if (!this.state) return;
    const writer = new BinaryWriter();
    writer.writeLong(this.state.referenceId);
    writer.writeShort(this.resultDurationSec);
    if (this.gameKey === "double") {
      writer.writeLong(this.state.jackpotTai || 0);
      writer.writeLong(this.state.jackpotXiu || 0);
    } else {
      writer.writeString(this.state.md5Code || "");
    }
    const payload = writer.toBuffer();
    this._forEachGameClient((client) => {
      client.sendPacket(this.cmd.NEW_GAME, 0, payload);
    });
  }

  _sendHistories(client) {
    const writer = new BinaryWriter();
    writer.writeString(formatHistoriesAsDiceList(this.histories));
    client.sendPacket(this.cmd.HISTORIES, 0, writer.toBuffer());
  }

  _sendBetAck(client, errorCode, currentMoney) {
    const writer = new BinaryWriter();
    writer.writeLong(currentMoney);
    client.sendPacket(this.cmd.BET, errorCode, writer.toBuffer());
  }

  _sendChatLog(client, cmdId, messages) {
    const writer = new BinaryWriter();
    writer.writeString(JSON.stringify(messages || []));
    writer.writeByte(0); // minVipPoint
    writer.writeLong(0); // timeBan
    writer.writeByte(0); // userType
    client.sendPacket(cmdId, 0, writer.toBuffer());
  }

  _broadcastChat(messages) {
    const writer = new BinaryWriter();
    writer.writeString(JSON.stringify(messages || []));
    writer.writeByte(0);
    writer.writeLong(0);
    writer.writeByte(0);
    const payload = writer.toBuffer();
    for (const client of this.chatClients) {
      if (!client.isOpen()) continue;
      client.sendPacket(this.cmd.LOG_CHAT, 0, payload);
    }
  }

  _sendChatAck(client, errorCode, nickname, message) {
    const writer = new BinaryWriter();
    writer.writeString(nickname || "");
    writer.writeString(message || "");
    client.sendPacket(this.cmd.SEND_CHAT, errorCode, writer.toBuffer());
  }

  _persistLiveState() {
    if (!this.state || !this.state.sessionDocId) return;
    void GameSession.updateOne(
      { _id: this.state.sessionDocId },
      {
        $set: {
          phase: this.state.phase,
          bettingState: this.state.bettingState,
          remainTime: this.state.remainTime,
          potTai: this.state.potTai,
          potXiu: this.state.potXiu,
          numBetTai: this.state.numBetTai,
          numBetXiu: this.state.numBetXiu
        }
      }
    ).catch(() => {});
  }

  _forEachGameClient(callback) {
    for (const client of this.clients) {
      if (!client.isOpen()) continue;
      callback(client);
    }
  }

  _getUserBetEntry(userId) {
    if (!userId) {
      return { betTai: 0, betXiu: 0 };
    }
    return this.currentUserBets.get(userId) || { betTai: 0, betXiu: 0 };
  }

  _initialReference() {
    return this.gameKey === "double" ? 180000 : 280000;
  }

  setForcedNextResult(payload = {}) {
    const d1 = Number(payload.dice1);
    const d2 = Number(payload.dice2);
    const d3 = Number(payload.dice3);
    if (![d1, d2, d3].every((n) => Number.isInteger(n) && n >= 1 && n <= 6)) {
      throw new Error("dice must be integers in range 1..6");
    }
    this.forcedNextResult = { dice1: d1, dice2: d2, dice3: d3 };
    return this.getControlSnapshot();
  }

  clearForcedNextResult() {
    this.forcedNextResult = null;
    return this.getControlSnapshot();
  }

  getControlSnapshot() {
    return {
      game: this.gameKey,
      referenceId: this.state ? Number(this.state.referenceId || 0) : 0,
      phase: this.state ? String(this.state.phase || "") : "",
      bettingState: !!(this.state && this.state.bettingState),
      remainTime: this.state ? Number(this.state.remainTime || 0) : 0,
      forcedNextResult: this.forcedNextResult
        ? {
            dice1: Number(this.forcedNextResult.dice1 || 0),
            dice2: Number(this.forcedNextResult.dice2 || 0),
            dice3: Number(this.forcedNextResult.dice3 || 0)
          }
        : null
    };
  }

  _buildMd5Code(referenceId, dices) {
    const source = `${this.gameKey}:${referenceId}:${dices[0]}-${dices[1]}-${dices[2]}`;
    return crypto.createHash("md5").update(source).digest("hex");
  }

  _doorName(door) {
    return door === 1 ? "TAI" : "XIU";
  }
}

module.exports = GameEngine;


