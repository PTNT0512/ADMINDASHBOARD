const TradingMarketState = require('../models/TradingMarketState');

const MARKETS = [
  { id: 'okcoin', symbol: 'OK COIN', name: 'OK COIN', basePrice: 100.0, volatility: 0.9, precision: 2 },
];

const DEFAULT_MARKET_ID = 'okcoin';
const MAX_DATA_POINTS = 1000;
const DEFAULT_SNAPSHOT_LIMIT = 240;
const PERSIST_HISTORY_LIMIT = 420;
const TICK_INTERVAL_MS = 100;
const CANDLE_DURATION_MS = 60000;
const BROADCAST_INTERVAL_MS = 300;
const PERSIST_INTERVAL_MS = 15000;
const DEFAULT_CONTROL = Object.freeze({
  mode: 'auto',
  direction: 'up',
  strength: 60,
  targetPrice: null,
  updatedAt: 0,
});
const DEFAULT_ORDER_POLICY = Object.freeze({
  enabled: false,
  mode: 'kill_small',
  thresholdAmount: 200,
  updatedAt: 0,
});
const ORDER_POLICY_MODES = ['kill_small', 'kill_big'];
const ORDER_SIDE_OPTIONS = ['CALL', 'PUT'];
const MIN_ORDER_AMOUNT = 1;
const FIXED_ORDER_DURATION_MS = 60000;
const MAX_ACTIVE_ORDER_COUNT = 3000;
const MAX_SETTLED_ORDER_HISTORY = 500;
const TRADING_ORDER_PAYOUT_RATE = 1.85;
const createEmptySideBreak = () => ({
  loseSide: null,
  startAt: 0,
  endAt: 0,
  updatedAt: 0,
});

const toFiniteNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const roundByPrecision = (value, precision = 2) => {
  const digits = Math.max(0, Math.min(8, Number(precision || 2)));
  return Number(toFiniteNumber(value, 0).toFixed(digits));
};

const isMongoConnected = () => Number(TradingMarketState?.db?.readyState || 0) === 1;

const normalizeControl = (raw = {}) => {
  const modeRaw = String(raw?.mode || DEFAULT_CONTROL.mode).trim().toLowerCase();
  const mode = ['auto', 'bias', 'target'].includes(modeRaw) ? modeRaw : DEFAULT_CONTROL.mode;

  const directionRaw = String(raw?.direction || DEFAULT_CONTROL.direction).trim().toLowerCase();
  const direction = directionRaw === 'down' ? 'down' : 'up';

  const strengthRaw = Number(raw?.strength);
  const strength = Number.isFinite(strengthRaw)
    ? Math.min(100, Math.max(1, Math.round(strengthRaw)))
    : DEFAULT_CONTROL.strength;

  const targetRaw = Number(raw?.targetPrice);
  const targetPrice = Number.isFinite(targetRaw) && targetRaw > 0
    ? roundByPrecision(targetRaw, MARKETS[0]?.precision || 2)
    : null;

  const updatedAtRaw = Number(raw?.updatedAt);
  const updatedAt = Number.isFinite(updatedAtRaw) && updatedAtRaw > 0
    ? Math.floor(updatedAtRaw)
    : Date.now();

  if (mode === 'target') {
    if (!Number.isFinite(targetPrice) || targetPrice <= 0) {
      return {
        mode: DEFAULT_CONTROL.mode,
        direction,
        strength,
        targetPrice: null,
        updatedAt,
      };
    }
    return {
      mode,
      direction,
      strength,
      targetPrice,
      updatedAt,
    };
  }

  return {
    mode,
    direction,
    strength,
    targetPrice: null,
    updatedAt,
  };
};

const normalizeOrderPolicy = (raw = {}) => {
  const enabled = raw?.enabled === true;
  const modeRaw = String(raw?.mode || DEFAULT_ORDER_POLICY.mode).trim().toLowerCase();
  const mode = ORDER_POLICY_MODES.includes(modeRaw) ? modeRaw : DEFAULT_ORDER_POLICY.mode;
  const thresholdRaw = Number(raw?.thresholdAmount);
  const thresholdAmount = Number.isFinite(thresholdRaw)
    ? Math.max(MIN_ORDER_AMOUNT, Math.floor(thresholdRaw))
    : DEFAULT_ORDER_POLICY.thresholdAmount;
  const updatedAtRaw = Number(raw?.updatedAt);
  const updatedAt = Number.isFinite(updatedAtRaw) && updatedAtRaw > 0
    ? Math.floor(updatedAtRaw)
    : Date.now();

  return {
    enabled,
    mode,
    thresholdAmount,
    updatedAt,
  };
};

