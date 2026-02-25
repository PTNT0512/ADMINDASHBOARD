const Account = require('../models/Account');

// Cấu hình cấp bậc VIP và quân hàm
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

// Bàn phím chức năng tài khoản
const accountMenuKeyboard = {
    inline_keyboard: [
        [
            { text: '💰 Nạp Tiền', callback_data: 'account_deposit' },
            { text: '💸 Rút Tiền', callback_data: 'account_withdraw' },
            { text: '🤝 Chuyển Tiền', callback_data: 'account_transfer' }
        ],
        [
            { text: '📥 Lịch sử Nạp', callback_data: 'history_deposit' },
            { text: '📤 Lịch sử Rút', callback_data: 'history_withdraw' },
            { text: '📊 Lịch sử Cược', callback_data: 'history_betting' }
        ],
        [
            { text: '🎁 Nhập Giftcode', callback_data: 'account_giftcode' },
            { text: '🛒 Mua Giftcode', callback_data: 'shop_giftcode' }
        ],
        [
            { text: '💎 Đổi điểm VIP', callback_data: 'exchange_vip_points' },
            { text: '📬 Hòm Quà', callback_data: 'mailbox' },
            { text: '🔐 Két Sắt', callback_data: 'account_safe' }
        ]
    ]
};

module.exports = {
    show: async (bot, msg) => {
        const userId = msg.from.id;
        const account = await Account.findOne({ userId });
        
        if (!account) return bot.sendMessage(msg.chat.id, "❌ Bạn chưa đăng ký. Gõ /start để bắt đầu.");

        const currentLevel = account.vip || 1;
        const currentVipPoints = account.vipPoints || 0;
        
        // Tìm cấp bậc hiện tại và cấp bậc tiếp theo
        const currentRank = RANKS.find(r => r.level === currentLevel) || RANKS[0];
        const nextRank = RANKS.find(r => r.level === currentLevel + 1);

        let progressText = 'Đã đạt cấp bậc cao nhất!';
        if (nextRank) {
            const pointsForNextLevel = nextRank.pointsNeeded;
            progressText = `${currentVipPoints.toLocaleString()}/${pointsForNextLevel.toLocaleString()}`;
        }

        const infoText = `👤 <b>Tên tài khoản:</b> ${msg.from.first_name || msg.from.username}\n` +
                         `💳 <b>ID Tài khoản:</b> <code>${account.userId}</code>\n` +
                         `💰 <b>Số dư:</b> ${account.balance.toLocaleString()} ₫\n\n` +
                         `👑 <b>Cấp Vip:</b> ${currentLevel}  ${currentRank.icon} (${currentRank.name})\n` +
                         `🔄 <b>Số điểm Vip:</b> ${currentVipPoints.toLocaleString()}\n` +
                         `🚀 <b>Tiến trình điểm vip:</b> ${progressText}\n` +
                         `🖐️ <b>Số điểm vip đã sử dụng:</b> ${(account.usedVipPoints || 0).toLocaleString()}`;
                         
        await bot.sendMessage(msg.chat.id, infoText, {
            parse_mode: 'HTML',
            reply_markup: accountMenuKeyboard
        });
    }
};