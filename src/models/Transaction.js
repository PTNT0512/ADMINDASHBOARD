const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  userId: Number,
  amount: Number,
  action: String, // 'add' hoặc 'subtract'
  oldBalance: Number,
  newBalance: Number,
  date: { type: Date, default: Date.now },
  description: String
});

module.exports = mongoose.models.Transaction || mongoose.model('Transaction', transactionSchema);