const normalizeCandle = (raw, fallbackPrice, precision, timestampFallback) => {
  const price = roundByPrecision(fallbackPrice, precision);
  const timestamp = Number(raw?.timestamp || timestampFallback);
  const open = roundByPrecision(raw?.o, precision);
  const high = roundByPrecision(raw?.h, precision);
  const low = roundByPrecision(raw?.l, precision);
  const close = roundByPrecision(raw?.c, precision);

  const safeOpen = Number.isFinite(open) ? open : price;
  const safeClose = Number.isFinite(close) ? close : safeOpen;
  const safeHigh = Number.isFinite(high) ? Math.max(high, safeOpen, safeClose) : Math.max(safeOpen, safeClose);
  const safeLow = Number.isFinite(low) ? Math.min(low, safeOpen, safeClose) : Math.min(safeOpen, safeClose);

  return {
    o: safeOpen,
    h: safeHigh,
    l: safeLow,
    c: safeClose,
    timestamp: Number.isFinite(timestamp) && timestamp > 0 ? Math.floor(timestamp) : Date.now(),
  };
};

class TradingMarketSession {
  constructor(io) {
    this.io = io;
    this.running = false;
    this.tickTimer = null;
    this.broadcastTimer = null;
    this.persistTimer = null;
    this.sequence = 0;
    this.lastCandleAt = Date.now();
    this.marketStates = new Map(); // marketId => { currentPrice, change, changePct }
    this.marketHistories = new Map(); // marketId => candle[]
    this.control = { ...DEFAULT_CONTROL };
    this.orderPolicy = { ...DEFAULT_ORDER_POLICY };
    this.activeOrders = new Map();
    this.settledOrders = [];
    this.orderControl = new Map();
    this.orderSeq = 0;
    this.smoothControlPush = new Map();
    this.sideBreak = createEmptySideBreak();
  }

  async init() {
    if (this.running) return;
    this.running = true;

    await this.restoreOrSeedState();
    this.broadcastSnapshot(DEFAULT_SNAPSHOT_LIMIT);

    this.tickTimer = setInterval(() => {
      try {
        this.tick();
      } catch (error) {
        console.error('[Trading Market] Tick error:', error);
      }
    }, TICK_INTERVAL_MS);

    this.broadcastTimer = setInterval(() => {
      try {
        this.broadcastUpdate();
      } catch (error) {
        console.error('[Trading Market] Broadcast update error:', error);
      }
    }, BROADCAST_INTERVAL_MS);

    this.persistTimer = setInterval(() => {
      this.persistState().catch((error) => {
        console.error('[Trading Market] Persist state error:', error);
      });
    }, PERSIST_INTERVAL_MS);
  }

  async restoreOrSeedState() {
    try {
      const saved = await TradingMarketState.findOne({ key: 'global' }).lean();
      if (!saved || !Array.isArray(saved.markets) || saved.markets.length === 0) {
        this.seedFreshState(Date.now());
        return;
      }

      const now = Date.now();
      this.smoothControlPush.clear();
      for (const meta of MARKETS) {
        const row = saved.markets.find((item) => String(item?.id || '').toLowerCase() === meta.id);
        const fallbackPrice = roundByPrecision(meta.basePrice, meta.precision);
        const currentPrice = roundByPrecision(row?.currentPrice, meta.precision) || fallbackPrice;
        const change = roundByPrecision(row?.change, meta.precision) || roundByPrecision(currentPrice - meta.basePrice, meta.precision);
        const changePct = roundByPrecision(
          row?.changePct,
          4,
        ) || roundByPrecision(((currentPrice - meta.basePrice) / meta.basePrice) * 100, 4);

        const rawHistory = Array.isArray(row?.history) ? row.history : [];
        const normalizedHistory = rawHistory
          .slice(-MAX_DATA_POINTS)
          .map((item) => normalizeCandle(item, currentPrice, meta.precision, now))
          .sort((a, b) => a.timestamp - b.timestamp);

        const history = normalizedHistory.length > 0
          ? normalizedHistory
          : [normalizeCandle(null, currentPrice, meta.precision, now)];

        this.marketStates.set(meta.id, {
          currentPrice,
          change,
          changePct,
        });
        this.marketHistories.set(meta.id, history);
        this.smoothControlPush.set(meta.id, 0);
      }

      const restoredLastCandleAt = Number(saved.lastCandleAt || 0);
      this.lastCandleAt = Number.isFinite(restoredLastCandleAt) && restoredLastCandleAt > 0
        ? restoredLastCandleAt
        : now;
      this.control = normalizeControl(saved?.control || DEFAULT_CONTROL);
      this.orderPolicy = normalizeOrderPolicy(saved?.orderPolicy || DEFAULT_ORDER_POLICY);

      // If server was down too long, continue from current time without generating huge gaps.
      if (now - this.lastCandleAt > (CANDLE_DURATION_MS * 3)) {
        this.lastCandleAt = now;
      }
    } catch (error) {
      console.error('[Trading Market] Restore state error:', error);
      this.seedFreshState(Date.now());
    }
  }

  seedFreshState(now = Date.now()) {
    this.marketStates.clear();
    this.marketHistories.clear();
    this.lastCandleAt = now;
    this.control = { ...DEFAULT_CONTROL, updatedAt: now };
    this.orderPolicy = { ...DEFAULT_ORDER_POLICY, updatedAt: now };
    this.activeOrders.clear();
    this.settledOrders = [];
    this.orderControl.clear();
    this.smoothControlPush.clear();
    this.sideBreak = createEmptySideBreak();

    for (const meta of MARKETS) {
      const base = roundByPrecision(meta.basePrice, meta.precision);
      this.marketStates.set(meta.id, {
        currentPrice: base,
        change: 0,
        changePct: 0,
      });
      this.marketHistories.set(meta.id, [
        normalizeCandle(null, base, meta.precision, now),
      ]);
      this.smoothControlPush.set(meta.id, 0);
    }
  }

