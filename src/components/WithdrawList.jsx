import React, { useEffect, useMemo, useState } from 'react';

function WithdrawList({ mode = 'history' }) {
  const viewMode = mode === 'orders' ? 'orders' : 'history';
  const [withdraws, setWithdraws] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const title = useMemo(
    () => (viewMode === 'orders' ? 'Lenh Rut' : 'Lich Su Rut'),
    [viewMode],
  );

  const fetchWithdraws = async (p = 1) => {
    if (!window.require) return;
    const { ipcRenderer } = window.require('electron');
    const result = await ipcRenderer.invoke('get-withdraws', {
      page: p,
      limit: 10,
      filterType: viewMode,
    });

    if (result && result.success) {
      setWithdraws(Array.isArray(result.data) ? result.data : []);
      setPage(p);
      setTotalPages(Math.max(1, Number(result.totalPages) || 1));
    } else {
      setWithdraws([]);
      setPage(1);
      setTotalPages(1);
    }
  };

  useEffect(() => {
    fetchWithdraws(1);
  }, [viewMode]);

  const handleProcess = async (id, status) => {
    const actionText = status === 1 ? 'DUYET' : 'HUY (Hoan tien)';
    if (!window.confirm(`Ban co chac chan muon ${actionText} lenh rut nay?`)) return;
    if (!window.require) return;

    const { ipcRenderer } = window.require('electron');
    const result = await ipcRenderer.invoke('handle-withdraw', { id, status });
    if (result && result.success) {
      if (status === 1) {
        window.alert('Da duyet lenh rut thanh cong.');
      } else {
        window.alert('Da huy lenh rut va hoan tien cho nguoi dung.');
      }
      fetchWithdraws(1);
      return;
    }
    window.alert(`Loi: ${result?.message || 'Khong xu ly duoc lenh rut.'}`);
  };

  const renderStatus = (status) => {
    if (status === 0) return <span style={{ color: 'orange', fontWeight: 'bold' }}>Cho duyet</span>;
    if (status === 1) return <span style={{ color: 'green', fontWeight: 'bold' }}>Thanh cong</span>;
    return <span style={{ color: 'red', fontWeight: 'bold' }}>Da huy</span>;
  };

  const displayWithdraws = useMemo(
    () => (viewMode === 'orders'
      ? withdraws.filter((item) => Number(item.status) === 0)
      : withdraws),
    [withdraws, viewMode],
  );

  const canPrev = page > 1;
  const canNext = page < totalPages;

  return (
    <>
      <header><h1>{title}</h1></header>
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Thoi gian</th>
              <th>User ID</th>
              <th>So tien</th>
              <th>Ngan hang</th>
              <th>Thong tin nhan</th>
              <th>Tong nap/rut/cuoc</th>
              <th>Trang thai</th>
              {viewMode === 'orders' && <th>Hanh dong</th>}
            </tr>
          </thead>
          <tbody>
            {displayWithdraws.map((item) => (
              <tr key={item._id || item.id}>
                <td>{item.date ? new Date(item.date).toLocaleString('vi-VN') : '-'}</td>
                <td>{item.userId || '-'}</td>
                <td style={{ fontWeight: 'bold', color: '#c62828' }}>
                  {Number(item.amount || 0).toLocaleString('vi-VN')}
                </td>
                <td>{item.bankName || '-'}</td>
                <td>
                  <div>STK: <b>{item.accountNumber || '-'}</b></div>
                  <div>Ten: {item.accountName || '-'}</div>
                </td>
                <td style={{ fontSize: '12px', whiteSpace: 'nowrap' }}>
                  <div>Nap: <b style={{ color: 'green' }}>{Number(item.accountStats?.totalDeposit || 0).toLocaleString('vi-VN')}</b></div>
                  <div>Rut: <b style={{ color: 'red' }}>{Number(item.accountStats?.totalWithdraw || 0).toLocaleString('vi-VN')}</b></div>
                  <div>Cuoc: <b style={{ color: 'blue' }}>{Number(item.accountStats?.totalBet || 0).toLocaleString('vi-VN')}</b></div>
                </td>
                <td>{renderStatus(Number(item.status))}</td>
                {viewMode === 'orders' && (
                  <td>
                    {Number(item.status) === 0 && (
                      <>
                        <button
                          className="edit-btn"
                          onClick={() => handleProcess(item._id || item.id, 1)}
                          style={{ color: 'green', borderColor: 'green', marginRight: '5px' }}
                        >
                          Duyet
                        </button>
                        <button
                          className="delete-btn"
                          onClick={() => handleProcess(item._id || item.id, 2)}
                        >
                          Huy
                        </button>
                      </>
                    )}
                  </td>
                )}
              </tr>
            ))}
            {displayWithdraws.length === 0 && (
              <tr>
                <td colSpan={viewMode === 'orders' ? 8 : 7} style={{ textAlign: 'center', padding: '20px' }}>
                  Chua co du lieu
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'center', gap: '10px', alignItems: 'center' }}>
        <button
          onClick={() => canPrev && fetchWithdraws(page - 1)}
          disabled={!canPrev}
          style={{ padding: '5px 15px', cursor: canPrev ? 'pointer' : 'not-allowed', background: '#f0f0f0', border: '1px solid #ccc', borderRadius: '4px' }}
        >
          Truoc
        </button>
        <span style={{ fontWeight: 'bold' }}>Trang {page} / {totalPages}</span>
        <button
          onClick={() => canNext && fetchWithdraws(page + 1)}
          disabled={!canNext}
          style={{ padding: '5px 15px', cursor: canNext ? 'pointer' : 'not-allowed', background: '#f0f0f0', border: '1px solid #ccc', borderRadius: '4px' }}
        >
          Sau
        </button>
      </div>
    </>
  );
}

export default WithdrawList;
