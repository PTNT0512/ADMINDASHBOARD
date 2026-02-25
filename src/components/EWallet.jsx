import React, { useState, useEffect } from 'react';
import { useIpc, useToast } from './ToastContext';

function EWallet() {
  const [wallets, setWallets] = useState([]);
  const [form, setForm] = useState({ walletType: 'Momo', phoneNumber: '', name: '', token: '', accountNumber: '' });
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [checkStatus, setCheckStatus] = useState({});

  const { invoke } = useIpc();
  const { showToast } = useToast();

  const fetchWallets = async () => {
    const result = await invoke('get-ewallet');
    if (result.success) setWallets(result.data);
  };

  useEffect(() => { fetchWallets(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const result = await invoke('add-ewallet', form);
    if (result.success) {
      setForm({ walletType: 'Momo', phoneNumber: '', name: '', token: '', accountNumber: '' });
      fetchWallets();
    } else {
      alert('Lỗi: ' + result.message);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa ví này?')) return;
    await invoke('delete-ewallet', id);
    fetchWallets();
  };

  const handleToggleStatus = async (id, currentStatus) => {
    const newStatus = currentStatus === 1 ? 0 : 1;
    await invoke('update-ewallet-status', { id, status: newStatus });
    fetchWallets();
  };

  const handleEditClick = (item) => {
    setEditingId(item.id);
    setEditForm(item);
  };

  const handleEditChange = (e) => {
    const { name, value } = e.target;
    setEditForm({ ...editForm, [name]: value });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditForm({});
  };

  const handleSaveEdit = async () => {
    const result = await invoke('update-ewallet', { id: editingId, data: editForm });
    if (result.success) {
      setEditingId(null);
      fetchWallets();
    } else {
      alert('Lỗi: ' + result.message);
    }
  };

  const handleCheckToken = async (id, token, type) => {
    if (!token) return alert('Vui lòng nhập token trước');
    setCheckStatus(prev => ({ ...prev, [id]: 'Đang check...' }));
    const result = await invoke('check-token', { token, type });
    setCheckStatus(prev => ({ ...prev, [id]: result.success ? '✅ Live' : '❌ Die' }));
  };

  return (
    <>
      <header><h1>Cấu Hình Ví Điện Tử</h1></header>
      <div className="settings-container" style={{ marginBottom: '20px', flex: '0 0 auto' }}>
        <h3>Thêm ví</h3>
        <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          <select style={{ padding: '8px' }} value={form.walletType} onChange={(e) => setForm({...form, walletType: e.target.value})}>
            <option value="Momo">Momo</option>
            <option value="ZaloPay">ZaloPay</option>
            <option value="ViettelPay">ViettelPay</option>
          </select>
          <input style={{ padding: '8px' }} value={form.phoneNumber} onChange={(e) => setForm({...form, phoneNumber: e.target.value})} placeholder="Số điện thoại" required />
          <input style={{ padding: '8px' }} value={form.name} onChange={(e) => setForm({...form, name: e.target.value})} placeholder="Tên chủ ví" required />
          {form.walletType === 'ZaloPay' && (
            <input style={{ padding: '8px' }} value={form.accountNumber} onChange={(e) => setForm({...form, accountNumber: e.target.value})} placeholder="Số tài khoản (ZaloPay)" />
          )}
          <input style={{ padding: '8px' }} value={form.token} onChange={(e) => setForm({...form, token: e.target.value})} placeholder="Token (API)" />
          <button type="submit" style={{ width: 'auto', justifySelf: 'start', padding: '8px 20px' }}>Thêm Ví</button>
        </form>
      </div>
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Loại ví</th>
              <th>Số điện thoại</th>
              <th>Tên chủ ví</th>
              <th>Số tài khoản</th>
              <th>Token</th>
              <th>Kiểm tra</th>
              <th>Trạng thái</th>
              <th>Hành động</th>
            </tr>
          </thead>
          <tbody>
            {wallets.map(item => (
              <tr key={item.id}>
                <td>
                  {editingId === item.id ? (
                    <select value={editForm.walletType} name="walletType" onChange={handleEditChange}>
                      <option value="Momo">Momo</option>
                      <option value="ZaloPay">ZaloPay</option>
                      <option value="ViettelPay">ViettelPay</option>
                    </select>
                  ) : item.walletType}
                </td>
                <td>{editingId === item.id ? <input value={editForm.phoneNumber} name="phoneNumber" onChange={handleEditChange} /> : item.phoneNumber}</td>
                <td>{editingId === item.id ? <input value={editForm.name} name="name" onChange={handleEditChange} /> : item.name}</td>
                <td>
                  {editingId === item.id ? (
                    editForm.walletType === 'ZaloPay' ? <input value={editForm.accountNumber} name="accountNumber" onChange={handleEditChange} placeholder="Số TK" /> : '-'
                  ) : (
                    item.walletType === 'ZaloPay' ? item.accountNumber : '-'
                  )}
                </td>
                <td>{editingId === item.id ? <input value={editForm.token} name="token" onChange={handleEditChange} /> : item.token}</td>
                <td>
                  <button 
                    onClick={() => handleCheckToken(item.id, item.token, item.walletType)}
                    style={{ fontSize: '12px', padding: '5px 10px', backgroundColor: '#17a2b8', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', width: 'auto', marginRight: '5px' }}
                    disabled={checkStatus[item.id] === 'Đang check...'}
                  >
                    {checkStatus[item.id] || '🔍 Check'}
                  </button>
                </td>
                <td>
                  <button 
                    onClick={() => handleToggleStatus(item.id, item.status)}
                    style={{ 
                      backgroundColor: item.status === 1 ? '#4caf50' : '#9e9e9e',
                      color: 'white',
                      padding: '4px 10px',
                      fontSize: '12px',
                      width: 'auto',
                      border: 'none',
                      borderRadius: '4px'
                    }}
                  >
                    {item.status === 1 ? 'Đang Bật' : 'Đang Tắt'}
                  </button>
                </td>
                <td>
                  {editingId === item.id ? (
                    <>
                      <button className="edit-btn" onClick={handleSaveEdit} style={{ color: 'green', borderColor: 'green', marginBottom: '5px' }}>Lưu</button>
                      <button className="delete-btn" onClick={handleCancelEdit} style={{ color: 'gray', borderColor: 'gray' }}>Hủy</button>
                    </>
                  ) : (
                    <>
                      <button className="edit-btn" onClick={() => handleEditClick(item)}>Sửa</button>
                      <button className="delete-btn" onClick={() => handleDelete(item.id)}>Xóa</button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

export default EWallet;