  tick() {
    if (!this.running) return;
    const now = Date.now();
    this.clearExpiredSideBreak(now);
    const shouldCloseCandle = now - this.lastCandleAt >= CANDLE_DURATION_MS;
    if (shouldCloseCandle) {
      this.lastCandleAt = now;
      this.sequence += 1;
    }

    for (const meta of MARKETS) {
      const history = this.marketHistories.get(meta.id) || [];
      const state = this.marketStates.get(meta.id) || {
        currentPrice: roundByPrecision(meta.basePrice, meta.precision),
        change: 0,
        changePct: 0,
      };

      if (history.length === 0) {
        history.push(normalizeCandle(null, state.currentPrice, meta.precision, now));
      }

      if (shouldCloseCandle) {
        const latest = history[history.length - 1] || normalizeCandle(null, state.currentPrice, meta.precision, now);
        const open = roundByPrecision(latest.c, meta.precision);
        history.push(normalizeCandle({ o: open, h: open, l: open, c: open, timestamp: now }, open, meta.precision, now));
        if (history.length > MAX_DATA_POINTS) {
          history.splice(0, history.length - MAX_DATA_POINTS);
        }
      }

      const lastIndex = history.length - 1;
      const candle = { ...history[lastIndex] };
      const drift = this.computeDrift(meta, candle.c, now);
      const wickRange = Math.max(Math.pow(10, -Math.max(0, meta.precision)), meta.volatility * 0.45);

      const nextClose = roundByPrecision(candle.c + drift, meta.precision);
      candle.c = nextClose;
      candle.h = roundByPrecision(Math.max(candle.h, nextClose + Math.random() * wickRange), meta.precision);
      candle.l = roundByPrecision(Math.min(candle.l, nextClose - Math.random() * wickRange), meta.precision);
      history[lastIndex] = candle;

      const change = roundByPrecision(nextClose - meta.basePrice, meta.precision);
      const changePct = meta.basePrice
        ? Number((((nextClose - meta.basePrice) / meta.basePrice) * 100).toFixed(4))
        : 0;

      this.marketStates.set(meta.id, {
        currentPrice: nextClose,
        change,
        changePct,
      });
      this.marketHistories.set(meta.id, history);
    }
  }

  computeDrift(meta, currentPrice, now = Date.now()) {
    const randomDrift = (Math.random() - 0.5) * meta.volatility;
    const control = this.control || DEFAULT_CONTROL;
    const marketId = String(meta?.id || DEFAULT_MARKET_ID);
    const lastPushRaw = Number(this.smoothControlPush.get(marketId) || 0);
    const lastPush = Number.isFinite(lastPushRaw) ? lastPushRaw : 0;
    const sideBreak = this.getSideBreakState(now);

    if (sideBreak.active) {
      const sign = sideBreak.loseSide === 'CALL' ? -1 : 1;
      const priceStep = Math.max(Math.pow(10, -Math.max(0, Number(meta?.precision || 2))), 0.0001);
      // During side-break we still keep natural oscillation (3-5 ticks),
      // but keep a small directional bias to maintain break-side edge.
      const oscillationTicks = 3 + Math.floor(Math.random() * 3); // 3..5
      const wave = Math.sin((now / 650) + (marketId.length * 0.7)) * priceStep * oscillationTicks * 0.35;
      const directionalBias = sign * priceStep * (0.85 + (Math.random() * 0.45));
      const targetPush = directionalBias + wave;
      const easedPush = lastPush + ((targetPush - lastPush) * 0.16);
      const noise = (Math.random() - 0.5) * priceStep * 1.8;
      const drift = easedPush + noise;
      const maxDrift = priceStep * 5.0;
      const clamped = Math.max(-maxDrift, Math.min(maxDrift, drift));
      this.smoothControlPush.set(marketId, easedPush);
      return clamped;
    }

    if (control.mode === 'bias') {
      const sign = control.direction === 'down' ? -1 : 1;
      const strengthFactor = Math.min(1, Math.max(0.01, Number(control.strength || DEFAULT_CONTROL.strength) / 100));
      const targetPush = sign * (meta.volatility * (0.06 + (0.28 * strengthFactor)));
      const easedPush = lastPush + ((targetPush - lastPush) * 0.05);
      const noise = (Math.random() - 0.5) * meta.volatility * 0.5;
      const drift = easedPush + noise;
      const maxDrift = meta.volatility * 0.7;
      const clamped = Math.max(-maxDrift, Math.min(maxDrift, drift));
      this.smoothControlPush.set(marketId, easedPush);
      return clamped;
    }

    if (control.mode === 'target' && Number.isFinite(control.targetPrice) && control.targetPrice > 0) {
      const delta = control.targetPrice - currentPrice;
      const maxStep = meta.volatility * 0.65;
      const minStep = Math.max(Math.pow(10, -Math.max(0, meta.precision)), meta.volatility * 0.03);
      if (Math.abs(delta) <= minStep) {
        const nearZeroPush = lastPush * 0.85;
        this.smoothControlPush.set(marketId, nearZeroPush);
        return (Math.random() - 0.5) * minStep * 0.45;
      }

      const guided = delta * 0.02;
      const targetPush = Math.max(-maxStep, Math.min(maxStep, guided));
      const easedPush = lastPush + ((targetPush - lastPush) * 0.06);
      const deltaFactor = Math.min(1, Math.max(0.15, Math.abs(delta) / (meta.volatility * 18)));
      const noise = (Math.random() - 0.5) * meta.volatility * 0.35 * deltaFactor;
      const drift = easedPush + noise;
      this.smoothControlPush.set(marketId, easedPush);
      if (Math.abs(drift) < minStep) {
        return Math.sign(delta) * minStep * 0.6;
      }
      return Math.max(-maxStep, Math.min(maxStep, drift));
    }

    this.smoothControlPush.set(marketId, lastPush * 0.9);
    return randomDrift;
  }

