const mongoose = require('mongoose');

const candleSchema = new mongoose.Schema(
  {
    o: { type: Number, required: true },
    h: { type: Number, required: true },
    l: { type: Number, required: true },
    c: { type: Number, required: true },
    timestamp: { type: Number, required: true },
  },
  { _id: false },
);

const tradingMarketEntrySchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    symbol: { type: String, required: true },
    name: { type: String, default: '' },
    basePrice: { type: Number, required: true },
    volatility: { type: Number, required: true },
    precision: { type: Number, default: 2 },
    currentPrice: { type: Number, required: true },
    change: { type: Number, default: 0 },
    changePct: { type: Number, default: 0 },
    history: { type: [candleSchema], default: [] },
  },
  { _id: false },
);

const tradingMarketControlSchema = new mongoose.Schema(
  {
    mode: { type: String, enum: ['auto', 'bias', 'target'], default: 'auto' },
    direction: { type: String, enum: ['up', 'down'], default: 'up' },
    strength: { type: Number, default: 60, min: 1, max: 100 },
    targetPrice: { type: Number, default: null },
    updatedAt: { type: Number, default: 0 },
  },
  { _id: false },
);

const tradingOrderPolicySchema = new mongoose.Schema(
  {
    enabled: { type: Boolean, default: false },
    mode: { type: String, enum: ['kill_small', 'kill_big'], default: 'kill_small' },
    thresholdAmount: { type: Number, default: 200, min: 1 },
    updatedAt: { type: Number, default: 0 },
  },
  { _id: false },
);

const tradingMarketStateSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, default: 'global' },
    version: { type: Number, default: 1 },
    lastCandleAt: { type: Number, default: 0 },
    tickIntervalMs: { type: Number, default: 100 },
    candleDurationMs: { type: Number, default: 60000 },
    markets: { type: [tradingMarketEntrySchema], default: [] },
    control: { type: tradingMarketControlSchema, default: () => ({ mode: 'auto', direction: 'up', strength: 60, targetPrice: null, updatedAt: 0 }) },
    orderPolicy: { type: tradingOrderPolicySchema, default: () => ({ enabled: false, mode: 'kill_small', thresholdAmount: 200, updatedAt: 0 }) },
  },
  { timestamps: true },
);

module.exports = mongoose.models.TradingMarketState || mongoose.model('TradingMarketState', tradingMarketStateSchema);
