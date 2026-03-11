"use strict";

const ChatMessage = require("../db/models/ChatMessage");

async function saveMessage(gameKey, nickname, message) {
  return ChatMessage.create({
    gameKey,
    nickname,
    message
  });
}

async function getRecentMessages(gameKey, limit = 20) {
  const docs = await ChatMessage.find({ gameKey })
    .sort({ createdAt: -1 })
    .limit(Math.max(1, Math.min(limit, 50)))
    .lean();
  docs.reverse();
  return docs.map((d) => ({
    u: d.nickname,
    m: d.message
  }));
}

module.exports = {
  saveMessage,
  getRecentMessages
};