  getControlState() {
    const control = normalizeControl(this.control || DEFAULT_CONTROL);
    return {
      ...control,
      active: control.mode !== 'auto',
    };
  }

  setControl(payload = {}) {
    const hasControlPayload = ['mode', 'direction', 'strength', 'targetPrice']
      .some((key) => Object.prototype.hasOwnProperty.call(payload || {}, key));
    const sideBreakRaw = payload?.sideBreak || payload?.breakSide || payload?.forcedLoseSide;
    const shouldClearSideBreak = payload?.clearSideBreak === true;
    let sideBreakTouched = false;

    if (sideBreakRaw != null && String(sideBreakRaw).trim()) {
      const loseSide = this.normalizeOrderSide(sideBreakRaw);
      const now = Date.now();
      const candleState = this.getCandleState(now);
      const computedEndAt = Number(candleState?.endAt || 0);
      const endAt = Math.max(now + 2000, Number.isFinite(computedEndAt) ? computedEndAt : (now + CANDLE_DURATION_MS));
      this.sideBreak = {
        loseSide,
        startAt: now,
        endAt: Math.floor(endAt),
        updatedAt: now,
      };
      sideBreakTouched = true;
    } else if (shouldClearSideBreak) {
      this.sideBreak = createEmptySideBreak();
      sideBreakTouched = true;
    }

    if (!hasControlPayload) {
      if (sideBreakTouched) {
        this.broadcastUpdate();
        this.broadcastSnapshot(DEFAULT_SNAPSHOT_LIMIT);
      }
      return this.getControlState();
    }

    const requestedMode = String(payload?.mode || '').trim().toLowerCase();
    if (requestedMode === 'target') {
      const rawTargetPrice = Number(payload?.targetPrice);
      if (!Number.isFinite(rawTargetPrice) || rawTargetPrice <= 0) {
        throw new Error('targetPrice phai la so > 0');
      }
    }

    const nextControl = normalizeControl(payload || {});

    this.control = nextControl;
    this.broadcastUpdate();
    this.broadcastSnapshot(DEFAULT_SNAPSHOT_LIMIT);
    this.persistState().catch((error) => {
      console.error('[Trading Market] Persist control error:', error);
    });
    return this.getControlState();
  }

  clearControl() {
    this.control = { ...DEFAULT_CONTROL, updatedAt: Date.now() };
    this.broadcastUpdate();
    this.broadcastSnapshot(DEFAULT_SNAPSHOT_LIMIT);
    this.persistState().catch((error) => {
      console.error('[Trading Market] Persist control error:', error);
    });
    return this.getControlState();
  }

  getOrderPolicy() {
    return normalizeOrderPolicy(this.orderPolicy || DEFAULT_ORDER_POLICY);
  }

  setOrderPolicy(payload = {}) {
    this.orderPolicy = normalizeOrderPolicy(payload || {});
    this.persistState().catch((error) => {
      console.error('[Trading Market] Persist order policy error:', error);
    });
    this.broadcastUpdate();
    this.broadcastOrderBook();
    return this.getOrderPolicy();
  }

  getCandleState(now = Date.now()) {
    const durationMs = CANDLE_DURATION_MS;
    const lastStartRaw = Number(this.lastCandleAt || 0);
    const fallbackStart = Number.isFinite(lastStartRaw) && lastStartRaw > 0
      ? Math.floor(lastStartRaw)
      : Math.floor(now);

    const elapsed = Math.max(0, now - fallbackStart);
    const progressedMs = elapsed % durationMs;
    const remainingMs = progressedMs === 0 ? durationMs : (durationMs - progressedMs);

    return {
      durationMs,
      startAt: fallbackStart,
      endAt: Math.floor(now + remainingMs),
      remainingMs,
      remainingSec: Math.max(0, Math.ceil(remainingMs / 1000)),
    };
  }

