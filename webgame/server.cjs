const express = require('express');
const path = require('path');
const app = express();

// Cổng chạy server (Mặc định 3005)
const PORT = process.env.PORT || 3005;

// Đường dẫn đến thư mục build (dist)
const BUILD_DIR = path.join(__dirname, 'dist');

// 1. Phục vụ các file tĩnh (JS, CSS, Images) từ thư mục dist
app.use(express.static(BUILD_DIR));

// 2. Xử lý Client-side Routing của React
// Mọi request không phải file tĩnh sẽ trả về index.html để React Router xử lý
app.get('*', (req, res) => {
  res.sendFile(path.join(BUILD_DIR, 'index.html'));
});

// Khởi động server
app.listen(PORT, () => {
  console.log(`🚀 [Game Portal] Server chính thức đang chạy tại http://localhost:${PORT}`);
});