require('dotenv').config();
console.log('🚀 [GameAdminServer] FILE LOADED - Checking execution...');
const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { fork, spawn } = require('child_process');
const GameSession = require('./game/GameSession');

// Import Models
const User = require('./models/User.js');
const Account = require('./models/Account.js');
const Withdraw = require('./models/Withdraw.js');
const Setting = require('./models/Setting.js');
const EWallet = require('./models/EWallet.js');
const Giftcode = require('./models/GiftCode.js');
const ZaloPay = require('./banks/ZaloPay');
// const { startZaloPayCron } = require('./components/zalopay-cron'); // <-- BỎ DÒNG NÀY
const { startBankCron } = require('./components/bank-cron-service');
const mainBotService = require('./components/main-bot-service');
const { startRabbitMQConsumer } = require('./components/rabbitmq-consumer'); // Import module mới

const app = express();
const server = http.createServer(app);

const DASHBOARD_PORT = process.env.DASHBOARD_PORT || 5173;
const GAME_SERVER_PORT = process.env.GAME_SERVER_PORT || 4002;

const io = new Server(server, {
    cors: {
        origin: (origin, callback) => {
            // Chấp nhận tất cả các kết nối (Dashboard, Worker, Tool...)
            callback(null, true);
        },
        methods: ["GET", "POST"],
        credentials: true
    },
    allowEIO3: true // Thêm dòng này để tăng tương thích với các client cũ hơn
});

app.use(cors());
app.use(express.json({ limit: '10mb', strict: false }));

const PORT = process.env.API_PORT || process.env.GAME_ADMIN_PORT || 2233;

// --- KẾT NỐI MONGODB ---
const connectDB = async () => {
    const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/lasvegas';
    try {
        await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
        console.log('✅ [GameAdminServer] Đã kết nối MongoDB');
        
        // Tạo admin mặc định nếu chưa có
        const adminExists = await User.findOne({ username: 'admincenter' });
        if (!adminExists) {
            await User.create({ username: 'admincenter', password: '1', role: 'superadmin', isFirstLogin: true });
            console.log('✅ [GameAdminServer] Đã tạo tài khoản mặc định: admincenter / 1');
        }

        // --- KHỞI ĐỘNG GAME SESSIONS ---
        console.log('🎲 [GameAdminServer] Đang khởi động các phiên game...');
        new GameSession(io, 'taixiucao').init();
        new GameSession(io, 'taixiunan').init();

        // --- KHỞI ĐỘNG ZALOPAY CRON ---
        // console.log('💳 [GameAdminServer] Đang khởi động ZaloPay Cron...');
        // startZaloPayCron(mainBotService); // <-- BỎ DÒNG NÀY

        // --- KHỞI ĐỘNG BANK AUTO CRON ---
        console.log('🏦 [GameAdminServer] Đang khởi động Bank Auto Cron...');
        startBankCron(mainBotService);

    } catch (err) {
        console.error('❌ [GameAdminServer] Lỗi kết nối MongoDB:', err.message);
        setTimeout(connectDB, 5000);
    }
};
connectDB();

// --- QUẢN LÝ TIẾN TRÌNH CON (GAME SERVER & WEB) ---
let gameAdminServerProcess = null;
let taixiuCaoWebProcess = null;
let taixiuNanWebProcess = null;
let landingServerProcess = null;

function startGameAdminServer() {
    if (gameAdminServerProcess) return;
    const serverPath = path.join(__dirname, '../game/taixiu/server.js');
    try {
        // Chạy game server trên PORT 4002
        const child = fork(serverPath, { cwd: path.dirname(serverPath), env: { ...process.env, PORT: String(GAME_SERVER_PORT) }, silent: true });
        gameAdminServerProcess = child;
        console.log(`🚀 [Launcher] Đã khởi động Game Server (Port ${GAME_SERVER_PORT})`);

        child.stdout.on('data', (chunk) => console.log('[GameServer]', String(chunk).trim()));
        child.stderr.on('data', (chunk) => console.error('[GameServer ERR]', String(chunk).trim()));
        
        child.on('exit', () => {
            console.log('⚠️ [Launcher] Game Server đã tắt');
            gameAdminServerProcess = null;
        });
    } catch (e) {
        console.error('❌ [Launcher] Lỗi khởi động Game Server:', e);
    }
}

function stopGameAdminServer() {
    if (gameAdminServerProcess) {
        gameAdminServerProcess.kill();
        gameAdminServerProcess = null;
        console.log('🛑 [Launcher] Đã tắt Game Server');
    }
}

