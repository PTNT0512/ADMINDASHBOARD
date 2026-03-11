"use strict";

const http = require("http");
const config = require("./config");
const { connectMongo } = require("./db/mongoose");
const { createHttpApp } = require("./http/server");
const { createWsServer } = require("./ws/server");
const GameEngine = require("./services/game-engine");
const BauCuaEngine = require("./services/baucua-engine");
const MiniPokerEngine = require("./services/minipoker-engine");
const XocDiaEngine = require("./services/xocdia-engine");
const { GAME, DOUBLE_CMD, MD5_CMD, BAUCUA_CMD, MINIPOKER_CMD, XOCDIA_CMD, MONEY_TYPE } = require("./protocol/constants");

async function bootstrap() {
  await connectMongo(config.mongo.uri);
  console.log("[mongo] connected");

  const doubleEngine = new GameEngine({
    gameKey: GAME.DOUBLE.key,
    gameId: GAME.DOUBLE.gameId,
    cmd: DOUBLE_CMD,
    moneyType: MONEY_TYPE,
    betDurationSec: config.game.double.betDurationSec,
    resultDurationSec: config.game.double.resultDurationSec,
    historyLimit: config.game.historyLimit,
    defaultCoin: config.game.defaultCoin,
    enableJackpot: config.game.double.enableJackpot
  });

  const md5Engine = new GameEngine({
    gameKey: GAME.MD5.key,
    gameId: GAME.MD5.gameId,
    cmd: MD5_CMD,
    moneyType: MONEY_TYPE,
    betDurationSec: config.game.md5.betDurationSec,
    resultDurationSec: config.game.md5.resultDurationSec,
    historyLimit: config.game.historyLimit,
    defaultCoin: config.game.defaultCoin,
    enableJackpot: false,
    allowBothDoors: true
  });

  const baucuaEngine = new BauCuaEngine({
    cmd: BAUCUA_CMD,
    betDurationSec: config.game.baucua.betDurationSec,
    resultDurationSec: config.game.baucua.resultDurationSec,
    historyLimit: config.game.historyLimit,
    defaultCoin: config.game.defaultCoin
  });

  const miniPokerEngine = new MiniPokerEngine({
    cmd: MINIPOKER_CMD,
    historyLimit: config.game.historyLimit,
    defaultCoin: config.game.defaultCoin
  });

  const xocdiaEngine = new XocDiaEngine({
    cmd: XOCDIA_CMD,
    startDurationSec: config.game.xocdia.startDurationSec,
    betDurationSec: config.game.xocdia.betDurationSec,
    refundDurationSec: config.game.xocdia.refundDurationSec,
    resultDurationSec: config.game.xocdia.resultDurationSec,
    enableBotTraffic: config.game.xocdia.enableBotTraffic,
    botBetMin: config.game.xocdia.botBetMin,
    botBetMax: config.game.xocdia.botBetMax,
    botBurstMin: config.game.xocdia.botBurstMin,
    botBurstMax: config.game.xocdia.botBurstMax,
    historyLimit: config.game.historyLimit,
    defaultCoin: config.game.defaultCoin
  });

  await doubleEngine.init();
  await md5Engine.init();
  await baucuaEngine.init();
  await miniPokerEngine.init();
  await xocdiaEngine.init();

  const engines = {
    double: doubleEngine,
    md5: md5Engine,
    baucua: baucuaEngine,
    minipoker: miniPokerEngine,
    xocdia: xocdiaEngine
  };

  const httpApp = createHttpApp({
    enableWebClient: config.app.enableWebClient,
    webRoot: config.app.webRoot,
    publicClientConfig: config.app.publicClient,
    engines
  });
  const httpServer = http.createServer(httpApp);
  createWsServer({
    httpServer,
    wsPath: config.app.wsPath,
    engines,
    defaultCoin: config.game.defaultCoin
  });

  doubleEngine.start();
  md5Engine.start();
  baucuaEngine.start();
  miniPokerEngine.start();
  xocdiaEngine.start();

  httpServer.listen(config.app.port, config.app.host, () => {
    console.log(`[server] HTTP+WS listening at http://${config.app.host}:${config.app.port}`);
    console.log(`[server] WS path: ${config.app.wsPath}`);
    const webClient = httpApp.locals && httpApp.locals.webClient ? httpApp.locals.webClient : null;
    if (webClient && webClient.enabled) {
      console.log(`[server] web client: enabled (${webClient.root})`);
      console.log(`[server] routes: /dev /taixiudouble /taixiumd5 /minipoker /baucua /xocdia`);
    } else {
      console.log("[server] web client: disabled or build path not found");
    }
    console.log(`[server] double: gameId=${GAME.DOUBLE.gameId}, bet=${config.game.double.betDurationSec}s, result=${config.game.double.resultDurationSec}s`);
    console.log(`[server] md5: gameId=${GAME.MD5.gameId}, bet=${config.game.md5.betDurationSec}s, result=${config.game.md5.resultDurationSec}s`);
    console.log(`[server] baucua: gameId=${GAME.BAUCUA.gameId}, bet=${config.game.baucua.betDurationSec}s, result=${config.game.baucua.resultDurationSec}s`);
    console.log(`[server] minipoker: gameId=${GAME.MINIPOKER.gameId}`);
    console.log(`[server] xocdia: gameId=${GAME.XOCDIA.gameId}, start=${config.game.xocdia.startDurationSec}s, bet=${config.game.xocdia.betDurationSec}s, refund=${config.game.xocdia.refundDurationSec}s, result=${config.game.xocdia.resultDurationSec}s`);
    console.log(
      `[server] xocdia-bot: enabled=${config.game.xocdia.enableBotTraffic}, ` +
        `betRange=${config.game.xocdia.botBetMin}-${config.game.xocdia.botBetMax}, ` +
        `burst=${config.game.xocdia.botBurstMin}-${config.game.xocdia.botBurstMax}`
    );
  });

  const shutdown = async (signal) => {
    console.log(`[server] shutting down (${signal})...`);
    doubleEngine.stop();
    md5Engine.stop();
    baucuaEngine.stop();
    miniPokerEngine.stop();
    xocdiaEngine.stop();
    await new Promise((resolve) => httpServer.close(resolve));
    process.exit(0);
  };

  process.on("SIGINT", () => {
    void shutdown("SIGINT");
  });
  process.on("SIGTERM", () => {
    void shutdown("SIGTERM");
  });
}

bootstrap().catch((error) => {
  console.error("[server] bootstrap failed:", error);
  process.exit(1);
});



