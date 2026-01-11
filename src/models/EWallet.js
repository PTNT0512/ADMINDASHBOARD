const mongoose = require('mongoose');

const eWalletSchema = new mongoose.Schema({
  walletType: String,    // Momo, ZaloPay...
  phoneNumber: String,
  name: String,
  status: { type: Number, default: 1 }
});

module.exports = mongoose.model('EWallet', eWalletSchema);