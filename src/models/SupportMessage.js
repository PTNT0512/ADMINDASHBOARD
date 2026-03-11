const mongoose = require('mongoose');

const supportMessageSchema = new mongoose.Schema({
  userId: { type: Number, required: true, index: true },
  username: { type: String },
  content: { type: String },
  imageBase64: { type: String },
  ticketCategory: { type: String, default: '' },
  assignedTo: { type: String, default: '' },
  assignedSocketId: { type: String, default: '' },
  direction: { type: String, enum: ['in', 'out'], required: true },
  isRead: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('SupportMessage', supportMessageSchema);
