const Setting = require('../models/Setting');
const axios = require('axios');

const DEFAULT_GAME_MENU_BUTTONS = [
  { id: 'tx_cao', text: '🎲 Tài Xỉu Cào', callbackData: 'game_tx_cao', webAppUrl: '', enabled: true, order: 1 },
  { id: 'tx_nan', text: '🎲 Tài Xỉu Nặn', callbackData: 'game_tx_nan', webAppUrl: '', enabled: true, order: 2 },
  { id: 'xocdia', text: '💿 Xóc Dĩa', callbackData: 'game_xocdia', webAppUrl: '', enabled: true, order: 3 },
  { id: 'baucua', text: '🦀 Bầu Cua', callbackData: 'game_baucua', webAppUrl: '', enabled: true, order: 4 },
  { id: 'tx_tele', text: '📈 Tài Xỉu Tele', callbackData: 'game_tx_tele', webAppUrl: '', enabled: true, order: 5 },
  { id: 'cl_tele', text: '📊 Chẵn Lẻ Tele', callbackData: 'game_cl_tele', webAppUrl: '', enabled: true, order: 6 },
  { id: 'tx_dice', text: '🎲 TX Xúc Xắc Tele', callbackData: 'game_tx_dice', webAppUrl: '', enabled: true, order: 7 },
  { id: 'cl_dice', text: '🎲 CL Xúc Xắc Tele', callbackData: 'game_cl_dice', webAppUrl: '', enabled: true, order: 8 },
  { id: 'slot_tele', text: '🎰 Slot Tele', callbackData: 'game_slot', webAppUrl: '', enabled: true, order: 9 },
  { id: 'plinko', text: '🎱 Plinko', callbackData: 'game_plinko', webAppUrl: '', enabled: true, order: 10 },
  { id: 'booms', text: '💣 Booms', callbackData: 'game_booms', webAppUrl: '', enabled: true, order: 11 },
  { id: 'xeng', text: '🍒 Xèng', callbackData: 'game_xeng', webAppUrl: '', enabled: true, order: 12 },
];

const escapeHtml = (value) => String(value || '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#039;');

const normalizeButton = (item, index = 0) => {
  const callbackDataRaw = String(item?.callbackData || item?.callback_data || '').trim();
  if (!callbackDataRaw.startsWith('game_')) return null;

  const text = String(item?.text || '').trim();
  if (!text) return null;

  const enabled = item?.enabled !== false;
  const orderRaw = Number(item?.order);
  const order = Number.isFinite(orderRaw) ? Math.max(0, Math.floor(orderRaw)) : index + 1;

  return {
    id: String(item?.id || callbackDataRaw).trim() || callbackDataRaw,
    text,
    callbackData: callbackDataRaw,
    webAppUrl: String(item?.webAppUrl || item?.url || '').trim(),
    enabled,
    order,
  };
};

const normalizeButtons = (raw) => {
  const source = Array.isArray(raw) && raw.length > 0 ? raw : DEFAULT_GAME_MENU_BUTTONS;
  const normalized = source
    .map((item, index) => normalizeButton(item, index))
    .filter(Boolean)
    .sort((a, b) => a.order - b.order);

  if (normalized.length > 0) return normalized;
  return DEFAULT_GAME_MENU_BUTTONS.map((item, index) => normalizeButton(item, index)).filter(Boolean);
};

const buildGameKeyboard = (buttons) => {
  const enabledButtons = buttons.filter((item) => item.enabled !== false);
  if (enabledButtons.length === 0) {
    return { inline_keyboard: [[{ text: 'Chưa có trò chơi', callback_data: 'game_menu_empty' }]] };
  }

  const rows = [];
  let currentRow = [];
  enabledButtons.forEach((btn) => {
    currentRow.push({ text: btn.text, callback_data: btn.callbackData });
    if (currentRow.length === 2) {
      rows.push(currentRow);
      currentRow = [];
    }
  });
  if (currentRow.length > 0) rows.push(currentRow);
  return { inline_keyboard: rows };
};

