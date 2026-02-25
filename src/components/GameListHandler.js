const Setting = require('../models/Setting');
const axios = require('axios');

module.exports = {
    show: async (bot, msg) => {
        const settings = await Setting.findOne({});
        const imageUrl = settings?.gameListImage;

        const caption = `🎮 <b>DANH SÁCH TRÒ CHƠI</b>\n\n` +
                        `👉 <i>Vui lòng chọn trò chơi bên dưới để tham gia!</i>`;
        
        const gameKeyboard = {
            inline_keyboard: [
                [{ text: '🎲 Tài Xỉu Cào', callback_data: 'game_tx_cao' }, { text: '🎲 Tài Xỉu Nặn', callback_data: 'game_tx_nan' }],
                [{ text: '💿 Xóc Dĩa', callback_data: 'game_xocdia' }, { text: '🦀 Bầu Cua', callback_data: 'game_baucua' }],
                [{ text: '📈 Tài Xỉu Tele', callback_data: 'game_tx_tele' }, { text: '📊 Chẵn Lẻ Tele', callback_data: 'game_cl_tele' }],
                [{ text: '🎲 TX Xúc Xắc Tele', callback_data: 'game_tx_dice' }, { text: '🎲 CL Xúc Xắc Tele', callback_data: 'game_cl_dice' }],
                [{ text: '🎰 Slot Tele', callback_data: 'game_slot' }, { text: '🎱 Plinko', callback_data: 'game_plinko' }],
                [{ text: '💣 Booms', callback_data: 'game_booms' }, { text: '🍒 Xèng', callback_data: 'game_xeng' }]
            ]
        };

        try {
            if (imageUrl && imageUrl.startsWith('http')) {
                // Tải ảnh về dưới dạng buffer để gửi, tăng độ tin cậy
                const response = await axios.get(imageUrl, { 
                    responseType: 'arraybuffer',
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                    }
                });
                const imageBuffer = Buffer.from(response.data, 'binary');

                await bot.sendPhoto(msg.chat.id, imageBuffer, { 
                    caption: caption, 
                    parse_mode: 'HTML', 
                    reply_markup: gameKeyboard 
                }, { filename: 'game_list.jpg', contentType: 'image/jpeg' });
            } else {
                await bot.sendMessage(msg.chat.id, caption, { 
                    parse_mode: 'HTML', 
                    reply_markup: gameKeyboard 
                });
            }
        } catch (error) {
            console.error('Lỗi tải ảnh menu game (Buffer):', error.message);
            
            // Fallback 1: Thử gửi URL trực tiếp nếu tải buffer thất bại (ví dụ lỗi 429)
            if (imageUrl && imageUrl.startsWith('http')) {
                try {
                    await bot.sendPhoto(msg.chat.id, imageUrl, { 
                        caption: caption, 
                        parse_mode: 'HTML', 
                        reply_markup: gameKeyboard 
                    });
                    return; // Thành công với Fallback URL
                } catch (urlError) {
                    console.error('Lỗi gửi ảnh qua URL:', urlError.message);
                }
            }

            // Fallback 2: Gửi text nếu cả 2 cách trên đều lỗi
            await bot.sendMessage(msg.chat.id, caption, { 
                parse_mode: 'HTML', 
                reply_markup: gameKeyboard 
            });
        }
    }
};