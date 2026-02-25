import React, { useState, useEffect } from 'react';

function ToolCode() {
  const [codes, setCodes] = useState([]);
  const [form, setForm] = useState({ code: '', amount: '', usageLimit: 1 });

  const fetchCodes = async () => {
    if (window.require) {
      const { ipcRenderer } = window.require('electron');
      const result = await ipcRenderer.invoke('get-giftcodes');
      if (result.success) setCodes(result.data);
    }
  };

  useEffect(() => { fetchCodes(); }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (window.require) {
      const { ipcRenderer } = window.require('electron');
      const result = await ipcRenderer.invoke('create-giftcode', form);
      if (result.success) {
        setForm({ code: '', amount: '', usageLimit: 1 });
        fetchCodes();
      } else {
        alert('Lỗi: ' + result.message);
      }
    }
  };

  const handleDelete = async (id) => {
    if (window.require) {
      const { ipcRenderer } = window.require('electron');
      await ipcRenderer.invoke('delete-giftcode', id);
      fetchCodes();
    }
  };

  const generateRandomCode = () => {
    const random = Math.random().toString(36).substring(2, 10).toUpperCase();
    setForm(prev => ({ ...prev, code: 'GIFT-' + random }));
  };

  return (
    <>
      <header><h1>Tool Phát Code (Giftcode)</h1></header>
      <div className="settings-container" style={{ marginBottom: '20px', flex: '0 0 auto' }}>
        <form onSubmit={handleCreate} style={{ display: 'flex', gap: '10px', alignItems: 'flex-end' }}>
          <div style={{ flex: 1 }}>
            <label style={{display: 'block', marginBottom: '5px', fontSize: '13px'}}>Mã Code</label>
            <div style={{ display: 'flex', gap: '5px' }}>
              <input style={{ width: '100%', padding: '8px' }} value={form.code} onChange={(e) => setForm({...form, code: e.target.value})} placeholder="Nhập mã..." required />
              <button type="button" onClick={generateRandomCode} style={{ width: 'auto', padding: '8px', fontSize: '12px', background: '#607d8b' }}>Random</button>
            </div>
          </div>
          <div style={{ flex: 1 }}>
            <label style={{display: 'block', marginBottom: '5px', fontSize: '13px'}}>Giá trị (VNĐ)</label>
            <input type="number" style={{ width: '100%', padding: '8px' }} value={form.amount} onChange={(e) => setForm({...form, amount: e.target.value})} placeholder="Nhập số tiền..." required />
          </div>
          <div style={{ flex: 0.5 }}>
            <label style={{display: 'block', marginBottom: '5px', fontSize: '13px'}}>Số lượng</label>
            <input type="number" style={{ width: '100%', padding: '8px' }} value={form.usageLimit} onChange={(e) => setForm({...form, usageLimit: e.target.value})} placeholder="1" required />
          </div>
          <button type="submit" style={{ width: 'auto', padding: '8px 20px', height: '35px' }}>Tạo Code</button>
        </form>
      </div>
      <div className="table-container">
        <table>
          <thead><tr><th>Mã Code</th><th>Giá trị</th><th>Lượt dùng</th><th>Trạng thái</th><th>Ngày tạo</th><th>Hành động</th></tr></thead>
          <tbody>{codes.map(item => (
            <tr key={item.id}>
              <td style={{ fontWeight: 'bold', color: '#e91e63' }}>{item.code}</td>
              <td style={{ fontWeight: 'bold' }}>{item.amount?.toLocaleString()}</td>
              <td>{item.usedCount || 0} / {item.usageLimit || 1}</td>
              <td>{item.status === 1 ? <span style={{color: 'green', fontWeight: 'bold'}}>Hoạt động</span> : <span style={{color: 'gray'}}>Đã hết</span>}</td>
              <td>{new Date(item.date).toLocaleDateString('vi-VN')}</td>
              <td><button className="delete-btn" onClick={() => handleDelete(item.id)}>Xóa</button></td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </>
  );
}

export default ToolCode;