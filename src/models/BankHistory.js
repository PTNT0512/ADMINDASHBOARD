const mongoose = require('mongoose');

const bankHistorySchema = new mongoose.Schema({
  transactionID: { type: String, required: true, unique: true }, // Mã giao dịch ngân hàng (duy nhất)
  amount: Number,
  description: String,
  bankName: String,
  date: String,
  isUsed: { type: Boolean, default: false }, // Đã dùng để cộng tiền chưa
  usedFor: { type: String, default: null }, // ID của đơn nạp (Deposit) tương ứng
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('BankHistory', bankHistorySchema);