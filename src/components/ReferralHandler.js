module.exports = {
    show: async (bot, msg) => {
        const userId = msg.from.id;
        const botInfo = await bot.getMe();
        const refLink = `https://t.me/${botInfo.username}?start=${userId}`;

        const text = `🤝 <b>GIỚI THIỆU BẠN BÈ</b>\n\n` +
                     `Mời bạn bè tham gia để nhận hoa hồng trọn đời!\n\n` +
                     `🔗 <b>Link giới thiệu của bạn:</b>\n` +
                     `${refLink}\n\n` +
                     `<i>(Nhấn vào link để copy và gửi cho bạn bè)</i>`;
        
        await bot.sendMessage(msg.chat.id, text, { parse_mode: 'HTML' });
    }
};