const mongoose = require('mongoose');

const plinkoHistorySchema = new mongoose.Schema({
  sessionId: String,
  result: String,
  dice: [Number],
  totalBet: Number,
  realTotalBet: { type: Number, default: 0 },
  totalPayout: Number,
  profit: Number,
  fee: { type: Number, default: 0 },
  banker: String,
  date: { type: Date, default: Date.now }
});

module.exports = mongoose.model('PlinkoHistory', plinkoHistorySchema);