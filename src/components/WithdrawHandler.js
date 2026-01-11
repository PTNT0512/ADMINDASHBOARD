const Account = require('../models/Account');
const Withdraw = require('../models/Withdraw');

module.exports = {
    start: async (bot, msg, userStates) => {
        userStates[msg.from.id] = {
            type: 'withdraw',
            step: 'awaiting_withdraw_amount',
            data: {}
        };
        await bot.sendMessage(msg.chat.id, '💸 Vui lòng nhập <b>số tiền</b> bạn muốn rút:', { parse_mode: 'HTML' });
    },

    handleStep: async (bot, msg, userStates) => {
        const userId = msg.from.id;
        const state = userStates[userId];
        const text = msg.text;

        switch (state.step) {
            case 'awaiting_withdraw_amount':
                const amount = parseInt(text);
                if (isNaN(amount) || amount <= 0) {
                    return bot.sendMessage(userId, '❌ Số tiền không hợp lệ. Vui lòng nhập lại một số dương.');
                }
                state.data.amount = amount;
                state.step = 'awaiting_bank_name';
                await bot.sendMessage(userId, '🏦 Vui lòng nhập <b>Tên Ngân hàng</b> (Ví dụ: VCB, TCB, MB):', { parse_mode: 'HTML' });
                break;

            case 'awaiting_bank_name':
                state.data.bankName = text;
                state.step = 'awaiting_account_number';
                await bot.sendMessage(userId, '🔢 Vui lòng nhập <b>Số tài khoản</b>:', { parse_mode: 'HTML' });
                break;

            case 'awaiting_account_number':
                state.data.accountNumber = text;
                state.step = 'awaiting_account_name';
                await bot.sendMessage(userId, '👤 Vui lòng nhập <b>Tên chủ tài khoản</b> (viết không dấu):', { parse_mode: 'HTML' });
                break;

            case 'awaiting_account_name':
                state.data.accountName = text;
                await processWithdraw(bot, userId, state.data);
                delete userStates[userId]; // Kết thúc hội thoại
                break;
        }
    }
};

async function processWithdraw(bot, userId, data) {
    const { amount, bankName, accountNumber, accountName } = data;
    try {
        const account = await Account.findOne({ userId });
        if (!account || account.balance < amount) {
            return bot.sendMessage(userId, "❌ Số dư không đủ để thực hiện lệnh rút này.");
        }

        await Withdraw.create({
            userId,
            amount,
            bankName,
            accountNumber,
            accountName,
            status: 0
        });

        account.balance -= amount;
        await account.save();

        const confirmationMsg = `✅ <b>YÊU CẦU RÚT TIỀN THÀNH CÔNG</b>\n\n` +
                              `- Số tiền: <b>${amount.toLocaleString()} ₫</b>\n` +
                              `- Ngân hàng: ${bankName}\n` +
                              `- STK: ${accountNumber}\n\n` +
                              `Hệ thống sẽ xử lý trong vài phút.`;
        await bot.sendMessage(userId, confirmationMsg, { parse_mode: 'HTML' });
    } catch (err) { console.error(err); }
}