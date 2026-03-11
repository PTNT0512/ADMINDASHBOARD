const TxGameHistory = require('../models/TxGameHistory');
const TxRoomSetting = require('../models/TxRoomSetting');
const TxAutoBotSetting = require('../models/TxAutoBotSetting');
const Account = require('../models/Account');
const Transaction = require('../models/Transaction');

const AUTO_BOT_DEFAULT = {
  enabled: true,
  botCount: 50,
  minAmount: 10000,
  maxAmount: 500000,
};

const normalizeAutoBotConfig = (raw = {}) => {
  const source = raw || {};
  const enabled = source.enabled !== false;
  const botCountRaw = Number(source.botCount ?? AUTO_BOT_DEFAULT.botCount);
  const minAmountRaw = Number(source.minAmount ?? AUTO_BOT_DEFAULT.minAmount);
  const maxAmountRaw = Number(source.maxAmount ?? AUTO_BOT_DEFAULT.maxAmount);

  const botCount = Math.min(999, Math.max(50, Math.floor(Number.isFinite(botCountRaw) ? botCountRaw : AUTO_BOT_DEFAULT.botCount)));
  const minAmount = Math.max(1000, Math.floor(Number.isFinite(minAmountRaw) ? minAmountRaw : AUTO_BOT_DEFAULT.minAmount));
  const maxAmount = Math.max(minAmount, Math.floor(Number.isFinite(maxAmountRaw) ? maxAmountRaw : AUTO_BOT_DEFAULT.maxAmount));

  return { enabled, botCount, minAmount, maxAmount };
};

class GameSession {
  constructor(io, gameType) {
    this.io = io;
    this.gameType = gameType;
    this.running = false;
    this.timeLeft = 0;
    this.phase = 'BETTING'; // BETTING, RESULT, PREPARE
    this.sessionId = 0;
    this.dice = [0, 0, 0];
    this.bets = { tai: 0, xiu: 0 }; // Real player totals
    this.detailedBets = []; // Real player details
    this.autoBotBets = { tai: 0, xiu: 0 };
    this.autoBotDetailedBets = [];
    this.autoBotSchedule = new Map();
    this.autoBotConfig = { ...AUTO_BOT_DEFAULT };
    this.interval = null;
    this.retryTimeout = null;

    this.jackpot = 50000000 + Math.floor(Math.random() * 10000000);
    this.jackpotResult = null;
    this.forcedResult = null;
  }

  async init() {
    if (this.interval) return;
    this.running = true;

    try {
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

      this.sessionId = Number(last?.sessionIdNum || 0);
      console.log(`[${this.gameType}] Khoi dong phien tiep theo #${this.sessionId + 1}`);
      await this.startBetting();

      this.interval = setInterval(() => {
        Promise.resolve(this.tick()).catch((error) => {
          console.error(`[${this.gameType}] Tick error:`, error);
        });
      }, 1000);
    } catch (error) {
      console.error(`[${this.gameType}] Init session error:`, error);
      if (this.running) {
        this.retryTimeout = setTimeout(() => this.init(), 5000);
      }
    }
  }

  async tick() {
    if (!this.running) return;
    this.timeLeft -= 1;
    if (this.phase === 'BETTING') {
      this.applyScheduledAutoBotBets();
    }

    if (this.timeLeft <= 0) {
      if (this.phase === 'BETTING') {
        await this.startResult();
      } else if (this.phase === 'RESULT') {
        this.startPrepare();
      } else if (this.phase === 'PREPARE') {
        await this.startBetting();
      }
    }

    this.broadcast();
  }

  async startBetting() {
    this.phase = 'BETTING';
    this.timeLeft = 60;
    this.sessionId += 1;
    this.bets = { tai: 0, xiu: 0 };
    this.detailedBets = [];
    this.autoBotBets = { tai: 0, xiu: 0 };
    this.autoBotDetailedBets = [];
    this.autoBotSchedule = new Map();
    this.dice = [0, 0, 0];
    this.jackpotResult = null;
    this.jackpot += Math.floor(Math.random() * 50000);

    await this.loadAutoBotConfig();
    this.seedAutoBotBetsForRound();
  }

