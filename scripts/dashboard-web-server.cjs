process.env.VITE_APP_MODE = process.env.VITE_APP_MODE || 'dashboard';
process.env.DASHBOARD_WEB_ONLY = process.env.DASHBOARD_WEB_ONLY || '1';
process.env.DASHBOARD_HOST = process.env.DASHBOARD_WEB_HOST || process.env.DASHBOARD_HOST || '127.0.0.1';
const dashboardWebPort = process.env.DASHBOARD_WEB_PORT || process.env.API_PORT || process.env.GAME_ADMIN_PORT || '4001';
process.env.API_PORT = dashboardWebPort;
process.env.GAME_ADMIN_PORT = dashboardWebPort;
require('../electron/dashboard.cjs');
