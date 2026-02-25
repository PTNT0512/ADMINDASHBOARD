const TelegramBot = require('node-telegram-bot-api');
const Bot = require('../models/Bot');
const SupportMessage = require('../models/SupportMessage');

let cskhBotInstance = null;

async function startCskhBot(io) {
  try {
    const botConfig = await Bot.findOne({ role: 'cskh', status: 1 }).lean();
    if (!botConfig || !botConfig.token) {
      console.log('[CSKH Bot] Không tìm thấy cấu hình hoặc token. Bỏ qua khởi tạo CSKH bot.');
      return;
    }

    // Nếu đã có instance, dừng trước
    if (cskhBotInstance) {
      try { await cskhBotInstance.stopPolling(); } catch(e){}
      try { cskhBotInstance.removeAllListeners(); } catch(e){}
      cskhBotInstance = null;
      await new Promise(r => setTimeout(r, 500));
    }

    const bot = new TelegramBot(botConfig.token, { polling: true });
    cskhBotInstance = bot;

    bot.on('message', async (msg) => {
      try {
        const userId = msg.from.id;
        const username = msg.from.first_name || msg.from.username || 'User';

        if (msg.photo && msg.photo.length) {
          const photo = msg.photo[msg.photo.length - 1];
          const stream = bot.getFileStream(photo.file_id);
          const chunks = [];
          for await (const ch of stream) chunks.push(ch);
          const buffer = Buffer.concat(chunks);
          const imageBase64 = `data:image/jpeg;base64,${buffer.toString('base64')}`;

          const doc = await SupportMessage.create({ userId, username, content: msg.caption || '', imageBase64, direction: 'in', isRead: false });
          if (io) io.emit('new_message', doc);
          return;
        }

        if (msg.text) {
          const doc = await SupportMessage.create({ userId, username, content: msg.text, direction: 'in', isRead: false });
          if (io) io.emit('new_message', doc);
        }
      } catch (e) {
        console.error('[CSKH Bot] Error handling incoming message:', e.message || e);
      }
    });

    bot.on('polling_error', (err) => {
      console.error('[CSKH Bot Polling Error]', err && err.message ? err.message : err);
      if (err && err.code === 409) {
        try { bot.stopPolling(); } catch(e){}
        cskhBotInstance = null;
      }
    });

    console.log('[CSKH Bot] Khởi tạo CSKH bot thành công.');
  } catch (e) {
    console.error('[CSKH Bot] Lỗi khi khởi tạo:', e.message || e);
  }
}

async function sendCskhReply(userId, text, imageBase64) {
  try {
    if (!cskhBotInstance) return { success: false, message: 'CSKH bot chưa khởi tạo' };

    if (imageBase64) {
      // imageBase64 expected to be data URI or base64 string
      let data = imageBase64;
      if (data.startsWith('data:')) {
        const comma = data.indexOf(',');
        data = data.slice(comma + 1);
      }
      const buffer = Buffer.from(data, 'base64');
      await cskhBotInstance.sendPhoto(userId, buffer, { caption: text }, { filename: 'image.jpg', contentType: 'image/jpeg' });
    } else {
      await cskhBotInstance.sendMessage(userId, text || '');
    }

    const doc = await SupportMessage.create({ userId: parseInt(userId), username: 'Admin', content: text || '', imageBase64: imageBase64 || null, direction: 'out', isRead: true });
    return { success: true, data: doc };
  } catch (e) {
    console.error('[CSKH Bot] sendCskhReply error:', e.message || e);
    return { success: false, message: e.message || String(e) };
  }
}

async function checkCskhConnection() {
  if (!cskhBotInstance) return { success: false, message: 'CSKH bot chưa khởi tạo' };
  try {
    const me = await cskhBotInstance.getMe();
    return { success: true, message: `@${me.username} ONLINE` };
  } catch (e) {
    return { success: false, message: 'Lỗi kết nối CSKH bot' };
  }
}

module.exports = { startCskhBot, sendCskhReply, checkCskhConnection };