  async loadAutoBotConfig() {
    try {
      const raw = await TxAutoBotSetting.findOne({ roomType: this.gameType }).lean();
      this.autoBotConfig = normalizeAutoBotConfig(raw || AUTO_BOT_DEFAULT);
    } catch (error) {
      this.autoBotConfig = { ...AUTO_BOT_DEFAULT };
      console.error(`[${this.gameType}] Load auto bot config error:`, error?.message || error);
    }
  }

  randomAutoBetAmount() {
    const min = Math.max(1000, Math.floor(Number(this.autoBotConfig.minAmount || AUTO_BOT_DEFAULT.minAmount)));
    const max = Math.max(min, Math.floor(Number(this.autoBotConfig.maxAmount || AUTO_BOT_DEFAULT.maxAmount)));
    const randomValue = Math.floor(Math.random() * (max - min + 1)) + min;
    return Math.max(1000, Math.round(randomValue / 1000) * 1000);
  }

  seedAutoBotBetsForRound() {
    const cfg = normalizeAutoBotConfig(this.autoBotConfig || AUTO_BOT_DEFAULT);
    this.autoBotConfig = cfg;
    this.autoBotBets = { tai: 0, xiu: 0 };
    this.autoBotDetailedBets = [];
    this.autoBotSchedule = new Map();

    if (!cfg.enabled) return;

    const baseName = this.gameType === 'taixiucao' ? 'BOT_CAO' : 'BOT_NAN';
    const taiChance = 0.2 + (Math.random() * 0.6); // 20%-80% each round, no forced balance
    const minTimeLeft = 6; // Stop adding bot bets at 5s remaining
    const maxTimeLeft = Math.max(minTimeLeft, Number(this.timeLeft || 60) - 1);
    const slots = Math.max(1, maxTimeLeft - minTimeLeft + 1);
    const basePerSlot = Math.floor(cfg.botCount / slots);
    const slotCounts = new Array(slots).fill(basePerSlot);
    let remainder = cfg.botCount - (basePerSlot * slots);
    while (remainder > 0) {
      const randomSlot = Math.floor(Math.random() * slots);
      slotCounts[randomSlot] += 1;
      remainder -= 1;
    }

    let created = 0;
    for (let slotIndex = 0; slotIndex < slots; slotIndex += 1) {
      const count = Number(slotCounts[slotIndex] || 0);
      if (count <= 0) continue;

      const atTimeLeft = maxTimeLeft - slotIndex;
      const slotBets = this.autoBotSchedule.get(atTimeLeft) || [];

      for (let j = 0; j < count; j += 1) {
        const sideKey = Math.random() < taiChance ? 'tai' : 'xiu';
        const target = sideKey === 'tai' ? 'TAI' : 'XIU';
        const amount = this.randomAutoBetAmount();
        slotBets.push({
          userId: -(created + 1),
          username: `${baseName}_${String(created + 1).padStart(3, '0')}`,
          amount,
          target,
          sideKey,
          isAutoBot: true,
        });
        created += 1;
      }

      this.autoBotSchedule.set(atTimeLeft, slotBets);
    }
  }

  applyScheduledAutoBotBets() {
    if (!(this.autoBotSchedule instanceof Map) || this.autoBotSchedule.size === 0) return;

    const currentTimeLeft = Number(this.timeLeft || 0);
    if (currentTimeLeft <= 5) return;

    const scheduled = this.autoBotSchedule.get(currentTimeLeft);
    if (!Array.isArray(scheduled) || scheduled.length === 0) return;

    scheduled.forEach((bet) => {
      const sideKey = bet?.sideKey === 'xiu' ? 'xiu' : 'tai';
      const amount = Number(bet?.amount || 0);
      if (!Number.isFinite(amount) || amount <= 0) return;
      this.autoBotBets[sideKey] += amount;
      this.autoBotDetailedBets.push({
        userId: Number(bet.userId || 0),
        username: String(bet.username || `BOT_${Math.abs(Number(bet.userId || 0))}`),
        amount,
        target: sideKey === 'tai' ? 'TAI' : 'XIU',
        isAutoBot: true,
      });
    });

    this.autoBotSchedule.delete(currentTimeLeft);
  }

