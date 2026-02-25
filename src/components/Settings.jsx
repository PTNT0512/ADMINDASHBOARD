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
        <div className="input-group">
          <label>Nạp tối thiểu (VNĐ)</label>
          <input type="number" name="minDeposit" value={settings.minDeposit} onChange={onSettingChange} placeholder="20000" />
        </div>
        <div className="input-group">
          <label>Nạp tối đa (VNĐ)</label>
          <input type="number" name="maxDeposit" value={settings.maxDeposit} onChange={onSettingChange} placeholder="500000000" />
        </div>
        <div className="input-group">
          <label>Rút tối thiểu (VNĐ)</label>
          <input type="number" name="minWithdraw" value={settings.minWithdraw} onChange={onSettingChange} placeholder="50000" />
        </div>
        <div className="input-group">
          <label>Rút tối đa (VNĐ)</label>
          <input type="number" name="maxWithdraw" value={settings.maxWithdraw} onChange={onSettingChange} placeholder="100000000" />
        </div>
        <div className="input-group">
          <label>Số lần rút tối đa / ngày</label>
          <input type="number" name="maxWithdrawalsPerDay" value={settings.maxWithdrawalsPerDay} onChange={onSettingChange} placeholder="3" />
        </div>
        <div className="input-group">
          <label>Vòng cược yêu cầu (x lần nạp)</label>
          <input type="number" name="withdrawWageringReq" value={settings.withdrawWageringReq} onChange={onSettingChange} placeholder="1" />
        </div>
        <div className="input-group">
          <label>Link ảnh Menu Game</label>
          <input type="text" name="gameListImage" value={settings.gameListImage} onChange={onSettingChange} placeholder="https://i.imgur.com/..." />
        </div>
        <div className="input-group">
          <label>Partner ID (Nạp thẻ)</label>
          <input type="text" name="partnerId" value={settings.partnerId || ''} onChange={onSettingChange} placeholder="Partner ID..." />
        </div>
        <div className="input-group">
          <label>Partner Key (Nạp thẻ)</label>
          <input type="text" name="partnerKey" value={settings.partnerKey || ''} onChange={onSettingChange} placeholder="Partner Key..." />
        </div>
        <div className="input-group">
          <label>Chiết khấu thẻ cào (%)</label>
          <input type="number" name="cardFee" value={settings.cardFee || 0} onChange={onSettingChange} placeholder="Ví dụ: 20" />
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
        <div className="input-group" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <input 
            type="checkbox" 
            name="maintenanceDeposit" 
            checked={settings.maintenanceDeposit} 
            onChange={onSettingChange} 
            style={{ width: 'auto' }} 
          />
          <label style={{ marginBottom: 0 }}>Bảo trì nạp tiền</label>
        </div>
        <div className="input-group" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <input 
            type="checkbox" 
            name="maintenanceWithdraw" 
            checked={settings.maintenanceWithdraw} 
            onChange={onSettingChange} 
            style={{ width: 'auto' }} 
          />
          <label style={{ marginBottom: 0 }}>Bảo trì rút tiền</label>
        </div>
        <div className="input-group" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <input 
            type="checkbox" 
            name="maintenanceSystem" 
            checked={settings.maintenanceSystem} 
            onChange={onSettingChange} 
            style={{ width: 'auto' }} 
          />
          <label style={{ marginBottom: 0 }}>Bảo trì hệ thống (Nâng cấp)</label>
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