  clearExpiredSideBreak(now = Date.now()) {
    const loseSide = String(this.sideBreak?.loseSide || '').trim().toUpperCase();
    const endAt = Number(this.sideBreak?.endAt || 0);
    const hasActivePayload = ORDER_SIDE_OPTIONS.includes(loseSide)
      || Number(this.sideBreak?.startAt || 0) > 0
      || endAt > 0;

    if (!hasActivePayload) return false;
    if (ORDER_SIDE_OPTIONS.includes(loseSide) && endAt > now) return false;

    this.sideBreak = createEmptySideBreak();
    return true;
  }

  getSideBreakState(now = Date.now()) {
    this.clearExpiredSideBreak(now);
    const loseSide = String(this.sideBreak?.loseSide || '').trim().toUpperCase();
    const startAt = Number(this.sideBreak?.startAt || 0);
    const endAt = Number(this.sideBreak?.endAt || 0);
    const updatedAt = Number(this.sideBreak?.updatedAt || 0);
    const active = ORDER_SIDE_OPTIONS.includes(loseSide) && endAt > now;
    const remainingMs = active ? Math.max(0, endAt - now) : 0;

    return {
      active,
      loseSide: active ? loseSide : null,
      startAt: active ? Math.floor(startAt) : 0,
      endAt: active ? Math.floor(endAt) : 0,
      updatedAt: updatedAt > 0 ? Math.floor(updatedAt) : 0,
      remainingMs,
      remainingSec: Math.max(0, Math.ceil(remainingMs / 1000)),
    };
  }

  setSideBreak(sideRaw) {
    const loseSide = this.normalizeOrderSide(sideRaw);
    const now = Date.now();
    const candleState = this.getCandleState(now);
    const computedEndAt = Number(candleState?.endAt || 0);
    const endAt = Math.max(now + 2000, Number.isFinite(computedEndAt) ? computedEndAt : (now + CANDLE_DURATION_MS));

    this.sideBreak = {
      loseSide,
      startAt: now,
      endAt: Math.floor(endAt),
      updatedAt: now,
    };

    this.broadcastUpdate();
    this.broadcastSnapshot(DEFAULT_SNAPSHOT_LIMIT);
    return this.getSideBreakState(now);
  }

  clearSideBreak() {
    const hadBreak = this.getSideBreakState().active;
    this.sideBreak = createEmptySideBreak();
    if (hadBreak) {
      this.broadcastUpdate();
      this.broadcastSnapshot(DEFAULT_SNAPSHOT_LIMIT);
    }
    return this.getSideBreakState();
  }

  normalizeOrderSide(sideRaw) {
    const side = String(sideRaw || '').trim().toUpperCase();
    if (!ORDER_SIDE_OPTIONS.includes(side)) {
      throw new Error('Lenh khong hop le. Chi ho tro CALL hoac PUT');
    }
    return side;
  }

  normalizeOrderDuration(durationRaw) {
    const parsed = Number(durationRaw);
    if (!Number.isFinite(parsed)) return FIXED_ORDER_DURATION_MS;
    return FIXED_ORDER_DURATION_MS;
  }

  normalizeOrderAmount(amountRaw) {
    const parsed = Number(amountRaw);
    if (!Number.isFinite(parsed)) return 0;
    return Math.max(MIN_ORDER_AMOUNT, Math.floor(parsed));
  }

  getCurrentMarketPrice(marketId = DEFAULT_MARKET_ID) {
    const meta = MARKETS.find((row) => row.id === marketId) || MARKETS[0];
    const state = this.marketStates.get(meta.id);
    const currentPrice = Number(state?.currentPrice ?? meta.basePrice);
    return roundByPrecision(currentPrice, meta.precision);
  }

  buildOrderId() {
    this.orderSeq = (this.orderSeq + 1) % 1000000;
    return `TM${Date.now()}${String(this.orderSeq).padStart(6, '0')}`;
  }

  summarizeOrder(order, now = Date.now()) {
    const item = order || {};
    const createdAt = Number(item.createdAt || 0);
    const endTime = Number(item.endTime || 0);
    const resolvedAt = Number(item.resolvedAt || 0);
    const timeLeftMs = item.status === 'ACTIVE'
      ? Math.max(0, endTime - now)
      : 0;
    const manualControl = this.orderControl.get(String(item.orderId || '')) || null;

    return {
      orderId: String(item.orderId || ''),
      userId: Number(item.userId || 0),
      username: String(item.username || ''),
      side: String(item.side || ''),
      amount: Number(item.amount || 0),
      marketId: String(item.marketId || DEFAULT_MARKET_ID),
      marketSymbol: String(item.marketSymbol || 'OK COIN'),
      entryPrice: Number(item.entryPrice || 0),
      exitPrice: Number(item.exitPrice || 0),
      status: String(item.status || 'ACTIVE'),
      isWin: item.isWin === true,
      payout: Number(item.payout || 0),
      payoutProcessed: item.payoutProcessed === true,
      controlDecision: item.controlDecision || null,
      sideBreakApplied: item.sideBreakApplied === true,
      manualControl: manualControl || null,
      createdAt: createdAt > 0 ? createdAt : Date.now(),
      endTime: endTime > 0 ? endTime : Date.now(),
      resolvedAt: resolvedAt > 0 ? resolvedAt : 0,
      durationMs: Number(item.durationMs || 0),
      timeLeftMs,
      timeLeftSec: Math.max(0, Math.ceil(timeLeftMs / 1000)),
    };
  }

