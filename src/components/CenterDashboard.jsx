import React, { useState } from 'react';
import LicenseManager from './LicenseManager';
import AdminManager from './AdminManager';
import ActivationLogViewer from './ActivationLogViewer';

function CenterDashboard({ onLogout }) {
  const [activeTab, setActiveTab] = useState('license');
  const iconStyle = { marginRight: '10px', width: '20px', textAlign: 'center' };

  return (
    <div className="dashboard-layout">
      <aside className="sidebar">
        <h3><i className="fas fa-shield-alt" style={{marginRight: '10px'}}></i>Center</h3>
        <ul style={{ flex: 1 }}>
          <li 
            className={activeTab === 'license' ? 'active' : ''} 
            onClick={() => setActiveTab('license')}
          >
            <i className="fas fa-key" style={iconStyle}></i>
            <span>Quản lý License</span>
          </li>
          <li 
            className={activeTab === 'admins' ? 'active' : ''} 
            onClick={() => setActiveTab('admins')}
          >
            <i className="fas fa-user-shield" style={iconStyle}></i>
            <span>Quản lý Admin</span>
          </li>
          <li 
            className={activeTab === 'activation_logs' ? 'active' : ''} 
            onClick={() => setActiveTab('activation_logs')}
          >
            <i className="fas fa-history" style={iconStyle}></i>
            <span>Nhật ký Kích hoạt</span>
          </li>
        </ul>
        
        <ul style={{ borderTop: '1px solid rgba(15,23,42,0.03)' }}>
          <li>
            <button className="btn secondary" onClick={onLogout} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <i className="fas fa-sign-out-alt" style={iconStyle}></i>
              <span>Đăng xuất hệ thống</span>
            </button>
          </li>
        </ul>
      </aside>

      <main className="dashboard-content">
        {activeTab === 'license' && <LicenseManager onLogout={onLogout} isEmbedded={true} />}
        {activeTab === 'admins' && <AdminManager />}
        {activeTab === 'activation_logs' && <ActivationLogViewer />}
      </main>
    </div>
  );
}

export default CenterDashboard;