import React, { useState, useEffect } from 'react';
import { useIpc, useToast } from './ToastContext';

function LicenseManager({ onLogout, isEmbedded = false }) {
  const [licenses, setLicenses] = useState([]);
  const [clientName, setClientName] = useState('');
  const [duration, setDuration] = useState(30);
  const [searchTerm, setSearchTerm] = useState('');
  const [renewingId, setRenewingId] = useState(null);
  const [daysToRenew, setDaysToRenew] = useState(30);
  const [sortType, setSortType] = useState('expiry'); // 'expiry' hoặc 'name'
  const { invoke } = useIpc();
  const { showToast } = useToast();

  const fetchLicenses = async () => {
    const result = await invoke('get-licenses');
    if (result.success) {
      setLicenses(result.data);
    }
  };

  useEffect(() => {
    fetchLicenses();
  }, []);

  const handleCreate = async () => {
    if (!clientName) return showToast('Vui lòng nhập tên khách hàng', 'error');
    const result = await invoke('create-license', { clientName, durationDays: duration });
    if (result.success) {
      showToast('Tạo Key thành công!', 'success');
      setClientName('');
      fetchLicenses();
    }
  };

  const handleRenew = async (id) => {
    if (!daysToRenew || daysToRenew <= 0) return showToast('Số ngày không hợp lệ', 'error');

    const result = await invoke('renew-license', { id, additionalDays: daysToRenew });
    if (result.success) {
      showToast('Gia hạn thành công!', 'success');
      setRenewingId(null);
      fetchLicenses();
    } else {
      showToast(result.message, 'error');
    }
  };

  const handleCopyKey = (key) => {
    navigator.clipboard.writeText(key);
    showToast('Đã sao chép mã Key vào bộ nhớ tạm!', 'success');
  };

  const handleResetMachine = async (id) => {
    if (!window.confirm('Bạn có chắc muốn reset ID máy cho Key này?')) return;
    const result = await invoke('reset-license-machine', id);
    if (result.success) {
      showToast('Đã reset máy chủ thành công', 'success');
      fetchLicenses();
    }
  };

  const handleToggleStatus = async (id, currentStatus) => {
    const result = await invoke('toggle-license-status', { id, isActive: !currentStatus });
    if (result.success) {
      fetchLicenses();
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Xóa vĩnh viễn Key này?')) return;
    const result = await invoke('delete-license', id);
    if (result.success) {
      showToast('Đã xóa Key', 'success');
      fetchLicenses();
    }
  };

  const getRemainingTime = (expiryDate) => {
    if (!expiryDate) return { text: 'Vĩnh viễn', color: '#2ecc71' };
    const now = new Date();
    const expiry = new Date(expiryDate);
    const diffTime = expiry - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays <= 0) return { text: 'Hết hạn', color: '#e74c3c' };
    if (diffDays <= 7) return { text: `Còn ${diffDays} ngày`, color: '#f39c12' }; // Cảnh báo vàng nếu dưới 7 ngày
    return { text: `Còn ${diffDays} ngày`, color: '#2c3e50' };
  };

  const filteredLicenses = licenses
    .filter(l => 
      l.clientName?.toLowerCase().includes(searchTerm.toLowerCase()) || 
      l.key?.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => {
      if (sortType === 'expiry') {
        // Đưa các Key vĩnh viễn (expiryDate null) xuống cuối
        if (!a.expiryDate && !b.expiryDate) return 0;
        if (!a.expiryDate) return 1;
        if (!b.expiryDate) return -1;
        // Sắp xếp theo thời gian hết hạn tăng dần (sớm nhất lên đầu)
        return new Date(a.expiryDate) - new Date(b.expiryDate);
      } else {
        // Sắp xếp theo tên khách hàng A-Z (hỗ trợ tiếng Việt)
        return (a.clientName || '').localeCompare(b.clientName || '', 'vi');
      }
    });

  return (
    <div className="license-manager" style={isEmbedded ? { background: 'transparent', padding: '24px', minHeight: 'auto' } : {}}>
      <style>{`
        .license-manager { padding: 25px; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #f8f9fa; min-height: 100vh; }
        .license-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px; background: #fff; padding: 15px 25px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.05); }
        .license-header h1 { margin: 0; color: #2c3e50; font-size: 24px; }
        
        .create-license-box { background: #fff; padding: 20px; border-radius: 12px; margin-bottom: 25px; box-shadow: 0 4px 6px rgba(0,0,0,0.05); }
        .input-row { display: flex; gap: 15px; align-items: center; }
        .input-row input { padding: 10px 15px; border: 1px solid #ddd; border-radius: 8px; outline: none; transition: border 0.3s; }
        .input-row input:focus { border-color: #3498db; }
        .btn-create { background: #3498db; color: white; border: none; padding: 10px 25px; border-radius: 8px; cursor: pointer; font-weight: 600; transition: background 0.3s; }
        .btn-create:hover { background: #2980b9; }

        .search-bar { margin-bottom: 20px; width: 100%; max-width: 400px; padding: 10px 15px; border-radius: 8px; border: 1px solid #ddd; }
        .sort-controls { margin-bottom: 20px; display: flex; gap: 10px; align-items: center; }
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
        .status-badge { padding: 5px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; text-transform: uppercase; }
        .status-badge.active { background: #eafff1; color: #2ecc71; }
        .status-badge.locked { background: #fff0f0; color: #e74c3c; }

        .actions { display: flex; gap: 8px; flex-wrap: wrap; }
        .actions button { border: none; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 500; transition: all 0.2s; }
        .btn-renew { background: #3498db; color: white; }
        .btn-reset { background: #f39c12; color: white; }
        .btn-toggle { background: #95a5a6; color: white; }
        .btn-delete { background: #e74c3c; color: white; }
        .actions button:hover { opacity: 0.85; transform: translateY(-1px); }

        .renew-popover { position: absolute; background: white; border: 1px solid #ddd; padding: 10px; border-radius: 8px; box-shadow: 0 10px 25px rgba(0,0,0,0.1); z-index: 10; display: flex; gap: 5px; }
        .renew-popover input { width: 60px; padding: 5px; }
        .logout-btn { background: #2c3e50; color: white; border: none; padding: 8px 18px; border-radius: 8px; cursor: pointer; }
      `}</style>

      {!isEmbedded && (
        <header className="license-header">
          <h1>Quản Lý Bản Quyền (Admin Center)</h1>
          <button onClick={onLogout} className="logout-btn">Đăng xuất</button>
        </header>
      )}

      <div className="create-license-box">
        <h3>Tạo Key Mới</h3>
        <div className="input-row">
          <input 
            type="text" 
            placeholder="Tên khách hàng (Ví dụ: Nguyễn Văn A)" 
            value={clientName} 
            onChange={(e) => setClientName(e.target.value)} 
            style={{ flex: 2 }}
          />
          <input 
            type="number" 
            placeholder="Số ngày sử dụng" 
            value={duration} 
            onChange={(e) => setDuration(e.target.value)} 
            style={{ flex: 1 }}
          />
          <button className="btn-create" onClick={handleCreate}>Tạo Key Hệ Thống</button>
        </div>
      </div>

      <div className="sort-controls">
        <input 
          type="text" 
          className="search-bar" 
          placeholder="Tìm kiếm theo tên hoặc mã Key..." 
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{ marginBottom: 0 }}
        />
        <button 
          className={`btn-sort ${sortType === 'expiry' ? 'active' : ''}`}
          onClick={() => setSortType('expiry')}
        >
          Sắp xếp: Thời hạn
        </button>
        <button 
          className={`btn-sort ${sortType === 'name' ? 'active' : ''}`}
          onClick={() => setSortType('name')}
        >
          Sắp xếp: Tên khách hàng
        </button>
      </div>

      <table className="license-table">
        <thead>
          <tr>
            <th>Khách hàng</th>
            <th>Mã Kích Hoạt</th>
            <th>ID Máy</th>
            <th>Thời hạn</th>
            <th>Trạng thái</th>
            <th>Thao tác</th>
          </tr>
        </thead>
        <tbody>
          {filteredLicenses.map((item) => (
            <tr key={item.id || item._id}>
              <td style={{ fontWeight: '600', color: '#34495e' }}>{item.clientName}</td>
              <td>
                <span 
                  className="key-text" 
                  onClick={() => handleCopyKey(item.key)}
                  title="Click để sao chép"
                >
                  {item.key}
                </span>
              </td>
              <td style={{ fontSize: '12px', color: '#95a5a6' }}>
                {item.machineId ? item.machineId.substring(0, 15) + '...' : 'Trống'}
              </td>
              <td>
                <div style={{ fontSize: '13px', fontWeight: '500' }}>
                  {(() => {
                    const remaining = getRemainingTime(item.expiryDate);
                    return <span style={{ color: remaining.color }}>{remaining.text}</span>;
                  })()}
                  {item.expiryDate && (
                    <div style={{ color: '#95a5a6', fontSize: '11px', marginTop: '2px' }}>
                      ({new Date(item.expiryDate).toLocaleDateString('vi-VN')})
                    </div>
                  )}
                </div>
              </td>
              <td>
                <span className={`status-badge ${item.isActive ? 'active' : 'locked'}`}>
                  {item.isActive ? 'Hoạt động' : 'Đã khóa'}
                </span>
              </td>
              <td className="actions" style={{ position: 'relative' }}>
                <button 
                  className="btn-renew" 
                  onClick={() => setRenewingId(renewingId === item.id ? null : item.id)}
                >
                  {renewingId === item.id ? 'Hủy' : 'Gia hạn'}
                </button>

                {renewingId === item.id && (
                  <div className="renew-popover">
                    <input 
                      type="number" 
                      value={daysToRenew} 
                      onChange={(e) => setDaysToRenew(e.target.value)}
                      autoFocus
                    />
                    <button onClick={() => handleRenew(item.id)} style={{ background: '#2ecc71', color: 'white', padding: '2px 8px' }}>OK</button>
                  </div>
                )}

                <button className="btn-reset" onClick={() => handleResetMachine(item.id || item._id)}>Reset</button>
                <button 
                  className="btn-toggle" 
                  onClick={() => handleToggleStatus(item.id || item._id, item.isActive)}
                >
                  {item.isActive ? 'Khóa' : 'Mở'}
                </button>
                <button className="btn-delete" onClick={() => handleDelete(item.id || item._id)}>Xóa</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {filteredLicenses.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px', color: '#95a5a6' }}>
          Không tìm thấy dữ liệu bản quyền nào.
        </div>
      )}
    </div>
  );
}

export default LicenseManager;