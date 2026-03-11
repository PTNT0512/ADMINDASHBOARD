process.env.NTBA_FIX_350 = process.env.NTBA_FIX_350 || '1';
const TelegramBot = require('node-telegram-bot-api');
const { patchTelegramBotEncoding } = require('../utils/telegram-bot-normalizer.js');
patchTelegramBotEncoding(TelegramBot);
const Bot = require('../models/Bot');
const SupportMessage = require('../models/SupportMessage');

let cskhBotInstance = null;
const pendingIssueByUser = new Map();
const onlineAgentsBySocket = new Map();
let roundRobinIndex = 0;
const CSKH_BOT_POLLING_RECOVERABLE_MARKERS = [
  'EFATAL',
  'ECONNRESET',
  'ETIMEDOUT',
  'ESOCKETTIMEDOUT',
  'ECONNREFUSED',
  'EAI_AGAIN',
  'ENOTFOUND',
  'TIMED OUT',
  'SOCKET HANG UP'
];
const CSKH_BOT_POLLING_LOG_COOLDOWN_MS = 30000;
const CSKH_BOT_POLLING_RECOVERY_COOLDOWN_MS = 15000;
const CSKH_BOT_POLLING_RECOVERY_ERROR_THRESHOLD = 2;
const CSKH_BOT_POLLING_RECOVERY_WINDOW_MS = 45000;
const cskhPollingRecovery = {
  attempt: 0,
  timer: null,
  inProgress: false,
  lastErrorKey: '',
  lastErrorLogAt: 0,
  recoverableErrorBurst: 0,
  lastRecoverableErrorAt: 0,
  lastRecoveryAt: 0,
  lastRecoverySkipLogAt: 0
};
const CSKH_BOT_POLLING_OPTIONS = {
  interval: 500,
  params: { timeout: 25 }
};

function clearCskhPollingRecoveryTimer() {
  if (!cskhPollingRecovery.timer) return;
  clearTimeout(cskhPollingRecovery.timer);
  cskhPollingRecovery.timer = null;
}

function resetCskhPollingRecovery() {
  clearCskhPollingRecoveryTimer();
  cskhPollingRecovery.attempt = 0;
  cskhPollingRecovery.inProgress = false;
  cskhPollingRecovery.lastErrorKey = '';
  cskhPollingRecovery.lastErrorLogAt = 0;
  cskhPollingRecovery.recoverableErrorBurst = 0;
  cskhPollingRecovery.lastRecoverableErrorAt = 0;
  cskhPollingRecovery.lastRecoveryAt = 0;
  cskhPollingRecovery.lastRecoverySkipLogAt = 0;
}

function isCskhConflictError(err) {
  const payload = `${err?.code || ''} ${err?.message || ''}`.toUpperCase();
  return payload.includes('409 CONFLICT');
}

function getCskhPollingErrorKey(err) {
  const payload = `${err?.code || ''} ${err?.message || ''}`.toUpperCase();
  if (payload.includes('409 CONFLICT')) return '409_CONFLICT';
  if (payload.includes('ECONNRESET') || payload.includes('SOCKET HANG UP')) return 'ECONNRESET';
  if (payload.includes('ETIMEDOUT') || payload.includes('TIMED OUT') || payload.includes('ESOCKETTIMEDOUT')) return 'ETIMEDOUT';
  if (payload.includes('ECONNREFUSED')) return 'ECONNREFUSED';
  if (payload.includes('EAI_AGAIN') || payload.includes('ENOTFOUND')) return 'DNS';
  if (payload.includes('EFATAL')) return 'EFATAL';
  return `${err?.code || 'UNKNOWN'}`;
}

function formatCskhPollingError(err) {
  const code = err?.code || 'UNKNOWN';
  const rawMessage = String(err?.message || err || '').trim();
  const normalizedMessage = rawMessage
    .replace(/^(EFATAL:\s*)+/i, '')
    .replace(/^(Error:\s*)+/i, '')
    .replace(/^(EFATAL:\s*)+/i, '')
    .trim();
  return `${code}: ${normalizedMessage || 'unknown polling error'}`;
}

function isRecoverableCskhPollingError(err) {
  if (!err) return false;
  if (isCskhConflictError(err)) return false;
  const payload = `${err?.code || ''} ${err?.message || ''}`.toUpperCase();
  return CSKH_BOT_POLLING_RECOVERABLE_MARKERS.some((marker) => payload.includes(marker));
}

