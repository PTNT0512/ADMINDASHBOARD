import React, { useState, useEffect } from 'react';

function TxRoomPanel({ title, roomType }) {
  const [settings, setSettings] = useState({
    botToken: '',
    groupId: '',
    minBet: 1000,
    maxBet: 10000000,
    botBanker: true,
    feeRate: 2,
    fakeBetEnabled: false,
    fakeBetMinAmount: 10000,
    fakeBetMaxAmount: 500000,
    fakeBetInterval: 15,
    jackpotFeeRate: 5,
    jackpot: 0,
    status: 1,
    bankerSelectionTime: 30,
    bettingTime: 60,
    botBankerAmount: 5000000,
  });
  const [stats, setStats] = useState({ 
    totalProfit: 0, todayProfit: 0, totalGames: 0,
    totalBet: 0, totalFee: 0, todayFee: 0, todayBet: 0
  });
  const [history, setHistory] = useState([]);
  const [addJackpotAmount, setAddJackpotAmount] = useState('');

  const fetchData = async () => {
    if (window.require) {
      const { ipcRenderer } = window.require('electron');
      
      // Settings
      const settingsRes = await ipcRenderer.invoke('get-tx-room-settings', roomType);
      if (settingsRes.success && settingsRes.data) {
        const { _id, __v, ...rest } = settingsRes.data;
        setSettings(prev => ({ ...prev, ...rest }));
      }

      // Stats
      const statsRes = await ipcRenderer.invoke('get-tx-room-stats', roomType);
      if (statsRes.success) setStats(statsRes.data);

      // History
      const historyRes = await ipcRenderer.invoke('get-tx-room-history', roomType);
      if (historyRes.success) setHistory(historyRes.data);
    }
  };

  useEffect(() => {
    fetchData();
  }, [roomType]);

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    if (window.require) {
      const { ipcRenderer } = window.require('electron');
      const result = await ipcRenderer.invoke('save-tx-room-settings', { roomType, data: settings });
      if (result.success) {
        alert('Lưu cấu hình thành công!');
      } else {
        alert('Lỗi: ' + result.message);
      }
    }
  };

  const handleAddJackpot = async () => {
    if (!addJackpotAmount) return;
    if (window.require) {
      const { ipcRenderer } = window.require('electron');
      const result = await ipcRenderer.invoke('add-tx-jackpot', { roomType, amount: addJackpotAmount });
      if (result.success) {
        alert('Đã cộng tiền vào hũ thành công!');
        setAddJackpotAmount('');
        fetchData(); // Tải lại dữ liệu để cập nhật số tiền hũ mới
      } else {
        alert('Lỗi: ' + result.message);
      }
    }
  };

  return (
    <div className="main-content">
      <header><h1>{title}</h1></header>
      
      {/* Settings */}
      <div style={{padding: '24px'}}>
        <header><h1>{title}</h1></header>
        
        {/* Settings */}
        <div className="settings-container" style={{ flex: '0 0 auto' }}>
          <h3>Cấu Hình Room</h3>
          <form onSubmit={handleSaveSettings} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '15px' }}>
            <div className="input-group">
              <label>Bot Token (Bot Trọng Tài)</label>
              <input value={settings.botToken} onChange={e => setSettings({...settings, botToken: e.target.value})} placeholder="Token Bot Telegram" />
            </div>
            <div className="input-group">
              <label>ID Nhóm Telegram</label>
              <input value={settings.groupId} onChange={e => setSettings({...settings, groupId: e.target.value})} placeholder="ID Group Telegram" />
            </div>
            <div className="input-group">
              <label>Cược Tối Thiểu</label>
              <input type="number" value={settings.minBet} onChange={e => setSettings({...settings, minBet: parseInt(e.target.value)})} />
            </div>
            <div className="input-group">
              <label>Cược Tối Đa</label>
              <input type="number" value={settings.maxBet} onChange={e => setSettings({...settings, maxBet: parseInt(e.target.value)})} />
            </div>
            <div className="input-group">
              <label>Tỷ lệ cắt phế (%)</label>
              <input type="number" value={settings.feeRate} onChange={e => setSettings({...settings, feeRate: parseFloat(e.target.value)})} />
            </div>
            <div className="input-group">
              <label>Tỷ lệ góp hũ từ người thắng (%)</label>
              <input type="number" value={settings.jackpotFeeRate} onChange={e => setSettings({...settings, jackpotFeeRate: parseFloat(e.target.value)})} />
            </div>
            <div className="input-group" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
               <label style={{marginBottom: 0}}>Trạng Thái:</label>
               <select value={settings.status} onChange={e => setSettings({...settings, status: parseInt(e.target.value)})} style={{padding: '5px'}}>
                 <option value={1}>Bật</option>
                 <option value={0}>Tắt</option>
               </select>
            </div>
            <div className="input-group">
              <label>Thời gian chọn cái (giây)</label>
              <input type="number" value={settings.bankerSelectionTime} onChange={e => setSettings({...settings, bankerSelectionTime: parseInt(e.target.value)})} />
            </div>
            <div className="input-group">
              <label>Thời gian đặt cược (giây)</label>
              <input type="number" value={settings.bettingTime} onChange={e => setSettings({...settings, bettingTime: parseInt(e.target.value)})} />
            </div>
             <div className="input-group">
              <label>Tiền mặc định khi Bot làm cái</label>
              <input type="number" value={settings.botBankerAmount} onChange={e => setSettings({...settings, botBankerAmount: parseInt(e.target.value)})} />
            </div>

            {/* Fake Bet Section */}
            <div style={{ gridColumn: '1 / -1', borderTop: '1px solid #eee', paddingTop: '15px', marginTop: '10px' }}>
              <h4 style={{ margin: '0 0 10px 0' }}>Cược Ảo (Tạo không khí)</h4>
            </div>
            <div className="input-group" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <label style={{ marginBottom: 0 }}>Trạng thái cược ảo:</label>
              <select value={settings.fakeBetEnabled} onChange={e => setSettings({ ...settings, fakeBetEnabled: e.target.value === 'true' })}>
                <option value={true}>Bật</option>
                <option value={false}>Tắt</option>
              </select>
            </div>
            <div className="input-group">
              <label>Tiền cược ảo (Tối thiểu)</label>
              <input type="number" value={settings.fakeBetMinAmount} onChange={e => setSettings({ ...settings, fakeBetMinAmount: parseInt(e.target.value) })} disabled={!settings.fakeBetEnabled} />
            </div>
            <div className="input-group">
              <label>Tiền cược ảo (Tối đa)</label>
              <input type="number" value={settings.fakeBetMaxAmount} onChange={e => setSettings({ ...settings, fakeBetMaxAmount: parseInt(e.target.value) })} disabled={!settings.fakeBetEnabled} />
            </div>
            <div className="input-group">
              <label>Tần suất trung bình (giây)</label>
              <input type="number" value={settings.fakeBetInterval} onChange={e => setSettings({ ...settings, fakeBetInterval: parseInt(e.target.value) })} disabled={!settings.fakeBetEnabled} />
            </div>
            <button type="submit" style={{ gridColumn: 'span 3', width: 'auto', justifySelf: 'start', padding: '10px 30px' }}>Lưu Cấu Hình</button>
          </form>
        </div>

        {/* Jackpot Manager */}
        <div className="settings-container" style={{ flex: '0 0 auto' }}>
          <h3>Quản Lý Hũ (Jackpot)</h3>
          <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-end' }}>
             <div className="input-group" style={{flex: 1}}>
                <label>Tiền Hũ Hiện Tại</label>
                <div style={{ padding: '10px', background: '#f5f5f5', borderRadius: '4px', fontWeight: 'bold', color: '#d32f2f', border: '1px solid #ddd' }}>
                  {settings.jackpot ? settings.jackpot.toLocaleString() : 0} VNĐ
                </div>
             </div>
             <div className="input-group" style={{flex: 1}}>
                <label>Tặng Tiền Hũ (Cộng thêm)</label>
                <input type="number" value={addJackpotAmount} onChange={e => setAddJackpotAmount(e.target.value)} placeholder="Nhập số tiền..." />
             </div>
             <button type="button" onClick={handleAddJackpot} style={{ height: '42px', marginBottom: '15px', width: 'auto', background: '#e91e63' }}>Thực hiện</button>
          </div>
        </div>

        {/* Stats Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '20px' }}>
          <div style={{ background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', borderLeft: '4px solid #2196f3' }}>
            <div style={{ color: '#666', fontSize: '14px', fontWeight: '500' }}>Tổng Lợi Nhuận</div>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: stats.totalProfit >= 0 ? '#4caf50' : '#f44336' }}>
              {stats.totalProfit.toLocaleString()} VNĐ
            </div>
          </div>
          <div style={{ background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', borderLeft: '4px solid #ff9800' }}>
            <div style={{ color: '#666', fontSize: '14px', fontWeight: '500' }}>Lợi Nhuận Hôm Nay</div>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: stats.todayProfit >= 0 ? '#4caf50' : '#f44336' }}>
              {stats.todayProfit.toLocaleString()} VNĐ
            </div>
          </div>
          <div style={{ background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', borderLeft: '4px solid #9c27b0' }}>
            <div style={{ color: '#666', fontSize: '14px', fontWeight: '500' }}>Tổng Tiền Phế</div>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#333' }}>
              {stats.totalFee.toLocaleString()} VNĐ
            </div>
          </div>
          <div style={{ background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', borderLeft: '4px solid #607d8b' }}>
            <div style={{ color: '#666', fontSize: '14px', fontWeight: '500' }}>Phế Hôm Nay</div>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#333' }}>
              {stats.todayFee.toLocaleString()} VNĐ
            </div>
          </div>
          <div style={{ background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', borderLeft: '4px solid #009688' }}>
            <div style={{ color: '#666', fontSize: '14px', fontWeight: '500' }}>Tổng Cược</div>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#333' }}>
              {stats.totalBet.toLocaleString()} VNĐ
            </div>
          </div>
          <div style={{ background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', borderLeft: '4px solid #9c27b0' }}>
            <div style={{ color: '#666', fontSize: '14px', fontWeight: '500' }}>Tổng Số Ván</div>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#333' }}>
              {stats.totalGames.toLocaleString()}
            </div>
          </div>
        </div>

        {/* History Table */}
        <div className="table-container" style={{flex: 1}}>
          <h3>Lịch Sử Ván Cược</h3>
          <table>
            <thead>
              <tr>
                <th>Phiên</th>
                <th>Thời Gian</th>
                <th>Kết Quả</th>
                <th>Xúc Xắc</th>
                <th>Nhà Cái</th>
                <th>Tổng Cược</th>
                <th>Tiền Phế</th>
                <th>Lợi Nhuận</th>
              </tr>
            </thead>
            <tbody>
              {history.map(item => (
                <tr key={item.id}>
                  <td>#{item.sessionId}</td>
                  <td>{new Date(item.date).toLocaleString('vi-VN')}</td>
                  <td>
                    <span style={{ 
                      fontWeight: 'bold', 
                      color: item.result === 'Tai' ? '#e91e63' : '#3f51b5' 
                    }}>
                      {item.result === 'Tai' ? 'TÀI' : 'XỈU'}
                    </span>
                  </td>
                  <td>{item.dice.join(' - ')}</td>
                  <td>{item.banker}</td>
                  <td>{item.totalBet.toLocaleString()}</td>
                  <td>{item.fee?.toLocaleString()}</td>
                  <td style={{ fontWeight: 'bold', color: item.profit >= 0 ? 'green' : 'red' }}>
                    {item.profit.toLocaleString()}
                  </td>
                </tr>
              ))}
              {history.length === 0 && <tr><td colSpan="8" style={{textAlign: 'center'}}>Chưa có dữ liệu</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default TxRoomPanel;