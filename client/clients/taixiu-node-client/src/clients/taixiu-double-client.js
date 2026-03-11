const BaseWsClient = require("./base-ws-client");
const BinaryReader = require("../protocol/binary-reader");
const { DEFAULTS, DOUBLE_CMD } = require("../protocol/constants");
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

class TaiXiuDoubleClient extends BaseWsClient {
  constructor(options = {}) {
    super({
      ...options,
      label: options.label || "taixiu-double-client"
    });
    this.moneyType = Number(options.moneyType ?? DEFAULTS.MONEY_TYPE);
    this.gameId = Number(options.gameId ?? DEFAULTS.TAI_XIU_GAME_ID);
  }

  subscribe({ gameId = this.gameId, moneyType = this.moneyType } = {}) {
    this.send(DOUBLE_CMD.SCRIBE, (writer) => {
      writer.writeShort(gameId);
      writer.writeShort(moneyType);
    });
  }

  unsubscribe({ gameId = this.gameId, moneyType = this.moneyType } = {}) {
    this.send(DOUBLE_CMD.UNSCRIBE, (writer) => {
      writer.writeShort(gameId);
      writer.writeShort(moneyType);
    });
  }

  subscribeChat() {
    this.send(DOUBLE_CMD.SCRIBE_CHAT);
  }

  unsubscribeChat() {
    this.send(DOUBLE_CMD.UNSCRIBE_CHAT);
  }

  sendChat(message) {
    this.send(DOUBLE_CMD.SEND_CHAT, (writer) => {
      writer.writeString(message);
    });
  }

  bet({ referenceId, amount, door, remainTime = 0, moneyType = this.moneyType }) {
    const betDoor = normalizeDoor(door);
    this.send(DOUBLE_CMD.BET, (writer) => {
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
      case DOUBLE_CMD.GAME_INFO: {
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
          remainTimeRutLoc: reader.readShort()
        };
        if (reader.remaining() >= 16) {
          data.jpTai = normalizeLong(reader.readLong());
          data.jpXiu = normalizeLong(reader.readLong());
        }
        break;
      }
      case DOUBLE_CMD.UPDATE_TIME:
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
      case DOUBLE_CMD.DICES_RESULT:
        event = "dices_result";
        data = {
          result: reader.readShort(),
          dice1: reader.readShort(),
          dice2: reader.readShort(),
          dice3: reader.readShort()
        };
        break;
      case DOUBLE_CMD.RESULT:
        event = "result";
        data = {
          moneyType: reader.readShort(),
          totalMoney: normalizeLong(reader.readLong()),
          currentMoney: normalizeLong(reader.readLong())
        };
        break;
      case DOUBLE_CMD.NEW_GAME:
        event = "new_game";
        data = {
          referenceId: normalizeLong(reader.readLong()),
          remainTimeRutLoc: reader.readShort()
        };
        if (reader.remaining() >= 16) {
          data.jpTai = normalizeLong(reader.readLong());
          data.jpXiu = normalizeLong(reader.readLong());
        }
        break;
      case DOUBLE_CMD.HISTORIES: {
        event = "histories";
        data = decodeHistories(reader.readString());
        break;
      }
      case DOUBLE_CMD.REFUND:
        event = "refund";
        data = {
          moneyRefund: normalizeLong(reader.readLong())
        };
        break;
      case DOUBLE_CMD.JACKPOT:
        event = "jackpot";
        data = {
          idSession: normalizeLong(reader.readLong()),
          jackpot: normalizeLong(reader.readLong()),
          nickname: reader.readString()
        };
        break;
      case DOUBLE_CMD.BET:
        event = "bet_ack";
        data = {
          result: packet.error,
          currentMoney: normalizeLong(reader.readLong())
        };
        break;
      case DOUBLE_CMD.LOG_CHAT:
      case DOUBLE_CMD.SCRIBE_CHAT:
        event = "chat_log";
        data = {
          message: reader.readString(),
          minVipPoint: reader.readByte(),
          timeBan: normalizeLong(reader.readLong()),
          userType: reader.readByte()
        };
        break;
      case DOUBLE_CMD.SEND_CHAT:
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

module.exports = TaiXiuDoubleClient;
