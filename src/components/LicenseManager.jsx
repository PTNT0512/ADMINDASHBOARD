import React, { useEffect, useMemo, useState } from 'react';
import { useIpc, useToast } from './ToastContext';

function LicenseManager({ onLogout, isEmbedded = false }) {
  const [licenses, setLicenses] = useState([]);
  const [clientName, setClientName] = useState('');
  const [duration, setDuration] = useState(30);
  const [allowGithubUpdates, setAllowGithubUpdates] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [renewingId, setRenewingId] = useState(null);
  const [daysToRenew, setDaysToRenew] = useState(30);
  const [sortType, setSortType] = useState('expiry');
  const { invoke } = useIpc();
  const { showToast } = useToast();

  const fetchLicenses = async () => {
    const result = await invoke('get-licenses');
    if (result?.success) {
      setLicenses(Array.isArray(result.data) ? result.data : []);
    }
  };

  useEffect(() => {
    fetchLicenses();
  }, []);

  const handleCreate = async () => {
    if (!clientName.trim()) {
      showToast('Vui long nhap ten khach hang', 'error');
      return;
    }

    const result = await invoke('create-license', {
      clientName: clientName.trim(),
      durationDays: duration,
      allowGithubUpdates,
    });

    if (!result?.success) {
      showToast(result?.message || 'Khong tao duoc key', 'error');
      return;
    }

    showToast('Tao key thanh cong', 'success');
    setClientName('');
    setDuration(30);
    setAllowGithubUpdates(true);
    fetchLicenses();
  };

  const handleRenew = async (id) => {
    if (!daysToRenew || Number(daysToRenew) <= 0) {
      showToast('So ngay khong hop le', 'error');
      return;
    }

    const result = await invoke('renew-license', { id, additionalDays: Number(daysToRenew) });
    if (!result?.success) {
      showToast(result?.message || 'Khong gia han duoc key', 'error');
      return;
    }

    showToast('Gia han thanh cong', 'success');
    setRenewingId(null);
    fetchLicenses();
  };

  const handleCopyKey = async (key) => {
    try {
      await navigator.clipboard.writeText(key);
      showToast('Da sao chep key', 'success');
    } catch (error) {
      showToast(error.message || 'Khong sao chep duoc key', 'error');
    }
  };

  const handleResetMachine = async (id) => {
    if (!window.confirm('Ban co chac muon reset ID may cho key nay?')) return;
    const result = await invoke('reset-license-machine', id);
    if (result?.success) {
      showToast('Da reset machine ID', 'success');
      fetchLicenses();
    } else {
      showToast(result?.message || 'Khong reset duoc machine ID', 'error');
    }
  };

  const handleToggleStatus = async (id, currentStatus) => {
    const result = await invoke('toggle-license-status', { id, isActive: !currentStatus });
    if (result?.success) {
      fetchLicenses();
    } else {
      showToast(result?.message || 'Khong doi duoc trang thai key', 'error');
    }
  };

  const handleToggleGithubUpdates = async (id, currentValue) => {
    const result = await invoke('toggle-license-github-updates', {
      id,
      allowGithubUpdates: !currentValue,
    });
    if (result?.success) {
      showToast(!currentValue ? 'Da mo quyen update GitHub' : 'Da khoa quyen update GitHub', 'success');
      fetchLicenses();
    } else {
      showToast(result?.message || 'Khong doi duoc quyen update GitHub', 'error');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Xoa vinh vien key nay?')) return;
    const result = await invoke('delete-license', id);
    if (result?.success) {
      showToast('Da xoa key', 'success');
      fetchLicenses();
    } else {
      showToast(result?.message || 'Khong xoa duoc key', 'error');
    }
  };

  const getRemainingTime = (expiryDate) => {
    if (!expiryDate) return { text: 'Vinh vien', color: '#16a34a' };

    const now = new Date();
    const expiry = new Date(expiryDate);
    const diffDays = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays <= 0) return { text: 'Het han', color: '#dc2626' };
    if (diffDays <= 7) return { text: 'Con ' + diffDays + ' ngay', color: '#d97706' };
    return { text: 'Con ' + diffDays + ' ngay', color: '#0f172a' };
  };

  const filteredLicenses = useMemo(() => {
    return [...licenses]
      .filter((item) => {
        const keyword = searchTerm.trim().toLowerCase();
        if (!keyword) return true;
        return String(item.clientName || '').toLowerCase().includes(keyword)
          || String(item.key || '').toLowerCase().includes(keyword);
      })
      .sort((a, b) => {
        if (sortType === 'name') {
          return String(a.clientName || '').localeCompare(String(b.clientName || ''), 'vi');
        }

        if (!a.expiryDate && !b.expiryDate) return 0;
        if (!a.expiryDate) return 1;
        if (!b.expiryDate) return -1;
        return new Date(a.expiryDate) - new Date(b.expiryDate);
      });
  }, [licenses, searchTerm, sortType]);

  return (
    <div className="license-manager" style={isEmbedded ? { background: 'transparent', padding: '24px', minHeight: 'auto' } : {}}>
      <style>{`
        .license-manager { padding: 25px; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #f8f9fa; min-height: 100vh; }
        .license-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px; background: #fff; padding: 15px 25px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.05); }
        .license-header h1 { margin: 0; color: #2c3e50; font-size: 24px; }
        .create-license-box { background: #fff; padding: 20px; border-radius: 12px; margin-bottom: 25px; box-shadow: 0 4px 6px rgba(0,0,0,0.05); }
        .input-row { display: flex; gap: 15px; align-items: center; flex-wrap: wrap; }
        .input-row input { padding: 10px 15px; border: 1px solid #ddd; border-radius: 8px; outline: none; transition: border 0.3s; }
        .input-row input:focus { border-color: #3498db; }
        .btn-create { background: #3498db; color: #fff; border: none; padding: 10px 25px; border-radius: 8px; cursor: pointer; font-weight: 600; transition: background 0.3s; }
        .btn-create:hover { background: #2980b9; }
        .search-bar { margin-bottom: 20px; width: 100%; max-width: 400px; padding: 10px 15px; border-radius: 8px; border: 1px solid #ddd; }
        .sort-controls { margin-bottom: 20px; display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
        .btn-sort { background: #fff; border: 1px solid #ddd; padding: 8px 15px; border-radius: 8px; cursor: pointer; font-size: 14px; transition: all 0.3s; color: #7f8c8d; }
        .btn-sort.active { background: #3498db; color: white; border-color: #3498db; font-weight: 600; }
        .license-table { width: 100%; border-collapse: separate; border-spacing: 0 10px; }
        .license-table th { padding: 15px; text-align: left; color: #7f8c8d; font-weight: 600; border-bottom: 2px solid #eee; }
        .license-table tr { background: #fff; transition: transform 0.2s; }
        .license-table tr:hover { transform: scale(1.005); box-shadow: 0 5px 15px rgba(0,0,0,0.05); }
        .license-table td { padding: 15px; border-top: 1px solid #f1f1f1; border-bottom: 1px solid #f1f1f1; }
        .license-table td:first-child { border-left: 1px solid #f1f1f1; border-top-left-radius: 10px; border-bottom-left-radius: 10px; }
        .license-table td:last-child { border-right: 1px solid #f1f1f1; border-top-right-radius: 10px; border-bottom-right-radius: 10px; }
        .key-text { font-family: monospace; background: #f1f2f6; padding: 4px 8px; border-radius: 4px; color: #e67e22; font-weight: bold; cursor: pointer; transition: all 0.2s; }
        .key-text:hover { background: #e1e2e6; color: #d35400; }
        .status-badge { display: inline-flex; align-items: center; justify-content: center; padding: 5px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; text-transform: uppercase; }
        .status-badge.active { background: #eafff1; color: #2ecc71; }
        .status-badge.locked { background: #fff0f0; color: #e74c3c; }
        .status-badge.update-on { background: #eefbf3; color: #15803d; }
        .status-badge.update-off { background: #fff7ed; color: #c2410c; }
        .actions { display: flex; gap: 8px; flex-wrap: wrap; }
        .actions button { border: none; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 500; transition: all 0.2s; color: #fff; }
        .btn-renew { background: #3498db; }
        .btn-reset { background: #f39c12; }
        .btn-toggle { background: #95a5a6; }
        .btn-git { background: #7c3aed; }
        .btn-delete { background: #e74c3c; }
        .actions button:hover { opacity: 0.85; transform: translateY(-1px); }
        .renew-popover { position: absolute; background: #fff; border: 1px solid #ddd; padding: 10px; border-radius: 8px; box-shadow: 0 10px 25px rgba(0,0,0,0.1); z-index: 10; display: flex; gap: 5px; }
        .renew-popover input { width: 70px; padding: 5px; }
        .logout-btn { background: #2c3e50; color: #fff; border: none; padding: 8px 18px; border-radius: 8px; cursor: pointer; }
      `}</style>

      {!isEmbedded && (
        <header className="license-header">
          <h1>Quan ly ban quyen (Admin Center)</h1>
          <button onClick={onLogout} className="logout-btn">Dang xuat</button>
        </header>
      )}

      <div className="create-license-box">
        <h3>Tao key moi</h3>
        <div className="input-row">
          <input
            type="text"
            placeholder="Ten khach hang"
            value={clientName}
            onChange={(e) => setClientName(e.target.value)}
            style={{ flex: 2, minWidth: '240px' }}
          />
          <input
            type="number"
            placeholder="So ngay su dung"
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            style={{ flex: 1, minWidth: '120px' }}
          />
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#2c3e50', fontSize: '14px' }}>
            <input
              type="checkbox"
              checked={allowGithubUpdates}
              onChange={(e) => setAllowGithubUpdates(e.target.checked)}
            />
            Cho phep update GitHub
          </label>
          <button className="btn-create" onClick={handleCreate}>Tao key he thong</button>
        </div>
      </div>

      <div className="sort-controls">
        <input
          type="text"
          className="search-bar"
          placeholder="Tim kiem theo ten hoac key"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{ marginBottom: 0 }}
        />
        <button className={`btn-sort ${sortType === 'expiry' ? 'active' : ''}`} onClick={() => setSortType('expiry')}>
          Sap xep: Thoi han
        </button>
        <button className={`btn-sort ${sortType === 'name' ? 'active' : ''}`} onClick={() => setSortType('name')}>
          Sap xep: Ten khach hang
        </button>
      </div>

      <table className="license-table">
        <thead>
          <tr>
            <th>Khach hang</th>
            <th>Ma kich hoat</th>
            <th>ID may</th>
            <th>Thoi han</th>
            <th>Trang thai</th>
            <th>Cap nhat Git</th>
            <th>Thao tac</th>
          </tr>
        </thead>
        <tbody>
          {filteredLicenses.map((item) => {
            const rowId = item.id || item._id;
            const remaining = getRemainingTime(item.expiryDate);
            const allowUpdate = item.allowGithubUpdates !== false;

            return (
              <tr key={rowId}>
                <td style={{ fontWeight: 600, color: '#34495e' }}>{item.clientName}</td>
                <td>
                  <span className="key-text" onClick={() => handleCopyKey(item.key)} title="Click de sao chep">
                    {item.key}
                  </span>
                </td>
                <td style={{ fontSize: '12px', color: '#95a5a6' }}>
                  {item.machineId ? String(item.machineId).substring(0, 15) + '...' : 'Trong'}
                </td>
                <td>
                  <div style={{ fontSize: '13px', fontWeight: 500 }}>
                    <span style={{ color: remaining.color }}>{remaining.text}</span>
                    {item.expiryDate && (
                      <div style={{ color: '#95a5a6', fontSize: '11px', marginTop: '2px' }}>
                        ({new Date(item.expiryDate).toLocaleDateString('vi-VN')})
                      </div>
                    )}
                  </div>
                </td>
                <td>
                  <span className={`status-badge ${item.isActive ? 'active' : 'locked'}`}>
                    {item.isActive ? 'Hoat dong' : 'Da khoa'}
                  </span>
                </td>
                <td>
                  <span className={`status-badge ${allowUpdate ? 'update-on' : 'update-off'}`}>
                    {allowUpdate ? 'Cho phep' : 'Da khoa'}
                  </span>
                </td>
                <td className="actions" style={{ position: 'relative' }}>
                  <button className="btn-renew" onClick={() => setRenewingId(renewingId === rowId ? null : rowId)}>
                    {renewingId === rowId ? 'Huy' : 'Gia han'}
                  </button>

                  {renewingId === rowId && (
                    <div className="renew-popover">
                      <input type="number" value={daysToRenew} onChange={(e) => setDaysToRenew(e.target.value)} autoFocus />
                      <button onClick={() => handleRenew(rowId)} style={{ background: '#2ecc71', color: '#fff', padding: '2px 8px' }}>OK</button>
                    </div>
                  )}

                  <button className="btn-reset" onClick={() => handleResetMachine(rowId)}>Reset</button>
                  <button className="btn-toggle" onClick={() => handleToggleStatus(rowId, item.isActive)}>
                    {item.isActive ? 'Khoa' : 'Mo'}
                  </button>
                  <button className="btn-git" onClick={() => handleToggleGithubUpdates(rowId, allowUpdate)}>
                    {allowUpdate ? 'Tat Git' : 'Bat Git'}
                  </button>
                  <button className="btn-delete" onClick={() => handleDelete(rowId)}>Xoa</button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {filteredLicenses.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px', color: '#95a5a6' }}>
          Khong tim thay du lieu ban quyen nao.
        </div>
      )}
    </div>
  );
}

export default LicenseManager;
