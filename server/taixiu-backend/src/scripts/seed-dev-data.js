"use strict";

require("../../../../src/load-shared-env.js").loadAdminAppEnv({
  includeMode: false,
  includeApiBank: false,
  extraPaths: [
    require("path").resolve(__dirname, "../../.env"),
    require("path").resolve(process.cwd(), ".env"),
  ],
});

const { connectMongo } = require("../db/mongoose");
const User = require("../db/models/User");

async function run() {
  const uri = process.env.TAIXIU_MONGODB_URI || process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/taixiu_dev";
  await connectMongo(uri);

  const users = [
    { nickname: "dev_player", accessToken: "dev_token", coin: 1000000000, vipPoint: 0, userType: 0 },
    { nickname: "test1", accessToken: "token_test1", coin: 500000000, vipPoint: 10, userType: 0 },
    { nickname: "test2", accessToken: "token_test2", coin: 500000000, vipPoint: 20, userType: 0 }
  ];

  for (const user of users) {
    await User.updateOne(
      { nickname: user.nickname },
      { $set: user, $setOnInsert: { createdAt: new Date() } },
      { upsert: true }
    );
  }

  console.log(`[seed] done (${users.length} users).`);
  process.exit(0);
}

run().catch((error) => {
  console.error("[seed] failed:", error);
  process.exit(1);
});
