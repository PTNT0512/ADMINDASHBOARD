const MOJIBAKE_PATTERN = /(Ã.|Ä.|â.|ðŸ|áº.|á».|Æ.|Â[^\s])/gu;
const VIETNAMESE_CHAR_PATTERN = /[À-ỹĐđ]/gu;
const CP1252_REVERSE_MAP = new Map([
  [0x20AC, 0x80],
  [0x201A, 0x82],
  [0x0192, 0x83],
  [0x201E, 0x84],
  [0x2026, 0x85],
  [0x2020, 0x86],
  [0x2021, 0x87],
  [0x02C6, 0x88],
  [0x2030, 0x89],
  [0x0160, 0x8A],
  [0x2039, 0x8B],
  [0x0152, 0x8C],
  [0x017D, 0x8E],
  [0x2018, 0x91],
  [0x2019, 0x92],
  [0x201C, 0x93],
  [0x201D, 0x94],
  [0x2022, 0x95],
  [0x2013, 0x96],
  [0x2014, 0x97],
  [0x02DC, 0x98],
  [0x2122, 0x99],
  [0x0161, 0x9A],
  [0x203A, 0x9B],
  [0x0153, 0x9C],
  [0x017E, 0x9E],
  [0x0178, 0x9F],
]);

const countPattern = (text, pattern) => {
  const matches = String(text || '').match(pattern);
  return matches ? matches.length : 0;
};

const encodeWindows1252Bytes = (text) => {
  const bytes = [];
  for (const char of String(text || '')) {
    const code = char.codePointAt(0);
    if (code <= 0xFF) {
      bytes.push(code);
      continue;
    }
    if (CP1252_REVERSE_MAP.has(code)) {
      bytes.push(CP1252_REVERSE_MAP.get(code));
      continue;
    }
    bytes.push(...Buffer.from(char, 'utf8'));
  }
  return Uint8Array.from(bytes);
};

const decodeLatin1ToUtf8 = (text) => {
  try {
    return Buffer.from(encodeWindows1252Bytes(text)).toString('utf8');
  } catch (_) {
    return String(text || '');
  }
};

const mojibakeScore = (text) => {
  const source = String(text || '');
  const bad = countPattern(source, MOJIBAKE_PATTERN);
  const good = countPattern(source, VIETNAMESE_CHAR_PATTERN);
  const replacement = countPattern(source, /�/gu);
  return (good * 2) - (bad * 6) - (replacement * 8);
};

const normalizeMojibakeText = (value) => {
  if (typeof value !== 'string' || value.length === 0) return value;

  let best = value;
  let bestScore = mojibakeScore(value);
  let current = value;

  for (let round = 0; round < 4; round += 1) {
    const decoded = decodeLatin1ToUtf8(current);
    if (!decoded || decoded === current) break;
    const decodedScore = mojibakeScore(decoded);
    if (decodedScore > bestScore) {
      best = decoded;
      bestScore = decodedScore;
    }
    current = decoded;
  }

  return best;
};

const normalizePayload = (value) => {
  if (typeof value === 'string') return normalizeMojibakeText(value);
  if (Array.isArray(value)) return value.map(normalizePayload);
  if (!value || typeof value !== 'object') return value;
  if (value instanceof Date || Buffer.isBuffer(value)) return value;

  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null) return value;

  const normalized = {};
  for (const [key, item] of Object.entries(value)) {
    normalized[key] = normalizePayload(item);
  }
  return normalized;
};

const patchMethod = (prototype, methodName, config) => {
  const original = prototype[methodName];
  if (typeof original !== 'function' || original.__mojibakePatched) return;

  const wrapped = function patchedTelegramMethod(...args) {
    const nextArgs = [...args];

    for (const index of config.textIndices || []) {
      if (index < nextArgs.length) nextArgs[index] = normalizeMojibakeText(nextArgs[index]);
    }

    for (const index of config.payloadIndices || []) {
      if (index < nextArgs.length) nextArgs[index] = normalizePayload(nextArgs[index]);
    }

    return original.apply(this, nextArgs);
  };

  wrapped.__mojibakePatched = true;
  prototype[methodName] = wrapped;
};

const TELEGRAM_METHOD_CONFIG = {
  sendMessage: { textIndices: [1], payloadIndices: [2] },
  editMessageText: { textIndices: [0], payloadIndices: [1] },
  editMessageCaption: { textIndices: [0], payloadIndices: [1] },
  answerCallbackQuery: { payloadIndices: [1] },
  sendPhoto: { payloadIndices: [2] },
  sendDocument: { payloadIndices: [2] },
  sendAnimation: { payloadIndices: [2] },
  sendVideo: { payloadIndices: [2] },
  sendAudio: { payloadIndices: [2] },
  sendVoice: { payloadIndices: [2] },
  sendMediaGroup: { payloadIndices: [1, 2] },
  sendPoll: { textIndices: [1], payloadIndices: [2, 3] },
};

const patchTelegramBotEncoding = (TelegramBot) => {
  if (!TelegramBot || !TelegramBot.prototype || TelegramBot.__mojibakePatched) return TelegramBot;

  Object.entries(TELEGRAM_METHOD_CONFIG).forEach(([methodName, config]) => {
    patchMethod(TelegramBot.prototype, methodName, config);
  });

  TelegramBot.__mojibakePatched = true;
  return TelegramBot;
};

module.exports = {
  normalizeMojibakeText,
  normalizePayload,
  patchTelegramBotEncoding,
};
