/**
 * bot-worker.js
 * Worker process xử lý logic bot cho từng phòng game riêng biệt.
 */
const mongoose = require('mongoose');
const TelegramBot = require('node-telegram-bot-api');
const util = require('util');

// --- Ghi đè console.log/error để gửi log về process cha ---
const originalLog = console.log;
const originalError = console.error;

console.log = (...args) => {
    originalLog(...args);
    if (process.send) process.send({ type: 'LOG', level: 'info', message: util.format(...args) });
};

console.error = (...args) => {
    originalError(...args);
    if (process.send) process.send({ type: 'LOG', level: 'error', message: util.format(...args) });
};

// Import Models
const Account = require('../models/Account.js');
const TxRoomSetting = require('../models/TxRoomSetting.js');
const Md5Setting = require('../models/Md5Setting.js');
const KhongMinhSetting = require('../models/KhongMinhSetting.js');
const PlinkoSetting = require('../models/PlinkoSetting.js');
const BoomsSetting = require('../models/BoomsSetting.js');
const XengSetting = require('../models/XengSetting.js');
const TxGameHistory = require('../models/TxGameHistory.js');
const Md5History = require('../models/Md5History.js');
const KhongMinhHistory = require('../models/KhongMinhHistory.js');
const PlinkoHistory = require('../models/PlinkoHistory.js');
const BoomsHistory = require('../models/BoomsHistory.js');
const XengHistory = require('../models/XengHistory.js');
const CommissionSetting = require('../models/CommissionSetting.js');

// Kết nối MongoDB (Worker cần kết nối riêng)
const MONGO_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/tx-lasvegas';
mongoose.connect(MONGO_URI).then(() => {
    console.log('[Worker] MongoDB Connected');
}).catch(err => console.error('[Worker] MongoDB Connection Error:', err));

// --- Biến toàn cục của Worker ---
let bot = null;
let gameInterval = null;

// Đối tượng chứa thông tin phòng hiện tại của worker này
let currentRoom = {
    config: null,
    state: null,
    model: null
};

// Cấu hình VIP
const VIP_POINT_RATE = 0.001; // 1 điểm cho mỗi 1000đ cược
const RANKS = [
    { level: 1, name: 'Binh Nhì', icon: '🔰', pointsNeeded: 0 },
    { level: 2, name: 'Binh Nhất', icon: '🎖️', pointsNeeded: 100 },
    { level: 3, name: 'Hạ Sĩ', icon: '🥉', pointsNeeded: 500 },
    { level: 4, name: 'Trung Sĩ', icon: '🥈', pointsNeeded: 2000 },
    { level: 5, name: 'Thượng Sĩ', icon: '🥇', pointsNeeded: 5000 },
    { level: 6, name: 'Thiếu Úy', icon: '⭐', pointsNeeded: 15000 },
    { level: 7, name: 'Trung Úy', icon: '⭐⭐', pointsNeeded: 50000 },
    { level: 8, name: 'Đại Úy', icon: '⭐⭐⭐', pointsNeeded: 150000 },
    { level: 9, name: 'Thiếu Tá', icon: '💎', pointsNeeded: 500000 },
    { level: 10, name: 'Đại Tá', icon: '👑', pointsNeeded: 2000000 },
];

// Hàm kiểm tra và nâng cấp VIP
async function checkAndUpgradeVip(userId) {
    try {
        const user = await Account.findOne({ userId });
        if (!user) return;

        const currentLevel = user.vip || 1;
        let newLevel = currentLevel;
        for (const rank of RANKS) { if (user.vipPoints >= rank.pointsNeeded) { newLevel = rank.level; } }

        if (newLevel > currentLevel) {
            user.vip = newLevel;
            await user.save();
            const newRank = RANKS.find(r => r.level === newLevel);
            const promotionMessage = `🎉 <b>CHÚC MỪNG THĂNG CẤP</b> 🎉\n\nBạn đã được thăng lên cấp <b>VIP ${newRank.level} - ${newRank.name} ${newRank.icon}</b>.`;
            if (bot) await bot.sendMessage(userId, promotionMessage, { parse_mode: 'HTML' }).catch(() => {});
        }
    } catch (error) { console.error(`[VIP Upgrade Error] Lỗi khi nâng cấp VIP cho user ${userId}: ${error.message}`); }
}

