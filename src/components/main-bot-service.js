const TelegramBot = require('node-telegram-bot-api');
const Account = require('../models/Account.js');
const Deposit = require('../models/Deposit.js');
const Withdraw = require('../models/Withdraw.js');
const BankAuto = require('../models/BankAuto.js');
const Setting = require('../models/Setting.js');

// Import các bộ xử lý tính năng riêng biệt
const GameListHandler = require('./GameListHandler');
const AccountHandler = require('./AccountHandler');
const DepositHandler = require('./DepositHandler');
const WithdrawHandler = require('./WithdrawHandler');
const EventHandler = require('./EventHandler');
const RankingHandler = require('./RankingHandler');
const ReferralHandler = require('./ReferralHandler');
const CommissionHandler = require('./CommissionHandler');

let mainBotInstance = null;
let isProcessing = false; // Lock để ngăn chặn các cuộc gọi đồng thời

// Lưu trạng thái hội thoại của người dùng
const userStates = {};
const depositCooldowns = {}; // Lưu thời gian tạo lệnh nạp gần nhất

// --- Dữ liệu FAQ ---
const faqData = [
    {
        id: 'faq_deposit',
        question: 'Làm sao để nạp tiền?',
        answer: 'Để nạp tiền, bạn vui lòng chọn mục "💰 Nạp tiền" trên menu chính hoặc gõ lệnh `/nap [số tiền]`. Hệ thống sẽ hướng dẫn bạn chuyển khoản.'
    },
    {
        id: 'faq_withdraw',
        question: 'Rút tiền bao lâu thì về?',
        answer: 'Thời gian xử lý rút tiền thường từ 5-15 phút. Nếu quá 30 phút chưa nhận được, vui lòng liên hệ Admin.'
    },
    {
        id: 'faq_game',
        question: 'Luật chơi game?',
        answer: 'Kết quả dựa trên tổng điểm 3 xúc xắc:\n- 4-10 điểm: Xỉu\n- 11-17 điểm: Tài\n- 3 hoặc 18 điểm: Nổ hũ (Thưởng lớn).'
    },
    {
        id: 'faq_contact',
        question: 'Liên hệ hỗ trợ?',
        answer: 'Bạn có thể chat trực tiếp với Admin qua tài khoản: @AdminUser (Vui lòng thay bằng user thật).'
    }
];

// --- Bàn phím Menu Chính ---
const mainMenuKeyboard = {
    keyboard: [
        [
            { text: '🎮 Danh sách Game' },
            { text: '👤 Tài Khoản' }
        ],
        [
            { text: '💰 Nạp Tiền' },
            { text: '💸 Rút Tiền' }
        ],
        [
            { text: '🎉 Sự Kiện' },
            { text: '🏆 Bảng Xếp Hạng' }
        ],
        [
            { text: '🤝 Giới Thiệu Bạn Bè' },
            { text: '🌹 Hoa hồng' }
        ],
        [
            { text: '📞 Liên Hệ CSKH' }
        ]
    ],
    resize_keyboard: true
};

/**
 * Khởi chạy hoặc cập nhật Bot Chính (Main Bot)
 */
