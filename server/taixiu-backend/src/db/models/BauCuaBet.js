"use strict";

const mongoose = require("mongoose");

const BauCuaBetSchema = new mongoose.Schema(
  {
    referenceId: { type: Number, required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "TxUser", required: true, index: true },
    nickname: { type: String, required: true, index: true },
    room: { type: Number, default: 0 },
    betValues: {
      type: [Number],
      default: [0, 0, 0, 0, 0, 0]
    },
    totalBet: { type: Number, required: true, default: 0 },
    prize: { type: Number, required: true, default: 0 },
    status: { type: String, enum: ["pending", "win", "lose"], default: "pending", index: true },
    settledAt: { type: Date, default: null }
  },
  {
    timestamps: true,
    collection: "bc_bets"
  }
);

BauCuaBetSchema.index({ referenceId: 1, userId: 1, createdAt: -1 });

module.exports = mongoose.model("BauCuaBet", BauCuaBetSchema);
