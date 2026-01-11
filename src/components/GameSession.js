const mongoose = require('mongoose');
const TxGameHistory = require('../models/TxGameHistory');
const TxRoomSetting = require('../models/TxRoomSetting');

class GameSession {
    constructor(io, gameType) {
        this.io = io;
        this.gameType = gameType;
        this.timeLeft = 0;
        this.phase = 'BETTING'; // BETTING, RESULT, PREPARE
        this.sessionId = 0;
        this.dice = [1, 1, 1];
        this.bets = { tai: 0, xiu: 0, bao: 0 };
        this.detailedBets = [];
        this.interval = null;
    }

    async init() {
        try {
            // Lấy phiên gần nhất từ DB để tiếp tục
            const lastGame = await TxGameHistory.findOne({ roomType: this.gameType }).sort({ sessionId: -1 });
            this.sessionId = lastGame ? lastGame.sessionId + 1 : 1;
            
            console.log(`[${this.gameType}] 🟢 Khởi động phiên #${this.sessionId}`);
            this.startBetting();
            
            // Bắt đầu vòng lặp game (1 giây 1 lần)
            this.interval = setInterval(() => {
                this.tick();
            }, 1000);
        } catch (e) {
            console.error(`[${this.gameType}] 🔴 Lỗi khởi tạo:`, e);
            setTimeout(() => this.init(), 5000);
        }
    }

    tick() {
        this.timeLeft--;
        
        if (this.timeLeft <= 0) {
            if (this.phase === 'BETTING') {
                this.startResult();
            } else if (this.phase === 'RESULT') {
                this.startPrepare();
            } else if (this.phase === 'PREPARE') {
                this.startBetting();
            }
        }

        this.broadcast();
    }

    startBetting() {
        this.phase = 'BETTING';
        this.timeLeft = 60; // 60 giây đặt cược
        this.sessionId++;
        this.bets = { tai: 0, xiu: 0, bao: 0 };
        this.detailedBets = [];
        // Reset dice visual if needed
    }

    async startResult() {
        this.phase = 'RESULT';
        this.timeLeft = 15; // 15 giây trả kết quả
        
        try {
            // Kiểm tra xem có kết quả đặt trước từ Admin không
            const setting = await TxRoomSetting.findOne({ roomType: this.gameType });
            
            if (setting && setting.forceResult && setting.forceResult.dice1) {
                this.dice = [
                    setting.forceResult.dice1, 
                    setting.forceResult.dice2, 
                    setting.forceResult.dice3
                ];
                console.log(`[${this.gameType}] 🎲 Kết quả được đặt trước: ${this.dice.join('-')}`);
                // Xóa kết quả đặt trước sau khi dùng
                await TxRoomSetting.updateOne({ roomType: this.gameType }, { $unset: { forceResult: 1 } });
            } else {
                // Random kết quả ngẫu nhiên
                this.dice = [
                    Math.floor(Math.random() * 6) + 1,
                    Math.floor(Math.random() * 6) + 1,
                    Math.floor(Math.random() * 6) + 1
                ];
            }

            // Lưu lịch sử phiên vào MongoDB
            await TxGameHistory.create({
                sessionId: this.sessionId,
                roomType: this.gameType,
                dice1: this.dice[0],
                dice2: this.dice[1],
                dice3: this.dice[2],
                totalBet: 0, 
                totalTax: 0,
                balance: 0,
                date: new Date()
            });
            
        } catch (e) {
            console.error(`[${this.gameType}] 🔴 Lỗi xử lý kết quả:`, e);
        }
    }

    startPrepare() {
        this.phase = 'PREPARE';
        this.timeLeft = 5; // 5 giây chuẩn bị phiên mới
    }

    broadcast() {
        this.io.emit('stats-update', {
            game: this.gameType,
            stats: {
                timeLeft: this.timeLeft,
                phase: this.phase,
                sessionId: this.sessionId,
                bets: this.bets,
                detailedBets: this.detailedBets,
                dice: this.dice,
                isAiMode: true, // Mặc định ON để UI hiển thị đẹp
                isAutoKillMode: false,
                playerControl: {},
                blacklist: []
            }
        });
    }
}

module.exports = GameSession;