async function startMainBot(botConfig) {
    if (isProcessing) {
        console.warn('[Main Bot] Yêu cầu bị bỏ qua vì đang có một tiến trình khác.');
        return;
    }
    isProcessing = true;

    try {
        // --- Logic để DỪNG bot ---
        if (!botConfig || botConfig.status !== 1) {
            if (mainBotInstance) {
                console.log(`[Main Bot] Bot '${botConfig?.name || 'Main'}' đang được tắt...`);
                // 1. Gỡ bỏ toàn bộ listener để không xử lý tin nhắn mới
                mainBotInstance.removeAllListeners();
                // 2. Dừng polling ngay lập tức
                try {
                    await mainBotInstance.stopPolling();
                } catch (err) {
                    console.warn(`[Main Bot] stopPolling ignored error: ${err.message}`);
                }
                // 3. (Tùy chọn) Đóng kết nối nếu có
                if (mainBotInstance.close) { try { await mainBotInstance.close(); } catch(e) {} }
                
                mainBotInstance = null;
                console.log(`[Main Bot] Bot đã được dừng.`);
            }
            return;
        }

        // --- Logic để BẬT hoặc KHỞI ĐỘNG LẠI bot ---
        if (!botConfig.token) {
            console.error('[Main Bot] Thiếu token để khởi chạy.');
            return;
        }

        // Dừng instance cũ nếu nó đang tồn tại
        if (mainBotInstance) {
            console.log('[Main Bot] Đang khởi động lại... Dừng instance cũ.');
            // 1. Gỡ bỏ toàn bộ listener
            mainBotInstance.removeAllListeners();
            // 2. Dừng polling
            try {
                await mainBotInstance.stopPolling();
            } catch (err) {
                console.warn(`[Main Bot] stopPolling ignored error: ${err.message}`);
            }
            // 3. Đóng kết nối
            if (mainBotInstance.close) { try { await mainBotInstance.close(); } catch(e) {} }

            mainBotInstance = null; // Đảm bảo biến được xóa
            
            // Đợi 2 giây để Telegram Server cập nhật trạng thái ngắt kết nối
            await new Promise(resolve => setTimeout(resolve, 2000));
        }

        console.log(`[Main Bot] Bot '${botConfig.name}' đang khởi tạo...`);
        // Khởi tạo với polling: false để kiểm soát thủ công
        const bot = new TelegramBot(botConfig.token, { polling: false });

        // Kiểm tra kết nối ngay khi khởi chạy
        // Xóa webhook (nếu có) để đảm bảo polling hoạt động trơn tru
        await bot.getMe(); // Cần gọi getMe trước khi có thể dùng các hàm khác
        await bot.deleteWebHook();
        
        // Bắt đầu polling thủ công sau khi đã dọn dẹp xong
        await bot.startPolling();

        const me = await bot.getMe();
        console.log(`✅ [Main Bot] Kết nối thành công: @${me.username}`);

        // Gán vào biến toàn cục sau khi đã chắc chắn kết nối thành công
        mainBotInstance = bot;

        // Lệnh /start: Đăng ký tài khoản
        bot.onText(/\/start(?: (.+))?|\/menu/, async (msg, match) => {
            const userId = msg.from.id;
            const username = msg.from.first_name || 'Người dùng';
            const refId = match && match[1] ? parseInt(match[1]) : null; // Lấy ID người giới thiệu từ link start

            try {
                let account = await Account.findOne({ userId });
                if (!account) {
                    const newAccountData = { userId, balance: 0, status: 1 };
                    
                    // Xử lý giới thiệu
                    if (refId && refId !== userId) {
                        const referrer = await Account.findOne({ userId: refId });
                        if (referrer) {
                            newAccountData.invitedBy = refId;
                            await Account.findOneAndUpdate({ userId: refId }, { $inc: { ref: 1 } }); // Tăng số lượng ref cho người mời
                        }
                    }

                    await Account.create(newAccountData);
                    bot.sendMessage(msg.chat.id, `👋 Chào mừng <b>${username}</b>!\nTài khoản đã được tạo. ID: <code>${userId}</code>\n\nChọn một chức năng bên dưới để bắt đầu:`, { 
                        parse_mode: 'HTML',
                        reply_markup: mainMenuKeyboard
                    });
                } else {
                    bot.sendMessage(msg.chat.id, `👋 Chào mừng trở lại, <b>${username}</b>!\n\nBạn muốn thực hiện tác vụ nào?`, { 
                        parse_mode: 'HTML',
                        reply_markup: mainMenuKeyboard
                    });
                }
            } catch (err) { console.error(err); }
        });

        // Lệnh /info: Xem số dư
        bot.onText(/\/info/, async (msg) => {
            const userId = msg.from.id;
            try {
                const account = await Account.findOne({ userId });
                if (!account) return bot.sendMessage(msg.chat.id, "❌ Bạn chưa đăng ký. Gõ /start.");
                bot.sendMessage(msg.chat.id, `📊 <b>THÔNG TIN</b>\n🆔 ID: <code>${account.userId}</code>\n💰 Số dư: <b>${account.balance.toLocaleString()} ₫</b>`, { parse_mode: 'HTML' });
            } catch (err) { console.error(err); }
        });

        // Lệnh /nap [số tiền]
        bot.onText(/\/nap (\d+)/, async (msg, match) => {
            const amount = parseInt(match[1]);
            const userId = msg.from.id;

            // Chống spam: Giới hạn 30s/lần
            const lastTime = depositCooldowns[userId] || 0;
            const now = Date.now();
            if (now - lastTime < 30000) {
                return bot.sendMessage(msg.chat.id, `⏳ Bạn thao tác quá nhanh. Vui lòng đợi ${Math.ceil((30000 - (now - lastTime)) / 1000)}s.`);
            }
            depositCooldowns[userId] = now;

            if (amount < 10000) return bot.sendMessage(msg.chat.id, "❌ Tối thiểu 10,000 ₫");
            try {
                await Deposit.create({ userId: msg.from.id, amount, method: 'Bot', status: 0 });
                bot.sendMessage(msg.chat.id, `✅ Đã gửi yêu cầu nạp <b>${amount.toLocaleString()} ₫</b>.`, { parse_mode: 'HTML' });
            } catch (err) { console.error(err); }
        });

        // Lệnh /rut [số tiền] [ngân hàng] [stk] [tên]
        bot.onText(/\/rut (\d+) (.+) (.+) (.+)/, async (msg, match) => {
            const amount = parseInt(match[1]);
            const userId = msg.from.id;
            try {
                const account = await Account.findOne({ userId });
                if (!account || account.balance < amount) return bot.sendMessage(msg.chat.id, "❌ Số dư không đủ.");
                await Withdraw.create({ userId, amount, bankName: match[2], accountNumber: match[3], accountName: match[4], status: 0 });
                account.balance -= amount;
                await account.save();
                bot.sendMessage(msg.chat.id, `✅ Đã gửi yêu cầu rút <b>${amount.toLocaleString()} ₫</b>.`, { parse_mode: 'HTML' });
            } catch (err) { console.error(err); }
        });

        // --- Xử lý hội thoại từng bước ---
        bot.on('message', async (msg) => {
            const userId = msg.from.id;
            const state = userStates[userId];

            // Nếu đang trong quy trình rút tiền, chuyển cho WithdrawHandler xử lý
            if (state && state.type === 'withdraw') {
                await WithdrawHandler.handleStep(bot, msg, userStates);
                return;
            }

            // --- Xử lý Menu Reply Keyboard (Ưu tiên) ---
            const text = msg.text;
            
            switch (text) {
                case '🎮 Danh sách Game': await GameListHandler.show(bot, msg); break;
                case '👤 Tài Khoản': await AccountHandler.show(bot, msg); break;
                case '💰 Nạp Tiền': await DepositHandler.show(bot, msg); break;
                case '💸 Rút Tiền': await WithdrawHandler.start(bot, msg, userStates); break;
                case '🎉 Sự Kiện': await EventHandler.show(bot, msg); break;
                case '🏆 Bảng Xếp Hạng': await RankingHandler.show(bot, msg); break;
                case '🤝 Giới Thiệu Bạn Bè': await ReferralHandler.show(bot, msg); break;
                case '🌹 Hoa hồng': await CommissionHandler.show(bot, msg); break;
                case '📞 Liên Hệ CSKH':
                    const settings = await Setting.findOne({});
                    await bot.sendMessage(userId, settings.cskhMessage || 'Vui lòng liên hệ Admin để được hỗ trợ.');
                    break;
                case '❓ Câu hỏi thường gặp (FAQ)': 
                    // Logic FAQ cũ (nếu muốn giữ lại)
                    // ...
                    break;
            }
        });

        // --- Xử lý các nút bấm từ Inline Keyboard ---
        bot.on('callback_query', async (callbackQuery) => {
            const msg = callbackQuery.message;
            const data = callbackQuery.data;

            bot.answerCallbackQuery(callbackQuery.id);

            // --- Xử lý các nút từ menu nạp tiền ---
            if (data.startsWith('deposit_')) {
                const method = data.split('_')[1];
                if (method === 'banking') {
                    const bankingInfoText = `💳 <b>Nạp tiền qua Chuyển khoản Ngân hàng</b>\n\n` +
                        `➡️ <b>Cách lấy thông tin nạp:</b>\n` +
                        `🔸 Gõ lệnh: <code>/napbank [số tiền]</code>\n` +
                        `Ví dụ: <code>/napbank 100000</code>\n\n` +
                        `🔸 Hoặc bấm nút số tiền bên dưới để lấy nhanh.\n\n` +
                        `⚠️ <b>Lưu ý:</b>\n` +
                        `✅ Chuyển đúng SỐ TIỀN và NỘI DUNG được cung cấp.\n` +
                        `✅ Mỗi lần nạp cần lấy thông tin MỚI.\n` +
                        `🚫 Không dùng thông tin cũ cho giao dịch sau.\n` +
                        `💰 Nạp tối thiểu: 20.000đ`;

                    const quickAmountKeyboard = {
                        inline_keyboard: [
                            [{ text: '20K', callback_data: 'napbank_20000' }, { text: '30K', callback_data: 'napbank_30000' }, { text: '50K', callback_data: 'napbank_50000' }],
                            [{ text: '100K', callback_data: 'napbank_100000' }, { text: '200K', callback_data: 'napbank_200000' }, { text: '500K', callback_data: 'napbank_500000' }],
                            [{ text: '1M', callback_data: 'napbank_1000000' }, { text: '2M', callback_data: 'napbank_2000000' }, { text: '5M', callback_data: 'napbank_5000000' }],
                            [{ text: '10M', callback_data: 'napbank_10000000' }, { text: '20M', callback_data: 'napbank_20000000' }, { text: '50M', callback_data: 'napbank_50000000' }]
                        ]
                    };
                    bot.editMessageText(bankingInfoText, { chat_id: msg.chat.id, message_id: msg.message_id, parse_mode: 'HTML', reply_markup: quickAmountKeyboard }).catch(() => {});
                } else {
                    bot.sendMessage(msg.chat.id, `Chức năng nạp tiền qua ${method} đang được phát triển.`);
                }
                return;
            }

            if (data.startsWith('napbank_')) {
                const amount = parseInt(data.split('_')[1]);
                await provideBankInfo(bot, msg.chat.id, amount);
                return;
            }

            // --- Xử lý các nút từ menu tài khoản ---
            const userId = msg.chat.id;
            switch (data) {
                case 'account_deposit':
                    await DepositHandler.show(bot, msg);
                    return;
                case 'account_withdraw':
                    await WithdrawHandler.start(bot, msg, userStates);
                    return;
                case 'account_transfer':
                    // Thêm logic chuyển tiền ở đây
                    bot.sendMessage(userId, 'Chức năng "Chuyển Tiền" đang được phát triển.');
                    return;
                case 'history_deposit':
                    // Thêm logic xem lịch sử nạp ở đây
                    bot.sendMessage(userId, 'Chức năng "Lịch sử Nạp" đang được phát triển.');
                    return;
                case 'history_withdraw':
                    // Thêm logic xem lịch sử rút ở đây
                    bot.sendMessage(userId, 'Chức năng "Lịch sử Rút" đang được phát triển.');
                    return;
                case 'history_betting':
                    // Thêm logic xem lịch sử cược ở đây
                    bot.sendMessage(userId, 'Chức năng "Lịch sử Cược" đang được phát triển.');
                    return;
                case 'account_giftcode':
                    // Thêm logic nhập giftcode ở đây
                    bot.sendMessage(userId, 'Vui lòng nhập giftcode theo cú pháp: `/gift [mã]`');
                    return;
                // Các case khác cho shop_giftcode, exchange_vip_points, mailbox...
            }
            // --- Kết thúc xử lý nút menu tài khoản ---


            switch (data) {
                case 'faq_menu':
                    const faqKeyboard = {
                        inline_keyboard: faqData.map(item => ([{ text: item.question, callback_data: item.id }]))
                    };
                    faqKeyboard.inline_keyboard.push([{ text: '❌ Đóng', callback_data: 'close_faq' }]);
                    
                    bot.editMessageText('❓ <b>CÂU HỎI THƯỜNG GẶP</b>\nChọn câu hỏi bạn quan tâm:', {
                        chat_id: msg.chat.id,
                        message_id: msg.message_id,
                        parse_mode: 'HTML',
                        reply_markup: faqKeyboard
                    }).catch(() => {});
                    break;

                case 'close_faq':
                    bot.deleteMessage(msg.chat.id, msg.message_id).catch(() => {});
                    break;

                default:
                    const faqItem = faqData.find(item => item.id === data);
                    if (faqItem) {
                        const backToFaqKeyboard = { inline_keyboard: [[{ text: '🔙 Quay lại FAQ', callback_data: 'faq_menu' }]] };
                        bot.editMessageText(`❓ <b>${faqItem.question}</b>\n\n💡 ${faqItem.answer}`, {
                            chat_id: msg.chat.id,
                            message_id: msg.message_id,
                            parse_mode: 'HTML',
                            reply_markup: backToFaqKeyboard
                        }).catch(() => {});
                    }
                    break;
            }
        });

        // Lệnh /napbank [số tiền]
        bot.onText(/\/napbank (\d+)/, async (msg, match) => {
            const amount = parseInt(match[1]);
            if (msg.chat.type !== 'private') return; // Chỉ cho phép trong chat riêng
            await provideBankInfo(bot, msg.chat.id, amount);
        });

        bot.on('polling_error', (err) => {
            console.error(`[Main Bot Polling Error] ${err.message}`);
            // Nếu vẫn gặp lỗi 409, instance này sẽ tự hủy để giải quyết xung đột
            if (err.message.includes('409 Conflict')) {
                console.error('[Main Bot] Xung đột 409. Instance này sẽ tự hủy.');
                if (mainBotInstance === bot) {
                    bot.stopPolling();
                    bot.removeAllListeners();
                    mainBotInstance = null;
                }
            }
        });

    } catch (error) {
        console.error('[Main Bot Error]', error.message);
        if (mainBotInstance) {
            try { await mainBotInstance.stopPolling(); } catch(e) {}
            if (mainBotInstance) mainBotInstance.removeAllListeners();
            mainBotInstance = null;
        }
    } finally {
        isProcessing = false;
    }
}

