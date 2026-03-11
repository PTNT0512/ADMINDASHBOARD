import React, { useState, useEffect } from 'react';
import { Lock, User, LogIn } from 'lucide-react';
import './CskhLogin.css';

const CskhLogin = ({ onLoginSuccess }) => {
  const [formData, setFormData] = useState({ username: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [rememberMe, setRememberMe] = useState(false);

  useEffect(() => {
    // Load saved username if exists
    const saved = localStorage.getItem('cskhLoginRemember');
    if (saved) {
      setFormData(prev => ({ ...prev, username: saved }));
      setRememberMe(true);
    }
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (error) setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (!formData.username || !formData.password) {
      setError('Vui lòng nhập tên đăng nhập và mật khẩu');
      setLoading(false);
      return;
    }

    try {
      const BASE = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_URL)
        || (typeof process !== 'undefined' && process.env && process.env.REACT_APP_API_URL)
        || 'http://localhost:4001';

      const response = await fetch(`${BASE}/api/cskh/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      const data = await response.json();

      if (data.success) {
        localStorage.setItem('cskhToken', data.token);
        localStorage.setItem('cskhUser', JSON.stringify(data.user));
        
        if (rememberMe) {
          localStorage.setItem('cskhLoginRemember', formData.username);
        } else {
          localStorage.removeItem('cskhLoginRemember');
        }

        onLoginSuccess(data.user, data.token);
      } else {
        setError(data.message || 'Đăng nhập thất bại');
      }
    } catch (err) {
      console.error('Login error:', err);
      setError('Lỗi khi kết nối đến server. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="cskh-login-container">
      <div className="cskh-login-box">
        <div className="cskh-login-header">
          <div className="cskh-logo">
            <Lock className="w-8 h-8" />
          </div>
          <h1>CSKH Dashboard</h1>
          <p>Hệ Thống Quản Lý Chăm Sóc Khách Hàng</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Tên Đăng Nhập</label>
            <div className="input-wrapper">
              <User className="input-icon" />
              <input
                type="text"
                name="username"
                placeholder="Nhập tên đăng nhập"
                value={formData.username}
                onChange={handleInputChange}
                disabled={loading}
                autoFocus
              />
            </div>
          </div>

          <div className="form-group">
            <label>Mật Khẩu</label>
            <div className="input-wrapper">
              <Lock className="input-icon" />
              <input
                type="password"
                name="password"
                placeholder="Nhập mật khẩu"
                value={formData.password}
                onChange={handleInputChange}
                disabled={loading}
              />
            </div>
          </div>

          {error && (
            <div className="error-message">
              <span>{error}</span>
            </div>
          )}

          <div className="form-options">
            <label className="remember-me">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                disabled={loading}
              />
              <span>Ghi nhớ tên đăng nhập</span>
            </label>
          </div>

          <button
            type="submit"
            disabled={loading}
            className={`login-button ${loading ? 'loading' : ''}`}
          >
            <LogIn className="w-4 h-4" />
            {loading ? 'Đang đăng nhập...' : 'Đăng Nhập'}
          </button>
        </form>

        <div className="cskh-login-footer">
          <p>© 2026 Las Vegas Admin System</p>
          <p>All Rights Reserved</p>
        </div>
      </div>
    </div>
  );
};

export default CskhLogin;
