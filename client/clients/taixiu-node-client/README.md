# TaiXiu Node Client (Extracted)

This folder is a standalone Node.js client extracted from the existing Cocos sources:

- `assets/TaiXiuDouble/TaiXiuScript/TaiXiu1/TaiXiuMini.Cmd.ts`
- `assets/TaiXiuDouble/TaiXiuScript/TaiXiu2/TaiXiuMini2.Cmd.ts`
- `assets/TaiXiuMD5/TaiXiuScript/TaiXiu1/TaiXiuMD5.Cmd.ts`
- `assets/Lobby/LobbyScript/Script/networks/Network.InPacket.ts`
- `assets/Lobby/LobbyScript/Script/networks/Network.OutPacket.ts`

It is isolated from UI and Cocos runtime so you can build/convert your server logic in Node.js.

## Features

- WebSocket base client with reconnect support
- Login packet (`cmd=1`) compatible with the old client format
- TaiXiuDouble command set (`2000..2200` and chat `18000..18003`)
- TaiXiuMD5 command set (`22000..22116` and chat `23100..23103`)
- Packet decode helpers for all key server messages
- CLI example to connect/subscribe/bet quickly

## Install

```bash
cd clients/taixiu-node-client
npm install
```

## Quick Run

Double:

```bash
node examples/run-client.js --game=double --host=127.0.0.1 --port=8080 --nickname=test --token=abc --secure=false
```

MD5:

```bash
node examples/run-client.js --game=md5 --host=127.0.0.1 --port=8080 --nickname=test --token=abc --secure=false
```

Optional flags:

- `--autoSubscribe=true|false` (default `true`)
- `--chat=true|false`
- `--betAmount=1000 --betDoor=tai --betDelayMs=3000`

## Programmatic Usage

```js
const { TaiXiuMd5Client } = require("./src");

const client = new TaiXiuMd5Client({
  host: "127.0.0.1",
  port: 8080,
  secure: false,
  nickname: "test",
  accessToken: "abc"
});

client.on("login", (info) => {
  if (info.success) client.subscribe();
});

client.on("message_decoded", (msg) => {
  console.log(msg.event, msg.data);
});

client.connect();
```

## Command Mapping

TaiXiuDouble:

- Subscribe: `2000`
- Unsubscribe: `2001`
- Bet: `2110`
- GameInfo: `2111`
- UpdateTime: `2112`
- DicesResult: `2113`
- Result: `2114`
- NewGame: `2115`
- Histories: `2116`
- Jackpot: `2199`
- Refund: `2200`

TaiXiuMD5:

- Subscribe: `22000`
- Unsubscribe: `22001`
- Bet: `22110`
- GameInfo: `22111`
- UpdateTime: `22112`
- DicesResult: `22113`
- Result: `22114`
- NewGame: `22115`
- Histories: `22116`

## Notes

- This extraction keeps packet structure compatible with the old client protocol.
- Incoming packets are decoded in a tolerant mode (with/without frame header).
- `int64` values are normalized to `number` when safe, otherwise returned as `string`.
