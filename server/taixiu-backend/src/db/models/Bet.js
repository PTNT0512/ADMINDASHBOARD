"use strict";

const mongoose = require("mongoose");

const BetSchema = new mongoose.Schema(
  {
    gameKey: { type: String, enum: ["double", "md5"], required: true, index: true },
    gameId: { type: Number, required: true },
    referenceId: { type: Number, required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "TxUser", required: true, index: true },
    nickname: { type: String, required: true, index: true },
    door: { type: Number, enum: [0, 1], required: true },
    amount: { type: Number, required: true },
    moneyType: { type: Number, required: true, default: 1 },
    remainTimeAtBet: { type: Number, required: true, default: 0 },
    status: { type: String, enum: ["pending", "win", "lose", "refund"], default: "pending", index: true },
    payout: { type: Number, default: 0 },
    settledAt: { type: Date, default: null }
  },
  {
    timestamps: true,
    collection: "tx_bets"
  }
);

BetSchema.index({ gameKey: 1, referenceId: 1, status: 1 });

module.exports = mongoose.model("TxBet", BetSchema);

