const { spawnSync } = require('child_process');
const { EventEmitter } = require('events');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const crypto = require('crypto');
const express = require('express');
const cors = require('cors');
const { Server } = require('socket.io');

const CENTER_WEB_ONLY = /^(1|true|yes|on)$/i.test(String(process.env.CENTER_WEB_ONLY || '').trim());
const electronModule = require('electron');
const packageJson = require('../package.json');

let app;
let BrowserWindow;
let ipcMain;
let dialog;

if (electronModule && typeof electronModule !== 'string' && electronModule.app) {
  ({ app, BrowserWindow, ipcMain, dialog } = electronModule);
} else if (CENTER_WEB_ONLY) {
  const fakeApp = new EventEmitter();
  const fakePaths = new Map();
  const isPackaged = String(process.env.NODE_ENV || '').toLowerCase() === 'production';
  const resolveDefaultPath = (name) => {
    if (name === 'appData') return path.join(os.homedir(), 'AppData', 'Roaming');
    return os.tmpdir();
  };

  app = Object.assign(fakeApp, {
    isPackaged,
    whenReady: () => Promise.resolve(),
    quit: () => {},
    getName: () => packageJson.productName || packageJson.name || 'admin-app',
    getVersion: () => packageJson.version || '0.0.0',
    getPath: (name) => fakePaths.get(name) || resolveDefaultPath(name),
    setPath: (name, value) => {
      fakePaths.set(name, value);
    },
    requestSingleInstanceLock: () => true,
    disableHardwareAcceleration: () => {},
    commandLine: {
      appendSwitch: () => {},
    },
  });

  BrowserWindow = function UnsupportedBrowserWindow() {
    throw new Error('BrowserWindow is unavailable in center web-only mode.');
  };

  ipcMain = {
    removeHandler: () => {},
    handle: () => {},
  };

  dialog = {
    showSaveDialog: async () => ({ canceled: true, filePath: '' }),
    showErrorBox: (title, content) => {
      console.error(`[Dialog:${title}] ${content}`);
    },
  };
} else {
  if (process.env.CENTER_ELECTRON_RELAUNCHED === '1') {
    throw new Error(
      'Electron app API is unavailable. Ensure ELECTRON_RUN_AS_NODE is not set for center startup.',
    );
  }
  const electronBin = typeof electronModule === 'string' ? electronModule : process.execPath;
  const env = { ...process.env, CENTER_ELECTRON_RELAUNCHED: '1' };
  delete env.ELECTRON_RUN_AS_NODE;
  const relaunch = spawnSync(electronBin, [__filename, ...process.argv.slice(2)], {
    stdio: 'inherit',
    env,
  });
  process.exit(Number.isInteger(relaunch.status) ? relaunch.status : 1);
}

let autoUpdater = null;
try {
  ({ autoUpdater } = require('electron-updater'));
} catch (_) {
  autoUpdater = null;
}

process.env.NTBA_FIX_350 = process.env.NTBA_FIX_350 || '1';
const TelegramBot = require('node-telegram-bot-api');
const {
  patchTelegramBotEncoding,
  normalizePayload,
} = require('../src/utils/telegram-bot-normalizer.js');
patchTelegramBotEncoding(TelegramBot);

require('../src/init-env.js');

if (app && app.commandLine && typeof app.commandLine.appendSwitch === 'function') {
  app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
}

const User = require('../src/models/User.js');
const Setting = require('../src/models/Setting.js');
const License = require('../src/models/License.js');
const ActivationLog = require('../src/models/ActivationLog.js');
const mongoose = require('mongoose');

const isDev = !app.isPackaged;
const CENTER_SERVE_STATIC = CENTER_WEB_ONLY || /^(1|true|yes|on)$/i.test(String(process.env.CENTER_SERVE_STATIC || '').trim());
const CENTER_HOST = String(process.env.CENTER_HOST || '127.0.0.1').trim() || '127.0.0.1';
const CENTER_PORT = Number(process.env.CENTER_PORT || 5174) || 5174;
const CENTER_API_HOST = String(process.env.CENTER_API_HOST || CENTER_HOST || '127.0.0.1').trim() || '127.0.0.1';
const CENTER_API_PORT = Number(process.env.CENTER_API_PORT || (CENTER_PORT + 1)) || (CENTER_PORT + 1);
const CENTER_WEB_SESSION_TTL_MS = Number(process.env.CENTER_WEB_SESSION_TTL_MS || (12 * 60 * 60 * 1000)) || (12 * 60 * 60 * 1000);
const CENTER_WEB_SESSION_HEADER = 'x-center-session-token';

