const mongoose = require('mongoose');

const supportMessageSchema = new mongoose.Schema({
    userId: { type: Number, required: true, index: true }, // ID Telegram của khách
    username: { type: String }, // Tên khách
    content: { type: String }, // Caption cho ảnh, hoặc tin nhắn văn bản
    imageBase64: { type: String }, // Lưu ảnh dưới dạng chuỗi base64
    direction: { type: String, enum: ['in', 'out'], required: true }, // 'in': Khách gửi, 'out': Admin gửi
    isRead: { type: Boolean, default: false }, // Trạng thái đã xem
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('SupportMessage', supportMessageSchema);