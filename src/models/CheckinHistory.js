const mongoose = require('mongoose');

const checkinHistorySchema = new mongoose.Schema({
  userId: Number,
  reward: Number,
  date: { type: Date, default: Date.now }
});

module.exports = mongoose.model('CheckinHistory', checkinHistorySchema);