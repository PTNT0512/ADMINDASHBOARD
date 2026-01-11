const mongoose = require('mongoose');

const giftCodeSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true },
  amount: Number,
  status: { type: Number, default: 1 }, // 1: Active (Chưa dùng), 0: Used (Đã dùng)
  date: { type: Date, default: Date.now }
});

module.exports = mongoose.model('GiftCode', giftCodeSchema);