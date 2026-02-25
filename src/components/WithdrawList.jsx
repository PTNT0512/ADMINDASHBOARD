import React, { useState, useEffect } from 'react';

function WithdrawList() {
  const [withdraws, setWithdraws] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchWithdraws = async (p = 1) => {
    if (window.require) {
      const { ipcRenderer } = window.require('electron');
      const result = await ipcRenderer.invoke('get-withdraws', { page: p, limit: 10 });
      if (result.success) {
        setWithdraws(result.data);
        setPage(p);
        setTotalPages(result.totalPages || 1);
      }
    }
  };

  useEffect(() => { fetchWithdraws(1); }, []);

  const handleProcess = async (id, status) => {
    const action = status === 1 ? 'DUYỆT' : 'HỦY (Hoàn tiền)';
    if (!window.confirm(`Bạn có chắc chắn muốn ${action} giao dịch này?`)) return;

    if (window.require) {
      const { ipcRenderer } = window.require('electron');
      const result = await ipcRenderer.invoke('handle-withdraw', { id, status });
      if (result.success) {
        if (status === 1) {
          alert('Đã duyệt thành công! Thông báo đã được gửi đến người dùng.');
        } else {
          alert('Đã hủy giao dịch và hoàn tiền cho người dùng.');
        }
        fetchWithdraws(page);
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
              <th>Lợi nhuận</th>
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
                <td style={{ fontSize: '12px', whiteSpace: 'nowrap' }}>
                  <div>Nạp: <b style={{ color: 'green' }}>{item.accountStats?.totalDeposit?.toLocaleString() || 0}</b></div>
                  <div>Rút: <b style={{ color: 'red' }}>{item.accountStats?.totalWithdraw?.toLocaleString() || 0}</b></div>
                  <div>Cược: <b style={{ color: 'blue' }}>{item.accountStats?.totalBet?.toLocaleString() || 0}</b></div>
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
      
      <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'center', gap: '10px', alignItems: 'center' }}>
        <button 
          onClick={() => fetchWithdraws(page - 1)} 
          disabled={page <= 1}
          style={{ padding: '5px 15px', cursor: page <= 1 ? 'not-allowed' : 'pointer', background: '#f0f0f0', border: '1px solid #ccc', borderRadius: '4px' }}
        >
          Trước
        </button>
        <span style={{ fontWeight: 'bold' }}>Trang {page} / {totalPages}</span>
        <button 
          onClick={() => fetchWithdraws(page + 1)} 
          disabled={page >= totalPages}
          style={{ padding: '5px 15px', cursor: page >= totalPages ? 'not-allowed' : 'pointer', background: '#f0f0f0', border: '1px solid #ccc', borderRadius: '4px' }}
        >
          Sau
        </button>
      </div>
    </>
  );
}

export default WithdrawList;