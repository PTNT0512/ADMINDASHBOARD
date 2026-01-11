const mongoose = require('mongoose');

const botSchema = new mongoose.Schema({
  name: { type: String, required: true }, // Tên định danh cho bot (VD: Bot Chính, Bot CSKH)
  token: { type: String, required: true, unique: true },
  role: { type: String, required: true, enum: ['main', 'cskh', 'tx_room', 'other'] }, // Vai trò của bot
  status: { type: Number, default: 1 } // 1: Active, 0: Inactive
});

module.exports = mongoose.model('Bot', botSchema);