const mongoose = require('mongoose');

const depositSchema = new mongoose.Schema({
  userId: Number,
  amount: Number,
  realAmount: Number, // Số tiền thực nhận (nếu sai)
  method: String, // Momo, Bank, Card...
  transId: String, // Mã giao dịch phía ngân hàng
  requestId: String, // Mã yêu cầu
  status: { type: Number, default: 0 }, // 0: Chờ, 1: Thành công, 2: Hủy
  date: { type: Date, default: Date.now },
  description: String // Mô tả thêm, dùng cho giao dịch lỗi
});

module.exports = mongoose.model('Deposit', depositSchema);