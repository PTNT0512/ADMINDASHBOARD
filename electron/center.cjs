const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const fs = require('fs');
const os = require('os');
const path = require('path');
const mongoose = require('mongoose');
const { autoUpdater } = require('electron-updater');
const TelegramBot = require('node-telegram-bot-api');
const http = require('http');

require('../src/init-env.js');

// Cho phép phát âm thanh thông báo tự động mà không cần tương tác người dùng
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

// Khởi tạo Bot Hệ Thống gửi OTP (Không cần polling vì chỉ dùng để gửi tin nhắn)
let systemBot = null;
if (process.env.SYSTEM_BOT_TOKEN) {
  systemBot = new TelegramBot(process.env.SYSTEM_BOT_TOKEN);
  console.log('[Center] Bot hệ thống gửi OTP đã sẵn sàng.');
}
let currentOTP = null;
let otpExpiry = null;
let otpAttempts = 0;
const MAX_OTP_ATTEMPTS = 3;

const User = require('../src/models/User.js');
const Setting = require('../src/models/Setting.js');
const License = require('../src/models/License.js');
const ActivationLog = require('../src/models/ActivationLog.js');

const isDev = !app.isPackaged;

// Chỉ định thư mục cache riêng để tránh lỗi "Access Denied" khi chạy dev
if (isDev) {
  app.setPath('userData', path.join(app.getPath('appData'), `../Local/${app.getName()}-center-dev`));
}

let mainWindow;
const appLogs = [];
const MAX_LOGS = 200;

// --- LOGGING SYSTEM (Để người mua theo dõi Bot) ---
const originalConsoleLog = console.log;
const originalConsoleError = console.error;

function pushLog(type, message) {
  const logEntry = { time: new Date().toLocaleTimeString(), type, message };
  appLogs.push(logEntry);
  if (appLogs.length > MAX_LOGS) appLogs.shift();
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('new-log', logEntry);
}

console.log = (...args) => {
  originalConsoleLog(...args);
  pushLog('INFO', args.map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' '));
};

console.error = (...args) => {
  originalConsoleError(...args);
  pushLog('ERROR', args.map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' '));
};

// --- HELPERS ---
let previousCpus = os.cpus();
const getMachineId = () => {
  // Sử dụng crypto để tạo mã định danh an toàn hơn
  const crypto = require('crypto');
  const rawId = `${os.hostname()}-${os.arch()}-${os.platform()}-${os.totalmem()}`;
  return crypto.createHash('sha256').update(rawId).digest('hex');
};

const sanitizeIPC = (obj) => {
  if (obj === null || typeof obj !== 'object') return obj;
  if (obj._bsontype === 'ObjectID' || (obj.constructor && obj.constructor.name === 'ObjectId')) return obj.toString();
  if (obj instanceof Date) return obj;
  
  let data = obj;
  if (typeof obj.toObject === 'function') {
    data = obj.toObject();
  }

  if (Array.isArray(data)) return data.map(sanitizeIPC);
  if (data.constructor && data.constructor.name !== 'Object' && data.constructor.name !== 'model') return data;

  const sanitized = {};
  if (data._id) sanitized.id = data._id.toString();
  for (const [key, value] of Object.entries(data)) {
    if (key.startsWith('$') || (key.startsWith('_') && key !== '_id')) continue;
    sanitized[key] = sanitizeIPC(value);
  }
  return sanitized;
};

const ipcHandle = (channel, listener) => {
  ipcMain.removeHandler(channel);
  ipcMain.handle(channel, async (event, ...args) => {
    try {
      if (mongoose.connection.readyState !== 1) {
        return { success: false, message: 'Chưa kết nối được cơ sở dữ liệu MongoDB. Vui lòng kiểm tra service MongoDB.' };
      }
      const result = await listener(event, ...args);
      return sanitizeIPC(result);
    } catch (error) {
      console.error(`❌ [IPC Error] ${channel}:`, error);
      return { success: false, message: error.message };
    }
  });
};

function getCpuUsage() {
  const currentCpus = os.cpus();
  let idle = 0, total = 0;
  for (let i = 0; i < currentCpus.length; i++) {
    const cpu = currentCpus[i], prevCpu = previousCpus[i];
    for (let type in cpu.times) total += cpu.times[type] - prevCpu.times[type];
    idle += cpu.times.idle - prevCpu.times.idle;
  }
  previousCpus = currentCpus;
  return total === 0 ? 0 : (1 - idle / total) * 100;
}

// --- IPC HANDLERS (Center Specific) ---

