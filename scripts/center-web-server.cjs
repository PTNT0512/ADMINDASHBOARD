process.env.VITE_APP_MODE = process.env.VITE_APP_MODE || 'center';
process.env.CENTER_WEB_ONLY = process.env.CENTER_WEB_ONLY || '1';
process.env.CENTER_HOST = process.env.CENTER_WEB_HOST || process.env.CENTER_HOST || '127.0.0.1';
process.env.CENTER_PORT = process.env.CENTER_WEB_PORT || process.env.CENTER_PORT || '56174';
process.env.CENTER_API_HOST = process.env.CENTER_WEB_API_HOST || process.env.CENTER_API_HOST || process.env.CENTER_HOST || '127.0.0.1';
process.env.CENTER_API_PORT = process.env.CENTER_WEB_API_PORT || process.env.CENTER_API_PORT || '56175';
require('../electron/center.cjs');