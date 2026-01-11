const mongoose = require('mongoose');

const missionSchema = new mongoose.Schema({
  name: String,
  reward: Number,
  target: Number, // Mục tiêu cần đạt (VD: 10 ván)
  status: { type: Number, default: 1 } // 1: Active, 0: Inactive
});

module.exports = mongoose.model('Mission', missionSchema);