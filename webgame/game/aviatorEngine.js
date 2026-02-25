const crypto = require('crypto');
const Account = require('../models/Account'); // Giả định bạn có model Account để quản lý người dùng

const GAME_PHASES = {
  WAITING: 'WAITING',
  FLYING: 'FLYING',
  CRASHED: 'CRASHED',
};

const WAIT_TIME = 7000; // 7 giây chờ
const CRASH_DELAY = 3000; // 3 giây hiển thị kết quả trước khi sang ván mới

class AviatorEngine {
  constructor(io) {
    this.io = io; // Instance của Socket.IO server
    this.phase = GAME_PHASES.WAITING;
    this.multiplier = 1.00;
    this.crashPoint = 0;
    this.startTime = 0;
    this.waitTimeLeft = WAIT_TIME;
    
    // Lưu cược của người chơi cho ván hiện tại hoặc ván kế tiếp
    // Cấu trúc: Map<userId, { betAmount: number, cashOutAt: number | null }>
    this.activeBets = new Map();
    this.nextRoundBets = new Map();

    this._gameLoopInterval = null;
    this._waitTimer = null;

    console.log("✈️  Aviator Engine Initialized.");
    this._startWaitingPhase();
  }

  /**
   * Bắt đầu giai đoạn chờ, nhận cược.
   */
  _startWaitingPhase() {
    this.phase = GAME_PHASES.WAITING;
    this.multiplier = 1.00;
    this.crashPoint = this._generateCrashPoint();
    this.waitTimeLeft = WAIT_TIME;

    // Chuyển cược "ván sau" thành cược "ván này"
    this.activeBets.clear();
    this.nextRoundBets.forEach((value, key) => {
        this.activeBets.set(key, value);
    });
    this.nextRoundBets.clear();

    console.log(`✈️  New round starting. Crashing at ${this.crashPoint.toFixed(2)}x. Active bets: ${this.activeBets.size}`);

    // Bắt đầu đếm ngược
    if (this._waitTimer) clearInterval(this._waitTimer);
    this._waitTimer = setInterval(() => {
      this.waitTimeLeft -= 1000;
      this._broadcastState();

      if (this.waitTimeLeft <= 0) {
        clearInterval(this._waitTimer);
        this._startFlyingPhase();
      }
    }, 1000);
  }

  /**
   * Bắt đầu giai đoạn máy bay cất cánh.
   */
  _startFlyingPhase() {
    this.phase = GAME_PHASES.FLYING;
    this.startTime = Date.now();

    if (this._gameLoopInterval) clearInterval(this._gameLoopInterval);
    this._gameLoopInterval = setInterval(() => {
      this._updateFlyingPhase();
    }, 100); // Cập nhật 10 lần/giây để mượt hơn
  }

  /**
   * Cập nhật hệ số nhân khi đang bay và kiểm tra va chạm.
   */
  _updateFlyingPhase() {
    const elapsed = (Date.now() - this.startTime) / 1000;
    // Công thức tăng hệ số nhân (có thể điều chỉnh để game khó/dễ hơn)
    this.multiplier = 1 + (Math.pow(elapsed, 1.3) * 0.1);

    if (this.multiplier >= this.crashPoint) {
      this._crash();
    } else {
      this._broadcastState();
    }
  }

  /**
   * Xử lý khi máy bay nổ.
   */
  _crash() {
    clearInterval(this._gameLoopInterval);
    this.phase = GAME_PHASES.CRASHED;
    this.multiplier = this.crashPoint; // Chốt hệ số tại điểm nổ

    console.log(`✈️  Crashed at ${this.multiplier.toFixed(2)}x`);
    this._processWinnings();
    this._broadcastState();

    // Chờ một lúc rồi bắt đầu ván mới
    setTimeout(() => {
      this._startWaitingPhase();
    }, CRASH_DELAY);
  }

  /**
   * Xử lý trả thưởng cho những người chơi đã chốt lời thành công.
   */
  async _processWinnings() {
    for (const [userId, bet] of this.activeBets.entries()) {
      if (bet.cashOutAt && bet.cashOutAt < this.crashPoint) {
        const winAmount = Math.floor(bet.betAmount * bet.cashOutAt);
        try {
          await Account.findOneAndUpdate({ userId }, { $inc: { balance: winAmount } });
          console.log(`[Aviator] User ${userId} won ${winAmount}`);
        } catch (error) {
          console.error(`[Aviator] Error paying out to user ${userId}:`, error);
        }
      }
    }
  }

  /**
   * Tạo điểm nổ ngẫu nhiên, công bằng (provably fair).
   */
  _generateCrashPoint() {
    const e = 2 ** 32;
    const h = crypto.randomInt(e);
    // Công thức này tạo ra nhiều kết quả < 2.0 và một số ít kết quả rất cao
    const crash = Math.floor((100 * e - h) / (e - h)) / 100;
    return Math.max(1.01, crash);
  }

