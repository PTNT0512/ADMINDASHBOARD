/**
 * bot-worker.js
 * Worker process xử lý logic bot cho từng phòng game riêng biệt.
 */
const mongoose = require('mongoose');
process.env.NTBA_FIX_350 = process.env.NTBA_FIX_350 || '1';
const TelegramBot = require('node-telegram-bot-api');
const { patchTelegramBotEncoding } = require('../utils/telegram-bot-normalizer.js');
patchTelegramBotEncoding(TelegramBot);
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
const {
    createHandleBet,
    registerBetMessageListener,
} = require('./bot-worker-bet-handler.js');

// Kết nối MongoDB (Worker cần kết nối riêng)
const MONGO_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/tx-lasvegas';
mongoose.connect(MONGO_URI).then(() => {
    console.log('[Worker] MongoDB Connected');
}).catch(err => console.error('[Worker] MongoDB Connection Error:', err));

// --- Biến toàn cục của Worker ---
let bot = null;
let gameInterval = null;
const WORKER_POLLING_RECOVERABLE_MARKERS = [
    'EFATAL',
    'ECONNRESET',
    'ETIMEDOUT',
    'ESOCKETTIMEDOUT',
    'ECONNREFUSED',
    'EAI_AGAIN',
    'ENOTFOUND',
    'TIMED OUT',
    'SOCKET HANG UP',
];
const workerPollingRecovery = {
    attempt: 0,
    timer: null,
    inProgress: false,
    lastErrorKey: '',
    lastErrorLogAt: 0,
};
const WORKER_POLLING_OPTIONS = {
    interval: 500,
    params: { timeout: 25 },
};
const WORKER_STARTUP_MAX_ATTEMPTS = 5;
const WORKER_STARTUP_RETRY_BASE_DELAY_MS = 2000;
const WORKER_POLLING_LOG_COOLDOWN_MS = 30000;
const WORKER_LOOP_LOG_COOLDOWN_MS = 12000;
const WORKER_CHAT_PERMISSION_LOG_COOLDOWN_MS = 30000;
const workerLoopLogState = { key: '', at: 0 };
const workerChatPermissionLogState = { key: '', at: 0 };
let isStoppingBot = false;

function clearWorkerPollingRecoveryTimer() {
    if (!workerPollingRecovery.timer) return;
    clearTimeout(workerPollingRecovery.timer);
    workerPollingRecovery.timer = null;
}

function resetWorkerPollingRecovery() {
    clearWorkerPollingRecoveryTimer();
    workerPollingRecovery.attempt = 0;
    workerPollingRecovery.inProgress = false;
    workerPollingRecovery.lastErrorKey = '';
    workerPollingRecovery.lastErrorLogAt = 0;
}

function isWorkerConflictError(error) {
    const payload = `${error?.code || ''} ${error?.message || ''}`.toUpperCase();
    return payload.includes('409 CONFLICT');
}

function getWorkerPollingErrorKey(error) {
    const payload = `${error?.code || ''} ${error?.message || ''}`.toUpperCase();
    if (payload.includes('409 CONFLICT')) return '409_CONFLICT';
    if (payload.includes('ECONNRESET') || payload.includes('SOCKET HANG UP')) return 'ECONNRESET';
    if (payload.includes('ETIMEDOUT') || payload.includes('TIMED OUT') || payload.includes('ESOCKETTIMEDOUT')) return 'ETIMEDOUT';
    if (payload.includes('ECONNREFUSED')) return 'ECONNREFUSED';
    if (payload.includes('EAI_AGAIN') || payload.includes('ENOTFOUND')) return 'DNS';
    if (payload.includes('EFATAL')) return 'EFATAL';
    return `${error?.code || 'UNKNOWN'}`;
}

function formatWorkerPollingError(error) {
    const code = error?.code || 'UNKNOWN';
    const rawMessage = String(error?.message || error || '').trim();
    const normalizedMessage = rawMessage
        .replace(/^(EFATAL:\s*)+/i, '')
        .replace(/^(Error:\s*)+/i, '')
        .replace(/^(EFATAL:\s*)+/i, '')
        .trim();
    return `${code}: ${normalizedMessage || 'unknown polling error'}`;
}

function isRecoverableWorkerPollingError(error) {
    if (!error) return false;
    if (isWorkerConflictError(error)) return false;
    const payload = `${error?.code || ''} ${error?.message || ''}`.toUpperCase();
    return WORKER_POLLING_RECOVERABLE_MARKERS.some((marker) => payload.includes(marker));
}

function shouldLogWorkerPollingError(error) {
    const key = getWorkerPollingErrorKey(error);
    const now = Date.now();
    const isSame = workerPollingRecovery.lastErrorKey === key;
    if (isSame && now - workerPollingRecovery.lastErrorLogAt < WORKER_POLLING_LOG_COOLDOWN_MS) return false;
    workerPollingRecovery.lastErrorKey = key;
    workerPollingRecovery.lastErrorLogAt = now;
    return true;
}

function shouldLogWorkerLoopError(error) {
    const key = getWorkerPollingErrorKey(error);
    const now = Date.now();
    const isSame = workerLoopLogState.key === key;
    if (isSame && now - workerLoopLogState.at < WORKER_LOOP_LOG_COOLDOWN_MS) return false;
    workerLoopLogState.key = key;
    workerLoopLogState.at = now;
    return true;
}

function shouldLogWorkerChatPermissionError(error) {
    const key = getWorkerPollingErrorKey(error);
    const now = Date.now();
    const isSame = workerChatPermissionLogState.key === key;
    if (isSame && now - workerChatPermissionLogState.at < WORKER_CHAT_PERMISSION_LOG_COOLDOWN_MS) return false;
    workerChatPermissionLogState.key = key;
    workerChatPermissionLogState.at = now;
    return true;
}

