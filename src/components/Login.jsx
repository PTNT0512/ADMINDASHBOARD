import React, { useState } from 'react';
import CenterLogin from './CenterLogin';

function Login({ onLogin, error, onLoginSuccess, loading }) {
  const appMode = import.meta.env.VITE_APP_MODE;

  if (appMode === 'center') {
    return <CenterLogin onLoginSuccess={onLoginSuccess} />;
  }

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (event) => {
    event.preventDefault();
    onLogin(username, password);
  };

  return (
    <div className="login-container">
      <div className="login-box">
        <h2>He Thong Nguoi Mua</h2>
        <form onSubmit={handleSubmit}>
          <div className="input-group">
            <label>Username</label>
            <input
              type="text"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="Ten dang nhap"
              required
            />
          </div>

          <div className="input-group">
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="••••••"
              required
            />
          </div>

          {error ? <p className="error">{error}</p> : null}

          <button type="submit" disabled={loading}>
            {loading ? <span className="spinner"></span> : null}
            Dang nhap
          </button>
        </form>
      </div>
    </div>
  );
}

export default Login;
