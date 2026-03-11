import React, { useState, useEffect } from 'react';
import ChatInterface from './ChatInterface';
import CskhLogin from './CskhLogin';
import { ToastProvider } from '../src/components/ToastContext';
import './App.css';

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [botStatus, setBotStatus] = useState(null);

  useEffect(() => {
    // Check if user is already logged in
    const token = localStorage.getItem('cskhToken');
    const user = localStorage.getItem('cskhUser');
    
    if (token && user) {
      try {
        setCurrentUser(JSON.parse(user));
        setIsLoggedIn(true);
      } catch (err) {
        console.error('Error parsing stored user:', err);
        localStorage.removeItem('cskhToken');
        localStorage.removeItem('cskhUser');
      }
    }
  }, []);

  useEffect(() => {
    if (!isLoggedIn) return;

    const BASE = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_URL)
      || (typeof process !== 'undefined' && process.env && process.env.REACT_APP_API_URL)
      || 'http://localhost:4001';
    fetch(`${BASE}/api/support/status`).then(r => r.json()).then(js => {
      if (js && js.success) setBotStatus(js.data);
      else setBotStatus({ success: false, message: 'Không xác định' });
    }).catch(() => setBotStatus({ success: false, message: 'Offline' }));
  }, [isLoggedIn]);

  const handleLoginSuccess = (user, token) => {
    setCurrentUser(user);
    setIsLoggedIn(true);
  };

  const handleLogout = () => {
    localStorage.removeItem('cskhToken');
    localStorage.removeItem('cskhUser');
    setCurrentUser(null);
    setIsLoggedIn(false);
    setBotStatus(null);
  };

  if (!isLoggedIn) {
    return (
      <ToastProvider>
        <CskhLogin onLoginSuccess={handleLoginSuccess} />
      </ToastProvider>
    );
  }

  return (
    <ToastProvider>
      <div>
        <header style={{ padding: '15px 20px', background: '#111', borderBottom: '1px solid #333', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h1 style={{ margin: 0, fontSize: '1.2em', color: '#00ff41', fontFamily: "'Courier New', monospace" }}>
            <i className="fas fa-headset"></i> CSKH - Bảng Điều Khiển
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <div style={{ color: '#ccc', fontSize: '0.9em' }}>
              Trạng thái bot: {botStatus ? (botStatus.success ? (botStatus.message || 'Online') : (botStatus.message || 'Offline')) : 'Đang kiểm tra...'}
            </div>
            <div style={{ color: '#ccc', fontSize: '0.85em', paddingRight: '10px' }}>
              Xin chào, <strong>{currentUser?.fullName || currentUser?.username}</strong>
            </div>
            <button
              onClick={handleLogout}
              style={{
                padding: '6px 12px',
                background: '#ff4444',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '0.85em'
              }}
            >
              Đăng Xuất
            </button>
          </div>
        </header>
        <ChatInterface />
      </div>
    </ToastProvider>
  );
}

export default App;