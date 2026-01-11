const dotenv = require('dotenv');
const path = require('path');

// 1. Đăng ký bắt lỗi toàn cục ngay lập tức
process.on('uncaughtException', (error) => {
  process.stderr.write(`❌ LỖI NGHIÊM TRỌNG (Uncaught Exception): ${error.stack || error}\n`);
});

process.on('unhandledRejection', (reason, promise) => {
  process.stderr.write(`❌ LỖI HỨA HẸN (Unhandled Rejection) tại: ${promise} Lý do: ${reason}\n`);
});
// 2. Nạp cấu hình .env (Trong CommonJS, __dirname đã có sẵn)
// Lùi ra 1 cấp vì file này nằm trong src/
const envPath = path.resolve(__dirname, '..', `.env.${process.env.VITE_APP_MODE || 'dashboard'}`);
dotenv.config({ path: envPath });

process.stdout.write(`[Main] Đã nạp môi trường từ: ${envPath}\n`);