// Quản lý Đăng nhập
ipcHandle('login-request', async (e, { username }) => {
  try {
    console.log(`[Login] Yêu cầu đăng nhập: ${username}`);
    const cleanUsername = String(username || '').trim();

    if (cleanUsername !== 'admincenter') {
      return { success: false, message: 'Chỉ tài khoản admincenter mới được phép truy cập vào Center!' };
    }

    // Tìm user trong DB để lấy telegramId chỉ định
    const user = await User.findOne({ username: cleanUsername });
    const targetTelegramId = user?.telegramId || process.env.ADMIN_TELEGRAM_ID;

    if (!systemBot || !targetTelegramId) {
      return { success: false, message: 'Hệ thống OTP chưa được cấu hình (Thiếu Token hoặc Telegram ID)' };
    }

    currentOTP = Math.floor(100000 + Math.random() * 900000).toString();
    otpExpiry = Date.now() + 5 * 60 * 1000; // Mã có hiệu lực trong 5 phút
    otpAttempts = 0; // Reset số lần thử khi tạo mã mới

    await systemBot.sendMessage(targetTelegramId, 
      `🔐 <b>MÃ XÁC THỰC TRUY CẬP CENTER</b>\n\n` +
      `Tài khoản: <code>${cleanUsername}</code>\n` +
      `Mã OTP của bạn là: <code>${currentOTP}</code>\n\n` +
      `Mã có hiệu lực trong 5 phút.`, 
      { parse_mode: 'HTML' }
    );

    console.log(`[OTP] Đã gửi mã xác thực cho ${cleanUsername} tới Telegram ID: ${targetTelegramId}`);
    return { success: true, otpRequired: true };
  } catch (err) {
    console.error(`❌ [Login Error]:`, err);
    return { success: false, message: 'Lỗi hệ thống khi đăng nhập.' };
  }
});

ipcHandle('verify-otp', async (e, { otp }) => {
  console.log(`[OTP Verify] Đang kiểm tra mã: ${otp} (Mã đúng trong hệ thống: ${currentOTP})`);

  if (!currentOTP || Date.now() > otpExpiry) {
    return { success: false, message: 'Mã OTP đã hết hạn hoặc không tồn tại. Vui lòng đăng nhập lại.' };
  }
  if (otp === currentOTP) {
    currentOTP = null; // Xóa mã sau khi dùng thành công
    otpExpiry = null;
    otpAttempts = 0;
    return { success: true, role: 'superadmin' }; // Trả về role tối cao cho Center
  }

  otpAttempts++;
  if (otpAttempts >= MAX_OTP_ATTEMPTS) {
    currentOTP = null; // Vô hiệu hóa mã nếu sai quá nhiều lần
    otpExpiry = null;
    return { success: false, message: `Bạn đã nhập sai quá ${MAX_OTP_ATTEMPTS} lần. Vui lòng đăng nhập lại để nhận mã mới.` };
  }

  return { success: false, message: `Mã OTP không chính xác. Bạn còn ${MAX_OTP_ATTEMPTS - otpAttempts} lần thử.` };
});

ipcHandle('change-password', async (event, { username, oldPassword, newPassword, newUsername }) => {
  const user = await User.findOne({ username });
  if (!user || !(await user.comparePassword(oldPassword))) return { success: false, message: 'Mật khẩu cũ không chính xác.' };
  user.password = newPassword;
  if (newUsername) user.username = newUsername;
  user.isFirstLogin = false;
  await user.save();
  return { success: true };
});

ipcHandle('get-admins', async () => ({ success: true, data: await User.find({}).select('-password').lean() }));

ipcHandle('create-admin', async (event, { username, password, role }) => {
  if (await User.findOne({ username })) return { success: false, message: 'Tên đăng nhập đã tồn tại.' };
  await User.create({ username, password, role, isFirstLogin: true });
  return { success: true };
});

ipcHandle('delete-admin', async (event, id) => {
  const user = await User.findById(id);
  if (user?.username === 'admincenter') return { success: false, message: 'Không thể xóa tài khoản gốc.' };
  await User.findByIdAndDelete(id);
  return { success: true };
});

// Cập nhật thông tin admin (role, status, password)
ipcHandle('update-admin', async (event, payload) => {
  const { id } = payload || {};
  if (!id) return { success: false, message: 'ID không hợp lệ.' };
  const user = await User.findById(id);
  if (!user) return { success: false, message: 'Không tìm thấy tài khoản.' };

  // Không cho phép thay đổi tài khoản admin center gốc
  if (user.username === 'admincenter') return { success: false, message: 'Không thể chỉnh sửa tài khoản gốc.' };

  if (typeof payload.role === 'string') user.role = payload.role;
  if (typeof payload.status === 'string') user.status = payload.status;
  if (payload.password) {
    user.password = payload.password;
    user.isFirstLogin = false;
  }

  await user.save();
  return { success: true };
});

