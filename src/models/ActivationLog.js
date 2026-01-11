const mongoose = require('mongoose');

const activationLogSchema = new mongoose.Schema({
  key: String,
  machineId: String,
  status: { type: String, enum: ['SUCCESS', 'FAILED'] },
  reason: String,
  ip: String, // Optional: to track request IP
  date: { type: Date, default: Date.now }
});

module.exports = mongoose.model('ActivationLog', activationLogSchema);