if (isDev) {
  app.setPath('userData', path.join(app.getPath('appData'), `../Local/${app.getName()}-center-dev`));
}

let systemBot = null;
if (process.env.SYSTEM_BOT_TOKEN) {
  systemBot = new TelegramBot(process.env.SYSTEM_BOT_TOKEN);
  console.log('[Center] Bot he thong gui OTP da san sang.');
}

let currentOTP = null;
let otpExpiry = null;
let otpAttempts = 0;
const MAX_OTP_ATTEMPTS = 3;

let mainWindow = null;
let centerWebNamespace = null;
let centerWebHttpServer = null;
let systemStatsInterval = null;
const centerWebSessionStore = new Map();
const ipcInvokeHandlers = new Map();
const appLogs = [];
const MAX_LOGS = 200;
let previousCpus = os.cpus();

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

const cleanupExpiredCenterWebSessions = () => {
  const now = Date.now();
  for (const [token, sessionInfo] of centerWebSessionStore.entries()) {
    if (!sessionInfo || Number(sessionInfo.expiresAt || 0) <= now) {
      centerWebSessionStore.delete(token);
    }
  }
};

const issueCenterWebSession = (payload = {}) => {
  cleanupExpiredCenterWebSessions();
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = Date.now() + CENTER_WEB_SESSION_TTL_MS;
  const sessionInfo = {
    username: String(payload.username || '').trim() || 'admincenter',
    role: String(payload.role || 'superadmin').trim() || 'superadmin',
    expiresAt,
  };
  centerWebSessionStore.set(token, sessionInfo);
  return { token, expiresAt, sessionInfo };
};

const getCenterWebSession = (token) => {
  const rawToken = String(token || '').trim();
  if (!rawToken) return null;
  cleanupExpiredCenterWebSessions();
  const sessionInfo = centerWebSessionStore.get(rawToken);
  if (!sessionInfo) return null;
  if (Number(sessionInfo.expiresAt || 0) <= Date.now()) {
    centerWebSessionStore.delete(rawToken);
    return null;
  }
  return sessionInfo;
};

const resolveCenterWebSessionTokenFromRequest = (req) => {
  const headerToken = String(req.headers[CENTER_WEB_SESSION_HEADER] || '').trim();
  if (headerToken) return headerToken;

  const authHeader = String(req.headers.authorization || '').trim();
  const bearerMatch = authHeader.match(/^Bearer\s+(.+)$/i);
  if (bearerMatch && bearerMatch[1]) return String(bearerMatch[1]).trim();

  return String(req.query?.centerSessionToken || '').trim();
};

const emitCenterUiEvent = (channel, ...args) => {
  const sanitizedArgs = args.map((item) => sanitizeIPC(item));

  if (mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents && !mainWindow.webContents.isDestroyed()) {
    try {
      mainWindow.webContents.send(channel, ...sanitizedArgs);
    } catch (_) {}
  }

  if (centerWebNamespace) {
    centerWebNamespace.emit('center:ipc-event', { channel, args: sanitizedArgs });
  }
};

const originalConsoleLog = console.log;
const originalConsoleError = console.error;

function pushLog(type, message) {
  const logEntry = { time: new Date().toLocaleTimeString(), type, message };
  appLogs.push(logEntry);
  if (appLogs.length > MAX_LOGS) appLogs.shift();
  emitCenterUiEvent('new-log', logEntry);
}

console.log = (...args) => {
  originalConsoleLog(...args);
  pushLog('INFO', args.map((arg) => (typeof arg === 'object' ? JSON.stringify(arg) : String(arg))).join(' '));
};

console.error = (...args) => {
  originalConsoleError(...args);
  pushLog('ERROR', args.map((arg) => (typeof arg === 'object' ? JSON.stringify(arg) : String(arg))).join(' '));
};

