const mongoose = require('mongoose');

const bankManualSchema = new mongoose.Schema({
  bankName: String,
  accountNumber: String,
  accountName: String,
  branch: String,        // Chi nhánh
  status: { type: Number, default: 1 }
});

module.exports = mongoose.model('BankManual', bankManualSchema);