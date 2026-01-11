import React, { useState, useEffect } from 'react';

function LuckyWheel() {
  const [rewards, setRewards] = useState([]);
  const [form, setForm] = useState({ name: '', rate: '', value: '' });
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});

  const fetchRewards = async () => {
    if (window.require) {
      const { ipcRenderer } = window.require('electron');
      const result = await ipcRenderer.invoke('get-lucky-wheel');
      if (result.success) setRewards(result.data);
    }
  };

  useEffect(() => { fetchRewards(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (window.require) {
      const { ipcRenderer } = window.require('electron');
      const result = await ipcRenderer.invoke('add-lucky-wheel', form);
      if (result.success) {
        setForm({ name: '', rate: '', value: '' });
        fetchRewards();
      } else {
        alert('Lỗi: ' + result.message);
      }
    }
  };

  const handleDelete = async (id) => {
    if (window.require) {
      const { ipcRenderer } = window.require('electron');
      await ipcRenderer.invoke('delete-lucky-wheel', id);
      fetchRewards();
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
      const result = await ipcRenderer.invoke('update-lucky-wheel', { id: editingId, data: editForm });
      if (result.success) {
        setEditingId(null);
        fetchRewards();
      } else {
        alert('Lỗi: ' + result.message);
      }
    }
  };

  return (
    <>
      <header><h1>Cấu Hình Vòng Quay May Mắn</h1></header>
      <div className="settings-container" style={{ marginBottom: '20px', flex: '0 0 auto' }}>
        <h3>Thêm Phần Thưởng</h3>
        <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: '10px', alignItems: 'flex-end' }}>
          <input style={{ padding: '8px' }} value={form.name} onChange={(e) => setForm({...form, name: e.target.value})} placeholder="Tên phần thưởng" required />
          <input type="number" style={{ padding: '8px' }} value={form.rate} onChange={(e) => setForm({...form, rate: e.target.value})} placeholder="Tỷ lệ (%)" required />
          <input type="number" style={{ padding: '8px' }} value={form.value} onChange={(e) => setForm({...form, value: e.target.value})} placeholder="Giá trị (VNĐ)" required />
          <button type="submit" style={{ width: 'auto', padding: '8px 20px', height: '35px' }}>Thêm</button>
        </form>
      </div>
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Tên Phần Thưởng</th>
              <th>Tỷ Lệ (%)</th>
              <th>Giá Trị</th>
              <th>Hành Động</th>
            </tr>
          </thead>
          <tbody>
            {rewards.map(reward => (
              <tr key={reward.id}>
                <td>{editingId === reward.id ? <input value={editForm.name} name="name" onChange={handleEditChange} /> : reward.name}</td>
                <td>{editingId === reward.id ? <input value={editForm.rate} name="rate" onChange={handleEditChange} /> : reward.rate}</td>
                <td>{editingId === reward.id ? <input value={editForm.value} name="value" onChange={handleEditChange} /> : reward.value?.toLocaleString()}</td>
                <td>
                  {editingId === reward.id ? (
                    <>
                      <button className="edit-btn" onClick={handleSaveEdit} style={{ color: 'green', borderColor: 'green', marginBottom: '5px' }}>Lưu</button>
                      <button className="delete-btn" onClick={handleCancelEdit} style={{ color: 'gray', borderColor: 'gray' }}>Hủy</button>
                    </>
                  ) : (
                    <>
                      <button className="edit-btn" onClick={() => handleEditClick(reward)}>Sửa</button>
                      <button className="delete-btn" onClick={() => handleDelete(reward.id)}>Xóa</button>
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

export default LuckyWheel;