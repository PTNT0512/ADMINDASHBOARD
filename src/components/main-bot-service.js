process.env.NTBA_FIX_350 = process.env.NTBA_FIX_350 || '1';
const TelegramBot = require('node-telegram-bot-api');
const { patchTelegramBotEncoding } = require('../utils/telegram-bot-normalizer.js');
patchTelegramBotEncoding(TelegramBot);
const crypto = require('crypto');
const axios = require('axios'); // Thêm thư viện axios
const Account = require('../models/Account.js');
const Deposit = require('../models/Deposit.js');
const Withdraw = require('../models/Withdraw.js');
const BankAuto = require('../models/BankAuto.js');
const Setting = require('../models/Setting.js');
const EWallet = require('../models/EWallet.js'); // Thêm model EWallet
const MiniGameHistory = require('../models/MiniGameHistory.js');
const CheckinHistory = require('../models/CheckinHistory.js');
const Giftcode = require('../models/GiftCode.js');
const Transaction = require('../models/Transaction.js');
const { processCardDeposit } = require('./CardChargingService');
const { createSettingsCache, createKeyedSerialExecutor, debitAccountForBet, creditAccountBalance } = require('./bot-performance-utils');

// Import các bộ xử lý tính năng riêng biệt
const GameListHandler = require('./GameListHandler');
const AccountHandler = require('./AccountHandler');
const DepositHandler = require('./DepositHandler');
const WithdrawHandler = require('./WithdrawHandler');
const EventHandler = require('./EventHandler');
const RankingHandler = require('./RankingHandler');
const ReferralHandler = require('./ReferralHandler');
const CommissionHandler = require('./CommissionHandler');
const SafeHandler = require('./SafeHandler'); // Import SafeHandler

const MAIN_BOT_SLOT_RESULT_DELAY_MS = Math.max(0, Number(process.env.MAIN_BOT_SLOT_RESULT_DELAY_MS || 900));
const MAIN_BOT_DICE_RESULT_DELAY_MS = Math.max(0, Number(process.env.MAIN_BOT_DICE_RESULT_DELAY_MS || 1200));
const mainBotSettingsCache = createSettingsCache(Setting);
const runMainBotGameUserTask = createKeyedSerialExecutor();

