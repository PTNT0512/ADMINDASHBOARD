const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config(); // Đảm bảo bạn có file .env với MONGO_URI

// --- Import các thành phần game ---
const AviatorEngine = require('./webgame/game/aviatorEngine');
const gameRoutes = require('./webgame/game/gameRoutes');
// --- Import các thành phần Bot ---
const { startMainBot } = require('./src/components/main-bot-service');
const Setting = require('./src/models/Setting');
const adminRoutes = require('./src/routes/adminRoutes');

// --- Khởi tạo Server ---
const app = express();
const httpServer = http.createServer(app);

// --- Cấu hình CORS và Middleware ---
app.use(cors());
app.use(express.json());

// --- Khởi tạo Socket.IO ---
const io = new Server(httpServer, {
  cors: {
    origin: "*", // Cho phép tất cả các domain, hoặc chỉ định domain của game
    methods: ["GET", "POST"]
  }
});

// --- Khởi tạo Game Engine ---
// Truyền instance của `io` vào để engine có thể broadcast state
const aviatorEngine = new AviatorEngine(io);

// --- Đăng ký API Routes ---
// Truyền instance của `aviatorEngine` vào để các route có thể gọi hàm xử lý
app.use('/api/game', gameRoutes(aviatorEngine));

// --- Đăng ký Admin Routes ---
app.use('/api', adminRoutes);

// --- Xử lý kết nối Socket ---
io.on('connection', (socket) => {
  console.log(`[Socket] Một người chơi đã kết nối: ${socket.id}`);
  
  // Thêm người chơi vào phòng game Aviator để nhận cập nhật
  socket.join('aviator_room');

  socket.on('disconnect', () => {
    console.log(`[Socket] Người chơi đã ngắt kết nối: ${socket.id}`);
  });
});

// --- Kết nối Database và Khởi động Server ---
const PORT = process.env.PORT || 4001;

mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => {
    console.log('✅ MongoDB Connected...');
    
    // Khởi động HTTP & WebSocket Server
    httpServer.listen(PORT, () => {
      console.log(`🚀 Game Server đang chạy tại http://localhost:${PORT}`);
    });

    // Khởi động Telegram Bot
    console.log('🤖 Đang khởi tạo Telegram Bot...');
    Setting.findOne({}).then(botConfig => startMainBot(botConfig));

})
.catch(err => console.error('❌ Lỗi kết nối MongoDB:', err));