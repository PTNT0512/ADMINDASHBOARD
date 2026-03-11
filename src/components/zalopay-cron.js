require('dotenv').config();
const mongoose = require('mongoose');
const amqp = require('amqplib');
const cron = require('node-cron');
process.env.NTBA_FIX_350 = process.env.NTBA_FIX_350 || '1';
const TelegramBot = require('node-telegram-bot-api');
const { patchTelegramBotEncoding } = require('../utils/telegram-bot-normalizer.js');
patchTelegramBotEncoding(TelegramBot);

const EWallet = require('../models/EWallet');
const Deposit = require('../models/Deposit');
const Account = require('../models/Account');
const Transaction = require('../models/Transaction');
const BankHistory = require('../models/BankHistory');
const Bot = require('../models/Bot');
const ZaloPay = require('../banks/ZaloPay');

// ================== CONFIG ==================
const MONGO_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/lasvegas';
const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://localhost';
const QUEUE_NAME = 'zalopay_notifications';

let channel = null;
let mainBotInstance = null;

// ================== RABBITMQ ==================
async function connectRabbitMQ() {
    try {
        const conn = await amqp.connect(RABBITMQ_URL, {
            clientProperties: { connection_name: 'ZaloPay-Worker' }
        });
        channel = await conn.createChannel();
        await channel.assertQueue(QUEUE_NAME, { durable: false });
        console.log('✅ RabbitMQ connected');
    } catch (err) {
        console.error('❌ RabbitMQ error:', err.message);
        setTimeout(connectRabbitMQ, 5000);
    }
}
connectRabbitMQ();

// ================== MONGODB ==================
mongoose.connect(MONGO_URI)
    .then(async () => {
        console.log('✅ MongoDB connected');
        await initBot();
        startCronJob();
    })
    .catch(err => {
        console.error('❌ MongoDB error:', err.message);
    });

// ================== TELEGRAM BOT ==================
async function initBot() {
    try {
        const botConfig = await Bot.findOne({ role: 'main', status: 1 });
        if (!botConfig || !botConfig.token) {
            console.warn('⚠️ Không tìm thấy bot chính');
            return;
        }
        mainBotInstance = new TelegramBot(botConfig.token, { polling: false });
        console.log('🤖 Telegram Bot initialized');
    } catch (e) {
        console.error('❌ Init bot error:', e.message);
    }
}

// ================== NOTIFY ==================
async function notifyZaloPaySuccess({ userId, amount, transId, balance }) {
    if (!mainBotInstance) return;

    const content =
        `✅ <b>NẠP TIỀN ZALOPAY THÀNH CÔNG</b>\n\n` +
        `💰 Số tiền: <b>${amount.toLocaleString()} ₫</b>\n` +
        `🧾 Mã GD: <code>${transId}</code>\n` +
        `💵 Số dư mới: <b>${balance.toLocaleString()} ₫</b>\n\n` +
        `Cảm ơn bạn đã sử dụng dịch vụ ❤️`;

    try {
        await mainBotInstance.sendMessage(userId, content, { parse_mode: 'HTML' });
    } catch (e) {
        console.error('❌ Telegram notify error:', e.message);
    }
}

// ================== CRON ==================
function startCronJob() {
    console.log('ðŸš€ ZaloPay Worker running (5s)');
    cron.schedule('*/5 * * * * *', async () => {
        try {
            const wallets = await EWallet.find({ walletType: 'ZaloPay', status: 1 });

            for (const wallet of wallets) {
                if (!wallet.token) continue;

                const transactions = await ZaloPay.getHistory(wallet.token);
                for (const trans of transactions) {
                    const { transactionID, amount, description, date } = trans;

                    const existed = await BankHistory.findOne({ transactionID });
                    if (existed) continue;

                    const bill = await BankHistory.create({
                        transactionID,
                        amount,
                        description,
                        bankName: 'ZaloPay',
                        date,
                        isUsed: false
                    });

                    const candidates = await Deposit.find({ amount, status: 0 });
                    if (candidates.length !== 1) continue;

                    const deposit = candidates[0];
                    deposit.status = 1;
                    await deposit.save();

                    const account = await Account.findOne({ userId: deposit.userId });
                    if (!account) continue;

                    const oldBalance = account.balance;
                    account.balance += amount;
                    account.totalDeposit = (account.totalDeposit || 0) + amount;
                    await account.save();

                    await Transaction.create({
                        userId: deposit.userId,
                        amount,
                        action: 'deposit',
                        oldBalance,
                        newBalance: account.balance,
                        description: `ZaloPay Auto (${transactionID})`
                    });

                    bill.isUsed = true;
                    bill.usedFor = deposit._id;
                    await bill.save();

                    await notifyZaloPaySuccess({
                        userId: deposit.userId,
                        amount,
                        transId: transactionID,
                        balance: account.balance
                    });

                    if (channel) {
                        channel.sendToQueue(
                            QUEUE_NAME,
                            Buffer.from(JSON.stringify({
                                userId: deposit.userId,
                                amount,
                                transId: transactionID,
                                balance: account.balance
                            }))
                        );
                    }

                    console.log(`✅ Duyệt ZaloPay: ${transactionID}`);
                }
            }
        } catch (e) {
            console.error('❌ Worker error:', e.message);
        }
    });
}