const invokeRegisteredIpcHandler = async (channel, args = [], options = {}) => {
  const { event = null, skipMongoCheck = false } = options;
  const listener = ipcInvokeHandlers.get(channel);
  if (!listener) {
    throw new Error(`No IPC handler registered for channel "${channel}"`);
  }

  if (!skipMongoCheck && mongoose.connection.readyState !== 1) {
    return sanitizeIPC({
      success: false,
      message: 'Chua ket noi duoc MongoDB. Vui long kiem tra lai dich vu MongoDB.',
    });
  }

  const result = await listener(event, ...args);
  return sanitizeIPC(result);
};

const ipcHandle = (channel, listener) => {
  ipcInvokeHandlers.set(channel, listener);
  ipcMain.removeHandler(channel);
  ipcMain.handle(channel, async (event, ...args) => {
    try {
      return await invokeRegisteredIpcHandler(channel, args, { event });
    } catch (error) {
      console.error(`[IPC Error] ${channel}:`, error);
      return sanitizeIPC({ success: false, message: error.message });
    }
  });
};

function getCpuUsage() {
  const currentCpus = os.cpus();
  let idle = 0;
  let total = 0;
  for (let i = 0; i < currentCpus.length; i += 1) {
    const cpu = currentCpus[i];
    const prevCpu = previousCpus[i];
    for (const type in cpu.times) {
      total += cpu.times[type] - prevCpu.times[type];
    }
    idle += cpu.times.idle - prevCpu.times.idle;
  }
  previousCpus = currentCpus;
  return total === 0 ? 0 : (1 - idle / total) * 100;
}

const getMachineId = () => {
  const rawId = `${os.hostname()}-${os.arch()}-${os.platform()}-${os.totalmem()}`;
  return crypto.createHash('sha256').update(rawId).digest('hex');
};

ipcHandle('login-request', async (event, { username }) => {
  try {
    const cleanUsername = String(username || '').trim();
    console.log(`[Login] Yeu cau dang nhap: ${cleanUsername}`);

    if (cleanUsername !== 'admincenter') {
      return { success: false, message: 'Chi tai khoan admincenter moi duoc phep truy cap Center.' };
    }

    const user = await User.findOne({ username: cleanUsername });
    const targetTelegramId = user?.telegramId || process.env.ADMIN_TELEGRAM_ID;

    if (!systemBot || !targetTelegramId) {
      return { success: false, message: 'He thong OTP chua duoc cau hinh day du.' };
    }

    currentOTP = Math.floor(100000 + Math.random() * 900000).toString();
    otpExpiry = Date.now() + 5 * 60 * 1000;
    otpAttempts = 0;

    await systemBot.sendMessage(
      targetTelegramId,
      `ðŸ” <b>MA XAC THUC TRUY CAP CENTER</b>\n\nTai khoan: <code>${cleanUsername}</code>\nMa OTP: <code>${currentOTP}</code>\n\nMa co hieu luc trong 5 phut.`,
      { parse_mode: 'HTML' },
    );

    console.log(`[OTP] Da gui ma xac thuc cho ${cleanUsername} toi Telegram ID: ${targetTelegramId}`);
    return { success: true, otpRequired: true };
  } catch (error) {
    console.error('[Login Error]:', error);
    return { success: false, message: 'Loi he thong khi khoi tao OTP.' };
  }
});

ipcHandle('verify-otp', async (event, { otp }) => {
  console.log(`[OTP Verify] Dang kiem tra ma: ${otp} (Ma dung trong he thong: ${currentOTP})`);

  if (!currentOTP || Date.now() > otpExpiry) {
    return { success: false, message: 'Ma OTP da het han hoac khong ton tai. Vui long dang nhap lai.' };
  }

  if (otp === currentOTP) {
    currentOTP = null;
    otpExpiry = null;
    otpAttempts = 0;
    return { success: true, role: 'superadmin' };
  }

  otpAttempts += 1;
  if (otpAttempts >= MAX_OTP_ATTEMPTS) {
    currentOTP = null;
    otpExpiry = null;
    return { success: false, message: `Ban da nhap sai qua ${MAX_OTP_ATTEMPTS} lan. Vui long dang nhap lai de nhan ma moi.` };
  }

  return { success: false, message: `Ma OTP khong chinh xac. Ban con ${MAX_OTP_ATTEMPTS - otpAttempts} lan thu.` };
});

