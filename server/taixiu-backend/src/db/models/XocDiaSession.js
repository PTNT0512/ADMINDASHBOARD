"use strict";

const mongoose = require("mongoose");

const XocDiaSessionSchema = new mongoose.Schema(
  {
    referenceId: { type: Number, required: true, unique: true, index: true },
    roomId: { type: Number, required: true, index: true },
    phase: { type: String, enum: ["start", "betting", "refund", "result"], required: true, default: "start" },
    action: { type: Number, required: true, default: 1 },
    remainTime: { type: Number, required: true, default: 0 },
    potValues: {
      type: [Number],
      default: [0, 0, 0, 0, 0, 0]
    },
    diceIds: {
      type: [Number],
      default: [0, 1, 0, 1]
    },
    resultEven: { type: Boolean, default: false },
    startedAt: { type: Date, required: true },
    settledAt: { type: Date, default: null },
    endedAt: { type: Date, default: null }
  },
  {
    timestamps: true,
    collection: "xd_sessions"
  }
);

XocDiaSessionSchema.index({ roomId: 1, referenceId: -1 });

module.exports = mongoose.model("XocDiaSession", XocDiaSessionSchema);
