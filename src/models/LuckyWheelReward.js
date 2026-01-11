const mongoose = require('mongoose');

const luckyWheelRewardSchema = new mongoose.Schema({
  name: String,
  rate: Number, // Tỷ lệ phần trăm
  value: Number // Giá trị phần thưởng (nếu là tiền)
});

module.exports = mongoose.model('LuckyWheelReward', luckyWheelRewardSchema);