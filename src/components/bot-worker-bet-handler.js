const {
  createKeyedSerialExecutor,
  debitAccountForBet,
} = require('./bot-performance-utils');

const runBetUserTask = createKeyedSerialExecutor();

function parseBetMessage(text) {
    const raw = String(text || '').trim();
    if (!raw) return null;

    // Accept:
    // - T 100000 / X 100000
    // - /T 100000 / /X 100000 (works in groups with privacy mode)
    // - /T@BotUsername 100000
    const match = raw.match(/^\/?(?<choice>[tx])(?:@[\w_]+)?\s+(?<amount>\d[\d.,]*)$/i);
    if (!match || !match.groups) return null;

    const choice = match.groups.choice.toLowerCase() === 't' ? 'Tai' : 'Xiu';
    const amount = Number(String(match.groups.amount || '').replace(/[.,]/g, ''));
    if (!Number.isFinite(amount) || amount <= 0) return null;
    return { choice, amount: Math.floor(amount) };
}

function isBettingPhase(phase) {
    return phase === 'betting'
        || phase === 'betting-round1'
        || phase === 'betting-round2';
}

function maskUserId(userId) {
    const raw = String(userId || '').replace(/\D/g, '');
    if (!raw) return '***';
    if (raw.length <= 3) return `${raw}***`;
    return `${raw.slice(0, 5)}***`;
}

function formatVnd(amount) {
    return Number(amount || 0).toLocaleString('vi-VN');
}