function startTaixiuCaoWebProcess() {
    if (taixiuCaoWebProcess) return;
    const cwd = path.join(__dirname, '../web-taixiucao');
    // Chạy npm run dev cho web con
    const child = spawn(/^win/.test(process.platform) ? 'npm.cmd' : 'npm', ['run', 'dev'], { cwd, shell: false });
    taixiuCaoWebProcess = child;
    console.log('🚀 [Launcher] Đã khởi động Web Tài Xỉu Cao');
    
    child.stdout.on('data', (d) => {}); // Ẩn log web con cho đỡ rối
    child.on('exit', () => taixiuCaoWebProcess = null);
}

function startTaixiuNanWebProcess() {
    if (taixiuNanWebProcess) return;
    const cwd = path.join(__dirname, '../web-taixiunan');
    const child = spawn(/^win/.test(process.platform) ? 'npm.cmd' : 'npm', ['run', 'dev'], { cwd, shell: false });
    taixiuNanWebProcess = child;
    console.log('🚀 [Launcher] Đã khởi động Web Tài Xỉu Nan');
    
    child.stdout.on('data', (d) => {});
    child.on('exit', () => taixiuNanWebProcess = null);
}

function startLandingServer() {
    if (landingServerProcess) return;
    const cwd = path.join(__dirname, '../landing');
    // Chạy landing server bằng Vite
    const child = spawn(/^win/.test(process.platform) ? 'npm.cmd' : 'npm', ['run', 'dev'], { cwd, stdio: 'inherit', shell: true });
    landingServerProcess = child;
    console.log('🚀 [Launcher] Đã khởi động Landing Page (Vite Port 80)');

    child.on('exit', () => landingServerProcess = null);
}



// Tự động chạy các server con khi khởi động
setTimeout(() => {
    startGameAdminServer();
    startTaixiuCaoWebProcess();
    startTaixiuNanWebProcess();
    startLandingServer();
    // startZaloPayWorker(); // <-- Đã tắt để chạy qua npm run electron:dev:dashboard
}, 1000);

// --- API ROUTES (Thay thế cho IPC Handlers cũ) ---

// --- KHỞI ĐỘNG RABBITMQ CONSUMER ---
// Chuyển logic sang file riêng để code gọn hơn
startRabbitMQConsumer(io, mainBotService);