async function getMainBotSettings(forceRefresh = false) {
    return mainBotSettingsCache.get(forceRefresh);
}
let mainBotInstance = null;
const MAIN_BOT_POLLING_RECOVERABLE_MARKERS = [
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
const MAIN_BOT_POLLING_LOG_COOLDOWN_MS = 30000;
const MAIN_BOT_POLLING_RECOVERY_COOLDOWN_MS = 15000;
const MAIN_BOT_POLLING_RECOVERY_ERROR_THRESHOLD = 2;
const MAIN_BOT_POLLING_RECOVERY_WINDOW_MS = 45000;
const mainBotPollingRecovery = {
    attempt: 0,
    timer: null,
    inProgress: false,
    lastErrorKey: '',
    lastErrorLogAt: 0,
    recoverableErrorBurst: 0,
    lastRecoverableErrorAt: 0,
    lastRecoveryAt: 0,
    lastRecoverySkipLogAt: 0,
};
const MAIN_BOT_POLLING_OPTIONS = {
    interval: 500,
    params: { timeout: 25 },
};

function clearMainBotPollingRecoveryTimer() {
    if (!mainBotPollingRecovery.timer) return;
    clearTimeout(mainBotPollingRecovery.timer);
    mainBotPollingRecovery.timer = null;
}

function resetMainBotPollingRecovery() {
    clearMainBotPollingRecoveryTimer();
    mainBotPollingRecovery.attempt = 0;
    mainBotPollingRecovery.inProgress = false;
    mainBotPollingRecovery.lastErrorKey = '';
    mainBotPollingRecovery.lastErrorLogAt = 0;
    mainBotPollingRecovery.recoverableErrorBurst = 0;
    mainBotPollingRecovery.lastRecoverableErrorAt = 0;
    mainBotPollingRecovery.lastRecoveryAt = 0;
    mainBotPollingRecovery.lastRecoverySkipLogAt = 0;
}

function isMainBotConflictError(err) {
    const payload = `${err?.code || ''} ${err?.message || ''}`.toUpperCase();
    return payload.includes('409 CONFLICT');
}

function getMainBotPollingErrorKey(err) {
    const payload = `${err?.code || ''} ${err?.message || ''}`.toUpperCase();
    if (payload.includes('409 CONFLICT')) return '409_CONFLICT';
    if (payload.includes('ECONNRESET') || payload.includes('SOCKET HANG UP')) return 'ECONNRESET';
    if (payload.includes('ETIMEDOUT') || payload.includes('TIMED OUT') || payload.includes('ESOCKETTIMEDOUT')) return 'ETIMEDOUT';
    if (payload.includes('ECONNREFUSED')) return 'ECONNREFUSED';
    if (payload.includes('EAI_AGAIN') || payload.includes('ENOTFOUND')) return 'DNS';
    if (payload.includes('EFATAL')) return 'EFATAL';
    return `${err?.code || 'UNKNOWN'}`;
}

function formatMainBotPollingError(err) {
    const code = err?.code || 'UNKNOWN';
    const rawMessage = String(err?.message || err || '').trim();
    const normalizedMessage = rawMessage
        .replace(/^(EFATAL:\s*)+/i, '')
        .replace(/^(Error:\s*)+/i, '')
        .replace(/^(EFATAL:\s*)+/i, '')
        .trim();
    return `${code}: ${normalizedMessage || 'unknown polling error'}`;
}

function isRecoverableMainBotPollingError(err) {
    if (!err) return false;
    if (isMainBotConflictError(err)) return false;
    const payload = `${err?.code || ''} ${err?.message || ''}`.toUpperCase();
    return MAIN_BOT_POLLING_RECOVERABLE_MARKERS.some((marker) => payload.includes(marker));
}

function shouldLogMainBotPollingError(err) {
    const key = getMainBotPollingErrorKey(err);
    const now = Date.now();
    const isSame = mainBotPollingRecovery.lastErrorKey === key;
    if (isSame && now - mainBotPollingRecovery.lastErrorLogAt < MAIN_BOT_POLLING_LOG_COOLDOWN_MS) return false;
    mainBotPollingRecovery.lastErrorKey = key;
    mainBotPollingRecovery.lastErrorLogAt = now;
    return true;
}

function shouldRecoverMainBotPolling() {
    const now = Date.now();
    const isWindowExpired = (now - mainBotPollingRecovery.lastRecoverableErrorAt) > MAIN_BOT_POLLING_RECOVERY_WINDOW_MS;
    if (isWindowExpired) {
        mainBotPollingRecovery.recoverableErrorBurst = 0;
    }

    mainBotPollingRecovery.recoverableErrorBurst += 1;
    mainBotPollingRecovery.lastRecoverableErrorAt = now;

    const inCooldown = (now - mainBotPollingRecovery.lastRecoveryAt) < MAIN_BOT_POLLING_RECOVERY_COOLDOWN_MS;
    if (inCooldown) {
        if ((now - mainBotPollingRecovery.lastRecoverySkipLogAt) > MAIN_BOT_POLLING_LOG_COOLDOWN_MS) {
            const remainMs = MAIN_BOT_POLLING_RECOVERY_COOLDOWN_MS - (now - mainBotPollingRecovery.lastRecoveryAt);
            console.warn(`[Main Bot] Polling recovery cooldown active (${Math.ceil(remainMs / 1000)}s left).`);
            mainBotPollingRecovery.lastRecoverySkipLogAt = now;
        }
        return false;
    }

    return mainBotPollingRecovery.recoverableErrorBurst >= MAIN_BOT_POLLING_RECOVERY_ERROR_THRESHOLD;
}

function scheduleMainBotPollingRecovery(bot, reason) {
    if (!bot || mainBotInstance !== bot) return;
    if (mainBotPollingRecovery.inProgress || mainBotPollingRecovery.timer) return;

    mainBotPollingRecovery.lastRecoveryAt = Date.now();
    mainBotPollingRecovery.recoverableErrorBurst = 0;
    mainBotPollingRecovery.attempt += 1;
    const attempt = mainBotPollingRecovery.attempt;
    const baseDelay = Math.min(30000, 2000 * (2 ** (attempt - 1)));
    const jitter = Math.floor(Math.random() * 1000);
    const delayMs = baseDelay + jitter;
    const reasonText = formatMainBotPollingError(reason);
    console.warn(`[Main Bot] Polling reconnect scheduled in ${delayMs}ms (attempt ${attempt}): ${reasonText}`);

    mainBotPollingRecovery.timer = setTimeout(async () => {
        mainBotPollingRecovery.timer = null;
        if (!bot || mainBotInstance !== bot) return;
        if (mainBotPollingRecovery.inProgress) return;

        mainBotPollingRecovery.inProgress = true;
        try {
            try {
                await bot.stopPolling();
            } catch (stopErr) {
                console.warn(`[Main Bot] stopPolling before reconnect ignored: ${stopErr.message}`);
            }

            await new Promise((resolve) => setTimeout(resolve, 300));
            await bot.startPolling(MAIN_BOT_POLLING_OPTIONS);
            console.log('[Main Bot] Polling reconnected successfully.');
            mainBotPollingRecovery.inProgress = false;
            mainBotPollingRecovery.attempt = Math.max(0, mainBotPollingRecovery.attempt - 1);
            mainBotPollingRecovery.lastErrorKey = '';
            mainBotPollingRecovery.lastErrorLogAt = 0;
            mainBotPollingRecovery.lastRecoverableErrorAt = 0;
            mainBotPollingRecovery.recoverableErrorBurst = 0;
            mainBotPollingRecovery.lastRecoverySkipLogAt = 0;
            return;
        } catch (reconnectErr) {
            console.error(`[Main Bot] Polling reconnect failed: ${formatMainBotPollingError(reconnectErr)}`);
            mainBotPollingRecovery.inProgress = false;
            scheduleMainBotPollingRecovery(bot, reconnectErr);
            return;
        }
    }, delayMs);
}
let isProcessing = false; // Lock để ngăn chặn các cuộc gọi đồng thời

// Lưu trạng thái hội thoại của người dùng
const userStates = {};
const depositCooldowns = {}; // Lưu thời gian tạo lệnh nạp gần nhất

// --- Dữ liệu FAQ ---
const faqData = [
    {
        id: 'faq_deposit',
        question: 'Làm sao để nạp tiền?',
        answer: 'Để nạp tiền, bạn vui lòng chọn mục "💰 Nạp tiền" trên menu chính hoặc gõ lệnh `/nap [số tiền]`. Hệ thống sẽ hướng dẫn bạn chuyển khoản.'
    },
    {
        id: 'faq_withdraw',
        question: 'Rút tiền bao lâu thì về?',
        answer: 'Thời gian xử lý rút tiền thường từ 5-15 phút. Nếu quá 30 phút chưa nhận được, vui lòng liên hệ Admin.'
    },
    {
        id: 'faq_game',
        question: 'Luật chơi game?',
        answer: 'Kết quả dựa trên tổng điểm 3 xúc xắc:\n- 4-10 điểm: Xỉu\n- 11-17 điểm: Tài\n- 3 hoặc 18 điểm: Nổ hũ (Thưởng lớn).'
    },
    {
        id: 'faq_contact',
        question: 'Liên hệ hỗ trợ?',
        answer: 'Bạn có thể chat trực tiếp với Admin qua tài khoản: @AdminUser (Vui lòng thay bằng user thật).'
    }
];

// --- Bàn phím Menu Chính ---
const mainMenuKeyboard = {
    keyboard: [
        [
            { text: '🎮 Danh sách Game' },
            { text: '👤 Tài Khoản' }
        ],
        [
            { text: '💰 Nạp Tiền' },
            { text: '💸 Rút Tiền' }
        ],
        [
            { text: '🎉 Sự Kiện' },
            { text: '🏆 Bảng Xếp Hạng' }
        ],
        [
            { text: '🤝 Giới Thiệu Bạn Bè' },
            { text: '🌹 Hoa hồng' }
        ],
        [
            { text: '📞 Liên Hệ CSKH' }
        ]
    ],
    resize_keyboard: true,
    one_time_keyboard: false,
    is_persistent: true,
};

const DEFAULT_START_WELCOME_NEW_USER_MESSAGE = '👋 Chao mung <b>{username}</b>!\nTai khoan da duoc tao.\nID: <code>{userId}</code>\nToken: <code>{token}</code>\n\nChon mot chuc nang ben duoi de bat dau:';
const DEFAULT_START_WELCOME_RETURNING_MESSAGE = '👋 Chao mung tro lai, <b>{username}</b>!\n\nBan muon thuc hien tac vu nao?';
const START_TEMPLATE_TOKEN_REGEX = /\{(username|userId|token|balance)\}/gi;

function escapeHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function isValidHttpUrl(url) {
    return /^https?:\/\//i.test(String(url || '').trim());
}

function renderStartTemplate(template, context = {}) {
    const source = String(template || '').trim();
    return source.replace(START_TEMPLATE_TOKEN_REGEX, (_match, key) => {
        if (!(key in context)) return '';
        return escapeHtml(context[key]);
    });
}

async function sendStartGreeting(bot, chatId, messageText, imageUrl) {
    const text = String(messageText || '').trim();
    const fallbackText = 'Chon mot chuc nang ben duoi de bat dau:';
    const displayText = text || fallbackText;
    const trimmedImageUrl = String(imageUrl || '').trim();
    const commonPayload = {
        parse_mode: 'HTML',
        reply_markup: mainMenuKeyboard,
    };
    let sentPhoto = false;

    if (displayText && isValidHttpUrl(trimmedImageUrl)) {
        try {
            await bot.sendPhoto(chatId, trimmedImageUrl, { ...commonPayload, caption: displayText });
            sentPhoto = true;
        } catch (error) {
            console.error('[Main Bot] Start welcome image send failed:', error.message);
        }
    }

    if (!sentPhoto) {
        try {
            await bot.sendMessage(chatId, displayText, commonPayload);
            return;
        } catch (error) {
            await bot.sendMessage(chatId, displayText, { reply_markup: mainMenuKeyboard }).catch(() => {});
            return;
        }
    }

    // Bat buoc gui them 1 tin text de Telegram hien keyboard on dinh.
    await bot.sendMessage(chatId, '👇 Menu chuc nang:', { reply_markup: mainMenuKeyboard }).catch(() => {});
}

// Daily checkin logic
const DAILY_CHECKIN_BASE_REWARD = 10000;
const DAILY_CHECKIN_STREAK_STEP_REWARD = 2000;
const DAILY_CHECKIN_STREAK_CAP = 7;
const DAILY_CHECKIN_HISTORY_LIMIT = 120;

function getVnDateKey(date = new Date()) {
    const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Ho_Chi_Minh',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    });
    return formatter.format(date);
}

function shiftVnDateKey(dateKey, deltaDays) {
    const baseDate = new Date(`${dateKey}T00:00:00+07:00`);
    baseDate.setUTCDate(baseDate.getUTCDate() + deltaDays);
    return getVnDateKey(baseDate);
}

function calculateCheckinStreak(checkinList = [], todayKey = getVnDateKey()) {
    const set = new Set((Array.isArray(checkinList) ? checkinList : []).map((item) => String(item)));
    let streak = 0;
    let cursor = todayKey;
    while (set.has(cursor)) {
        streak += 1;
        cursor = shiftVnDateKey(cursor, -1);
    }
    return streak;
}

async function handleDailyCheckin(bot, msg) {
    const userId = msg?.from?.id;
    const chatId = msg?.chat?.id;
    if (!userId || !chatId) return;

    const settings = await getMainBotSettings();
    if (settings && settings.maintenanceSystem) {
        await bot.sendMessage(chatId, 'He thong dang bao tri. Vui long quay lai sau.');
        return;
    }

    const account = await Account.findOne({ userId });
    if (!account) {
        await bot.sendMessage(chatId, 'Ban chua co tai khoan. Go /start de dang ky.');
        return;
    }
    if (account.status === 0) {
        await bot.sendMessage(chatId, 'Tai khoan cua ban da bi khoa.');
        return;
    }

    const todayKey = getVnDateKey();
    const rawHistory = Array.isArray(account.dailyCheckin) ? account.dailyCheckin : [];
    const normalizedHistory = [...new Set(
        rawHistory
            .map((item) => String(item || '').trim())
            .filter((item) => /^\d{4}-\d{2}-\d{2}$/.test(item)),
    )].sort();

    if (normalizedHistory.includes(todayKey)) {
        const streak = calculateCheckinStreak(normalizedHistory, todayKey);
        await bot.sendMessage(
            chatId,
            `Ban da diem danh hom nay.\n\nChuoi hien tai: ${streak} ngay\nSo du: ${Number(account.balance || 0).toLocaleString()} VND`,
        );
        return;
    }

    const newHistory = [...normalizedHistory, todayKey].slice(-DAILY_CHECKIN_HISTORY_LIMIT);
    const streak = calculateCheckinStreak(newHistory, todayKey);
    const streakBonus = Math.min(DAILY_CHECKIN_STREAK_CAP - 1, Math.max(0, streak - 1)) * DAILY_CHECKIN_STREAK_STEP_REWARD;
    const reward = DAILY_CHECKIN_BASE_REWARD + streakBonus;

    const oldBalance = Number(account.balance || 0);
    account.balance = oldBalance + reward;
    account.dailyCheckin = newHistory;
    await account.save();

    await CheckinHistory.create({
        userId,
        reward,
        date: new Date(),
    });

    await Transaction.create({
        userId,
        amount: reward,
        action: 'add',
        oldBalance,
        newBalance: account.balance,
        description: `Diem danh hang ngay ${todayKey}`,
    });

    await bot.sendMessage(
        chatId,
        `Diem danh thanh cong.\n\nThuong hom nay: ${reward.toLocaleString()} VND\nChuoi: ${streak} ngay\nSo du moi: ${Number(account.balance || 0).toLocaleString()} VND`,
    );
}
/**
 * Khởi chạy hoặc cập nhật Bot Chính (Main Bot)
 */
async function startMainBot(botConfig) {
    if (isProcessing) {
        console.warn('[Main Bot] Yêu cầu bị bỏ qua vì đang có một tiến trình khác.');
        return;
    }
    isProcessing = true;

    try {
        // --- Logic để DỪNG bot ---
        if (!botConfig || botConfig.status !== 1) {
            resetMainBotPollingRecovery();
            if (mainBotInstance) {
                console.log(`[Main Bot] Bot '${botConfig?.name || 'Main'}' đang được tắt...`);
                // 1. Gỡ bỏ toàn bộ listener để không xử lý tin nhắn mới
                resetMainBotPollingRecovery();
                mainBotInstance.removeAllListeners();
                // 2. Dừng polling ngay lập tức
                try {
                    await mainBotInstance.stopPolling();
                } catch (err) {
                    console.warn(`[Main Bot] stopPolling ignored error: ${err.message}`);
                }
                // 3. (Tùy chọn) Đóng kết nối nếu có
                if (mainBotInstance.close) { try { await mainBotInstance.close(); } catch(e) {} }
                
                mainBotInstance = null;
                console.log(`[Main Bot] Bot đã được dừng.`);
            }
            return;
        }

        // --- Logic để BẬT hoặc KHỞI ĐỘNG LẠI bot ---
        if (!botConfig.token) {
            console.error('[Main Bot] Thiếu token để khởi chạy.');
            return;
        }

        // Dừng instance cũ nếu nó đang tồn tại
        if (mainBotInstance) {
            console.log('[Main Bot] Đang khởi động lại... Dừng instance cũ.');
            // 1. Gỡ bỏ toàn bộ listener
            resetMainBotPollingRecovery();
            mainBotInstance.removeAllListeners();
            // 2. Dừng polling
            try {
                await mainBotInstance.stopPolling();
            } catch (err) {
                console.warn(`[Main Bot] stopPolling ignored error: ${err.message}`);
            }
            // 3. Đóng kết nối
            if (mainBotInstance.close) { try { await mainBotInstance.close(); } catch(e) {} }

            mainBotInstance = null; // Đảm bảo biến được xóa
            
            // Đợi 2 giây để Telegram Server cập nhật trạng thái ngắt kết nối
            await new Promise(resolve => setTimeout(resolve, 2000));
        }

        console.log(`[Main Bot] Bot '${botConfig.name}' đang khởi tạo...`);
        // Khởi tạo với polling: false để kiểm soát thủ công
        const bot = new TelegramBot(botConfig.token, { polling: false });

        // Kiểm tra kết nối ngay khi khởi chạy
        // Xóa webhook (nếu có) để đảm bảo polling hoạt động trơn tru
        await bot.getMe(); // Cần gọi getMe trước khi có thể dùng các hàm khác
        await bot.deleteWebHook();
        
        // Bắt đầu polling thủ công sau khi đã dọn dẹp xong
        await bot.startPolling(MAIN_BOT_POLLING_OPTIONS);

        const me = await bot.getMe();
        console.log(`✅ [Main Bot] Kết nối thành công: @${me.username}`);

        // Gán vào biến toàn cục sau khi đã chắc chắn kết nối thành công
        mainBotInstance = bot;
        resetMainBotPollingRecovery();

        // Lệnh /start hoặc /menu
        bot.onText(/^\/(start|menu)(?:\s+(.+))?$/i, async (msg, match) => {
            const userId = msg.from.id;
            const username = msg.from.first_name || 'Người dùng';
            const command = match[1].toLowerCase();
            const refId = match[2] ? parseInt(match[2]) : null; // Lấy ID người giới thiệu từ link start

            try {
                const settings = await getMainBotSettings();
                if (settings && settings.maintenanceSystem) {
                    return bot.sendMessage(msg.chat.id, '⚠️ <b>HỆ THỐNG ĐANG BẢO TRÌ NÂNG CẤP</b>\n\nVui lòng quay lại sau.', { parse_mode: 'HTML' });
                }

                let account = await Account.findOne({ userId });
                if (account && account.status === 0) return bot.sendMessage(msg.chat.id, '🚫 Tài khoản của bạn đã bị khóa.');

                const welcomeImageUrl = String(settings?.startWelcomeImage || '').trim();
                if (!account) {
                    const token = crypto.randomBytes(32).toString('hex');
                    const newAccountData = { userId, balance: 0, status: 1, token };

                    // Xử lý giới thiệu
                    if (command === 'start' && refId && refId !== userId) {
                        const referrer = await Account.findOne({ userId: refId });
                        if (referrer) {
                            newAccountData.invitedBy = refId;
                            await Account.findOneAndUpdate({ userId: refId }, { $inc: { ref: 1 } }); // Tăng số lượng ref cho người mời
                        }
                    }

                    await Account.create(newAccountData);
                    const context = {
                        username,
                        userId,
                        token,
                        balance: 0,
                    };
                    const template = settings?.startWelcomeNewUserMessage || DEFAULT_START_WELCOME_NEW_USER_MESSAGE;
                    const welcomeText = renderStartTemplate(template, context)
                        || renderStartTemplate(DEFAULT_START_WELCOME_NEW_USER_MESSAGE, context);
                    await sendStartGreeting(bot, msg.chat.id, welcomeText, welcomeImageUrl);
                } else {
                    if (!account.token) {
                        account.token = crypto.randomBytes(32).toString('hex');
                        await account.save();
                    }
                    const context = {
                        username,
                        userId,
                        token: account.token,
                        balance: Number(account.balance || 0).toLocaleString('vi-VN'),
                    };
                    const template = settings?.startWelcomeReturningMessage || DEFAULT_START_WELCOME_RETURNING_MESSAGE;
                    const welcomeText = renderStartTemplate(template, context)
                        || renderStartTemplate(DEFAULT_START_WELCOME_RETURNING_MESSAGE, context);
                    await sendStartGreeting(bot, msg.chat.id, welcomeText, welcomeImageUrl);
                }
            } catch (err) { console.error(err); }
        });

        // Lệnh /diemdanh hoặc /checkin
        bot.onText(/^\/(diemdanh|checkin)(?:@\w+)?$/i, async (msg) => {
            try {
                await handleDailyCheckin(bot, msg);
            } catch (err) {
                console.error('[Daily Checkin Error]', err);
                await bot.sendMessage(msg.chat.id, 'Co loi xay ra khi diem danh. Vui long thu lai sau.');
            }
        });

        bot.onText(/^(?:✅\s*)?Diem\s*Danh$/i, async (msg) => {
            try {
                await handleDailyCheckin(bot, msg);
            } catch (err) {
                console.error('[Daily Checkin Text Error]', err);
                await bot.sendMessage(msg.chat.id, 'Co loi xay ra khi diem danh. Vui long thu lai sau.');
            }
        });

        bot.onText(/\/info/, async (msg) => {
            const userId = msg.from.id;
            try {
                const settings = await getMainBotSettings();
                if (settings && settings.maintenanceSystem) {
                    return bot.sendMessage(msg.chat.id, '⚠️ <b>HỆ THỐNG ĐANG BẢO TRÌ NÂNG CẤP</b>\n\nVui lòng quay lại sau.', { parse_mode: 'HTML' });
                }
                const account = await Account.findOne({ userId });
                if (!account) return bot.sendMessage(msg.chat.id, "❌ Bạn chưa đăng ký. Gõ /start.");
                if (account.status === 0) return bot.sendMessage(msg.chat.id, '🚫 Tài khoản của bạn đã bị khóa.');
                bot.sendMessage(msg.chat.id, `📊 <b>THÔNG TIN</b>\n🆔 ID: <code>${account.userId}</code>\n💰 Số dư: <b>${account.balance.toLocaleString()} ₫</b>`, { parse_mode: 'HTML' });
            } catch (err) { console.error(err); }
        });

        // Lệnh /nap [số tiền]
        bot.onText(/\/nap (\d+)/, async (msg, match) => {
            const amount = parseInt(match[1]);
            const userId = msg.from.id;

            // Chống spam: Giới hạn 30s/lần
            const lastTime = depositCooldowns[userId] || 0;
            const now = Date.now();
            if (now - lastTime < 30000) {
                return bot.sendMessage(msg.chat.id, `⏳ Bạn thao tác quá nhanh. Vui lòng đợi ${Math.ceil((30000 - (now - lastTime)) / 1000)}s.`);
            }
            depositCooldowns[userId] = now;

            const settings = await getMainBotSettings();
            if (settings && settings.maintenanceSystem) {
                return bot.sendMessage(msg.chat.id, '⚠️ <b>HỆ THỐNG ĐANG BẢO TRÌ NÂNG CẤP</b>\n\nVui lòng quay lại sau.', { parse_mode: 'HTML' });
            }
            if (settings && settings.maintenanceDeposit) {
                return bot.sendMessage(msg.chat.id, '❌ Hệ thống nạp tiền đang bảo trì. Vui lòng quay lại sau.');
            }

            const account = await Account.findOne({ userId });
            if (account && account.status === 0) return bot.sendMessage(msg.chat.id, '🚫 Tài khoản của bạn đã bị khóa.');

            const minDeposit = settings?.minDeposit || 10000;
            const maxDeposit = settings?.maxDeposit || 500000000;

            if (amount < minDeposit) return bot.sendMessage(msg.chat.id, `❌ Tối thiểu ${minDeposit.toLocaleString()} ₫`);
            if (amount > maxDeposit) return bot.sendMessage(msg.chat.id, `❌ Tối đa ${maxDeposit.toLocaleString()} ₫`);

            try {
                await Deposit.create({ userId: msg.from.id, amount, method: 'Bot', status: 0 });
                bot.sendMessage(msg.chat.id, `✅ Đã gửi yêu cầu nạp <b>${amount.toLocaleString()} ₫</b>.`, { parse_mode: 'HTML' });
            } catch (err) { console.error(err); }
        });

        // Lệnh /rut [số tiền] [ngân hàng] [stk] [tên]
        bot.onText(/\/rut (\d+) (.+) (.+) (.+)/, async (msg, match) => {
            const amount = parseInt(match[1]);
            const userId = msg.from.id;
            try {
                const settings = await getMainBotSettings();
                if (settings && settings.maintenanceSystem) {
                    return bot.sendMessage(msg.chat.id, '⚠️ <b>HỆ THỐNG ĐANG BẢO TRÌ NÂNG CẤP</b>\n\nVui lòng quay lại sau.', { parse_mode: 'HTML' });
                }
                if (settings && settings.maintenanceWithdraw) {
                    return bot.sendMessage(msg.chat.id, '❌ Hệ thống rút tiền đang bảo trì. Vui lòng quay lại sau.');
                }

                const maxWithdrawals = settings?.maxWithdrawalsPerDay || 3;
                const startOfDay = new Date();
                startOfDay.setHours(0, 0, 0, 0);
                const withdrawalCount = await Withdraw.countDocuments({
                    userId,
                    createdAt: { $gte: startOfDay }
                });

                if (withdrawalCount >= maxWithdrawals) return bot.sendMessage(msg.chat.id, `❌ Bạn đã đạt giới hạn rút tiền trong ngày (${maxWithdrawals} lần).`);

                const account = await Account.findOne({ userId });
                if (account && account.status === 0) return bot.sendMessage(msg.chat.id, '🚫 Tài khoản của bạn đã bị khóa.');
                
                // Kiểm tra vòng cược
                const wageringReq = settings?.withdrawWageringReq || 1;
                const requiredBet = (account.totalDeposit || 0) * wageringReq;
                if ((account.totalBet || 0) < requiredBet) {
                     return bot.sendMessage(msg.chat.id, `❌ <b>CHƯA ĐỦ VÒNG CƯỢC</b>\n\n- Yêu cầu cược: <b>${requiredBet.toLocaleString()}đ</b>\n- Đã cược: <b>${(account.totalBet || 0).toLocaleString()}đ</b>`, { parse_mode: 'HTML' });
                }

                if (!account || account.balance < amount) return bot.sendMessage(msg.chat.id, "❌ Số dư không đủ.");
                await Withdraw.create({ userId, amount, bankName: match[2], accountNumber: match[3], accountName: match[4], status: 0 });
                account.balance -= amount;
                await account.save();
                bot.sendMessage(msg.chat.id, `✅ Đã gửi yêu cầu rút <b>${amount.toLocaleString()} ₫</b>.`, { parse_mode: 'HTML' });
            } catch (err) { console.error(err); }
        });

        // Lệnh /gift [code]
        bot.onText(/\/gift (.+)/, async (msg, match) => {
            const userId = msg.from.id;
            const code = match[1].trim();
            
            // Chống spam
            const lastTime = depositCooldowns[userId] || 0;
            const now = Date.now();
            if (now - lastTime < 3000) {
                return bot.sendMessage(msg.chat.id, `⏳ Vui lòng thao tác chậm lại.`);
            }
            depositCooldowns[userId] = now;

            try {
                const settings = await getMainBotSettings();
                if (settings && settings.maintenanceSystem) {
                    return bot.sendMessage(msg.chat.id, '⚠️ <b>HỆ THỐNG ĐANG BẢO TRÌ</b>', { parse_mode: 'HTML' });
                }

                const account = await Account.findOne({ userId });
                if (account && account.status === 0) return bot.sendMessage(msg.chat.id, '🚫 Tài khoản của bạn đã bị khóa.');
                if (!account) return bot.sendMessage(msg.chat.id, '❌ Bạn chưa có tài khoản. Gõ /start để tạo.');

                // Tìm và cập nhật Giftcode (Atomic check & update)
                const giftcode = await Giftcode.findOneAndUpdate(
                    { 
                        code: code, 
                        status: 1,
                        $or: [
                            { usageLimit: { $lte: 0 } }, // Không giới hạn
                            { $expr: { $lt: ["$usedCount", "$usageLimit"] } } // Còn lượt
                        ],
                        usedBy: { $ne: String(userId) } // Chưa dùng
                    },
                    { 
                        $inc: { usedCount: 1 },
                        $push: { usedBy: String(userId) }
                    },
                    { new: true }
                );

                if (!giftcode) {
                    return bot.sendMessage(msg.chat.id, '❌ Mã Code không tồn tại, đã hết hạn, hết lượt hoặc bạn đã sử dụng.');
                }

                // Cộng tiền
                const amount = giftcode.amount;
                const oldBalance = account.balance;
                account.balance += amount;
                await account.save();

                // Tự động khóa nếu hết lượt (Double check)
                if (giftcode.usageLimit > 0 && giftcode.usedCount >= giftcode.usageLimit) {
                    await Giftcode.findByIdAndUpdate(giftcode._id, { status: 0 });
                }

                // Lưu lịch sử biến động
                await Transaction.create({
                    userId,
                    amount,
                    action: 'add',
                    oldBalance,
                    newBalance: account.balance,
                    description: `Giftcode: ${code}`
                });

                await bot.sendMessage(msg.chat.id, `✅ <b>NHẬP CODE THÀNH CÔNG</b>\n\n🎁 Phần thưởng: <b>${amount.toLocaleString()} VNĐ</b>\n💰 Số dư mới: <b>${account.balance.toLocaleString()} VNĐ</b>`, { parse_mode: 'HTML' });

            } catch (err) {
                console.error('[Giftcode Error]', err);
                bot.sendMessage(msg.chat.id, '❌ Có lỗi xảy ra khi nhập Code.');
            }
        });

        // Lệnh /muaGiftCode [số lượng] [số tiền]
        bot.onText(/\/muaGiftCode (\d+) (\d+)/, async (msg, match) => {
            const userId = msg.from.id;
            const quantity = parseInt(match[1]);
            const amountPerCode = parseInt(match[2]);

            // Chống spam
            const lastTime = depositCooldowns[userId] || 0;
            const now = Date.now();
            if (now - lastTime < 3000) {
                return bot.sendMessage(msg.chat.id, `⏳ Vui lòng thao tác chậm lại.`);
            }
            depositCooldowns[userId] = now;

            if (quantity <= 0 || amountPerCode <= 0) {
                return bot.sendMessage(userId, '❌ Số lượng và số tiền phải lớn hơn 0.');
            }
            
            if (quantity > 50) {
                 return bot.sendMessage(userId, '❌ Chỉ được mua tối đa 50 Giftcode mỗi lần.');
            }

            try {
                const settings = await getMainBotSettings();
                if (settings && settings.maintenanceSystem) {
                    return bot.sendMessage(userId, '⚠️ <b>HỆ THỐNG ĐANG BẢO TRÌ</b>', { parse_mode: 'HTML' });
                }

                const account = await Account.findOne({ userId });
                if (account && account.status === 0) return bot.sendMessage(userId, '🚫 Tài khoản của bạn đã bị khóa.');
                if (!account) return bot.sendMessage(userId, '❌ Bạn chưa có tài khoản. Gõ /start để tạo.');

                const totalValue = quantity * amountPerCode;
                const feePercent = 15; // Phí 15%
                const fee = Math.ceil(totalValue * feePercent / 100);
                const totalCost = totalValue + fee;

                if (account.balance < totalCost) {
                    return bot.sendMessage(userId, `❌ <b>SỐ DƯ KHÔNG ĐỦ</b>\n\n💰 Tổng giá trị: ${totalValue.toLocaleString()}đ\n💸 Phí mua (15%): ${fee.toLocaleString()}đ\n💵 Tổng thanh toán: <b>${totalCost.toLocaleString()}đ</b>\n💰 Số dư hiện tại: ${account.balance.toLocaleString()}đ`, { parse_mode: 'HTML' });
                }

                // Trừ tiền (Sử dụng findOneAndUpdate để đảm bảo an toàn)
                const updatedAccount = await Account.findOneAndUpdate(
                    { userId: userId, balance: { $gte: totalCost } },
                    { $inc: { balance: -totalCost } },
                    { new: true }
                );

                if (!updatedAccount) {
                     return bot.sendMessage(userId, '❌ Giao dịch thất bại. Số dư không đủ hoặc có lỗi xảy ra.');
                }

                // Tạo Giftcode hàng loạt
                const codes = [];
                const bulkOps = [];
                
                for (let i = 0; i < quantity; i++) {
                    const randomStr = Math.random().toString(36).substring(2, 10).toUpperCase();
                    const code = `GIFT-${randomStr}`;
                    codes.push(code);
                    
                    bulkOps.push({
                        code: code,
                        amount: amountPerCode,
                        usageLimit: 1,
                        usedCount: 0,
                        status: 1,
                        date: new Date()
                    });
                }
                
                await Giftcode.insertMany(bulkOps);

                // Lưu lịch sử giao dịch
                await Transaction.create({
                    userId,
                    amount: totalCost,
                    action: 'subtract',
                    oldBalance: updatedAccount.balance + totalCost,
                    newBalance: updatedAccount.balance,
                    description: `Mua ${quantity} Giftcode (${amountPerCode.toLocaleString()}đ/code)`
                });

                let msgContent = `✅ <b>MUA GIFTCODE THÀNH CÔNG</b>\n\n`;
                msgContent += `📦 Số lượng: <b>${quantity}</b>\n`;
                msgContent += `💰 Trị giá: <b>${amountPerCode.toLocaleString()}đ</b>/code\n`;
                msgContent += `💸 Phí (15%): <b>${fee.toLocaleString()}đ</b>\n`;
                msgContent += `💵 Tổng trừ: <b>${totalCost.toLocaleString()}đ</b>\n\n`;
                msgContent += `👇 <b>Danh sách mã của bạn:</b>\n`;
                
                codes.forEach(c => {
                    msgContent += `<code>${c}</code>\n`;
                });

                await bot.sendMessage(userId, msgContent, { parse_mode: 'HTML' });

            } catch (err) {
                console.error('[Buy Giftcode Error]', err);
                bot.sendMessage(userId, '❌ Có lỗi xảy ra khi mua Giftcode.');
            }
        });

        // --- GAME CHẴN LẺ TELEGRAM (Timeticks) ---
        // Cú pháp: C [tiền] hoặc L [tiền]
        bot.onText(/^([CcLl])\s+(\d+)$/, async (msg, match) => {
            const userId = msg.from.id;
            const chatId = msg.chat.id;
            const type = match[1].toUpperCase(); // C hoặc L
            const amount = parseInt(match[2]);
            const username = msg.from.first_name || 'Người chơi';

            await processEvenOddBet(bot, chatId, userId, username, type, amount, msg.message_id);
        });

        // --- GAME TÀI XỈU TELEGRAM (Timeticks) ---
        // Cú pháp: T [tiền] hoặc X [tiền]
        bot.onText(/^([TtXx])\s+(\d+)$/, async (msg, match) => {
            const userId = msg.from.id;
            const chatId = msg.chat.id;
            const type = match[1].toUpperCase(); // T hoặc X
            const amount = parseInt(match[2]);
            const username = msg.from.first_name || 'Người chơi';

            await processTaiXiuBet(bot, chatId, userId, username, type, amount, msg.message_id);
        });

        // --- GAME XÚC XẮC TELEGRAM (Dice) ---
        // Cú pháp: XXC, XXL, XXT, XXX, D1-D6 [tiền]
        bot.onText(/^(XXC|XXL|XXT|XXX|D[1-6])\s+(\d+)$/i, async (msg, match) => {
            const userId = msg.from.id;
            const chatId = msg.chat.id;
            const type = match[1].toUpperCase();
            const amount = parseInt(match[2]);
            const username = msg.from.first_name || 'Người chơi';

            await processDiceBet(bot, chatId, userId, username, type, amount, msg.message_id);
        });

        // --- Xử lý hội thoại từng bước ---
        bot.on('message', async (msg) => {
            const userId = msg.from.id;
            const state = userStates[userId];

            // Check Ban
            const accCheck = await Account.findOne({ userId });
            if (accCheck && accCheck.status === 0) {
                // Chỉ phản hồi nếu không phải là lệnh (để tránh double reply với onText)
                if (!msg.text || !msg.text.startsWith('/')) return bot.sendMessage(userId, '🚫 Tài khoản của bạn đã bị khóa.');
                return;
            }

            // --- GAME SLOT TELEGRAM (User gửi emoji 🎰) ---
            if (msg.dice && msg.dice.emoji === 'ðŸŽ°') {
                const chatId = msg.chat.id;
                const username = msg.from.first_name || 'Người chơi';
                

                try {
                    // 1. Kiểm tra bảo trì hệ thống
                    const settings = await getMainBotSettings();
                    if (settings && settings.maintenanceSystem) {
                        return bot.sendMessage(chatId, '⚠️ <b>HỆ THỐNG ĐANG BẢO TRÌ</b>', { parse_mode: 'HTML' });
                    }

                    const amount = settings?.minBetSlot || 1000; // Phí chơi lấy từ cài đặt

                    // 2. Kiểm tra số dư
                    const account = await Account.findOne({ userId });
                    if (!account || account.balance < amount) {
                        return bot.sendMessage(chatId, `❌ Số dư không đủ (Cần ${amount.toLocaleString()}đ).`, { reply_to_message_id: msg.message_id });
                    }

                    // 3. Trừ tiền & Ghi nhận cược
                    account.balance -= amount;
                    account.totalBet = (account.totalBet || 0) + amount;
                    await account.save();

                    // 4. Xử lý kết quả (Telegram Dice Value: 1-64)
                    const value = msg.dice.value;
                    let winAmount = 0;
                    let resultText = '';
                    let isWin = false;

                    // Mapping giá trị thắng của Slot Machine Telegram
                    if (value === 1) { // 3 Bar
                        winAmount = 15000;
                        resultText = '🎰 <b>3 BAR - TRÚNG 15.000đ</b>';
                        isWin = true;
                    } else if (value === 22) { // 3 Nho (Grapes)
                        winAmount = 10000;
                        resultText = '🍇 <b>3 NHO - TRÚNG 10.000đ</b>';
                        isWin = true;
                    } else if (value === 43) { // 3 Chanh (Lemon)
                        winAmount = 10000;
                        resultText = '🍋 <b>3 CHANH - TRÚNG 10.000đ</b>';
                        isWin = true;
                    } else if (value === 64) { // 3 Số 7 (Jackpot)
                        winAmount = 25000;
                        resultText = '🔥 <b>JACKPOT 777 - TRÚNG 25.000đ</b>';
                        isWin = true;
                    } else {
                        resultText = '💔 <b>CHÚC MAY MẮN LẦN SAU</b>';
                    }

                    if (isWin) {
                        account.balance += winAmount;
                        await account.save();
                        resultText = `ðŸŽ‰ ${resultText}`;
                    }

                    // Lưu lịch sử
                    try {
                        await MiniGameHistory.create({
                            game: 'slot_tele', userId, username,
                            betType: 'SPIN', betAmount: amount, winAmount,
                            date: new Date()
                        });
                    } catch (e) {
                        console.error('Lỗi lưu lịch sử Slot:', e);
                    }

                    // 5. Phản hồi
                    const responseMsg = `ðŸŽ° <b>SLOT TELEGRAM</b> ðŸŽ°\n` +
                        `➖➖➖➖➖➖➖➖➖➖\n` +
                        `👤 Người chơi: <b>${username}</b>\n` +
                        `💰 Phí chơi: <b>${amount.toLocaleString()}đ</b>\n` +
                        `🎰 Kết quả: <b>${value}</b>\n` +
                        `➖➖➖➖➖➖➖➖➖➖\n` +
                        `${resultText}\n` +
                        `💰 Số dư: <b>${account.balance.toLocaleString()}đ</b>`;

                    // Delay 2s để đợi animation quay xong
                    await new Promise((resolve) => setTimeout(resolve, MAIN_BOT_SLOT_RESULT_DELAY_MS));
                    
                    await bot.sendMessage(chatId, responseMsg, { 
                        parse_mode: 'HTML', 
                        reply_to_message_id: msg.message_id 
                    });

                } catch (err) {
                    console.error('[Slot Game Error]', err);
                }
                return;
            }

            // Kiểm tra bảo trì hệ thống (trừ các lệnh bắt đầu bằng / vì đã xử lý ở onText)
            if (msg.text && !msg.text.startsWith('/')) {
                const settings = await getMainBotSettings();
                if (settings && settings.maintenanceSystem) {
                    return bot.sendMessage(userId, '⚠️ <b>HỆ THỐNG ĐANG BẢO TRÌ NÂNG CẤP</b>\n\nVui lòng quay lại sau.', { parse_mode: 'HTML' });
                }
            }

            // Nếu đang trong quy trình rút tiền, chuyển cho WithdrawHandler xử lý
            if (state && state.type === 'withdraw') {
                await WithdrawHandler.handleStep(bot, msg, userStates);
                return;
            }

            // --- Xử lý quy trình Két sắt (Thêm đoạn này) ---
            if (state && state.type && state.type.startsWith('safe_')) {
                await SafeHandler.handleStep(bot, msg, userStates);
                return;
            }
            
            // --- Xử lý quy trình nạp thẻ cào ---
            if (state && state.type.startsWith('deposit_card_')) {
                const text = msg.text.trim();
                
                if (state.type === 'deposit_card_amount') {
                    const amount = parseInt(text.replace(/[^0-9]/g, ''));
                    if (isNaN(amount) || amount <= 0) {
                         return bot.sendMessage(userId, '❌ Mệnh giá không hợp lệ. Vui lòng nhập lại (chỉ nhập số).');
                    }
                    userStates[userId] = { ...state, amount: amount, type: 'deposit_card_serial' };
                    await bot.sendMessage(userId, '🔢 Vui lòng nhập <b>Số Serial</b> thẻ:', { parse_mode: 'HTML' });
                    return;
                }
            
                if (state.type === 'deposit_card_serial') {
                    userStates[userId] = { ...state, serial: text, type: 'deposit_card_code' };
                    await bot.sendMessage(userId, '🔢 Vui lòng nhập <b>Mã Thẻ (Mã nạp)</b>:', { parse_mode: 'HTML' });
                    return;
                }
            
                if (state.type === 'deposit_card_code') {
                    const code = text;
                    const { telco, amount, serial } = state;
                    
                    // Clear state
                    delete userStates[userId];
            
                    await bot.sendMessage(userId, '⏳ Đang xử lý thẻ nạp, vui lòng đợi...');
            
                    const result = await processCardDeposit(userId, telco, code, serial, amount);
                    
                    if (result.success) {
                         const status = result.data && result.data.status ? parseInt(result.data.status) : 99;
                         
                         if (status === 1) {
                              await bot.sendMessage(userId, `✅ <b>NẠP THẺ THÀNH CÔNG</b>\n\nNhà mạng: ${telco}\nMệnh giá: ${amount.toLocaleString()} VNĐ\n\n💰 Tiền đã được cộng vào tài khoản.`, { parse_mode: 'HTML' });
                         } else if (status === 2) {
                              const realAmount = result.data.value || 0;
                              await bot.sendMessage(userId, `⚠️ <b>NẠP THẺ THÀNH CÔNG (SAI MỆNH GIÁ)</b>\n\nNhà mạng: ${telco}\nMệnh giá gửi: ${amount.toLocaleString()} VNĐ\nThực nhận: ${parseInt(realAmount).toLocaleString()} VNĐ\n\n💰 Đã cộng tiền thực nhận vào tài khoản.`, { parse_mode: 'HTML' });
                         } else {
                              await bot.sendMessage(userId, `✅ <b>GỬI YÊU CẦU THÀNH CÔNG</b>\n\nNhà mạng: ${telco}\nMệnh giá: ${amount.toLocaleString()}\nSerial: ${serial}\nMã thẻ: ${code}\n\nHệ thống đang kiểm tra thẻ. Tiền sẽ được cộng sau 1-2 phút nếu thẻ đúng.`, { parse_mode: 'HTML' });
                         }
                    } else {
                         await bot.sendMessage(userId, `❌ <b>LỖI NẠP THẺ</b>\n\n${result.message}`, { parse_mode: 'HTML' });
                    }
                    return;
                }
            }

            // --- Xử lý nhập số tiền nạp tùy chỉnh ---
            if (state && (state.type === 'deposit_banking_custom' || state.type === 'deposit_zalopay_custom')) {
                const text = msg.text.replace(/[^0-9]/g, '');
                const amount = parseInt(text);
                
                if (isNaN(amount) || amount <= 0) {
                    await bot.sendMessage(userId, '❌ Số tiền không hợp lệ. Vui lòng nhập lại (chỉ nhập số).');
                    return;
                }

                const type = state.type;
                delete userStates[userId]; // Xóa trạng thái

                if (type === 'deposit_banking_custom') {
                    await provideBankInfo(bot, userId, amount);
                } else {
                    await provideZaloPayInfo(bot, userId, amount);
                }
                return;
            }

            // --- Xử lý Menu Reply Keyboard (Ưu tiên) ---
            const text = msg.text;
            
            switch (text) {
                case '🎮 Danh sách Game': await GameListHandler.show(bot, msg); break;
                case '👤 Tài Khoản': await AccountHandler.show(bot, msg); break;
                case '💰 Nạp Tiền': 
                    {
                        const settings = await getMainBotSettings();
                        if (settings && settings.maintenanceDeposit) {
                            await bot.sendMessage(userId, '❌ Hệ thống nạp tiền đang bảo trì. Vui lòng quay lại sau.');
                            break;
                        }
                        await DepositHandler.show(bot, msg); 
                    }
                    break;
                case '💸 Rút Tiền': 
                    {
                        const settings = await getMainBotSettings();
                        if (settings && settings.maintenanceWithdraw) {
                            await bot.sendMessage(userId, '❌ Hệ thống rút tiền đang bảo trì. Vui lòng quay lại sau.');
                            break;
                        }
                        await WithdrawHandler.start(bot, msg, userStates); 
                    }
                    break;
                case '🎉 Sự Kiện': await EventHandler.show(bot, msg); break;
                case '🏆 Bảng Xếp Hạng': await RankingHandler.show(bot, msg); break;
                case '🤝 Giới Thiệu Bạn Bè': await ReferralHandler.show(bot, msg); break;
                case '🌹 Hoa hồng': await CommissionHandler.show(bot, msg); break;
                case '📞 Liên Hệ CSKH':
                    const settings = await getMainBotSettings();
                    await bot.sendMessage(userId, settings.cskhMessage || 'Vui lòng liên hệ Admin để được hỗ trợ.');
                    break;
                case '❓ Câu hỏi thường gặp (FAQ)': 
                    // Logic FAQ cũ (nếu muốn giữ lại)
                    // ...
                    break;
            }
        });

        // --- Xử lý các nút bấm từ Inline Keyboard ---
        bot.on('callback_query', async (callbackQuery) => {
            const msg = callbackQuery.message;
            const data = callbackQuery.data;

            const userId = callbackQuery.from.id;
            const accCheck = await Account.findOne({ userId });
            if (accCheck && accCheck.status === 0) {
                await bot.answerCallbackQuery(callbackQuery.id, {
                    text: '🚫 Tài khoản của bạn đã bị khóa.',
                    show_alert: true,
                }).catch(() => {});
                return;
            }

            const handledGameMenu = await GameListHandler.handleGameCallback(bot, callbackQuery);
            if (handledGameMenu) return;

            if (data === 'event_checkin') {
                await bot.answerCallbackQuery(callbackQuery.id).catch(() => {});
                await handleDailyCheckin(bot, {
                    from: callbackQuery.from,
                    chat: msg.chat,
                });
                return;
            }

            await bot.answerCallbackQuery(callbackQuery.id).catch(() => {});

            // --- Xử lý các nút từ menu nạp tiền ---
            const settings = await getMainBotSettings();
            if (settings && settings.maintenanceSystem) {
                return bot.sendMessage(msg.chat.id, '⚠️ <b>HỆ THỐNG ĐANG BẢO TRÌ NÂNG CẤP</b>\n\nVui lòng quay lại sau.', { parse_mode: 'HTML' });
            }

            if (data.startsWith('deposit_')) {
                if (settings && settings.maintenanceDeposit) {
                    return bot.sendMessage(msg.chat.id, '❌ Hệ thống nạp tiền đang bảo trì. Vui lòng quay lại sau.');
                }
                const minDeposit = settings && settings.minDeposit ? parseInt(settings.minDeposit) : 20000;

                const method = data.split('_')[1];
                if (method === 'banking') {
                    const bankingInfoText = `💳 <b>Nạp tiền qua Chuyển khoản Ngân hàng</b>\n\n` +
                        `➡️ <b>Cách lấy thông tin nạp:</b>\n` +
                        `🔸 Gõ lệnh: <code>/napbank [số tiền]</code>\n` +
                        `Ví dụ: <code>/napbank 100000</code>\n\n` +
                        `🔸 Hoặc bấm nút số tiền bên dưới để lấy nhanh.\n\n` +
                        `⚠️ <b>Lưu ý:</b>\n` +
                        `✅ Chuyển đúng SỐ TIỀN và NỘI DUNG được cung cấp.\n` +
                        `✅ Mỗi lần nạp cần lấy thông tin MỚI.\n` +
                        `🚫 Không dùng thông tin cũ cho giao dịch sau.\n` +
                        `💰 Nạp tối thiểu: ${minDeposit.toLocaleString()}đ`;

                    const quickAmountKeyboard = {
                        inline_keyboard: [
                            [{ text: '20K', callback_data: 'napbank_20000' }, { text: '30K', callback_data: 'napbank_30000' }, { text: '50K', callback_data: 'napbank_50000' }],
                            [{ text: '100K', callback_data: 'napbank_100000' }, { text: '200K', callback_data: 'napbank_200000' }, { text: '500K', callback_data: 'napbank_500000' }],
                            [{ text: '1M', callback_data: 'napbank_1000000' }, { text: '2M', callback_data: 'napbank_2000000' }, { text: '5M', callback_data: 'napbank_5000000' }],
                            [{ text: '10M', callback_data: 'napbank_10000000' }, { text: '20M', callback_data: 'napbank_20000000' }, { text: '50M', callback_data: 'napbank_50000000' }]
                        ]
                    };

                    // Nếu minDeposit nhỏ hơn 20k, thêm nút nạp nhanh cho mức min này
                    if (minDeposit < 20000) {
                        quickAmountKeyboard.inline_keyboard.unshift([{ text: `${(minDeposit/1000).toLocaleString()}K`, callback_data: `napbank_${minDeposit}` }]);
                    }

                    // Thêm nút nhập số khác
                    quickAmountKeyboard.inline_keyboard.push([{ text: '✏️ Nhập số tiền khác', callback_data: 'napbank_custom' }]);

                    bot.editMessageText(bankingInfoText, { chat_id: msg.chat.id, message_id: msg.message_id, parse_mode: 'HTML', reply_markup: quickAmountKeyboard }).catch(() => {});
                } 
                else if (method === 'zalopay') {
                    // --- LOGIC NẠP ZALOPAY ---
                    const zaloInfoText = `💳 <b>Nạp tiền qua ZaloPay</b>\n\n` +
                        `Vui lòng chọn mệnh giá nạp bên dưới để lấy mã QR.\n` +
                        `💰 Nạp tối thiểu: ${minDeposit.toLocaleString()}đ`;

                    const quickAmountKeyboard = {
                        inline_keyboard: [
                            [{ text: '20K', callback_data: 'napzalo_20000' }, { text: '50K', callback_data: 'napzalo_50000' }, { text: '100K', callback_data: 'napzalo_100000' }],
                            [{ text: '200K', callback_data: 'napzalo_200000' }, { text: '500K', callback_data: 'napzalo_500000' }, { text: '1M', callback_data: 'napzalo_1000000' }],
                            [{ text: '2M', callback_data: 'napzalo_2000000' }, { text: '5M', callback_data: 'napzalo_5000000' }, { text: '10M', callback_data: 'napzalo_10000000' }]
                        ]
                    };

                    // Thêm nút nhập số khác
                    quickAmountKeyboard.inline_keyboard.push([{ text: '✏️ Nhập số tiền khác', callback_data: 'napzalo_custom' }]);

                    bot.editMessageText(zaloInfoText, { chat_id: msg.chat.id, message_id: msg.message_id, parse_mode: 'HTML', reply_markup: quickAmountKeyboard }).catch(() => {});
                }
                else if (method === 'card') {
                    const telcoKeyboard = {
                        inline_keyboard: [
                            [{ text: 'VIETTEL', callback_data: 'card_telco_VIETTEL' }],
                            [{ text: 'VINAPHONE', callback_data: 'card_telco_VINAPHONE' }],
                            [{ text: 'MOBIFONE', callback_data: 'card_telco_MOBIFONE' }]
                        ]
                    };
                    bot.editMessageText('📱 <b>NẠP THẺ CÀO</b>\n\nVui lòng chọn nhà mạng:', { chat_id: msg.chat.id, message_id: msg.message_id, parse_mode: 'HTML', reply_markup: telcoKeyboard }).catch(() => {});
                }
                else {
                    bot.sendMessage(msg.chat.id, `Chức năng nạp tiền qua ${method} đang được phát triển.`);
                }
                return;
            }

            if (data === 'napbank_custom') {
                userStates[msg.chat.id] = { type: 'deposit_banking_custom' };
                await bot.sendMessage(msg.chat.id, '✏️ Vui lòng nhập số tiền bạn muốn nạp (Ví dụ: 100000):');
                return;
            }

            if (data.startsWith('napbank_')) {
                const amount = parseInt(data.split('_')[1]);
                await provideBankInfo(bot, msg.chat.id, amount);
                return;
            }

            if (data === 'napzalo_custom') {
                userStates[msg.chat.id] = { type: 'deposit_zalopay_custom' };
                await bot.sendMessage(msg.chat.id, '✏️ Vui lòng nhập số tiền bạn muốn nạp qua ZaloPay (Ví dụ: 50000):');
                return;
            }

            if (data.startsWith('napzalo_')) {
                const amount = parseInt(data.split('_')[1]);
                await provideZaloPayInfo(bot, msg.chat.id, amount);
                return;
            }

            if (data.startsWith('card_telco_')) {
                const telco = data.split('_')[2];
                userStates[msg.chat.id] = { type: 'deposit_card_amount', telco: telco };
                bot.sendMessage(msg.chat.id, `📱 Nhà mạng: <b>${telco}</b>\n\n💰 Vui lòng nhập mệnh giá thẻ (Ví dụ: 50000):`, { parse_mode: 'HTML' });
                return;
            }

            if (data.startsWith('cl_replay_')) {
                const parts = data.split('_');
                const type = parts[2];
                const amount = parseInt(parts[3]);
                const fromUser = callbackQuery.from;
                const fromUsername = fromUser.first_name || 'Người chơi';
                await processEvenOddBet(bot, msg.chat.id, fromUser.id, fromUsername, type, amount);
                return;
            }

            if (data.startsWith('tx_replay_')) {
                const parts = data.split('_');
                const type = parts[2];
                const amount = parseInt(parts[3]);
                const fromUser = callbackQuery.from;
                const fromUsername = fromUser.first_name || 'Người chơi';
                await processTaiXiuBet(bot, msg.chat.id, fromUser.id, fromUsername, type, amount);
                return;
            }

            if (data.startsWith('dice_replay_')) {
                const parts = data.split('_');
                const type = parts[2];
                const amount = parseInt(parts[3]);
                const fromUser = callbackQuery.from;
                const fromUsername = fromUser.first_name || 'Người chơi';
                await processDiceBet(bot, msg.chat.id, fromUser.id, fromUsername, type, amount);
                return;
            }

            if (data.startsWith('history_deposit_page_')) {
                const page = parseInt(data.split('_')[3]);
                await sendTransactionHistory(bot, msg.chat.id, callbackQuery.from.id, 'deposit', page, msg.message_id);
                return;
            }

            if (data.startsWith('history_withdraw_page_')) {
                const page = parseInt(data.split('_')[3]);
                await sendTransactionHistory(bot, msg.chat.id, callbackQuery.from.id, 'withdraw', page, msg.message_id);
                return;
            }

            // --- Xử lý Rút tiền (WithdrawHandler) ---
            if (data.startsWith('amount_') || data.startsWith('bank_') || data.startsWith('withdraw_')) {
                await WithdrawHandler.handleCallback(bot, callbackQuery, userStates);
                return;
            }
            
            // --- Xử lý Két sắt ---
            if (data === 'account_safe') {
                await SafeHandler.start(bot, msg.chat.id, userStates);
                return;
            }
            if (data.startsWith('safe_')) {
                await SafeHandler.handleCallback(bot, callbackQuery, userStates);
                return;
            }

            // --- Xử lý các nút từ menu tài khoản ---
            switch (data) {
                case 'account_deposit':
                    {
                        if (settings && settings.maintenanceDeposit) {
                            return bot.sendMessage(userId, '❌ Hệ thống nạp tiền đang bảo trì. Vui lòng quay lại sau.');
                        }
                        await DepositHandler.show(bot, msg);
                    }
                    return;
                case 'account_withdraw':
                    if (settings && settings.maintenanceWithdraw) {
                        return bot.sendMessage(userId, '❌ Hệ thống rút tiền đang bảo trì. Vui lòng quay lại sau.');
                    }
                    await WithdrawHandler.start(bot, msg, userStates);
                    return;
                case 'account_transfer':
                    // Thêm logic chuyển tiền ở đây
                    bot.sendMessage(userId, 'Chức năng "Chuyển Tiền" đang được phát triển.');
                    return;
                case 'history_deposit':
                    await sendTransactionHistory(bot, userId, callbackQuery.from.id, 'deposit', 1);
                    return;
                case 'history_withdraw':
                    await sendTransactionHistory(bot, userId, callbackQuery.from.id, 'withdraw', 1);
                    return;
                case 'history_betting':
                    // Thêm logic xem lịch sử cược ở đây
                    bot.sendMessage(userId, 'Chức năng "Lịch sử Cược" đang được phát triển.');
                    return;
                case 'account_giftcode':
                    // Thêm logic nhập giftcode ở đây
                    bot.sendMessage(userId, 'Vui lòng nhập giftcode theo cú pháp: `/gift [mã]`');
                    return;
                case 'shop_giftcode':
                    const shopMsg = `🛒 <b>MUA GIFTCODE TỰ ĐỘNG</b>\n\n` +
                        `Hệ thống hỗ trợ tạo Giftcode số lượng lớn (Phí 15%).\n\n` +
                        `➡️ <b>Cú pháp:</b> <code>/muaGiftCode [số_lượng] [mệnh_giá]</code>\n` +
                        `➡️ <b>Ví dụ:</b> <code>/muaGiftCode 5 50000</code>\n` +
                        `(Mua 5 code, mỗi code trị giá 50.000đ)\n\n` +
                        `<i>Sau khi mua thành công, danh sách code sẽ được gửi ngay cho bạn.</i>`;
                    bot.sendMessage(userId, shopMsg, { parse_mode: 'HTML' });
                    return;
                case 'exchange_vip_points':
                    try {
                        const accVip = await Account.findOne({ userId });
                        if (!accVip) return bot.sendMessage(userId, '❌ Không tìm thấy thông tin tài khoản.');

                        const points = accVip.vipPoints || 0;
                        if (points < 1000) { // Giới hạn tối thiểu để đổi
                            return bot.sendMessage(userId, `❌ Bạn cần tối thiểu 1,000 điểm VIP để đổi thưởng.\n💎 Điểm hiện tại: <b>${points.toLocaleString()}</b>`, { parse_mode: 'HTML' });
                        }

                        // Tỷ lệ: 1 điểm = 10 VNĐ (Tương đương hoàn trả 1% nếu 1000đ cược = 1 điểm)
                        const RATE = 10; 
                        const bonus = points * RATE;

                        accVip.balance += bonus;
                        accVip.vipPoints = 0; // Reset điểm sau khi đổi
                        accVip.usedVipPoints = (accVip.usedVipPoints || 0) + points;
                        await accVip.save();

                        await Transaction.create({
                            userId,
                            amount: bonus,
                            action: 'add',
                            oldBalance: accVip.balance - bonus,
                            newBalance: accVip.balance,
                            description: `Đổi ${points} điểm VIP`
                        });

                        await bot.sendMessage(userId, `✅ <b>ĐỔI ĐIỂM THÀNH CÔNG</b>\n\n💎 Đã đổi: <b>${points.toLocaleString()} điểm</b>\n💰 Tỷ lệ: 1 điểm = ${RATE}đ\n🎁 Nhận được: <b>${bonus.toLocaleString()} VNĐ</b>\n💵 Số dư mới: <b>${accVip.balance.toLocaleString()} VNĐ</b>`, { parse_mode: 'HTML' });
                    } catch (e) {
                        console.error('[Exchange VIP Error]', e);
                        bot.sendMessage(userId, '❌ Có lỗi xảy ra khi đổi điểm.');
                    }
                    return;
            }
            // --- Kết thúc xử lý nút menu tài khoản ---


            switch (data) {
                case 'faq_menu':
                    const faqKeyboard = {
                        inline_keyboard: faqData.map(item => ([{ text: item.question, callback_data: item.id }]))
                    };
                    faqKeyboard.inline_keyboard.push([{ text: '❌ Đóng', callback_data: 'close_faq' }]);
                    
                    bot.editMessageText('❓ <b>CÂU HỎI THƯỜNG GẶP</b>\nChọn câu hỏi bạn quan tâm:', {
                        chat_id: msg.chat.id,
                        message_id: msg.message_id,
                        parse_mode: 'HTML',
                        reply_markup: faqKeyboard
                    }).catch(() => {});
                    break;

                case 'close_faq':
                    bot.deleteMessage(msg.chat.id, msg.message_id).catch(() => {});
                    break;

                default:
                    const faqItem = faqData.find(item => item.id === data);
                    if (faqItem) {
                        const backToFaqKeyboard = { inline_keyboard: [[{ text: '🔙 Quay lại FAQ', callback_data: 'faq_menu' }]] };
                        bot.editMessageText(`❓ <b>${faqItem.question}</b>\n\n💡 ${faqItem.answer}`, {
                            chat_id: msg.chat.id,
                            message_id: msg.message_id,
                            parse_mode: 'HTML',
                            reply_markup: backToFaqKeyboard
                        }).catch(() => {});
                    }
                    break;
            }
        });

        // Lệnh /napbank [số tiền]
        bot.onText(/\/napbank (\d+)/, async (msg, match) => {
            const amount = parseInt(match[1]);
            if (msg.chat.type !== 'private') return; // Chỉ cho phép trong chat riêng
            const settings = await getMainBotSettings();
            if (settings && settings.maintenanceSystem) {
                return bot.sendMessage(msg.chat.id, '⚠️ <b>HỆ THỐNG ĐANG BẢO TRÌ NÂNG CẤP</b>\n\nVui lòng quay lại sau.', { parse_mode: 'HTML' });
            }
            const account = await Account.findOne({ userId: msg.chat.id });
            if (account && account.status === 0) return bot.sendMessage(msg.chat.id, '🚫 Tài khoản của bạn đã bị khóa.');
            await provideBankInfo(bot, msg.chat.id, amount);
        });

        bot.on('polling_error', (err) => {
            const recoverable = isRecoverableMainBotPollingError(err);
            if (shouldLogMainBotPollingError(err)) {
                const formatted = formatMainBotPollingError(err);
                if (recoverable) {
                    console.warn(`[Main Bot Polling Warning] ${formatted}`);
                } else {
                    console.error(`[Main Bot Polling Error] ${formatted}`);
                }
            }
            // Nếu vẫn gặp lỗi 409, instance này sẽ tự hủy để giải quyết xung đột
            if (isMainBotConflictError(err)) {
                console.error('[Main Bot] Xung đột 409. Instance này sẽ tự hủy.');
                if (mainBotInstance === bot) {
                    resetMainBotPollingRecovery();
                    bot.stopPolling().catch(() => {});
                    bot.removeAllListeners();
                    mainBotInstance = null;
                }
                return;
            }

            if (recoverable) {
                if (shouldRecoverMainBotPolling()) {
                    scheduleMainBotPollingRecovery(bot, err);
                }
            }
        });

    } catch (error) {
        console.error('[Main Bot Error]', error.message);
        if (mainBotInstance) {
            try { await mainBotInstance.stopPolling(); } catch(e) {}
            if (mainBotInstance) {
                resetMainBotPollingRecovery();
                mainBotInstance.removeAllListeners();
            }
            mainBotInstance = null;
        }
    } finally {
        isProcessing = false;
    }
}

async function provideBankInfo(bot, chatId, amount) {
    // Chống spam: Giới hạn 15s/lần và tối đa 5 đơn chờ
    const lastTime = depositCooldowns[chatId] || 0;
    const now = Date.now();
    if (now - lastTime < 15000) {
        return bot.sendMessage(chatId, `⏳ Vui lòng đợi ${Math.ceil((15000 - (now - lastTime)) / 1000)}s trước khi tạo lệnh mới.`);
    }
    const pendingCount = await Deposit.countDocuments({ userId: chatId, status: 0 });
    if (pendingCount >= 5) {
        return bot.sendMessage(chatId, '❌ Bạn có quá nhiều lệnh nạp đang chờ. Vui lòng thanh toán các lệnh cũ hoặc đợi hủy.');
    }
    depositCooldowns[chatId] = now;

    try {
        const settings = await getMainBotSettings();
        if (settings && settings.maintenanceSystem) {
            return bot.sendMessage(chatId, '⚠️ <b>HỆ THỐNG ĐANG BẢO TRÌ NÂNG CẤP</b>\n\nVui lòng quay lại sau.', { parse_mode: 'HTML' });
        }
        if (settings && settings.maintenanceDeposit) {
            return bot.sendMessage(chatId, '❌ Hệ thống nạp tiền đang bảo trì. Vui lòng quay lại sau.');
        }

        const minDeposit = settings && settings.minDeposit ? parseInt(settings.minDeposit) : 20000;
        const maxDeposit = settings && settings.maxDeposit ? parseInt(settings.maxDeposit) : 500000000;

        if (amount < minDeposit) {
            return bot.sendMessage(chatId, `❌ Số tiền nạp tối thiểu là ${minDeposit.toLocaleString()}đ.`);
        }
        if (amount > maxDeposit) {
            return bot.sendMessage(chatId, `❌ Số tiền nạp tối đa là ${maxDeposit.toLocaleString()}đ.`);
        }

        let bankAccount = null;
            
            // Mặc định là bật nếu chưa cấu hình (để khớp với giao diện Admin)
            const useBankAuto = settings ? (settings.useBankAuto !== false) : true;

        // Ưu tiên Bank Auto nếu được bật
            if (useBankAuto) {
                const autoBanks = await BankAuto.find({ status: 1 });
                if (autoBanks && autoBanks.length > 0) {
                    bankAccount = autoBanks[Math.floor(Math.random() * autoBanks.length)];
                }
        }

        if (!bankAccount) {
            return bot.sendMessage(chatId, '❌ Hệ thống nạp tiền qua ngân hàng đang bảo trì. Vui lòng thử lại sau.');
        }
        // Tạo mã giao dịch duy nhất
        const transCode = `NAP${Math.floor(100000 + Math.random() * 900000)}`;

        // --- LOGIC SỐ TIỀN DUY NHẤT ---
        // Kiểm tra và tạo số tiền lẻ để phân biệt nếu không nhập nội dung
        let finalAmount = amount;
        let isUnique = false;
        let attempts = 0;

        // Thử tối đa 20 lần để tìm số tiền chưa ai nạp
        while (!isUnique && attempts < 20) {
            const existing = await Deposit.findOne({ amount: finalAmount, status: 0 });
            if (!existing) {
                isUnique = true;
            } else {
                // Nếu trùng, cộng thêm từ 1đ đến 50đ ngẫu nhiên
                finalAmount += Math.floor(Math.random() * 50) + 1;
                attempts++;
            }
        }

        // Tạo yêu cầu nạp tiền đang chờ xử lý
        await Deposit.create({
            userId: chatId,
            amount: finalAmount, // Lưu số tiền đã làm lệch (duy nhất)
            method: 'Banking',
            requestId: transCode,
            status: 0
        });

        // Tạo link VietQR (Xử lý tên ngân hàng để tránh lỗi URL)
        const bankId = bankAccount.bankName.trim().replace(/\s+/g, '');
        // Bỏ addInfo (nội dung) khỏi QR Code
        const qrUrl = `https://img.vietqr.io/image/${bankId}-${bankAccount.accountNumber}-qr_only.jpg?amount=${finalAmount}&accountName=${encodeURIComponent(bankAccount.accountName)}`;

        const depositInfoText = `✅ <b>YÊU CẦU NẠP TIỀN</b>\n\n` +
            `Vui lòng quét mã QR hoặc chuyển khoản theo thông tin:\n\n` +
            `🏦 <b>Ngân hàng:</b> ${bankAccount.bankName}\n` +
            `💳 <b>Số tài khoản:</b> <code>${bankAccount.accountNumber}</code>\n` +
            `👤 <b>Chủ tài khoản:</b> ${bankAccount.accountName}\n` +
            `💰 <b>Số tiền:</b> <code>${finalAmount.toLocaleString()}</code> ₫ (Chính xác từng đồng)\n` +
            `\n⚠️ <b>QUAN TRỌNG:</b> Vui lòng chuyển <b>CHÍNH XÁC SỐ TIỀN</b> (kể cả số lẻ) để được duyệt tự động ngay lập tức.`;

        try {
            await bot.sendPhoto(chatId, qrUrl, { caption: depositInfoText, parse_mode: 'HTML' });
        } catch (photoErr) {
            console.error('[Provide Bank Info] Lỗi gửi ảnh QR:', photoErr.message);
            // Fallback: Gửi tin nhắn text nếu ảnh lỗi (do tên ngân hàng sai hoặc lỗi mạng)
            await bot.sendMessage(chatId, depositInfoText, { parse_mode: 'HTML' });
        }
    } catch (error) {
        console.error('[Provide Bank Info Error]', error);
        await bot.sendMessage(chatId, '❌ Đã có lỗi xảy ra khi tạo yêu cầu nạp tiền. Vui lòng thử lại.');
    }
}

async function provideZaloPayInfo(bot, chatId, amount) {
    // Chống spam
    const lastTime = depositCooldowns[chatId] || 0;
    const now = Date.now();
    if (now - lastTime < 15000) return bot.sendMessage(chatId, `⏳ Vui lòng đợi vài giây trước khi tạo lệnh mới.`);
    depositCooldowns[chatId] = now;

    try {
        // 1. Lấy ví ZaloPay đang hoạt động có liên kết ngân hàng
        const wallet = await EWallet.findOne({ walletType: 'ZaloPay', status: 1 });
        if (!wallet || !wallet.accountNumber) {
            return bot.sendMessage(chatId, '❌ Hệ thống nạp ZaloPay đang bảo trì hoặc chưa cấu hình tài khoản ngân hàng liên kết.');
        }

        // 2. Xử lý số tiền duy nhất (để tránh trùng lặp)
        let finalAmount = amount;
        let isUnique = false;
        let attempts = 0;
        while (!isUnique && attempts < 20) {
            const existing = await Deposit.findOne({ amount: finalAmount, status: 0 });
            if (!existing) isUnique = true;
            else { finalAmount += Math.floor(Math.random() * 50) + 1; attempts++; }
        }

        const transCode = `NAP${Math.floor(100000 + Math.random() * 900000)}`;

        // 3. Tạo link VietQR
        const bankId = 'VietCapitalBank'; // Ngân hàng Bản Việt
        const qrLink = `https://img.vietqr.io/image/${bankId}-${wallet.accountNumber}-qr_only.jpg?amount=${finalAmount}&accountName=${encodeURIComponent(wallet.name)}`;

        // 4. Lưu lệnh nạp vào DB
        await Deposit.create({
            userId: chatId,
            amount: finalAmount,
            method: 'ZaloPay',
            requestId: transCode,
            status: 0
        });

        // 5. Gửi thông tin cho khách
        const caption = `✅ <b>NẠP TIỀN ZALOPAY</b>\n\n` +
            `Vui lòng quét mã QR hoặc chuyển khoản thủ công:\n\n` +
            `📞 <b>Ví ZaloPay:</b> <code>${wallet.phoneNumber}</code>\n` +
            `👤 <b>Tên:</b> ${wallet.name}\n` +
            `💰 <b>Số tiền:</b> <code>${finalAmount.toLocaleString()}</code> ₫\n\n` +
            `⚠️ <b>QUAN TRỌNG:</b>\n` +
            `👉 Quét mã QR để thanh toán nhanh.\n` +
            `👉 Vui lòng chuyển <b>CHÍNH XÁC SỐ TIỀN</b> (kể cả số lẻ) để được duyệt tự động.`;

        try {
            await bot.sendPhoto(chatId, qrLink, { caption, parse_mode: 'HTML' });
        } catch (photoErr) {
            console.error('[ZaloPay Info Error] Lỗi gửi ảnh QR:', photoErr.message);
            // Fallback: Gửi tin nhắn text nếu ảnh lỗi
            await bot.sendMessage(chatId, caption + `\n\n❌ Không tải được mã QR, vui lòng chuyển khoản thủ công theo thông tin trên.`, { parse_mode: 'HTML' });
        }

    } catch (error) {
        console.error('[ZaloPay Info Error]', error);
        await bot.sendMessage(chatId, '❌ Có lỗi xảy ra. Vui lòng thử lại sau.');
    }
}

async function processEvenOddBet(bot, chatId, userId, username, type, amount, replyToMessageId = null) {
    return runMainBotGameUserTask(userId, async () => {
        try {
            const settings = await getMainBotSettings();
            if (settings && settings.maintenanceSystem) {
                return bot.sendMessage(chatId, 'HE THONG DANG BAO TRI', { parse_mode: 'HTML' });
            }

            const minBet = settings?.minBetCL || 1000;
            const maxBet = settings?.maxBetCL || 10000000;
            if (isNaN(amount) || amount < minBet || amount > maxBet) {
                return bot.sendMessage(chatId, `Cuoc tu ${minBet.toLocaleString()} - ${maxBet.toLocaleString()} VND.`);
            }

            const debitResult = await debitAccountForBet(Account, {
                userId,
                amount,
                totalBetAmount: amount,
            });
            if (!debitResult.ok) {
                if (debitResult.reason === 'blocked') return bot.sendMessage(chatId, 'Tai khoan cua ban da bi khoa.');
                if (debitResult.reason === 'missing') return bot.sendMessage(chatId, 'Ban chua dang ky. Go /start.');
                return bot.sendMessage(chatId, 'So du khong du de dat cuoc.');
            }

            const now = Date.now();
            const lastDigit = now % 10;
            const isEven = lastDigit % 2 === 0;
            const isWin = (type === 'C' && isEven) || (type === 'L' && !isEven);
            let winAmount = 0;
            let balance = Number(debitResult.account?.balance || 0);
            let resultText = '<b>THAT BAI</b>';

            if (isWin) {
                winAmount = Math.floor(amount * 1.95);
                const updatedAccount = await creditAccountBalance(Account, userId, winAmount);
                balance = Number(updatedAccount?.balance || (balance + winAmount));
                resultText = `<b>CHIEN THANG</b> (+${winAmount.toLocaleString()}d)`;
            }

            await MiniGameHistory.create({
                game: 'cl_tele', userId, username,
                betType: type, betAmount: amount, winAmount,
                date: new Date()
            }).catch((error) => {
                console.error('Loi luu lich su CL:', error);
            });

            const resultTypeStr = isEven ? 'Chan' : 'Le';
            const userChoiceStr = type === 'C' ? 'Chan' : 'Le';
            const responseMsg = `CHAN - LE TELEGRAM\n` +
                `Nguoi choi: <b>${username}</b>\n` +
                `Cuoc: <b>${userChoiceStr}</b> - <b>${amount.toLocaleString()}d</b>\n` +
                `Time: <code>${now}</code>\n` +
                `Ket qua: <b>${lastDigit}</b> (${resultTypeStr})\n` +
                `${resultText}\n` +
                `So du: <b>${balance.toLocaleString()}d</b>\n` +
                `<i>Check: epochconverter.com</i>`;

            const opts = {
                parse_mode: 'HTML',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: `Choi lai (${type} ${amount.toLocaleString()})`, callback_data: `cl_replay_${type}_${amount}` }]
                    ]
                }
            };
            if (replyToMessageId) opts.reply_to_message_id = replyToMessageId;

            await bot.sendMessage(chatId, responseMsg, opts);
        } catch (err) {
            console.error('[CL Game Error]', err);
            bot.sendMessage(chatId, 'Co loi xay ra, vui long thu lai sau.').catch(() => {});
        }
    });
}

