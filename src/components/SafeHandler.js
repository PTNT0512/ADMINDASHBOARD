const Account = require('../models/Account');

const safeSessions = {}; // Lưu session đăng nhập: { userId: timestamp }
const SESSION_TIMEOUT = 5 * 60 * 1000; // 5 phút

const SAFE_MENU_KEYBOARD = {
    inline_keyboard: [
        [{ text: '📥 Nạp Két', callback_data: 'safe_deposit' }, { text: '📤 Rút Két', callback_data: 'safe_withdraw' }],
        [{ text: '🔐 Đổi Mật Khẩu', callback_data: 'safe_change_pass' }]
    ]
};

const showMenu = async (bot, userId) => {
    const account = await Account.findOne({ userId });
    const msg = `🔐 <b>KÉT SẮT AN TOÀN</b>\n\n` +
                `💰 Số dư ví: <b>${(account.balance || 0).toLocaleString()} đ</b>\n` +
                `🛡 Số dư két: <b>${(account.safe || 0).toLocaleString()} đ</b>\n\n` +
                `<i>Vui lòng chọn thao tác bên dưới:</i>`;
    await bot.sendMessage(userId, msg, { parse_mode: 'HTML', reply_markup: SAFE_MENU_KEYBOARD });
};

module.exports = {
    start: async (bot, userId, userStates) => {
        const account = await Account.findOne({ userId });
        if (!account) return bot.sendMessage(userId, '❌ Lỗi tài khoản.');

        // Xóa session cũ để bắt buộc đăng nhập lại mỗi khi vào két
        delete safeSessions[userId];

        if (!account.passsafe) {
            userStates[userId] = { type: 'safe_create_pass' };
            await bot.sendMessage(userId, '🔐 <b>TẠO MẬT KHẨU KÉT SẮT</b>\n\nBạn chưa có mật khẩu két.\nVui lòng nhập <b>6 chữ số</b> để tạo mật khẩu mới:', { parse_mode: 'HTML' });
        } else {
            userStates[userId] = { type: 'safe_login' };
            await bot.sendMessage(userId, '🔐 <b>ĐĂNG NHẬP KÉT SẮT</b>\n\nVui lòng nhập mật khẩu (6 số):', { parse_mode: 'HTML' });
        }
    },

    handleCallback: async (bot, callbackQuery, userStates) => {
        const userId = callbackQuery.from.id;
        const data = callbackQuery.data;

        // Kiểm tra session trước khi thực hiện hành động
        if (!safeSessions[userId] || (Date.now() - safeSessions[userId] > SESSION_TIMEOUT)) {
            delete safeSessions[userId];
            delete userStates[userId];
            await bot.sendMessage(userId, '⏳ <b>Phiên đăng nhập đã hết hạn.</b>', { parse_mode: 'HTML' });
            
            // Yêu cầu đăng nhập lại
            const account = await Account.findOne({ userId });
            if (account && account.passsafe) {
                userStates[userId] = { type: 'safe_login' };
                return bot.sendMessage(userId, '🔐 <b>ĐĂNG NHẬP KÉT SẮT</b>\n\nVui lòng nhập mật khẩu (6 số):', { parse_mode: 'HTML' });
            }
            return;
        }
        safeSessions[userId] = Date.now(); // Gia hạn session
        
        if (data === 'safe_deposit') {
            userStates[userId] = { type: 'safe_deposit_amount' };
            await bot.sendMessage(userId, '📥 <b>NẠP TIỀN VÀO KÉT</b>\n\nNhập số tiền muốn nạp:', { parse_mode: 'HTML' });
        } else if (data === 'safe_withdraw') {
            userStates[userId] = { type: 'safe_withdraw_amount' };
            await bot.sendMessage(userId, '📤 <b>RÚT TIỀN TỪ KÉT</b>\n\nNhập số tiền muốn rút:', { parse_mode: 'HTML' });
        } else if (data === 'safe_change_pass') {
            userStates[userId] = { type: 'safe_change_pass_old' };
            await bot.sendMessage(userId, '🔐 <b>ĐỔI MẬT KHẨU</b>\n\nVui lòng nhập mật khẩu CŨ:', { parse_mode: 'HTML' });
        }
    },

    handleStep: async (bot, msg, userStates) => {
        const userId = msg.from.id;
        const state = userStates[userId];
        if (!msg.text) return;
        const text = msg.text.trim();

        // Kiểm tra session cho các thao tác bên trong két (trừ lúc đăng nhập/tạo pass)
        if (state.type !== 'safe_login' && state.type !== 'safe_create_pass') {
            if (!safeSessions[userId] || (Date.now() - safeSessions[userId] > SESSION_TIMEOUT)) {
                delete safeSessions[userId];
                delete userStates[userId];
                return bot.sendMessage(userId, '⏳ <b>Phiên đăng nhập đã hết hạn.</b>\nVui lòng chọn lại menu Két Sắt.', { parse_mode: 'HTML' });
            }
            safeSessions[userId] = Date.now(); // Gia hạn session
        }

        try {
            const account = await Account.findOne({ userId });
            if (!account) return;

            switch (state.type) {
                case 'safe_create_pass':
                    if (!/^\d{6}$/.test(text)) return bot.sendMessage(userId, '❌ Mật khẩu phải là 6 chữ số. Vui lòng nhập lại.');
                    account.passsafe = text;
                    await account.save();
                    safeSessions[userId] = Date.now(); // Tạo session mới
                    delete userStates[userId];
                    await bot.sendMessage(userId, '✅ Tạo mật khẩu thành công!');
                    await showMenu(bot, userId);
                    break;

                case 'safe_login':
                    if (text !== account.passsafe) return bot.sendMessage(userId, '❌ Mật khẩu sai. Vui lòng nhập lại.');
                    safeSessions[userId] = Date.now(); // Tạo session mới
                    delete userStates[userId];
                    await showMenu(bot, userId);
                    break;

                case 'safe_deposit_amount':
                    const depAmount = parseInt(text.replace(/[^0-9]/g, ''));
                    if (isNaN(depAmount) || depAmount <= 0) return bot.sendMessage(userId, '❌ Số tiền không hợp lệ.');
                    if (account.balance < depAmount) return bot.sendMessage(userId, '❌ Số dư ví không đủ.');
                    
                    account.balance -= depAmount;
                    account.safe = (account.safe || 0) + depAmount;
                    await account.save();
                    
                    delete userStates[userId];
                    await bot.sendMessage(userId, `✅ Đã nạp <b>${depAmount.toLocaleString()}đ</b> vào két.`, { parse_mode: 'HTML' });
                    await showMenu(bot, userId);
                    break;

                case 'safe_withdraw_amount':
                    const withAmount = parseInt(text.replace(/[^0-9]/g, ''));
                    if (isNaN(withAmount) || withAmount <= 0) return bot.sendMessage(userId, '❌ Số tiền không hợp lệ.');
                    if ((account.safe || 0) < withAmount) return bot.sendMessage(userId, '❌ Số dư két không đủ.');
                    
                    account.safe -= withAmount;
                    account.balance += withAmount;
                    await account.save();
                    
                    delete userStates[userId];
                    await bot.sendMessage(userId, `✅ Đã rút <b>${withAmount.toLocaleString()}đ</b> về ví.`, { parse_mode: 'HTML' });
                    await showMenu(bot, userId);
                    break;

                case 'safe_change_pass_old':
                    if (text !== account.passsafe) return bot.sendMessage(userId, '❌ Mật khẩu cũ không đúng.');
                    userStates[userId] = { type: 'safe_change_pass_new' };
                    await bot.sendMessage(userId, '🆕 Nhập mật khẩu MỚI (6 số):');
                    break;

                case 'safe_change_pass_new':
                    if (!/^\d{6}$/.test(text)) return bot.sendMessage(userId, '❌ Mật khẩu phải là 6 chữ số.');
                    account.passsafe = text;
                    await account.save();
                    delete userStates[userId];
                    await bot.sendMessage(userId, '✅ Đổi mật khẩu thành công!');
                    await showMenu(bot, userId);
                    break;
            }
        } catch (error) {
            console.error('[SafeHandler Error]', error);
            bot.sendMessage(userId, '❌ Đã có lỗi xảy ra trong quá trình xử lý. Vui lòng thử lại.');
            delete userStates[userId];
        }
    }
};