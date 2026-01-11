const mongoose = require('mongoose');

const withdrawSchema = new mongoose.Schema({
  userId: Number,
  amount: Number,
  bankName: String,
  accountNumber: String,
  accountName: String,
  requestId: String,
  status: { type: Number, default: 0 }, // 0: Chờ, 1: Thành công, 2: Hủy
  date: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Withdraw', withdrawSchema);