function shouldLogCskhPollingError(err) {
  const key = getCskhPollingErrorKey(err);
  const now = Date.now();
  const isSame = cskhPollingRecovery.lastErrorKey === key;
  if (isSame && now - cskhPollingRecovery.lastErrorLogAt < CSKH_BOT_POLLING_LOG_COOLDOWN_MS) return false;
  cskhPollingRecovery.lastErrorKey = key;
  cskhPollingRecovery.lastErrorLogAt = now;
  return true;
}

function shouldRecoverCskhPolling() {
  const now = Date.now();
  const isWindowExpired = (now - cskhPollingRecovery.lastRecoverableErrorAt) > CSKH_BOT_POLLING_RECOVERY_WINDOW_MS;
  if (isWindowExpired) {
    cskhPollingRecovery.recoverableErrorBurst = 0;
  }

  cskhPollingRecovery.recoverableErrorBurst += 1;
  cskhPollingRecovery.lastRecoverableErrorAt = now;

  const inCooldown = (now - cskhPollingRecovery.lastRecoveryAt) < CSKH_BOT_POLLING_RECOVERY_COOLDOWN_MS;
  if (inCooldown) {
    if ((now - cskhPollingRecovery.lastRecoverySkipLogAt) > CSKH_BOT_POLLING_LOG_COOLDOWN_MS) {
      const remainMs = CSKH_BOT_POLLING_RECOVERY_COOLDOWN_MS - (now - cskhPollingRecovery.lastRecoveryAt);
      console.warn(`[CSKH Bot] Polling recovery cooldown active (${Math.ceil(remainMs / 1000)}s left).`);
      cskhPollingRecovery.lastRecoverySkipLogAt = now;
    }
    return false;
  }

  return cskhPollingRecovery.recoverableErrorBurst >= CSKH_BOT_POLLING_RECOVERY_ERROR_THRESHOLD;
}

function scheduleCskhPollingRecovery(bot, reason) {
  if (!bot || cskhBotInstance !== bot) return;
  if (cskhPollingRecovery.inProgress || cskhPollingRecovery.timer) return;

  cskhPollingRecovery.lastRecoveryAt = Date.now();
  cskhPollingRecovery.recoverableErrorBurst = 0;
  cskhPollingRecovery.attempt += 1;
  const attempt = cskhPollingRecovery.attempt;
  const baseDelay = Math.min(30000, 2000 * (2 ** (attempt - 1)));
  const jitter = Math.floor(Math.random() * 1000);
  const delayMs = baseDelay + jitter;
  const reasonText = formatCskhPollingError(reason);
  console.warn(`[CSKH Bot] Polling reconnect scheduled in ${delayMs}ms (attempt ${attempt}): ${reasonText}`);

  cskhPollingRecovery.timer = setTimeout(async () => {
    cskhPollingRecovery.timer = null;
    if (!bot || cskhBotInstance !== bot) return;
    if (cskhPollingRecovery.inProgress) return;

    cskhPollingRecovery.inProgress = true;
    try {
      try {
        await bot.stopPolling();
      } catch (stopErr) {
        console.warn(`[CSKH Bot] stopPolling before reconnect ignored: ${stopErr.message}`);
      }

      await new Promise((resolve) => setTimeout(resolve, 300));
      await bot.startPolling(CSKH_BOT_POLLING_OPTIONS);
      console.log('[CSKH Bot] Polling reconnected successfully.');
      cskhPollingRecovery.inProgress = false;
      cskhPollingRecovery.attempt = Math.max(0, cskhPollingRecovery.attempt - 1);
      cskhPollingRecovery.lastErrorKey = '';
      cskhPollingRecovery.lastErrorLogAt = 0;
      cskhPollingRecovery.lastRecoverableErrorAt = 0;
      cskhPollingRecovery.recoverableErrorBurst = 0;
      cskhPollingRecovery.lastRecoverySkipLogAt = 0;
      return;
    } catch (reconnectErr) {
      console.error(`[CSKH Bot] Polling reconnect failed: ${formatCskhPollingError(reconnectErr)}`);
      cskhPollingRecovery.inProgress = false;
      scheduleCskhPollingRecovery(bot, reconnectErr);
      return;
    }
  }, delayMs);
}

const QUICK_SUPPORT_KEYBOARD = {
  keyboard: [
    [{ text: 'Tài Khoản' }, { text: 'Nạp Tiền' }],
    [{ text: 'Rút Tiền' }, { text: 'Lỗi khác' }]
  ],
  resize_keyboard: true,
  persistent: true
};

