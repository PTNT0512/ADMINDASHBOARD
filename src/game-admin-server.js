require('dotenv').config();
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
// (Bạn có thể import thêm các model khác khi cần: Setting, Account, v.v...)

const app = express();
const server = http.createServer(app);

const DASHBOARD_PORT = process.env.DASHBOARD_PORT || 5173;
const GAME_SERVER_PORT = process.env.GAME_SERVER_PORT || 4002;

const io = new Server(server, {
    cors: {
        origin: `http://localhost:${DASHBOARD_PORT}`, // Cho phép dashboard dev kết nối
        methods: ["GET", "POST"],
        credentials: true
    }
});

app.use(cors());
app.use(express.json({ limit: '10mb' }));

const PORT = process.env.API_PORT || process.env.GAME_ADMIN_PORT || 4001;

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

// Tự động chạy các server con khi khởi động
setTimeout(() => {
    startGameAdminServer();
    startTaixiuCaoWebProcess();
    startTaixiuNanWebProcess();
}, 1000);

// --- API ROUTES (Thay thế cho IPC Handlers cũ) ---

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
    process.exit();
});