async function processTaiXiuBet(bot, chatId, userId, username, type, amount, replyToMessageId = null) {
    return runMainBotGameUserTask(userId, async () => {
        try {
            const settings = await getMainBotSettings();
            if (settings && settings.maintenanceSystem) {
                return bot.sendMessage(chatId, 'HE THONG DANG BAO TRI', { parse_mode: 'HTML' });
            }

            const minBet = settings?.minBetTX || 1000;
            const maxBet = settings?.maxBetTX || 10000000;
            if (isNaN(amount) || amount < minBet || amount > maxBet) {
                return bot.sendMessage(chatId, `Cuoc tu ${minBet.toLocaleString()} - ${maxBet.toLocaleString()} VND.`);
            }

            const debitResult = await debitAccountForBet(Account, {
                userId,
                amount,
                totalBetAmount: amount,
            });
            if (!debitResult.ok) {
                if (debitResult.reason === 'blocked') return bot.sendMessage(chatId, 'Tai khoan cua ban da bi khoa.');
                if (debitResult.reason === 'missing') return bot.sendMessage(chatId, 'Ban chua dang ky. Go /start.');
                return bot.sendMessage(chatId, 'So du khong du de dat cuoc.');
            }

            const now = Date.now();
            const lastDigit = now % 10;
            const isTai = lastDigit >= 5;
            const isWin = (type === 'T' && isTai) || (type === 'X' && !isTai);
            let winAmount = 0;
            let balance = Number(debitResult.account?.balance || 0);
            let resultText = '<b>THAT BAI</b>';

            if (isWin) {
                winAmount = Math.floor(amount * 1.95);
                const updatedAccount = await creditAccountBalance(Account, userId, winAmount);
                balance = Number(updatedAccount?.balance || (balance + winAmount));
                resultText = `<b>CHIEN THANG</b> (+${winAmount.toLocaleString()}d)`;
            }

            await MiniGameHistory.create({
                game: 'tx_tele', userId, username,
                betType: type, betAmount: amount, winAmount,
                date: new Date()
            }).catch((error) => {
                console.error('Loi luu lich su TX:', error);
            });

            const resultTypeStr = isTai ? 'Tai' : 'Xiu';
            const userChoiceStr = type === 'T' ? 'Tai' : 'Xiu';
            const responseMsg = `TAI - XIU TELEGRAM\n` +
                `Nguoi choi: <b>${username}</b>\n` +
                `Cuoc: <b>${userChoiceStr}</b> - <b>${amount.toLocaleString()}d</b>\n` +
                `Time: <code>${now}</code>\n` +
                `Ket qua: <b>${lastDigit}</b> (${resultTypeStr})\n` +
                `${resultText}\n` +
                `So du: <b>${balance.toLocaleString()}d</b>\n` +
                `<i>Check: epochconverter.com</i>`;

            const opts = {
                parse_mode: 'HTML',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: `Choi lai (${type} ${amount.toLocaleString()})`, callback_data: `tx_replay_${type}_${amount}` }]
                    ]
                }
            };
            if (replyToMessageId) opts.reply_to_message_id = replyToMessageId;

            await bot.sendMessage(chatId, responseMsg, opts);
        } catch (err) {
            console.error('[TX Game Error]', err);
            bot.sendMessage(chatId, 'Co loi xay ra, vui long thu lai sau.').catch(() => {});
        }
    });
}

