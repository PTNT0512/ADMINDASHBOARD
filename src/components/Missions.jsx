import React, { useState, useEffect } from 'react';

function Missions() {
  const [missions, setMissions] = useState([]);
  const [form, setForm] = useState({ name: '', reward: '', target: '', status: 1 });
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});

  const fetchMissions = async () => {
    if (window.require) {
      const { ipcRenderer } = window.require('electron');
      const result = await ipcRenderer.invoke('get-missions');
      if (result.success) setMissions(result.data);
    }
  };

  useEffect(() => { fetchMissions(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (window.require) {
      const { ipcRenderer } = window.require('electron');
      const result = await ipcRenderer.invoke('add-mission', form);
      if (result.success) {
        setForm({ name: '', reward: '', target: '', status: 1 });
        fetchMissions();
      } else {
        alert('Lỗi: ' + result.message);
      }
    }
  };

  const handleDelete = async (id) => {
    if (window.require) {
      const { ipcRenderer } = window.require('electron');
      await ipcRenderer.invoke('delete-mission', id);
      fetchMissions();
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
      const result = await ipcRenderer.invoke('update-mission', { id: editingId, data: editForm });
      if (result.success) {
        setEditingId(null);
        fetchMissions();
      } else {
        alert('Lỗi: ' + result.message);
      }
    }
  };

  return (
    <>
      <header><h1>Quản Lý Nhiệm Vụ</h1></header>
      <div className="settings-container" style={{ marginBottom: '20px', flex: '0 0 auto' }}>
        <h3>Thêm Nhiệm Vụ</h3>
        <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr auto', gap: '10px', alignItems: 'flex-end' }}>
          <input style={{ padding: '8px' }} value={form.name} onChange={(e) => setForm({...form, name: e.target.value})} placeholder="Tên nhiệm vụ" required />
          <input type="number" style={{ padding: '8px' }} value={form.reward} onChange={(e) => setForm({...form, reward: e.target.value})} placeholder="Thưởng" required />
          <input type="number" style={{ padding: '8px' }} value={form.target} onChange={(e) => setForm({...form, target: e.target.value})} placeholder="Mục tiêu" required />
          <select style={{ padding: '8px' }} value={form.status} onChange={(e) => setForm({...form, status: parseInt(e.target.value)})}>
            <option value={1}>Active</option>
            <option value={0}>Inactive</option>
          </select>
          <button type="submit" style={{ width: 'auto', padding: '8px 20px', height: '35px' }}>Thêm</button>
        </form>
      </div>
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Tên Nhiệm Vụ</th>
              <th>Phần Thưởng</th>
              <th>Mục Tiêu</th>
              <th>Trạng Thái</th>
              <th>Hành Động</th>
            </tr>
          </thead>
          <tbody>
            {missions.map(mission => (
              <tr key={mission.id}>
                <td>{editingId === mission.id ? <input value={editForm.name} name="name" onChange={handleEditChange} /> : mission.name}</td>
                <td>{editingId === mission.id ? <input value={editForm.reward} name="reward" onChange={handleEditChange} /> : mission.reward?.toLocaleString()}</td>
                <td>{editingId === mission.id ? <input value={editForm.target} name="target" onChange={handleEditChange} /> : mission.target}</td>
                <td>
                  {editingId === mission.id ? (
                    <select value={editForm.status} name="status" onChange={handleEditChange}>
                      <option value={1}>Active</option>
                      <option value={0}>Inactive</option>
                    </select>
                  ) : (
                    mission.status === 1 ? <span style={{color: 'green'}}>Active</span> : <span style={{color: 'red'}}>Inactive</span>
                  )}
                </td>
                <td>
                  {editingId === mission.id ? (
                    <>
                      <button className="edit-btn" onClick={handleSaveEdit} style={{ color: 'green', borderColor: 'green', marginBottom: '5px' }}>Lưu</button>
                      <button className="delete-btn" onClick={handleCancelEdit} style={{ color: 'gray', borderColor: 'gray' }}>Hủy</button>
                    </>
                  ) : (
                    <>
                      <button className="edit-btn" onClick={() => handleEditClick(mission)}>Sửa</button>
                      <button className="delete-btn" onClick={() => handleDelete(mission.id)}>Xóa</button>
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

export default Missions;