async function provideBankInfo(bot, chatId, amount) {
    // Chống spam: Giới hạn 15s/lần và tối đa 5 đơn chờ
    const lastTime = depositCooldowns[chatId] || 0;
    const now = Date.now();
    if (now - lastTime < 15000) {
        return bot.sendMessage(chatId, `⏳ Vui lòng đợi ${Math.ceil((15000 - (now - lastTime)) / 1000)}s trước khi tạo lệnh mới.`);
    }
    const pendingCount = await Deposit.countDocuments({ userId: chatId, status: 0 });
    if (pendingCount >= 5) {
        return bot.sendMessage(chatId, '❌ Bạn có quá nhiều lệnh nạp đang chờ. Vui lòng thanh toán các lệnh cũ hoặc đợi hủy.');
    }
    depositCooldowns[chatId] = now;

    const MIN_DEPOSIT = 20000;
    if (amount < MIN_DEPOSIT) {
        return bot.sendMessage(chatId, `❌ Số tiền nạp tối thiểu là ${MIN_DEPOSIT.toLocaleString()}đ.`);
    }

    try {
        const settings = await Setting.findOne({});
        let bankAccount = null;
            
            // Mặc định là bật nếu chưa cấu hình (để khớp với giao diện Admin)
            const useBankAuto = settings ? (settings.useBankAuto !== false) : true;

        // Ưu tiên Bank Auto nếu được bật
            if (useBankAuto) {
                const autoBanks = await BankAuto.find({ status: 1 });
                if (autoBanks && autoBanks.length > 0) {
                    bankAccount = autoBanks[Math.floor(Math.random() * autoBanks.length)];
                }
        }

        if (!bankAccount) {
            return bot.sendMessage(chatId, '❌ Hệ thống nạp tiền qua ngân hàng đang bảo trì. Vui lòng thử lại sau.');
        }
        // Tạo mã giao dịch duy nhất
        const transCode = `NAP${Math.floor(100000 + Math.random() * 900000)}`;

        // --- LOGIC SỐ TIỀN DUY NHẤT ---
        // Kiểm tra và tạo số tiền lẻ để phân biệt nếu không nhập nội dung
        let finalAmount = amount;
        let isUnique = false;
        let attempts = 0;

        // Thử tối đa 20 lần để tìm số tiền chưa ai nạp
        while (!isUnique && attempts < 20) {
            const existing = await Deposit.findOne({ amount: finalAmount, status: 0 });
            if (!existing) {
                isUnique = true;
            } else {
                // Nếu trùng, cộng thêm từ 1đ đến 50đ ngẫu nhiên
                finalAmount += Math.floor(Math.random() * 50) + 1;
                attempts++;
            }
        }

        // Tạo yêu cầu nạp tiền đang chờ xử lý
        await Deposit.create({
            userId: chatId,
            amount: finalAmount, // Lưu số tiền đã làm lệch (duy nhất)
            method: 'Banking',
            requestId: transCode,
            status: 0
        });

        // Tạo link VietQR (Xử lý tên ngân hàng để tránh lỗi URL)
        const bankId = bankAccount.bankName.trim().replace(/\s+/g, '');
        // Bỏ addInfo (nội dung) khỏi QR Code
        const qrUrl = `https://img.vietqr.io/image/${bankId}-${bankAccount.accountNumber}-qr_only.jpg?amount=${finalAmount}&accountName=${encodeURIComponent(bankAccount.accountName)}`;

        const depositInfoText = `✅ <b>YÊU CẦU NẠP TIỀN</b>\n\n` +
            `Vui lòng quét mã QR hoặc chuyển khoản theo thông tin:\n\n` +
            `🏦 <b>Ngân hàng:</b> ${bankAccount.bankName}\n` +
            `💳 <b>Số tài khoản:</b> <code>${bankAccount.accountNumber}</code>\n` +
            `👤 <b>Chủ tài khoản:</b> ${bankAccount.accountName}\n` +
            `💰 <b>Số tiền:</b> <code>${finalAmount.toLocaleString()}</code> ₫ (Chính xác từng đồng)\n` +
            `\n⚠️ <b>QUAN TRỌNG:</b> Vui lòng chuyển <b>CHÍNH XÁC SỐ TIỀN</b> (kể cả số lẻ) để được duyệt tự động ngay lập tức.`;

        try {
            await bot.sendPhoto(chatId, qrUrl, { caption: depositInfoText, parse_mode: 'HTML' });
        } catch (photoErr) {
            console.error('[Provide Bank Info] Lỗi gửi ảnh QR:', photoErr.message);
            // Fallback: Gửi tin nhắn text nếu ảnh lỗi (do tên ngân hàng sai hoặc lỗi mạng)
            await bot.sendMessage(chatId, depositInfoText, { parse_mode: 'HTML' });
        }
    } catch (error) {
        console.error('[Provide Bank Info Error]', error);
        await bot.sendMessage(chatId, '❌ Đã có lỗi xảy ra khi tạo yêu cầu nạp tiền. Vui lòng thử lại.');
    }
}

