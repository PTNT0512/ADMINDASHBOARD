const mongoose = require('mongoose');

const blacklistSchema = new mongoose.Schema({
  value: { type: String, required: true, unique: true }, // IP, Tên tài khoản, hoặc SĐT
  reason: String,
  date: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Blacklist', blacklistSchema);