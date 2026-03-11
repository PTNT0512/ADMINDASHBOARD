"use strict";

const BinaryReader = require("../protocol/binary-reader");
const BinaryWriter = require("../protocol/binary-writer");
const XocDiaSession = require("../db/models/XocDiaSession");
const XocDiaBet = require("../db/models/XocDiaBet");
const User = require("../db/models/User");
const userService = require("./user-service");
const { randInt } = require("../utils/random");

const DOOR_COUNT = 6;
const ACTION = {
  START: 1,
  BETTING: 2,
  REFUND: 4,
  RESULT: 6
};

const MAX_BET_PER_REQUEST = 100000000;
const HISTORY_LIMIT = 100;
const ROOM_PRESETS = [
  { id: 1, moneyBet: 1000, requiredMoney: 1000, maxUserPerRoom: 8, nameRoom: "XocDia 1K", rule: 0 }
];

function safeInt(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

function clampDoor(value) {
  const v = safeInt(value, -1);
  if (v < 0 || v >= DOOR_COUNT) return -1;
  return v;
}

function makeEmptyPotValues() {
  return [0, 0, 0, 0, 0, 0];
}

function makeEmptyDoorValues() {
  return [0, 0, 0, 0, 0, 0];
}

function sumValues(values) {
  let total = 0;
  for (let i = 0; i < values.length; i += 1) {
    total += safeInt(values[i], 0);
  }
  return total;
}

function makeDiceResult() {
  // 0: white, 1: red (the client treats 1 as red in UI).
  return [randInt(0, 1), randInt(0, 1), randInt(0, 1), randInt(0, 1)];
}

function normalizeByStep(amount, step) {
  const safeStep = Math.max(1, safeInt(step, 1));
  const safeAmount = Math.max(safeStep, safeInt(amount, safeStep));
  return Math.max(safeStep, Math.floor(safeAmount / safeStep) * safeStep);
}

function getWinningDoorsByDice(diceIds) {
  const sum = safeInt(diceIds[0], 0) + safeInt(diceIds[1], 0) + safeInt(diceIds[2], 0) + safeInt(diceIds[3], 0);
  const redCount = sum;
  const whiteCount = 4 - redCount;
  const winning = [];

  if (sum % 2 === 0) {
    winning.push(0); // Chan
  } else {
    winning.push(1); // Le
  }
  if (whiteCount === 4) winning.push(2); // 4 trang
  if (redCount === 4) winning.push(3); // 4 do
  if (redCount === 3) winning.push(4); // 3 do 1 trang
  if (whiteCount === 3) winning.push(5); // 3 trang 1 do

  return winning;
}

function formatMoneyWinPots(doorPayout) {
  const pots = [];
  const values = [];
  for (let i = 0; i < doorPayout.length; i += 1) {
    const v = safeInt(doorPayout[i], 0);
    if (v > 0) {
      pots.push(i);
      values.push(v);
    }
  }
  return {
    potsWin: pots.join(","),
    moneyWinPots: values.join(",")
  };
}

function getActionDuration(action, options) {
  if (action === ACTION.START) return options.startDurationSec;
  if (action === ACTION.BETTING) return options.betDurationSec;
  if (action === ACTION.REFUND) return options.refundDurationSec;
  if (action === ACTION.RESULT) return options.resultDurationSec;
  return 1;
}

class XocDiaEngine {
  constructor(options = {}) {
    this.cmd = options.cmd;
    this.defaultCoin = Math.max(10000, safeInt(options.defaultCoin, 1000000000));
    this.startDurationSec = Math.max(1, safeInt(options.startDurationSec, 2));
    this.betDurationSec = Math.max(5, safeInt(options.betDurationSec, 20));
    this.refundDurationSec = Math.max(1, safeInt(options.refundDurationSec, 3));
    this.resultDurationSec = Math.max(2, safeInt(options.resultDurationSec, 6));
    this.historyLimit = Math.max(20, safeInt(options.historyLimit, HISTORY_LIMIT));
    this.enableBotTraffic = options.enableBotTraffic !== false;
    this.botBetMin = Math.max(1000, safeInt(options.botBetMin, 5000));
    this.botBetMax = Math.max(this.botBetMin, safeInt(options.botBetMax, 250000));
    this.botBurstMin = Math.max(0, safeInt(options.botBurstMin, 1));
    this.botBurstMax = Math.max(this.botBurstMin, safeInt(options.botBurstMax, 3));
    this.botNicknames =
      Array.isArray(options.botNicknames) && options.botNicknames.length > 0
        ? options.botNicknames.map((item) => String(item || "").trim()).filter(Boolean)
        : [
            "BOT_XD_01",
            "BOT_XD_02",
            "BOT_XD_03",
            "BOT_XD_04",
            "BOT_XD_05",
            "BOT_XD_06",
            "BOT_XD_07",
            "BOT_XD_08"
          ];

    this.clients = new Set();
    this.rooms = new Map(); // roomId -> state
    this.clientRoom = new Map(); // client.id -> roomId
    this.clientLeaveRegistered = new Set(); // client.id
    this.tickTimer = null;
    this.tickLock = false;
    this.nextReferenceId = 700000;
  }

  async init() {
    const latest = await XocDiaSession.findOne().sort({ referenceId: -1 }).lean();
    if (latest && Number.isFinite(latest.referenceId)) {
      this.nextReferenceId = Number(latest.referenceId) + 1;
    }

    const roomHistoryMap = new Map();
    const historyDocs = await XocDiaSession.find({ diceIds: { $exists: true, $ne: [] } })
      .sort({ referenceId: -1 })
      .limit(this.historyLimit * ROOM_PRESETS.length)
      .lean();
    for (const doc of historyDocs) {
      const roomId = safeInt(doc.roomId, 0);
      if (!roomHistoryMap.has(roomId)) roomHistoryMap.set(roomId, []);
      const list = roomHistoryMap.get(roomId);
      if (list.length >= this.historyLimit) continue;
      const sum = Array.isArray(doc.diceIds) ? doc.diceIds.reduce((acc, item) => acc + safeInt(item, 0), 0) : 0;
      const parity = sum % 2 === 0 ? 1 : 0; // 1 even, 0 odd
      list.push(parity);
    }

    for (const preset of ROOM_PRESETS) {
      const room = {
        id: preset.id,
        moneyBet: preset.moneyBet,
        requiredMoney: preset.requiredMoney,
        maxUserPerRoom: preset.maxUserPerRoom,
        nameRoom: preset.nameRoom,
        rule: preset.rule,
        clients: new Set(),
        action: ACTION.START,
        remainTime: this.startDurationSec,
        referenceId: this.nextReferenceId++,
        potValues: makeEmptyPotValues(),
        userBets: new Map(), // userId -> [6]
        diceIds: [0, 1, 0, 1],
        sellEven: 0,
        sellOdd: 0,
        historyParity: roomHistoryMap.get(preset.id) ? roomHistoryMap.get(preset.id).slice().reverse() : [],
        sessionDocId: null,
        forcedNextResult: null
      };
      await this._createSessionDoc(room);
      this.rooms.set(room.id, room);
      console.log(`[round][xocdia] INIT room=${room.id} #${room.referenceId} start=${room.remainTime}s`);
    }
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
      this.clientLeaveRegistered.delete(client.id);
      this._removeClientFromRoom(client, 0, false);
    }
  }

  async handleGetListRoom(client) {
    this.clients.add(client);
    console.log(`[xocdia] get-list-room: client=${client.id} user=${client.user ? client.user.nickname : "guest"}`);
    this._sendRoomList(client);
  }

  async handleJoinRoomById(client, payload) {
    this.clients.add(client);
    if (!client.user) {
      console.log(`[xocdia] join-room denied (no-login): client=${client.id}`);
      this._sendJoinRoomFail(client, 1);
      return;
    }

    let roomId = 0;
    try {
      const reader = new BinaryReader(payload);
      if (reader.remaining() > 0) roomId = safeInt(reader.readInt(), 0);
    } catch (_error) {
      roomId = 0;
    }
    const room = this.rooms.get(roomId);
    if (!room) {
      console.log(`[xocdia] join-room fail (not-found): user=${client.user.nickname} room=${roomId}`);
      this._sendJoinRoomFail(client, 1);
      return;
    }
    if (room.clients.size >= room.maxUserPerRoom) {
      console.log(`[xocdia] join-room fail (full): user=${client.user.nickname} room=${roomId}`);
      this._sendJoinRoomFail(client, 2);
      return;
    }
    if (safeInt(client.user.coin, 0) < room.requiredMoney) {
      console.log(`[xocdia] join-room fail (coin): user=${client.user.nickname} room=${roomId} coin=${safeInt(client.user.coin, 0)} need=${room.requiredMoney}`);
      this._sendJoinRoomFail(client, 1);
      return;
    }

    const currentRoomId = this.clientRoom.get(client.id);
    if (currentRoomId && currentRoomId !== room.id) {
      this._removeClientFromRoom(client, 0, false);
    }

    const wasInRoom = room.clients.has(client.id);
    room.clients.add(client.id);
    this.clientRoom.set(client.id, room.id);
    this.clientLeaveRegistered.delete(client.id);

    this._sendJoinRoomSuccess(client, room);
    console.log(`[xocdia] join-room success: user=${client.user.nickname} room=${room.id} action=${room.action} remain=${room.remainTime}s`);
    if (!wasInRoom) {
      this._broadcastUserJoin(room, client);
    }
  }

  async handleReconnect(client) {
    const roomId = this.clientRoom.get(client.id);
    const room = roomId ? this.rooms.get(roomId) : null;
    if (room) {
      this._sendJoinRoomSuccess(client, room);
      return;
    }
    this._sendRoomList(client);
  }

  async handlePutMoney(client, payload) {
    const room = this._getClientRoom(client);
    const currentMoney = client.user ? safeInt(client.user.coin, 0) : 0;
    if (!room || !client.user) {
      this._sendPutMoneyAck(client, 2, "", 0, 0, 0, currentMoney);
      return;
    }
    if (room.action !== ACTION.BETTING || room.remainTime <= 0) {
      this._sendPutMoneyAck(client, 2, String(client.user.nickname || ""), 0, 0, 0, currentMoney);
      return;
    }

    let doorId = -1;
    let amount = 0;
    try {
      const reader = new BinaryReader(payload);
      if (reader.remaining() > 0) doorId = clampDoor(reader.readByte());
      if (reader.remaining() > 0) amount = safeInt(reader.readLong(), 0);
    } catch (_error) {
      doorId = -1;
      amount = 0;
    }

    if (doorId < 0 || amount <= 0 || amount > MAX_BET_PER_REQUEST) {
      this._sendPutMoneyAck(client, 2, String(client.user.nickname || ""), 0, 0, 0, currentMoney);
      return;
    }

    const updatedUser = await userService.tryDebit(client.user._id, amount);
    if (!updatedUser) {
      this._sendPutMoneyAck(client, 1, String(client.user.nickname || ""), 0, doorId, room.potValues[doorId], currentMoney);
      return;
    }
    client.user.coin = safeInt(updatedUser.coin, currentMoney);

    const userId = String(client.user._id);
    const arr = room.userBets.get(userId) || makeEmptyDoorValues();
    arr[doorId] += amount;
    room.userBets.set(userId, arr);
    room.potValues[doorId] += amount;

    await XocDiaBet.create({
      referenceId: room.referenceId,
      roomId: room.id,
      userId: client.user._id,
      nickname: String(client.user.nickname || ""),
      doorId,
      amount,
      payout: 0,
      netExchange: 0,
      currentMoney: safeInt(client.user.coin, 0),
      status: "pending"
    });

    this._broadcastPutMoney(room, 0, String(client.user.nickname || ""), amount, doorId, room.potValues[doorId], safeInt(client.user.coin, 0));
  }

  async handleBankerSellGate(client, payload) {
    const room = this._getClientRoom(client);
    if (!room) return;

    let action = 0;
    let amount = 0;
    try {
      const reader = new BinaryReader(payload);
      if (reader.remaining() > 0) action = safeInt(reader.readByte(), 0);
      if (reader.remaining() > 0) amount = Math.max(0, safeInt(reader.readLong(), 0));
    } catch (_error) {
      action = 0;
      amount = 0;
    }

    if (action === 1) {
      room.sellEven = amount;
      room.sellOdd = amount;
    } else if (action === 2) {
      room.sellEven = amount;
    } else if (action === 3) {
      room.sellOdd = amount;
    }

    this._broadcastInfoGateSell(room);
    this._sendInfoMoneyAfterBankerSell(client);
  }

  async handleBuyGate(client, payload) {
    const room = this._getClientRoom(client);
    if (!room) return;

    let amount = 0;
    try {
      const reader = new BinaryReader(payload);
      if (reader.remaining() > 0) amount = Math.max(0, safeInt(reader.readLong(), 0));
    } catch (_error) {
      amount = 0;
    }

    const writer = new BinaryWriter();
    writer.writeString(client.user ? String(client.user.nickname || "") : "");
    writer.writeLong(amount);
    writer.writeLong(0);
    client.sendPacket(this.cmd.BUY_GATE, 0, writer.toBuffer());

    if (amount > 0) {
      room.sellEven = Math.max(0, room.sellEven - amount);
      room.sellOdd = Math.max(0, room.sellOdd - amount);
      this._broadcastInfoGateSell(room);
    }
  }

  async handleRequestInfoMoiChoi(client) {
    client.sendPacket(this.cmd.REQUEST_INFO_MOI_CHOI, 0, Buffer.alloc(0));
  }

  async handleMoiChoi(client) {
    client.sendPacket(this.cmd.MOI_CHOI, 0, Buffer.alloc(0));
  }

  async handleAcceptMoiChoi(client) {
    client.sendPacket(this.cmd.ACCEPT_MOI_CHOI, 0, Buffer.alloc(0));
  }

  async handleGetCau(client) {
    const room = this._getClientRoom(client);
    if (!room) {
      this._sendSoiCau(client, []);
      return;
    }
    this._sendSoiCau(client, room.historyParity);
  }

  async handleLeaveRoomRegister(client) {
    const room = this._getClientRoom(client);
    if (!room || !client.user) return;

    let isRegistered = false;
    if (this.clientLeaveRegistered.has(client.id)) {
      this.clientLeaveRegistered.delete(client.id);
      isRegistered = false;
    } else {
      this.clientLeaveRegistered.add(client.id);
      isRegistered = true;
    }
    this._sendLeaveRoomRegisterAck(client, isRegistered, String(client.user.nickname || ""));

    if (isRegistered && room.action === ACTION.START) {
      this._removeClientFromRoom(client, 0, true);
    }
  }

  async handleOrderBanker(client) {
    const writer = new BinaryWriter();
    writer.writeLong(0);
    client.sendPacket(this.cmd.ORDER_BANKER, 0, writer.toBuffer());
  }

  async handleCancelBanker(client) {
    const writer = new BinaryWriter();
    writer.writeBool(true);
    writer.writeString(client.user ? String(client.user.nickname || "") : "");
    client.sendPacket(this.cmd.HUY_LAM_CAI, 0, writer.toBuffer());
  }

  async handleChat(client, payload) {
    const room = this._getClientRoom(client);
    if (!room || !client.user) return;

    let isIcon = false;
    let content = "";
    try {
      const reader = new BinaryReader(payload);
      if (reader.remaining() > 0) isIcon = reader.readByte() > 0;
      if (reader.remaining() > 0) content = reader.readString();
    } catch (_error) {
      isIcon = false;
      content = "";
    }
    content = String(content || "").slice(0, 256);

    const writer = new BinaryWriter();
    writer.writeByte(0); // chair (unused in current client)
    writer.writeBool(isIcon);
    writer.writeString(content);
    writer.writeString(String(client.user.nickname || ""));
    const payloadOut = writer.toBuffer();

    for (const otherClient of this._getRoomClients(room)) {
      if (!otherClient.isOpen()) continue;
      otherClient.sendPacket(this.cmd.CHAT_MS, 0, payloadOut);
    }
  }

  async _safeTick() {
    if (this.tickLock) return;
    this.tickLock = true;
    try {
      for (const room of this.rooms.values()) {
        await this._tickRoom(room);
      }
    } catch (error) {
      console.error("[xocdia] tick error:", error.message);
    } finally {
      this.tickLock = false;
    }
  }

  async _tickRoom(room) {
    room.remainTime -= 1;
    if (room.remainTime > 0) {
      if (room.action === ACTION.BETTING) {
        this._simulateExternalTraffic(room);
      }
      await this._persistSessionState(room);
      return;
    }

    if (room.action === ACTION.START) {
      room.action = ACTION.BETTING;
      room.remainTime = this.betDurationSec;
      this._broadcastAction(room, ACTION.BETTING, room.remainTime);
      await this._persistSessionState(room);
      return;
    }

    if (room.action === ACTION.BETTING) {
      room.action = ACTION.REFUND;
      room.remainTime = this.refundDurationSec;
      this._broadcastRefund(room);
      this._broadcastAction(room, ACTION.REFUND, room.remainTime);
      await this._persistSessionState(room);
      return;
    }

    if (room.action === ACTION.REFUND) {
      room.action = ACTION.RESULT;
      room.remainTime = this.resultDurationSec;
      await this._settleRoom(room);
      this._broadcastAction(room, ACTION.RESULT, room.remainTime);
      await this._persistSessionState(room, true);
      return;
    }

    if (room.action === ACTION.RESULT) {
      await this._finishRoundAndStartNew(room);
    }
  }

  async _finishRoundAndStartNew(room) {
    await this._markSessionEnded(room);

    // Remove players who requested leave when round finished.
    const leavingClients = [];
    for (const clientId of room.clients) {
      if (this.clientLeaveRegistered.has(clientId)) {
        this.clientLeaveRegistered.delete(clientId);
        const client = this._findClientById(clientId);
        if (client) leavingClients.push(client);
      }
    }
    for (const client of leavingClients) {
      this._removeClientFromRoom(client, 0, true);
    }

    room.referenceId = this.nextReferenceId++;
    room.potValues = makeEmptyPotValues();
    room.userBets = new Map();
    room.diceIds = [0, 1, 0, 1];
    room.sellEven = 0;
    room.sellOdd = 0;
    room.action = ACTION.START;
    room.remainTime = this.startDurationSec;
    room.forcedNextResult = null;
    await this._createSessionDoc(room);

    console.log(`[round][xocdia] START room=${room.id} #${room.referenceId} start=${this.startDurationSec}s bet=${this.betDurationSec}s refund=${this.refundDurationSec}s result=${this.resultDurationSec}s`);

    this._broadcastStartGame(room);
    this._broadcastAction(room, ACTION.START, room.remainTime);
    await this._persistSessionState(room);
  }

  async _settleRoom(room) {
    const forced = room && room.forcedNextResult ? room.forcedNextResult : null;
    if (forced && Array.isArray(forced.diceIds) && forced.diceIds.length === 4) {
      room.diceIds = forced.diceIds.slice(0, 4).map((item) => safeInt(item, 0));
      room.forcedNextResult = null;
    } else {
      room.diceIds = makeDiceResult();
    }
    const winningDoors = getWinningDoorsByDice(room.diceIds);

    const userWinMap = new Map(); // userId -> { nickname, moneyWin, currentMoney, doorPayout[6] }
    const pendingBets = await XocDiaBet.find({
      referenceId: room.referenceId,
      roomId: room.id,
      status: "pending"
    }).lean();

    for (const item of pendingBets) {
      const userId = String(item.userId);
      if (!userWinMap.has(userId)) {
        userWinMap.set(userId, {
          userId,
          nickname: String(item.nickname || ""),
          moneyWin: 0,
          currentMoney: 0,
          doorPayout: makeEmptyDoorValues()
        });
      }
      const row = userWinMap.get(userId);
      const doorId = clampDoor(item.doorId);
      const amount = safeInt(item.amount, 0);
      const payout = doorId >= 0 && winningDoors.indexOf(doorId) >= 0 ? amount * 2 : 0;
      row.moneyWin += payout;
      if (doorId >= 0) {
        row.doorPayout[doorId] += payout;
      }
    }

    const userCurrentMoney = new Map();
    for (const row of userWinMap.values()) {
      if (row.moneyWin > 0) {
        const updated = await userService.credit(row.userId, row.moneyWin);
        if (updated) {
          userCurrentMoney.set(row.userId, safeInt(updated.coin, 0));
        }
      }
    }
    const missingUserIds = [];
    for (const row of userWinMap.values()) {
      if (!userCurrentMoney.has(row.userId)) {
        missingUserIds.push(row.userId);
      }
    }
    if (missingUserIds.length > 0) {
      const docs = await User.find({ _id: { $in: missingUserIds } }, { coin: 1 }).lean();
      for (const doc of docs) {
        userCurrentMoney.set(String(doc._id), safeInt(doc.coin, 0));
      }
    }

    const bulk = [];
    const now = new Date();
    for (const item of pendingBets) {
      const doorId = clampDoor(item.doorId);
      const amount = safeInt(item.amount, 0);
      const payout = doorId >= 0 && winningDoors.indexOf(doorId) >= 0 ? amount * 2 : 0;
      const netExchange = payout - amount;
      const userId = String(item.userId);
      const currentMoney = userCurrentMoney.has(userId) ? userCurrentMoney.get(userId) : 0;
      bulk.push({
        updateOne: {
          filter: { _id: item._id },
          update: {
            $set: {
              payout,
              netExchange,
              currentMoney,
              status: payout > 0 ? "win" : "lose",
              settledAt: now
            }
          }
        }
      });
    }
    if (bulk.length) {
      await XocDiaBet.bulkWrite(bulk, { ordered: false });
    }

    for (const client of this._getRoomClients(room)) {
      if (!client.user) continue;
      const userId = String(client.user._id);
      if (userCurrentMoney.has(userId)) {
        client.user.coin = userCurrentMoney.get(userId);
      }
    }

    const writer = new BinaryWriter();
    for (let i = 0; i < DOOR_COUNT; i += 1) {
      writer.writeByte(i);
      writer.writeLong(room.potValues[i]);
      writer.writeBool(winningDoors.indexOf(i) >= 0);
    }
    for (let i = 0; i < 4; i += 1) {
      writer.writeInt(room.diceIds[i]);
    }
    writer.writeLong(0); // moneyBankerBefore
    writer.writeLong(0); // moneyBankerAfter
    writer.writeLong(0); // moneyBankerExchange

    const winners = [];
    for (const row of userWinMap.values()) {
      if (row.moneyWin <= 0) continue;
      const currentMoney = userCurrentMoney.has(row.userId) ? userCurrentMoney.get(row.userId) : 0;
      const pots = formatMoneyWinPots(row.doorPayout);
      winners.push({
        nickname: row.nickname,
        moneyWin: row.moneyWin,
        currentMoney,
        potsWin: pots.potsWin,
        moneyWinPots: pots.moneyWinPots
      });
    }
    writer.writeInt(winners.length);
    for (const item of winners) {
      writer.writeString(item.nickname);
      writer.writeLong(item.moneyWin);
      writer.writeLong(item.currentMoney);
      writer.writeString(item.potsWin);
      writer.writeString(item.moneyWinPots);
    }
    writer.writeInt(0); // sub banker count

    const payload = writer.toBuffer();
    for (const client of this._getRoomClients(room)) {
      if (!client.isOpen()) continue;
      client.sendPacket(this.cmd.FINISH_GAME, 0, payload);
    }

    const sum = room.diceIds.reduce((acc, item) => acc + safeInt(item, 0), 0);
    const parity = sum % 2 === 0 ? 1 : 0; // 1 even, 0 odd
    room.historyParity.push(parity);
    if (room.historyParity.length > this.historyLimit) {
      room.historyParity.splice(0, room.historyParity.length - this.historyLimit);
    }

    console.log(`[round][xocdia] RESULT room=${room.id} #${room.referenceId} dice=${room.diceIds.join("-")} winners=${winners.length} pots=${room.potValues.join(",")}`);
  }

  _sendRoomList(client) {
    const writer = new BinaryWriter();
    writer.writeShort(this.rooms.size);
    for (const room of this.rooms.values()) {
      writer.writeInt(room.id);
      writer.writeByte(Math.min(255, room.clients.size));
      writer.writeByte(room.maxUserPerRoom);
      writer.writeInt(room.maxUserPerRoom);
      writer.writeByte(1); // money type
      writer.writeInt(room.moneyBet);
      writer.writeInt(room.requiredMoney);
      writer.writeByte(room.rule);
      writer.writeString(room.nameRoom);
      writer.writeBool(false);
      writer.writeLong(1000000000 + sumValues(room.potValues));
    }
    client.sendPacket(this.cmd.GET_LIST_ROOM, 0, writer.toBuffer());
  }

  _sendJoinRoomSuccess(client, room) {
    const writer = new BinaryWriter();
    const userId = client.user ? String(client.user._id) : "";
    const myBet = room.userBets.get(userId) || makeEmptyDoorValues();

    writer.writeInt(room.moneyBet);
    writer.writeInt(room.id);
    writer.writeInt(room.referenceId);
    writer.writeByte(1); // money type
    writer.writeByte(room.action);
    writer.writeInt(Math.max(0, room.remainTime));

    const otherPlayers = [];
    for (const other of this._getRoomClients(room)) {
      if (!other.user) continue;
      if (other.id === client.id) continue;
      otherPlayers.push(other);
    }
    writer.writeByte(otherPlayers.length);

    for (let i = 0; i < DOOR_COUNT; i += 1) {
      writer.writeByte(i);
      writer.writeInt(this._getDoorRatio(i));
      writer.writeLong(1000000000000);
      writer.writeLong(room.potValues[i]);
      writer.writeLong(myBet[i] || 0);
      writer.writeBool(false);
    }

    for (const other of otherPlayers) {
      writer.writeString(String(other.user.nickname || ""));
      writer.writeString("");
      writer.writeLong(safeInt(other.user.coin, 0));
      writer.writeBool(false);
      writer.writeBool(false);
      writer.writeBool(false);
    }

    writer.writeLong(client.user ? safeInt(client.user.coin, 0) : 0);
    writer.writeBool(false); // banker
    writer.writeBool(false); // sub banker
    const purchaseStatus = room.sellEven > 0 || room.sellOdd > 0 ? 1 : 0;
    writer.writeInt(purchaseStatus);
    writer.writeInt(0); // pot purchase
    writer.writeLong(room.sellEven || 0);
    writer.writeLong(room.sellOdd || 0);
    writer.writeLong(0); // money remain
    writer.writeInt(0); // sub list count
    writer.writeBool(false); // banker req destroy
    writer.writeBool(false); // boss req destroy
    writer.writeInt(0); // rule
    writer.writeLong(room.requiredMoney * 20);

    client.sendPacket(this.cmd.JOIN_ROOM_SUCCESS, 0, writer.toBuffer());
  }

  _sendJoinRoomFail(client, errorCode) {
    client.sendPacket(this.cmd.JOIN_ROOM_FAIL, safeInt(errorCode, 1));
  }

  _broadcastUserJoin(room, joinedClient) {
    if (!joinedClient || !joinedClient.user) return;
    const writer = new BinaryWriter();
    writer.writeString(String(joinedClient.user.nickname || ""));
    writer.writeString("");
    writer.writeLong(safeInt(joinedClient.user.coin, 0));
    const payload = writer.toBuffer();

    for (const other of this._getRoomClients(room)) {
      if (!other.isOpen()) continue;
      if (other.id === joinedClient.id) continue;
      other.sendPacket(this.cmd.USER_JOIN_ROOM_SUCCESS, 0, payload);
    }
  }

  _broadcastUserOut(room, nickname, exceptClientId = "") {
    const writer = new BinaryWriter();
    writer.writeString(String(nickname || ""));
    const payload = writer.toBuffer();
    for (const other of this._getRoomClients(room)) {
      if (!other.isOpen()) continue;
      if (exceptClientId && other.id === exceptClientId) continue;
      other.sendPacket(this.cmd.USER_OUT_ROOM, 0, payload);
    }
  }

  _broadcastAction(room, action, timeSec) {
    const writer = new BinaryWriter();
    writer.writeByte(action);
    writer.writeByte(Math.max(0, Math.min(255, safeInt(timeSec, 0))));
    const payload = writer.toBuffer();
    for (const client of this._getRoomClients(room)) {
      if (!client.isOpen()) continue;
      client.sendPacket(this.cmd.ACTION_IN_GAME, 0, payload);
    }
  }

  _broadcastStartGame(room) {
    const writer = new BinaryWriter();
    writer.writeString("");
    writer.writeInt(room.referenceId);
    writer.writeLong(0);
    for (let i = 0; i < DOOR_COUNT; i += 1) {
      writer.writeByte(i);
      writer.writeBool(false);
    }
    const payload = writer.toBuffer();

    for (const client of this._getRoomClients(room)) {
      if (!client.isOpen()) continue;
      client.sendPacket(this.cmd.START_GAME, 0, payload);
    }
  }

  _broadcastRefund(room) {
    const writer = new BinaryWriter();
    writer.writeInt(0); // rfCount
    for (let i = 0; i < DOOR_COUNT; i += 1) {
      writer.writeByte(i);
      writer.writeLong(0); // refunded on pot
      writer.writeLong(room.potValues[i]);
    }
    const payload = writer.toBuffer();
    for (const client of this._getRoomClients(room)) {
      if (!client.isOpen()) continue;
      client.sendPacket(this.cmd.REFUN_MONEY, 0, payload);
    }
  }

  _sendPutMoneyAck(client, error, nickname, betMoney, potId, potMoney, currentMoney) {
    const writer = new BinaryWriter();
    writer.writeString(nickname || "");
    writer.writeLong(betMoney);
    writer.writeByte(potId);
    writer.writeLong(potMoney);
    writer.writeLong(currentMoney);
    client.sendPacket(this.cmd.PUT_MONEY, safeInt(error, 0), writer.toBuffer());
  }

  _broadcastPutMoney(room, error, nickname, betMoney, potId, potMoney, currentMoney) {
    const writer = new BinaryWriter();
    writer.writeString(nickname || "");
    writer.writeLong(betMoney);
    writer.writeByte(potId);
    writer.writeLong(potMoney);
    writer.writeLong(currentMoney);
    const payload = writer.toBuffer();
    for (const client of this._getRoomClients(room)) {
      if (!client.isOpen()) continue;
      client.sendPacket(this.cmd.PUT_MONEY, safeInt(error, 0), payload);
    }
  }

  _sendSoiCau(client, historyParity) {
    const history = Array.isArray(historyParity) ? historyParity.slice().reverse() : [];
    let totalEven = 0;
    let totalOdd = 0;
    for (let i = 0; i < history.length; i += 1) {
      if (safeInt(history[i], 0) === 1) totalEven += 1;
      else totalOdd += 1;
    }

    const writer = new BinaryWriter();
    writer.writeInt(totalEven);
    writer.writeInt(totalOdd);
    writer.writeInt(history.length);
    for (let i = 0; i < history.length; i += 1) {
      writer.writeByte(history[i] === 1 ? 1 : 0);
    }
    client.sendPacket(this.cmd.SOI_CAU, 0, writer.toBuffer());
  }

  _broadcastInfoGateSell(room) {
    const writer = new BinaryWriter();
    writer.writeLong(room.sellEven || 0);
    writer.writeLong(room.sellOdd || 0);
    const payload = writer.toBuffer();
    for (const client of this._getRoomClients(room)) {
      if (!client.isOpen()) continue;
      client.sendPacket(this.cmd.INFO_GATE_SELL, 0, payload);
    }
  }

  _sendInfoMoneyAfterBankerSell(client) {
    const writer = new BinaryWriter();
    writer.writeLong(client && client.user ? safeInt(client.user.coin, 0) : 0);
    client.sendPacket(this.cmd.INFO_MONEY_AFTER_BANKER_SELL, 0, writer.toBuffer());
  }

  _sendLeaveRoomRegisterAck(client, isRegistered, nickname) {
    const writer = new BinaryWriter();
    writer.writeBool(!!isRegistered);
    writer.writeString(nickname || "");
    client.sendPacket(this.cmd.DANG_KY_THOAT_PHONG, 0, writer.toBuffer());
  }

  _sendQuitRoom(client, reason = 0) {
    const writer = new BinaryWriter();
    writer.writeByte(safeInt(reason, 0));
    client.sendPacket(this.cmd.QUIT_ROOM, 0, writer.toBuffer());
  }

  _removeClientFromRoom(client, reason = 0, notifyClient = true) {
    if (!client || !client.id) return;
    const roomId = this.clientRoom.get(client.id);
    if (!roomId) return;
    const room = this.rooms.get(roomId);
    if (!room) {
      this.clientRoom.delete(client.id);
      return;
    }
    room.clients.delete(client.id);
    this.clientRoom.delete(client.id);
    this.clientLeaveRegistered.delete(client.id);
    if (notifyClient) {
      this._sendQuitRoom(client, reason);
    }
    if (client.user) {
      this._broadcastUserOut(room, String(client.user.nickname || ""), client.id);
    }
  }

  _getClientRoom(client) {
    if (!client || !client.id) return null;
    const roomId = this.clientRoom.get(client.id);
    if (!roomId) return null;
    return this.rooms.get(roomId) || null;
  }

  _getRoomClients(room) {
    const out = [];
    for (const clientId of room.clients) {
      const client = this._findClientById(clientId);
      if (client) out.push(client);
    }
    return out;
  }

  _findClientById(clientId) {
    for (const client of this.clients) {
      if (client.id === clientId) return client;
    }
    return null;
  }

  _getDoorRatio(doorId) {
    if (doorId === 0 || doorId === 1) return 100;
    if (doorId === 2 || doorId === 3) return 400;
    return 300;
  }

  _simulateExternalTraffic(room) {
    if (!this.enableBotTraffic) return;
    if (!room || room.action !== ACTION.BETTING) return;
    if (room.remainTime <= 0) return;

    const roomClients = this._getRoomClients(room);
    if (!roomClients.length) return;

    const burst = randInt(this.botBurstMin, this.botBurstMax);
    if (!Number.isFinite(burst) || burst <= 0) return;

    const step = Math.max(1, safeInt(room.moneyBet, 1000));
    for (let i = 0; i < burst; i += 1) {
      const potId = randInt(0, DOOR_COUNT - 1);
      const amountRaw = randInt(this.botBetMin, this.botBetMax);
      const amount = normalizeByStep(amountRaw, step);

      room.potValues[potId] += amount;
      this._broadcastPutMoney(
        room,
        0,
        this._pickBotNickname(),
        amount,
        potId,
        room.potValues[potId],
        randInt(5000000, 5000000000)
      );
    }
  }

  _pickBotNickname() {
    if (!Array.isArray(this.botNicknames) || this.botNicknames.length === 0) {
      return "BOT_XD";
    }
    const idx = randInt(0, this.botNicknames.length - 1);
    return this.botNicknames[idx] || "BOT_XD";
  }

  async _createSessionDoc(room) {
    const doc = await XocDiaSession.create({
      referenceId: room.referenceId,
      roomId: room.id,
      phase: this._phaseByAction(room.action),
      action: room.action,
      remainTime: room.remainTime,
      potValues: room.potValues.slice(),
      diceIds: room.diceIds.slice(),
      resultEven: false,
      startedAt: new Date()
    });
    room.sessionDocId = doc._id;
  }

  async _persistSessionState(room, settled = false) {
    if (!room.sessionDocId) return;
    const sum = room.diceIds.reduce((acc, item) => acc + safeInt(item, 0), 0);
    const update = {
      phase: this._phaseByAction(room.action),
      action: room.action,
      remainTime: room.remainTime,
      potValues: room.potValues.slice()
    };
    if (settled) {
      update.diceIds = room.diceIds.slice();
      update.resultEven = sum % 2 === 0;
      update.settledAt = new Date();
    }
    await XocDiaSession.updateOne({ _id: room.sessionDocId }, { $set: update }).catch(() => {});
  }

  async _markSessionEnded(room) {
    if (!room.sessionDocId) return;
    await XocDiaSession.updateOne(
      { _id: room.sessionDocId },
      {
        $set: {
          endedAt: new Date(),
          remainTime: 0
        }
      }
    ).catch(() => {});
  }

  _phaseByAction(action) {
    if (action === ACTION.START) return "start";
    if (action === ACTION.BETTING) return "betting";
    if (action === ACTION.REFUND) return "refund";
    return "result";
  }

  _resolveControlRoom(roomId) {
    const id = safeInt(roomId, 0);
    if (id > 0 && this.rooms.has(id)) {
      return this.rooms.get(id);
    }
    for (const room of this.rooms.values()) {
      return room;
    }
    throw new Error("xocdia room not initialized");
  }

  setForcedNextResult(payload = {}) {
    const room = this._resolveControlRoom(payload.roomId);
    const source = Array.isArray(payload.diceIds)
      ? payload.diceIds
      : [payload.dice1, payload.dice2, payload.dice3, payload.dice4];
    const dices = source.map((item) => safeInt(item, -1));
    if (dices.length !== 4 || !dices.every((item) => item === 0 || item === 1)) {
      throw new Error("dice must be 4 integers with value 0 or 1");
    }
    room.forcedNextResult = { diceIds: dices.slice(0, 4) };
    return this.getControlSnapshot(room.id);
  }

  clearForcedNextResult(payload = {}) {
    const room = this._resolveControlRoom(payload.roomId);
    room.forcedNextResult = null;
    return this.getControlSnapshot(room.id);
  }

  getControlSnapshot(roomId) {
    const room = this._resolveControlRoom(roomId);
    return {
      game: "xocdia",
      roomId: Number(room.id || 0),
      referenceId: Number(room.referenceId || 0),
      phase: this._phaseByAction(room.action),
      action: Number(room.action || 0),
      bettingState: room.action === ACTION.BETTING,
      remainTime: Number(room.remainTime || 0),
      forcedNextResult: room.forcedNextResult
        ? {
            diceIds: Array.isArray(room.forcedNextResult.diceIds)
              ? room.forcedNextResult.diceIds.slice(0, 4).map((item) => safeInt(item, 0))
              : null
          }
        : null
    };
  }
}

module.exports = XocDiaEngine;


