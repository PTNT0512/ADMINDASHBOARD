import React, { useState } from 'react';

function Gift() {
  const [userId, setUserId] = useState('');
  const [giftData, setGiftData] = useState({
    spinCount: 0,
    dailyPoints: 0,
    spinlucky: 0
  });
  const [message, setMessage] = useState('');

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setGiftData({ ...giftData, [name]: parseInt(value) || 0 });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!userId) return setMessage('Vui lòng nhập User ID');

    if (window.require) {
      try {
        const { ipcRenderer } = window.require('electron');
        const result = await ipcRenderer.invoke('send-gift', { userId, giftData });
        if (result.success) {
          setMessage('Tặng quà thành công!');
          setGiftData({ spinCount: 0, dailyPoints: 0, spinlucky: 0 });
        } else {
          setMessage('Lỗi: ' + result.message);
        }
      } catch (error) {
        setMessage('Lỗi hệ thống');
      }
    }
  };

  return (
    <>
      <header><h1>Tặng Quà Thành Viên</h1></header>
      <div className="settings-container">
        <form onSubmit={handleSubmit}>
          <div className="input-group">
            <label>User ID</label>
            <input type="number" value={userId} onChange={(e) => setUserId(e.target.value)} placeholder="Nhập ID người nhận..." />
          </div>
          <div className="input-group">
            <label>Lượt quay (Spin)</label>
            <input type="number" name="spinCount" value={giftData.spinCount} onChange={handleInputChange} />
          </div>
          <div className="input-group">
            <label>Điểm danh (Daily Points)</label>
            <input type="number" name="dailyPoints" value={giftData.dailyPoints} onChange={handleInputChange} />
          </div>
          <div className="input-group">
            <label>Vòng quay may mắn (Lucky)</label>
            <input type="number" name="spinlucky" value={giftData.spinlucky} onChange={handleInputChange} />
          </div>
          <button type="submit" style={{ marginTop: '10px', width: 'auto', padding: '10px 30px' }}>Gửi Quà</button>
          {message && <p style={{ marginTop: '10px', color: message.includes('Lỗi') ? 'red' : 'green' }}>{message}</p>}
        </form>
      </div>
    </>
  );
}

export default Gift;