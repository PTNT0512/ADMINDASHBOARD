import React, { useState, useEffect } from 'react';

function BotManager() {
  const [bots, setBots] = useState([]);
  const [form, setForm] = useState({ name: '', token: '', role: 'main' });
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [checkingTokenId, setCheckingTokenId] = useState(null);

  const fetchBots = async () => {
    if (window.require) {
      const { ipcRenderer } = window.require('electron');
      const result = await ipcRenderer.invoke('get-bots').catch(err => console.error(err));
      if (result.success) setBots(result.data);
    }
  };

  useEffect(() => { fetchBots(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (window.require) {
      const { ipcRenderer } = window.require('electron');
      const result = await ipcRenderer.invoke('add-bot', form);
      if (result.success) {
        setForm({ name: '', token: '', role: 'main' });
        fetchBots();
      } else {
        alert('Lỗi: ' + result.message);
      }
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Bạn có chắc chắn muốn xóa bot này?')) {
      if (window.require) {
        const { ipcRenderer } = window.require('electron');
        await ipcRenderer.invoke('delete-bot', id);
        fetchBots();
      }
    }
  };

  const handleToggleStatus = async (id, currentStatus) => {
    if (window.require) {
      const { ipcRenderer } = window.require('electron');
      const newStatus = currentStatus === 1 ? 0 : 1;
      await ipcRenderer.invoke('update-bot-status', { id, status: newStatus });
      fetchBots();
    }
  };

  const handleEditClick = (bot) => {
    setEditingId(bot.id);
    setEditForm(bot);
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
    if (window.require) {
      const { ipcRenderer } = window.require('electron');
      const result = await ipcRenderer.invoke('update-bot', { id: editingId, data: editForm });
      if (result.success) {
        setEditingId(null);
        fetchBots();
      } else {
        alert('Lỗi: ' + result.message);
      }
    }
  };

  const handleCheckToken = async (botId, token) => {
    if (window.require) {
      setCheckingTokenId(botId);
      const { ipcRenderer } = window.require('electron');
      const result = await ipcRenderer.invoke('check-bot-token', token);
      if (result.success) {
        alert('✅ ' + result.message);
      } else {
        alert('❌ ' + result.message);
      }
      setCheckingTokenId(null);
    }
  };

  return (
    <>
      <header><h1>Quản Lý Bot Telegram</h1></header>
      <div className="settings-container" style={{ marginBottom: '20px', flex: '0 0 auto' }}>
        <h3>Thêm Bot Mới</h3>
        <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: '10px', alignItems: 'flex-end' }}>
          <input style={{ padding: '8px' }} value={form.name} onChange={(e) => setForm({...form, name: e.target.value})} placeholder="Tên Bot (VD: Bot Chính)" required />
          <input style={{ padding: '8px' }} value={form.token} onChange={(e) => setForm({...form, token: e.target.value})} placeholder="Token API" required />
          <select style={{ padding: '8px' }} value={form.role} onChange={(e) => setForm({...form, role: e.target.value})}>
            <option value="main">Bot Chính</option>
            <option value="cskh">Bot CSKH</option>
            <option value="tx_room">Bot Phòng TX</option>
            <option value="other">Khác</option>
          </select>
          <button type="submit" style={{ width: 'auto', padding: '8px 20px', height: '35px' }}>Thêm Bot</button>
        </form>
      </div>
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Tên Bot</th>
              <th>Vai trò</th>
              <th>Trạng thái</th>
              <th>Hành động</th>
            </tr>
          </thead>
          <tbody>
            {bots.map(bot => (
              <tr key={bot.id}>
                <td>
                  {editingId === bot.id ? (
                    <input 
                      value={editForm.name} 
                      name="name" 
                      onChange={handleEditChange} 
                      style={{ width: '100%', padding: '5px' }}
                    />
                  ) : (
                    <span style={{ fontWeight: 'bold' }}>{bot.name}</span>
                  )}
                </td>
                <td>
                  {editingId === bot.id ? (
                    <select value={editForm.role} name="role" onChange={handleEditChange} style={{ padding: '5px' }}>
                      <option value="main">Bot Chính</option>
                      <option value="cskh">Bot CSKH</option>
                      <option value="tx_room">Bot Phòng TX</option>
                      <option value="other">Khác</option>
                    </select>
                  ) : (
                    bot.role
                  )}
                </td>
                <td>
                  <button className={`btn ${bot.status === 1 ? '' : 'secondary'}`} onClick={() => handleToggleStatus(bot.id, bot.status)}>
                    {bot.status === 1 ? 'Đang Bật' : 'Đang Tắt'}
                  </button>
                </td>
                <td>
                  {editingId === bot.id ? (
                    <>
                      <button className="edit-btn" onClick={handleSaveEdit} style={{ color: 'green', borderColor: 'green', marginBottom: '5px' }}>Lưu</button>
                      <button className="delete-btn" onClick={handleCancelEdit} style={{ color: 'gray', borderColor: 'gray' }}>Hủy</button>
                    </>
                  ) : (
                    <>
                      <button className="btn" onClick={() => handleCheckToken(bot.id, bot.token)} disabled={checkingTokenId !== null}>
                        {checkingTokenId === bot.id ? 'Checking...' : 'Check'}
                      </button>
                      <button className="btn" onClick={() => handleEditClick(bot)}>Sửa</button>
                      <button className="btn secondary" onClick={() => handleDelete(bot.id)}>Xóa</button>
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

export default BotManager;