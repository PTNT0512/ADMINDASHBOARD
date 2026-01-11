const SupportMessage = require('../models/SupportMessage');

module.exports = {
    // Khi user bấm nút "Liên hệ CSKH"
    show: async (bot, msg, userStates, io) => {
        const userId = msg.from.id;
        
        // Đặt trạng thái user sang chế độ support (nếu userStates được cung cấp)
        if (userStates) {
            userStates[userId] = {
                type: 'support',
                step: 'chatting'
            };
        }

        const welcomeText = `👨‍💻 <b>KẾT NỐI HỖ TRỢ VIÊN</b>\n\n` +
                            `Bạn đã được kết nối với nhân viên hỗ trợ.\n` +
                            `Vui lòng gửi tin nhắn, hình ảnh hoặc câu hỏi của bạn tại đây.\n` +
                            `Chúng tôi sẽ phản hồi sớm nhất có thể.\n\n` +
                            `<i>Gõ /menu để thoát chế độ chat và quay lại menu chính.</i>`;

        await bot.sendMessage(userId, welcomeText, { parse_mode: 'HTML' });
    },

    // Xử lý tin nhắn khách hàng gửi đến
    handleMessage: async (bot, msg, userStates, io) => {
        const userId = msg.from.id;
        const username = msg.from.first_name || msg.from.username || 'User';
        const text = msg.text;

        // Logic thoát chat đã được xử lý ở main-bot-service hoặc tại đây nếu cần
        try {
            const newMessage = await SupportMessage.create({
                userId: userId,
                username: username,
                content: text,
                direction: 'in',
                isRead: false
            });
            if (io) {
                io.emit('new_message', newMessage);
            }
        } catch (error) {
            console.error('Lỗi lưu tin nhắn support:', error);
        }
    },

    // Xử lý khi người dùng gửi ảnh
    handlePhoto: async (bot, msg, userStates, io) => {
        const userId = msg.from.id;
        try {
            const photo = msg.photo[msg.photo.length - 1]; // Lấy ảnh chất lượng cao nhất
            const fileStream = bot.getFileStream(photo.file_id);
            
            const chunks = [];
            for await (const chunk of fileStream) {
                chunks.push(chunk);
            }
            const buffer = Buffer.concat(chunks);
            const imageBase64 = `data:image/jpeg;base64,${buffer.toString('base64')}`;

            const newMessage = await SupportMessage.create({
                userId: userId,
                username: msg.from.first_name || msg.from.username,
                content: msg.caption || '', // Lưu caption nếu có
                imageBase64: imageBase64,
                direction: 'in',
                isRead: false
            });
            if (io) {
                io.emit('new_message', newMessage);
            }
        } catch (error) {
            console.error('Lỗi xử lý ảnh từ user:', error);
        }
    }
};