const TOPIC_MAP = {
  'tai khoan': { code: 'tai_khoan', label: 'Tai Khoan' },
  'tài khoản': { code: 'tai_khoan', label: 'Tai Khoan' },
  'nap tien': { code: 'nap_tien', label: 'Nap Tien' },
  'nạp tiền': { code: 'nap_tien', label: 'Nap Tien' },
  'rut tien': { code: 'rut_tien', label: 'Rut Tien' },
  'rút tiền': { code: 'rut_tien', label: 'Rut Tien' },
  'loi khac': { code: 'loi_khac', label: 'Loi khac' },
  'lỗi khác': { code: 'loi_khac', label: 'Loi khac' },
  'lối khác': { code: 'loi_khac', label: 'Loi khac' }
};

function normalizeText(text) {
  return String(text || '').trim().toLowerCase();
}

function setupAgentPresence(io) {
  if (!io || io.__cskhPresenceSetup) return;
  io.__cskhPresenceSetup = true;

  io.on('connection', (socket) => {
    socket.on('cskh-agent-online', (agent = {}) => {
      onlineAgentsBySocket.set(socket.id, {
        socketId: socket.id,
        username: agent.username || '',
        fullName: agent.fullName || '',
        userId: agent.id || '',
        connectedAt: Date.now()
      });
    });

    socket.on('cskh-agent-offline', () => {
      onlineAgentsBySocket.delete(socket.id);
    });

    socket.on('disconnect', () => {
      onlineAgentsBySocket.delete(socket.id);
    });
  });
}

function pickOnlineAgent() {
  const agents = Array.from(onlineAgentsBySocket.values());
  if (!agents.length) return null;
  const idx = roundRobinIndex % agents.length;
  roundRobinIndex += 1;
  return agents[idx];
}

async function sendQuickSupportMenu(bot, chatId, username) {
  await bot.sendMessage(
    chatId,
    `Xin chao ${username || 'ban'}!\nVui long chon muc can ho tro nhanh:`,
    { reply_markup: QUICK_SUPPORT_KEYBOARD }
  );
}