// API Đăng nhập
app.post('/api/login-request', async (req, res) => {
    try {
        const { username, password } = req.body;
        const user = await User.findOne({ username });
        if (user && await user.comparePassword(password)) {
            res.json({ success: true, role: user.role, needPasswordChange: !!user.isFirstLogin });
        } else {
            res.json({ success: false, message: 'Sai thông tin đăng nhập' });
        }
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

// API Điều khiển Server (Dashboard gọi các API này)
app.post('/api/start-game-server', (req, res) => {
    startGameAdminServer();
    res.json({ success: true });
});
app.post('/api/stop-game-server', (req, res) => {
    stopGameAdminServer();
    res.json({ success: true });
});
app.post('/api/start-taixiucao-web', (req, res) => {
    startTaixiuCaoWebProcess();
    res.json({ success: true });
});
app.post('/api/stop-taixiucao-web', (req, res) => {
    if (taixiuCaoWebProcess) taixiuCaoWebProcess.kill();
    res.json({ success: true });
});
app.post('/api/start-taixiunan-web', (req, res) => {
    startTaixiuNanWebProcess();
    res.json({ success: true });
});
app.post('/api/stop-taixiunan-web', (req, res) => {
    if (taixiuNanWebProcess) taixiuNanWebProcess.kill();
    res.json({ success: true });
});
app.post('/api/start-landing-server', (req, res) => {
    startLandingServer();
    res.json({ success: true });
});
app.post('/api/stop-landing-server', (req, res) => {
    if (landingServerProcess) landingServerProcess.kill();
    res.json({ success: true });
});
app.post('/api/start-zalopay-worker', (req, res) => {
    console.log('📥 [API] Nhận yêu cầu bật ZaloPay Worker từ Dashboard');
    startZaloPayWorker();
    res.json({ success: true });
});
app.post('/api/stop-zalopay-worker', (req, res) => {
    stopZaloPayWorker();
    res.json({ success: true });
});
app.get('/api/get-zalopay-status', (req, res) => {
    res.json({ running: !!zaloPayWorkerProcess });
});

// --- API E-WALLET ---
app.post('/api/get-ewallet', async (req, res) => {
    try {
        const data = await EWallet.find().sort({ _id: -1 });
        res.json({ success: true, data });
    } catch (e) {
        res.json({ success: false, message: e.message });
    }
});

app.post('/api/add-ewallet', async (req, res) => {
    try {
        await EWallet.create(req.body);
        res.json({ success: true });
    } catch (e) {
        res.json({ success: false, message: e.message });
    }
});

app.post('/api/update-ewallet', async (req, res) => {
    try {
        const { id, data } = req.body;
        await EWallet.findByIdAndUpdate(id, data);
        res.json({ success: true });
    } catch (e) {
        res.json({ success: false, message: e.message });
    }
});

app.post('/api/delete-ewallet', async (req, res) => {
    try {
        const id = req.body.id || req.body;
        await EWallet.findByIdAndDelete(id);
        res.json({ success: true });
    } catch (e) {
        res.json({ success: false, message: e.message });
    }
});

app.post('/api/update-ewallet-status', async (req, res) => {
    try {
        const { id, status } = req.body;
        await EWallet.findByIdAndUpdate(id, { status });
        res.json({ success: true });
    } catch (e) {
        res.json({ success: false, message: e.message });
    }
});

app.post('/api/check-token', async (req, res) => {
    try {
        const { token, type } = req.body;
        if (type === 'ZaloPay') {
            const result = await ZaloPay.checkToken(token);
            return res.json(result);
        }
        // Mock cho các loại ví khác chưa implement
        res.json({ success: true, message: 'Mock check OK' });
    } catch (e) {
        res.json({ success: false, message: e.message });
    }
});

// API Test ZaloPay QR
app.post('/api/test-zalopay-qr', async (req, res) => {
    console.log('📥 [API] Nhận yêu cầu Test QR ZaloPay');
    try {
        const { token, amount } = req.body;
        if (!token) return res.status(400).json({ success: false, message: 'Thiếu token ZaloPay' });

        const transCode = `TEST${Math.floor(100000 + Math.random() * 900000)}`;
        const params = new URLSearchParams();
        params.append('token', token);
        params.append('amount', amount || 10000);
        params.append('message', transCode);

        console.log('📤 [API] Gửi request ZaloPay:', params.toString());
        const response = await axios.post('https://thueapibank.vn/zalopay/qrcode', params, { timeout: 15000 });
        
        if (response.data && (response.data.link || response.data.qr_link)) {
            return res.json({ success: true, qrLink: response.data.link || response.data.qr_link, message: transCode });
        }
        return res.json({ success: false, message: 'Không lấy được QR từ API', data: response.data });
    } catch (e) {
        return res.status(500).json({ success: false, message: e.message });
    }
});

// --- API SETTINGS ---
app.post('/api/get-settings', async (req, res) => {
    try {
        let settings = await Setting.findOne({});
        if (!settings) {
            settings = await Setting.create({});
        }
        res.json({ success: true, data: settings });
    } catch (e) {
        res.json({ success: false, message: e.message });
    }
});

app.post('/api/save-settings', async (req, res) => {
    try {
        const data = req.body;
        delete data._id; // Không cho phép sửa _id
        
        // Cập nhật hoặc tạo mới nếu chưa có
        await Setting.findOneAndUpdate({}, data, { upsert: true, new: true, setDefaultsOnInsert: true });
        
        res.json({ success: true });
    } catch (e) {
        res.json({ success: false, message: e.message });
    }
});

// --- API GIFTCODE ---
app.post('/api/get-giftcodes', async (req, res) => {
    try {
        const codes = await Giftcode.find().sort({ date: -1 });
        res.json({ success: true, data: codes });
    } catch (e) {
        res.json({ success: false, message: e.message });
    }
});

app.post('/api/create-giftcode', async (req, res) => {
    try {
        const { code, amount, usageLimit } = req.body;
        if (!code || !amount) return res.json({ success: false, message: 'Thiếu thông tin' });
        
        // Kiểm tra trùng mã
        const exist = await Giftcode.findOne({ code });
        if (exist) return res.json({ success: false, message: 'Mã Code đã tồn tại' });

        await Giftcode.create({
            code,
            amount: parseInt(amount),
            usageLimit: parseInt(usageLimit) || 1,
            usedCount: 0,
            status: 1
        });
        res.json({ success: true });
    } catch (e) {
        res.json({ success: false, message: e.message });
    }
});

app.post('/api/delete-giftcode', async (req, res) => {
    try {
        const id = req.body.id || req.body;
        await Giftcode.findByIdAndDelete(id);
        res.json({ success: true });
    } catch (e) {
        res.json({ success: false, message: e.message });
    }
});

// --- API RÚT TIỀN (WITHDRAW) ---
app.post('/api/get-withdraws', async (req, res) => {
    try {
        const withdraws = await Withdraw.find().sort({ date: -1 }).limit(100).lean();

        const dataWithStats = await Promise.all(withdraws.map(async (withdraw) => {
            const account = await Account.findOne({ userId: withdraw.userId }).select('totalDeposit totalWithdraw totalBet').lean();
            return {
                ...withdraw,
                accountStats: account || { totalDeposit: 0, totalWithdraw: 0, totalBet: 0 }
            };
        }));

        res.json({ success: true, data: dataWithStats });
    } catch (e) {
        res.json({ success: false, message: e.message });
    }
});

app.post('/api/handle-withdraw', async (req, res) => {
    try {
        const { id, status } = req.body;
        const withdraw = await Withdraw.findById(id);
        if (!withdraw) return res.json({ success: false, message: 'Không tìm thấy đơn rút' });

        if (withdraw.status !== 0) return res.json({ success: false, message: 'Đơn đã được xử lý trước đó' });

        withdraw.status = status;
        await withdraw.save();

        if (status === 1) {
            // Duyệt thành công -> Gửi thông báo chi tiết
             const msg = `✅ <b>RÚT TIỀN THÀNH CÔNG</b>\n\n` +
                        `👤 <b>Tên:</b> ${withdraw.accountName}\n` +
                        `🔢 <b>STK:</b> ${withdraw.accountNumber}\n` +
                        `💰 <b>Số tiền:</b> ${withdraw.amount.toLocaleString()} VNĐ\n` +
                        `🏦 <b>Ngân hàng:</b> ${withdraw.bankName}\n` +
                        `⏰ <b>Thời gian:</b> ${new Date(withdraw.date).toLocaleString('vi-VN')}`;
            
            // Gửi sự kiện qua socket để process của bot xử lý
            io.emit('send_notification', {
                content: msg,
                targetType: 'user',
                targetValue: withdraw.userId
            });
        } else if (status === 2) {
             // Từ chối -> Hoàn tiền
             const updatedAccount = await Account.findOneAndUpdate(
                { userId: withdraw.userId },
                { $inc: { balance: withdraw.amount } }
             );

             if (updatedAccount) {
                 // Gửi sự kiện qua socket để process của bot xử lý
                 io.emit('send_notification', {
                    content: `❌ <b>YÊU CẦU RÚT TIỀN BỊ TỪ CHỐI</b>\n\nSố tiền ${withdraw.amount.toLocaleString()} VNĐ đã được hoàn lại vào tài khoản.`,
                    targetType: 'user',
                    targetValue: withdraw.userId
                });
             }
        }
        res.json({ success: true });
    } catch (e) {
        res.json({ success: false, message: e.message });
    }
});

// --- SOCKET.IO ---
io.on('connection', (socket) => {
    console.log('🔌 [Socket] Client kết nối:', socket.id);
    
    // Xử lý các yêu cầu từ Dashboard (thay thế IPC invoke)
    // Ví dụ: Dashboard emit 'get-settings' -> Server trả về data
    socket.on('get-settings', async (callback) => {
        // Logic lấy setting từ DB (cần import Model Setting)
        // const data = await Setting.findOne({});
        // if (callback) callback({ success: true, data });
    });

    // --- LẮNG NGHE SỰ KIỆN TỪ ZALOPAY WORKER ---
    socket.on('zalopay_deposit_success', (data, callback) => {
        console.log('📥 [Socket] Nhận thông báo nạp ZaloPay:', data);
        
        // Lưu ý: mainBotService ở đây thường không có instance bot nếu chạy process riêng
        // Nên ta chủ yếu dựa vào việc broadcast để Dashboard xử lý

        // Broadcast sự kiện để Dashboard (nơi chạy Bot) nhận được và gửi tin nhắn
        io.emit('zalopay_deposit_success', data);
        console.log('📡 [Socket] Đã broadcast sự kiện "zalopay_deposit_success" tới Dashboard');

        // Phản hồi lại cho Worker biết đã nhận
        if (typeof callback === 'function') {
            callback({ status: 'ok', broadcasted: true });
        }
    });
    
    socket.on('disconnect', () => {
        console.log('🔌 [Socket] Client ngắt kết nối:', socket.id);
    });
});

server.listen(PORT, () => {
    console.log(`🚀 [GameAdminServer] Server đang chạy tại http://localhost:${PORT}`);
    console.log(`👉 Dashboard Dev: http://localhost:${DASHBOARD_PORT}`);
});

// Xử lý tắt server gọn gàng
process.on('SIGINT', () => {
    stopGameAdminServer();
    if (taixiuCaoWebProcess) taixiuCaoWebProcess.kill();
    if (taixiuNanWebProcess) taixiuNanWebProcess.kill();
    if (landingServerProcess) landingServerProcess.kill();
    if (zaloPayWorkerProcess) zaloPayWorkerProcess.kill(); // <-- Kill worker khi tắt server
    process.exit();
});
