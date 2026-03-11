const BaseWsClient = require("./base-ws-client");
const BinaryReader = require("../protocol/binary-reader");
const { DEFAULTS, MD5_CMD } = require("../protocol/constants");
const { normalizeLong, parseJsonSafe } = require("../protocol/value");

function normalizeDoor(door) {
  if (typeof door === "string") {
    const v = door.toLowerCase();
    if (v === "tai") return 1;
    if (v === "xiu") return 0;
  }
  if (door === 1 || door === 0) {
    return door;
  }
  throw new Error("door must be 1/'tai' or 0/'xiu'.");
}

function decodeHistories(rawText) {
  const json = parseJsonSafe(rawText);
  return {
    raw: rawText,
    items: Array.isArray(json) ? json : null
  };
}

class TaiXiuMd5Client extends BaseWsClient {
  constructor(options = {}) {
    super({
      ...options,
      label: options.label || "taixiu-md5-client"
    });
    this.moneyType = Number(options.moneyType ?? DEFAULTS.MONEY_TYPE);
    this.gameId = Number(options.gameId ?? DEFAULTS.TAI_XIU_MD5_GAME_ID);
  }

  subscribe({ gameId = this.gameId, moneyType = this.moneyType } = {}) {
    this.send(MD5_CMD.SUBSCRIBE, (writer) => {
      writer.writeShort(gameId);
      writer.writeShort(moneyType);
    });
  }

  unsubscribe({ gameId = this.gameId, moneyType = this.moneyType } = {}) {
    this.send(MD5_CMD.UNSUBSCRIBE, (writer) => {
      writer.writeShort(gameId);
      writer.writeShort(moneyType);
    });
  }

  subscribeChat() {
    this.send(MD5_CMD.SUBSCRIBE_CHAT);
  }

  unsubscribeChat() {
    this.send(MD5_CMD.UNSUBSCRIBE_CHAT);
  }

  sendChat(message) {
    this.send(MD5_CMD.SEND_CHAT, (writer) => {
      writer.writeString(message);
    });
  }

  bet({ referenceId, amount, door, remainTime = 0, moneyType = this.moneyType }) {
    const betDoor = normalizeDoor(door);
    this.send(MD5_CMD.BET, (writer) => {
      writer.writeInt(1);
      writer.writeLong(referenceId);
      writer.writeLong(amount);
      writer.writeShort(moneyType);
      writer.writeShort(betDoor);
      writer.writeShort(remainTime);
    });
  }

  handlePacket(packet) {
    super.handlePacket(packet);
    if (packet.cmdId === 1) {
      return;
    }

    const decoded = this.decodePacket(packet);
    this.emit("message_decoded", decoded);
    this.emit(decoded.event, decoded.data);
  }

  decodePacket(packet) {
    const reader = new BinaryReader(packet.payload);
    let event = "unknown";
    let data = {};

    switch (packet.cmdId) {
      case MD5_CMD.GAME_INFO:
        event = "game_info";
        data = {
          gameId: reader.readShort(),
          moneyType: reader.readShort(),
          referenceId: normalizeLong(reader.readLong()),
          remainTime: reader.readShort(),
          bettingState: reader.readBool(),
          potTai: normalizeLong(reader.readLong()),
          potXiu: normalizeLong(reader.readLong()),
          betTai: normalizeLong(reader.readLong()),
          betXiu: normalizeLong(reader.readLong()),
          dice1: reader.readShort(),
          dice2: reader.readShort(),
          dice3: reader.readShort(),
          remainTimeRutLoc: reader.readShort(),
          md5Code: reader.readString()
        };
        break;
      case MD5_CMD.UPDATE_TIME:
        event = "update_time";
        data = {
          remainTime: reader.readShort(),
          bettingState: reader.readBool(),
          potTai: normalizeLong(reader.readLong()),
          potXiu: normalizeLong(reader.readLong()),
          numBetTai: reader.readShort(),
          numBetXiu: reader.readShort()
        };
        break;
      case MD5_CMD.DICES_RESULT:
        event = "dices_result";
        data = {
          result: reader.readShort(),
          dice1: reader.readShort(),
          dice2: reader.readShort(),
          dice3: reader.readShort(),
          md5Code: reader.readString()
        };
        break;
      case MD5_CMD.RESULT:
        event = "result";
        data = {
          moneyType: reader.readShort(),
          totalMoney: normalizeLong(reader.readLong()),
          currentMoney: normalizeLong(reader.readLong())
        };
        break;
      case MD5_CMD.NEW_GAME:
        event = "new_game";
        data = {
          referenceId: normalizeLong(reader.readLong()),
          remainTimeRutLoc: reader.readShort(),
          md5Code: reader.readString()
        };
        break;
      case MD5_CMD.HISTORIES:
        event = "histories";
        data = decodeHistories(reader.readString());
        break;
      case MD5_CMD.BET:
        event = "bet_ack";
        data = {
          result: packet.error,
          currentMoney: normalizeLong(reader.readLong())
        };
        break;
      case MD5_CMD.LOG_CHAT:
      case MD5_CMD.SUBSCRIBE_CHAT:
        event = "chat_log";
        data = {
          message: reader.readString(),
          minVipPoint: reader.readByte(),
          timeBan: normalizeLong(reader.readLong()),
          userType: reader.readByte()
        };
        break;
      case MD5_CMD.SEND_CHAT:
        event = "chat_send_ack";
        data = {
          error: packet.error,
          nickname: reader.readString(),
          message: reader.readString()
        };
        break;
      default:
        data = {
          payloadHex: packet.payload.toString("hex")
        };
        break;
    }

    return {
      event,
      cmdId: packet.cmdId,
      error: packet.error,
      controllerId: packet.controllerId,
      data
    };
  }
}

module.exports = TaiXiuMd5Client;
