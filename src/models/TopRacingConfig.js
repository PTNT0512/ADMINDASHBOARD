const mongoose = require('mongoose');

const topRacingConfigSchema = new mongoose.Schema({
  rank: Number,
  reward: Number
});

module.exports = mongoose.model('TopRacingConfig', topRacingConfigSchema);