// Hàm lấy tỷ lệ hoa hồng từ DB
async function getCommissionRate(level) {
    try {
        let setting = await CommissionSetting.findOne({ key: 'default' });
        if (!setting) {
            setting = await CommissionSetting.create({ key: 'default' });
        }
        return setting.rates[level] || 0.005;
    } catch (e) {
        return 0.005; // Mặc định 0.5% nếu lỗi
    }
}

// --- Helper Functions ---
const getGameModel = (type) => {
    switch (type) {
        case 'tx': return TxRoomSetting;
        case 'md5': return Md5Setting;
        case 'khongminh': return KhongMinhSetting;
        case 'plinko': return PlinkoSetting;
        case 'booms': return BoomsSetting;
        case 'xeng': return XengSetting;
        default: return TxRoomSetting;
    }
};

const getHistoryModel = (type) => {
    switch (type) {
        case 'tx': return TxGameHistory;
        case 'md5': return Md5History;
        case 'khongminh': return KhongMinhHistory;
        case 'plinko': return PlinkoHistory;
        case 'booms': return BoomsHistory;
        case 'xeng': return XengHistory;
        default: return TxGameHistory;
    }
};

function escapeHtml(text) {
    if (!text) return '';
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

async function saveGameState() {
    if (!currentRoom.state || !currentRoom.config) return;
    const { roomType } = currentRoom.config;
    const state = currentRoom.state;
    const Model = currentRoom.model;

    try {
        await Model.findOneAndUpdate(
            { roomType },
            {
                sessionCounter: state.sessionCounter,
                gameHistory: state.history,
                gameState: {
                    phase: state.phase,
                    sessionId: state.sessionId,
                    timer: state.timer,
                    banker: state.banker,
                    bankerAmount: state.bankerAmount,
                    bets: state.bets,
                    statusMessageId: state.statusMessageId,
                }
            },
            { upsert: true }
        );
    } catch (error) {
        console.error(`[Worker State Error] ${error.message}`);
    }
}

// --- Xử lý tin nhắn từ Process Manager ---
process.on('message', async (msg) => {
    if (msg.type === 'START') {
        await startBot(msg.config);
    } else if (msg.type === 'STOP') {
        await stopBot();
        process.exit(0); // Tự hủy tiến trình
    }
});

async function stopBot() {
    if (gameInterval) clearInterval(gameInterval);
    if (bot) {
        try {
            await bot.stopPolling();
            bot.removeAllListeners();
        } catch (e) { console.error(e); }
    }
    bot = null;
    console.log(`[Worker] Bot stopped.`);
}

async function startBot(config) {
    await stopBot(); // Đảm bảo sạch sẽ trước khi start

    currentRoom.config = config;
    const { roomType, botToken } = config;

    if (!botToken) {
        console.error(`[Worker Error] Bot Token is missing for room: ${roomType}`);
        if (process.send) process.send({ type: 'ERROR', error: 'Telegram Bot Token not provided!' });
        return;
    }

    currentRoom.model = getGameModel(roomType);

    console.log(`[Worker] Starting bot for room: ${roomType}`);

    try {
        bot = new TelegramBot(botToken, { polling: { interval: 300, params: { timeout: 10 } } });
        
        // Xóa webhook để tránh xung đột với polling
        await bot.getMe();
        await bot.deleteWebHook();

        // Khôi phục hoặc khởi tạo trạng thái
        const resuming = config.gameState && config.gameState.phase !== 'waiting' && config.gameState.phase !== 'result';
        const initialBets = resuming ? config.gameState.bets : { Tai: { total: 0, users: {} }, Xiu: { total: 0, users: {} } };
        
        // Đảm bảo cấu trúc bets
        if (!initialBets.Tai) initialBets.Tai = { total: 0, users: {} };
        if (!initialBets.Xiu) initialBets.Xiu = { total: 0, users: {} };
        if (!initialBets.Tai.users) initialBets.Tai.users = {};
        if (!initialBets.Xiu.users) initialBets.Xiu.users = {};

        currentRoom.state = {
            phase: resuming ? config.gameState.phase : 'waiting',
            sessionId: resuming ? config.gameState.sessionId : null,
            timer: resuming ? config.gameState.timer : 0,
            banker: resuming ? config.gameState.banker : null,
            bankerAmount: resuming ? config.gameState.bankerAmount : 0,
            bets: initialBets,
            statusMessageId: resuming ? config.gameState.statusMessageId : null,
            jackpot: config.jackpot || 0,
            sessionCounter: config.sessionCounter || 202500000000,
            history: config.gameHistory || [],
            fakeBots: [],
        };

        // Tạo bot ảo
        if (config.fakeBetEnabled) {
            for (let i = 0; i < 100; i++) {
                const fakeId = Math.floor(8000000000 + Math.random() * 1000000000);
                currentRoom.state.fakeBots.push({ id: fakeId, username: `User${fakeId.toString().slice(-4)}` });
            }
        }

        setupBotListeners();
        startGameLoop();

        process.send({ type: 'STARTED' });

    } catch (error) {
        console.error(`[Worker Error] ${error.message}`);
        process.send({ type: 'ERROR', error: error.message });
    }
}

function setupBotListeners() {
    if (!bot) return;

    bot.on('polling_error', (error) => {
        console.error(`[Worker Polling Error] ${error.code}: ${error.message}`);
    });

    // --- Xử lý lệnh /ducai ---
    bot.onText(/\/ducai(?: (\d+|allin))?/, async (msg, match) => {
        const userId = msg.from.id;
        const username = msg.from.first_name;
        const chatId = msg.chat.id;
        const state = currentRoom.state;

        try {
            if (state.phase !== 'banker-selection') return;
            if (state.banker) {
                const bankerName = typeof state.banker === 'object' ? state.banker.username : state.banker;
                await bot.sendMessage(chatId, `🔥 ${bankerName} đã nhận làm CÁI rồi!`);
                return;
            }

            const MIN_BANKER_AMOUNT = 3000000;
            let amount = 0;
            const commandArg = match[1];

            const account = await Account.findOne({ userId });
            if (!account) {
                await bot.sendMessage(chatId, `Bạn chưa đăng ký tài khoản. Gõ /start với bot chính.`);
                return;
            }

            if (commandArg === 'allin') {
                if (account.balance < MIN_BANKER_AMOUNT) {
                    await bot.sendMessage(chatId, `Số dư không đủ để làm CÁI (min ${MIN_BANKER_AMOUNT.toLocaleString()}đ).`);
                    return;
                }
                amount = account.balance;
            } else if (commandArg) {
                const customAmount = parseInt(commandArg, 10);
                if (isNaN(customAmount) || customAmount < MIN_BANKER_AMOUNT) {
                    await bot.sendMessage(chatId, `Số tiền làm CÁI phải >= ${MIN_BANKER_AMOUNT.toLocaleString()}đ.`);
                    return;
                }
                amount = customAmount;
            } else {
                amount = MIN_BANKER_AMOUNT;
            }

            if (account.balance < amount) {
                await bot.sendMessage(chatId, `Số dư không đủ.`);
                return;
            }

            account.balance -= amount;
            await account.save();

            state.banker = { username, userId };
            state.bankerAmount = amount;

            await bot.sendMessage(chatId, `🔥 <b>${escapeHtml(username)}</b> đã nhận làm CÁI với <b>${amount.toLocaleString()}đ</b>.`, { parse_mode: 'HTML' });
            state.timer = 1; // Chuyển giai đoạn ngay
        } catch (error) {
            console.error(`[Ducai Error] ${error.message}`);
        }
    });

    // --- Xử lý đặt cược ---
    const handleBet = async (userId, username, chatId, choice, amount, isCallback = false, callbackId = null) => {
        const state = currentRoom.state;
        const config = currentRoom.config;

        if (state.phase !== 'betting') {
            if (isCallback) await bot.answerCallbackQuery(callbackId, { text: 'Hết giờ cược.', show_alert: true });
            return;
        }

        const { minBet, maxBet } = config;

        try {
            if (state.banker && typeof state.banker === 'object' && state.banker.userId === userId) {
                const msg = `Bạn đang làm CÁI không được cược.`;
                isCallback ? await bot.answerCallbackQuery(callbackId, { text: msg, show_alert: true }) : await bot.sendMessage(chatId, msg);
                return;
            }

            const oppositeChoice = choice === 'Tai' ? 'Xiu' : 'Tai';
            if (state.bets[oppositeChoice].users[userId]) {
                const msg = `Bạn đã cược bên kia rồi.`;
                isCallback ? await bot.answerCallbackQuery(callbackId, { text: msg, show_alert: true }) : await bot.sendMessage(chatId, msg);
                return;
            }

            const account = await Account.findOne({ userId });
            if (!account) {
                const msg = `Chưa có tài khoản.`;
                isCallback ? await bot.answerCallbackQuery(callbackId, { text: msg, show_alert: true }) : await bot.sendMessage(chatId, msg);
                return;
            }

            if (isNaN(amount) || amount < minBet || amount > maxBet) {
                const msg = `Cược từ ${minBet.toLocaleString()} - ${maxBet.toLocaleString()}.`;
                isCallback ? await bot.answerCallbackQuery(callbackId, { text: msg, show_alert: true }) : await bot.sendMessage(chatId, msg);
                return;
            }

            if (account.balance < amount) {
                const msg = `Số dư không đủ.`;
                isCallback ? await bot.answerCallbackQuery(callbackId, { text: msg, show_alert: true }) : await bot.sendMessage(chatId, msg);
                return;
            }

            const currentTotalBet = state.bets.Tai.total + state.bets.Xiu.total;
            if (currentTotalBet + amount > state.bankerAmount) {
                const msg = `Tổng cược đã đầy so với tiền cái.`;
                isCallback ? await bot.answerCallbackQuery(callbackId, { text: msg, show_alert: true }) : await bot.sendMessage(chatId, msg);
                return;
            }

            account.balance -= amount;
            account.totalBet = (account.totalBet || 0) + amount; // Cộng dồn tổng cược
            await account.save();

            const userBets = state.bets[choice].users;
            if (userBets[userId]) userBets[userId].amount += amount;
            else userBets[userId] = { username, amount };
            
            state.bets[choice].total += amount;

            if (isCallback) await bot.answerCallbackQuery(callbackId, { text: `✅ Đặt cược thành công!` });
            
            console.log(`[Worker] User ${userId} bet ${choice} ${amount}`);

        } catch (error) {
            console.error(`[Bet Error] ${error.message}`);
        }
    };

    bot.onText(/^(?<choice>T|X)\s+(?<amount>\d+)$/i, async (msg, match) => {
        const choice = match.groups.choice.toLowerCase() === 't' ? 'Tai' : 'Xiu';
        const amount = parseInt(match.groups.amount, 10);
        await handleBet(msg.from.id, msg.from.first_name, msg.chat.id, choice, amount);
    });

    bot.on('callback_query', async (query) => {
        const [action, side, type] = query.data.split('_');
        if (action !== 'bet') return;
        
        try {
            const account = await Account.findOne({ userId: query.from.id });
            if (!account) return bot.answerCallbackQuery(query.id, { text: 'Chưa có tài khoản', show_alert: true });
            
            let amount = (type === 'allin') ? account.balance : parseInt(type, 10);
            if (amount <= 0) return bot.answerCallbackQuery(query.id, { text: 'Số dư không đủ', show_alert: true });
            
            const choice = side === 't' ? 'Tai' : 'Xiu';
            await handleBet(query.from.id, query.from.first_name, query.message.chat.id, choice, amount, true, query.id);
        } catch (e) { console.error(e); }
    });
}

function startGameLoop() {
    const config = currentRoom.config;
    const BANKER_SELECTION_TIME = config.bankerSelectionTime || 30;
    const BETTING_TIME = config.bettingTime || 60;
    const RESULT_TIME = 10;

    gameInterval = setInterval(async () => {
        const state = currentRoom.state;
        if (!state) return;
        state.timer--;

        try {
            switch (state.phase) {
                case 'waiting':
                    state.phase = 'banker-selection';
                    state.timer = BANKER_SELECTION_TIME;
                    state.sessionCounter++;
                    state.sessionId = state.sessionCounter;
                    state.bets = { Tai: { total: 0, users: {} }, Xiu: { total: 0, users: {} } };
                    state.banker = null;
                    state.jackpot = config.jackpot || 0;
                    
                    const me = await bot.getMe();
                    const msg = `🔴 <b>PHIÊN MỚI: ${state.sessionId}</b>\n💰 Hũ: ${state.jackpot.toLocaleString()}đ\n👉 Chat riêng: @${me.username}`;
                    await bot.sendMessage(config.groupId, msg, { parse_mode: 'HTML' });
                    await saveGameState();
                    break;

                case 'banker-selection':
                    if (state.timer > 0 && state.timer % 10 === 0) {
                        await bot.sendMessage(config.groupId, `🔥 ĐANG TÌM CÁI (${state.timer}s)\n💰 Hũ: ${state.jackpot.toLocaleString()}đ\nGõ /ducai để làm cái.`, { parse_mode: 'HTML' });
                    }
                    if (state.timer <= 0) {
                        state.phase = 'betting';
                        state.timer = BETTING_TIME;
                        if (!state.banker) {
                            state.banker = 'Admin';
                            state.bankerAmount = config.botBanker ? (config.botBankerAmount || 5000000) : 0;
                            await bot.sendMessage(config.groupId, 'Admin sẽ làm cái.');
                        }
                        await bot.sendMessage(config.groupId, '🎮 <b>BẮT ĐẦU ĐẶT CƯỢC!</b>', { parse_mode: 'HTML' });
                        
                        const kb = getBettingKeyboard();
                        const sent = await bot.sendMessage(config.groupId, getBetStatusMessage(), { parse_mode: 'HTML', reply_markup: kb });
                        state.statusMessageId = sent.message_id;
                        await saveGameState();
                    }
                    break;

                case 'betting':
                    if (state.timer > 0 && state.timer % 10 === 0 && state.statusMessageId) {
                        bot.editMessageText(getBetStatusMessage(), {
                            chat_id: config.groupId,
                            message_id: state.statusMessageId,
                            parse_mode: 'HTML',
                            reply_markup: getBettingKeyboard()
                        }).catch(() => {});
                    }
                    
                    // Fake bet logic
                    if (config.fakeBetEnabled && config.fakeBetInterval > 0 && state.timer > 1) {
                        if (Math.random() < (1 / config.fakeBetInterval)) {
                            const min = Math.min(config.fakeBetMinAmount, config.fakeBetMaxAmount);
                            const max = Math.max(config.fakeBetMinAmount, config.fakeBetMaxAmount);
                            const fakeAmount = Math.round((Math.floor(Math.random() * (max - min + 1)) + min) / 1000) * 1000;
                            const choice = Math.random() < 0.5 ? 'Tai' : 'Xiu';
                            const fakeBot = state.fakeBots[Math.floor(Math.random() * state.fakeBots.length)];
                            
                            if (!state.bets[choice].users[fakeBot.id]) {
                                state.bets[choice].users[fakeBot.id] = { username: fakeBot.username, amount: 0, isFake: true };
                            }
                            state.bets[choice].users[fakeBot.id].amount += fakeAmount;
                            state.bets[choice].total += fakeAmount;
                        }
                    }

                    if (state.timer <= 0) {
                        state.phase = 'result';
                        state.timer = RESULT_TIME;
                        if (state.statusMessageId) {
                            bot.editMessageReplyMarkup({ inline_keyboard: [] }, { chat_id: config.groupId, message_id: state.statusMessageId }).catch(() => {});
                            state.statusMessageId = null;
                        }
                        await bot.sendMessage(config.groupId, '⛔️ <b>ĐÃ KHÓA CƯỢC!</b> Đang lắc...', { parse_mode: 'HTML' });
                        
                        await new Promise(r => setTimeout(r, 1000));
                        const d1 = await bot.sendDice(config.groupId);
                        const d2 = await bot.sendDice(config.groupId);
                        const d3 = await bot.sendDice(config.groupId);
                        const dice = [d1.dice.value, d2.dice.value, d3.dice.value];
                        const total = dice.reduce((a, b) => a + b, 0);
                        const result = (total >= 4 && total <= 10) ? 'Xiu' : 'Tai';
                        
                        // --- Xử lý trả thưởng, tính hoa hồng và điểm VIP ---
                        const allBets = { ...state.bets.Tai.users, ...state.bets.Xiu.users };
                        const payoutPromises = Object.keys(allBets).map(async (userId) => {
                            const betInfo = allBets[userId];
                            const numericUserId = parseInt(userId);
                            let winAmount = 0;

                            // Trả thưởng cho người thắng
                            if (betInfo.choice === result && !betInfo.isFake) {
                                const grossWin = betInfo.amount * 2;
                                // ... (logic tính phí, trừ phế...)
                                const netWin = grossWin; // Giả sử thắng x2
                                winAmount = netWin;
                                await Account.findOneAndUpdate({ userId: numericUserId }, { $inc: { balance: netWin } });
                            }

                            // Bỏ qua bot ảo cho các logic sau
                            if (betInfo.isFake) return;

                            // Lưu lịch sử cược để thống kê lợi nhuận
                            try {
                                await MiniGameHistory.create({
                                    game: config.roomType, // 'tx', 'md5', 'khongminh'...
                                    userId: numericUserId,
                                    username: betInfo.username,
                                    betType: betInfo.choice, // 'Tai' hoặc 'Xiu'
                                    betAmount: betInfo.amount,
                                    winAmount: winAmount,
                                    date: new Date()
                                });
                            } catch (err) {
                                console.error(`[History Error] User ${userId}: ${err.message}`);
                            }

                            // Cộng điểm VIP cho tất cả người chơi thật
                            const vipPointsToAdd = Math.floor(betInfo.amount * VIP_POINT_RATE);
                            if (vipPointsToAdd > 0) {
                                await Account.findOneAndUpdate({ userId: numericUserId }, { $inc: { vipPoints: vipPointsToAdd } });
                                await checkAndUpgradeVip(numericUserId);
                            }

                            // Tính hoa hồng cho người giới thiệu
                            // ... (logic hoa hồng của bạn ở đây)
                        });

                        await Promise.all(payoutPromises);

                        // ... (Logic trả thưởng giữ nguyên như cũ, rút gọn để hiển thị) ...
                        // Bạn có thể copy logic trả thưởng chi tiết từ file cũ vào đây

                        await new Promise(r => setTimeout(r, 2000));
                        const rsStr = result === 'Tai' ? '🔴 TÀI' : '⚪️ XỈU';
                        await bot.sendMessage(config.groupId, `🎲 <b>KẾT QUẢ: ${total} - ${rsStr}</b>`, { parse_mode: 'HTML' });
                        
                        state.history.unshift({ result, total });
                        if (state.history.length > 12) state.history.pop();
                        
                        await currentRoom.model.findOneAndUpdate({ roomType: config.roomType }, { gameState: null, gameHistory: state.history });
                    }
                    break;

                case 'result':
                    if (state.timer <= 0) {
                        state.phase = 'waiting';
                        state.timer = 1;
                    }
                    break;
            }
        } catch (e) { console.error(`[Loop Error] ${e.message}`); }
    }, 1000);
}

function getBetStatusMessage() {
    const state = currentRoom.state;
    const h = state.history.map(r => r.result === 'Tai' ? '⚫️' : '⚪️').join('');
    return `⏳ <b>${state.timer}s</b> | Phiên: ${state.sessionId}\n` +
           `⚫️ Tài: ${state.bets.Tai.total.toLocaleString()}đ\n` +
           `⚪️ Xỉu: ${state.bets.Xiu.total.toLocaleString()}đ\n` +
           `Lịch sử: ${h}`;
}

function getBettingKeyboard() {
    return {
        inline_keyboard: [
            [{ text: 'T 10K', callback_data: 'bet_t_10000' }, { text: 'X 10K', callback_data: 'bet_x_10000' }],
            [{ text: 'T 50K', callback_data: 'bet_t_50000' }, { text: 'X 50K', callback_data: 'bet_x_50000' }],
            [{ text: 'Tất Tay TÀI', callback_data: 'bet_t_allin' }, { text: 'Tất Tay XỈU', callback_data: 'bet_x_allin' }]
        ]
    };
}