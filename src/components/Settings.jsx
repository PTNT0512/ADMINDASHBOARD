import React from 'react';
import UpdateChecker from './UpdateChecker';

function Settings({ settings, onSettingChange, onSaveSettings }) {
  return (
    <>
      <header>
        <h1>Cài đặt hệ thống</h1>
      </header>
      <div className="settings-container">
        <div className="input-group">
          <label>Tên miền (Domain)</label>
          <input type="text" name="domain" value={settings.domain} onChange={onSettingChange} placeholder="example.com" />
        </div>
        <div className="input-group">
          <label>ID Nhóm Hệ Thống</label>
          <input type="text" name="systemGroupId" value={settings.systemGroupId} onChange={onSettingChange} placeholder="-100..." />
        </div>
        <div className="input-group">
          <label>ID Nhóm Nạp Rút</label>
          <input type="text" name="bankingGroupId" value={settings.bankingGroupId} onChange={onSettingChange} placeholder="-100..." />
        </div>
        <div className="input-group" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <input 
            type="checkbox" 
            name="enableSound" 
            checked={settings.enableSound} 
            onChange={onSettingChange} 
            style={{ width: 'auto' }} 
          />
          <label style={{ marginBottom: 0 }}>Bật âm thanh thông báo (Lỗi)</label>
        </div>
        <button onClick={onSaveSettings} style={{ marginTop: '10px', width: 'auto', padding: '10px 30px' }}>Lưu Cài Đặt</button>

        <div style={{ marginTop: '30px', borderTop: '1px solid #eee', paddingTop: '20px' }}>
          <UpdateChecker />
        </div>
      </div>
    </>
  );
}

export default Settings;