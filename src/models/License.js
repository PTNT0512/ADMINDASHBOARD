const mongoose = require('mongoose');

const licenseSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  clientName: { type: String, required: true },
  expiryDate: { type: Date, default: null }, // null nghĩa là không thời hạn
  isActive: { type: Boolean, default: true },
  machineId: { type: String, default: null },
  activatedAt: { type: Date, default: null },
  date: { type: Date, default: Date.now }
});

module.exports = mongoose.model('License', licenseSchema);