async function processDiceBet(bot, chatId, userId, username, type, amount, replyToMessageId = null) {
    return runMainBotGameUserTask(userId, async () => {
        try {
            const settings = await getMainBotSettings();
            if (settings && settings.maintenanceSystem) {
                return bot.sendMessage(chatId, 'HE THONG DANG BAO TRI', { parse_mode: 'HTML' });
            }

            const minBet = settings?.minBetDice || 1000;
            const maxBet = settings?.maxBetDice || 10000000;
            if (isNaN(amount) || amount < minBet || amount > maxBet) {
                return bot.sendMessage(chatId, `Cuoc tu ${minBet.toLocaleString()} - ${maxBet.toLocaleString()} VND.`);
            }

            const debitResult = await debitAccountForBet(Account, {
                userId,
                amount,
                totalBetAmount: amount,
            });
            if (!debitResult.ok) {
                if (debitResult.reason === 'blocked') return bot.sendMessage(chatId, 'Tai khoan cua ban da bi khoa.');
                if (debitResult.reason === 'missing') return bot.sendMessage(chatId, 'Ban chua dang ky. Go /start.');
                return bot.sendMessage(chatId, 'So du khong du de dat cuoc.');
            }

            let balance = Number(debitResult.account?.balance || 0);
            let diceMsg;
            try {
                diceMsg = await bot.sendDice(chatId, { emoji: '🎲', reply_to_message_id: replyToMessageId });
            } catch (diceError) {
                await creditAccountBalance(Account, userId, amount).catch(() => {});
                throw diceError;
            }
            const diceValue = Number(diceMsg?.dice?.value || 0);

            let isWin = false;
            let rate = 0;
            switch (type) {
                case 'XXC':
                    if ([2, 4, 6].includes(diceValue)) { isWin = true; rate = 1.95; }
                    break;
                case 'XXL':
                    if ([1, 3, 5].includes(diceValue)) { isWin = true; rate = 1.95; }
                    break;
                case 'XXT':
                    if ([4, 5, 6].includes(diceValue)) { isWin = true; rate = 1.95; }
                    break;
                case 'XXX':
                    if ([1, 2, 3].includes(diceValue)) { isWin = true; rate = 1.95; }
                    break;
                default:
                    if (type.startsWith('D')) {
                        const target = parseInt(type.slice(1), 10);
                        if (diceValue === target) { isWin = true; rate = 5; }
                    }
                    break;
            }

            await new Promise((resolve) => setTimeout(resolve, MAIN_BOT_DICE_RESULT_DELAY_MS));

            let winAmount = 0;
            let resultText = '<b>THAT BAI</b>';
            if (isWin) {
                winAmount = Math.floor(amount * rate);
                const updatedAccount = await creditAccountBalance(Account, userId, winAmount);
                balance = Number(updatedAccount?.balance || (balance + winAmount));
                resultText = `<b>CHIEN THANG</b> (+${winAmount.toLocaleString()}d)`;
            }

            await MiniGameHistory.create({
                game: 'dice_tele', userId, username,
                betType: type, betAmount: amount, winAmount,
                date: new Date()
            }).catch((error) => {
                console.error('Loi luu lich su Dice:', error);
            });

            const responseMsg = `XUC XAC TELEGRAM\n` +
                `Nguoi choi: <b>${username}</b>\n` +
                `Cuoc: <b>${type}</b> - <b>${amount.toLocaleString()}d</b>\n` +
                `Ket qua: <b>${diceValue}</b>\n` +
                `${resultText}\n` +
                `So du: <b>${balance.toLocaleString()}d</b>`;

            const opts = {
                parse_mode: 'HTML',
                reply_to_message_id: diceMsg.message_id,
                reply_markup: {
                    inline_keyboard: [[{ text: `Choi lai (${type} ${amount.toLocaleString()})`, callback_data: `dice_replay_${type}_${amount}` }]],
                },
            };
            await bot.sendMessage(chatId, responseMsg, opts);
        } catch (err) {
            console.error('[Dice Game Error]', err);
            bot.sendMessage(chatId, 'Co loi xay ra, vui long thu lai sau.').catch(() => {});
        }
    });
}

