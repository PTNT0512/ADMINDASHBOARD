import React, { useState, useEffect } from 'react';
import './App.css';

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [updateMsg, setUpdateMsg] = useState('');

  // Mock data cho phần quản lý (Chức năng sau này)
  const [users, setUsers] = useState([
    { id: 1, name: 'Nguyễn Văn A', role: 'Admin' },
    { id: 2, name: 'Trần Thị B', role: 'User' },
  ]);

  useEffect(() => {
    // Lắng nghe thông báo update từ Main Process
    if (window.require) {
      const { ipcRenderer } = window.require('electron');
      ipcRenderer.on('update-message', (event, message) => {
        console.log('Update status:', message);
        setUpdateMsg(message);
      });
      // Cleanup
      return () => ipcRenderer.removeAllListeners('update-message');
    }
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      // Gọi xuống Electron Main Process thông qua IPC
      // Lưu ý: window.require chỉ hoạt động trong môi trường Electron với nodeIntegration: true
      const { ipcRenderer } = window.require('electron');
      const result = await ipcRenderer.invoke('login-request', { username, password });

      if (result.success) {
        setIsLoggedIn(true);
        setError('');
      } else {
        setError(result.message);
      }
    } catch (err) {
      console.error(err);
      setError('Lỗi kết nối cơ sở dữ liệu!');
    }
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setUsername('');
    setPassword('');
  };

  // Giao diện trang Login
  if (!isLoggedIn) {
    return (
      <div className="login-container">
        <div className="login-box">
          <h2>Đăng Nhập Hệ Thống</h2>
          <form onSubmit={handleLogin}>
            <div className="input-group">
              <label>Username:</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="admin"
              />
            </div>
            <div className="input-group">
              <label>Password:</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="admin"
              />
            </div>
            {error && <p className="error">{error}</p>}
            <button type="submit">Đăng Nhập</button>
            {updateMsg && <p style={{marginTop: '10px', fontSize: '12px', color: '#666'}}>{updateMsg}</p>}
          </form>
        </div>
      </div>
    );
  }

  // Giao diện trang Admin (Dashboard)
  return (
    <div className="admin-container">
      <aside className="sidebar">
        <h3>Admin Panel</h3>
        <ul>
          <li className="active">Quản lý User</li>
          <li>Cài đặt</li>
          <li onClick={handleLogout} style={{cursor: 'pointer', color: '#ff6b6b'}}>Đăng xuất</li>
        </ul>
      </aside>
      <main className="content">
        <header>
          <h1>Danh sách người dùng</h1>
          {updateMsg && <span style={{color: '#4caf50', fontWeight: 'bold'}}>{updateMsg}</span>}
          <button className="add-btn">+ Thêm mới</button>
        </header>
        
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Tên</th>
                <th>Quyền</th>
                <th>Hành động</th>
              </tr>
            </thead>
            <tbody>
              {users.map(user => (
                <tr key={user.id}>
                  <td>{user.id}</td>
                  <td>{user.name}</td>
                  <td>{user.role}</td>
                  <td>
                    <button className="edit-btn">Sửa</button>
                    <button className="delete-btn">Xóa</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p><i>Đây là nơi bạn sẽ viết thêm các chức năng CRUD sau này.</i></p>
      </main>
    </div>
  );
}

export default App;
