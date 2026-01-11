const { fork } = require('child_process');
const path = require('path');
const EventEmitter = require('events');

// Optional Socket.IO server reference (set by main process)
let ioServer = null;

function setIo(io) {
    ioServer = io;
}

// Lưu trữ các tiến trình worker đang chạy: { 'tx': ChildProcess, 'md5': ChildProcess }
const workers = {};
const workerConfigs = {}; // Lưu config để hỗ trợ auto-restart
// Emitter để phát log ra bên ngoài (cho UI lắng nghe)
const logEmitter = new EventEmitter();

async function startOrUpdateBot(config) {
    // Phải có config._id để đảm bảo đây là dữ liệu từ DB
    if (!config || !config._id) {
        console.error(`[Bot Manager] Cấu hình không hợp lệ.`);
        return;
    }

    const { roomType, status } = config;
    workerConfigs[roomType] = config; // Cập nhật config mới nhất

    // 1. Nếu worker cho phòng này đang chạy, hãy dừng nó trước
    if (workers[roomType]) {
        console.log(`[Bot Manager] Đang dừng worker cũ cho phòng '${roomType}'...`);
        const oldWorker = workers[roomType];
        
        // Gỡ bỏ listener 'exit' để tránh trigger auto-restart khi ta chủ động dừng
        oldWorker.removeAllListeners('exit');

        // Gửi tín hiệu dừng nhẹ nhàng
        oldWorker.send({ type: 'STOP' });

        // Đợi worker tắt hẳn để tránh xung đột 409 (quan trọng)
        await new Promise(resolve => {
            const t = setTimeout(() => { oldWorker.kill(); resolve(); }, 5000);
            oldWorker.once('exit', () => { clearTimeout(t); resolve(); });
        });

        delete workers[roomType];
    }

    // 2. Nếu trạng thái là TẮT (0), ta dừng ở đây
    if (status !== 1) {
        console.log(`[Bot Manager] Phòng '${roomType}' đã được TẮT.`);
        delete workerConfigs[roomType];
        return;
    }

    // 3. Khởi tạo Worker mới
    console.log(`[Bot Manager] Khởi tạo worker mới cho phòng '${roomType}'...`);
    
    const workerPath = path.join(__dirname, 'bot-worker.js');
    const worker = fork(workerPath);

    // Lưu worker vào danh sách quản lý
    workers[roomType] = worker;

    // Lắng nghe log từ worker (tùy chọn)
    worker.on('message', (msg) => {
        if (msg.type === 'STARTED') console.log(`[Bot Manager] Worker '${roomType}' báo cáo đã chạy.`);
        if (msg.type === 'ERROR') console.error(`[Bot Manager] Worker '${roomType}' báo lỗi: ${msg.error}`);
        if (msg.type === 'LOG') {
            const payload = { roomType, level: msg.level, message: msg.message, timestamp: new Date() };
            logEmitter.emit('worker-log', payload);
            if (ioServer && typeof ioServer.emit === 'function') {
                ioServer.emit('worker-log', payload);
            }
        }
    });

    // Tự động khởi động lại nếu worker bị crash
    worker.on('exit', (code) => {
        if (code !== 0) {
            console.error(`[Bot Manager] Worker '${roomType}' bị crash (code ${code}). Restarting in 3s...`);
            delete workers[roomType];
            
            // Chỉ restart nếu config vẫn đang bật
            if (workerConfigs[roomType] && workerConfigs[roomType].status === 1) {
                setTimeout(() => startOrUpdateBot(workerConfigs[roomType]), 3000);
            }
        }
    });

    // Gửi cấu hình để worker bắt đầu chạy
    worker.send({ type: 'START', config });
}

module.exports = { startOrUpdateBot, logEmitter, setIo };