const cron = require('node-cron');
const BankAuto = require('../models/BankAuto');
const BankHistory = require('../models/BankHistory');
const Deposit = require('../models/Deposit');
const Account = require('../models/Account');
const Transaction = require('../models/Transaction');

// Import các module ngân hàng
const Vietcombank = require('../banks/Vietcombank.js');
const MBBank = require('../banks/MBBank.js');
const ACB = require('../banks/ACB.js');
const BIDV = require('../banks/BIDV.js');
const TPBank = require('../banks/TPBank.js');
const MSB = require('../banks/MSB.js');
const VPBank = require('../banks/VPBank.js');
const OCB = require('../banks/OCB.js');
const Timo = require('../banks/Timo.js');
const VietinBank = require('../banks/VietinBank.js');
const SeABank = require('../banks/SeABank.js');

// Map tên ngân hàng với file xử lý tương ứng
const BANK_HANDLERS = {
    'Vietcombank': Vietcombank,
    'VCB': Vietcombank,
    'MBBank': MBBank, 'MB': MBBank,
    'ACB': ACB,
    'BIDV': BIDV,
    'TPBank': TPBank, 'TPB': TPBank,
    'MSB': MSB,
    'VPBank': VPBank, 'VPB': VPBank,
    'OCB': OCB, 'OCBBank': OCB,
    'Timo': Timo, 'TimoBank': Timo,
    'VietinBank': VietinBank, 'CTG': VietinBank,
    'SeABank': SeABank
};

function startBankCron(mainBotService) {
    // --- AUTO BANK CHECK CRON (Mỗi 5 giây) ---
    cron.schedule('*/5 * * * * *', async () => {
        console.log(`[AutoBank] --- Bắt đầu quét ngân hàng lúc ${new Date().toLocaleTimeString()} ---`);
        try {
            // 1. Lấy danh sách Bank Auto đang hoạt động
            const bankAutos = await BankAuto.find({ status: 1 });
            if (!bankAutos || bankAutos.length === 0) return;

            // 2. Duyệt qua từng ngân hàng
            for (const bank of bankAutos) {
                if (!bank.token) continue;

                // Xác định handler dựa trên tên ngân hàng (Mặc định là Vietcombank nếu không tìm thấy)
                const handler = BANK_HANDLERS[bank.bankName] || Vietcombank;
                
                // Gọi hàm lấy lịch sử từ file riêng biệt
                const transactions = await handler.getHistory(bank.token);

                if (transactions && transactions.length > 0) {
                    // Chỉ lấy 20 giao dịch gần nhất
                    for (const trans of transactions.slice(0, 20)) {
                        const { transactionID, amount, date } = trans;
                        const description = (trans.description || trans.content || '').toUpperCase();

                        // 3. LƯU BILL VÀO DB (Kiểm tra trùng lặp Transaction ID)
                        let bill = await BankHistory.findOne({ transactionID });
                        if (!bill) {
                            try {
                                bill = await BankHistory.create({
                                    transactionID, amount, description, bankName: bank.bankName, date, isUsed: false
                                });
                                console.log(`[AutoBank] + Lưu mới: ${transactionID} | ${amount.toLocaleString()}đ | ${description}`);
                            } catch (err) {
                                if (err.code !== 11000) console.error('[AutoBank] Save Bill Error:', err.message);
                                continue;
                            }
                        }

                        // 4. Nếu bill đã dùng rồi thì bỏ qua
                        if (bill.isUsed) continue;

                        // 5. Tiến hành so sánh và xử lý nạp
                        let deposit = null;

                        // CÁCH A: Tìm theo nội dung (Mã NAPxxxxxx)
                        const match = description.match(/NAP\d+/);
                        if (match) {
                            const requestId = match[0];
                            deposit = await Deposit.findOne({ requestId, status: 0 });
                        }

                        // CÁCH B: Tìm theo SỐ TIỀN CHÍNH XÁC (Nếu không tìm thấy theo nội dung)
                        if (!deposit) {
                            const candidates = await Deposit.find({ amount: amount, status: 0 });
                            if (candidates.length === 1) {
                                deposit = candidates[0];
                                console.log(`[AutoBank] -> Tìm thấy đơn theo số tiền duy nhất: ${amount} (User: ${deposit.userId})`);
                            }
                        }

                        // 6. Xử lý giao dịch
                        if (deposit) {
                            if (deposit.amount === amount) {
                                // --- TRƯỜNG HỢP KHỚP TIỀN: DUYỆT THÀNH CÔNG ---
                                console.log(`[AutoBank] => DUYỆT ĐƠN THÀNH CÔNG: ${deposit.requestId} | User: ${deposit.userId} | Tiền: ${amount}`);

                                deposit.status = 1;
                                await deposit.save();

                                const account = await Account.findOne({ userId: deposit.userId });
                                if (account) {
                                    account.balance += amount;
                                    await account.save();

                                    await Transaction.create({
                                        userId: deposit.userId, amount: amount, action: 'deposit',
                                        oldBalance: account.balance - amount, newBalance: account.balance,
                                        description: `Auto Bank: ${deposit.requestId} (${transactionID})`
                                    });

                                    bill.isUsed = true;
                                    bill.usedFor = deposit.id;
                                    await bill.save();

                                    if (mainBotService && mainBotService.sendNotification) {
                                        const now = new Date();
                                        const timeStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

                                        const msgContent = `✅ <b>Nạp tiền thành công !!!!</b>\n` +
                                            `➡️ <b>Mã giao dịch:</b> ${deposit.requestId}\n` +
                                            `➡️ <b>Nội dung:</b> ${transactionID}\n` +
                                            `➡️ <b>Thời gian:</b> ${timeStr}\n` +
                                            `➡️ <b>Kênh giao dịch:</b> ${bank.bankName}\n` +
                                            `➡️ <b>Số tiền:</b> ${amount.toLocaleString()} ₫\n` +
                                            `➡️ <b>Số dư hiện tại:</b> ${account.balance.toLocaleString()} ₫`;

                                        mainBotService.sendNotification({
                                            content: msgContent, targetType: 'user', targetValue: deposit.userId
                                        });
                                    }
                                }
                            } else {
                                // --- TRƯỜNG HỢP SAI TIỀN: HỦY ĐƠN & GHI NHẬN ---
                                console.log(`[AutoBank] => SAI TIỀN: ${deposit.requestId} | Yêu cầu: ${deposit.amount} | Thực nhận: ${amount}`);
                                deposit.status = 2; // Đánh dấu là Lỗi/Hủy
                                deposit.realAmount = amount; // Lưu số tiền thực tế
                                await deposit.save();

                                bill.isUsed = true;
                                bill.usedFor = deposit.id;
                                await bill.save();
                            }
                        } else {
                            // --- TRƯỜNG HỢP KHÔNG KHỚP LỆNH: TẠO GIAO DỊCH LỖI ---
                            console.log(`[AutoBank] -> Giao dịch không khớp: ${transactionID} | ${amount.toLocaleString()}đ. Ghi nhận là giao dịch lỗi.`);
                            const errorDeposit = await Deposit.create({ userId: -1, amount: 0, realAmount: amount, method: 'Banking', transId: transactionID, requestId: `ERROR_${transactionID}`, status: 2, description: `GD không khớp: ${description}` });
                            bill.isUsed = true;
                            bill.usedFor = errorDeposit.id;
                            await bill.save();
                        }
                    }
                }
            }
        } catch (e) {
            console.error('[AutoBank] Cron Error:', e);
        }
    });
}

module.exports = { startBankCron };