"use strict";

const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema(
  {
    nickname: { type: String, required: true, trim: true, unique: true, index: true },
    accessToken: { type: String, default: "" },
    coin: { type: Number, default: 1000000000 },
    vipPoint: { type: Number, default: 0 },
    userType: { type: Number, default: 0 },
    bannedChatUntil: { type: Date, default: null }
  },
  {
    timestamps: true,
    collection: "tx_users"
  }
);

module.exports = mongoose.model("TxUser", UserSchema);

