const mongoose = require('mongoose');

const giftcodeSchema = new mongoose.Schema({
    code: { type: String, required: true, unique: true },
    amount: { type: Number, required: true },
    usageLimit: { type: Number, default: 1 }, // Giới hạn số người nhập
    usedCount: { type: Number, default: 0 },  // Số người đã nhập
    usedBy: [{ type: String }],               // Danh sách User ID đã nhập (để tránh trùng)
    status: { type: Number, default: 1 },     // 1: Active, 0: Inactive/Full
    date: { type: Date, default: Date.now }
});

module.exports = mongoose.models.Giftcode || mongoose.model('Giftcode', giftcodeSchema);