ipcHandle('change-password', async (event, { username, oldPassword, newPassword, newUsername }) => {
  const user = await User.findOne({ username });
  if (!user || !(await user.comparePassword(oldPassword))) {
    return { success: false, message: 'Mat khau cu khong chinh xac.' };
  }

  user.password = newPassword;
  if (newUsername) user.username = newUsername;
  user.isFirstLogin = false;
  await user.save();
  return { success: true };
});

ipcHandle('get-admins', async () => ({
  success: true,
  data: await User.find({}).select('-password').lean(),
}));

ipcHandle('create-admin', async (event, { username, password, role }) => {
  if (await User.findOne({ username })) {
    return { success: false, message: 'Ten dang nhap da ton tai.' };
  }
  await User.create({ username, password, role, isFirstLogin: true });
  return { success: true };
});

ipcHandle('delete-admin', async (event, id) => {
  const user = await User.findById(id);
  if (user?.username === 'admincenter') {
    return { success: false, message: 'Khong the xoa tai khoan goc.' };
  }
  await User.findByIdAndDelete(id);
  return { success: true };
});

ipcHandle('update-admin', async (event, payload) => {
  const { id } = payload || {};
  if (!id) return { success: false, message: 'ID khong hop le.' };

  const user = await User.findById(id);
  if (!user) return { success: false, message: 'Khong tim thay tai khoan.' };
  if (user.username === 'admincenter') {
    return { success: false, message: 'Khong the chinh sua tai khoan goc.' };
  }

  if (typeof payload.role === 'string') user.role = payload.role;
  if (typeof payload.status === 'string') user.status = payload.status;
  if (payload.password) {
    user.password = payload.password;
    user.isFirstLogin = false;
  }

  await user.save();
  return { success: true };
});

ipcHandle('get-licenses', async () => {
  try {
    const list = await License.find({}).sort({ date: -1 }).lean();
    return { success: true, data: list };
  } catch (error) {
    return { success: false, message: error.message };
  }
});

ipcHandle('create-license', async (event, { clientName, durationDays, allowGithubUpdates = true }) => {
  try {
    const randomStr = () => Math.random().toString(36).substring(2, 7).toUpperCase();
    const key = `LASVEGAS-${randomStr()}-${randomStr()}`;
    let expiryDate = null;

    if (durationDays && parseInt(durationDays, 10) > 0) {
      expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + parseInt(durationDays, 10));
    }

    const newLicense = await License.create({
      key,
      clientName,
      expiryDate,
      allowGithubUpdates: allowGithubUpdates !== false,
    });
    return { success: true, data: newLicense };
  } catch (error) {
    return { success: false, message: error.message };
  }
});

ipcHandle('toggle-license-status', async (event, { id, isActive }) => {
  try {
    await License.findByIdAndUpdate(id, { isActive });
    return { success: true };
  } catch (error) {
    return { success: false, message: error.message };
  }
});

ipcHandle('toggle-license-github-updates', async (event, { id, allowGithubUpdates }) => {
  try {
    await License.findByIdAndUpdate(id, { allowGithubUpdates: allowGithubUpdates !== false });
    return { success: true };
  } catch (error) {
    return { success: false, message: error.message };
  }
});

ipcHandle('reset-license-machine', async (event, id) => {
  try {
    await License.findByIdAndUpdate(id, { machineId: null, activatedAt: null });
    return { success: true };
  } catch (error) {
    return { success: false, message: error.message };
  }
});

ipcHandle('renew-license', async (event, { id, additionalDays }) => {
  try {
    const days = parseInt(additionalDays, 10);
    const license = await License.findById(id);
    if (!license) return { success: false, message: 'Khong tim thay ban quyen.' };

    const now = new Date();
    const baseDate = license.expiryDate && new Date(license.expiryDate) > now
      ? new Date(license.expiryDate)
      : now;

    baseDate.setDate(baseDate.getDate() + days);
    license.expiryDate = baseDate;
    await license.save();
    return { success: true, data: license };
  } catch (error) {
    return { success: false, message: error.message };
  }
});

ipcHandle('delete-license', async (event, id) => {
  try {
    await License.findByIdAndDelete(id);
    return { success: true };
  } catch (error) {
    return { success: false, message: error.message };
  }
});