/**
 * Ki?m tra k?t n?i th?c t? v?i Telegram
 */
async function checkConnection() {
    if (!mainBotInstance) return { success: false, message: 'BOT CHƯA KHỞI TẠO' };
    try {
        const me = await mainBotInstance.getMe();
        return { success: true, message: `@${me.username} ONLINE` };
    } catch (error) {
        return { success: false, message: 'LỖI KẾT NỐI' };
    }
}

/**
 * Gửi thông báo bảo trì cho toàn bộ người dùng
 * @param {string} reason Nội dung bảo trì
 * @param {number} minutes Số phút báo trước (mặc định 5)
 */
async function sendMaintenanceNotification(reason, minutes = 5) {
    if (!mainBotInstance) {
        console.error('[Main Bot] Bot chưa được khởi tạo, không thể gửi thông báo.');
        return { success: false, message: 'Bot chưa khởi tạo' };
    }

    const maintenanceTime = new Date(Date.now() + minutes * 60000);
    const timeString = maintenanceTime.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

    const message = `⚠️ <b>THÔNG BÁO BẢO TRÌ HỆ THỐNG</b> ⚠️\n\n` +
                    `🛠 <b>Nội dung:</b> ${reason}\n` +
                    `⏰ <b>Thời gian bắt đầu:</b> ${timeString} (Sau ${minutes} phút nữa)\n\n` +
                    `⛔️ <b>CẢNH BÁO QUAN TRỌNG:</b>\n` +
                    `Vui lòng <b>DỪNG NGAY</b> mọi hoạt động Nạp/Rút và Đặt cược để tránh thất thoát tài sản.\n` +
                    `Hệ thống sẽ tạm ngưng phục vụ để nâng cấp. Xin cảm ơn!`;

    try {
        // Lấy tất cả userId từ Account
        const accounts = await Account.find({}, 'userId');
        let successCount = 0;

        console.log(`[Main Bot] Đang gửi thông báo bảo trì tới ${accounts.length} người dùng...`);

        // Gửi tuần tự với delay nhỏ để tránh lỗi 429 Too Many Requests của Telegram
        for (const acc of accounts) {
            try {
                await mainBotInstance.sendMessage(acc.userId, message, { parse_mode: 'HTML' });
                successCount++;
                await new Promise(r => setTimeout(r, 50)); // Delay 50ms giữa các tin
            } catch (err) {
                // Bỏ qua nếu user block bot hoặc lỗi khác
            }
        }

        console.log(`[Main Bot] Đã gửi thông báo xong. Thành công: ${successCount}/${accounts.length}`);
        return { success: true, total: accounts.length, sent: successCount };
    } catch (error) {
        console.error('[Main Bot] Lỗi khi gửi thông báo bảo trì:', error);
        return { success: false, message: error.message };
    }
}