  async startResult() {
    this.phase = 'RESULT';
    this.timeLeft = 15;

    try {
      if (this.forcedResult && this.forcedResult.dice1) {
        this.dice = [
          Number(this.forcedResult.dice1),
          Number(this.forcedResult.dice2),
          Number(this.forcedResult.dice3),
        ];
        this.forcedResult = null;
      } else {
        const setting = await TxRoomSetting.findOne({ roomType: this.gameType }).lean();

        if (setting?.forceResult?.dice1) {
          this.dice = [
            Number(setting.forceResult.dice1),
            Number(setting.forceResult.dice2),
            Number(setting.forceResult.dice3),
          ];
          await TxRoomSetting.updateOne({ roomType: this.gameType }, { $unset: { forceResult: 1 } });
        } else {
          this.dice = [
            Math.floor(Math.random() * 6) + 1,
            Math.floor(Math.random() * 6) + 1,
            Math.floor(Math.random() * 6) + 1,
          ];
        }
      }

      const sum = this.dice[0] + this.dice[1] + this.dice[2];
      const isTriple = this.dice[0] === this.dice[1] && this.dice[1] === this.dice[2];

      if (isTriple && (sum === 3 || sum === 18)) {
        const winAmount = Math.floor(this.jackpot * 0.5);
        this.jackpotResult = {
          trigger: sum === 3 ? '111' : '666',
          spinDice: [
            Math.floor(Math.random() * 6) + 1,
            Math.floor(Math.random() * 6) + 1,
            Math.floor(Math.random() * 6) + 1,
          ],
          percent: 50,
          amount: winAmount,
        };
        this.jackpot -= winAmount;
      }

      const realTotalBet = Object.values(this.bets).reduce((a, b) => a + b, 0);
      const autoBotTotalBet = Object.values(this.autoBotBets).reduce((a, b) => a + b, 0);
      const totalBet = realTotalBet + autoBotTotalBet;
      const roundResult = this.resolveRoundResult(this.dice);
      const totalPayout = await this.settleDetailedBets(roundResult.resultKey);
      const profit = realTotalBet - totalPayout;

      await TxGameHistory.create({
        sessionId: String(this.sessionId),
        roomType: this.gameType,
        result: roundResult.resultLabel,
        dice: [...this.dice],
        totalBet,
        realTotalBet,
        totalPayout,
        profit,
        fee: 0,
        banker: 'Bot',
        date: new Date(),
      });
    } catch (error) {
      console.error(`[${this.gameType}] Process result error:`, error);
      // Keep round progressing with a valid fallback dice set.
      this.dice = [
        Math.floor(Math.random() * 6) + 1,
        Math.floor(Math.random() * 6) + 1,
        Math.floor(Math.random() * 6) + 1,
      ];
    }
  }

  startPrepare() {
    this.phase = 'PREPARE';
    this.timeLeft = 5;
  }

  resolveRoundResult(dice) {
    const d1 = Number(dice?.[0] || 0);
    const d2 = Number(dice?.[1] || 0);
    const d3 = Number(dice?.[2] || 0);
    const sum = d1 + d2 + d3;

    if (sum >= 11) return { resultKey: 'T', resultLabel: 'Tai', sum };
    return { resultKey: 'X', resultLabel: 'Xiu', sum };
  }

  calcPayout(target, amount, resultKey) {
    const side = String(target || '').trim().toUpperCase();
    const betAmount = Number(amount || 0);
    if (!Number.isFinite(betAmount) || betAmount <= 0) return 0;

    if (side === 'TAI' && resultKey === 'T') return Math.floor(betAmount * 1.96);
    if (side === 'XIU' && resultKey === 'X') return Math.floor(betAmount * 1.96);
    return 0;
  }

