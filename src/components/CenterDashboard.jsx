import React, { useState, useEffect } from 'react';
import LicenseManager from './LicenseManager';
import { useIpc, useToast } from './ToastContext';

function CenterDashboard({ onLogout }) {
  const [activeTab, setActiveTab] = useState('license');
  const iconStyle = { marginRight: '10px', width: '20px', textAlign: 'center' };

  return (
    <div className="admin-container">
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

      <main className="content">
        {activeTab === 'license' && <LicenseManager onLogout={onLogout} isEmbedded={true} />}
        {activeTab === 'admins' && <AdminManager />}
        {activeTab === 'activation_logs' && <ActivationLogViewer />}
      </main>
    </div>
  );
}

function AdminManager() {
  const [admins, setAdmins] = useState([]);
  const [form, setForm] = useState({ username: '', password: '', role: 'admin' });
  const { invoke } = useIpc();
  const { showToast } = useToast();

  const fetchAdmins = async () => {
    const res = await invoke('get-admins');
    if (res.success) setAdmins(res.data);
  };

  useEffect(() => { fetchAdmins(); }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    const res = await invoke('create-admin', form);
    if (res.success) {
      showToast('Tạo tài khoản Admin thành công', 'success');
      setForm({ username: '', password: '', role: 'admin' });
      fetchAdmins();
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Xác nhận xóa quyền truy cập của Admin này?')) return;
    const res = await invoke('delete-admin', id);
    if (res.success) {
      showToast('Đã xóa tài khoản', 'success');
      fetchAdmins();
    }
  };

  return (
    <div className="main-content">
      <header><h1><i className="fas fa-user-shield" style={{marginRight: '15px'}}></i>Quản Lý Nhân Sự Admin</h1></header>
      <div style={{padding: '24px'}}>
        <div className="settings-container">
          <h3>Cấp Quyền Truy Cập Mới</h3>
          <form onSubmit={handleCreate} style={{ display: 'flex', gap: '15px', alignItems: 'flex-end' }}>
            <div className="input-group" style={{flex: 1}}>
              <label>Username</label>
              <input value={form.username} onChange={e => setForm({...form, username: e.target.value})} required />
            </div>
            <div className="input-group" style={{flex: 1}}>
              <label>Password</label>
              <input type="password" value={form.password} onChange={e => setForm({...form, password: e.target.value})} required />
            </div>
            <div className="input-group" style={{flex: 1}}>
              <label>Vai trò</label>
              <select value={form.role} onChange={e => setForm({...form, role: e.target.value})}>
                <option value="admin">Admin (Quản lý Game)</option>
                <option value="superadmin">Superadmin (Toàn quyền)</option>
              </select>
            </div>
            <button type="submit" style={{width: 'auto', padding: '10px 25px', marginBottom: '15px'}}>Cấp Quyền</button>
          </form>
        </div>

        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Tên đăng nhập</th>
                <th>Vai trò</th>
                <th>Trạng thái</th>
                <th>Hành động</th>
              </tr>
            </thead>
            <tbody>
              {admins.map(admin => (
                <tr key={admin.id}>
                    <td style={{fontWeight: 'bold', color: 'var(--primary)'}}>{admin.username}</td>
                  <td>{admin.role === 'superadmin' ? '🔴 Superadmin' : '🟢 Admin'}</td>
                  <td>{admin.isFirstLogin ? 'Chưa đổi pass' : 'Đã kích hoạt'}</td>
                  <td>
                    {admin.username !== 'admincenter' && (
                      <button className="delete-btn" onClick={() => handleDelete(admin.id)}>Thu hồi quyền</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function ActivationLogViewer() {
  const [logs, setLogs] = useState([]);
  const { invoke } = useIpc();

  const fetchLogs = async () => {
    const res = await invoke('get-activation-logs');
    if (res.success) setLogs(res.data);
  };

  useEffect(() => { fetchLogs(); }, []);

  return (
    <div className="main-content">
      <header><h1><i className="fas fa-history" style={{marginRight: '15px'}}></i>Nhật Ký Kích Hoạt Bản Quyền</h1></header>
      <div style={{padding: '24px'}}>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Thời gian</th>
                <th>Mã Key</th>
                <th>ID Máy</th>
                <th>Trạng thái</th>
                <th>Lý do / Ghi chú</th>
              </tr>
            </thead>
            <tbody>
              {logs.map(log => (
                <tr key={log.id}>
                  <td>{new Date(log.date).toLocaleString('vi-VN')}</td>
                  <td style={{ fontFamily: 'monospace' }}>{log.key}</td>
                  <td style={{ fontFamily: 'monospace', fontSize: '11px' }}>{log.machineId?.substring(0, 20)}...</td>
                  <td>
                    <span style={{ color: log.status === 'SUCCESS' ? 'var(--success)' : 'var(--danger)', fontWeight: 'bold' }}>
                      {log.status}
                    </span>
                  </td>
                  <td>{log.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default CenterDashboard;