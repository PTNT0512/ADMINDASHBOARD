"use strict";

const mongoose = require("mongoose");

const XocDiaBetSchema = new mongoose.Schema(
  {
    referenceId: { type: Number, required: true, index: true },
    roomId: { type: Number, required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "TxUser", required: true, index: true },
    nickname: { type: String, required: true, index: true },
    doorId: { type: Number, required: true, min: 0, max: 5 },
    amount: { type: Number, required: true, default: 0 },
    payout: { type: Number, required: true, default: 0 },
    netExchange: { type: Number, required: true, default: 0 },
    currentMoney: { type: Number, required: true, default: 0 },
    status: { type: String, enum: ["pending", "win", "lose"], default: "pending", index: true },
    settledAt: { type: Date, default: null }
  },
  {
    timestamps: true,
    collection: "xd_bets"
  }
);

XocDiaBetSchema.index({ nickname: 1, createdAt: -1 });
XocDiaBetSchema.index({ referenceId: 1, userId: 1, createdAt: -1 });

module.exports = mongoose.model("XocDiaBet", XocDiaBetSchema);