// Quản lý License cho người mua
ipcHandle('get-licenses', async () => {
  try {
    const list = await License.find({}).sort({ date: -1 }).lean();
    return { success: true, data: list };
  } catch (e) {
    return { success: false, message: e.message };
  }
});

ipcHandle('create-license', async (event, { clientName, durationDays }) => {
  try {
    const randomStr = () => Math.random().toString(36).substring(2, 7).toUpperCase();
    const key = `LASVEGAS-${randomStr()}-${randomStr()}`;
    let expiryDate = null;
    if (durationDays && parseInt(durationDays) > 0) {
      expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + parseInt(durationDays));
    }
    const newLicense = await License.create({ key, clientName, expiryDate });
    return { success: true, data: newLicense };
  } catch (e) {
    return { success: false, message: e.message };
  }
});

ipcHandle('toggle-license-status', async (event, { id, isActive }) => {
  try {
    await License.findByIdAndUpdate(id, { isActive });
    return { success: true };
  } catch (e) {
    return { success: false, message: e.message };
  }
});

ipcHandle('reset-license-machine', async (event, id) => {
  try {
    await License.findByIdAndUpdate(id, { machineId: null, activatedAt: null });
    return { success: true };
  } catch (e) {
    return { success: false, message: e.message };
  }
});

ipcHandle('renew-license', async (event, { id, additionalDays }) => {
  try {
    const days = parseInt(additionalDays);
    const license = await License.findById(id);
    if (!license) return { success: false, message: 'Không tìm thấy bản quyền.' };
    let baseDate = (license.expiryDate && new Date(license.expiryDate) > new Date()) ? new Date(license.expiryDate) : new Date();
    baseDate.setDate(baseDate.getDate() + days);
    license.expiryDate = baseDate;
    await license.save();
    return { success: true, data: license };
  } catch (e) {
    return { success: false, message: e.message };
  }
});

ipcHandle('delete-license', async (event, id) => {
  try {
    await License.findByIdAndDelete(id);
    return { success: true };
  } catch (e) {
    return { success: false, message: e.message };
  }
});

ipcHandle('activate-license', async (e, key) => {
  const license = await License.findOne({ key, isActive: true });
  if (!license) return { success: false, message: 'Key không hợp lệ hoặc đã bị khóa' };
  if (license.machineId && license.machineId !== getMachineId()) return { success: false, message: 'Key đã được dùng cho máy khác' };
  
  license.machineId = getMachineId();
  license.activatedAt = new Date();
  await license.save();
  return { success: true, message: 'Kích hoạt thành công!' };
});

// Quản lý Game & Bot
ipcHandle('get-settings', async () => ({ success: true, data: await Setting.findOne({}).lean() }));

ipcHandle('get-dashboard-stats', async () => {
  return { 
    success: true, 
    data: { 
      totalUsers: 0, totalBalance: 0, todayNewUsers: 0, 
      totalDeposit: 0, totalWithdraw: 0, pendingDeposits: 0, pendingWithdraws: 0 
    } 
  };
});

// Tiện ích hệ thống
ipcHandle('get-logs', () => appLogs);
ipcHandle('export-logs', async (event, content) => {
  const { canceled, filePath } = await dialog.showSaveDialog({
    title: 'Xuất log hệ thống', defaultPath: `bot-logs-${Date.now()}.txt`
  });
  if (!canceled && filePath) { fs.writeFileSync(filePath, content, 'utf-8'); return { success: true }; }
  return { success: false };
});

ipcHandle('get-activation-logs', async () => {
  try {
    const logs = await ActivationLog.find({}).sort({ date: -1 }).limit(200).lean();
    return { success: true, data: logs };
  } catch (e) { return { success: false, message: e.message }; }
});

ipcHandle('get-activation-logs', async () => {
  try {
    const logs = await ActivationLog.find({}).sort({ date: -1 }).limit(200).lean();
    return { success: true, data: logs };
  } catch (e) { return { success: false, message: e.message }; }
});

// --- API SERVER FOR LICENSE ACTIVATION ---
const apiServer = http.createServer(async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*'); // Cho phép truy cập từ mọi nguồn (localhost:5173)
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.url === '/api/activate' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', async () => {
      try {
        const { key, machineId } = JSON.parse(body);
        const license = await License.findOne({ key, isActive: true });
        const ip = req.socket.remoteAddress;

        if (!license) {
          await ActivationLog.create({ key, machineId, ip, status: 'FAILED', reason: 'Key không hợp lệ' });
          res.writeHead(404, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ success: false, message: 'Key không hợp lệ hoặc đã bị khóa.' }));
        }
        if (license.machineId) { // Nếu đã có machineId, tức là đã được dùng
          await ActivationLog.create({ key, machineId, ip, status: 'FAILED', reason: 'Key đã được sử dụng' });
          res.writeHead(403, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ success: false, message: 'Key đã được sử dụng trên một máy khác.' }));
        }

        license.machineId = machineId;
        license.activatedAt = new Date();
        await license.save();
        await ActivationLog.create({ key, machineId, ip, status: 'SUCCESS', reason: 'Kích hoạt thành công' });

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, data: { clientName: license.clientName, expiryDate: license.expiryDate } }));
      } catch (error) {
        await ActivationLog.create({ key: 'N/A', machineId: 'N/A', status: 'FAILED', reason: 'Lỗi server: ' + error.message });
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, message: 'Lỗi máy chủ Center: ' + error.message }));
      }
    });
  } else {
    res.writeHead(404);
    res.end(JSON.stringify({ success: false, message: 'Endpoint không tồn tại.' }));
  }
});