/**
 * Gửi thông báo (notification) qua Main Bot
 * options: { content, targetType: 'all'|'group'|'user', targetValue }
 */
async function sendNotification(options) {
    const { content, targetType = 'all', targetValue = null } = options || {};
    if (!mainBotInstance) return { success: false, message: 'Bot chưa khởi tạo' };

    try {
        if (targetType === 'group' || targetType === 'chat') {
            await mainBotInstance.sendMessage(targetValue, content, { parse_mode: 'HTML' });
            return { success: true, sent: 1 };
        }

        if (targetType === 'user' && targetValue) {
            await mainBotInstance.sendMessage(targetValue, content, { parse_mode: 'HTML' });
            return { success: true, sent: 1 };
        }

        // default: broadcast to all registered users
        const accounts = await Account.find({}, 'userId');
        let sent = 0;
        for (const acc of accounts) {
            try {
                await mainBotInstance.sendMessage(acc.userId, content, { parse_mode: 'HTML' });
                sent++;
                await new Promise(r => setTimeout(r, 50));
            } catch (err) {
                // ignore per-user failures
            }
        }
        return { success: true, sent, total: accounts.length };
    } catch (e) {
        console.error('[Main Bot] sendNotification error:', e.message || e);
        return { success: false, message: e.message || String(e) };
    }
}

