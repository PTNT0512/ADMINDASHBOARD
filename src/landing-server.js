const express = require('express');
const path = require('path');
const fs = require('fs');
const app = express();
const PORT = process.env.PORT || 80;

// Đường dẫn đến thư mục chứa file build của trang landing
// In production, serve from dist/ folder; in dev, serve from landing root
const isDev = process.env.NODE_ENV !== 'production';
const LANDING_DIR = isDev 
  ? path.join(__dirname, '../landing')
  : path.join(__dirname, '../landing/dist');

// Check if dist folder exists in production
if (!isDev && !fs.existsSync(LANDING_DIR)) {
  console.error(`[Landing] ERROR: Build directory not found at ${LANDING_DIR}`);
  console.error('[Landing] Run: cd landing && npm run build');
  process.exit(1);
}

// API endpoint for landing settings (called from browser when IPC is not available)
app.get('/api/get-landing-settings', (req, res) => {
  try {
    // Default fallback settings
    const defaultSettings = {
      success: true,
      data: {
        logoUrl: 'https://i.imgur.com/vazRsQJ.png',
        mainTitle: 'OK999.SITE',
        subtitle: 'Đẳng cấp Casino Quốc Tế',
        botName: 'MIG30 Support Bot',
        ctaButtonText: 'TRUY CẬP BOT NGAY',
        ctaButtonColor: '#229ED9',
        ctaButtonHoverColor: '#1e8bc0',
        ctaButtonUrl: 't.me/MIG30VIP_bot',
        giftCode: 'MIG30VIP',
        giftButtonText: 'Nhận Code',
        giftButtonUrl: 'javascript:void(0)',
        supportButtonText: 'Hỗ Trợ',
        supportButtonUrl: 't.me/MIG30VIP_bot',
        botLink: 't.me/MIG30VIP_bot',
        trustBadges: [
          { label: 'Nạp Rút', value: '24/7', color: 'text-yellow-500' },
          { label: 'Tốc độ', value: '1s', color: 'text-green-500' },
          { label: 'Bảo mật', value: '100%', color: 'text-blue-500' }
        ],
        copyrightText: '© 2025 MIG30.VIP Entertainment. All rights reserved.'
      }
    };
    
    // Send default settings (in production, these would come from DB via main process)
    res.json(defaultSettings);
  } catch (error) {
    console.error('[Landing API] Error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch landing settings' });
  }
});

if (isDev) {
    const VITE_DEV_PORT = process.env.LANDING_DEV_PORT || 5174;
    console.log(`[Landing] Development mode: proxying to Vite dev server on port ${VITE_DEV_PORT}`);
    // Redirect browser requests to the Vite dev server which handles JSX/TSX files
    app.get(/.*/i, (req, res) => {
        // Preserve original path when redirecting
        const target = `http://localhost:${VITE_DEV_PORT}${req.originalUrl}`;
        return res.redirect(target);
    });
} else {
    // Production: serve static built files from landing/dist directory
    console.log(`[Landing] Production mode: serving static files from ${LANDING_DIR}`);
    app.use(express.static(LANDING_DIR));

    // SPA fallback: route all requests to index.html for client-side routing
    app.get(/.*/i, (req, res) => {
        res.sendFile(path.join(LANDING_DIR, 'index.html'), (err) => {
            if (err && !res.headersSent) {
                console.error('[Landing] Error sending file:', err);
                res.status(500).send('Internal Server Error');
            }
        });
    });
}

const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Landing page server is running on http://localhost:${PORT} (dev=${isDev})`);
});

server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.error(`[Landing] Port ${PORT} is already in use`);
    } else {
        console.error('[Landing] Server error:', err);
    }
    process.exit(1);
});