"use strict";

const mongoose = require("mongoose");

const MiniPokerSpinSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "TxUser", required: true, index: true },
    nickname: { type: String, required: true, index: true },
    room: { type: Number, required: true, default: 0, index: true },
    betValue: { type: Number, required: true, default: 0 },
    result: { type: Number, required: true, default: 10 },
    prize: { type: Number, required: true, default: 0 },
    cards: {
      type: [Number],
      default: [1, 1, 1, 1, 1]
    },
    currentMoney: { type: Number, required: true, default: 0 }
  },
  {
    timestamps: true,
    collection: "mp_spins"
  }
);

MiniPokerSpinSchema.index({ nickname: 1, createdAt: -1 });

module.exports = mongoose.model("MiniPokerSpin", MiniPokerSpinSchema);
