import React, { useState, useEffect } from 'react';
// Giả sử bạn có hook useIpc để gọi xuống Electron
import { useIpc } from './ToastContext'; 
import CenterLogin from './CenterLogin';

function Login({ onLogin, error, updateMsg, onLoginSuccess, loading }) {
  const appMode = import.meta.env.VITE_APP_MODE; // 'center' hoặc 'dashboard'
  
  // Nếu là chế độ Center, sử dụng giao diện đăng nhập OTP riêng biệt
  if (appMode === 'center') {
    return <CenterLogin onLoginSuccess={onLoginSuccess} />;
  }

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const handleSubmit = (e) => {
    e.preventDefault();
    // onLogin is passed from App.jsx and now only takes username and password
    onLogin(username, password);
  };

  return (
    <div className="login-container">
      <div className="login-box">
        <h2>{appMode === 'center' ? 'Quản Lý Người Bán' : 'Hệ Thống Người Mua'}</h2>
        <form onSubmit={handleSubmit}>
          <div className="input-group">
            <label>Username:</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Tên đăng nhập"
            />
          </div>

          <div className="input-group">
            <label>Password:</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••"
              required
            />
          </div>
          {error && <p className="error">{error}</p>}
          <button type="submit" disabled={loading}>
            {loading && <span className="spinner"></span>}
            Đăng Nhập
          </button>
        </form>
      </div>
      {updateMsg && <div className="toast-message">{updateMsg}</div>}
    </div>
  );
}

export default Login;