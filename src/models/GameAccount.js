const mongoose = require('mongoose');

const gameAccountSchema = new mongoose.Schema(
  {
    userId: { type: Number, required: true, unique: true, index: true },
    accountTokenHash: { type: String, default: '' },
    displayName: { type: String, default: '' },
    avatarUrl: { type: String, default: '' },
    status: { type: String, default: 'active' },
    wallet: {
      main: { type: Number, default: 0 },
      bonus: { type: Number, default: 0 },
    },
    permissions: {
      aviator: { type: Boolean, default: true },
      baccarat: { type: Boolean, default: true },
      xocdia: { type: Boolean, default: true },
      rongho: { type: Boolean, default: true },
      taixiucao: { type: Boolean, default: true },
      taixiunan: { type: Boolean, default: true },
    },
    security: {
      lastLoginAt: { type: Date, default: null },
      lastLoginIp: { type: String, default: '' },
      lastUserAgent: { type: String, default: '' },
    },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true },
);

module.exports = mongoose.models.GameAccount || mongoose.model('GameAccount', gameAccountSchema);
