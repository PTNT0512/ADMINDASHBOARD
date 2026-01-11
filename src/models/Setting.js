// Model Setting
const mongoose = require('mongoose');

const settingSchema = new mongoose.Schema({
  domain: String,
  mainBotToken: String,
  txRoomToken: String,
  cskhBotToken: String,
  systemGroupId: String,
  bankingGroupId: String
});

module.exports = mongoose.model('Setting', settingSchema);