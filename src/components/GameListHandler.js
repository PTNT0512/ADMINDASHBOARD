module.exports = {
    show: async (bot, msg) => {
        const text = `🎮 <b>DANH SÁCH TRÒ CHƠI</b>\n\n` +
                     `🎲 <b>Tài Xỉu</b> - Đỉnh cao xanh chín\n` +
                     `🎰 <b>Nổ Hũ</b> - Cơ hội đổi đời\n` +
                     `🃏 <b>Xóc Đĩa</b> - Dân gian kịch tính\n` +
                     `🔢 <b>Lô Đề</b> - Tỷ lệ ăn cao\n\n` +
                     `👉 <i>Vui lòng chọn phòng chơi hoặc chat lệnh để tham gia!</i>`;
        
        // Có thể thêm Inline Keyboard để link tới các nhóm game nếu cần
        await bot.sendMessage(msg.chat.id, text, { parse_mode: 'HTML' });
    }
};