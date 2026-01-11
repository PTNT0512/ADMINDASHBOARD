import React, { useState, useEffect } from 'react';
import ChatInterface from './ChatInterface';
import { ToastProvider } from '../src/components/ToastContext';
import './App.css';

function App() {
  const [botStatus, setBotStatus] = useState(null);

  useEffect(() => {
    const BASE = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_URL)
      || (typeof process !== 'undefined' && process.env && process.env.REACT_APP_API_URL)
      || 'http://localhost:4001';
    fetch(`${BASE}/api/support/status`).then(r => r.json()).then(js => {
      if (js && js.success) setBotStatus(js.data);
      else setBotStatus({ success: false, message: 'Không xác định' });
    }).catch(() => setBotStatus({ success: false, message: 'Offline' }));
  }, []);

  return (
    <ToastProvider>
      <div>
        <header style={{ padding: '15px 20px', background: '#111', borderBottom: '1px solid #333', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h1 style={{ margin: 0, fontSize: '1.2em', color: '#00ff41', fontFamily: "'Courier New', monospace" }}>
            <i className="fas fa-headset"></i> CSKH - Bảng Điều Khiển
          </h1>
          <div style={{ color: '#ccc', fontSize: '0.9em' }}>
            Trạng thái bot: {botStatus ? (botStatus.success ? (botStatus.message || 'Online') : (botStatus.message || 'Offline')) : 'Đang kiểm tra...'}
          </div>
        </header>
        <ChatInterface />
      </div>
    </ToastProvider>
  );
}

export default App;