const MOJIBAKE_PATTERN = /(\u00C3.|\u00C4.|\u00E2.|\u00F0\u0178|\u00E1\u00BA.|\u00E1\u00BB.|\u00C6.|\u00C2[^\s])/gu;
const VIETNAMESE_CHAR_PATTERN = /[\u00C0-\u1EF9\u0110\u0111]/gu;
const UTF8_DECODER = typeof TextDecoder !== 'undefined' ? new TextDecoder('utf-8') : null;
const UTF8_ENCODER = typeof TextEncoder !== 'undefined' ? new TextEncoder() : null;
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
    if (UTF8_ENCODER) {
      bytes.push(...UTF8_ENCODER.encode(char));
      continue;
    }
    bytes.push(code & 0xFF);
  }
  return new Uint8Array(bytes);
};

const decodeLatin1ToUtf8 = (text) => {
  const source = String(text || '');
  if (!UTF8_DECODER) return source;

  try {
    return UTF8_DECODER.decode(encodeWindows1252Bytes(source));
  } catch (_) {
    return source;
  }
};

const mojibakeScore = (text) => {
  const source = String(text || '');
  const bad = countPattern(source, MOJIBAKE_PATTERN);
  const good = countPattern(source, VIETNAMESE_CHAR_PATTERN);
  const replacement = countPattern(source, /\uFFFD/gu);
  return (good * 2) - (bad * 6) - (replacement * 8);
};

export const normalizeMojibakeText = (value) => {
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

export const normalizePayload = (value) => {
  if (typeof value === 'string') return normalizeMojibakeText(value);
  if (Array.isArray(value)) return value.map(normalizePayload);
  if (!value || typeof value !== 'object') return value;
  if (value instanceof Date) return value;

  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null) return value;

  const normalized = {};
  for (const [key, item] of Object.entries(value)) {
    normalized[key] = normalizePayload(item);
  }
  return normalized;
};

const repairTextNode = (node) => {
  const original = String(node?.nodeValue || '');
  const normalized = normalizeMojibakeText(original);
  if (normalized && normalized !== original) {
    node.nodeValue = normalized;
  }
};

const repairAttributes = (element) => {
  const attributeNames = ['title', 'placeholder', 'aria-label', 'alt'];
  attributeNames.forEach((name) => {
    const current = element.getAttribute && element.getAttribute(name);
    if (!current) return;
    const normalized = normalizeMojibakeText(current);
    if (normalized && normalized !== current) {
      element.setAttribute(name, normalized);
    }
  });

  if (typeof element.value === 'string' && /^(button|submit|reset)$/i.test(String(element.type || ''))) {
    const normalizedValue = normalizeMojibakeText(element.value);
    if (normalizedValue && normalizedValue !== element.value) {
      element.value = normalizedValue;
    }
  }
};

const repairTree = (node) => {
  if (!node || typeof document === 'undefined') return;

  if (node.nodeType === 3) {
    repairTextNode(node);
    return;
  }

  if (node.nodeType !== 1) return;

  repairAttributes(node);

  const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  let current = walker.currentNode;
  while (current) {
    if (current.nodeType === 3) repairTextNode(current);
    if (current.nodeType === 1) repairAttributes(current);
    current = walker.nextNode();
  }
};

export const installMojibakeDomRepair = (rootNode) => {
  if (typeof window === 'undefined' || typeof document === 'undefined') return () => {};

  const root = rootNode || document.body;
  if (!root || typeof MutationObserver === 'undefined') return () => {};

  repairTree(root);
  if (document.title) {
    document.title = normalizeMojibakeText(document.title);
  }

  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.type === 'characterData') {
        repairTextNode(mutation.target);
        return;
      }
      mutation.addedNodes.forEach((node) => repairTree(node));
    });
  });

  observer.observe(root, {
    subtree: true,
    childList: true,
    characterData: true,
  });

  return () => observer.disconnect();
};
