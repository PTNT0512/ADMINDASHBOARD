const Account = require('../models/Account');
const Withdraw = require('../models/Withdraw');
const Setting = require('../models/Setting');

/* ================== INLINE KEYBOARD ================== */

const AMOUNT_KEYBOARD = {
    inline_keyboard: [
        [
            { text: '200.000', callback_data: 'amount_200000' },
            { text: '500.000', callback_data: 'amount_500000' },
            { text: '1.000.000', callback_data: 'amount_1000000' }
        ],
        [
            { text: '5.000.000', callback_data: 'amount_5000000' },
            { text: '10.000.000', callback_data: 'amount_10000000' }
        ],
        [
            { text: '💰 Tất cả', callback_data: 'amount_all' },
            { text: '✏️ Nhập số khác', callback_data: 'amount_manual' }
        ]
    ]
};

function bankKeyboard(lastWithdraw) {
    const kb = [
        [
            { text: 'Vietcombank', callback_data: 'bank_Vietcombank' },
            { text: 'MBBank', callback_data: 'bank_MBBank' },
            { text: 'Techcombank', callback_data: 'bank_Techcombank' }
        ],
        [
            { text: 'ACB', callback_data: 'bank_ACB' },
            { text: 'VPBank', callback_data: 'bank_VPBank' },
            { text: 'BIDV', callback_data: 'bank_BIDV' }
        ],
        [
            { text: 'Vietinbank', callback_data: 'bank_Vietinbank' },
            { text: 'Agribank', callback_data: 'bank_Agribank' },
            { text: 'Sacombank', callback_data: 'bank_Sacombank' }
        ],
        [
            { text: 'DongA Bank', callback_data: 'bank_DongA Bank' },
            { text: 'TPBank', callback_data: 'bank_TPBank' },
            { text: 'VIB', callback_data: 'bank_VIB' }
        ],
        [{ text: '🏦 Ngân hàng khác', callback_data: 'bank_other' }]
    ];

    if (lastWithdraw) {
        kb.unshift([
            {
                text: `🔄 ${lastWithdraw.bankName} - ${lastWithdraw.accountNumber}`,
                callback_data: 'bank_reuse'
            }
        ]);
    }

    return { inline_keyboard: kb };
}

const CONFIRMATION_KEYBOARD = {
    inline_keyboard: [
        [
            { text: '✅ Xác nhận', callback_data: 'withdraw_confirm' },
            { text: '❌ Hủy', callback_data: 'withdraw_cancel' }
        ]
    ]
};

/* ================== EXPORT ================== */

module.exports = {
    start: startWithdraw,
    handleCallback,
    handleStep: handleMessage
};

/* ================== START ================== */

async function startWithdraw(bot, msg, userStates) {
    userStates[msg.from.id] = {
        type: 'withdraw',
        step: 'amount',
        data: {},
        lock: false
    };

    await bot.sendMessage(
        msg.chat.id,
        '💸 <b>Chọn số tiền rút</b>',
        { parse_mode: 'HTML', reply_markup: AMOUNT_KEYBOARD }
    );
}

/* ================== CALLBACK ================== */

async function handleCallback(bot, query, userStates) {
    const userId = query.from.id;
    const state = userStates[userId];
    if (!state || state.lock) return;

    await bot.answerCallbackQuery(query.id);
    const data = query.data;

    const settings = await Setting.findOne({}) || {};
    const min = settings.minWithdraw || 50000;
    const max = settings.maxWithdraw || 100000000;

    /* ===== AMOUNT ===== */
    if (state.step === 'amount') {
        if (data === 'amount_manual') {
            state.step = 'amount_manual';
            return bot.sendMessage(userId, '✏️ Nhập số tiền muốn rút:');
        }

        let amount = 0;

        if (data === 'amount_all') {
            const acc = await Account.findOne({ userId });
            if (!acc) return bot.sendMessage(userId, '❌ Không tìm thấy tài khoản');
            amount = Math.floor(acc.balance / 1000) * 1000;
        } else {
            amount = parseInt(data.replace('amount_', ''));
        }

        if (!validateAmount(bot, userId, amount, min, max)) return;

        state.data.amount = amount;
        state.step = 'bank';

        const last = await Withdraw.findOne({ userId }).sort({ createdAt: -1 });

        return bot.sendMessage(
            userId,
            `🏦 Rút <b>${amount.toLocaleString()}đ</b>\nChọn ngân hàng:`,
            { parse_mode: 'HTML', reply_markup: bankKeyboard(last) }
        );
    }

    /* ===== BANK ===== */
    if (state.step === 'bank') {
        if (data === 'bank_reuse') {
            const last = await Withdraw.findOne({ userId }).sort({ createdAt: -1 });
            if (!last) return;

            state.data.bankName = last.bankName;
            state.data.accountNumber = last.accountNumber;
            state.data.accountName = last.accountName;

            state.step = 'confirmation';
            await showConfirmation(bot, userId, state.data);
            return;
        }

        if (data === 'bank_other') {
            state.step = 'bank_manual';
            return bot.sendMessage(userId, '🏦 Nhập tên ngân hàng:');
        }

        state.data.bankName = data.replace('bank_', '');
        state.step = 'account_number';
        return bot.sendMessage(userId, '🔢 Nhập số tài khoản:');
    }

    /* ===== CONFIRMATION ===== */
    if (state.step === 'confirmation') {
        if (data === 'withdraw_confirm') {
            state.lock = true;
            await bot.editMessageText('⏳ Đang xử lý yêu cầu của bạn...', {
                chat_id: query.message.chat.id,
                message_id: query.message.message_id
            });
            await processWithdraw(bot, userId, state.data);
            delete userStates[userId];
            return;
        }

        if (data === 'withdraw_cancel') {
            delete userStates[userId];
            await bot.editMessageText('❌ Yêu cầu rút tiền đã được hủy.', {
                chat_id: query.message.chat.id,
                message_id: query.message.message_id
            });
            return;
        }
    }
}

