module.exports = {
    show: async (bot, msg) => {
        const text = `🎉 <b>SỰ KIỆN HOT</b>\n\n` +
                     `1. <b>Đua Top Tuần:</b> Tổng giải thưởng 100M\n` +
                     `2. <b>X2 Nạp Đầu:</b> Cho thành viên mới\n` +
                     `3. <b>Điểm Danh Hàng Ngày:</b> Nhận quà miễn phí\n\n` +
                     `Bấm nút bên dưới để điểm danh ngay hoặc gõ <code>/diemdanh</code>.`;
        await bot.sendMessage(msg.chat.id, text, {
            parse_mode: 'HTML',
            reply_markup: {
                inline_keyboard: [
                    [{ text: '✅ Điểm Danh Ngay', callback_data: 'event_checkin' }],
                ],
            },
        });
    }
};
