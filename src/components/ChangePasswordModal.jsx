import React, { useState } from 'react';

function ChangePasswordModal({ username, oldPassword, onSuccess }) {
  const [newUsername, setNewUsername] = useState(username);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!newUsername) {
      return setError('Vui lòng nhập tên tài khoản mới');
    }
    if (!newPassword || newPassword.length < 1) {
      return setError('Vui lòng nhập mật khẩu mới');
    }
    if (newPassword !== confirmPassword) {
      return setError('Mật khẩu xác nhận không khớp');
    }
    if (newPassword === oldPassword) {
      return setError('Mật khẩu mới không được trùng với mật khẩu cũ');
    }

    setLoading(true);
    if (window.require) {
      const { ipcRenderer } = window.require('electron');
      const result = await ipcRenderer.invoke('change-password', {
        username,
        oldPassword,
        newPassword
      });

      if (result.success) {
        alert('Đổi mật khẩu thành công! Vui lòng ghi nhớ mật khẩu mới.');
        onSuccess();
      } else {
        setError(result.message);
      }
    }
    setLoading(false);
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.85)', display: 'flex',
      alignItems: 'center', justifyContent: 'center', zIndex: 9999
    }}>
      <div style={{
        backgroundColor: '#252525', padding: '30px', borderRadius: '8px',
        width: '400px', border: '1px solid #444', color: '#fff'
      }}>
        <h2 style={{ marginTop: 0, color: '#ffc107' }}>Đổi mật khẩu lần đầu</h2>
        <p style={{ fontSize: '13px', color: '#ccc', marginBottom: '15px' }}>
          Vui lòng thay đổi tên tài khoản và mật khẩu mặc định để tiếp tục.
        </p>
        
        <form onSubmit={handleSubmit} style={{ marginTop: '20px' }}>
          <div className="input-group" style={{ marginBottom: '15px' }}>
            <label>Tên tài khoản mới:</label>
            <input type="text" value={newUsername} onChange={(e) => setNewUsername(e.target.value)} style={{ width: '100%', padding: '10px', marginTop: '5px' }} />
          </div>
          <div className="input-group" style={{ marginBottom: '15px' }}>
            <label>Mật khẩu mới:</label>
            <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} style={{ width: '100%', padding: '10px', marginTop: '5px' }} />
          </div>
          <div className="input-group" style={{ marginBottom: '15px' }}>
            <label>Xác nhận mật khẩu mới:</label>
            <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} style={{ width: '100%', padding: '10px', marginTop: '5px' }} />
          </div>
          
          {error && <p style={{ color: '#ff4444', fontSize: '13px' }}>{error}</p>}
          
          <button type="submit" disabled={loading} style={{ width: '100%', padding: '12px', backgroundColor: '#28a745', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
            {loading ? 'Đang xử lý...' : 'Cập nhật mật khẩu'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default ChangePasswordModal;