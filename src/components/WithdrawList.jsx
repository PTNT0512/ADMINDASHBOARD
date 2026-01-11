import React, { useState, useEffect } from 'react';

function WithdrawList() {
  const [withdraws, setWithdraws] = useState([]);

  const fetchWithdraws = async () => {
    if (window.require) {
      const { ipcRenderer } = window.require('electron');
      const result = await ipcRenderer.invoke('get-withdraws');
      if (result.success) setWithdraws(result.data);
    }
  };

  useEffect(() => { fetchWithdraws(); }, []);

  const handleProcess = async (id, status) => {
    const action = status === 1 ? 'DUYỆT' : 'HỦY (Hoàn tiền)';
    if (!window.confirm(`Bạn có chắc chắn muốn ${action} giao dịch này?`)) return;

    if (window.require) {
      const { ipcRenderer } = window.require('electron');
      const result = await ipcRenderer.invoke('handle-withdraw', { id, status });
      if (result.success) {
        alert('Xử lý thành công!');
        fetchWithdraws();
      } else {
        alert('Lỗi: ' + result.message);
      }
    }
  };

  return (
    <>
      <header><h1>Quản Lý Rút Tiền</h1></header>
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Thời gian</th>
              <th>User ID</th>
              <th>Số tiền</th>
              <th>Ngân hàng</th>
              <th>Thông tin nhận</th>
              <th>Trạng thái</th>
              <th>Hành động</th>
            </tr>
          </thead>
          <tbody>
            {withdraws.map(item => (
              <tr key={item.id}>
                <td>{new Date(item.date).toLocaleString('vi-VN')}</td>
                <td>{item.userId}</td>
                <td style={{ fontWeight: 'bold', color: '#c62828' }}>{item.amount?.toLocaleString()}</td>
                <td>{item.bankName}</td>
                <td>
                  <div>STK: <b>{item.accountNumber}</b></div>
                  <div>Tên: {item.accountName}</div>
                </td>
                <td>
                  {item.status === 0 && <span style={{color: 'orange', fontWeight: 'bold'}}>Chờ duyệt</span>}
                  {item.status === 1 && <span style={{color: 'green', fontWeight: 'bold'}}>Thành công</span>}
                  {item.status === 2 && <span style={{color: 'red', fontWeight: 'bold'}}>Đã hủy</span>}
                </td>
                <td>
                  {item.status === 0 && (
                    <>
                      <button className="edit-btn" onClick={() => handleProcess(item.id, 1)} style={{ color: 'green', borderColor: 'green', marginRight: '5px' }}>Duyệt</button>
                      <button className="delete-btn" onClick={() => handleProcess(item.id, 2)}>Hủy</button>
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

export default WithdrawList;