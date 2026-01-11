import React, { useState, useEffect } from 'react';

function DepositList() {
  const [deposits, setDeposits] = useState([]);
  const [filter, setFilter] = useState('active'); // 'active' | 'error'

  const fetchDeposits = async () => {
    if (window.require) {
      const { ipcRenderer } = window.require('electron');
      const result = await ipcRenderer.invoke('get-deposits');
      if (result.success) setDeposits(result.data);
    }
  };

  useEffect(() => { fetchDeposits(); }, []);

  const filteredDeposits = deposits.filter(item => {
    if (filter === 'active') return item.status !== 2; // Hiện Chờ duyệt (0) và Thành công (1)
    if (filter === 'error') return item.status === 2;  // Hiện Đã hủy (2)
    return true;
  });

  return (
    <>
      <header>
        <h1>Quản Lý Nạp Tiền</h1>
        <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
          <button 
            onClick={() => setFilter('active')}
            style={{
              padding: '8px 15px',
              borderRadius: '5px',
              border: 'none',
              background: filter === 'active' ? '#2196f3' : '#eee',
              color: filter === 'active' ? 'white' : '#333',
              cursor: 'pointer',
              fontWeight: 'bold'
            }}
          >
            Giao Dịch
          </button>
          <button 
            onClick={() => setFilter('error')}
            style={{
              padding: '8px 15px',
              borderRadius: '5px',
              border: 'none',
              background: filter === 'error' ? '#f44336' : '#eee',
              color: filter === 'error' ? 'white' : '#333',
              cursor: 'pointer',
              fontWeight: 'bold'
            }}
          >
            Giao Dịch Lỗi
          </button>
        </div>
      </header>
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Thời gian</th>
              <th>User ID</th>
              <th>Số tiền</th>
              {filter === 'error' && <th>Thực nhận</th>}
              <th>Phương thức</th>
              <th>Mã GD</th>
              {filter === 'error' && <th>Mô tả lỗi</th>}
              <th>Trạng thái</th>
            </tr>
          </thead>
          <tbody>
            {filteredDeposits.map(item => (
              <tr key={item.id}>
                <td>{new Date(item.date).toLocaleString('vi-VN')}</td>
                <td>{item.userId}</td>
                <td style={{ fontWeight: 'bold', color: '#2e7d32' }}>{item.amount?.toLocaleString()}</td>
                {filter === 'error' && <td style={{ fontWeight: 'bold', color: 'red' }}>{item.realAmount?.toLocaleString() || '-'}</td>}
                <td>{item.method}</td>
                <td>{item.transId || item.requestId}</td>
                {filter === 'error' && <td style={{ fontSize: '12px', color: '#666' }}>{item.description}</td>}
                <td>
                  {item.status === 0 && <span style={{color: 'orange', fontWeight: 'bold'}}>Chờ duyệt</span>}
                  {item.status === 1 && <span style={{color: 'green', fontWeight: 'bold'}}>Thành công</span>}
                  {item.status === 2 && <span style={{color: 'red', fontWeight: 'bold'}}>Đã hủy</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

export default DepositList;