ipcHandle('activate-license', async (event, key) => {
  const license = await License.findOne({ key, isActive: true });
  if (!license) return { success: false, message: 'Key khong hop le hoac da bi khoa.' };
  if (license.machineId && license.machineId !== getMachineId()) {
    return { success: false, message: 'Key da duoc dung cho mot may khac.' };
  }

  license.machineId = getMachineId();
  license.activatedAt = new Date();
  await license.save();
  return {
    success: true,
    message: 'Kich hoat thanh cong!',
    data: {
      clientName: license.clientName,
      expiryDate: license.expiryDate,
      allowGithubUpdates: license.allowGithubUpdates !== false,
    },
  };
});

ipcHandle('get-settings', async () => ({
  success: true,
  data: await Setting.findOne({}).lean(),
}));

ipcHandle('get-dashboard-stats', async () => ({
  success: true,
  data: {
    totalUsers: 0,
    totalBalance: 0,
    todayNewUsers: 0,
    totalDeposit: 0,
    totalWithdraw: 0,
    pendingDeposits: 0,
    pendingWithdraws: 0,
  },
}));

ipcHandle('get-logs', () => appLogs);

ipcHandle('export-logs', async (event, content) => {
  if (CENTER_WEB_ONLY) {
    return {
      success: true,
      fileName: `center-logs-${Date.now()}.txt`,
      content,
      webDownload: true,
    };
  }

  const saveResult = await dialog.showSaveDialog({
    title: 'Xuat log he thong',
    defaultPath: `center-logs-${Date.now()}.txt`,
  });

  if (!saveResult.canceled && saveResult.filePath) {
    fs.writeFileSync(saveResult.filePath, content, 'utf8');
    return { success: true };
  }

  return { success: false };
});

ipcHandle('get-activation-logs', async () => {
  try {
    const logs = await ActivationLog.find({}).sort({ date: -1 }).limit(200).lean();
    return { success: true, data: logs };
  } catch (error) {
    return { success: false, message: error.message };
  }
});

const activationApiServer = http.createServer((req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.url === '/api/activate' && req.method === 'POST') {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk.toString();
    });
    req.on('end', async () => {
      try {
        const { key, machineId } = JSON.parse(body || '{}');
        const license = await License.findOne({ key, isActive: true });
        const ip = req.socket.remoteAddress;

        if (!license) {
          await ActivationLog.create({ key, machineId, ip, status: 'FAILED', reason: 'Key khong hop le' });
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, message: 'Key khong hop le hoac da bi khoa.' }));
          return;
        }

        if (license.machineId) {
          await ActivationLog.create({ key, machineId, ip, status: 'FAILED', reason: 'Key da duoc su dung' });
          res.writeHead(403, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, message: 'Key da duoc su dung tren mot may khac.' }));
          return;
        }

        license.machineId = machineId;
        license.activatedAt = new Date();
        await license.save();
        await ActivationLog.create({ key, machineId, ip, status: 'SUCCESS', reason: 'Kich hoat thanh cong' });

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          data: {
            clientName: license.clientName,
            expiryDate: license.expiryDate,
            allowGithubUpdates: license.allowGithubUpdates !== false,
          },
        }));
      } catch (error) {
        await ActivationLog.create({ key: 'N/A', machineId: 'N/A', status: 'FAILED', reason: 'Loi server: ' + error.message });
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, message: 'Loi may chu Center: ' + error.message }));
      }
    });
    return;
  }

  res.writeHead(404);
  res.end(JSON.stringify({ success: false, message: 'Endpoint khong ton tai.' }));
});

const sendUpdateStatus = (text) => {
  emitCenterUiEvent('update-message', text);
};

if (autoUpdater && typeof autoUpdater.on === 'function') {
  autoUpdater.on('checking-for-update', () => sendUpdateStatus('Dang kiem tra ban cap nhat...'));
  autoUpdater.on('update-available', () => sendUpdateStatus('Co ban cap nhat moi. Dang tai...'));
  autoUpdater.on('update-not-available', () => sendUpdateStatus('Ung dung da o ban moi nhat.'));
  autoUpdater.on('update-downloaded', () => sendUpdateStatus('Tai xong. Khoi dong lai de cap nhat.'));
  autoUpdater.autoDownload = true;
}