  /**
   * Gửi trạng thái game tới tất cả client trong phòng 'aviator_room'.
   */
  _broadcastState() {
    const state = {
      phase: this.phase,
      multiplier: parseFloat(this.multiplier.toFixed(2)),
      timeLeft: Math.ceil(this.waitTimeLeft / 1000),
      elapsed: this.phase === GAME_PHASES.FLYING ? Date.now() - this.startTime : 0,
    };
    this.io.to('aviator_room').emit('aviator_update', state);
  }

  // --- Public Methods (được gọi từ API routes) ---

  /**
   * Xử lý khi người dùng đặt cược.
   */
  async handleBet(userId, amount) {
    const isForNextRound = this.phase === GAME_PHASES.FLYING || this.phase === GAME_PHASES.CRASHED;
    const betMap = isForNextRound ? this.nextRoundBets : this.activeBets;

    if (!isForNextRound && this.phase !== GAME_PHASES.WAITING) {
      return { success: false, message: "Đã hết thời gian cược." };
    }
    if (this.activeBets.has(userId) || this.nextRoundBets.has(userId)) {
      return { success: false, message: "Bạn đã cược rồi." };
    }

    try {
      const updatedAccount = await Account.findOneAndUpdate(
        { userId, balance: { $gte: amount } },
        { $inc: { balance: -amount } },
        { new: true }
      );

      if (!updatedAccount) {
        return { success: false, message: "Số dư không đủ hoặc có lỗi xảy ra." };
      }

      betMap.set(userId, { betAmount: amount, cashOutAt: null });
      console.log(`[Aviator] User ${userId} placed a bet of ${amount} for ${isForNextRound ? 'next' : 'current'} round.`);
      return { success: true, newBalance: updatedAccount.balance };

    } catch (error) {
      console.error("[Aviator] Bet handling error:", error);
      return { success: false, message: "Lỗi hệ thống khi đặt cược." };
    }
  }

  /**
   * Xử lý khi người dùng chốt lời.
   */
  async handleCashOut(userId) {
    if (this.phase !== GAME_PHASES.FLYING || !this.activeBets.has(userId)) {
      return { success: false, message: "Không thể chốt lời lúc này." };
    }

    const bet = this.activeBets.get(userId);
    if (bet.cashOutAt) {
      return { success: false, message: "Bạn đã chốt lời rồi." };
    }

    // Lấy hệ số nhân tại thời điểm chốt lời từ server để đảm bảo an toàn
    const cashOutMultiplier = this.multiplier;
    bet.cashOutAt = cashOutMultiplier;
    this.activeBets.set(userId, bet);

    const winAmount = Math.floor(bet.betAmount * cashOutMultiplier);

    try {
        const updatedAccount = await Account.findOneAndUpdate(
            { userId }, { $inc: { balance: winAmount } }, { new: true }
        );
        if (!updatedAccount) throw new Error("Account not found for payout.");
        
        console.log(`[Aviator] User ${userId} cashed out at ${cashOutMultiplier.toFixed(2)}x and won ${winAmount}`);
        return { success: true, newBalance: updatedAccount.balance };
    } catch (error) {
        console.error("[Aviator] Cashout error:", error);
        bet.cashOutAt = null; // Hoàn tác trạng thái chốt lời nếu có lỗi DB
        this.activeBets.set(userId, bet);
        return { success: false, message: "Lỗi hệ thống khi trả thưởng." };
    }
  }

  /**
   * Xử lý khi người dùng hủy cược.
   */
  async handleCancelBet(userId) {
    // Nếu đang bay hoặc đã nổ, thì thao tác hủy cược áp dụng cho ván sau (nextRoundBets)
    // Nếu đang chờ (WAITING), thao tác hủy cược áp dụng cho ván hiện tại (activeBets)
    const isForNextRound = this.phase === GAME_PHASES.FLYING || this.phase === GAME_PHASES.CRASHED;
    const betMap = isForNextRound ? this.nextRoundBets : this.activeBets;

    if (!betMap.has(userId)) {
      return { success: false, message: "Bạn chưa đặt cược." };
    }

    const bet = betMap.get(userId);

    try {
      const updatedAccount = await Account.findOneAndUpdate(
        { userId },
        { $inc: { balance: bet.betAmount } },
        { new: true }
      );

      if (!updatedAccount) return { success: false, message: "Lỗi hoàn tiền." };

      betMap.delete(userId);
      console.log(`[Aviator] User ${userId} canceled bet of ${bet.betAmount}`);
      return { success: true, newBalance: updatedAccount.balance };
    } catch (error) {
      console.error("[Aviator] Cancel bet error:", error);
      return { success: false, message: "Lỗi hệ thống khi hủy cược." };
    }
  }
}

module.exports = AviatorEngine;