/**
 * Phát Giftcode tự động qua Main Bot
 * params: { code, messageTemplate, targetType, targetValue }
 */
async function sendGiftcode({ code, messageTemplate = null, targetType = 'all', targetValue = null }) {
    if (!mainBotInstance) return { success: false, message: 'Bot chưa khởi tạo' };
    const text = messageTemplate || `🎁 Giftcode mới: <b>${code}</b>\nNhanh tay nhập để nhận phần thưởng!`;

    try {
        if (targetType === 'group' || targetType === 'chat') {
            await mainBotInstance.sendMessage(targetValue, text, { parse_mode: 'HTML' });
            return { success: true, sent: 1 };
        }

        if (targetType === 'user' && targetValue) {
            await mainBotInstance.sendMessage(targetValue, text, { parse_mode: 'HTML' });
            return { success: true, sent: 1 };
        }

        const accounts = await Account.find({}, 'userId');
        let sent = 0;
        for (const acc of accounts) {
            try {
                await mainBotInstance.sendMessage(acc.userId, text, { parse_mode: 'HTML' });
                sent++;
                await new Promise(r => setTimeout(r, 50));
            } catch (err) {}
        }
        return { success: true, sent, total: accounts.length };
    } catch (e) {
        console.error('[Main Bot] sendGiftcode error:', e.message || e);
        return { success: false, message: e.message || String(e) };
    }
}

