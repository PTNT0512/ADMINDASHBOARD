const TxGameHistory = require('../models/TxGameHistory');

const AVIATOR_WAIT_MS = 7000;
const AVIATOR_CRASH_HOLD_MS = 3000;

const STANDARD_CONFIG = {
  baccarat: { bettingSeconds: 15, resultSeconds: 6, outcomes: ['PLAYER', 'BANKER', 'TIE'] },
  xocdia: { bettingSeconds: 20, resultSeconds: 6, outcomes: ['CHAN', 'LE'] },
  rongho: { bettingSeconds: 15, resultSeconds: 6, outcomes: ['DRAGON', 'TIGER', 'TIE'] },
};

class ExtraGameSession {
  constructor(io, gameType) {
    this.io = io;
    this.gameType = gameType;
    this.running = false;
    this.interval = null;
    this.sessionId = 0;
    this.phase = 'WAITING';
    this.timeLeft = 0;
    this.elapsedMs = 0;
    this.multiplier = 1;
    this.crashPoint = 2;
    this.crashedAt = null;
    this.result = null;
    this.resultSaved = false;
    this.waitMs = AVIATOR_WAIT_MS;
    this.forcedResult = null;
  }

  async init() {
    if (this.interval) return;
    this.running = true;
    this.sessionId = await this.loadLastSessionId();

    if (this.gameType === 'aviator') {
      this.startAviatorWaiting();
      this.interval = setInterval(() => this.tickAviator(), 100);
    } else {
      this.startStandardBetting();
      this.interval = setInterval(() => this.tickStandard(), 1000);
    }
  }

  async loadLastSessionId() {
    const [last] = await TxGameHistory.aggregate([
      { $match: { roomType: this.gameType } },
      {
        $addFields: {
          sessionIdNum: {
            $convert: { input: '$sessionId', to: 'int', onError: 0, onNull: 0 },
          },
        },
      },
      { $sort: { sessionIdNum: -1 } },
      { $limit: 1 },
      { $project: { _id: 0, sessionIdNum: 1 } },
    ]);
    return Number(last && last.sessionIdNum ? last.sessionIdNum : 0);
  }

  pickRandomOutcome() {
    if (this.forcedResult && this.forcedResult.outcome) {
      const forced = String(this.forcedResult.outcome);
      this.forcedResult = null;
      return forced;
    }

    const cfg = STANDARD_CONFIG[this.gameType];
    const pool = cfg && Array.isArray(cfg.outcomes) ? cfg.outcomes : ['WIN'];
    return pool[Math.floor(Math.random() * pool.length)];
  }

  pickCrashPoint() {
    if (this.forcedResult && Number.isFinite(Number(this.forcedResult.crashPoint))) {
      const forced = Number(this.forcedResult.crashPoint);
      this.forcedResult = null;
      return Math.max(1.01, forced);
    }

    const rand = Math.random();
    if (rand < 0.1) return 1 + Math.random() * 0.2;
    if (rand < 0.75) return 1.2 + Math.random() * 3.3;
    if (rand < 0.95) return 4.5 + Math.random() * 8;
    return 12 + Math.random() * 90;
  }

  startAviatorWaiting() {
    this.sessionId += 1;
    this.phase = 'WAITING';
    this.waitMs = AVIATOR_WAIT_MS;
    this.timeLeft = Math.ceil(this.waitMs / 1000);
    this.elapsedMs = 0;
    this.multiplier = 1;
    this.crashPoint = this.pickCrashPoint();
    this.crashedAt = null;
    this.result = null;
    this.resultSaved = false;
    this.broadcast();
  }

  startAviatorFlying() {
    this.phase = 'FLYING';
    this.elapsedMs = 0;
    this.timeLeft = 0;
    this.broadcast();
  }

  async startAviatorCrashed() {
    this.phase = 'CRASHED';
    this.crashedAt = this.multiplier;
    this.waitMs = AVIATOR_CRASH_HOLD_MS;
    this.timeLeft = Math.ceil(this.waitMs / 1000);
    this.result = `CRASH@${this.crashedAt.toFixed(2)}x`;
    this.broadcast();
    await this.saveRoundResult();
  }