/**
 * Kiểm tra kết nối thực tế với Telegram
 */
async function checkConnection() {
    if (!mainBotInstance) return { success: false, message: 'BOT CHƯA KHỞI TẠO' };
    try {
        const me = await mainBotInstance.getMe();
        return { success: true, message: `@${me.username} ONLINE` };
    } catch (error) {
        return { success: false, message: 'LỖI KẾT NỐI' };
    }
}

/**
 * Gửi thông báo bảo trì cho toàn bộ người dùng
 * @param {string} reason Nội dung bảo trì
 * @param {number} minutes Số phút báo trước (mặc định 5)
 */
async function sendMaintenanceNotification(reason, minutes = 5) {
    if (!mainBotInstance) {
        console.error('[Main Bot] Bot chưa được khởi tạo, không thể gửi thông báo.');
        return { success: false, message: 'Bot chưa khởi tạo' };
    }

    const maintenanceTime = new Date(Date.now() + minutes * 60000);
    const timeString = maintenanceTime.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

    const message = `⚠️ <b>THÔNG BÁO BẢO TRÌ HỆ THỐNG</b> ⚠️\n\n` +
                    `🛠 <b>Nội dung:</b> ${reason}\n` +
                    `⏰ <b>Thời gian bắt đầu:</b> ${timeString} (Sau ${minutes} phút nữa)\n\n` +
                    `⛔️ <b>CẢNH BÁO QUAN TRỌNG:</b>\n` +
                    `Vui lòng <b>DỪNG NGAY</b> mọi hoạt động Nạp/Rút và Đặt cược để tránh thất thoát tài sản.\n` +
                    `Hệ thống sẽ tạm ngưng phục vụ để nâng cấp. Xin cảm ơn!`;

    try {
        // Lấy tất cả userId từ Account
        const accounts = await Account.find({}, 'userId');
        let successCount = 0;

        console.log(`[Main Bot] Đang gửi thông báo bảo trì tới ${accounts.length} người dùng...`);

        // Gửi tuần tự với delay nhỏ để tránh lỗi 429 Too Many Requests của Telegram
        for (const acc of accounts) {
            try {
                await mainBotInstance.sendMessage(acc.userId, message, { parse_mode: 'HTML' });
                successCount++;
                await new Promise(r => setTimeout(r, 50)); // Delay 50ms giữa các tin
            } catch (err) {
                // Bỏ qua nếu user block bot hoặc lỗi khác
            }
        }

        console.log(`[Main Bot] Đã gửi thông báo xong. Thành công: ${successCount}/${accounts.length}`);
        return { success: true, total: accounts.length, sent: successCount };
    } catch (error) {
        console.error('[Main Bot] Lỗi khi gửi thông báo bảo trì:', error);
        return { success: false, message: error.message };
    }
}