function createHandleBet({
    bot,
    currentRoom,
    Account,
    khongMinhBaseMultiplier,
}) {
    return async (
        userId,
        username,
        chatId,
        choice,
        amount,
        isCallback = false,
        callbackId = null,
        context = {},
    ) => runBetUserTask(userId, async () => {
        const state = currentRoom.state;
        const config = currentRoom.config;
        const khongMinhMode = config.roomType === 'khongminh';
        const sourceMessageId = context?.sourceMessageId || null;
        const chatType = String(context?.chatType || '').toLowerCase();
        const isGroupChat = chatType === 'group' || chatType === 'supergroup';

        if (!isBettingPhase(state.phase)) {
            if (isCallback) await bot.answerCallbackQuery(callbackId, { text: 'Het gio cuoc.', show_alert: true }).catch(() => {});
            if (!isCallback && chatId) {
                await bot.sendMessage(
                    chatId,
                    'Chua mo cuoc. Vui long cho phien moi.',
                ).catch(() => {});
            }
            return;
        }

        const { minBet, maxBet } = config;

        try {
            if (state.banker && typeof state.banker === 'object' && state.banker.userId === userId) {
                const msg = 'Ban dang lam cai, khong the cuoc.';
                isCallback ? await bot.answerCallbackQuery(callbackId, { text: msg, show_alert: true }).catch(() => {}) : await bot.sendMessage(chatId, msg).catch(() => {});
                return;
            }

            const oppositeChoice = choice === 'Tai' ? 'Xiu' : 'Tai';
            if (state.bets[oppositeChoice].users[userId]) {
                const msg = 'Ban da cuoc ben doi dien roi.';
                isCallback ? await bot.answerCallbackQuery(callbackId, { text: msg, show_alert: true }).catch(() => {}) : await bot.sendMessage(chatId, msg).catch(() => {});
                return;
            }

            if (isNaN(amount) || amount < minBet || amount > maxBet) {
                const msg = `Cuoc tu ${minBet.toLocaleString()} - ${maxBet.toLocaleString()}.`;
                isCallback ? await bot.answerCallbackQuery(callbackId, { text: msg, show_alert: true }).catch(() => {}) : await bot.sendMessage(chatId, msg).catch(() => {});
                return;
            }

            const currentTotalBet = Number(state.bets.Tai.total || 0) + Number(state.bets.Xiu.total || 0);
            if (currentTotalBet + amount > Number(state.bankerAmount || 0)) {
                const msg = 'Tong cuoc da day so voi tien cai.';
                isCallback ? await bot.answerCallbackQuery(callbackId, { text: msg, show_alert: true }).catch(() => {}) : await bot.sendMessage(chatId, msg).catch(() => {});
                return;
            }

            const debitResult = await debitAccountForBet(Account, {
                userId,
                amount,
                totalBetAmount: amount,
            });

            if (!debitResult.ok) {
                let msg = 'Khong the dat cuoc luc nay.';
                if (debitResult.reason === 'missing') msg = 'Chua co tai khoan.';
                if (debitResult.reason === 'blocked') msg = 'Tai khoan cua ban da bi khoa.';
                if (debitResult.reason === 'insufficient') msg = 'So du khong du.';
                isCallback
                    ? await bot.answerCallbackQuery(callbackId, { text: msg, show_alert: true }).catch(() => {})
                    : await bot.sendMessage(chatId, msg).catch(() => {});
                return;
            }

            const userBets = state.bets[choice].users;
            const currentMultiplier = khongMinhMode
                ? Number(state.currentMultipliers?.[choice] || khongMinhBaseMultiplier)
                : 2;
            if (userBets[userId]) {
                userBets[userId].amount += amount;
                userBets[userId].choice = choice;
                if (!Array.isArray(userBets[userId].betLines)) userBets[userId].betLines = [];
                userBets[userId].betLines.push({
                    amount,
                    multiplier: currentMultiplier,
                    round: Number(state.round || 1),
                });
            } else {
                userBets[userId] = {
                    username,
                    amount,
                    choice,
                    betLines: [{
                        amount,
                        multiplier: currentMultiplier,
                        round: Number(state.round || 1),
                    }],
                };
            }

            state.bets[choice].total += amount;

            if (isCallback) await bot.answerCallbackQuery(callbackId, { text: 'Dat cuoc thanh cong.' }).catch(() => {});
            const sideText = choice === 'Tai' ? 'tai' : 'xiu';
            const successText = `Nguoi dung <b>${maskUserId(userId)}</b> vua cuoc thanh cong <b>${formatVnd(amount)} d</b> cua <b>${sideText}</b>.`;

            if (isGroupChat && chatId) {
                await bot.sendMessage(
                    chatId,
                    successText,
                    {
                        parse_mode: 'HTML',
                        reply_to_message_id: sourceMessageId || undefined,
                        allow_sending_without_reply: true,
                    },
                ).catch(() => {});
            } else {
                const targetChatId = chatId || config.groupId;
                if (targetChatId) {
                    await bot.sendMessage(
                        targetChatId,
                        successText,
                        { parse_mode: 'HTML' },
                    ).catch(() => {});
                }
            }

            console.log(`[Worker] User ${userId} bet ${choice} ${amount}`);
        } catch (error) {
            console.error(`[Bet Error] ${error.message}`);
        }
    });
}

function registerBetMessageListener({ bot, handleBet }) {
    bot.on('message', async (msg) => {
        try {
            if (msg && msg.__chatLocked) return;
            const text = typeof msg.text === 'string' ? msg.text.trim() : '';
            if (!text) return;
            if (/^\/ducai\b/i.test(text)) return;

            const parsed = parseBetMessage(text);
            if (!parsed) return;

            if (!msg || !msg.from || msg.from.is_bot) {
                if (msg && msg.sender_chat && msg.chat && msg.chat.id) {
                    await bot.sendMessage(
                        msg.chat.id,
                        'Khong the cuoc khi dang bat che do an danh admin trong nhom. Hay tat an danh roi cuoc lai.',
                    ).catch(() => {});
                }
                return;
            }

            const username = msg.from.first_name || msg.from.username || `User_${msg.from.id}`;
            await handleBet(
                msg.from.id,
                username,
                msg.chat.id,
                parsed.choice,
                parsed.amount,
                false,
                null,
                {
                    sourceMessageId: msg.message_id,
                    chatType: msg.chat?.type,
                },
            );
        } catch (error) {
            console.error(`[Message Parse Error] ${error.message}`);
        }
    });
}

module.exports = {
    createHandleBet,
    registerBetMessageListener,
};