function scheduleWorkerPollingRecovery(error) {
    if (isStoppingBot || !bot) return;
    if (workerPollingRecovery.inProgress || workerPollingRecovery.timer) return;

    workerPollingRecovery.attempt += 1;
    const attempt = workerPollingRecovery.attempt;
    const baseDelay = Math.min(30000, 2000 * (2 ** (attempt - 1)));
    const jitter = Math.floor(Math.random() * 1000);
    const delayMs = baseDelay + jitter;
    const reasonText = formatWorkerPollingError(error);
    console.warn(`[Worker Polling] Reconnect scheduled in ${delayMs}ms (attempt ${attempt}): ${reasonText}`);

    workerPollingRecovery.timer = setTimeout(async () => {
        workerPollingRecovery.timer = null;
        if (isStoppingBot || !bot) return;
        if (workerPollingRecovery.inProgress) return;

        workerPollingRecovery.inProgress = true;
        const currentBot = bot;
        try {
            try {
                await currentBot.stopPolling();
            } catch (stopErr) {
                console.warn(`[Worker Polling] stopPolling before reconnect ignored: ${stopErr.message}`);
            }

            await new Promise((resolve) => setTimeout(resolve, 300));
            if (isStoppingBot || !bot || bot !== currentBot) {
                workerPollingRecovery.inProgress = false;
                return;
            }
            await currentBot.startPolling(WORKER_POLLING_OPTIONS);
            console.log('[Worker Polling] Reconnected successfully.');
            resetWorkerPollingRecovery();
        } catch (reconnectErr) {
            console.error(`[Worker Polling] Reconnect failed: ${formatWorkerPollingError(reconnectErr)}`);
            workerPollingRecovery.inProgress = false;
            scheduleWorkerPollingRecovery(reconnectErr);
            return;
        }

        workerPollingRecovery.inProgress = false;
    }, delayMs);
}

