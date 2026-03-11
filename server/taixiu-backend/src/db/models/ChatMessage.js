"use strict";

const mongoose = require("mongoose");

const ChatMessageSchema = new mongoose.Schema(
  {
    gameKey: { type: String, enum: ["double", "md5"], required: true, index: true },
    nickname: { type: String, required: true },
    message: { type: String, required: true, maxlength: 300 }
  },
  {
    timestamps: true,
    collection: "tx_chat_messages"
  }
);

ChatMessageSchema.index({ gameKey: 1, createdAt: -1 });

module.exports = mongoose.model("TxChatMessage", ChatMessageSchema);

