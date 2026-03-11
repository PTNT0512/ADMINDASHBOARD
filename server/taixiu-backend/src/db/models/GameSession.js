"use strict";

const mongoose = require("mongoose");

const GameSessionSchema = new mongoose.Schema(
  {
    gameKey: { type: String, enum: ["double", "md5"], required: true, index: true },
    gameId: { type: Number, required: true, index: true },
    referenceId: { type: Number, required: true },
    phase: { type: String, enum: ["betting", "result"], required: true },
    bettingState: { type: Boolean, required: true },
    remainTime: { type: Number, required: true },
    moneyType: { type: Number, required: true, default: 1 },
    potTai: { type: Number, required: true, default: 0 },
    potXiu: { type: Number, required: true, default: 0 },
    numBetTai: { type: Number, required: true, default: 0 },
    numBetXiu: { type: Number, required: true, default: 0 },
    jackpotTai: { type: Number, required: true, default: 0 },
    jackpotXiu: { type: Number, required: true, default: 0 },
    dice1: { type: Number, default: null },
    dice2: { type: Number, default: null },
    dice3: { type: Number, default: null },
    resultDoor: { type: Number, default: null },
    md5Code: { type: String, default: "" },
    startedAt: { type: Date, required: true },
    resultAt: { type: Date, default: null },
    endedAt: { type: Date, default: null }
  },
  {
    timestamps: true,
    collection: "tx_sessions"
  }
);

GameSessionSchema.index({ gameKey: 1, referenceId: 1 }, { unique: true });
GameSessionSchema.index({ gameKey: 1, createdAt: -1 });

module.exports = mongoose.model("TxGameSession", GameSessionSchema);

