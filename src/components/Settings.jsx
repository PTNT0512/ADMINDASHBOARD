import React from 'react';

function Settings({ settings, onSettingChange, onSaveSettings, onOptimizeNow }) {
  const resourceOptimizer = settings?.resourceOptimizer || {};
  const maintenanceSchedule = settings?.maintenanceSchedule || {};

  return (
    <>
      <header>
        <h1>Cai dat he thong</h1>
      </header>
      <div className="settings-container">
        <div className="input-group">
          <label>Ten mien (Domain)</label>
          <input type="text" name="domain" value={settings.domain || ''} onChange={onSettingChange} placeholder="example.com" />
        </div>
        <div className="input-group">
          <label>ID Nhom He Thong</label>
          <input type="text" name="systemGroupId" value={settings.systemGroupId || ''} onChange={onSettingChange} placeholder="-100..." />
        </div>
        <div className="input-group">
          <label>ID Nhom Nap Rut</label>
          <input type="text" name="bankingGroupId" value={settings.bankingGroupId || ''} onChange={onSettingChange} placeholder="-100..." />
        </div>
        <div className="input-group">
          <label>Nap toi thieu (VND)</label>
          <input type="number" name="minDeposit" value={settings.minDeposit ?? ''} onChange={onSettingChange} placeholder="20000" />
        </div>
        <div className="input-group">
          <label>Nap toi da (VND)</label>
          <input type="number" name="maxDeposit" value={settings.maxDeposit ?? ''} onChange={onSettingChange} placeholder="500000000" />
        </div>
        <div className="input-group">
          <label>Rut toi thieu (VND)</label>
          <input type="number" name="minWithdraw" value={settings.minWithdraw ?? ''} onChange={onSettingChange} placeholder="50000" />
        </div>
        <div className="input-group">
          <label>Rut toi da (VND)</label>
          <input type="number" name="maxWithdraw" value={settings.maxWithdraw ?? ''} onChange={onSettingChange} placeholder="100000000" />
        </div>
        <div className="input-group">
          <label>So lan rut toi da / ngay</label>
          <input type="number" name="maxWithdrawalsPerDay" value={settings.maxWithdrawalsPerDay ?? ''} onChange={onSettingChange} placeholder="3" />
        </div>
        <div className="input-group">
          <label>Vong cuoc yeu cau (x lan nap)</label>
          <input type="number" name="withdrawWageringReq" value={settings.withdrawWageringReq ?? ''} onChange={onSettingChange} placeholder="1" />
        </div>
        <div className="input-group">
          <label>Link anh Menu Game</label>
          <input type="text" name="gameListImage" value={settings.gameListImage || ''} onChange={onSettingChange} placeholder="https://i.imgur.com/..." />
        </div>
        <div className="input-group">
          <label>Partner ID (Nap the)</label>
          <input type="text" name="partnerId" value={settings.partnerId || ''} onChange={onSettingChange} placeholder="Partner ID..." />
        </div>
        <div className="input-group">
          <label>Partner Key (Nap the)</label>
          <input type="text" name="partnerKey" value={settings.partnerKey || ''} onChange={onSettingChange} placeholder="Partner Key..." />
        </div>
        <div className="input-group">
          <label>Chiet khau the cao (%)</label>
          <input type="number" name="cardFee" value={settings.cardFee ?? 0} onChange={onSettingChange} placeholder="Vi du: 20" />
        </div>

        <div className="input-group" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <input
            type="checkbox"
            name="enableSound"
            checked={!!settings.enableSound}
            onChange={onSettingChange}
            style={{ width: 'auto' }}
          />
          <label style={{ marginBottom: 0 }}>Bat am thanh thong bao (Loi)</label>
        </div>

        <div className="input-group" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <input
            type="checkbox"
            name="maintenanceDeposit"
            checked={!!settings.maintenanceDeposit}
            onChange={onSettingChange}
            style={{ width: 'auto' }}
          />
          <label style={{ marginBottom: 0 }}>Bao tri nap tien (thu cong)</label>
        </div>
        <div className="input-group" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <input
            type="checkbox"
            name="maintenanceWithdraw"
            checked={!!settings.maintenanceWithdraw}
            onChange={onSettingChange}
            style={{ width: 'auto' }}
          />
          <label style={{ marginBottom: 0 }}>Bao tri rut tien (thu cong)</label>
        </div>
        <div className="input-group" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <input
            type="checkbox"
            name="maintenanceSystem"
            checked={!!settings.maintenanceSystem}
            onChange={onSettingChange}
            style={{ width: 'auto' }}
          />
          <label style={{ marginBottom: 0 }}>Bao tri he thong (thu cong)</label>
        </div>

        <hr style={{ width: '100%', margin: '18px 0', border: 'none', borderTop: '1px solid #e2e8f0' }} />
        <h3 style={{ marginBottom: '8px' }}>Toi uu RAM / CPU</h3>
        <div className="input-group" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <input
            type="checkbox"
            name="resourceOptimizer.enabled"
            checked={!!resourceOptimizer.enabled}
            onChange={onSettingChange}
            style={{ width: 'auto' }}
          />
          <label style={{ marginBottom: 0 }}>Bat toi uu tu dong</label>
        </div>
        <div className="input-group">
          <label>Chu ky kiem tra (giay)</label>
          <input
            type="number"
            name="resourceOptimizer.checkIntervalSec"
            value={resourceOptimizer.checkIntervalSec ?? 20}
            onChange={onSettingChange}
            min={5}
            max={300}
          />
        </div>
        <div className="input-group">
          <label>Nguong CPU (%)</label>
          <input
            type="number"
            name="resourceOptimizer.highCpuPercent"
            value={resourceOptimizer.highCpuPercent ?? 85}
            onChange={onSettingChange}
            min={40}
            max={100}
          />
        </div>
        <div className="input-group">
          <label>Nguong RAM (%)</label>
          <input
            type="number"
            name="resourceOptimizer.highRamPercent"
            value={resourceOptimizer.highRamPercent ?? 85}
            onChange={onSettingChange}
            min={40}
            max={100}
          />
        </div>
        <div className="input-group">
          <label>FPS khi an/minimize</label>
          <input
            type="number"
            name="resourceOptimizer.hiddenFps"
            value={resourceOptimizer.hiddenFps ?? 15}
            onChange={onSettingChange}
            min={1}
            max={60}
          />
        </div>
        <div className="input-group">
          <label>Cooldown clear cache (giay)</label>
          <input
            type="number"
            name="resourceOptimizer.clearCacheCooldownSec"
            value={resourceOptimizer.clearCacheCooldownSec ?? 300}
            onChange={onSettingChange}
            min={30}
            max={3600}
          />
        </div>
        <button onClick={onOptimizeNow} style={{ marginTop: '6px', width: 'auto', padding: '10px 24px' }}>
          Toi uu ngay bay gio
        </button>

        <hr style={{ width: '100%', margin: '18px 0', border: 'none', borderTop: '1px solid #e2e8f0' }} />
        <h3 style={{ marginBottom: '8px' }}>Bao tri theo khung gio</h3>
        <div className="input-group" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <input
            type="checkbox"
            name="maintenanceSchedule.enabled"
            checked={!!maintenanceSchedule.enabled}
            onChange={onSettingChange}
            style={{ width: 'auto' }}
          />
          <label style={{ marginBottom: 0 }}>Bat lich bao tri tu dong</label>
        </div>
        <div className="input-group">
          <label>Gio bat dau</label>
          <input
            type="time"
            name="maintenanceSchedule.startTime"
            value={maintenanceSchedule.startTime || '02:00'}
            onChange={onSettingChange}
          />
        </div>
        <div className="input-group">
          <label>Gio ket thuc</label>
          <input
            type="time"
            name="maintenanceSchedule.endTime"
            value={maintenanceSchedule.endTime || '03:00'}
            onChange={onSettingChange}
          />
        </div>
        <div className="input-group">
          <label>Timezone</label>
          <input
            type="text"
            name="maintenanceSchedule.timezone"
            value={maintenanceSchedule.timezone || 'Asia/Ho_Chi_Minh'}
            onChange={onSettingChange}
            placeholder="Asia/Ho_Chi_Minh"
          />
        </div>
        <div className="input-group" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <input
            type="checkbox"
            name="maintenanceSchedule.applySystem"
            checked={!!maintenanceSchedule.applySystem}
            onChange={onSettingChange}
            style={{ width: 'auto' }}
          />
          <label style={{ marginBottom: 0 }}>Ap dung cho he thong</label>
        </div>
        <div className="input-group" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <input
            type="checkbox"
            name="maintenanceSchedule.applyDeposit"
            checked={!!maintenanceSchedule.applyDeposit}
            onChange={onSettingChange}
            style={{ width: 'auto' }}
          />
          <label style={{ marginBottom: 0 }}>Ap dung cho nap tien</label>
        </div>
        <div className="input-group" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <input
            type="checkbox"
            name="maintenanceSchedule.applyWithdraw"
            checked={!!maintenanceSchedule.applyWithdraw}
            onChange={onSettingChange}
            style={{ width: 'auto' }}
          />
          <label style={{ marginBottom: 0 }}>Ap dung cho rut tien</label>
        </div>
        <div className="input-group">
          <label>Trang thai lich hien tai</label>
          <input type="text" value={maintenanceSchedule.runtimeActive ? 'Dang active' : 'Dang tat'} disabled />
        </div>

        <button onClick={onSaveSettings} style={{ marginTop: '10px', width: 'auto', padding: '10px 30px' }}>
          Luu cai dat
        </button>
      </div>
    </>
  );
}

export default Settings;
