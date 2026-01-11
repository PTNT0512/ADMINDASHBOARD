import React, { useState, useEffect } from 'react';

function TopRacing() {
  const [configs, setConfigs] = useState([]);
  const [form, setForm] = useState({ rank: '', reward: '' });
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});

  const fetchConfigs = async () => {
    if (window.require) {
      const { ipcRenderer } = window.require('electron');
      const result = await ipcRenderer.invoke('get-top-racing');
      if (result.success) setConfigs(result.data);
    }
  };

  useEffect(() => { fetchConfigs(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (window.require) {
      const { ipcRenderer } = window.require('electron');
      const result = await ipcRenderer.invoke('add-top-racing', form);
      if (result.success) {
        setForm({ rank: '', reward: '' });
        fetchConfigs();
      } else {
        alert('Lỗi: ' + result.message);
      }
    }
  };

  const handleDelete = async (id) => {
    if (window.require) {
      const { ipcRenderer } = window.require('electron');
      await ipcRenderer.invoke('delete-top-racing', id);
      fetchConfigs();
    }
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
    if (window.require) {
      const { ipcRenderer } = window.require('electron');
      const result = await ipcRenderer.invoke('update-top-racing', { id: editingId, data: editForm });
      if (result.success) {
        setEditingId(null);
        fetchConfigs();
      } else {
        alert('Lỗi: ' + result.message);
      }
    }
  };

  return (
    <>
      <header><h1>Cấu Hình Đua Top</h1></header>
      <div className="settings-container" style={{ marginBottom: '20px', flex: '0 0 auto' }}>
        <h3>Thêm Cấu Hình</h3>
        <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '10px', alignItems: 'flex-end' }}>
          <input type="number" style={{ padding: '8px' }} value={form.rank} onChange={(e) => setForm({...form, rank: e.target.value})} placeholder="Hạng (VD: 1)" required />
          <input type="number" style={{ padding: '8px' }} value={form.reward} onChange={(e) => setForm({...form, reward: e.target.value})} placeholder="Phần thưởng (VNĐ)" required />
          <button type="submit" style={{ width: 'auto', padding: '8px 20px', height: '35px' }}>Thêm</button>
        </form>
      </div>
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Hạng</th>
              <th>Phần Thưởng</th>
              <th>Hành Động</th>
            </tr>
          </thead>
          <tbody>
            {configs.map(item => (
              <tr key={item.id}>
                <td>{editingId === item.id ? <input value={editForm.rank} name="rank" onChange={handleEditChange} /> : item.rank}</td>
                <td>{editingId === item.id ? <input value={editForm.reward} name="reward" onChange={handleEditChange} /> : item.reward?.toLocaleString()}</td>
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

export default TopRacing;