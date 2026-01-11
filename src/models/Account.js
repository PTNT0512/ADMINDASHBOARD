// Model Account
const mongoose = require('mongoose');

const accountSchema = new mongoose.Schema({
  userId: Number,
  balance: Number,
  ref: Number,
  status: Number,
  date: { type: Date, default: Date.now },
  spinCount: { type: Number, default: 0 },
  dailyPoints: { type: Number, default: 0 },
  dailyCheckin: [String],    
  spinlucky: { type: Number, default: 0 },
  vip: { type: Number, default: 1 },
  refund: { type: Number, default: 0 },
  safe: { type: Number, default: 0 },
  passsafe: { type: String, default: "" },
  topRacingPoints: { type: Number, default: 0 }, // Điểm đua top
  invitedBy: { type: Number, default: null }, // ID người giới thiệu
  vipPoints: { type: Number, default: 0 }, // Điểm VIP tích lũy
  usedVipPoints: { type: Number, default: 0 } // Điểm VIP đã sử dụng
});

module.exports = mongoose.model('Account', accountSchema);