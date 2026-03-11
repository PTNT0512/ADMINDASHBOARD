const EventEmitter = require("events");
const WebSocket = require("ws");
const BinaryWriter = require("../protocol/binary-writer");
const { buildClientPacket, parseServerPacket, bufferFromAny } = require("../protocol/packet");
const { DEFAULTS, LOGIN_CMD } = require("../protocol/constants");

class BaseWsClient extends EventEmitter {
  constructor(options = {}) {
    super();
    this.host = options.host || "";
    this.port = Number(options.port ?? 443);
    this.secure = options.secure !== false;
    this.path = options.path || "/websocket";
    this.controllerId = Number(options.controllerId ?? DEFAULTS.CONTROLLER_ID);
    this.nickname = options.nickname || "";
    this.accessToken = options.accessToken || "";
    this.autoLogin = options.autoLogin !== false;
    this.reconnect = options.reconnect !== false;
    this.reconnectDelayMs = Number(options.reconnectDelayMs ?? 2000);
    this.label = options.label || "ws-client";

    this.ws = null;
    this.loggedIn = false;
    this.manualClose = false;
    this._connectLock = false;
  }

  get url() {
    const protocol = this.secure ? "wss" : "ws";
    return `${protocol}://${this.host}:${this.port}${this.path}`;
  }

  connect() {
    if (!this.host) {
      throw new Error(`[${this.label}] host is required.`);
    }
    if (this._connectLock) {
      return;
    }
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    this._connectLock = true;
    this.manualClose = false;
    this.ws = new WebSocket(this.url);
    this.ws.binaryType = "arraybuffer";

    this.ws.on("open", () => {
      this._connectLock = false;
      this.emit("open", { url: this.url });
      if (this.autoLogin && this.nickname && this.accessToken) {
        this.login(this.nickname, this.accessToken);
      }
    });

    this.ws.on("message", (data) => {
      this.handleRawMessage(data);
    });

    this.ws.on("error", (error) => {
      this.emit("error", error);
    });

    this.ws.on("close", (code, reason) => {
      this._connectLock = false;
      this.loggedIn = false;
      this.emit("close", { code, reason: String(reason || "") });
      if (this.reconnect && !this.manualClose) {
        setTimeout(() => {
          if (!this.manualClose) {
            this.connect();
          }
        }, this.reconnectDelayMs);
      }
    });
  }

  close() {
    this.manualClose = true;
    if (!this.ws) {
      return;
    }
    this.ws.close();
    this.ws = null;
  }

  isConnected() {
    return Boolean(this.ws && this.ws.readyState === WebSocket.OPEN);
  }

  buildPayload(builder) {
    if (!builder) {
      return Buffer.alloc(0);
    }
    if (typeof builder === "function") {
      const writer = new BinaryWriter();
      builder(writer);
      return writer.toBuffer();
    }
    return bufferFromAny(builder);
  }

  send(cmdId, payloadBuilder, options = {}) {
    if (!this.isConnected()) {
      throw new Error(`[${this.label}] WebSocket is not connected.`);
    }
    const payload = this.buildPayload(payloadBuilder);
    const packet = buildClientPacket({
      controllerId: Number(options.controllerId ?? this.controllerId),
      cmdId: Number(cmdId),
      payload,
      isCompress: Boolean(options.isCompress)
    });
    this.ws.send(packet);
    this.emit("sent", { cmdId, payloadSize: payload.length });
  }

  login(nickname, accessToken) {
    this.nickname = String(nickname ?? this.nickname);
    this.accessToken = String(accessToken ?? this.accessToken);
    this.send(LOGIN_CMD, (writer) => {
      writer.writeString(this.nickname);
      writer.writeString(this.accessToken);
    });
  }

  handleRawMessage(data) {
    let packet;
    try {
      packet = parseServerPacket(data);
    } catch (error) {
      this.emit("parse_error", { error, data });
      return;
    }

    this.emit("packet", packet);
    this.handlePacket(packet);
  }

  handlePacket(packet) {
    if (packet.cmdId === LOGIN_CMD) {
      this.loggedIn = packet.error === 0;
      this.emit("login", {
        success: this.loggedIn,
        error: packet.error
      });
      return;
    }
    this.emit("message", packet);
  }
}

module.exports = BaseWsClient;
