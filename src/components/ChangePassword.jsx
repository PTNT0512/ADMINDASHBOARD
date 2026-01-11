import React, { useState } from 'react';
import { useIpc, useToast } from './ToastContext';

function ChangePassword({ username }) {
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const { invoke } = useIpc();
  const { showToast } = useToast();

  const handleUpdate = async () => {
    if (!oldPassword || !newPassword) {
      showToast('Vui lòng nhập đầy đủ thông tin', 'error');
      return;
    }
    const res = await invoke('change-password', { username, oldPassword, newPassword });
    if (res.success) {
      showToast('Đổi mật khẩu thành công', 'success');
      setOldPassword('');
      setNewPassword('');
    }
  };

  return (
    <div className="settings-container">
      <h2>Đổi mật khẩu</h2>
      <div className="input-group">
        <label>Mật khẩu cũ</label>
        <input 
          type="password" 
          value={oldPassword} 
          onChange={(e) => setOldPassword(e.target.value)} 
          style={{userSelect: 'text', pointerEvents: 'auto'}}
        />
      </div>
      <div className="input-group">
        <label>Mật khẩu mới</label>
        <input 
          type="password" 
          value={newPassword} 
          onChange={(e) => setNewPassword(e.target.value)} 
          style={{userSelect: 'text', pointerEvents: 'auto'}}
        />
      </div>
      <button onClick={handleUpdate} style={{width: 'auto', padding: '10px 20px'}}>
        Cập nhật
      </button>
    </div>
  );
}

export default ChangePassword;