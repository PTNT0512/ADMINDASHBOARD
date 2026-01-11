import React, { useState, useEffect } from 'react';

function BanList() {
  const [bannedUsers, setBannedUsers] = useState([]);

  const fetchBannedUsers = async () => {
    if (window.require) {
      const { ipcRenderer } = window.require('electron');
      const result = await ipcRenderer.invoke('get-banned-users');
      if (result.success) setBannedUsers(result.data);
    }
  };

  useEffect(() => { fetchBannedUsers(); }, []);

  const handleUnlock = async (userId) => {
    if (window.require) {
      const { ipcRenderer } = window.require('electron');
      const result = await ipcRenderer.invoke('unlock-user', userId);
      if (result.success) {
        alert('Đã mở khóa thành công!');
        fetchBannedUsers();
      } else {
        alert('Lỗi: ' + result.message);
      }
    }
  };

  return (
    <>
      <header><h1>Danh Sách Cấm (Ban List)</h1></header>
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>User ID</th>
              <th>Số dư</th>
              <th>Trạng thái</th>
              <th>Hành động</th>
            </tr>
          </thead>
          <tbody>
            {bannedUsers.length > 0 ? bannedUsers.map(user => (
              <tr key={user.id}>
                <td>{user.userId}</td>
                <td>{user.balance?.toLocaleString()}</td>
                <td style={{ color: 'red', fontWeight: 'bold' }}>Locked</td>
                <td>
                  <button className="edit-btn" onClick={() => handleUnlock(user.userId)} style={{ color: 'green', borderColor: 'green' }}>Mở khóa</button>
                </td>
              </tr>
            )) : <tr><td colSpan="4" style={{textAlign: 'center', padding: '20px'}}>Không có tài khoản bị khóa</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}

export default BanList;