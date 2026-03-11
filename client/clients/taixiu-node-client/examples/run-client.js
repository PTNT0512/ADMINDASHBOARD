#!/usr/bin/env node
const { TaiXiuDoubleClient, TaiXiuMd5Client } = require("../src");

function parseArgs(argv) {
  const out = {};
  for (const item of argv) {
    if (!item.startsWith("--")) continue;
    const [key, rawValue] = item.slice(2).split("=");
    out[key] = rawValue === undefined ? true : rawValue;
  }
  return out;
}

function parseBool(input, fallback) {
  if (input === undefined) return fallback;
  const value = String(input).toLowerCase();
  if (value === "true" || value === "1") return true;
  if (value === "false" || value === "0") return false;
  return fallback;
}

function stringifySafe(payload) {
  return JSON.stringify(
    payload,
    (_, value) => (typeof value === "bigint" ? value.toString() : value),
    2
  );
}

function usage() {
  console.log("Usage:");
  console.log("  node examples/run-client.js --game=double|md5 --host=127.0.0.1 --port=8080 --nickname=test --token=abc");
  console.log("Optional:");
  console.log("  --secure=true|false (default false)");
  console.log("  --moneyType=1");
  console.log("  --autoSubscribe=true|false (default true)");
  console.log("  --chat=true|false (subscribe chat after login)");
  console.log("  --betAmount=1000 --betDoor=tai|xiu --betDelayMs=3000");
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || args.h) {
    usage();
    return;
  }

  const game = String(args.game || "").toLowerCase();
  if (game !== "double" && game !== "md5") {
    console.error("Missing or invalid --game. Use double or md5.");
    usage();
    process.exitCode = 1;
    return;
  }

  if (!args.host) {
    console.error("Missing --host.");
    usage();
    process.exitCode = 1;
    return;
  }

  const commonOptions = {
    host: String(args.host),
    port: Number(args.port ?? 443),
    secure: parseBool(args.secure, false),
    nickname: String(args.nickname ?? ""),
    accessToken: String(args.token ?? ""),
    autoLogin: true,
    reconnect: parseBool(args.reconnect, true)
  };

  const client =
    game === "double"
      ? new TaiXiuDoubleClient({
          ...commonOptions,
          moneyType: Number(args.moneyType ?? 1)
        })
      : new TaiXiuMd5Client({
          ...commonOptions,
          moneyType: Number(args.moneyType ?? 1)
        });

  const autoSubscribe = parseBool(args.autoSubscribe, true);
  const chat = parseBool(args.chat, false);
  const betAmount = args.betAmount !== undefined ? Number(args.betAmount) : null;
  const betDoor = args.betDoor;
  const betDelayMs = Number(args.betDelayMs ?? 3000);

  let lastReferenceId = null;
  let lastRemainTime = 0;

  client.on("open", ({ url }) => {
    console.log(`[open] ${url}`);
  });

  client.on("close", ({ code, reason }) => {
    console.log(`[close] code=${code} reason=${reason}`);
  });

  client.on("error", (error) => {
    console.error("[error]", error.message);
  });

  client.on("parse_error", ({ error }) => {
    console.error("[parse_error]", error.message);
  });

  client.on("login", (loginInfo) => {
    console.log("[login]", stringifySafe(loginInfo));
    if (!loginInfo.success) {
      return;
    }
    if (autoSubscribe) {
      client.subscribe();
      console.log("[action] subscribe sent");
    }
    if (chat) {
      client.subscribeChat();
      console.log("[action] subscribe chat sent");
    }
  });

  client.on("message_decoded", (message) => {
    console.log(`[${message.event}]`, stringifySafe(message.data));
    if (message.event === "game_info" || message.event === "new_game") {
      lastReferenceId = Number(message.data.referenceId);
      lastRemainTime = Number(message.data.remainTime ?? message.data.remainTimeRutLoc ?? 0);
    }
  });

  if (betAmount !== null && betDoor !== undefined) {
    setTimeout(() => {
      if (!lastReferenceId) {
        console.log("[bet] skipped: no referenceId yet.");
        return;
      }
      try {
        client.bet({
          referenceId: lastReferenceId,
          amount: betAmount,
          door: betDoor,
          remainTime: lastRemainTime
        });
        console.log(
          `[action] bet sent ref=${lastReferenceId} amount=${betAmount} door=${betDoor}`
        );
      } catch (error) {
        console.error("[bet_error]", error.message);
      }
    }, betDelayMs);
  }

  process.on("SIGINT", () => {
    console.log("Closing client...");
    client.close();
    process.exit(0);
  });

  client.connect();
}

main();
