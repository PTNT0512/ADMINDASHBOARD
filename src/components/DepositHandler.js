const depositMethodsKeyboard = {
    inline_keyboard: [
        [
            { text: '🏦 Banking', callback_data: 'deposit_banking' },
            { text: 'Momo', callback_data: 'deposit_momo' }
        ],
        [
            { text: 'ZaloPay', callback_data: 'deposit_zalopay' },
            { text: '💳 Thẻ cào', callback_data: 'deposit_card' }
        ],
        [
            { text: '₮ USDT', callback_data: 'deposit_usdt' },
            { text: '🤝 Nạp P2P', callback_data: 'deposit_p2p' }
        ]
    ]
};

module.exports = {
    show: async (bot, msg) => {
        const text = `💰 Vui lòng chọn phương thức nạp tiền:`;
        await bot.sendMessage(msg.chat.id, text, {
            reply_markup: depositMethodsKeyboard
        });
    }
};