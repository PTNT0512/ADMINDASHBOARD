const express = require('express');
const path = require('path');
const app = express();
const PORT = 80;

// Đường dẫn đến thư mục chứa file build của trang landing (hoặc thư mục public nếu chưa build)
// Giả sử trang landing nằm trong thư mục 'landing' cùng cấp với thư mục src
const LANDING_DIR = path.join(__dirname, '../landing');

// Phục vụ các file tĩnh từ thư mục landing
app.use(express.static(LANDING_DIR));

// Route mặc định trả về index.html
app.get(/.*/, (req, res) => {
    res.sendFile(path.join(LANDING_DIR, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Landing page server is running on port ${PORT}`);
});