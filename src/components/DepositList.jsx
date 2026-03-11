import React, { useEffect, useMemo, useState } from 'react';

function DepositList({ mode = 'history' }) {
  const viewMode = mode === 'error' ? 'error' : 'history';
  const [deposits, setDeposits] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const title = useMemo(
    () => (viewMode === 'error' ? 'Lenh Nap Loi' : 'Lich Su Nap'),
    [viewMode],
  );

  const fetchDeposits = async (p = 1) => {
    if (!window.require) return;
    const { ipcRenderer } = window.require('electron');
    const result = await ipcRenderer.invoke('get-deposits', {
      page: p,
      limit: 10,
      filterType: viewMode,
    });
    if (result && result.success) {
      setDeposits(Array.isArray(result.data) ? result.data : []);
      setPage(p);
      setTotalPages(Math.max(1, Number(result.totalPages) || 1));
    } else {
      setDeposits([]);
      setPage(1);
      setTotalPages(1);
    }
  };

  useEffect(() => {
    fetchDeposits(1);
  }, [viewMode]);

  const renderStatus = (status) => {
    if (status === 0) return <span style={{ color: 'orange', fontWeight: 'bold' }}>Cho duyet</span>;
    if (status === 1) return <span style={{ color: 'green', fontWeight: 'bold' }}>Thanh cong</span>;
    return <span style={{ color: 'red', fontWeight: 'bold' }}>Loi/Huy</span>;
  };

  const handleManualApprove = async (item) => {
    if (!window.require) return;
    const currentId = item && (item._id || item.id);
    if (!currentId) return;

    const suggested = Number(item.realAmount || item.amount || 0);
    const raw = window.prompt('Nhap so tien thuc nhan de duyet tay:', String(suggested));
    if (raw === null) return;

    const creditAmount = Number(String(raw).replace(/[^\d]/g, ''));
    if (!Number.isFinite(creditAmount) || creditAmount <= 0) {
      window.alert('So tien khong hop le.');
      return;
    }

    const confirmText = `Xac nhan duyet tay lenh nap ${creditAmount.toLocaleString('vi-VN')} d?`;
    if (!window.confirm(confirmText)) return;

    const { ipcRenderer } = window.require('electron');
    const result = await ipcRenderer.invoke('handle-deposit-error', {
      id: currentId,
      creditAmount,
    });

    if (result && result.success) {
      window.alert('Da duyet tay lenh nap loi.');
      fetchDeposits(1);
      return;
    }
    window.alert(`Loi: ${result?.message || 'Khong xu ly duoc lenh nap loi.'}`);
  };

  const canPrev = page > 1;
  const canNext = page < totalPages;

  return (
    <>
      <header>
        <h1>{title}</h1>
      </header>
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Thoi gian</th>
              <th>User ID</th>
              <th>So tien</th>
              {viewMode === 'error' && <th>Thuc nhan</th>}
              <th>Phuong thuc</th>
              <th>Ma GD</th>
              {viewMode === 'error' && <th>Mo ta loi</th>}
              <th>Trang thai</th>
              {viewMode === 'error' && <th>Hanh dong</th>}
            </tr>
          </thead>
          <tbody>
            {deposits.map((item) => (
              <tr key={item._id || item.id}>
                <td>{item.date ? new Date(item.date).toLocaleString('vi-VN') : '-'}</td>
                <td>{item.userId || '-'}</td>
                <td style={{ fontWeight: 'bold', color: '#2e7d32' }}>
                  {Number(item.amount || 0).toLocaleString('vi-VN')}
                </td>
                {viewMode === 'error' && (
                  <td style={{ fontWeight: 'bold', color: 'red' }}>
                    {item.realAmount ? Number(item.realAmount).toLocaleString('vi-VN') : '-'}
                  </td>
                )}
                <td>{item.method || '-'}</td>
                <td>{item.transId || item.requestId || '-'}</td>
                {viewMode === 'error' && (
                  <td style={{ fontSize: '12px', color: '#666' }}>
                    {item.description || '-'}
                  </td>
                )}
                <td>{renderStatus(Number(item.status))}</td>
                {viewMode === 'error' && (
                  <td>
                    <button
                      className="edit-btn"
                      onClick={() => handleManualApprove(item)}
                      style={{ color: '#0f766e', borderColor: '#0f766e' }}
                    >
                      Duyet tay
                    </button>
                  </td>
                )}
              </tr>
            ))}
            {deposits.length === 0 && (
              <tr>
                <td colSpan={viewMode === 'error' ? 9 : 6} style={{ textAlign: 'center', padding: '20px' }}>
                  Chua co du lieu
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'center', gap: '10px', alignItems: 'center' }}>
        <button
          onClick={() => canPrev && fetchDeposits(page - 1)}
          disabled={!canPrev}
          style={{ padding: '5px 15px', cursor: canPrev ? 'pointer' : 'not-allowed', background: '#f0f0f0', border: '1px solid #ccc', borderRadius: '4px' }}
        >
          Truoc
        </button>
        <span style={{ fontWeight: 'bold' }}>Trang {page} / {totalPages}</span>
        <button
          onClick={() => canNext && fetchDeposits(page + 1)}
          disabled={!canNext}
          style={{ padding: '5px 15px', cursor: canNext ? 'pointer' : 'not-allowed', background: '#f0f0f0', border: '1px solid #ccc', borderRadius: '4px' }}
        >
          Sau
        </button>
      </div>
    </>
  );
}

export default DepositList;
