const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const fs = require('fs');
const os = require('os');
const { execSync } = require('child_process');
const path = require('path');
const mongoose = require('mongoose');
const crypto = require('crypto');
const { autoUpdater } = require('electron-updater');
const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const cors = require('cors');
const FormData = require('form-data');
const cron = require('node-cron');
const GameSession = require('../src/game/GameSession.js');

require('../src/init-env.js');
require('dotenv').config({ path: path.join(__dirname, '../.env.apibank') });

// --- LOAD PORTS FROM ENV ---
const TAIXIU_WEB_PORT = process.env.TAIXIU_WEB_PORT || 4003;
const GAME_SERVER_PORT = process.env.GAME_SERVER_PORT || 4002;
const DASHBOARD_PORT = process.env.DASHBOARD_PORT || 5173;

// --- TAIXIUCAO & TAIXIUNAN WEBAPP CHILD PROCESS ---
let taixiuCaoWebProcess = null;
let taixiuNanWebProcess = null;
let taixiuCaoWebLogs = [];
let taixiuNanWebLogs = [];
const MAX_WEB_LOGS = 200;

// Helper: Kill process tree on Windows to avoid "Terminate batch job?" prompt
function safeKill(child) {
  if (!child) return;
  if (process.platform === 'win32') {
    try {
      execSync(`taskkill /pid ${child.pid} /T /F`);
    } catch (e) {
      try { child.kill(); } catch(ex) {}
    }
  } else {
    child.kill();
  }
}

function startTaixiuCaoWebProcess() {
  if (taixiuCaoWebProcess) {
    console.log('[TaixiuCaoWeb] Đã chạy');
    return;
  }
  const cwd = path.join(__dirname, '../web-taixiucao');
  const { spawn } = require('child_process');
  const env = { ...process.env };
  delete env.NODE_OPTIONS; // Xóa giới hạn RAM thừa kế để process con chạy nhẹ hơn
  env.NODE_OPTIONS = '--max-old-space-size=512';
  const child = spawn(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'dev'], { cwd, shell: false, env });
  taixiuCaoWebProcess = child;
  child.stdout.on('data', (chunk) => {
    const text = String(chunk).trim();
    taixiuCaoWebLogs.push({ type: 'info', message: text, time: new Date() });
    if (taixiuCaoWebLogs.length > MAX_WEB_LOGS) taixiuCaoWebLogs.shift();
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('taixiucao-web-log', { message: text, level: 'info', time: new Date() });
  });
  child.stderr.on('data', (chunk) => {
    const text = String(chunk).trim();
    taixiuCaoWebLogs.push({ type: 'error', message: text, time: new Date() });
    if (taixiuCaoWebLogs.length > MAX_WEB_LOGS) taixiuCaoWebLogs.shift();
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('taixiucao-web-log', { message: text, level: 'error', time: new Date() });
  });
  child.on('exit', (code, signal) => {
    taixiuCaoWebProcess = null;
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('taixiucao-web-exit', { code, signal });
  });
}

function stopTaixiuCaoWebProcess() {
  if (taixiuCaoWebProcess) {
    safeKill(taixiuCaoWebProcess);
    taixiuCaoWebProcess = null;
  }
}

function startTaixiuNanWebProcess() {
  if (taixiuNanWebProcess) {
    console.log('[TaixiuNanWeb] Đã chạy');
    return;
  }
  const cwd = path.join(__dirname, '../web-taixiunan');
  const { spawn } = require('child_process');
  const env = { ...process.env };
  delete env.NODE_OPTIONS; // Xóa giới hạn RAM thừa kế
  env.NODE_OPTIONS = '--max-old-space-size=512';
  const child = spawn(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'dev'], { cwd, shell: false, env });
  taixiuNanWebProcess = child;
  child.stdout.on('data', (chunk) => {
    const text = String(chunk).trim();
    taixiuNanWebLogs.push({ type: 'info', message: text, time: new Date() });
    if (taixiuNanWebLogs.length > MAX_WEB_LOGS) taixiuNanWebLogs.shift();
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('taixiunan-web-log', { message: text, level: 'info', time: new Date() });
  });
  child.stderr.on('data', (chunk) => {
    const text = String(chunk).trim();
    taixiuNanWebLogs.push({ type: 'error', message: text, time: new Date() });
    if (taixiuNanWebLogs.length > MAX_WEB_LOGS) taixiuNanWebLogs.shift();
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('taixiunan-web-log', { message: text, level: 'error', time: new Date() });
  });
  child.on('exit', (code, signal) => {
    taixiuNanWebProcess = null;
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('taixiunan-web-exit', { code, signal });
  });
}

function stopTaixiuNanWebProcess() {
  if (taixiuNanWebProcess) {
    safeKill(taixiuNanWebProcess);
    taixiuNanWebProcess = null;
  }
}

// --- EXTRA GAME WEBS (PORTS 1111-1115) ---
const EXTRA_GAMES_CONFIG = [
  { id: 'taixiucao', port: parseInt(process.env.PORT_TAIXIUCAO || 1111), folder: '../web-taixiucao', title: 'Tài Xỉu Cao' },
  { id: 'taixiunan', port: parseInt(process.env.PORT_TAIXIUNAN || 2222), folder: '../web-taixiunan', title: 'Tài Xỉu Nan' },
];
let extraGameWebProcesses = {};
let extraGameLogs = {};
const MAX_EXTRA_GAME_LOGS = 50;
let gameSessions = {}; // Lưu trữ các phiên game để API truy cập
let isGameEngineRunning = false;

function startGameEngine() {
  if (isGameEngineRunning) return;
  console.log('🎲 [Dashboard] Starting Game Engine...');
  
  if (!gameSessions['taixiucao']) gameSessions['taixiucao'] = new GameSession(io, 'taixiucao');
  try { gameSessions['taixiucao'].init(); } catch(e) { console.error(e); }

  if (!gameSessions['taixiunan']) gameSessions['taixiunan'] = new GameSession(io, 'taixiunan');
  try { gameSessions['taixiunan'].init(); } catch(e) { console.error(e); }
  
  isGameEngineRunning = true;
}

function stopGameEngine() {
  if (!isGameEngineRunning) return;
  console.log('🛑 [Dashboard] Stopping Game Engine...');
  // Lưu ý: GameSession cần có hàm stop() để dừng timer. 
  // Nếu không có, việc set flag này chỉ mang tính chất đánh dấu trạng thái UI.
  Object.values(gameSessions).forEach(session => {
      if (session && typeof session.stop === 'function') session.stop();
  });
  isGameEngineRunning = false;
}

