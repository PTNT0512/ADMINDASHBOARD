const mongoose = require('mongoose');

const boomsSettingSchema = new mongoose.Schema({
  roomType: { type: String, default: 'booms' },
  botToken: String,
  groupId: String,
  minBet: { type: Number, default: 1000 },
  maxBet: { type: Number, default: 10000000 },
  botBanker: { type: Boolean, default: true },
  botBankerAmount: { type: Number, default: 5000000 },
  feeRate: { type: Number, default: 2 },
  jackpotFeeRate: { type: Number, default: 5 },
  winRate: { type: Number, default: 50 },
  fakeBetEnabled: { type: Boolean, default: false },
  fakeBetMinAmount: { type: Number, default: 10000 },
  fakeBetMaxAmount: { type: Number, default: 500000 },
  fakeBetInterval: { type: Number, default: 15 },
  jackpot: { type: Number, default: 0 },
  status: { type: Number, default: 1 },
  bankerSelectionTime: { type: Number, default: 30 },
  bettingTime: { type: Number, default: 60 },

  sessionCounter: { type: Number, default: 202500000000 },
  gameHistory: { type: Array, default: [] },
  gameState: { type: Object, default: null }
});

module.exports = mongoose.model('BoomsSetting', boomsSettingSchema);