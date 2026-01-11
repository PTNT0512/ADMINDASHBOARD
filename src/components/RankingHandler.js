const Account = require('../models/Account');

module.exports = {
    show: async (bot, msg) => {
        try {
            // Lấy top 10 người chơi có số dư cao nhất
            const topUsers = await Account.find().sort({ balance: -1 }).limit(10);
            
            let text = `🏆 <b>BẢNG XẾP HẠNG ĐẠI GIA</b> 🏆\n\n`;
            
            topUsers.forEach((user, index) => {
                const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `<b>#${index + 1}</b>`;
                const maskedId = String(user.userId).slice(0, -3) + '***';
                text += `${medal} ID: ${maskedId} - 💰 ${user.balance.toLocaleString()} ₫\n`;
            });

            await bot.sendMessage(msg.chat.id, text, { parse_mode: 'HTML' });
        } catch (error) {
            await bot.sendMessage(msg.chat.id, '❌ Không thể tải bảng xếp hạng lúc này.');
        }
    }
};