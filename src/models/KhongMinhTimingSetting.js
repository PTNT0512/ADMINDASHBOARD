const mongoose = require('mongoose');

const khongMinhTimingSettingSchema = new mongoose.Schema({
  roomType: { type: String, default: 'khongminh', unique: true },
  bankerSelectionTime: { type: Number, default: 20 },
  roundOneBettingTime: { type: Number, default: 30 },
  roundOneResultTime: { type: Number, default: 15 },
  roundTwoBettingTime: { type: Number, default: 30 },
  finalResultTime: { type: Number, default: 15 },
  sessionWaitTime: { type: Number, default: 1 },
}, { timestamps: true });

module.exports = mongoose.model('KhongMinhTimingSetting', khongMinhTimingSettingSchema);