  tickAviator() {
    if (!this.running) return;
    if (this.phase === 'WAITING') {
      this.waitMs -= 100;
      this.timeLeft = Math.max(0, Math.ceil(this.waitMs / 1000));
      this.broadcast();
      if (this.waitMs <= 0) this.startAviatorFlying();
      return;
    }

    if (this.phase === 'FLYING') {
      this.elapsedMs += 100;
      const elapsedSeconds = this.elapsedMs / 1000;
      this.multiplier = 1 + Math.pow(elapsedSeconds, 1.28) * 0.115;
      this.broadcast();
      if (this.multiplier >= this.crashPoint) {
        this.startAviatorCrashed();
      }
      return;
    }

    if (this.phase === 'CRASHED') {
      this.waitMs -= 100;
      this.timeLeft = Math.max(0, Math.ceil(this.waitMs / 1000));
      this.broadcast();
      if (this.waitMs <= 0) this.startAviatorWaiting();
    }
  }

  startStandardBetting() {
    const cfg = STANDARD_CONFIG[this.gameType];
    this.sessionId += 1;
    this.phase = 'BETTING';
    this.timeLeft = cfg.bettingSeconds;
    this.result = null;
    this.resultSaved = false;
    this.broadcast();
  }

  async startStandardResult() {
    const cfg = STANDARD_CONFIG[this.gameType];
    this.phase = 'RESULT';
    this.timeLeft = cfg.resultSeconds;
    this.result = this.pickRandomOutcome();
    this.broadcast();
    await this.saveRoundResult();
  }

  tickStandard() {
    if (!this.running) return;
    this.timeLeft -= 1;
    if (this.timeLeft <= 0) {
      if (this.phase === 'BETTING') {
        this.startStandardResult();
      } else if (this.phase === 'RESULT') {
        this.startStandardBetting();
      }
    }
    this.broadcast();
  }

  async saveRoundResult() {
    if (this.resultSaved) return;
    this.resultSaved = true;
    try {
      await TxGameHistory.create({
        sessionId: String(this.sessionId),
        roomType: this.gameType,
        result: String(this.result || ''),
        totalBet: 0,
        totalPayout: 0,
        profit: 0,
        date: new Date(),
      });
    } catch (error) {
      console.error(`[${this.gameType}] save round error:`, error);
    }
  }

  buildPayload() {
    if (this.gameType === 'aviator') {
      return {
        sessionId: this.sessionId,
        phase: this.phase,
        timeLeft: this.phase === 'WAITING' ? this.timeLeft : 0,
        elapsed: this.elapsedMs,
        multiplier: Number(this.multiplier.toFixed(4)),
        crashPoint: Number(this.crashPoint.toFixed(4)),
      };
    }

    return {
      sessionId: this.sessionId,
      phase: this.phase,
      timeLeft: this.timeLeft,
      result: this.result,
    };
  }

  broadcast() {
    const payload = this.buildPayload();
    const eventName = `${this.gameType}_update`;
    this.io.emit(eventName, payload);
    this.io.emit(this.gameType, payload);
    this.io.emit('stats-update', { game: this.gameType, stats: payload });
  }

  setForcedResult(payload = {}) {
    if (this.gameType === 'aviator') {
      const crashPoint = Number(payload.crashPoint);
      if (!Number.isFinite(crashPoint) || crashPoint < 1.01) {
        throw new Error('Aviator crashPoint must be >= 1.01');
      }
      this.forcedResult = { crashPoint, updatedAt: new Date() };
      return;
    }

    const cfg = STANDARD_CONFIG[this.gameType];
    const outcome = String(payload.outcome || '').trim().toUpperCase();
    const valid = cfg?.outcomes || [];
    if (!valid.includes(outcome)) {
      throw new Error(`Invalid outcome for ${this.gameType}`);
    }

    this.forcedResult = { outcome, updatedAt: new Date() };
  }

  clearForcedResult() {
    this.forcedResult = null;
  }

  getControlState() {
    return {
      gameType: this.gameType,
      running: this.running,
      phase: this.phase,
      timeLeft: this.timeLeft,
      sessionId: this.sessionId,
      forcedResult: this.forcedResult,
      mode: this.gameType === 'aviator' ? 'crash' : 'outcome',
    };
  }

  stop() {
    this.running = false;
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }
}

module.exports = ExtraGameSession;
