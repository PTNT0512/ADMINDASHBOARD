const mongoose = require('mongoose');

const commissionSettingSchema = new mongoose.Schema({
  key: { type: String, default: 'default', unique: true }, // Key duy nhất để truy vấn
  rates: {
    1: { type: Number, default: 0.005 }, // VIP 1: 0.5%
    2: { type: Number, default: 0.008 }, // VIP 2: 0.8%
    3: { type: Number, default: 0.010 }, // VIP 3: 1.0%
    4: { type: Number, default: 0.012 }, // VIP 4: 1.2%
    5: { type: Number, default: 0.015 }  // VIP 5: 1.5%
  }
});

module.exports = mongoose.model('CommissionSetting', commissionSettingSchema);