function scaffoldGameProject(game, jsxPath) {
  const gameDir = path.join(__dirname, game.folder);
  
  try {
    if (!fs.existsSync(gameDir)) fs.mkdirSync(gameDir, { recursive: true });
    const srcDir = path.join(gameDir, 'src');
    if (!fs.existsSync(srcDir)) fs.mkdirSync(srcDir, { recursive: true });

    // 1. package.json
    const packageJson = {
      name: game.id,
      private: true,
      version: "0.0.0",
      type: "module",
      scripts: {
        "dev": "vite",
        "build": "vite build",
        "preview": "vite preview"
      },
      dependencies: {
        "react": "^18.2.0",
        "react-dom": "^18.2.0"
      },
      devDependencies: {
        "@types/react": "^18.2.66",
        "@types/react-dom": "^18.2.22",
        "@vitejs/plugin-react": "^4.2.1",
        "vite": "^5.2.0"
      }
    };
    fs.writeFileSync(path.join(gameDir, 'package.json'), JSON.stringify(packageJson, null, 2));

    // 2. vite.config.js
    const viteConfig = `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: ${game.port}
  }
})`;
    fs.writeFileSync(path.join(gameDir, 'vite.config.js'), viteConfig);

    // 3. index.html
    const indexHtml = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${game.title || game.id.toUpperCase()}</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>`;
    fs.writeFileSync(path.join(gameDir, 'index.html'), indexHtml);

    // 4. src/main.jsx
    const mainJsx = `import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)`;
    fs.writeFileSync(path.join(srcDir, 'main.jsx'), mainJsx);

    // 5. src/index.css
    fs.writeFileSync(path.join(srcDir, 'index.css'), "body { margin: 0; font-family: sans-serif; }");

    // 6. Copy App.jsx từ file gốc vào src/App.jsx
    const appJsxContent = fs.readFileSync(jsxPath, 'utf-8');
    fs.writeFileSync(path.join(srcDir, 'App.jsx'), appJsxContent);

    return true;
  } catch (e) {
    console.error(`[Scaffold] Failed to scaffold ${game.id}:`, e);
    return false;
  }
}

function startSingleExtraGame(game) {
  if (extraGameWebProcesses[game.id]) return;
  const cwd = path.join(__dirname, game.folder);
  
  // Hàm helper để gửi log về frontend
  const sendLog = (type, message) => {
    if (!extraGameLogs[game.id]) extraGameLogs[game.id] = [];
    const logEntry = { type, message, time: new Date() };
    extraGameLogs[game.id].push(logEntry);
    if (extraGameLogs[game.id].length > MAX_EXTRA_GAME_LOGS) extraGameLogs[game.id].shift();
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('extra-game-log', { id: game.id, log: logEntry });
    }
  };
  
  // Chỉ chạy nếu tìm thấy folder và package.json
  if (fs.existsSync(cwd) && fs.existsSync(path.join(cwd, 'package.json'))) {
    // --- AUTO FIX CSS & TITLE: Tự động cập nhật index.html ---
    try {
      const indexHtmlPath = path.join(cwd, 'index.html');
      if (fs.existsSync(indexHtmlPath)) {
        let htmlContent = fs.readFileSync(indexHtmlPath, 'utf-8');
        let changed = false;

        // 1. Fix CSS
        if (!htmlContent.includes('cdn.tailwindcss.com')) {
          console.log(`[Dashboard] 🛠️ Đang tự động thêm CSS cho game ${game.id}...`);
          htmlContent = htmlContent.replace('</head>', '    <script src="https://cdn.tailwindcss.com"></script>\n    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css" />\n  </head>');
          changed = true;
        }

        // 2. Fix Title
        if (game.title) {
          const titleRegex = /<title>(.*?)<\/title>/;
          const match = htmlContent.match(titleRegex);
          if (match && match[1] !== game.title) {
            console.log(`[Dashboard] 🛠️ Cập nhật tiêu đề cho game ${game.id}: ${game.title}`);
            htmlContent = htmlContent.replace(titleRegex, `<title>${game.title}</title>`);
            changed = true;
          }
        }

        if (changed) fs.writeFileSync(indexHtmlPath, htmlContent);
      }
    } catch (e) { console.error(`[Dashboard] Lỗi auto-fix index.html cho ${game.id}:`, e); }
    // ------------------------------------------------------------------

    try {
      const { spawn } = require('child_process');
      console.log(`[Dashboard] Khởi động web ${game.id} trên port ${game.port}...`);
      
      // Kiểm tra node_modules
      if (!fs.existsSync(path.join(cwd, 'node_modules'))) {
        sendLog('error', `CẢNH BÁO: Chưa tìm thấy thư mục node_modules. Vui lòng chạy 'npm install' trong thư mục ${game.folder}`);
      }

      const env = { ...process.env, PORT: String(game.port) };
      delete env.NODE_OPTIONS; // Xóa giới hạn RAM thừa kế
      env.NODE_OPTIONS = '--max-old-space-size=512';

      // Chạy npm run dev và truyền tham số port vào vite
      const child = spawn(/^win/.test(process.platform) ? 'npm.cmd' : 'npm', ['run', 'dev', '--', '--port', String(game.port)], { 
        cwd, 
        shell: false,
        env
      });
      
      extraGameWebProcesses[game.id] = child;
      
      child.stdout.on('data', (chunk) => {
        const text = String(chunk).trim(); 
        if (text) sendLog('info', text);
      });

      child.stderr.on('data', (chunk) => {
        const text = String(chunk).trim();
        if (text) sendLog('error', text);
      });
      
      child.on('exit', () => {
        console.log(`[Dashboard] Web ${game.id} đã tắt.`);
        extraGameWebProcesses[game.id] = null;
        if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('extra-game-status', { id: game.id, running: false });
      });

      if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('extra-game-status', { id: game.id, running: true });

    } catch (e) {
      console.error(`[Dashboard] Lỗi khởi động web ${game.id}:`, e);
      sendLog('error', `Lỗi khởi động: ${e.message}`);
    }
  } else {
    // Kiểm tra xem có file .jsx lẻ loi không để gợi ý
    const jsxPath = path.join(__dirname, '../game', `${game.id}.jsx`);
    let msg = '';
    if (fs.existsSync(jsxPath)) {
        // Tự động tạo dự án
        if (scaffoldGameProject(game, jsxPath)) {
            msg = `✅ Đã tự động tạo dự án cho ${game.id} từ file jsx. Vui lòng mở terminal tại thư mục '${game.folder}' và chạy lệnh 'npm install' để cài đặt thư viện, sau đó khởi động lại Dashboard.`;
        } else {
            msg = `⚠️ Tìm thấy file '${game.id}.jsx' nhưng không thể tạo dự án tự động. Vui lòng kiểm tra quyền ghi file.`;
        }
    } else {
        msg = `❌ Không tìm thấy thư mục dự án hoặc file package.json tại: ${game.folder}.`;
    }
    
    console.warn(`[Dashboard] ${msg}`);
    sendLog('error', msg);
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('extra-game-status', { id: game.id, running: false });
  }
}

function startExtraGameWebs() {
  EXTRA_GAMES_CONFIG.forEach(game => startSingleExtraGame(game));
}

function stopExtraGameWebs() {
  Object.values(extraGameWebProcesses).forEach(proc => {
    if (proc) {
      try { safeKill(proc); } catch(e){}
    }
  });
  extraGameWebProcesses = {};
}

ipcMain.handle('get-extra-games-status', () => {
  return EXTRA_GAMES_CONFIG.map(game => ({
    id: game.id,
    port: game.port,
    title: game.title,
    running: !!extraGameWebProcesses[game.id]
  }));
});

ipcMain.handle('toggle-extra-game', (event, gameId) => {
  const game = EXTRA_GAMES_CONFIG.find(g => g.id === gameId);
  if (!game) return { success: false, message: 'Game not found' };

  if (extraGameWebProcesses[gameId]) {
    try {
      safeKill(extraGameWebProcesses[gameId]);
      extraGameWebProcesses[gameId] = null;
      if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('extra-game-status', { id: gameId, running: false });
    } catch (e) { return { success: false, message: e.message }; }
  } else {
    startSingleExtraGame(game);
  }
  return { success: true, running: !!extraGameWebProcesses[gameId] };
});

ipcMain.handle('get-extra-game-logs', (event, gameId) => {
  return { success: true, logs: extraGameLogs[gameId] || [] };
});

// --- IPC HANDLERS FOR TAIXIUCAO/NAN WEB ---
ipcMain.handle('start-taixiucao-web', async () => { try { startTaixiuCaoWebProcess(); return { success: true }; } catch (e) { return { success: false, message: e.message }; } });
ipcMain.handle('stop-taixiucao-web', async () => { try { stopTaixiuCaoWebProcess(); return { success: true }; } catch (e) { return { success: false, message: e.message }; } });
ipcMain.handle('get-taixiucao-web-status', async () => { return { success: true, running: !!taixiuCaoWebProcess }; });
ipcMain.handle('get-taixiucao-web-log', async () => { return { success: true, logs: taixiuCaoWebLogs }; });

ipcMain.handle('start-taixiunan-web', async () => { try { startTaixiuNanWebProcess(); return { success: true }; } catch (e) { return { success: false, message: e.message }; } });
ipcMain.handle('stop-taixiunan-web', async () => { try { stopTaixiuNanWebProcess(); return { success: true }; } catch (e) { return { success: false, message: e.message }; } });
ipcMain.handle('get-taixiunan-web-status', async () => { return { success: true, running: !!taixiuNanWebProcess }; });
ipcMain.handle('get-taixiunan-web-log', async () => { return { success: true, logs: taixiuNanWebLogs }; });

// --- IPC HANDLERS FOR INTERNAL GAME ENGINE ---
ipcMain.handle('get-game-engine-status', () => ({ success: true, running: isGameEngineRunning }));
ipcMain.handle('start-game-engine', () => { startGameEngine(); return { success: true }; });
ipcMain.handle('stop-game-engine', () => { stopGameEngine(); return { success: true }; });

// Cho phép phát âm thanh thông báo tự động mà không cần tương tác người dùng
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

const User = require('../src/models/User.js');
const Setting = require('../src/models/Setting.js');
const Account = require('../src/models/Account.js');
const Transaction = require('../src/models/Transaction.js');
const Deposit = require('../src/models/Deposit.js');
const Withdraw = require('../src/models/Withdraw.js');
const License = require('../src/models/License.js');
const Blacklist = require('../src/models/Blacklist.js');
const BankAuto = require('../src/models/BankAuto.js');
const EWallet = require('../src/models/EWallet.js');
const Notification = require('../src/models/Notification.js');
const SupportMessage = require('../src/models/SupportMessage.js');
const GiftCode = require('../src/models/GiftCode.js');
const Bot = require('../src/models/Bot.js');
const CheckinHistory = require('../src/models/CheckinHistory.js');
const Mission = require('../src/models/Mission.js');
const LuckyWheelReward = require('../src/models/LuckyWheelReward.js');
const TopRacingConfig = require('../src/models/TopRacingConfig.js');
const TxRoomSetting = require('../src/models/TxRoomSetting.js');
const Md5Setting = require('../src/models/Md5Setting.js');
const KhongMinhSetting = require('../src/models/KhongMinhSetting.js');
const CommissionSetting = require('../src/models/CommissionSetting.js');
const TxGameHistory = require('../src/models/TxGameHistory.js');
const Md5History = require('../src/models/Md5History.js');
const KhongMinhHistory = require('../src/models/KhongMinhHistory.js');
const createSupportRouter = require('../src/api/support.router.js');
const BankHistory = require('../src/models/BankHistory.js');
const { startOrUpdateBot, setIo } = require('../src/components/bot-service.js'); // This was already correct
const { startBankCron } = require('../src/components/bank-cron-service.js'); // Import Service Bank mới
const mainBotService = require('../src/components/main-bot-service.js');
const { startMainBot } = mainBotService;
const { startCskhBot, sendCskhReply, checkCskhConnection } = require('../src/components/cskh-bot-service.js');

const isDev = !app.isPackaged;

// Chỉ định thư mục cache riêng để tránh lỗi "Access Denied" khi chạy dev
if (isDev) {
  app.setPath('userData', path.join(app.getPath('appData'), `../Local/${app.getName()}-dashboard-dev`));
}

let mainWindow;
let gameAdminServerProcess = null;
let taixiuWebServerProcess = null;
let taixiuWebServerLogs = [];
const MAX_TAIXIU_WEB_LOGS = 200;
// --- TAIXIU WEB SERVER CHILD PROCESS ---
function startTaixiuWebServerProcess() {
  if (taixiuWebServerProcess) {
    console.log('[TaixiuWebLauncher] Taixiu web server already running');
    return;
  }
  const serverPath = path.join(__dirname, '../game/taixiu/server.js');
  try {
    const { fork } = require('child_process');
    const env = { ...process.env, PORT: String(TAIXIU_WEB_PORT) };
    delete env.NODE_OPTIONS; // Xóa giới hạn RAM thừa kế
    env.NODE_OPTIONS = '--max-old-space-size=512';
    // Set PORT=4003 for taixiu web server
    const child = fork(serverPath, { cwd: path.dirname(serverPath), env, silent: true });
    taixiuWebServerProcess = child;
    console.log('[TaixiuWebLauncher] Launched taixiu web server:', serverPath);
    if (child.stdout) {
      child.stdout.on('data', (chunk) => {
        const text = String(chunk).trim();
        taixiuWebServerLogs.push({ type: 'info', message: text, time: new Date() });
        if (taixiuWebServerLogs.length > MAX_TAIXIU_WEB_LOGS) taixiuWebServerLogs.shift();
        if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('taixiu-web-log', { message: text, level: 'info', time: new Date() });
      });
    }
    if (child.stderr) {
      child.stderr.on('data', (chunk) => {
        const text = String(chunk).trim();
        taixiuWebServerLogs.push({ type: 'error', message: text, time: new Date() });
        if (taixiuWebServerLogs.length > MAX_TAIXIU_WEB_LOGS) taixiuWebServerLogs.shift();
        if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('taixiu-web-log', { message: text, level: 'error', time: new Date() });
      });
    }
    child.on('exit', (code, signal) => {
      console.log(`[TaixiuWebLauncher] Taixiu web server exited (code=${code}, signal=${signal})`);
      taixiuWebServerProcess = null;
      if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('taixiu-web-exit', { code, signal });
      // Auto-restart in dev only
      if (isDev) setTimeout(() => startTaixiuWebServerProcess(), 2000);
    });
    child.on('error', (err) => {
      console.error('[TaixiuWebLauncher] Error launching taixiu web server:', err);
    });
    setTimeout(() => {
      if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('taixiu-web-started', { pid: child.pid });
    }, 500);
  } catch (e) {
    console.error('[TaixiuWebLauncher] Failed to start taixiu web server:', e);
  }
}

function stopTaixiuWebServerProcess() {
  if (taixiuWebServerProcess) {
    try { taixiuWebServerProcess.send({ type: 'shutdown' }); } catch(e){}
    const pid = taixiuWebServerProcess.pid;
    setTimeout(() => {
      try { if(taixiuWebServerProcess) safeKill(taixiuWebServerProcess); } catch(e){}
      taixiuWebServerProcess = null;
    }, 1200);
  }
}
// --- IPC HANDLERS FOR TAIXIU WEB SERVER ---
ipcMain.handle('start-taixiu-web', async () => {
  try {
    startTaixiuWebServerProcess();
    return { success: true };
  } catch (e) {
    console.error('[IPC] start-taixiu-web failed', e);
    return { success: false, message: e.message };
  }
});

ipcMain.handle('stop-taixiu-web', async () => {
  try {
    stopTaixiuWebServerProcess();
    return { success: true };
  } catch (e) {
    console.error('[IPC] stop-taixiu-web failed', e);
    return { success: false, message: e.message };
  }
});

ipcMain.handle('get-taixiu-web-status', async () => {
  try {
    return { success: true, running: !!taixiuWebServerProcess, pid: taixiuWebServerProcess ? taixiuWebServerProcess.pid : null };
  } catch (e) { return { success: false, message: e.message }; }
});

ipcMain.handle('get-taixiu-web-log', async () => {
  try {
    return { success: true, logs: taixiuWebServerLogs };
  } catch (e) { return { success: false, message: e.message }; }
});
const appLogs = [];
const MAX_LOGS = 200;

// Start the taixiu game server as a child process and forward logs/events
function startGameAdminServer() {
  if (gameAdminServerProcess) {
    console.log('[GameAdminLauncher] Game admin server already running');
    return;
  }

  const serverPath = path.join(__dirname, '../game/taixiu/server.js');
  try {
    const { fork } = require('child_process');
    const env = { ...process.env, PORT: String(GAME_SERVER_PORT) };
    delete env.NODE_OPTIONS; // Xóa giới hạn RAM thừa kế
    env.NODE_OPTIONS = '--max-old-space-size=512';
    // Set PORT=4002 for game server
    const child = fork(serverPath, { cwd: path.dirname(serverPath), env, silent: true });
    gameAdminServerProcess = child;

    console.log('[GameAdminLauncher] Launched game admin server:', serverPath);

    if (child.stdout) {
      child.stdout.on('data', (chunk) => {
        const text = String(chunk).trim();
        console.log('[GameAdminServer]', text);
        try { if (io && io.emit) io.emit('game-server-log', { message: text, level: 'info', time: new Date() }); } catch(e){}
      });
    }
    if (child.stderr) {
      child.stderr.on('data', (chunk) => {
        const text = String(chunk).trim();
        console.error('[GameAdminServer][ERR]', text);
        try { if (io && io.emit) io.emit('game-server-log', { message: text, level: 'error', time: new Date() }); } catch(e){}
      });
    }

    child.on('message', (msg) => {
      console.log('[GameAdminServer][MSG]', msg);
      try { if (io && io.emit) io.emit('game-server-message', msg); } catch(e){}
    });

    child.on('exit', (code, signal) => {
      console.log(`[GameAdminLauncher] Game admin server exited (code=${code}, signal=${signal})`);
      gameAdminServerProcess = null;
      try { if (io && io.emit) io.emit('game-server-exit', { code, signal }); } catch(e){}
      // Auto-restart in dev only
      if (isDev) {
        setTimeout(() => startGameAdminServer(), 2000);
      }
    });

    child.on('error', (err) => {
      console.error('[GameAdminLauncher] Error launching game admin server:', err);
    });

    // send ready ping after short delay
    setTimeout(() => {
      try { if (io && io.emit) io.emit('game-server-started', { pid: child.pid }); } catch(e){}
    }, 500);

  } catch (e) {
    console.error('[GameAdminLauncher] Failed to start game admin server:', e);
  }
}

// Khởi động Cron Bank Service
startBankCron(mainBotService);

// --- AUTO CANCEL EXPIRED DEPOSITS (Mỗi phút) ---
cron.schedule('* * * * *', async () => {
  try {
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    const expiredDeposits = await Deposit.find({
      status: 0, // Chờ duyệt
      date: { $lt: tenMinutesAgo } // Tạo ra hơn 10 phút trước
    });

    if (expiredDeposits.length > 0) {
      console.log(`[AutoCancel] Tìm thấy ${expiredDeposits.length} đơn nạp hết hạn. Đang hủy...`);
      for (const deposit of expiredDeposits) {
        deposit.status = 2; // Hủy
        await deposit.save();
        console.log(`[AutoCancel] -> Đã hủy đơn ${deposit.requestId} của User ${deposit.userId}.`);
      }
    }
  } catch (e) {
    console.error('[AutoCancel] Cron Error:', e);
  }
});

// --- API & WebSocket Server Setup ---
const expressApp = express();
const server = http.createServer(expressApp);
const io = new Server(server, {
  cors: {
    origin: `http://localhost:${DASHBOARD_PORT}`, // Chỉ cho phép dashboard
    methods: ["GET", "POST"],
    credentials: true
  }
});