const findButtonByCallback = (buttons, callbackData) => buttons.find((item) => item.callbackData === callbackData) || null;
const isTeleButton = (button) => /tele/i.test(`${String(button?.text || '')} ${String(button?.callbackData || '')}`);
const isValidHttpUrl = (url) => /^https?:\/\//i.test(String(url || '').trim());

const getButtonsFromSettings = async () => {
  const settings = await Setting.findOne({}).lean();
  const buttons = normalizeButtons(settings?.gameMenuButtons);
  return { settings, buttons };
};

module.exports = {
  getDefaultButtons: () => DEFAULT_GAME_MENU_BUTTONS.map((item) => ({ ...item })),
  normalizeButtons,
  getButtonsFromSettings,

  show: async (bot, msg) => {
    const { settings, buttons } = await getButtonsFromSettings();
    const imageUrl = settings?.gameListImage;

    const caption = `🎮 <b>DANH SÁCH TRÒ CHƠI</b>\n\n👉 <i>Vui lòng chọn trò chơi bên dưới để tham gia!</i>`;
    const gameKeyboard = buildGameKeyboard(buttons);

    try {
      if (imageUrl && imageUrl.startsWith('http')) {
        const response = await axios.get(imageUrl, {
          responseType: 'arraybuffer',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          },
        });
        const imageBuffer = Buffer.from(response.data, 'binary');

        await bot.sendPhoto(
          msg.chat.id,
          imageBuffer,
          { caption, parse_mode: 'HTML', reply_markup: gameKeyboard },
          { filename: 'game_list.jpg', contentType: 'image/jpeg' },
        );
      } else {
        await bot.sendMessage(msg.chat.id, caption, {
          parse_mode: 'HTML',
          reply_markup: gameKeyboard,
        });
      }
    } catch (error) {
      console.error('Lỗi tải ảnh menu game:', error.message);
      if (imageUrl && imageUrl.startsWith('http')) {
        try {
          await bot.sendPhoto(msg.chat.id, imageUrl, {
            caption,
            parse_mode: 'HTML',
            reply_markup: gameKeyboard,
          });
          return;
        } catch (urlError) {
          console.error('Lỗi gửi ảnh menu game qua URL:', urlError.message);
        }
      }

      await bot.sendMessage(msg.chat.id, caption, {
        parse_mode: 'HTML',
        reply_markup: gameKeyboard,
      });
    }
  },

  handleGameCallback: async (bot, callbackQuery) => {
    const data = String(callbackQuery?.data || '').trim();
    const chatId = callbackQuery?.message?.chat?.id;
    if (!data.startsWith('game_') || !chatId) return false;

    if (data === 'game_menu_empty') {
      try { await bot.answerCallbackQuery(callbackQuery.id, { text: 'Danh sách game đang trống' }); } catch (_) {}
      return true;
    }

    const { buttons } = await getButtonsFromSettings();
    const selected = findButtonByCallback(buttons, data);

    if (!selected || selected.enabled === false) {
      try { await bot.answerCallbackQuery(callbackQuery.id, { text: 'Trò chơi hiện đang tắt', show_alert: false }); } catch (_) {}
      return true;
    }

    if (isTeleButton(selected)) {
      try {
        await bot.answerCallbackQuery(callbackQuery.id, {
          text: 'Game Tele choi truc tiep trong bot',
          show_alert: false,
        });
      } catch (_) {}
      return true;
    }

    const targetUrl = String(selected.webAppUrl || '').trim();
    if (!isValidHttpUrl(targetUrl)) {
      try { await bot.answerCallbackQuery(callbackQuery.id, { text: 'Game chưa cấu hình link Web App', show_alert: false }); } catch (_) {}
      return true;
    }

    const safeTitle = escapeHtml(selected.text);
    await bot.sendMessage(
      chatId,
      `🎮 <b>${safeTitle}</b>\n\n👉 Nhấn nút bên dưới để mở Web App.`,
      {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🚀 Mở Web App', url: targetUrl }],
          ],
        },
      },
    );

    try { await bot.answerCallbackQuery(callbackQuery.id); } catch (_) {}
    return true;
  },
};
