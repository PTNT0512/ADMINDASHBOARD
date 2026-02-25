const mongoose = require('mongoose');

const settingSchema = new mongoose.Schema({
    domain: { type: String, default: '' },
    systemGroupId: { type: String, default: '' },
    bankingGroupId: { type: String, default: '' },
    
    minDeposit: { type: Number, default: 20000 },
    maxDeposit: { type: Number, default: 500000000 },
    
    minWithdraw: { type: Number, default: 50000 },
    maxWithdraw: { type: Number, default: 100000000 },
    
    maxWithdrawalsPerDay: { type: Number, default: 3 },
    withdrawWageringReq: { type: Number, default: 1 },
    
    gameListImage: { type: String, default: '' },
    
    // Cấu hình Nạp thẻ
    partnerId: { type: String, default: '' },
    partnerKey: { type: String, default: '' },
    cardFee: { type: Number, default: 0 },
    
    enableSound: { type: Boolean, default: true },
    
    maintenanceDeposit: { type: Boolean, default: false },
    maintenanceWithdraw: { type: Boolean, default: false },
    maintenanceSystem: { type: Boolean, default: false },
    
    useBankAuto: { type: Boolean, default: true },
    
    // Game Limits
    minBetCL: { type: Number, default: 1000 },
    maxBetCL: { type: Number, default: 10000000 },
    minBetTX: { type: Number, default: 1000 },
    maxBetTX: { type: Number, default: 10000000 },
    minBetDice: { type: Number, default: 1000 },
    maxBetDice: { type: Number, default: 10000000 },
    minBetSlot: { type: Number, default: 1000 },
    
    cskhMessage: { type: String, default: 'Vui lòng liên hệ Admin để được hỗ trợ.' }
}, { timestamps: true });

module.exports = mongoose.models.Setting || mongoose.model('Setting', settingSchema);