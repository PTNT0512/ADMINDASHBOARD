import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import { autoUpdater } from 'electron-updater';

// Tạo __dirname cho ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Kiểm tra môi trường development
const isDev = !app.isPackaged;

// --- CẤU HÌNH MONGODB ---
// Định nghĩa Schema User
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true } // Lưu ý: Thực tế nên mã hóa password (bcrypt)
});

const User = mongoose.model('User', userSchema);

// Hàm kết nối và tạo Admin mặc định
const connectDB = async () => {
  try {
    // Kết nối đến MongoDB local
    await mongoose.connect('mongodb://127.0.0.1:27017/admin_app_db');
    console.log('MongoDB Connected');

    // Kiểm tra và tạo admin mặc định
    const adminExists = await User.findOne({ username: 'admin' });
    if (!adminExists) {
      await User.create({ username: 'admin', password: '1' });
      console.log('Đã tạo tài khoản mặc định: admin / 1');
    }
  } catch (err) {
    console.error('Lỗi kết nối MongoDB:', err);
  }
};

// Xử lý IPC: Đăng nhập
ipcMain.handle('login-request', async (event, { username, password }) => {
  try {
    const user = await User.findOne({ username });
    if (user && user.password === password) {
      return { success: true };
    }
    return { success: false, message: 'Sai tên đăng nhập hoặc mật khẩu!' };
  } catch (error) {
    return { success: false, message: 'Lỗi server: ' + error.message };
  }
});

// --- AUTO UPDATER ---
// Tự động tải xuống khi có update
autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;

const sendUpdateStatusToWindow = (text) => {
  if (mainWindow) {
    mainWindow.webContents.send('update-message', text);
  }
};

autoUpdater.on('checking-for-update', () => {
  sendUpdateStatusToWindow('Đang kiểm tra bản cập nhật...');
});

autoUpdater.on('update-available', (info) => {
  sendUpdateStatusToWindow('Có bản cập nhật mới. Đang tải xuống...');
});

autoUpdater.on('update-not-available', (info) => {
  sendUpdateStatusToWindow('Ứng dụng đang ở phiên bản mới nhất.');
});

autoUpdater.on('update-downloaded', (info) => {
  sendUpdateStatusToWindow('Tải xong. Khởi động lại để cập nhật.');
  // Có thể hỏi người dùng trước khi restart, ở đây demo sẽ tự restart sau 2s
  // setTimeout(() => autoUpdater.quitAndInstall(), 2000);
});

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false, // Để đơn giản cho demo, thực tế nên bật true và dùng preload
    },
  });

  // Nếu đang dev thì load localhost, nếu build rồi thì load file html
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    // Mở DevTools khi đang dev
    mainWindow.webContents.openDevTools();
  } else {
    // Vì file electron.js nằm trong src, cần lùi ra 1 cấp để vào dist
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

app.whenReady().then(() => {
  connectDB(); // Kết nối DB khi app khởi động
  createWindow();
  
  // Kiểm tra update ngay khi app chạy (chỉ chạy khi đã đóng gói build)
  if (!isDev) {
    autoUpdater.checkForUpdatesAndNotify();
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
