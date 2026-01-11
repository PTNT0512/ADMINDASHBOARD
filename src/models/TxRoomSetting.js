const mongoose = require('mongoose');

const txRoomSettingSchema = new mongoose.Schema({
  roomType: { type: String, required: true, unique: true }, // 'tx', 'md5', 'khongminh'
  botToken: String,
  groupId: String,
  minBet: { type: Number, default: 1000 },
  maxBet: { type: Number, default: 10000000 },
  botBanker: { type: Boolean, default: true }, // Bot tự nhận cái nếu không có người chơi
  botBankerAmount: { type: Number, default: 5000000 }, // Tiền mặc định khi bot làm cái
  feeRate: { type: Number, default: 2 }, // Tỷ lệ cắt phế %
  jackpotFeeRate: { type: Number, default: 5 }, // Tỷ lệ đóng góp vào hũ từ người thắng (%)
  // Fake Bet Settings
  fakeBetEnabled: { type: Boolean, default: false },
  fakeBetMinAmount: { type: Number, default: 10000 },
  fakeBetMaxAmount: { type: Number, default: 500000 },
  fakeBetInterval: { type: Number, default: 15 }, // Average seconds between fake bets
  jackpot: { type: Number, default: 0 }, // Tiền hũ
  status: { type: Number, default: 1 }, // 1: On, 0: Off
  bankerSelectionTime: { type: Number, default: 30 }, // Thời gian chọn cái (s)
  bettingTime: { type: Number, default: 60 }, // Thời gian đặt cược (s)

  // Fields for session persistence
  sessionCounter: { type: Number, default: 202500000000 },
  gameHistory: { type: Array, default: [] },
  gameState: { type: Object, default: null }
});

module.exports = mongoose.model('TxRoomSetting', txRoomSettingSchema);