const connectDB = async () => {
  if (mongoose.connection.readyState >= 1) return;
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/lasvegas';
  try {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000,
      bufferCommands: false,
    });
    console.log('[Center] DB Connected');

    try {
      await User.collection.dropIndex('local.username_1').catch(() => {});

      const adminExists = await User.findOne({ username: 'admincenter' });
      if (!adminExists) {
        await User.create({
          username: 'admincenter',
          password: '1',
          role: 'superadmin',
          isFirstLogin: true,
          telegramId: process.env.ADMIN_TELEGRAM_ID,
        });
        console.log('[Center] Da tao tai khoan mac dinh: admincenter / 1');
      }
    } catch (createError) {
      console.warn('[Center] Thong bao he thong:', createError.message);
    }
  } catch (error) {
    console.error('[Center] Loi ket noi MongoDB:', error.message);
    if (error.message.includes('ECONNREFUSED') || error.message.includes('timeout')) {
      setTimeout(connectDB, 5000);
    }
  }
};

function createWindow() {
  const windowHost = CENTER_HOST === '0.0.0.0' ? '127.0.0.1' : CENTER_HOST;
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  if (isDev) {
    mainWindow.loadURL(`http://${windowHost}:${CENTER_PORT}`);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

const startActivationApiServer = () => {
  if (activationApiServer.listening) return;

  activationApiServer.on('error', (error) => {
    console.error('[Center] Activation API error:', error);
    dialog.showErrorBox('Loi Activation API', `Khong the mo cong ${CENTER_API_PORT}. ${error?.message || ''}`.trim());
  });

  activationApiServer.listen(CENTER_API_PORT, CENTER_API_HOST, () => {
    console.log(`[API Server] Dang lang nghe yeu cau kich hoat tai http://${CENTER_API_HOST}:${CENTER_API_PORT}`);
  });
};

const startSystemStatsLoop = () => {
  if (systemStatsInterval) clearInterval(systemStatsInterval);

  systemStatsInterval = setInterval(() => {
    const totalMem = os.totalmem();
    const usedMem = totalMem - os.freemem();
    emitCenterUiEvent('system-stats', {
      cpu: getCpuUsage().toFixed(1),
      mem: ((usedMem / totalMem) * 100).toFixed(1),
      totalMem: (totalMem / 1024 / 1024 / 1024).toFixed(2) + ' GB',
      usedMem: (usedMem / 1024 / 1024 / 1024).toFixed(2) + ' GB',
      uptime: (os.uptime() / 3600).toFixed(1) + ' gio',
    });
  }, 2000);
};

const startUpdater = async () => {
  if (CENTER_WEB_ONLY) {
    console.log('[Updater] native updater disabled in center web-only mode.');
    return;
  }

  if (!autoUpdater || typeof autoUpdater.checkForUpdatesAndNotify !== 'function') {
    console.log('[Updater] electron-updater unavailable in current mode.');
    return;
  }

  const enableUpdaterInDev = process.env.ENABLE_UPDATER_IN_DEV === '1' || process.env.FORCE_UPDATER_IN_DEV === '1';
  if (!isDev || enableUpdaterInDev) {
    try {
      const originalPackaged = app.isPackaged;
      try {
        if (isDev && enableUpdaterInDev) app.isPackaged = true;
        await autoUpdater.checkForUpdatesAndNotify();
      } finally {
        try {
          app.isPackaged = originalPackaged;
        } catch (_) {}
      }
      console.log('[Updater] autoUpdater.checkForUpdatesAndNotify enabled', { isDev, enableUpdaterInDev });
    } catch (error) {
      console.warn('[Updater] checkForUpdatesAndNotify failed:', error?.message || error);
    }
  } else {
    console.log('[Updater] auto-updates disabled in dev (set ENABLE_UPDATER_IN_DEV=1 to enable)');
  }
};

const startCenterWebServer = async () => {
  const expressApp = express();
  const server = http.createServer(expressApp);
  const io = new Server(server, {
    cors: { origin: '*', methods: ['GET', 'POST'] },
    transports: ['websocket', 'polling'],
  });

  centerWebNamespace = io.of('/center-web');
  centerWebNamespace.use((socket, next) => {
    const token = String(socket.handshake?.auth?.token || socket.handshake?.query?.token || '').trim();
    const sessionInfo = getCenterWebSession(token);
    if (!sessionInfo) return next(new Error('UNAUTHORIZED'));
    socket.data.centerSession = sessionInfo;
    return next();
  });

  expressApp.use(cors());
  expressApp.use(express.json({ limit: '10mb' }));

  expressApp.get('/health', (req, res) => {
    res.json({ success: true, mode: 'center-web', mongoReady: mongoose.connection.readyState === 1 });
  });

  expressApp.post('/api/center/invoke', async (req, res) => {
    const channel = String(req.body?.channel || '').trim();
    const args = Array.isArray(req.body?.args) ? req.body.args : [];

    if (!channel) {
      return res.status(400).json({ success: false, message: 'Thieu channel invoke center.' });
    }

    try {
      let centerSession = null;
      if (channel !== 'login-request' && channel !== 'verify-otp') {
        const sessionToken = resolveCenterWebSessionTokenFromRequest(req);
        centerSession = getCenterWebSession(sessionToken);
        if (!centerSession) {
          return res.status(401).json({
            success: false,
            code: 'UNAUTHORIZED',
            message: 'Phien dang nhap Center khong hop le hoac da het han.',
          });
        }
      }

      const result = await invokeRegisteredIpcHandler(channel, args, {
        event: { sender: null, centerSession },
      });
      const normalizedResult = normalizePayload(result);

      if (channel === 'verify-otp' && normalizedResult && normalizedResult.success) {
        const issued = issueCenterWebSession({
          username: 'admincenter',
          role: normalizedResult.role || 'superadmin',
        });
        return res.json({
          ...normalizedResult,
          sessionToken: issued.token,
          sessionExpiresAt: issued.expiresAt,
        });
      }

      return res.json(normalizedResult);
    } catch (error) {
      console.error(`[HTTP IPC Error] ${channel}:`, error);
      return res.status(500).json({
        success: false,
        message: error?.message || 'Loi xu ly invoke center.',
      });
    }
  });

  if (CENTER_SERVE_STATIC) {
    const distDir = CENTER_WEB_ONLY ? path.join(__dirname, '..', String(process.env.CENTER_WEB_DIST_DIR || 'dist-center').trim() || 'dist-center') : path.join(__dirname, '../dist');
    const indexFile = path.join(distDir, 'index.html');

    if (fs.existsSync(indexFile)) {
      expressApp.use(express.static(distDir));
      expressApp.get(/^(?!\/api(?:\/|$)|\/socket\.io(?:\/|$)|\/center-web(?:\/|$)).*/i, (req, res) => {
        res.sendFile(indexFile, (error) => {
          if (error && !res.headersSent) {
            res.status(500).send('Internal Server Error');
          }
        });
      });
    } else {
      console.warn(`[Center] static UI disabled because dist/index.html was not found at ${distDir}`);
    }
  }

  server.on('error', (error) => {
    console.error('[Center] Web server error:', error);
    dialog.showErrorBox('Loi Center Web', `Khong the mo cong ${CENTER_PORT}. ${error?.message || ''}`.trim());
  });

  centerWebHttpServer = server.listen(CENTER_PORT, CENTER_HOST, () => {
    console.log(`[Center] Web API and socket are running on http://${CENTER_HOST}:${CENTER_PORT}`);
    if (CENTER_SERVE_STATIC) {
      console.log(`[Center] Web UI is running on http://${CENTER_HOST}:${CENTER_PORT}`);
    }
  });
};

app.whenReady().then(async () => {
  await connectDB();
  startActivationApiServer();
  startSystemStatsLoop();

  if (CENTER_WEB_ONLY) {
    await startCenterWebServer();
  } else {
    createWindow();
  }

  await startUpdater();
}).catch((error) => {
  console.error('[Center] FATAL startup error:', error);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin' || CENTER_WEB_ONLY) app.quit();
});

app.on('before-quit', () => {
  if (systemStatsInterval) clearInterval(systemStatsInterval);
  try {
    if (centerWebHttpServer && typeof centerWebHttpServer.close === 'function') {
      centerWebHttpServer.close();
    }
  } catch (_) {}
  try {
    if (activationApiServer && typeof activationApiServer.close === 'function') {
      activationApiServer.close();
    }
  } catch (_) {}
});

if (!CENTER_WEB_ONLY) {
  app.on('activate', () => {
    try {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    } catch (_) {}
  });
}