async function startCskhBot(io) {
  try {
    setupAgentPresence(io);

    const botConfig = await Bot.findOne({ role: 'cskh', status: 1 }).lean();
    if (!botConfig || !botConfig.token) {
      console.log('[CSKH Bot] Khong tim thay cau hinh hoac token. Bo qua khoi tao CSKH bot.');
      return;
    }

    if (cskhBotInstance) {
      resetCskhPollingRecovery();
      try { await cskhBotInstance.stopPolling(); } catch (e) {}
      try { cskhBotInstance.removeAllListeners(); } catch (e) {}
      cskhBotInstance = null;
      await new Promise((r) => setTimeout(r, 500));
    }

    const bot = new TelegramBot(botConfig.token, { polling: false });
    await bot.getMe();
    await bot.deleteWebHook();
    cskhBotInstance = bot;
    resetCskhPollingRecovery();

    bot.on('message', async (msg) => {
      const userId = msg?.from?.id;
      if (!userId) return;

      await runSupportUserTask(userId, async () => {
        try {
          const username = msg.from.first_name || msg.from.username || 'User';
          const normalized = normalizeText(msg.text);

        if (normalized === '/start' || normalized === '/menu') {
          await sendQuickSupportMenu(bot, msg.chat.id, username);
          return;
        }

        const topic = TOPIC_MAP[normalized];
        if (topic) {
          pendingIssueByUser.set(userId, {
            topicCode: topic.code,
            topicLabel: topic.label,
            requestedAt: Date.now()
          });
          await bot.sendMessage(
            msg.chat.id,
            `Ban da chon: ${topic.label}.\nVui long neu ro loi ban gap phai (co the gui kem hinh anh).`
          );
          return;
        }

        const pending = pendingIssueByUser.get(userId);
        if (pending && (msg.text || (msg.photo && msg.photo.length))) {
          let imageBase64 = null;
          let content = msg.text || msg.caption || '';

          if (msg.photo && msg.photo.length) {
            const photo = msg.photo[msg.photo.length - 1];
            const stream = bot.getFileStream(photo.file_id);
            const chunks = [];
            for await (const ch of stream) chunks.push(ch);
            imageBase64 = `data:image/jpeg;base64,${Buffer.concat(chunks).toString('base64')}`;
          }

          const routedAgent = pickOnlineAgent();
          const finalContent = `[${pending.topicLabel}] ${content || '(Khong co noi dung text)'}`;

          const doc = await SupportMessage.create({
            userId,
            username,
            content: finalContent,
            imageBase64,
            ticketCategory: pending.topicCode,
            assignedTo: routedAgent ? (routedAgent.fullName || routedAgent.username || '') : '',
            assignedSocketId: routedAgent ? routedAgent.socketId : '',
            direction: 'in',
            isRead: false
          });

          if (io) {
            if (routedAgent) {
              io.to(routedAgent.socketId).emit('new_message', doc);
              io.emit('support_assigned', {
                userId,
                username,
                topic: pending.topicCode,
                assignedTo: routedAgent.fullName || routedAgent.username || '',
                assignedSocketId: routedAgent.socketId
              });
            } else {
              io.emit('new_message', doc);
            }
          }

          await bot.sendMessage(
            msg.chat.id,
            routedAgent
              ? 'Cam on ban. He thong da ghi nhan loi va dang chuyen cho nhan vien CSKH tiep nhan.'
              : 'Cam on ban. Hien tai chua co CSKH online, he thong da ghi nhan va se phan hoi som nhat.'
          );

          pendingIssueByUser.delete(userId);
          return;
        }

        // Tin nhan thong thuong (khong qua flow menu)
        if (msg.photo && msg.photo.length) {
          const photo = msg.photo[msg.photo.length - 1];
          const stream = bot.getFileStream(photo.file_id);
          const chunks = [];
          for await (const ch of stream) chunks.push(ch);
          const imageBase64 = `data:image/jpeg;base64,${Buffer.concat(chunks).toString('base64')}`;
          const doc = await SupportMessage.create({
            userId,
            username,
            content: msg.caption || '',
            imageBase64,
            direction: 'in',
            isRead: false
          });
          if (io) io.emit('new_message', doc);
          return;
        }

        if (msg.text) {
          const doc = await SupportMessage.create({
            userId,
            username,
            content: msg.text,
            direction: 'in',
            isRead: false
          });
          if (io) io.emit('new_message', doc);
        }
        } catch (e) {
          console.error('[CSKH Bot] Error handling incoming message:', e.message || e);
        }
      });
    });

    bot.on('polling_error', (err) => {
      const recoverable = isRecoverableCskhPollingError(err);
      if (shouldLogCskhPollingError(err)) {
        const formatted = formatCskhPollingError(err);
        if (recoverable) {
          console.warn(`[CSKH Bot Polling Warning] ${formatted}`);
        } else {
          console.error(`[CSKH Bot Polling Error] ${formatted}`);
        }
      }

      if (isCskhConflictError(err)) {
        console.error('[CSKH Bot] 409 conflict detected. This instance will stop.');
        resetCskhPollingRecovery();
        try { bot.stopPolling(); } catch (e) {}
        try { bot.removeAllListeners(); } catch (e) {}
        cskhBotInstance = null;
        return;
      }

      if (recoverable) {
        if (shouldRecoverCskhPolling()) {
          scheduleCskhPollingRecovery(bot, err);
        }
      }
    });

    await bot.startPolling(CSKH_BOT_POLLING_OPTIONS);
    console.log('[CSKH Bot] Khoi tao CSKH bot thanh cong.');
  } catch (e) {
    console.error('[CSKH Bot] Loi khi khoi tao:', e.message || e);
  }
}

async function sendCskhReply(userId, text, imageBase64) {
  try {
    if (!cskhBotInstance) return { success: false, message: 'CSKH bot chua khoi tao' };

    if (imageBase64) {
      let data = imageBase64;
      if (data.startsWith('data:')) {
        const comma = data.indexOf(',');
        data = data.slice(comma + 1);
      }
      const buffer = Buffer.from(data, 'base64');
      await cskhBotInstance.sendPhoto(
        userId,
        buffer,
        { caption: text },
        { filename: 'image.jpg', contentType: 'image/jpeg' }
      );
    } else {
      await cskhBotInstance.sendMessage(userId, text || '');
    }

    const doc = await SupportMessage.create({
      userId: parseInt(userId),
      username: 'Admin',
      content: text || '',
      imageBase64: imageBase64 || null,
      direction: 'out',
      isRead: true
    });
    return { success: true, data: doc };
  } catch (e) {
    console.error('[CSKH Bot] sendCskhReply error:', e.message || e);
    return { success: false, message: e.message || String(e) };
  }
}

async function checkCskhConnection() {
  if (!cskhBotInstance) return { success: false, message: 'CSKH bot chua khoi tao' };
  try {
    const me = await cskhBotInstance.getMe();
    return { success: true, message: `@${me.username} ONLINE` };
  } catch (e) {
    return { success: false, message: 'Loi ket noi CSKH bot' };
  }
}

module.exports = { startCskhBot, sendCskhReply, checkCskhConnection };