expressApp.use(cors());
expressApp.use(express.json({ limit: '10mb' })); // Tăng giới hạn để gửi ảnh base64
// Provide sendCskhReply and checkCskhConnection to the support router
expressApp.use('/api/support', createSupportRouter(io, sendCskhReply, checkCskhConnection));

// --- API CHO GAME CLIENT (Tài Xỉu Cào/Nặn) ---
expressApp.post('/api/login', (req, res) => {
    // Mock login cho game client (hoặc implement logic check token thật)
    res.json({ success: true, user: { userId: 123456, balance: 10000000, username: 'Player' } });
});

expressApp.get('/api/game/status', (req, res) => {
    const game = req.query.game;
    const session = gameSessions[game];
    if (session) {
        res.json({
            timeLeft: session.timeLeft,
            phase: session.phase,
            sessionId: session.sessionId,
            dice: session.dice,
            jackpot: session.jackpot,
            jackpotResult: session.jackpotResult
        });
    } else {
        res.status(404).json({ error: 'Game not found' });
    }
});

expressApp.post('/api/game/bet', (req, res) => {
    const { game, type, amount, id } = req.body;
    const session = gameSessions[game];
    
    if (session) {
        const success = session.handleBet(type, amount);
        if (success) {
             // Trong thực tế cần trừ tiền DB ở đây. Tạm thời trả về success để client chạy hiệu ứng.
             res.json({ success: true, newBalance: undefined }); 
        } else {
             res.json({ success: false, error: 'Không thể đặt cược lúc này' });
        }
    } else {
        res.status(404).json({ error: 'Game not found' });
    }
});
// ---------------------------------------------