/* ================== MESSAGE ================== */

async function handleMessage(bot, msg, userStates) {
    const userId = msg.from.id;
    const state = userStates[userId];
    if (!state || state.lock) return;

    const text = msg.text;
    const settings = await Setting.findOne({}) || {};
    const min = settings.minWithdraw || 50000;
    const max = settings.maxWithdraw || 100000000;

    if (state.step === 'amount_manual') {
        const amount = parseInt(text.replace(/\D/g, ''));
        if (!validateAmount(bot, userId, amount, min, max)) return;

        state.data.amount = amount;
        state.step = 'bank';

        const last = await Withdraw.findOne({ userId }).sort({ createdAt: -1 });

        return bot.sendMessage(
            userId,
            `🏦 Rút <b>${amount.toLocaleString()}đ</b>\nChọn ngân hàng:`,
            { parse_mode: 'HTML', reply_markup: bankKeyboard(last) }
        );
    }

    if (state.step === 'bank_manual') {
        state.data.bankName = text;
        state.step = 'account_number';
        return bot.sendMessage(userId, '🔢 Nhập số tài khoản:');
    }

    if (state.step === 'account_number') {
        state.data.accountNumber = text;
        state.step = 'account_name';
        return bot.sendMessage(userId, '👤 Nhập tên chủ tài khoản (KHÔNG DẤU):');
    }

    if (state.step === 'account_name') {
        state.data.accountName = text;
        state.step = 'confirmation';
        await showConfirmation(bot, userId, state.data);
    }
}

/* ================== VALIDATE ================== */

function validateAmount(bot, userId, amount, min, max) {
    if (!amount || amount <= 0)
        return bot.sendMessage(userId, '❌ Số tiền không hợp lệ');
    if (amount < min)
        return bot.sendMessage(userId, `❌ Tối thiểu ${min.toLocaleString()}đ`);
    if (amount > max)
        return bot.sendMessage(userId, `❌ Tối đa ${max.toLocaleString()}đ`);
    return true;
}

/* ================== HELPERS ================== */

async function showConfirmation(bot, userId, data) {
    const confirmationMsg = `⚠️ <b>XÁC NHẬN THÔNG TIN RÚT TIỀN</b>\n\n` +
        `Vui lòng kiểm tra kỹ thông tin trước khi xác nhận:\n\n` +
        `💰 <b>Số tiền:</b> ${data.amount.toLocaleString()}đ\n` +
        `🏦 <b>Ngân hàng:</b> ${data.bankName}\n` +
        `🔢 <b>Số tài khoản:</b> ${data.accountNumber}\n` +
        `👤 <b>Tên chủ TK:</b> ${data.accountName}\n\n` +
        `<i>Hệ thống sẽ không chịu trách nhiệm nếu bạn nhập sai thông tin.</i>`;

    await bot.sendMessage(userId, confirmationMsg, {
        parse_mode: 'HTML',
        reply_markup: CONFIRMATION_KEYBOARD
    });
}

/* ================== PROCESS ================== */

async function processWithdraw(bot, userId, data) {
    try {
        const settings = await Setting.findOne({}) || {};
        const maxPerDay = settings.maxWithdrawalsPerDay || 3;

        const start = new Date();
        start.setHours(0, 0, 0, 0);

        const count = await Withdraw.countDocuments({
            userId,
            createdAt: { $gte: start }
        });

        if (count >= maxPerDay)
            return bot.sendMessage(userId, `❌ Giới hạn ${maxPerDay} lần/ngày`);

        const acc = await Account.findOne({ userId });
        if (!acc) return bot.sendMessage(userId, '❌ Không tìm thấy tài khoản');

        const wagering = settings.withdrawWageringReq || 1;
        const required = (acc.totalDeposit || 0) * wagering;

        if ((acc.totalBet || 0) < required) {
            return bot.sendMessage(
                userId,
                `❌ <b>CHƯA ĐỦ VÒNG CƯỢC</b>\n\n` +
                `- Tổng nạp: ${acc.totalDeposit.toLocaleString()}đ\n` +
                `- Yêu cầu: ${required.toLocaleString()}đ\n` +
                `- Đã cược: ${acc.totalBet.toLocaleString()}đ`,
                { parse_mode: 'HTML' }
            );
        }

        const updated = await Account.findOneAndUpdate(
            { userId, balance: { $gte: data.amount } },
            { $inc: { balance: -data.amount } },
            { new: true }
        );

        if (!updated)
            return bot.sendMessage(userId, '❌ Số dư không đủ');

        await Withdraw.create({
            userId,
            ...data,
            status: 0
        });

        await bot.sendMessage(
            userId,
            `✅ <b>HỆ THỐNG ĐÃ TIẾP NHẬN</b>\n\n` +
            `Yêu cầu rút tiền của bạn đang được xử lý.\n` +
            `Vui lòng chờ trong giây lát.`,
            { parse_mode: 'HTML' }
        );

    } catch (e) {
        console.error(e);
        bot.sendMessage(userId, '❌ Lỗi hệ thống');
    }
}
