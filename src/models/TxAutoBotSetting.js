const mongoose = require('mongoose');

const txAutoBotSettingSchema = new mongoose.Schema(
  {
    roomType: { type: String, required: true, unique: true }, // taixiucao | taixiunan
    enabled: { type: Boolean, default: true },
    botCount: { type: Number, default: 50, min: 50, max: 999 },
    minAmount: { type: Number, default: 10000, min: 1000 },
    maxAmount: { type: Number, default: 500000, min: 1000 },
  },
  { timestamps: true },
);

module.exports = mongoose.model('TxAutoBotSetting', txAutoBotSettingSchema);