// Đối tượng chứa thông tin phòng hiện tại của worker này
let currentRoom = {
    config: null,
    state: null,
    model: null,
    botUsername: null,
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

const KHONG_MINH_BASE_MULTIPLIER = 1.95;
const KHONG_MINH_MIN_MULTIPLIER = 0.95;
const KHONG_MINH_MAX_MULTIPLIER = 3.5;
const KHONG_MINH_BANKER_SELECTION_TIME = 20;
const KHONG_MINH_BETTING_TIME = 30;
const KHONG_MINH_RESULT_TIME = 15;
const KHONG_MINH_ROUND2_BETTING_TIME = 30;
const KHONG_MINH_DEFAULT_BOT_BANKER_AMOUNT = 5000000;
const KHONG_MINH_PERCENT_BY_DICE = {
    // 1/2/3: tăng Tài 40%-70%, giảm Xỉu 30%-50%
    1: { tai: 70, xiu: -50 },
    2: { tai: 55, xiu: -40 },
    3: { tai: 40, xiu: -30 },
    // 4/5/6: tăng Xỉu 40%-70%, giảm Tài 30%-50%
    4: { tai: -30, xiu: 40 },
    5: { tai: -40, xiu: 55 },
    6: { tai: -50, xiu: 70 },
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const WORKER_PHASE_REVEAL_DELAY_MS = Math.max(0, Number(process.env.BOT_WORKER_PHASE_REVEAL_DELAY_MS || 350));
const WORKER_POST_RESULT_DELAY_MS = Math.max(0, Number(process.env.BOT_WORKER_POST_RESULT_DELAY_MS || 650));

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const formatMultiplier = (value) => Number(value || 0).toFixed(2);
const applyPercent = (value, percent) => Number(value || 0) * (1 + (Number(percent || 0) / 100));

const resolveCheckCauPathByRoom = () => {
    const roomType = String(currentRoom?.config?.roomType || 'tx').toLowerCase();
    if (roomType === 'khongminh') return '/check-cau-khongminh';
    return '/check-cau-tx';
};

const getCheckCauLink = () => {
    const configuredUrl = String(currentRoom?.config?.checkCauWebAppUrl || '').trim();
    if (/^https?:\/\//i.test(configuredUrl)) {
        return { type: 'web_app', url: configuredUrl };
    }

    const baseFromEnv = String(process.env.WEBGAME_PUBLIC_URL || process.env.WEBGAME_PUBLIC_BASE_URL || '').trim();
    if (/^https?:\/\//i.test(baseFromEnv)) {
        const base = baseFromEnv.replace(/\/+$/, '');
        return { type: 'web_app', url: `${base}${resolveCheckCauPathByRoom()}` };
    }

    const botUsername = String(currentRoom?.botUsername || '').trim();
    if (botUsername) {
        return { type: 'url', url: `https://t.me/${botUsername}?start=check_cau` };
    }

    return null;
};

const toPositiveInt = (value, fallback) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
    return Math.floor(parsed);
};

const isChatLockedPhase = (phase) => (
    phase === 'round1-result'
    || phase === 'result'
);

async function setGroupChatMuted(shouldMute) {
    const chatId = currentRoom?.config?.groupId;
    const state = currentRoom?.state;
    if (!bot || !chatId || !state) return;
    if (state.chatMuted === shouldMute) return;

    try {
        if (state.canRestrictMembers) {
            await bot.setChatPermissions(chatId, { can_send_messages: !shouldMute });
        }
        state.chatMuted = shouldMute;
    } catch (error) {
        const payload = `${error?.code || ''} ${error?.message || ''}`.toUpperCase();
        const permissionDenied = payload.includes('NOT ENOUGH RIGHTS')
            || payload.includes('CHAT_ADMIN_REQUIRED')
            || payload.includes('FORBIDDEN');
        const recoverableNetwork = isRecoverableWorkerPollingError(error);

        if (permissionDenied) {
            state.canRestrictMembers = false;
        }

        if (shouldLogWorkerChatPermissionError(error)) {
            const formatted = formatWorkerPollingError(error);
            if (recoverableNetwork) {
                console.warn(`[Chat Permission Warning] ${formatted}`);
            } else {
                console.error(`[Chat Permission Error] ${formatted}`);
            }
        }
    }
}

const getDefaultMultipliers = () => ({
    Tai: KHONG_MINH_BASE_MULTIPLIER,
    Xiu: KHONG_MINH_BASE_MULTIPLIER,
});

const calculateKhongMinhMultipliers = (firstDice, current = getDefaultMultipliers()) => {
    const percent = KHONG_MINH_PERCENT_BY_DICE[Number(firstDice)] || { tai: 0, xiu: 0 };
    return {
        Tai: Number(clamp(
            applyPercent(Number(current.Tai || KHONG_MINH_BASE_MULTIPLIER), percent.tai),
            KHONG_MINH_MIN_MULTIPLIER,
            KHONG_MINH_MAX_MULTIPLIER,
        ).toFixed(2)),
        Xiu: Number(clamp(
            applyPercent(Number(current.Xiu || KHONG_MINH_BASE_MULTIPLIER), percent.xiu),
            KHONG_MINH_MIN_MULTIPLIER,
            KHONG_MINH_MAX_MULTIPLIER,
        ).toFixed(2)),
    };
};

const isKhongMinhRoom = () => currentRoom?.config?.roomType === 'khongminh';

// Hàm kiểm tra và nâng cấp VIP
async function checkAndUpgradeVip(userId) {
    try {
        const user = await Account.findOne({ userId }, 'vip vipPoints').lean();
        if (!user) return;

        const currentLevel = Number(user.vip || 1);
        const vipPoints = Number(user.vipPoints || 0);
        let newLevel = currentLevel;
        for (const rank of RANKS) {
            if (vipPoints >= rank.pointsNeeded) newLevel = rank.level;
        }

        if (newLevel > currentLevel) {
            const upgradedUser = await Account.findOneAndUpdate(
                {
                    userId,
                    $or: [
                        { vip: { $lt: newLevel } },
                        { vip: { $exists: false } },
                    ],
                },
                { $set: { vip: newLevel } },
                { new: true, projection: 'vip' },
            ).lean();

            if (upgradedUser && bot) {
                const newRank = RANKS.find((rank) => rank.level === newLevel);
                const promotionMessage = `THANG CAP VIP ${newRank.level} - ${newRank.name} ${newRank.icon}`;
                bot.sendMessage(userId, promotionMessage, { parse_mode: 'HTML' }).catch(() => {});
            }
        }
    } catch (error) {
        console.error(`[VIP Upgrade Error] Loi khi nang cap VIP cho user ${userId}: ${error.message}`);
    }
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
                    chatMuted: Boolean(state.chatMuted),
                    banker: state.banker,
                    bankerAmount: state.bankerAmount,
                    bets: state.bets,
                    statusMessageId: state.statusMessageId,
                    round: state.round,
                    firstDice: state.firstDice,
                    currentMultipliers: state.currentMultipliers,
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
    isStoppingBot = true;
    resetWorkerPollingRecovery();
    if (gameInterval) clearInterval(gameInterval);
    gameInterval = null;
    if (bot) {
        try {
            await bot.stopPolling();
            bot.removeAllListeners();
        } catch (e) { console.error(e); }
    }
    bot = null;
    console.log(`[Worker] Bot stopped.`);
    isStoppingBot = false;
}

async function startBot(config) {
    await stopBot();
    isStoppingBot = false;
    resetWorkerPollingRecovery(); // Đảm bảo sạch sẽ trước khi start

    currentRoom.config = config;
    const { roomType, botToken } = config;

    if (!botToken) {
        console.error(`[Worker Error] Bot Token is missing for room: ${roomType}`);
        if (process.send) process.send({ type: 'ERROR', error: 'Telegram Bot Token not provided!' });
        return;
    }

    currentRoom.model = getGameModel(roomType);

    console.log(`[Worker] Starting bot for room: ${roomType}`);

    for (let startupAttempt = 1; startupAttempt <= WORKER_STARTUP_MAX_ATTEMPTS; startupAttempt += 1) {
        try {
            bot = new TelegramBot(botToken, { polling: false });
            
            // Xóa webhook để tránh xung đột với polling
            const me = await bot.getMe();
            currentRoom.botUsername = me?.username || null;
            await bot.deleteWebHook();
            const requiresPlainGroupBet = ['tx', 'md5', 'khongminh'].includes(String(roomType || '').toLowerCase());
            const privacyEnabled = !me || me.can_read_all_group_messages !== true;
            if (config.groupId && requiresPlainGroupBet && privacyEnabled) {
                const errMsg =
                    `Bot @${me?.username || 'unknown'} đang bật Privacy Mode; ` +
                    `không thể nhận cược dạng "T 1000"/"X 1000" trong nhóm. ` +
                    `Vào BotFather -> /setprivacy -> chọn bot -> Disable, rồi khởi động lại bot.`;
                await bot.sendMessage(
                    config.groupId,
                    `⛔ ${errMsg}`,
                ).catch(() => {});
                if (process.send) process.send({ type: 'ERROR', error: errMsg });
                await stopBot();
                return;
            }

            let botGroupCapabilities = {
                canRestrictMembers: false,
                canDeleteMessages: false,
            };
            if (config.groupId) {
                try {
                    const selfMember = await bot.getChatMember(config.groupId, me.id);
                    const status = String(selfMember?.status || '').toLowerCase();
                    botGroupCapabilities = {
                        canRestrictMembers: Boolean(selfMember?.can_restrict_members),
                        canDeleteMessages: Boolean(selfMember?.can_delete_messages),
                    };
                    const isAdmin = status === 'administrator' || status === 'creator';
                    if (!isAdmin) {
                        const errMsg = 'Bot chưa là admin trong nhóm. Hãy cấp quyền admin để khóa chat tự động.';
                        await bot.sendMessage(config.groupId, `⛔ ${errMsg}`).catch(() => {});
                        if (process.send) process.send({ type: 'ERROR', error: errMsg });
                        await stopBot();
                        return;
                    }
                    if (!botGroupCapabilities.canRestrictMembers && !botGroupCapabilities.canDeleteMessages) {
                        const errMsg = 'Bot thiếu quyền "Restrict members" hoặc "Delete messages"; không thể khóa chat khi tung xúc xắc.';
                        await bot.sendMessage(config.groupId, `⛔ ${errMsg}`).catch(() => {});
                        if (process.send) process.send({ type: 'ERROR', error: errMsg });
                        await stopBot();
                        return;
                    }
                } catch (error) {
                    const errMsg = `Không kiểm tra được quyền bot trong nhóm: ${error.message}`;
                    console.error(`[Chat Permission Check Error] ${errMsg}`);
                    if (process.send) process.send({ type: 'ERROR', error: errMsg });
                }
            }

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
                chatMuted: resuming ? Boolean(config.gameState.chatMuted) : false,
                canRestrictMembers: botGroupCapabilities.canRestrictMembers,
                canDeleteMessages: botGroupCapabilities.canDeleteMessages,
                banker: resuming ? config.gameState.banker : null,
                bankerAmount: resuming ? config.gameState.bankerAmount : 0,
                bets: initialBets,
                statusMessageId: resuming ? config.gameState.statusMessageId : null,
                jackpot: config.jackpot || 0,
                sessionCounter: config.sessionCounter || 202500000000,
                history: config.gameHistory || [],
                fakeBots: [],
                round: resuming ? Number(config.gameState.round || 1) : 1,
                firstDice: resuming ? (config.gameState.firstDice || null) : null,
                currentMultipliers: resuming
                    ? { ...getDefaultMultipliers(), ...(config.gameState.currentMultipliers || {}) }
                    : getDefaultMultipliers(),
            };

            // Ensure restored bet records have enough metadata for payout.
            for (const side of ['Tai', 'Xiu']) {
                const users = currentRoom.state.bets?.[side]?.users || {};
                for (const userId of Object.keys(users)) {
                    const entry = users[userId] || {};
                    entry.choice = side;
                    entry.amount = Number(entry.amount || 0);
                    if (!Array.isArray(entry.betLines) || entry.betLines.length === 0) {
                        const fallbackMultiplier = isKhongMinhRoom()
                            ? Number(currentRoom.state.currentMultipliers?.[side] || KHONG_MINH_BASE_MULTIPLIER)
                            : 2;
                        entry.betLines = [{
                            amount: entry.amount,
                            multiplier: fallbackMultiplier,
                            round: Number(currentRoom.state.round || 1),
                        }];
                    }
                    users[userId] = entry;
                }
            }

            // Tạo bot ảo
            if (config.fakeBetEnabled) {
                for (let i = 0; i < 100; i++) {
                    const fakeId = Math.floor(8000000000 + Math.random() * 1000000000);
                    currentRoom.state.fakeBots.push({ id: fakeId, username: `User${fakeId.toString().slice(-4)}` });
                }
            }

            setupBotListeners();
            await bot.startPolling(WORKER_POLLING_OPTIONS);
            const phaseAllowsChat = ['banker-selection', 'betting', 'betting-round1', 'betting-round2'].includes(currentRoom.state.phase);
            await setGroupChatMuted(!phaseAllowsChat);
            startGameLoop();

            if (process.send) process.send({ type: 'STARTED' });
            return;
        } catch (error) {
            const isRecoverable = isRecoverableWorkerPollingError(error);
            const isLastAttempt = startupAttempt >= WORKER_STARTUP_MAX_ATTEMPTS;
            if (isRecoverable && !isLastAttempt) {
                const baseDelay = WORKER_STARTUP_RETRY_BASE_DELAY_MS * (2 ** (startupAttempt - 1));
                const jitter = Math.floor(Math.random() * 1000);
                const delayMs = Math.min(20000, baseDelay + jitter);
                const reasonText = formatWorkerPollingError(error);
                console.warn(
                    `[Worker Startup] Attempt ${startupAttempt}/${WORKER_STARTUP_MAX_ATTEMPTS} failed: ` +
                    `${reasonText}. Retry in ${delayMs}ms.`,
                );
                await stopBot();
                await sleep(delayMs);
                isStoppingBot = false;
                resetWorkerPollingRecovery();
                continue;
            }

            await stopBot();
            console.error(`[Worker Error] ${error.message}`);
            if (process.send) process.send({ type: 'ERROR', error: error.message });
            return;
        }
    }
}