/**
 * Xử lý thông báo nạp ZaloPay thành công (Gọi từ Socket hoặc IPC)
 * @param {Object} data { userId, amount, transId, balance }
 */
async function notifyZaloPaySuccess(data) {
    if (!mainBotInstance) return { success: false, message: 'Bot chưa khởi tạo' };
    
    const { userId, amount, transId, balance } = data;
    const content = `✅ <b>NẠP TIỀN ZALOPAY THÀNH CÔNG</b>\n\n` +
                    `💰 Số tiền: <b>${parseInt(amount).toLocaleString()} ₫</b>\n` +
                    `📝 Mã GD: <code>${transId}</code>\n` +
                    `💵 Số dư mới: <b>${parseInt(balance).toLocaleString()} ₫</b>\n\n` +
                    `Cảm ơn bạn đã tin tưởng và sử dụng dịch vụ!`;

    try {
        await mainBotInstance.sendMessage(userId, content, { parse_mode: 'HTML' });
        return { success: true };
    } catch (e) {
        console.error('[Main Bot] notifyZaloPaySuccess error:', e.message);
        return { success: false, message: e.message };
    }
}

/**
 * Hàm gửi lịch sử giao dịch có phân trang
 */
async function sendTransactionHistory(bot, chatId, userId, type, page = 1, messageId = null) {
    const ITEMS_PER_PAGE = 5;
    const Model = type === 'deposit' ? Deposit : Withdraw;
    const title = type === 'deposit' ? 'LỊCH SỬ NẠP TIỀN' : 'LỊCH SỬ RÚT TIỀN';
    const emptyMsg = type === 'deposit' ? '📭 Bạn chưa có giao dịch nạp tiền nào.' : '📭 Bạn chưa có giao dịch rút tiền nào.';

    try {
        const totalDocs = await Model.countDocuments({ userId });
        if (totalDocs === 0) {
            if (messageId) {
                await bot.editMessageText(emptyMsg, { chat_id: chatId, message_id: messageId });
            } else {
                await bot.sendMessage(chatId, emptyMsg);
            }
            return;
        }

        const totalPages = Math.ceil(totalDocs / ITEMS_PER_PAGE);
        if (page < 1) page = 1;
        if (page > totalPages) page = totalPages;

        const skip = (page - 1) * ITEMS_PER_PAGE;
        const transactions = await Model.find({ userId })
            .sort({ date: -1 })
            .skip(skip)
            .limit(ITEMS_PER_PAGE);

        let msgContent = `📥 <b>${title}</b> (Trang ${page}/${totalPages})\n\n`;
        
        transactions.forEach(trans => {
            const statusIcon = trans.status === 1 ? '✅' : (trans.status === 2 ? '❌' : '⏳');
            const dateStr = new Date(trans.date).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
            const method = type === 'deposit' ? (trans.method || 'Unknown') : (trans.bankName || 'Bank');
            const amount = trans.amount ? trans.amount.toLocaleString() : '0';
            const code = trans.requestId || 'N/A';
            
            msgContent += `${statusIcon} <b>${amount}đ</b> (${method})\n`;
            msgContent += `   └ ${dateStr} - <code>${code}</code>\n`;
            if (trans.status === 2 && trans.description) {
                 msgContent += `   └ Lý do: ${trans.description}\n`;
            }
            msgContent += `\n`;
        });

        const inlineKeyboard = [];
        const navRow = [];
        
        if (page > 1) navRow.push({ text: '⬅️ Trước', callback_data: `history_${type}_page_${page - 1}` });
        if (page < totalPages) navRow.push({ text: 'Sau âž¡ï¸', callback_data: `history_${type}_page_${page + 1}` });
        
        if (navRow.length > 0) inlineKeyboard.push(navRow);
        inlineKeyboard.push([{ text: '🔄 Làm mới', callback_data: `history_${type}_page_1` }]);

        const opts = { parse_mode: 'HTML', reply_markup: { inline_keyboard: inlineKeyboard }, chat_id: chatId, message_id: messageId };

        if (messageId) await bot.editMessageText(msgContent, opts).catch(() => {});
        else await bot.sendMessage(chatId, msgContent, { parse_mode: 'HTML', reply_markup: { inline_keyboard: inlineKeyboard } });

    } catch (e) {
        console.error(`[History ${type} Error]`, e);
        await bot.sendMessage(chatId, '❌ Có lỗi xảy ra khi tải lịch sử.');
    }
}

/**
 * Hàm gửi tin nhắn từ Admin tới User (Dùng cho App React gọi xuống)
 */
module.exports = { startMainBot, checkConnection, sendMaintenanceNotification, sendNotification, sendGiftcode, notifyZaloPaySuccess };