  broadcastOrderBook(limit = 120) {
    if (!this.io) return;
    this.io.emit('trading_order_book_update', this.getOrderBook(limit));
  }

  placeOrder(payload = {}) {
    const marketId = String(payload.marketId || DEFAULT_MARKET_ID).trim().toLowerCase() || DEFAULT_MARKET_ID;
    const marketMeta = MARKETS.find((row) => row.id === marketId) || MARKETS[0];
    const userId = Number(payload.userId || 0);
    const amount = this.normalizeOrderAmount(payload.amount);
    const durationMs = this.normalizeOrderDuration(payload.durationMs);
    const side = this.normalizeOrderSide(payload.side || payload.type);
    const username = String(payload.username || `User_${userId || '0'}`);

    if (!Number.isInteger(userId) || userId <= 0) {
      throw new Error('Nguoi choi khong hop le');
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error('So tien lenh khong hop le');
    }

    const now = Date.now();
    const entryPrice = roundByPrecision(
      Number(payload.entryPrice || this.getCurrentMarketPrice(marketMeta.id)),
      marketMeta.precision,
    );

    const order = {
      orderId: this.buildOrderId(),
      userId,
      username,
      side,
      amount,
      marketId: marketMeta.id,
      marketSymbol: marketMeta.symbol,
      entryPrice,
      exitPrice: 0,
      status: 'ACTIVE',
      isWin: null,
      payout: 0,
      payoutProcessed: false,
      controlDecision: null,
      createdAt: now,
      endTime: now + durationMs,
      resolvedAt: 0,
      durationMs,
    };

    this.activeOrders.set(order.orderId, order);

    if (this.activeOrders.size > MAX_ACTIVE_ORDER_COUNT) {
      const activeSorted = [...this.activeOrders.values()].sort((a, b) => Number(a.createdAt || 0) - Number(b.createdAt || 0));
      const toTrim = activeSorted.slice(0, this.activeOrders.size - MAX_ACTIVE_ORDER_COUNT);
      toTrim.forEach((item) => {
        this.activeOrders.delete(item.orderId);
        this.orderControl.delete(item.orderId);
      });
    }

    this.broadcastOrderBook();
    return this.summarizeOrder(order);
  }

  cancelOrder(orderId) {
    const id = String(orderId || '').trim();
    if (!id) return false;
    const existed = this.activeOrders.delete(id);
    this.orderControl.delete(id);
    if (existed) {
      this.broadcastOrderBook();
    }
    return existed;
  }

  getOrder(orderId) {
    const id = String(orderId || '').trim();
    if (!id) return null;
    const active = this.activeOrders.get(id);
    if (active) return active;
    const settled = this.settledOrders.find((item) => String(item.orderId || '') === id);
    return settled || null;
  }

  getEffectiveOrderControl(order) {
    const orderId = String(order?.orderId || '');
    const manual = String(this.orderControl.get(orderId) || '').trim().toLowerCase();
    if (manual === 'kill' || manual === 'nurture') return manual;

    const policy = this.getOrderPolicy();
    if (!policy.enabled) return null;

    const amount = Number(order?.amount || 0);
    const isSmallOrder = amount <= Number(policy.thresholdAmount || DEFAULT_ORDER_POLICY.thresholdAmount);
    if (policy.mode === 'kill_big') {
      return isSmallOrder ? 'nurture' : 'kill';
    }
    return isSmallOrder ? 'kill' : 'nurture';
  }

  setOrderControl(orderId, status) {
    const id = String(orderId || '').trim();
    if (!id) throw new Error('Thieu ma lenh');
    if (!this.activeOrders.has(id)) {
      throw new Error('Chi co the can thiep lenh dang chay');
    }

    const normalized = String(status || '').trim().toLowerCase();
    if (!normalized) {
      this.orderControl.delete(id);
    } else if (normalized === 'kill' || normalized === 'nurture') {
      this.orderControl.set(id, normalized);
    } else {
      throw new Error('Trang thai lenh khong hop le');
    }

    this.broadcastOrderBook();
    return this.summarizeOrder(this.activeOrders.get(id));
  }

  clearOrderControl(orderId) {
    return this.setOrderControl(orderId, null);
  }

