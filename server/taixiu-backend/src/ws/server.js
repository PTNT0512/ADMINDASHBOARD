"use strict";

const WebSocket = require("ws");
const BinaryReader = require("../protocol/binary-reader");
const { parseClientPacket, buildServerPacket } = require("../protocol/packet");
const { CONTROLLER_ID, LOGIN_CMD } = require("../protocol/constants");
const userService = require("../services/user-service");

function createClientContext(ws) {
  const id = `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  return {
    id,
    ws,
    user: null,
    isOpen() {
      return this.ws && this.ws.readyState === WebSocket.OPEN;
    },
    sendPacket(cmdId, error = 0, payload = Buffer.alloc(0)) {
      if (!this.isOpen()) return;
      const packet = buildServerPacket({
        controllerId: CONTROLLER_ID,
        cmdId,
        error,
        payload,
        framed: false
      });
      this.ws.send(packet);
    }
  };
}

function parseLoginPayload(payload) {
  const reader = new BinaryReader(payload);
  const nickname = reader.readString();
  const accessToken = reader.readString();
  return { nickname, accessToken };
}

function createWsServer({ httpServer, wsPath, engines, defaultCoin }) {
  const wss = new WebSocket.Server({
    server: httpServer,
    path: wsPath
  });

  const clients = new Set();

async function routeCommand(client, packet) {
    if (packet.cmdId === LOGIN_CMD) {
      let login;
      try {
        login = parseLoginPayload(packet.payload);
      } catch (error) {
        client.sendPacket(LOGIN_CMD, 1);
        return;
      }

      try {
        const user = await userService.findOrCreateUser({
          nickname: login.nickname,
          accessToken: login.accessToken,
          defaultCoin
        });
        client.user = user;
        console.log(`[ws] login ok: client=${client.id} user=${user.nickname}`);
        client.sendPacket(LOGIN_CMD, 0);
      } catch (error) {
        console.error("[ws] login error:", error.message);
        client.sendPacket(LOGIN_CMD, 1);
      }
      return;
    }

    const gameHandlers = [
      engines.double ? { engine: engines.double, cmd: engines.double.cmd } : null,
      engines.md5 ? { engine: engines.md5, cmd: engines.md5.cmd } : null
    ].filter(Boolean);

    for (const item of gameHandlers) {
      const { engine, cmd } = item;
      if (packet.cmdId === cmd.SUBSCRIBE) {
        await engine.handleSubscribe(client, packet.payload);
        return;
      }
      if (packet.cmdId === cmd.UNSUBSCRIBE) {
        engine.handleUnsubscribe(client);
        return;
      }
      if (packet.cmdId === cmd.BET) {
        await engine.handleBet(client, packet.payload);
        return;
      }
      if (packet.cmdId === cmd.SUBSCRIBE_CHAT) {
        await engine.handleSubscribeChat(client);
        return;
      }
      if (packet.cmdId === cmd.UNSUBSCRIBE_CHAT) {
        engine.handleUnsubscribeChat(client);
        return;
      }
      if (packet.cmdId === cmd.SEND_CHAT) {
        await engine.handleSendChat(client, packet.payload);
        return;
      }
    }

    if (engines.baucua) {
      const cmd = engines.baucua.cmd;
      if (packet.cmdId === cmd.SUBSCRIBE) {
        await engines.baucua.handleSubscribe(client, packet.payload);
        return;
      }
      if (packet.cmdId === cmd.UNSUBSCRIBE) {
        engines.baucua.handleUnsubscribe(client);
        return;
      }
      if (packet.cmdId === cmd.CHANGE_ROOM) {
        engines.baucua.handleChangeRoom(client, packet.payload);
        return;
      }
      if (packet.cmdId === cmd.BET) {
        await engines.baucua.handleBet(client, packet.payload);
        return;
      }
    }

    if (engines.minipoker) {
      const cmd = engines.minipoker.cmd;
      if (packet.cmdId === cmd.SUBSCRIBE) {
        await engines.minipoker.handleSubscribe(client, packet.payload);
        return;
      }
      if (packet.cmdId === cmd.UNSUBSCRIBE) {
        engines.minipoker.handleUnsubscribe(client);
        return;
      }
      if (packet.cmdId === cmd.CHANGE_ROOM) {
        engines.minipoker.handleChangeRoom(client, packet.payload);
        return;
      }
      if (packet.cmdId === cmd.SPIN) {
        await engines.minipoker.handleSpin(client, packet.payload);
        return;
      }
    }

    if (engines.xocdia) {
      const cmd = engines.xocdia.cmd;
      if (packet.cmdId === cmd.GET_LIST_ROOM) {
        await engines.xocdia.handleGetListRoom(client, packet.payload);
        return;
      }
      if (packet.cmdId === cmd.JOIN_ROOM_BY_ID) {
        await engines.xocdia.handleJoinRoomById(client, packet.payload);
        return;
      }
      if (packet.cmdId === cmd.RECONNECT_ROOM) {
        await engines.xocdia.handleReconnect(client, packet.payload);
        return;
      }
      if (packet.cmdId === cmd.PUT_MONEY) {
        await engines.xocdia.handlePutMoney(client, packet.payload);
        return;
      }
      if (packet.cmdId === cmd.BANKER_SELL_GATE) {
        await engines.xocdia.handleBankerSellGate(client, packet.payload);
        return;
      }
      if (packet.cmdId === cmd.BUY_GATE) {
        await engines.xocdia.handleBuyGate(client, packet.payload);
        return;
      }
      if (packet.cmdId === cmd.SOI_CAU) {
        await engines.xocdia.handleGetCau(client, packet.payload);
        return;
      }
      if (packet.cmdId === cmd.REQUEST_INFO_MOI_CHOI) {
        await engines.xocdia.handleRequestInfoMoiChoi(client, packet.payload);
        return;
      }
      if (packet.cmdId === cmd.MOI_CHOI) {
        await engines.xocdia.handleMoiChoi(client, packet.payload);
        return;
      }
      if (packet.cmdId === cmd.ACCEPT_MOI_CHOI) {
        await engines.xocdia.handleAcceptMoiChoi(client, packet.payload);
        return;
      }
      if (packet.cmdId === cmd.DANG_KY_THOAT_PHONG) {
        await engines.xocdia.handleLeaveRoomRegister(client, packet.payload);
        return;
      }
      if (packet.cmdId === cmd.ORDER_BANKER) {
        await engines.xocdia.handleOrderBanker(client, packet.payload);
        return;
      }
      if (packet.cmdId === cmd.HUY_LAM_CAI) {
        await engines.xocdia.handleCancelBanker(client, packet.payload);
        return;
      }
      if (packet.cmdId === cmd.CHAT_MS) {
        await engines.xocdia.handleChat(client, packet.payload);
        return;
      }
    }

    console.log(`[ws] unhandled cmd: client=${client.id} cmdId=${packet.cmdId}`);
  }

  wss.on("connection", (ws, req) => {
    const client = createClientContext(ws);
    clients.add(client);
    const remote = req && req.socket ? req.socket.remoteAddress : "unknown";
    console.log(`[ws] connected: ${client.id} from ${remote}`);

    ws.on("message", (data) => {
      let packet;
      try {
        packet = parseClientPacket(data);
      } catch (error) {
        console.error(`[ws] parse error (${client.id}):`, error.message);
        return;
      }
      void routeCommand(client, packet);
    });

    ws.on("close", () => {
      clients.delete(client);
      if (engines.double) engines.double.detachClient(client);
      if (engines.md5) engines.md5.detachClient(client);
      if (engines.baucua) engines.baucua.detachClient(client);
      if (engines.minipoker) engines.minipoker.detachClient(client);
      if (engines.xocdia) engines.xocdia.detachClient(client);
      console.log(`[ws] closed: ${client.id}`);
    });

    ws.on("error", (error) => {
      console.error(`[ws] error (${client.id}):`, error.message);
    });
  });

  return {
    wss,
    clients
  };
}

module.exports = {
  createWsServer
};