/**
 * Gửi thông báo (notification) qua Main Bot
 * options: { content, targetType: 'all'|'group'|'user', targetValue }
 */
async function sendNotification(options) {
    const { content, targetType = 'all', targetValue = null } = options || {};
    if (!mainBotInstance) return { success: false, message: 'Bot chưa khởi tạo' };

    try {
        if (targetType === 'group' || targetType === 'chat') {
            await mainBotInstance.sendMessage(targetValue, content, { parse_mode: 'HTML' });
            return { success: true, sent: 1 };
        }

        if (targetType === 'user' && targetValue) {
            await mainBotInstance.sendMessage(targetValue, content, { parse_mode: 'HTML' });
            return { success: true, sent: 1 };
        }

        // default: broadcast to all registered users
        const accounts = await Account.find({}, 'userId');
        let sent = 0;
        for (const acc of accounts) {
            try {
                await mainBotInstance.sendMessage(acc.userId, content, { parse_mode: 'HTML' });
                sent++;
                await new Promise(r => setTimeout(r, 50));
            } catch (err) {
                // ignore per-user failures
            }
        }
        return { success: true, sent, total: accounts.length };
    } catch (e) {
        console.error('[Main Bot] sendNotification error:', e.message || e);
        return { success: false, message: e.message || String(e) };
    }
}