io.on('connection', (socket) => {
    console.log('✅ [CSKH App] Một admin đã kết nối qua Socket.IO:', socket.id);
    socket.on('disconnect', () => {
        console.log('❌ [CSKH App] Admin đã ngắt kết nối:', socket.id);
    });
});
// Provide io to bot manager so workers/logs can be forwarded to admin UI
try { setIo(io); } catch (e) { console.warn('[Dashboard] setIo failed:', e && e.message ? e.message : e); }
// --- End Server Setup ---

// Helper để lấy Model theo loại game
const getGameModel = (type) => {
  switch (type) {
    case 'tx': return TxRoomSetting;
    case 'md5': return Md5Setting;
    case 'taixiucao': return TxRoomSetting;
    case 'taixiunan': return TxRoomSetting;
    case 'khongminh': return KhongMinhSetting;
    default: return TxRoomSetting;
  }
};

// --- HELPERS ---
const getMachineId = () => {
  const rawId = `${os.hostname()}-${os.arch()}-${os.platform()}-${os.totalmem()}`;
  return crypto.createHash('sha256').update(rawId).digest('hex');
};

const originalConsoleLog = console.log;
const originalConsoleError = console.error;

function pushLog(type, message) {
  const logEntry = { time: new Date().toLocaleTimeString(), type, message };
  appLogs.push(logEntry);
  if (appLogs.length > MAX_LOGS) appLogs.shift();

  // Prevent infinite loop: Do not send logs about the frame being disposed to the frame itself
  if (typeof message === 'string' && (message.includes('Render frame was disposed') || message.includes('Object has been destroyed'))) {
    return;
  }

  if (mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents && !mainWindow.webContents.isDestroyed()) {
    try {
      mainWindow.webContents.send('new-log', logEntry);
    } catch (e) {
      // Bỏ qua lỗi khi gửi log xuống renderer để tránh vòng lặp vô hạn với console.error
    }
  }
}

console.log = (...args) => {
  originalConsoleLog(...args);
  const msg = args.map(a => {
    if (typeof a === 'object') {
      try { return JSON.stringify(a); } catch (e) { return '[Circular/Object]'; }
    }
    return String(a);
  }).join(' ');
  pushLog('INFO', msg);
};

console.error = (...args) => {
  originalConsoleError(...args);
  const msg = args.map(a => {
    if (typeof a === 'object') {
      try { return JSON.stringify(a); } catch (e) { return '[Circular/Object]'; }
    }
    return String(a);
  }).join(' ');
  pushLog('ERROR', msg);
};

