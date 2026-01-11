const mongoose = require('mongoose');

const bankAutoSchema = new mongoose.Schema({
  bankName: String,      // Tên ngân hàng (MBBank, VCB...)
  accountNumber: String, // Số tài khoản
  accountName: String,   // Tên chủ tài khoản
  token: String,         // Token API (để auto)
  status: { type: Number, default: 1 } // 1: Bật, 0: Tắt
});

module.exports = mongoose.model('BankAuto', bankAutoSchema);