/**
 * Phát Giftcode tự động qua Main Bot
 * params: { code, messageTemplate, targetType, targetValue }
 */
async function sendGiftcode({ code, messageTemplate = null, targetType = 'all', targetValue = null }) {
    if (!mainBotInstance) return { success: false, message: 'Bot chưa khởi tạo' };
    const text = messageTemplate || `🎁 Giftcode mới: <b>${code}</b>\nNhanh tay nhập để nhận phần thưởng!`;

    try {
        if (targetType === 'group' || targetType === 'chat') {
            await mainBotInstance.sendMessage(targetValue, text, { parse_mode: 'HTML' });
            return { success: true, sent: 1 };
        }

        if (targetType === 'user' && targetValue) {
            await mainBotInstance.sendMessage(targetValue, text, { parse_mode: 'HTML' });
            return { success: true, sent: 1 };
        }

        const accounts = await Account.find({}, 'userId');
        let sent = 0;
        for (const acc of accounts) {
            try {
                await mainBotInstance.sendMessage(acc.userId, text, { parse_mode: 'HTML' });
                sent++;
                await new Promise(r => setTimeout(r, 50));
            } catch (err) {}
        }
        return { success: true, sent, total: accounts.length };
    } catch (e) {
        console.error('[Main Bot] sendGiftcode error:', e.message || e);
        return { success: false, message: e.message || String(e) };
    }
}

/**
 * Hàm gửi tin nhắn từ Admin tới User (Dùng cho App React gọi xuống)
 */
module.exports = { startMainBot, checkConnection, sendMaintenanceNotification, sendNotification, sendGiftcode };