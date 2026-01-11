import React, { useState, useEffect } from 'react';

function Blacklist() {
  const [list, setList] = useState([]);
  const [value, setValue] = useState('');
  const [reason, setReason] = useState('');

  const fetchBlacklist = async () => {
    if (window.require) {
      const { ipcRenderer } = window.require('electron');
      const result = await ipcRenderer.invoke('get-blacklist');
      if (result.success) setList(result.data);
    }
  };

  useEffect(() => { fetchBlacklist(); }, []);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (window.require) {
      const { ipcRenderer } = window.require('electron');
      const result = await ipcRenderer.invoke('add-blacklist', { value, reason });
      if (result.success) {
        setValue('');
        setReason('');
        fetchBlacklist();
      } else {
        alert('Lỗi: ' + result.message);
      }
    }
  };

  const handleDelete = async (id) => {
    if (window.require) {
      const { ipcRenderer } = window.require('electron');
      await ipcRenderer.invoke('delete-blacklist', id);
      fetchBlacklist();
    }
  };

  return (
    <>
      <header><h1>Danh Sách Đen (Blacklist)</h1></header>
      <div className="settings-container" style={{ marginBottom: '20px', flex: '0 0 auto' }}>
        <h3>Thêm mới</h3>
        <form onSubmit={handleAdd} style={{ display: 'flex', gap: '10px', alignItems: 'flex-end' }}>
          <div style={{ flex: 1 }}>
            <label style={{display: 'block', marginBottom: '5px', fontSize: '13px'}}>IP / Tài khoản</label>
            <input style={{ width: '100%', padding: '8px' }} value={value} onChange={(e) => setValue(e.target.value)} placeholder="Nhập giá trị..." required />
          </div>
          <div style={{ flex: 2 }}>
            <label style={{display: 'block', marginBottom: '5px', fontSize: '13px'}}>Lý do</label>
            <input style={{ width: '100%', padding: '8px' }} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Nhập lý do..." />
          </div>
          <button type="submit" style={{ width: 'auto', padding: '8px 20px', height: '35px' }}>Thêm</button>
        </form>
      </div>
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Giá trị</th>
              <th>Lý do</th>
              <th>Ngày tạo</th>
              <th>Hành động</th>
            </tr>
          </thead>
          <tbody>
            {list.map(item => (
              <tr key={item.id}>
                <td>{item.value}</td>
                <td>{item.reason}</td>
                <td>{new Date(item.date).toLocaleDateString('vi-VN')}</td>
                <td>
                  <button className="delete-btn" onClick={() => handleDelete(item.id)}>Xóa</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

export default Blacklist;