const sanitizeIPC = (obj) => {
  if (obj === null || typeof obj !== 'object') return obj;
  if (obj._bsontype === 'ObjectID' || (obj.constructor && obj.constructor.name === 'ObjectId')) return obj.toString();
  if (obj instanceof Date) return obj;
  
  // Chuyển đổi Mongoose Document sang object thuần túy
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

// --- IPC HANDLERS (Dashboard Specific) ---
ipcHandle('login-request', async (e, { username, password }) => {
  try {
    console.log(`[Login] Yêu cầu đăng nhập: ${username}`);
    const cleanUsername = String(username || '').trim();
    
    const user = await User.findOne({ username: cleanUsername }); 
    if (user) {
      const isMatch = await user.comparePassword(password);
      if (isMatch) {
        console.log(`[Login] Đăng nhập thành công: ${cleanUsername}`);
        // Trả về object thuần túy để tránh lỗi serialization của Electron
        return { 
          success: true, 
          role: user.role || 'admin', 
          needPasswordChange: !!user.isFirstLogin 
        };
      }
    }
    console.warn(`[Login] Đăng nhập thất bại: ${cleanUsername}`);
    return { success: false, message: 'Sai tên đăng nhập hoặc mật khẩu!' };
  } catch (err) {
    console.error(`❌ [Login Error]:`, err);
    return { success: false, message: 'Lỗi hệ thống khi đăng nhập.' };
  }
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
  if (user?.username === 'admin') return { success: false, message: 'Không thể xóa tài khoản admin gốc.' };
  await User.findByIdAndDelete(id);
  return { success: true };
});

ipcHandle('get-users', async () => ({ success: true, data: await Account.find({}).sort({ date: -1 }) }));
ipcHandle('update-user', async (event, { id, data }) => {
  const { _id, __v, ...updateData } = data;
  
  // Lọc bỏ các giá trị NaN để tránh lỗi CastError của Mongoose
  Object.keys(updateData).forEach(key => {
    if (typeof updateData[key] === 'number' && isNaN(updateData[key])) {
      delete updateData[key];
    }
  });

  await Account.findByIdAndUpdate(id, updateData);
  return { success: true };
});

ipcHandle('delete-user', async (event, id) => {
  await Account.findByIdAndDelete(id);
  return { success: true };
});

ipcHandle('ban-user-to-blacklist', async (event, { id, reason }) => {
  const account = await Account.findById(id);
  if (account) {
    account.status = 0; // Khóa tài khoản
    await account.save();
    const exists = await Blacklist.findOne({ value: String(account.userId) });
    if (!exists) {
      await Blacklist.create({ value: String(account.userId), reason: reason || 'Admin banned from UserList' });
    }
  }
  return { success: true };
});

ipcHandle('update-balance', async (e, { userId, amount, action }) => {
  const acc = await Account.findOne({ userId: parseInt(userId) });
  if (!acc) return { success: false };
  const old = acc.balance;
  acc.balance = action === 'add' ? acc.balance + parseInt(amount) : acc.balance - parseInt(amount);
  await acc.save();
  await Transaction.create({ userId, amount, action, oldBalance: old, newBalance: acc.balance, description: 'Admin điều chỉnh' });
  return { success: true, newBalance: acc.balance };
});

ipcHandle('get-balance-logs', async () => ({ success: true, data: await Transaction.find({}).sort({ date: -1 }).limit(50).lean() }));

ipcHandle('get-banned-users', async () => ({ success: true, data: await Account.find({ status: 0 }).sort({ date: -1 }).lean() }));

ipcHandle('unlock-user', async (event, userId) => { await Account.findOneAndUpdate({ userId: parseInt(userId) }, { status: 1 }); return { success: true }; });

ipcHandle('get-blacklist', async () => ({ success: true, data: await Blacklist.find({}).sort({ date: -1 }).lean() }));
ipcHandle('add-blacklist', async (event, { value, reason }) => { await Blacklist.create({ value, reason }); return { success: true }; });
ipcHandle('delete-blacklist', async (event, id) => { await Blacklist.findByIdAndDelete(id); return { success: true }; });

ipcHandle('get-settings', async () => ({ success: true, data: await Setting.findOne({}).lean() }));
ipcHandle('save-settings', async (e, data) => {
  const { _id, __v, ...update } = data;
  await Setting.findOneAndUpdate({}, update, { upsert: true });
  return { success: true };
});

// Bank & Wallet
ipcHandle('get-bank-auto', async () => ({ success: true, data: await BankAuto.find({}).lean() }));
ipcHandle('add-bank-auto', async (event, data) => { await BankAuto.create(data); return { success: true }; });
ipcHandle('delete-bank-auto', async (event, id) => { await BankAuto.findByIdAndDelete(id); return { success: true }; });
ipcHandle('update-bank-auto', async (event, { id, data }) => { const { _id, __v, ...updateData } = data; await BankAuto.findByIdAndUpdate(id, updateData); return { success: true }; });
ipcHandle('update-bank-auto-status', async (event, { id, status }) => { await BankAuto.findByIdAndUpdate(id, { status }); return { success: true }; });

ipcHandle('get-ewallet', async () => ({ success: true, data: await EWallet.find({}).lean() }));
ipcHandle('add-ewallet', async (event, data) => { await EWallet.create(data); return { success: true }; });
ipcHandle('delete-ewallet', async (event, id) => { await EWallet.findByIdAndDelete(id); return { success: true }; });
ipcHandle('update-ewallet-status', async (event, { id, status }) => { await EWallet.findByIdAndUpdate(id, { status }); return { success: true }; });

// Notifications & Giftcode
ipcHandle('get-notifications', async () => ({ success: true, data: await Notification.find({}).sort({ date: -1 }).limit(50).lean() }));
ipcHandle('send-notification', async (event, { content, targetType, targetValue }) => {
  try {
    await Notification.create({ content });
    if (mainBotService && typeof mainBotService.sendNotification === 'function') {
      const res = await mainBotService.sendNotification({ content, targetType: targetType || 'all', targetValue: targetValue || null });
      return res;
    }
    return { success: false, message: 'Main bot service không hỗ trợ gửi thông báo.' };
  } catch (e) { return { success: false, message: e.message }; }
});

// Broadcast giftcode via Main Bot
ipcHandle('broadcast-giftcode', async (event, { code, messageTemplate, targetType, targetValue }) => {
  try {
    if (mainBotService && typeof mainBotService.sendGiftcode === 'function') {
      const res = await mainBotService.sendGiftcode({ code, messageTemplate, targetType: targetType || 'all', targetValue: targetValue || null });
      return res;
    }
    return { success: false, message: 'Main bot service không hỗ trợ phát giftcode.' };
  } catch (e) { return { success: false, message: e.message }; }
});

ipcHandle('get-giftcodes', async () => ({ success: true, data: await GiftCode.find({}).sort({ date: -1 }).lean() }));
ipcHandle('create-giftcode', async (event, data) => { await GiftCode.create(data); return { success: true }; });
ipcHandle('delete-giftcode', async (event, id) => { await GiftCode.findByIdAndDelete(id); return { success: true }; });

// Bot Management
ipcHandle('get-bots', async () => ({ success: true, data: await Bot.find({}).lean() }));
ipcHandle('add-bot', async (event, data) => { await Bot.create(data); return { success: true }; });
ipcHandle('delete-bot', async (event, id) => { await Bot.findByIdAndDelete(id); return { success: true }; });
ipcHandle('update-bot-status', async (event, { id, status }) => { 
  const botConfig = await Bot.findByIdAndUpdate(id, { status }, { new: true }).lean();
  if (botConfig.role === 'main') {
    await startMainBot(botConfig);
  }
  return { success: true }; 
});

ipcHandle('get-deposits', async () => ({ success: true, data: await Deposit.find({}).sort({ date: -1 }).limit(100).lean() }));
ipcHandle('get-withdraws', async () => ({ success: true, data: await Withdraw.find({}).sort({ date: -1 }).limit(100).lean() }));
ipcHandle('handle-withdraw', async (e, { id, status }) => {
  const wit = await Withdraw.findById(id);
  if (wit && wit.status === 0 && status === 2) {
    await Account.findOneAndUpdate({ userId: wit.userId }, { $inc: { balance: wit.amount } });
  }
  if (wit) { wit.status = status; await wit.save(); }
  return { success: true };
});

// --- Support Chat IPC Handlers ---
ipcMain.handle('get-support-users', async () => {
    try {
        const users = await SupportMessage.aggregate([
            { $sort: { createdAt: -1 } },
            {
                $group: {
                    _id: "$userId",
                    username: { $first: "$username" },
                    lastMessage: { $first: "$content" },
                    lastMessageImage: { $first: "$imageBase64" },
                    createdAt: { $first: "$createdAt" },
                    unreadCount: { 
                        $sum: { $cond: [{ $and: [{ $eq: ["$direction", "in"] }, { $eq: ["$isRead", false] }] }, 1, 0] }
                    }
                }
            },
            { $sort: { createdAt: -1 } }
        ]);
        const result = users.map(u => ({ ...u, userId: u._id, lastMessage: u.lastMessageImage ? '[Hình ảnh]' : u.lastMessage }));
        return { success: true, data: result };
    } catch (e) {
        return { success: false, message: e.message };
    }
});

ipcMain.handle('get-support-messages', async (event, userId) => {
    try {
        const messages = await SupportMessage.find({ userId }).sort({ createdAt: 1 }).limit(100);
        return { success: true, data: messages };
    } catch (e) { return { success: false, message: e.message }; }
});

ipcMain.handle('send-support-reply', async (event, { userId, text, imageBase64 }) => await sendCskhReply(userId, text, imageBase64));
ipcMain.handle('mark-support-read', async (event, userId) => {
    await SupportMessage.updateMany({ userId, direction: 'in', isRead: false }, { $set: { isRead: true } });
    return { success: true };
});

// Quản lý phòng game (Tài Xỉu) cho Admin
ipcHandle('get-tx-room-settings', async (event, roomType) => {
  const Model = getGameModel(roomType);
  let settings = await Model.findOne({ roomType });
  if (!settings) settings = await Model.create({ roomType });
  return { success: true, data: settings };
});

ipcHandle('save-tx-room-settings', async (event, { roomType, data }) => {
  const Model = getGameModel(roomType);
  const updated = await Model.findOneAndUpdate({ roomType }, data, { upsert: true, new: true }).lean();
  console.log(`[Dashboard] Cập nhật Bot phòng ${roomType}`);
  startOrUpdateBot(updated);
  return { success: true };
});

ipcHandle('get-tx-room-stats', async (event, roomType) => {
  try {
    const history = await TxGameHistory.find({ roomType }).lean();
    const totalProfit = history.reduce((sum, item) => sum + (item.profit || 0), 0);
    const totalGames = history.length;
    const totalFee = history.reduce((sum, item) => sum + (item.fee || 0), 0);
    const totalBet = history.reduce((sum, item) => sum + (item.realTotalBet || 0), 0);

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const todayHistory = await TxGameHistory.find({ roomType, date: { $gte: startOfDay } }).lean();
    const todayProfit = todayHistory.reduce((sum, item) => sum + (item.profit || 0), 0);
    const todayFee = todayHistory.reduce((sum, item) => sum + (item.fee || 0), 0);
    const todayBet = todayHistory.reduce((sum, item) => sum + (item.realTotalBet || 0), 0);

    return { 
      success: true, 
      data: { 
        totalProfit, 
        todayProfit, 
        totalGames, 
        totalBet, 
        totalFee, 
        todayFee, 
        todayBet 
      } 
    };
  } catch (error) {
    console.error(`❌ [Stats Error] Room ${roomType}:`, error);
    return { success: false, message: error.message };
  }
});

ipcHandle('get-tx-room-history', async (event, roomType) => ({ 
  success: true, 
  data: await TxGameHistory.find({ roomType }).sort({ date: -1 }).limit(20).lean() 
}));

ipcHandle('check-bot-token', async (event, token) => {
  try {
    const TelegramBot = require('node-telegram-bot-api');
    const tempBot = new TelegramBot(token);
    const me = await tempBot.getMe();
    return { success: true, data: me };
  } catch (error) {
    return { success: false, message: 'Token không hợp lệ: ' + error.message };
  }
});

ipcHandle('check-main-bot-status', async () => {
  const mainBotConfig = await Bot.findOne({ role: 'main', status: 1 }).lean();
  if (!mainBotConfig) return { success: false, message: 'BOT ĐANG TẮT' };
  
  // Gọi hàm kiểm tra thực tế từ service
  if (mainBotService && typeof mainBotService.checkConnection === 'function') return await mainBotService.checkConnection();
  return { success: true, message: 'ĐANG CHẠY' };
});

// --- QUẢN LÝ DANH SÁCH TRÒ CHƠI ---
ipcHandle('get-available-games', () => {
  return {
    success: true,
    data: [
      { id: 'tx', name: 'Tài Xỉu Thường', icon: '🎲' },
      { id: 'md5', name: 'Tài Xỉu MD5', icon: '🔐' },
      { id: 'khongminh', name: 'Khổng Minh', icon: '📜' },
    ]
  };
});

// Quản lý các trò chơi (Plinko, Booms, Xeng, ...)
ipcHandle('get-game-settings', async (event, gameType) => {
  const Model = getGameModel(gameType);
  let settings = await Model.findOne({ roomType: gameType });
  if (!settings) settings = await Model.create({ roomType: gameType });
  return { success: true, data: settings };
});

ipcHandle('save-game-settings', async (event, { gameType, data }) => {
  const Model = getGameModel(gameType);
  const { _id, __v, ...updateData } = data;
  await Model.findOneAndUpdate({ roomType: gameType }, updateData, { upsert: true });
  return { success: true };
});

ipcHandle('update-game-status', async (event, { gameType, status }) => {
  const Model = getGameModel(gameType);
  const updatedConfig = await Model.findOneAndUpdate({ roomType: gameType }, { status }, { new: true, projection: { gameHistory: { $slice: -20 } } }).lean();
  // Khởi động hoặc dừng bot game tương ứng
  if (updatedConfig) {
    await startOrUpdateBot(updatedConfig);
  }
  return { success: true };
});

ipcHandle('get-game-stats', async (event, gameType) => {
  try {
    const history = await TxGameHistory.find({ roomType: gameType }).lean();
    const totalProfit = history.reduce((sum, item) => sum + (item.profit || 0), 0);
    const totalGames = history.length;
    const totalBet = history.reduce((sum, item) => sum + (item.realTotalBet || 0), 0);

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const todayHistory = await TxGameHistory.find({ roomType: gameType, date: { $gte: startOfDay } }).lean();
    const todayProfit = todayHistory.reduce((sum, item) => sum + (item.profit || 0), 0);
    const todayBet = todayHistory.reduce((sum, item) => sum + (item.realTotalBet || 0), 0);

    return { success: true, data: { totalProfit, todayProfit, totalGames, totalBet, todayBet } };
  } catch (error) {
    return { success: false, message: error.message };
  }
});

ipcHandle('get-game-history', async (event, gameType) => ({ 
  success: true, 
  data: await TxGameHistory.find({ roomType: gameType }).sort({ date: -1 }).limit(50).lean() 
}));

// Đặt kết quả Tài Xỉu (Nan/Cao/MD5/Thường)
ipcHandle('set-tx-result', async (event, { roomType, dice1, dice2, dice3 }) => {
  try {
    const Model = getGameModel(roomType);
    // Cập nhật forceResult vào settings. Game Server cần logic để đọc field này.
    await Model.findOneAndUpdate({ roomType }, { 
      forceResult: { dice1, dice2, dice3, updatedAt: new Date() } 
    }, { upsert: true });
    return { success: true };
  } catch (e) { return { success: false, message: e.message }; }
});

// Minigames
ipcHandle('get-checkin-history', async () => ({ success: true, data: await CheckinHistory.find({}).sort({ date: -1 }).limit(100).lean() }));
ipcHandle('get-missions', async () => ({ success: true, data: await Mission.find({}).lean() }));
ipcHandle('get-lucky-wheel', async () => ({ success: true, data: await LuckyWheelReward.find({}).lean() }));
ipcHandle('get-top-racing', async () => ({ success: true, data: await TopRacingConfig.find({}).sort({ rank: 1 }).lean() }));
ipcHandle('update-top-racing', async (event, { id, data }) => { await TopRacingConfig.findByIdAndUpdate(id, data); return { success: true }; });

ipcHandle('get-dashboard-stats', async () => {
  try {
    const totalUsers = await Account.countDocuments({});
    
    // Tính tổng số dư của tất cả người dùng
    const accounts = await Account.find({}, 'balance');
    const totalBalance = accounts.reduce((sum, acc) => sum + (acc.balance || 0), 0);

    // Người dùng mới hôm nay
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const todayNewUsers = await Account.countDocuments({ date: { $gte: startOfDay } });

    // Thống kê nạp tiền
    const deposits = await Deposit.find({ status: 1 }, 'amount');
    const totalDeposit = deposits.reduce((sum, d) => sum + (d.amount || 0), 0);
    const pendingDeposits = await Deposit.countDocuments({ status: 0 });

    // Thống kê rút tiền
    const withdraws = await Withdraw.find({ status: 1 }, 'amount');
    const totalWithdraw = withdraws.reduce((sum, w) => sum + (w.amount || 0), 0);
    const pendingWithdraws = await Withdraw.countDocuments({ status: 0 });

    return { 
      success: true, 
      data: { 
        totalUsers, 
        totalBalance,
        todayNewUsers,
        totalDeposit, 
        totalWithdraw,
        pendingDeposits, 
        pendingWithdraws
      } 
    };
  } catch (error) {
    console.error('❌ [Stats Error]:', error);
    return { success: false, message: error.message };
  }
});

// --- CLEANUP GAME HISTORY ---
async function cleanupGameHistory() {
  console.log('[Cleanup] Bắt đầu dọn dẹp lịch sử game cũ...');
  const logs = [];
  try {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const models = [
      { name: 'TaiXiu', model: TxGameHistory },
      { name: 'MD5', model: Md5History },
      { name: 'KhongMinh', model: KhongMinhHistory },
    ];

    for (const { name, model } of models) {
      if (model) {
        const result = await model.deleteMany({ date: { $lt: sevenDaysAgo } });
        const msg = `[Cleanup] ${name}: Đã xóa ${result.deletedCount} bản ghi cũ.`;
        console.log(msg);
        logs.push(msg);
      }
    }
    console.log('[Cleanup] Hoàn tất dọn dẹp.');
    return { success: true, logs };
  } catch (error) {
    console.error('[Cleanup] Lỗi khi dọn dẹp:', error);
    return { success: false, message: error.message };
  }
}

// Auto Cleanup Game History (3:00 AM daily)
cron.schedule('0 3 * * *', cleanupGameHistory);

ipcHandle('cleanup-game-history', async () => {
  return await cleanupGameHistory();
});

ipcHandle('get-licenses', async () => ({ success: true, data: await License.find({}).lean() }));

ipcHandle('check-license-status', async () => {
  const machineId = getMachineId();
  const license = await License.findOne({ machineId, isActive: true });
  return { success: true, activated: !!license };
});

ipcHandle('get-agency-list', async () => {
  const agencies = await Account.find({ ref: { $gt: 0 } }).sort({ ref: -1 }).limit(100).lean();
  return { success: true, data: agencies };
});

ipcHandle('get-commission-settings', async () => {
  // Sử dụng findOneAndUpdate với upsert: true để tránh lỗi duplicate key
  const setting = await CommissionSetting.findOneAndUpdate(
    { key: 'default' },
    { $setOnInsert: { key: 'default' } }, // Chỉ set giá trị khi tạo mới
    { upsert: true, new: true, lean: true }
  );
  return { success: true, data: setting };
});

ipcHandle('save-commission-settings', async (event, rates) => {
  await CommissionSetting.findOneAndUpdate(
    { key: 'default' },
    { rates: rates },
    { upsert: true, new: true }
  );
  return { success: true };
});

ipcHandle('activate-license', async (event, key) => {
  const machineId = getMachineId();
  const apiUrl = process.env.LICENSE_API_URL;

  if (!apiUrl) return { success: false, message: 'API kích hoạt chưa được cấu hình trong file .env.dashboard' };

  try {
    // Gọi API của người bán (server center) để xác thực và đăng ký máy
    const response = await fetch(`${apiUrl}/api/activate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, machineId })
    });

    const responseText = await response.text();
    if (!responseText) {
      return { success: false, message: 'Máy chủ kích hoạt không phản hồi. Vui lòng đảm bảo Admin Center đang chạy.' };
    }

    const apiResult = JSON.parse(responseText);

    if (!apiResult || !apiResult.success) {
      return { success: false, message: apiResult.message || 'Key không hợp lệ hoặc đã được sử dụng.' };
    }

    // Nếu API trả về OK, lưu thông tin license vào DB local của máy khách
    const { clientName, expiryDate } = apiResult.data;
    await License.findOneAndUpdate(
      { key: key }, // Điều kiện tìm kiếm
      { key, clientName, expiryDate, machineId, isActive: true, activatedAt: new Date() }, // Dữ liệu để cập nhật hoặc tạo mới
      { upsert: true, new: true } // Tùy chọn: upsert=true sẽ tạo mới nếu không tìm thấy
    );

    return { success: true, message: 'Kích hoạt hệ thống thành công!' };
  } catch (error) {
    console.error('❌ [License API Error]:', error);
    return { success: false, message: 'Lỗi kết nối đến máy chủ kích hoạt. Vui lòng kiểm tra mạng.' };
  }
});

// Tiện ích
ipcHandle('open-file-dialog', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({ properties: ['openFile'], filters: [{ name: 'Media', extensions: ['jpg', 'png', 'gif', 'mp4'] }] });
  return canceled ? null : filePaths[0];
});

ipcHandle('get-logs', () => appLogs);

// --- AUTO UPDATER ---
const sendUpdateStatus = (text) => { if (mainWindow) mainWindow.webContents.send('update-message', text); };
autoUpdater.on('checking-for-update', () => sendUpdateStatus('Đang kiểm tra bản cập nhật...'));
autoUpdater.on('update-available', () => sendUpdateStatus('Có bản cập nhật mới. Đang tải...'));
autoUpdater.on('update-not-available', () => sendUpdateStatus('Ứng dụng đã ở bản mới nhất.'));
autoUpdater.on('update-downloaded', () => sendUpdateStatus('Tải xong. Khởi động lại để cập nhật.'));
autoUpdater.autoDownload = true;

ipcMain.handle('check-for-update', async () => {
  if (isDev) return { success: false, message: 'Đang ở chế độ Dev, không thể cập nhật.' };
  try {
    autoUpdater.checkForUpdates();
    return { success: true, message: 'Đang kiểm tra bản cập nhật mới...' };
  } catch (e) {
    return { success: false, message: 'Lỗi: ' + e.message };
  }
});

ipcMain.handle('get-app-version', () => app.getVersion());

// --- BOT INITIALIZATION ---
async function initializeBots() {
  console.log('[Dashboard] Đang khởi tạo hệ thống Bot...');

  // 1. Khởi tạo Bot Chính
  const mainBotConfig = await Bot.findOne({ role: 'main', status: 1 }).lean();
  if (mainBotConfig) {
    try { await startMainBot(mainBotConfig); } catch (e) { console.error('[Main Bot Start Error]', e); }
    // Single initialization only — avoid double-start which causes Telegram 409 polling conflicts
  }

  // Khởi tạo Bot CSKH
  try {
    await startCskhBot(io);
  } catch (e) {
    console.error('[CSKH Bot Start Error]', e);
  }

  // 2. Khởi tạo các Bot Phòng Game
  const models = [TxRoomSetting, Md5Setting, KhongMinhSetting];
  for (const Model of models) {
    const configs = await Model.find({ status: 1 }, { gameHistory: { $slice: -20 } }).lean();
    for (const config of configs) {
      try { await startOrUpdateBot(config); } catch (e) { console.error(e); }
    }
  }
}

// --- APP LOGIC ---
const connectDB = async () => {
  if (mongoose.connection.readyState >= 1) return;
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/lasvegas';
  try {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000, // Thử kết nối trong 5 giây, nếu không được sẽ báo lỗi ngay
      bufferCommands: false,         // Tắt hàng đợi lệnh nếu chưa có kết nối
    });
    console.log('[Dashboard] DB Connected');

    // Tự động tạo tài khoản admin mặc định nếu chưa tồn tại
    try {
      const adminExists = await User.findOne({ username: 'admincenter' });
      if (!adminExists) {
        await User.create({
          username: 'admincenter',
          password: '1',
          role: 'superadmin', // Đồng bộ quyền superadmin
          isFirstLogin: true
        });
        console.log('✅ [Dashboard] Đã tạo tài khoản mặc định: admincenter / 1 (Role: admin)');
      }
    } catch (createErr) {
      if (createErr.code === 11000) {
        console.warn('⚠️ [Dashboard] Tài khoản admin đã tồn tại hoặc có xung đột index cũ.');
        if (createErr.message.includes('local.username_1')) {
          await User.collection.dropIndex('local.username_1').catch(() => {});
          console.log('💡 Đã xóa index cũ "local.username_1" bị xung đột. Vui lòng khởi động lại ứng dụng.');
        }
      }
    }
  } catch (err) { 
    console.error('❌ [Dashboard] Lỗi kết nối MongoDB:', err.message);
    if (err.message.includes('ECONNREFUSED') || err.message.includes('timeout')) {
      setTimeout(connectDB, 5000);
    }
  }
};

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280, height: 800,
    show: false, // Không hiển thị ngay lập tức để tránh nháy trắng
    webPreferences: { 
      nodeIntegration: true, 
      contextIsolation: false
    }
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show(); // Chỉ hiển thị khi giao diện đã sẵn sàng
  });

  if (isDev) mainWindow.loadURL(`http://localhost:${DASHBOARD_PORT}`);
  else mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
}

app.whenReady().then(async () => {
    // Tự động khởi động hai webapp khi dashboard chạy (có thể bỏ nếu muốn chủ động bật/tắt)
    // try { startTaixiuCaoWebProcess(); } catch (e) { console.warn('[Dashboard] startTaixiuCaoWebProcess failed:', e && e.message ? e.message : e); }
    // try { startTaixiuNanWebProcess(); } catch (e) { console.warn('[Dashboard] startTaixiuNanWebProcess failed:', e && e.message ? e.message : e); }
    // try { startExtraGameWebs(); } catch (e) { console.warn('[Dashboard] startExtraGameWebs failed:', e); }
  await connectDB();

  // --- KHỞI ĐỘNG GAME SESSIONS (Tài Xỉu Cào/Nặn) ---
  // console.log('🎲 [Dashboard] Đang khởi động các phiên game...');
  // gameSessions['taixiucao'] = new GameSession(io, 'taixiucao');
  // gameSessions['taixiucao'].init();
  // gameSessions['taixiunan'] = new GameSession(io, 'taixiunan');
  // gameSessions['taixiunan'].init();

  if (mongoose.connection.readyState !== 1) {
    dialog.showErrorBox('Lỗi kết nối', 'Không thể kết nối tới MongoDB. Vui lòng đảm bảo service MongoDB đang chạy (net start MongoDB).');
  }
  initializeBots();
  createWindow();

  if (!isDev) autoUpdater.checkForUpdatesAndNotify();

  // Start the API server
  const API_PORT = process.env.API_PORT || process.env.GAME_ADMIN_PORT || 4001;
  server.listen(API_PORT, () => {
      console.log(`🚀 API & WebSocket Server is running on http://localhost:${API_PORT}`);
  });
  // // Start taixiu game admin server
  // try { startGameAdminServer(); } catch (e) { console.warn('[Dashboard] startGameAdminServer failed:', e && e.message ? e.message : e); }
  // // Start taixiu web server (PORT=4003)
  // try { startTaixiuWebServerProcess(); } catch (e) { console.warn('[Dashboard] startTaixiuWebServerProcess failed:', e && e.message ? e.message : e); }
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('before-quit', () => {
  if (taixiuCaoWebProcess) {
    safeKill(taixiuCaoWebProcess);
    taixiuCaoWebProcess = null;
  }
  if (taixiuNanWebProcess) {
    safeKill(taixiuNanWebProcess);
    taixiuNanWebProcess = null;
  }
  stopExtraGameWebs();
  if (gameAdminServerProcess) {
    try { safeKill(gameAdminServerProcess); } catch(e){}
    gameAdminServerProcess = null;
  }
  if (taixiuWebServerProcess) {
    try { safeKill(taixiuWebServerProcess); } catch(e){}
    taixiuWebServerProcess = null;
  }
});

// Xử lý Ctrl+C để thoát gọn gàng
process.on('SIGINT', () => {
  app.quit();
});

// IPC for controlling the game admin child server from renderer
ipcMain.handle('start-game-server', async () => {
  try {
    startGameAdminServer();
    return { success: true };
  } catch (e) {
    console.error('[IPC] start-game-server failed', e);
    return { success: false, message: e.message };
  }
});

ipcMain.handle('stop-game-server', async () => {
  try {
    if (gameAdminServerProcess) {
      try { gameAdminServerProcess.send({ type: 'shutdown' }); } catch(e){}
      const pid = gameAdminServerProcess.pid;
      setTimeout(() => {
        try { process.kill(pid, 0); } catch (e) { gameAdminServerProcess = null; return { success: true }; }
        try { process.kill(pid); } catch(e){}
        gameAdminServerProcess = null;
      }, 1200);
    }
    return { success: true };
  } catch (e) {
    console.error('[IPC] stop-game-server failed', e);
    return { success: false, message: e.message };
  }
});

ipcMain.handle('get-game-server-status', async () => {
  try {
    return { success: true, running: !!gameAdminServerProcess, pid: gameAdminServerProcess ? gameAdminServerProcess.pid : null };
  } catch (e) { return { success: false, message: e.message }; }
});

// API: Start/Stop game server & web servers
expressApp.post('/api/start-game-server', (req, res) => {
  try {
    startGameAdminServer();
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});
expressApp.post('/api/stop-game-server', (req, res) => {
  try {
    if (gameAdminServerProcess) {
      try { gameAdminServerProcess.send({ type: 'shutdown' }); } catch(e){}
      const pid = gameAdminServerProcess.pid;
      setTimeout(() => {
        try { process.kill(pid, 0); } catch (e) { gameAdminServerProcess = null; return; }
        try { process.kill(pid); } catch(e){}
        gameAdminServerProcess = null;
      }, 1200);
    }
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});
expressApp.post('/api/start-taixiucao-web', (req, res) => {
  try {
    startTaixiuCaoWebProcess();
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});
expressApp.post('/api/stop-taixiucao-web', (req, res) => {
  try {
    stopTaixiuCaoWebProcess();
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});
expressApp.post('/api/start-taixiunan-web', (req, res) => {
  try {
    startTaixiuNanWebProcess();
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});
expressApp.post('/api/stop-taixiunan-web', (req, res) => {
  try {
    stopTaixiuNanWebProcess();
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});