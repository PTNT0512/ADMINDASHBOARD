const mongoose = require('mongoose');

const txGameHistorySchema = new mongoose.Schema({
  roomType: String, // 'tx', 'md5', 'khongminh'
  sessionId: String,
  result: String, // 'Tai', 'Xiu'
  dice: [Number], // [1, 2, 3]
  totalBet: Number,
  realTotalBet: { type: Number, default: 0 }, // Total bet from real players
  totalPayout: Number,
  profit: Number,
  fee: { type: Number, default: 0 }, // Tiền phế thu được
  banker: String, // 'Bot' hoặc Tên người chơi
  date: { type: Date, default: Date.now }
});

module.exports = mongoose.model('TxGameHistory', txGameHistorySchema);