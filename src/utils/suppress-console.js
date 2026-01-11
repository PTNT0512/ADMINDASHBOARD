// Suppress noisy console messages in the renderer.
// Import this as early as possible in the renderer entry (main.jsx).

const IGNORED_PATTERNS = [
  /cdn\.tailwindcss\.com/i,
  /^\[vite\]/i,
  /Download the React DevTools/i,
  /Electron Security Warning/i,
  /connecting\.\.\./i,
  /connected\./i,
];

function matchIgnored(args) {
  try {
    const text = args.map(a => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ');
    return IGNORED_PATTERNS.some(rx => rx.test(text));
  } catch (e) {
    return false;
  }
}

['log', 'info', 'warn', 'error', 'debug'].forEach((method) => {
  const orig = console[method];
  console[method] = function(...args) {
    if (matchIgnored(args)) return;
    try { orig.apply(console, args); } catch (e) { /* swallow */ }
  };
});

// Suppress window-level error messages that match patterns
if (typeof window !== 'undefined') {
  window.addEventListener('error', (ev) => {
    const msg = ev && ev.message ? ev.message : '';
    if (IGNORED_PATTERNS.some(rx => rx.test(msg))) ev.preventDefault();
  });

  window.addEventListener('unhandledrejection', (ev) => {
    const reason = ev && ev.reason ? (typeof ev.reason === 'string' ? ev.reason : JSON.stringify(ev.reason)) : '';
    if (IGNORED_PATTERNS.some(rx => rx.test(reason))) ev.preventDefault();
  });
}

export default {};
