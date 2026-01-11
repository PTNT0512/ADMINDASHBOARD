import React, { useState } from 'react';

function UserList({ users, onRefresh }) {
  const [editingId, setEditingId] = useState(null);
  const [editFormData, setEditFormData] = useState({});

  const handleEditClick = (user) => {
    setEditingId(user.id);
    setEditFormData(user);
  };

  const handleCancelClick = () => {
    setEditingId(null);
    setEditFormData({});
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setEditFormData({ ...editFormData, [name]: value });
  };

  const handleSaveClick = async () => {
    if (!window.require) return;

    try {
      const { ipcRenderer } = window.require('electron');

      const dataToUpdate = {
        ...editFormData,
        balance: Number(editFormData.balance),
        safe: Number(editFormData.safe),
        vip: Number(editFormData.vip),
        ref: Number(editFormData.ref),
        spinCount: Number(editFormData.spinCount),
        dailyPoints: Number(editFormData.dailyPoints),
        spinlucky: Number(editFormData.spinlucky),
        refund: Number(editFormData.refund),
        status: Number(editFormData.status),
      };

      const result = await ipcRenderer.invoke('update-user', {
        id: editingId,
        data: dataToUpdate,
      });

      if (result.success) {
        setEditingId(null);
        onRefresh && onRefresh();
      } else {
        alert('Lỗi: ' + result.message);
      }
    } catch (err) {
      console.error(err);
      alert('Lỗi hệ thống');
    }
  };

  return (
    <>
      {/* CSS chỉ áp dụng trong file này */}
      <style>
        {`
          .user-header {
            display: flex;
            align-items: center;
            margin-bottom: 12px;
          }

          .add-btn {
            margin-left: auto;
            background: #1976d2;
            color: #fff;
            padding: 8px 14px;
            border-radius: 6px;
            border: none;
            cursor: pointer;
          }

          .add-btn:hover {
            background: #125aa0;
          }

          .table-container {
            overflow-x: auto;
          }

          table {
            width: 100%;
            border-collapse: collapse;
            font-size: 14px;
          }

          th, td {
            border: 1px solid #ddd;
            padding: 6px 8px;
            text-align: center;
            white-space: nowrap;
          }

          th {
            background: #f5f5f5;
            font-weight: 600;
          }

          tr:hover {
            background: #fafafa;
          }

          input, select {
            padding: 4px;
            font-size: 13px;
          }

          .edit-btn {
            background: #fff;
            color: #1976d2;
            border: 1px solid #1976d2;
            padding: 4px 8px;
            margin-bottom: 4px;
            border-radius: 4px;
            cursor: pointer;
            width: 60px;
          }

          .edit-btn:hover {
            background: #1976d2;
            color: #fff;
          }

          .delete-btn {
            background: #fff;
            color: #d32f2f;
            border: 1px solid #d32f2f;
            padding: 4px 8px;
            border-radius: 4px;
            cursor: pointer;
            width: 60px;
          }

          .delete-btn:hover {
            background: #d32f2f;
            color: #fff;
          }

          .status-active {
            color: green;
            font-weight: bold;
          }

          .status-locked {
            color: red;
            font-weight: bold;
          }
        `}
      </style>

      {/* HEADER */}
      <header className="user-header">
        <h1>Danh sách người dùng</h1>
      </header>

      {/* TABLE */}
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>User ID</th>
              <th>Số dư</th>
              <th>Két sắt</th>
              <th>VIP</th>
              <th>Ref</th>
              <th>Spin</th>
              <th>Daily</th>
              <th>Lucky</th>
              <th>Refund</th>
              <th>Pass Safe</th>
              <th>Trạng thái</th>
              <th>Ngày tạo</th>
              <th>Hành động</th>
            </tr>
          </thead>

          <tbody>
            {users.map((user) => (
              <tr key={user.id}>
                <td>{user.userId}</td>

                <td>
                  {editingId === user.id ? (
                    <input type="number" name="balance" value={editFormData.balance} onChange={handleInputChange} />
                  ) : (
                    <b style={{ color: '#2e7d32' }}>{user.balance?.toLocaleString()}</b>
                  )}
                </td>

                <td>
                  {editingId === user.id ? (
                    <input type="number" name="safe" value={editFormData.safe} onChange={handleInputChange} />
                  ) : (
                    <b style={{ color: '#1976d2' }}>{user.safe?.toLocaleString()}</b>
                  )}
                </td>

                <td>{editingId === user.id ? <input name="vip" value={editFormData.vip} onChange={handleInputChange} /> : user.vip}</td>
                <td>{editingId === user.id ? <input name="ref" value={editFormData.ref} onChange={handleInputChange} /> : user.ref}</td>
                <td>{editingId === user.id ? <input name="spinCount" value={editFormData.spinCount} onChange={handleInputChange} /> : user.spinCount}</td>
                <td>{editingId === user.id ? <input name="dailyPoints" value={editFormData.dailyPoints} onChange={handleInputChange} /> : user.dailyPoints}</td>
                <td>{editingId === user.id ? <input name="spinlucky" value={editFormData.spinlucky} onChange={handleInputChange} /> : user.spinlucky}</td>
                <td>{editingId === user.id ? <input name="refund" value={editFormData.refund} onChange={handleInputChange} /> : user.refund}</td>
                <td>{editingId === user.id ? <input name="passsafe" value={editFormData.passsafe} onChange={handleInputChange} /> : user.passsafe}</td>

                <td>
                  {editingId === user.id ? (
                    <select name="status" value={editFormData.status} onChange={handleInputChange}>
                      <option value={1}>Active</option>
                      <option value={0}>Locked</option>
                    </select>
                  ) : (
                    <span className={user.status === 1 ? 'status-active' : 'status-locked'}>
                      {user.status === 1 ? 'Active' : 'Locked'}
                    </span>
                  )}
                </td>

                <td>{user.date ? new Date(user.date).toLocaleDateString('vi-VN') : ''}</td>

                <td>
                  {editingId === user.id ? (
                    <>
                      <button className="edit-btn" onClick={handleSaveClick}>Lưu</button>
                      <button className="delete-btn" onClick={handleCancelClick}>Hủy</button>
                    </>
                  ) : (
                    <>
                      <button className="edit-btn" onClick={() => handleEditClick(user)}>Sửa</button>
                      <button className="delete-btn">Xóa</button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p><i>Đây là nơi bạn sẽ viết thêm các chức năng CRUD sau này.</i></p>
    </>
  );
}

export default UserList;
