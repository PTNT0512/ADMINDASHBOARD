"use strict";

const mongoose = require("mongoose");

const BauCuaSessionSchema = new mongoose.Schema(
  {
    referenceId: { type: Number, required: true, unique: true, index: true },
    phase: { type: String, enum: ["betting", "result"], required: true },
    bettingState: { type: Boolean, required: true, default: true },
    remainTime: { type: Number, required: true, default: 0 },
    potValues: {
      type: [Number],
      default: [0, 0, 0, 0, 0, 0]
    },
    dice1: { type: Number, default: null },
    dice2: { type: Number, default: null },
    dice3: { type: Number, default: null },
    xPot: { type: Number, default: 0 },
    xValue: { type: Number, default: 0 },
    startedAt: { type: Date, required: true },
    resultAt: { type: Date, default: null },
    endedAt: { type: Date, default: null }
  },
  {
    timestamps: true,
    collection: "bc_sessions"
  }
);

module.exports = mongoose.model("BauCuaSession", BauCuaSessionSchema);