  async settleDetailedBets(resultKey) {
    if (!Array.isArray(this.detailedBets) || this.detailedBets.length === 0) {
      return 0;
    }

    const payoutByUser = new Map();

    this.detailedBets.forEach((bet) => {
      const userId = Number(bet?.userId || 0);
      const amount = Number(bet?.amount || 0);
      const target = String(bet?.target || '').toUpperCase();
      if (!Number.isInteger(userId) || userId <= 0) return;
      if (!Number.isFinite(amount) || amount <= 0) return;

      const payout = this.calcPayout(target, amount, resultKey);
      if (payout <= 0) return;
      payoutByUser.set(userId, (payoutByUser.get(userId) || 0) + payout);
    });

    if (payoutByUser.size === 0) return 0;

    let totalPayout = 0;
    for (const [userId, payout] of payoutByUser.entries()) {
      try {
        const account = await Account.findOne({ userId });
        if (!account) continue;

        const oldBalance = Number(account.balance || 0);
        account.balance = oldBalance + payout;
        await account.save();

        totalPayout += payout;
        await Transaction.create({
          userId,
          amount: payout,
          action: 'game_win',
          oldBalance,
          newBalance: Number(account.balance || 0),
          description: `Tra thuong ${this.gameType} phien ${this.sessionId}`,
        });
      } catch (error) {
        console.error(`[${this.gameType}] Settle payout error for user ${userId}:`, error);
      }
    }

    return totalPayout;
  }

  handleBet(type, amount, player = null) {
    if (this.phase !== 'BETTING') return false;
    if (this.bets[type] === undefined) return false;

    this.bets[type] += amount;
    this.jackpot += Math.floor(amount * 0.02);

    if (player && player.userId) {
      const normalizedType = String(type).toUpperCase();
      const normalizedUserId = Number(player.userId);
      const username = String(player.username || `User_${normalizedUserId}`);

      const existing = this.detailedBets.find(
        (item) => Number(item.userId) === normalizedUserId && String(item.target) === normalizedType,
      );

      if (existing) {
        existing.amount = Number(existing.amount || 0) + amount;
      } else {
        this.detailedBets.unshift({
          userId: normalizedUserId,
          username,
          amount,
          target: normalizedType,
        });
      }
    }

    return true;
  }

  buildBroadcastBets() {
    return {
      tai: Number(this.bets.tai || 0) + Number(this.autoBotBets.tai || 0),
      xiu: Number(this.bets.xiu || 0) + Number(this.autoBotBets.xiu || 0),
    };
  }

  buildBroadcastDetailedBets() {
    return [...this.autoBotDetailedBets, ...this.detailedBets];
  }

  broadcast() {
    const stats = {
      timeLeft: this.timeLeft,
      phase: this.phase,
      sessionId: this.sessionId,
      bets: this.buildBroadcastBets(),
      detailedBets: this.buildBroadcastDetailedBets(),
      dice: this.dice,
      jackpot: this.jackpot,
      jackpotResult: this.jackpotResult,
      isAiMode: true,
      isAutoKillMode: false,
      playerControl: {},
      blacklist: [],
    };

    this.io.emit('stats-update', { game: this.gameType, stats });
    this.io.emit(this.gameType, stats);
  }

  setForcedResult(payload = {}) {
    const dice1 = Number(payload.dice1);
    const dice2 = Number(payload.dice2);
    const dice3 = Number(payload.dice3);
    const allValid = [dice1, dice2, dice3].every((n) => Number.isInteger(n) && n >= 1 && n <= 6);
    if (!allValid) {
      throw new Error('Dice must be integer in range 1..6');
    }

    this.forcedResult = {
      dice1,
      dice2,
      dice3,
      updatedAt: new Date(),
    };
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
      mode: 'dice',
    };
  }

  stop() {
    this.running = false;
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    if (this.retryTimeout) {
      clearTimeout(this.retryTimeout);
      this.retryTimeout = null;
    }
    console.log(`[${this.gameType}] Session server stopped`);
  }
}

module.exports = GameSession;