// --- AUTO UPDATER ---
const sendUpdateStatus = (text) => { if (mainWindow) mainWindow.webContents.send('update-message', text); };
autoUpdater.on('checking-for-update', () => sendUpdateStatus('Đang kiểm tra bản cập nhật...'));
autoUpdater.on('update-available', () => sendUpdateStatus('Có bản cập nhật mới. Đang tải...'));
autoUpdater.on('update-not-available', () => sendUpdateStatus('Ứng dụng đã ở bản mới nhất.'));
autoUpdater.on('update-downloaded', () => sendUpdateStatus('Tải xong. Khởi động lại để cập nhật.'));
autoUpdater.autoDownload = true;

const connectDB = async () => {
  if (mongoose.connection.readyState >= 1) return;
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/lasvegas';
  try {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000,
      bufferCommands: false,
    });
    console.log('[Center] DB Connected');

    // Xử lý index cũ và tạo tài khoản admin mặc định
    try {
      // Xóa index cũ gây lỗi nếu tồn tại
      await User.collection.dropIndex('local.username_1').catch(() => {});
      
      const adminExists = await User.findOne({ username: 'admincenter' });
      if (!adminExists) {
        await User.create({
          username: 'admincenter',
          password: '1',
          role: 'superadmin', // Đảm bảo tài khoản này có quyền superadmin
          isFirstLogin: true,
          telegramId: process.env.ADMIN_TELEGRAM_ID // Lưu ID chỉ định từ env vào DB ngay khi tạo
        });
        console.log('✅ [Center] Đã tạo tài khoản mặc định: admincenter / 1 (Role: admin)');
      }
    } catch (createErr) {
      console.warn('⚠️ [Center] Thông báo hệ thống:', createErr.message);
    }
  } catch (err) {
    console.error('❌ [Center] Lỗi kết nối MongoDB:', err.message);
    if (err.message.includes('ECONNREFUSED') || err.message.includes('timeout')) {
      setTimeout(connectDB, 5000);
    }
  }
};

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1000, height: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });
  if (isDev) mainWindow.loadURL('http://localhost:5174');
  else mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
}

app.whenReady().then(async () => {
  await connectDB();
  createWindow();

  // Khởi chạy API Server trên cổng 5174
  const apiPort = 5175; // Đổi sang cổng khác để tránh xung đột với Vite
  if (!apiServer.listening) {
    apiServer.listen(apiPort, () => {
      console.log(`[API Server] Đang lắng nghe yêu cầu kích hoạt tại http://localhost:${apiPort}`);
    });
  }

  // Gửi thông số hệ thống cho Dashboard mỗi 2 giây
  setInterval(() => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      const totalMem = os.totalmem();
      const usedMem = totalMem - os.freemem();
      mainWindow.webContents.send('system-stats', {
        cpu: getCpuUsage().toFixed(1),
        mem: ((usedMem / totalMem) * 100).toFixed(1),
        totalMem: (totalMem / 1024 / 1024 / 1024).toFixed(2) + ' GB',
        usedMem: (usedMem / 1024 / 1024 / 1024).toFixed(2) + ' GB',
        uptime: (os.uptime() / 3600).toFixed(1) + ' giờ'
      });
    }
  }, 2000);

  // Allow auto-updater to run in dev when explicitly enabled via env var
  const enableUpdaterInDev = process.env.ENABLE_UPDATER_IN_DEV === '1' || process.env.FORCE_UPDATER_IN_DEV === '1';
  if (!isDev || enableUpdaterInDev) {
    try {
      autoUpdater.checkForUpdatesAndNotify();
      console.log('[Updater] autoUpdater.checkForUpdatesAndNotify enabled', { isDev, enableUpdaterInDev });
    } catch (e) {
      console.warn('[Updater] checkForUpdatesAndNotify failed:', e && e.message ? e.message : e);
    }
  } else {
    console.log('[Updater] auto-updates disabled in dev (set ENABLE_UPDATER_IN_DEV=1 to enable)');
  }
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });