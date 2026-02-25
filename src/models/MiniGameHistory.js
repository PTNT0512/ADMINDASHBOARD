const mongoose = require('mongoose');

const miniGameHistorySchema = new mongoose.Schema({
  game: String, // 'cl', 'tx', 'dice', 'slot'
  userId: Number,
  username: String,
  betType: String, // 'C', 'L', 'T', 'X', 'XXC'...
  betAmount: Number,
  winAmount: Number,
  date: { type: Date, default: Date.now }
});

module.exports = mongoose.models.MiniGameHistory || mongoose.model('MiniGameHistory', miniGameHistorySchema);