  getOrderBook(limit = 120) {
    const safeLimitRaw = Number(limit);
    const safeLimit = Number.isFinite(safeLimitRaw)
      ? Math.min(Math.max(Math.floor(safeLimitRaw), 10), 500)
      : 120;
    const now = Date.now();
    const activeOrders = [...this.activeOrders.values()]
      .sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0))
      .slice(0, safeLimit)
      .map((item) => this.summarizeOrder(item, now));
    const recentOrders = [...this.settledOrders]
      .sort((a, b) => Number(b.resolvedAt || 0) - Number(a.resolvedAt || 0))
      .slice(0, safeLimit)
      .map((item) => this.summarizeOrder(item, now));

    let totalCallOrders = 0;
    let totalPutOrders = 0;
    let totalCallAmount = 0;
    let totalPutAmount = 0;
    for (const item of this.activeOrders.values()) {
      const side = String(item?.side || '').toUpperCase();
      const amount = Number(item?.amount || 0);
      if (side === 'CALL') {
        totalCallOrders += 1;
        totalCallAmount += amount;
      } else if (side === 'PUT') {
        totalPutOrders += 1;
        totalPutAmount += amount;
      }
    }
    const totalActiveAmount = totalCallAmount + totalPutAmount;
    return {
      activeOrders,
      recentOrders,
      totalActiveOrders: Number(this.activeOrders.size || 0),
      totalActiveAmount,
      totalCallOrders,
      totalPutOrders,
      totalCallAmount,
      totalPutAmount,
      orderPolicy: this.getOrderPolicy(),
    };
  }

  resolveOrder(orderId, options = {}) {
    const id = String(orderId || '').trim();
    if (!id) throw new Error('Thieu ma lenh');
    const activeOrder = this.activeOrders.get(id);
    if (!activeOrder) {
      const settledOrder = this.settledOrders.find((item) => String(item.orderId || '') === id);
      if (!settledOrder) {
        throw new Error('Khong tim thay lenh');
      }
      return {
        order: this.summarizeOrder(settledOrder),
        justSettled: false,
      };
    }

    const now = Date.now();
    const forceResolve = options?.force === true;
    if (!forceResolve && now < Number(activeOrder.endTime || 0)) {
      throw new Error('Lenh chua den thoi diem ket thuc');
    }

    const marketMeta = MARKETS.find((row) => row.id === activeOrder.marketId) || MARKETS[0];
    const exitPriceRaw = Number(options?.exitPrice);
    let exitPrice = Number.isFinite(exitPriceRaw)
      ? roundByPrecision(exitPriceRaw, marketMeta.precision)
      : this.getCurrentMarketPrice(activeOrder.marketId);

    const sideBreakState = this.getSideBreakState(now);
    const sideBreakApplied = sideBreakState.active && sideBreakState.loseSide === String(activeOrder.side || '').toUpperCase();
    if (sideBreakApplied) {
      const precision = Math.max(0, Math.min(8, Number(marketMeta?.precision || 2)));
      const priceStep = Math.max(Math.pow(10, -precision), 0.0001);
      const edgeTicks = Math.random() < 0.5 ? 1 : 2;
      const edgeValue = roundByPrecision(priceStep * edgeTicks, precision);
      const entryPrice = Number(activeOrder.entryPrice || 0);
      const forcedExitRaw = activeOrder.side === 'CALL'
        ? (entryPrice - edgeValue)
        : (entryPrice + edgeValue);
      exitPrice = roundByPrecision(Math.max(priceStep, forcedExitRaw), precision);
    }

    const controlDecision = this.getEffectiveOrderControl(activeOrder);
    let isWin = false;
    if (sideBreakApplied) {
      isWin = false;
    } else if (controlDecision === 'kill') {
      isWin = false;
    } else if (controlDecision === 'nurture') {
      isWin = true;
    } else if (activeOrder.side === 'CALL') {
      isWin = exitPrice > Number(activeOrder.entryPrice || 0);
    } else {
      isWin = exitPrice < Number(activeOrder.entryPrice || 0);
    }

    if (exitPrice === Number(activeOrder.entryPrice || 0) && controlDecision == null) {
      isWin = Math.random() >= 0.5;
    }

    const payout = isWin ? Math.floor(Number(activeOrder.amount || 0) * TRADING_ORDER_PAYOUT_RATE) : 0;
    const settled = {
      ...activeOrder,
      status: 'SETTLED',
      isWin,
      payout,
      exitPrice,
      resolvedAt: now,
      payoutProcessed: false,
      controlDecision: sideBreakApplied ? 'break_side' : (controlDecision || null),
      sideBreakApplied,
    };

    this.activeOrders.delete(id);
    this.orderControl.delete(id);
    this.settledOrders.unshift(settled);
    if (this.settledOrders.length > MAX_SETTLED_ORDER_HISTORY) {
      this.settledOrders.splice(MAX_SETTLED_ORDER_HISTORY);
    }

    this.broadcastOrderBook();
    return {
      order: this.summarizeOrder(settled),
      justSettled: true,
    };
  }

  markOrderPayoutProcessed(orderId) {
    const id = String(orderId || '').trim();
    if (!id) return null;
    const settled = this.settledOrders.find((item) => String(item.orderId || '') === id);
    if (!settled) return null;
    settled.payoutProcessed = true;
    return this.summarizeOrder(settled);
  }

  getControlPanelState(limit = 120) {
    return {
      control: this.getControlState(),
      orderPolicy: this.getOrderPolicy(),
      sideBreak: this.getSideBreakState(),
      candleState: this.getCandleState(),
      orderBook: this.getOrderBook(limit),
    };
  }

  buildTickerObject() {
    const ticker = {};
    for (const meta of MARKETS) {
      const state = this.marketStates.get(meta.id) || {
        currentPrice: roundByPrecision(meta.basePrice, meta.precision),
        change: 0,
        changePct: 0,
      };
      ticker[meta.id] = {
        id: meta.id,
        symbol: meta.symbol,
        name: meta.name,
        basePrice: meta.basePrice,
        precision: meta.precision,
        price: roundByPrecision(state.currentPrice, meta.precision),
        change: roundByPrecision(state.change, meta.precision),
        changePct: Number(toFiniteNumber(state.changePct, 0).toFixed(4)),
      };
    }
    return ticker;
  }

  buildLatestCandlesObject() {
    const latest = {};
    for (const meta of MARKETS) {
      const history = this.marketHistories.get(meta.id) || [];
      const candle = history[history.length - 1];
      if (!candle) continue;
      latest[meta.id] = normalizeCandle(candle, meta.basePrice, meta.precision, Date.now());
    }
    return latest;
  }

  getSnapshot(limit = DEFAULT_SNAPSHOT_LIMIT) {
    const safeLimitRaw = Number(limit);
    const safeLimit = Number.isFinite(safeLimitRaw)
      ? Math.min(Math.max(Math.floor(safeLimitRaw), 20), MAX_DATA_POINTS)
      : DEFAULT_SNAPSHOT_LIMIT;

    const ticker = this.buildTickerObject();
    const historyByMarket = {};
    for (const meta of MARKETS) {
      const rows = this.marketHistories.get(meta.id) || [];
      historyByMarket[meta.id] = rows.slice(-safeLimit).map((item) => ({
        o: item.o,
        h: item.h,
        l: item.l,
        c: item.c,
        timestamp: item.timestamp,
      }));
    }

    return {
      defaultMarketId: DEFAULT_MARKET_ID,
      serverTime: Date.now(),
      sequence: this.sequence,
      tickIntervalMs: TICK_INTERVAL_MS,
      candleDurationMs: CANDLE_DURATION_MS,
      lastCandleAt: this.lastCandleAt,
      candleState: this.getCandleState(),
      control: this.getControlState(),
      sideBreak: this.getSideBreakState(),
      orderPolicy: this.getOrderPolicy(),
      markets: ticker,
      historyByMarket,
    };
  }

  broadcastSnapshot(limit = DEFAULT_SNAPSHOT_LIMIT) {
    if (!this.io) return;
    this.io.emit('trading_market_snapshot', this.getSnapshot(limit));
  }

  broadcastUpdate() {
    if (!this.io) return;
    this.io.emit('trading_market_update', {
      serverTime: Date.now(),
      sequence: this.sequence,
      lastCandleAt: this.lastCandleAt,
      candleDurationMs: CANDLE_DURATION_MS,
      candleState: this.getCandleState(),
      control: this.getControlState(),
      sideBreak: this.getSideBreakState(),
      orderPolicy: this.getOrderPolicy(),
      markets: this.buildTickerObject(),
      latestCandles: this.buildLatestCandlesObject(),
    });
  }

  async persistState() {
    if (!isMongoConnected()) {
      return false;
    }

    const markets = MARKETS.map((meta) => {
      const state = this.marketStates.get(meta.id) || {
        currentPrice: roundByPrecision(meta.basePrice, meta.precision),
        change: 0,
        changePct: 0,
      };
      const history = (this.marketHistories.get(meta.id) || [])
        .slice(-PERSIST_HISTORY_LIMIT)
        .map((item) => normalizeCandle(item, state.currentPrice, meta.precision, Date.now()));

      return {
        id: meta.id,
        symbol: meta.symbol,
        name: meta.name,
        basePrice: meta.basePrice,
        volatility: meta.volatility,
        precision: meta.precision,
        currentPrice: roundByPrecision(state.currentPrice, meta.precision),
        change: roundByPrecision(state.change, meta.precision),
        changePct: Number(toFiniteNumber(state.changePct, 0).toFixed(4)),
        history,
      };
    });

    try {
      await TradingMarketState.findOneAndUpdate(
        { key: 'global' },
        {
          $set: {
            key: 'global',
            version: 1,
            lastCandleAt: this.lastCandleAt,
            tickIntervalMs: TICK_INTERVAL_MS,
            candleDurationMs: CANDLE_DURATION_MS,
            control: normalizeControl(this.control || DEFAULT_CONTROL),
            orderPolicy: this.getOrderPolicy(),
            markets,
          },
        },
        { upsert: true },
      );
      return true;
    } catch (error) {
      const msg = String(error?.message || '').toLowerCase();
      const disconnected = error?.name === 'MongoNotConnectedError'
        || msg.includes('must be connected before running operations')
        || !isMongoConnected();
      if (disconnected) {
        return false;
      }
      throw error;
    }
  }

  stop() {
    this.running = false;
    if (this.tickTimer) {
      clearInterval(this.tickTimer);
      this.tickTimer = null;
    }
    if (this.broadcastTimer) {
      clearInterval(this.broadcastTimer);
      this.broadcastTimer = null;
    }
    if (this.persistTimer) {
      clearInterval(this.persistTimer);
      this.persistTimer = null;
    }
    this.persistState().catch((error) => {
      console.error('[Trading Market] Persist on stop error:', error);
    });
  }
}

module.exports = TradingMarketSession;