function setupBotListeners() {
    if (!bot) return;

    bot.on('polling_error', (error) => {
        if (shouldLogWorkerPollingError(error)) {
            console.warn(`[Worker Polling Error] ${formatWorkerPollingError(error)}`);
        }
        if (isWorkerConflictError(error)) {
            console.error('[Worker Polling] 409 conflict detected. Skip auto-reconnect.');
            return;
        }

        if (isRecoverableWorkerPollingError(error)) {
            scheduleWorkerPollingRecovery(error);
        }
    });

    // --- Xử lý lệnh /ducai ---
    bot.onText(/^\/ducai(?:@\w+)?(?:\s+([0-9][\d.,]*|allin))?\s*$/i, async (msg, match) => {
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
            const commandArgRaw = String(match?.[1] || '').trim();
            const commandArg = commandArgRaw.toLowerCase();

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
            } else if (commandArgRaw) {
                const customAmount = Number(commandArgRaw.replace(/[^\d]/g, ''));
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

    bot.onText(/\/privacy(?:@\w+)?/i, async (msg) => {
        try {
            const me = await bot.getMe();
            const isEnabled = me && me.can_read_all_group_messages === false;
            const statusText = isEnabled ? 'BẬT' : 'TẮT';
            await bot.sendMessage(
                msg.chat.id,
                `🔎 Privacy Mode hiện tại: <b>${statusText}</b>\n` +
                `- Nếu <b>BẬT</b>: nhóm chỉ nhận lệnh dạng "/..."\n` +
                `- Nếu <b>TẮT</b>: nhóm nhận được cả "T 1000" / "X 1000"`,
                { parse_mode: 'HTML' },
            ).catch(() => {});
        } catch (error) {
            console.error(`[Privacy Check Error] ${error.message}`);
        }
    });

    // Fallback khóa chat: nếu thiếu quyền restrict nhưng có quyền delete,
    // bot sẽ xóa mọi tin nhắn trong giai đoạn khóa chat.
    bot.on('message', async (msg) => {
        try {
            if (!msg || !msg.chat || !currentRoom?.config || !currentRoom?.state) return;
            if (String(msg.chat.id) !== String(currentRoom.config.groupId)) return;
            if (!isChatLockedPhase(currentRoom.state.phase)) return;
            if (msg.from && msg.from.is_bot) return;

            msg.__chatLocked = true;

            if (currentRoom.state.canDeleteMessages && msg.message_id) {
                await bot.deleteMessage(currentRoom.config.groupId, String(msg.message_id)).catch(() => {});
            }
        } catch (error) {
            console.error(`[Chat Lock Fallback Error] ${error.message}`);
        }
    });

    // --- Xử lý đặt cược ---
    const handleBet = createHandleBet({
        bot,
        currentRoom,
        Account,
        khongMinhBaseMultiplier: KHONG_MINH_BASE_MULTIPLIER,
    });

    registerBetMessageListener({ bot, handleBet });
}
function startGameLoop() {
    const config = currentRoom.config;
    const khongMinhMode = config.roomType === 'khongminh';
    const BANKER_SELECTION_TIME = khongMinhMode
        ? toPositiveInt(config.bankerSelectionTime, KHONG_MINH_BANKER_SELECTION_TIME)
        : toPositiveInt(config.bankerSelectionTime, 30);
    const BETTING_TIME = khongMinhMode
        ? toPositiveInt((config.roundOneBettingTime ?? config.bettingTime), KHONG_MINH_BETTING_TIME)
        : toPositiveInt(config.bettingTime, 60);
    const ROUND_ONE_RESULT_TIME = khongMinhMode
        ? toPositiveInt(config.roundOneResultTime, KHONG_MINH_RESULT_TIME)
        : 10;
    const ROUND_TWO_BETTING_TIME = khongMinhMode
        ? toPositiveInt(config.roundTwoBettingTime, KHONG_MINH_ROUND2_BETTING_TIME)
        : toPositiveInt(config.roundTwoBettingTime, KHONG_MINH_ROUND2_BETTING_TIME);
    const FINAL_RESULT_TIME = khongMinhMode
        ? toPositiveInt(config.finalResultTime, KHONG_MINH_RESULT_TIME)
        : toPositiveInt(config.finalResultTime, 10);
    const SESSION_WAIT_TIME = khongMinhMode
        ? toPositiveInt(config.sessionWaitTime, 1)
        : toPositiveInt(config.sessionWaitTime, 1);

    const applyFakeBet = () => {
        const state = currentRoom.state;
        if (!config.fakeBetEnabled || config.fakeBetInterval <= 0 || state.timer <= 1) return;
        if (!state.fakeBots || state.fakeBots.length === 0) return;
        if (Math.random() >= (1 / config.fakeBetInterval)) return;

        const min = Math.min(config.fakeBetMinAmount, config.fakeBetMaxAmount);
        const max = Math.max(config.fakeBetMinAmount, config.fakeBetMaxAmount);
        const fakeAmount = Math.round((Math.floor(Math.random() * (max - min + 1)) + min) / 1000) * 1000;
        const choice = Math.random() < 0.5 ? 'Tai' : 'Xiu';
        const oppositeChoice = choice === 'Tai' ? 'Xiu' : 'Tai';
        const fakeBot = state.fakeBots[Math.floor(Math.random() * state.fakeBots.length)];
        if (!fakeBot) return;

        if (state.bets[oppositeChoice].users[fakeBot.id]) return;
        if (!state.bets[choice].users[fakeBot.id]) {
            state.bets[choice].users[fakeBot.id] = {
                username: fakeBot.username,
                amount: 0,
                isFake: true,
                choice,
                betLines: [],
            };
        }
        const record = state.bets[choice].users[fakeBot.id];
        const currentMultiplier = khongMinhMode
            ? Number(state.currentMultipliers?.[choice] || KHONG_MINH_BASE_MULTIPLIER)
            : 2;
        record.amount += fakeAmount;
        record.choice = choice;
        record.betLines.push({
            amount: fakeAmount,
            multiplier: currentMultiplier,
            round: Number(state.round || 1),
        });
        state.bets[choice].total += fakeAmount;
    };

    const buildSideBetSnapshot = (users = {}) => {
        return Object.entries(users)
            .map(([userId, info]) => ({
                userId: String(userId || ''),
                username: String(info?.username || `User_${userId}`),
                amount: Number(info?.amount || 0),
                isFake: Boolean(info?.isFake),
            }))
            .filter((item) => !item.isFake && item.amount > 0)
            .sort((a, b) => b.amount - a.amount);
    };

    const settleRound = async (dice, total, result) => {
        const state = currentRoom.state;
        const allBets = [];
        for (const side of ['Tai', 'Xiu']) {
            for (const [userId, info] of Object.entries(state.bets[side].users || {})) {
                allBets.push({ userId, choice: side, ...info });
            }
        }
        const totalRealBetAmount = allBets.reduce((sum, entry) => {
            if (entry?.isFake) return sum;
            return sum + Number(entry?.amount || 0);
        }, 0);

        const winners = [];
        const accountOps = [];
        const vipUsersToCheck = new Set();

        for (const entry of allBets) {
            if (entry?.isFake) continue;
            const numericUserId = parseInt(entry.userId, 10);
            if (!Number.isFinite(numericUserId)) continue;

            const inc = {};
            const vipPointsToAdd = Math.floor(Number(entry.amount || 0) * VIP_POINT_RATE);
            if (vipPointsToAdd > 0) {
                inc.vipPoints = vipPointsToAdd;
                vipUsersToCheck.add(numericUserId);
            }

            if (entry.choice === result) {
                const betLines = Array.isArray(entry.betLines) && entry.betLines.length > 0
                    ? entry.betLines
                    : [{
                        amount: Number(entry.amount || 0),
                        multiplier: khongMinhMode
                            ? Number(state.currentMultipliers?.[entry.choice] || KHONG_MINH_BASE_MULTIPLIER)
                            : 2,
                    }];
                const grossWin = Math.floor(
                    betLines.reduce((sum, line) => sum + (Number(line.amount || 0) * Number(line.multiplier || 2)), 0),
                );
                const totalBetAmount = Math.floor(
                    betLines.reduce((sum, line) => sum + Number(line.amount || 0), 0),
                );
                if (grossWin > 0) {
                    inc.balance = Number(inc.balance || 0) + grossWin;
                    winners.push({
                        userId: numericUserId,
                        username: entry.username || `User_${numericUserId}`,
                        betAmount: totalBetAmount,
                        winAmount: grossWin,
                    });
                }
            }

            if (Object.keys(inc).length > 0) {
                accountOps.push({
                    updateOne: {
                        filter: { userId: numericUserId },
                        update: { $inc: inc },
                    },
                });
            }
        }

        if (accountOps.length > 0) {
            await Account.bulkWrite(accountOps, { ordered: false });
        }
        if (vipUsersToCheck.size > 0) {
            await Promise.allSettled(Array.from(vipUsersToCheck).map((id) => checkAndUpgradeVip(id)));
        }

        const totalWinAmount = winners.reduce((sum, item) => sum + Number(item.winAmount || 0), 0);
        const bankerInitialHold = Math.max(0, Number(state?.bankerAmount || 0));
        const bankerNetProfit = Math.floor(totalRealBetAmount - totalWinAmount);
        const bankerReturnAmount = Math.max(0, Math.floor(bankerInitialHold + bankerNetProfit));
        let bankerSummaryLine = '';
        let bankerNotifyPromise = Promise.resolve();

        if (state.banker && typeof state.banker === 'object' && Number.isFinite(Number(state.banker.userId))) {
            const bankerUserId = Number(state.banker.userId);
            await Account.findOneAndUpdate(
                { userId: bankerUserId },
                { $inc: { balance: bankerReturnAmount } },
            );

            const bankerOutcomeText = bankerNetProfit >= 0
                ? `lời ${bankerNetProfit.toLocaleString('vi-VN')}đ`
                : `lỗ ${Math.abs(bankerNetProfit).toLocaleString('vi-VN')}đ`;
            bankerSummaryLine =
                `\nCÁI ${escapeHtml(state.banker.username || `User_${bankerUserId}`)}: ` +
                `hoàn ${bankerReturnAmount.toLocaleString('vi-VN')}đ (${bankerOutcomeText})`;

            bankerNotifyPromise = bot.sendMessage(
                bankerUserId,
                `QUYẾT TOÁN CÁI\n` +
                `Phiên: ${state.sessionId}\n` +
                `Tiền giữ ban đầu: ${bankerInitialHold.toLocaleString('vi-VN')}đ\n` +
                `Tổng cược thật: ${totalRealBetAmount.toLocaleString('vi-VN')}đ\n` +
                `Tổng trả thưởng: ${totalWinAmount.toLocaleString('vi-VN')}đ\n` +
                `Kết quả CÁI: ${bankerOutcomeText}\n` +
                `Tiền hoàn về tài khoản: ${bankerReturnAmount.toLocaleString('vi-VN')}đ`,
                { parse_mode: 'HTML' },
            ).catch(() => {});
        } else if (String(state.banker || '').toLowerCase() === 'admin') {
            bankerSummaryLine = '';
        }

        const winnerDetails = winners.length > 0
            ? winners.slice(0, 10).map((item) => (
                `- <b>${escapeHtml(item.username)}</b>: cược <b>${Number(item.betAmount || 0).toLocaleString('vi-VN')}đ</b>, thắng <b>${Number(item.winAmount || 0).toLocaleString('vi-VN')}đ</b>`
            )).join('\n')
            : 'Không có người thắng.';
        const hiddenWinnerCount = Math.max(0, winners.length - 10);
        const moreWinnersLine = hiddenWinnerCount > 0
            ? `\n... và <b>${hiddenWinnerCount}</b> người thắng khác`
            : '';

        const rsStr = result === 'Tai' ? 'TÀI' : 'XỈU';
        const resultIcon = result === 'Tai' ? '⚫️' : '⚪️';
        const diceText = `${dice[0]} - ${dice[1]} - ${dice[2]}`;
        const checkCauLink = getCheckCauLink();
        const messageOptions = { parse_mode: 'HTML' };
        if (checkCauLink) {
            const button = checkCauLink.type === 'web_app'
                ? { text: 'Check cầu', web_app: { url: checkCauLink.url } }
                : { text: 'Check cầu', url: checkCauLink.url };
            messageOptions.reply_markup = {
                inline_keyboard: [[button]],
            };
        }

        await bot.sendMessage(
            config.groupId,
            `🎲 KẾT QUẢ PHIÊN ${state.sessionId}\n` +
            `Xúc xắc: ${diceText}\n` +
            `Tổng: ${total} => ${resultIcon} ${rsStr}\n` +
            `👥 Người thắng: ${winners.length}\n` +
            `💸 Tổng thắng: ${totalWinAmount.toLocaleString('vi-VN')}đ\n` +
            `🏆 Chi tiết thắng:\n${winnerDetails}${moreWinnersLine}`,
            messageOptions,
        );

        await bankerNotifyPromise;
    };

    let loopBusy = false;
    gameInterval = setInterval(async () => {
        if (loopBusy) return;
        loopBusy = true;
        const state = currentRoom.state;
        try {
            if (!state) return;
            state.timer--;
            switch (state.phase) {
                case 'waiting':
                    if (state.timer > 0) break;
                    state.phase = 'banker-selection';
                    state.timer = BANKER_SELECTION_TIME;
                    await setGroupChatMuted(false);
                    state.sessionCounter++;
                    state.sessionId = state.sessionCounter;
                    state.bets = { Tai: { total: 0, users: {} }, Xiu: { total: 0, users: {} } };
                    state.banker = null;
                    state.jackpot = config.jackpot || 0;
                    state.round = 1;
                    state.firstDice = null;
                    state.currentMultipliers = getDefaultMultipliers();
                    const botUsername = currentRoom.botUsername || '';
                    const anonymousLine = botUsername
                        ? `🔐 Cược ẩn danh tại đây: <a href="https://t.me/${botUsername}">@${botUsername}</a>\n`
                        : '';
                    const bankerQuickGuide =
                        `👉 Lệnh nhanh:\n` +
                        `✅ /ducai – Lệch cửa 3M\n` +
                        `✅ /ducai (số tiền) – Lệch tùy chọn (≥3M)\n` +
                        `✅ /ducai allin – Dùng toàn bộ số dư\n`;
                    const msg = khongMinhMode
                        ? (
                            `🔴 <b>PHIÊN MỚI: ${state.sessionId}</b>\n` +
                            `💰 Hũ: ${state.jackpot.toLocaleString()}đ\n` +
                            `📊 Tỷ lệ mở kèo:\n` +
                            `🔴 TÀI x${formatMultiplier(state.currentMultipliers.Tai)}\n` +
                            `⚪️ XỈU x${formatMultiplier(state.currentMultipliers.Xiu)}\n` +
                            `📘 Cách chơi:\n` +
                            `- Đặt cược trong nhóm: T 100000 hoặc X 100000\n` +
                            bankerQuickGuide +
                            anonymousLine
                        )
                        : (
                            `🔴 <b>PHIÊN MỚI: ${state.sessionId}</b>\n` +
                            `💰 Hũ: ${state.jackpot.toLocaleString()}đ\n` +
                            `📘 Cách chơi:\n` +
                            `- Đặt cược trong nhóm: T 100000 hoặc X 100000\n` +
                            bankerQuickGuide +
                            anonymousLine
                        );
                    await bot.sendMessage(config.groupId, msg, { parse_mode: 'HTML' });
                    await bot.sendMessage(
                        config.groupId,
                        getBankerSelectionMessage(state),
                        { parse_mode: 'HTML' },
                    );
                    await saveGameState();
                    break;

                case 'banker-selection':
                    if (state.timer > 0 && state.timer % 10 === 0) {
                        await bot.sendMessage(
                            config.groupId,
                            getBankerSelectionMessage(state),
                            { parse_mode: 'HTML' },
                        );
                    }
                    if (state.timer <= 0) {
                        await setGroupChatMuted(false);
                        state.phase = khongMinhMode ? 'betting-round1' : 'betting';
                        state.round = 1;
                        state.timer = BETTING_TIME;
                        if (!state.banker) {
                            state.banker = 'Admin';
                            state.bankerAmount = khongMinhMode
                                ? toPositiveInt(config.botBankerAmount, KHONG_MINH_DEFAULT_BOT_BANKER_AMOUNT)
                                : (config.botBanker ? (config.botBankerAmount || 5000000) : 0);
                            await bot.sendMessage(
                                config.groupId,
                                `Admin sẽ làm cái với ${state.bankerAmount.toLocaleString()}đ.`,
                            );
                        }
                        if (khongMinhMode) {
                            state.firstDice = null;
                            state.currentMultipliers = getDefaultMultipliers();
                            await bot.sendMessage(
                                config.groupId,
                                `🎮 <b>BẮT ĐẦU ĐẶT CƯỢC VÒNG 1!</b>\n` +
                                `📊 Tỷ lệ hiện tại:\n` +
                                `🔴 TÀI x${formatMultiplier(state.currentMultipliers.Tai)}\n` +
                                `⚪️ XỈU x${formatMultiplier(state.currentMultipliers.Xiu)}`,
                                { parse_mode: 'HTML' },
                            );
                        } else {
                            await bot.sendMessage(config.groupId, '🎮 <b>BẮT ĐẦU ĐẶT CƯỢC!</b>', { parse_mode: 'HTML' });
                        }
                        
                        const sent = await bot.sendMessage(config.groupId, getBetStatusMessage(), { parse_mode: 'HTML' });
                        state.statusMessageId = sent.message_id;
                        await saveGameState();
                    }
                    break;

                case 'betting':
                case 'betting-round1':
                case 'betting-round2':
                    if (state.timer > 0 && state.timer % 10 === 0) {
                        await bot.sendMessage(
                            config.groupId,
                            getBetStatusMessage(),
                            { parse_mode: 'HTML' },
                        ).catch(() => {});
                    }
                    
                    applyFakeBet();

                    if (state.timer <= 0) {
                        if (khongMinhMode && state.phase === 'betting-round1') {
                            await setGroupChatMuted(true);
                            state.phase = 'round1-result';
                            state.round = 1;
                            state.timer = ROUND_ONE_RESULT_TIME;
                            await bot.sendMessage(
                                config.groupId,
                                '⛔️ <b>HẾT CƯỢC VÒNG 1!</b> Tung xúc xắc mồi...',
                                { parse_mode: 'HTML' },
                            );
                            await sleep(WORKER_PHASE_REVEAL_DELAY_MS);
                            const d1 = await bot.sendDice(config.groupId);
                            state.firstDice = Number(d1?.dice?.value || 1);
                            state.currentMultipliers = calculateKhongMinhMultipliers(
                                state.firstDice,
                                getDefaultMultipliers(),
                            );
                            await bot.sendMessage(
                                config.groupId,
                                `🎲 <b>VÒNG 1 RA: ${state.firstDice}</b>\n` +
                                `📈 Cập nhật tỷ lệ vòng 2:\n` +
                                `🔴 TÀI x${formatMultiplier(state.currentMultipliers.Tai)}\n` +
                                `⚪️ XỈU x${formatMultiplier(state.currentMultipliers.Xiu)}\n` +
                                `⏳ Mở cược vòng 2 sau ${state.timer}s.`,
                                { parse_mode: 'HTML' },
                            );
                            if (state.statusMessageId) {
                                state.statusMessageId = null;
                            }
                            await saveGameState();
                            break;
                        }

                        await setGroupChatMuted(true);
                        state.phase = 'result';
                        state.timer = FINAL_RESULT_TIME;
                        if (state.statusMessageId) {
                            state.statusMessageId = null;
                        }
                        await bot.sendMessage(
                            config.groupId,
                            khongMinhMode
                                ? '⛔️ <b>ĐÃ KHÓA CƯỢC VÒNG 2!</b> Tung 2 xúc xắc cuối...'
                                : '⛔️ <b>ĐÃ KHÓA CƯỢC!</b> Đang lắc...',
                            { parse_mode: 'HTML' },
                        );
                        
                        await sleep(WORKER_PHASE_REVEAL_DELAY_MS);
                        let dice = [1, 1, 1];
                        if (khongMinhMode && state.firstDice) {
                            const d2 = await bot.sendDice(config.groupId);
                            const d3 = await bot.sendDice(config.groupId);
                            dice = [state.firstDice, d2.dice.value, d3.dice.value];
                        } else {
                            const d1 = await bot.sendDice(config.groupId);
                            const d2 = await bot.sendDice(config.groupId);
                            const d3 = await bot.sendDice(config.groupId);
                            dice = [d1.dice.value, d2.dice.value, d3.dice.value];
                        }
                        const total = dice.reduce((a, b) => a + b, 0);
                        const result = khongMinhMode
                            ? (total <= 10 ? 'Xiu' : 'Tai')
                            : ((total >= 4 && total <= 10) ? 'Xiu' : 'Tai');

                        await settleRound(dice, total, result);
                        await sleep(WORKER_POST_RESULT_DELAY_MS);
                        
                        state.history.unshift({
                            sessionId: state.sessionId,
                            result,
                            total,
                            dice: Array.isArray(dice) ? dice.map((value) => Number(value || 0)) : [],
                            taiTotal: Number(state?.bets?.Tai?.total || 0),
                            xiuTotal: Number(state?.bets?.Xiu?.total || 0),
                            bankerAmount: Number(state?.bankerAmount || 0),
                            taiBets: buildSideBetSnapshot(state?.bets?.Tai?.users || {}),
                            xiuBets: buildSideBetSnapshot(state?.bets?.Xiu?.users || {}),
                            date: new Date().toISOString(),
                        });
                        if (state.history.length > 80) state.history.pop();

                        state.round = 1;
                        state.firstDice = null;
                        state.currentMultipliers = getDefaultMultipliers();
                        
                        await currentRoom.model.findOneAndUpdate({ roomType: config.roomType }, { gameState: null, gameHistory: state.history });
                    }
                    break;

                case 'round1-result':
                    if (state.timer <= 0) {
                        await setGroupChatMuted(false);
                        state.phase = 'betting-round2';
                        state.round = 2;
                        state.timer = ROUND_TWO_BETTING_TIME;
                        await bot.sendMessage(
                            config.groupId,
                            `🎮 <b>BẮT ĐẦU ĐẶT CƯỢC VÒNG 2!</b>\n` +
                            `📊 Tỷ lệ hiện tại:\n` +
                            `🔴 TÀI x${formatMultiplier(state.currentMultipliers.Tai)}\n` +
                            `⚪️ XỈU x${formatMultiplier(state.currentMultipliers.Xiu)}`,
                            { parse_mode: 'HTML' },
                        );
                        const sent = await bot.sendMessage(
                            config.groupId,
                            getBetStatusMessage(),
                            { parse_mode: 'HTML' },
                        );
                        state.statusMessageId = sent.message_id;
                        await saveGameState();
                    }
                    break;

                case 'result':
                    if (state.timer <= 0) {
                        state.phase = 'waiting';
                        state.timer = SESSION_WAIT_TIME;
                    }
                    break;
            }
        } catch (e) {
            if (shouldLogWorkerLoopError(e)) {
                const formatted = formatWorkerPollingError(e);
                if (isRecoverableWorkerPollingError(e)) {
                    console.warn(`[Loop Warning] ${formatted}`);
                } else {
                    console.error(`[Loop Error] ${formatted}`);
                }
            }
        } finally {
            loopBusy = false;
        }
    }, 1000);
}

function getBetStatusMessage() {
    const state = currentRoom.state;
    const h = state.history
        .slice(0, 12)
        .map((r) => (r.result === 'Tai' ? '⚫️' : '⚪️'))
        .join('');
    const getRealSideStats = (users = {}) => Object.values(users).reduce((acc, entry) => {
        if (!entry || entry.isFake) return acc;
        const amount = Number(entry.amount || 0);
        if (amount <= 0) return acc;
        acc.users += 1;
        acc.total += amount;
        return acc;
    }, { users: 0, total: 0 });
    const taiStats = getRealSideStats(state?.bets?.Tai?.users || {});
    const xiuStats = getRealSideStats(state?.bets?.Xiu?.users || {});
    const taiUsers = taiStats.users;
    const xiuUsers = xiuStats.users;
    if (isKhongMinhRoom()) {
        const roundLabel = state.phase === 'betting-round2'
            ? 'VÒNG 2'
            : (state.phase === 'round1-result' ? 'CHỜ VÒNG 2' : 'VÒNG 1');
        const firstDiceLine = state.firstDice
            ? `🎲 Xúc xắc vòng 1: <b>${state.firstDice}</b>\n`
            : '';
        return `⏳ <b>${state.timer}s</b> | Phiên: ${state.sessionId} | ${roundLabel}\n` +
            `💰 Hũ: ${state.jackpot.toLocaleString()}đ\n` +
            `📊 Kèo: 🔴 TÀI x${formatMultiplier(state.currentMultipliers?.Tai)} | ⚪️ XỈU x${formatMultiplier(state.currentMultipliers?.Xiu)}\n` +
            firstDiceLine +
            `⚫️ Tài: ${state.bets.Tai.total.toLocaleString()}đ (${taiUsers} người)\n` +
            `⚪️ Xỉu: ${state.bets.Xiu.total.toLocaleString()}đ (${xiuUsers} người)\n` +
            `Lịch sử: ${h}`;
    }
    const secondsLeft = Math.max(0, Number(state.timer || 0));
    const historyText = h || 'Chưa có';
    return `⏳ Phiên ${state.sessionId}. Còn ${secondsLeft}s để đặt cược ⏳\n\n` +
        `💰 Tiền cái ${Number(state.bankerAmount || 0).toLocaleString('vi-VN')} ₫\n\n` +
        `⚫️ Cửa Tài: ${taiUsers} người đặt. Tổng tiền ${Number(taiStats.total || 0).toLocaleString('vi-VN')} ₫\n` +
        `⚪️ Cửa Xỉu: ${xiuUsers} người đặt. Tổng tiền ${Number(xiuStats.total || 0).toLocaleString('vi-VN')} ₫\n\n` +
        `💰 Hũ hiện tại: ${Number(state.jackpot || 0).toLocaleString('vi-VN')} ₫\n\n` +
        `📋 Kết quả 12 phiên gần nhất\n` +
        `${historyText}`;
}

function getBankerSelectionMessage(state) {
    const secondsLeft = Math.max(0, Number(state?.timer || 0));
    const sessionId = String(state?.sessionId || '');
    const jackpot = Number(state?.jackpot || 0).toLocaleString('vi-VN');

    return `🔥 PHIÊN ${sessionId} – ĐANG CHỌN CÁI! 🔥\n\n` +
        `⏳ Còn ${secondsLeft} giây để chọn CÁI\n\n` +
        `😎 Trạng thái: Hết thời gian không ai chọn cái, admin sẽ tự nhận cái\n\n` +
        `👉 Lệnh nhanh:\n` +
        `✅ /ducai – Lệch cửa 3M\n` +
        `✅ /ducai (số tiền) – Lệch tùy chọn (≥3M)\n` +
        `✅ /ducai allin – Dùng toàn bộ số dư\n\n` +
        `⚠️ Khi làm CÁI hệ thống sẽ tạm giữ số tiền tương ứng\n\n` +
        `💰 Hũ: ${jackpot} ₫`;
}






