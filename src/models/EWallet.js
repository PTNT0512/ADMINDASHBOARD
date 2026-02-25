const mongoose = require('mongoose');

const eWalletSchema = new mongoose.Schema({
  walletType: { type: String, default: 'Momo' },
  phoneNumber: String, // Có thể là SĐT hoặc tên đăng nhập
  accountNumber: String, // Số tài khoản ngân hàng liên kết (nếu có)
  name: String,
  token: { type: String, default: '' }, // Trường token API
  status: { type: Number, default: 1 }, // 1: Hoạt động, 0: Tắt
  date: { type: Date, default: Date.now }
});

module.exports = mongoose.models.EWallet || mongoose.model('EWallet', eWalletSchema);