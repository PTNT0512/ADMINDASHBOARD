const Account = require('../models/Account');
const CommissionSetting = require('../models/CommissionSetting');

module.exports = {
    show: async (bot, msg) => {
        const userId = msg.from.id;
        const account = await Account.findOne({ userId });
        
        if (!account) return;

        // Lấy cấu hình hoa hồng
        let setting = await CommissionSetting.findOne({ key: 'default' });
        if (!setting) setting = { rates: { 1: 0.005 } }; // Fallback

        const currentLevel = account.vip || 1;
        const currentRateVal = setting.rates[currentLevel] || 0.005;
        const currentRatePercent = (currentRateVal * 100).toFixed(1);

        const text = `🌹 <b>HOA HỒNG ĐẠI LÝ</b>\n\n` +
                     `🌟 Cấp độ hiện tại: <b>VIP ${currentLevel}</b>\n` +
                     `📈 Tỷ lệ hoa hồng: <b>${currentRatePercent}%</b>\n` +
                     `💰 Tổng hoa hồng hiện tại: <b>${(account.dailyPoints || 0).toLocaleString()} ₫</b>\n` +
                     `👥 Số người đã giới thiệu: <b>${account.ref || 0}</b>\n\n` +
                     `Liên hệ Admin để biết thêm chi tiết về chính sách đại lý.`;
        await bot.sendMessage(msg.chat.id, text, { parse_mode: 'HTML' });
    }
};