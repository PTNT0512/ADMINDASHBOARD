import React, { useState, useEffect } from 'react';

function GameHistory() {
  const [history, setHistory] = useState([]);
  const [gameType, setGameType] = useState('tx'); // Mặc định Tài Xỉu Thường
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchHistory = async (p = 1) => {
    if (window.require) {
      const { ipcRenderer } = window.require('electron');
      const result = await ipcRenderer.invoke('get-game-history', { gameType, page: p, limit: 15 });
      if (result.success) {
        setHistory(result.data);
        setPage(p);
        setTotalPages(result.totalPages || 1);
      }
    }
  };

  useEffect(() => { fetchHistory(1); }, [gameType]);

  const isTeleGame = ['cl_tele', 'tx_tele', 'dice_tele', 'slot_tele'].includes(gameType);

  return (
    <>
      <header>
        <h1>Lịch Sử Cược</h1>
        <div style={{ marginTop: '10px' }}>
          <select 
            value={gameType} 
            onChange={(e) => setGameType(e.target.value)}
            style={{ padding: '8px', borderRadius: '5px', border: '1px solid #ccc', minWidth: '200px' }}
          >
            <option value="tx">🔴 Tài Xỉu Thường</option>
            <option value="md5">⚫ Tài Xỉu MD5</option>
            <option value="khongminh">🔵 Tài Xỉu Khổng Minh</option>
            <option value="taixiucao">🎲 Tài Xỉu Cào</option>
            <option value="taixiunan">🤏 Tài Xỉu Nặn</option>
            <option value="cl_tele">🌓 Chẵn Lẻ Tele</option>
            <option value="tx_tele">📱 Tài Xỉu Tele</option>
            <option value="dice_tele">🎲 Xúc Xắc Tele</option>
            <option value="slot_tele">🎰 Slot Tele</option>
          </select>
        </div>
      </header>
      
      <div className="table-container">
        <table>
          <thead>
            {isTeleGame ? (
              <tr>
                <th>Thời gian</th>
                <th>Người chơi</th>
                <th>Loại cược</th>
                <th>Tiền cược</th>
                <th>Tiền thắng</th>
                <th>Trạng thái</th>
              </tr>
            ) : (
              <tr>
                <th>Phiên</th>
                <th>Thời gian</th>
                <th>Kết quả</th>
                <th>Xúc xắc</th>
                <th>Tổng Cược</th>
                <th>Tiền Phế</th>
                <th>Lợi Nhuận</th>
              </tr>
            )}
          </thead>
          <tbody>
            {history.map(item => (
              <tr key={item.id || item._id}>
                {isTeleGame ? (
                  <>
                    <td>{new Date(item.date).toLocaleString('vi-VN')}</td>
                    <td>
                      <div>{item.username}</div>
                      <small style={{color: '#666'}}>ID: {item.userId}</small>
                    </td>
                    <td style={{ fontWeight: 'bold' }}>{item.betType}</td>
                    <td style={{ color: 'red', fontWeight: 'bold' }}>{item.betAmount?.toLocaleString()}</td>
                    <td style={{ color: 'green', fontWeight: 'bold' }}>{item.winAmount?.toLocaleString()}</td>
                    <td>{item.winAmount > 0 ? <span style={{color:'green', fontWeight:'bold'}}>THẮNG</span> : <span style={{color:'gray'}}>THUA</span>}</td>
                  </>
                ) : (
                  <>
                    <td>#{item.sessionId}</td>
                    <td>{new Date(item.date).toLocaleString('vi-VN')}</td>
                    <td style={{ fontWeight: 'bold', color: item.result === 'Tai' ? '#e91e63' : '#3f51b5' }}>
                      {item.result === 'Tai' ? 'TÀI' : 'XỈU'}
                    </td>
                    <td>{item.dice ? item.dice.join(' - ') : '-'}</td>
                    <td>{item.totalBet?.toLocaleString()}</td>
                    <td>{item.fee?.toLocaleString()}</td>
                    <td style={{ fontWeight: 'bold', color: item.profit >= 0 ? 'green' : 'red' }}>
                      {item.profit?.toLocaleString()}
                    </td>
                  </>
                )}
              </tr>
            ))}
            {history.length === 0 && <tr><td colSpan="7" style={{textAlign: 'center', padding: '20px'}}>Chưa có dữ liệu</td></tr>}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'center', gap: '10px', alignItems: 'center' }}>
        <button onClick={() => fetchHistory(page - 1)} disabled={page <= 1} style={{ padding: '5px 15px', cursor: page <= 1 ? 'not-allowed' : 'pointer', background: '#f0f0f0', border: '1px solid #ccc', borderRadius: '4px' }}>Trước</button>
        <span style={{ fontWeight: 'bold' }}>Trang {page} / {totalPages}</span>
        <button onClick={() => fetchHistory(page + 1)} disabled={page >= totalPages} style={{ padding: '5px 15px', cursor: page >= totalPages ? 'not-allowed' : 'pointer', background: '#f0f0f0', border: '1px solid #ccc', borderRadius: '4px' }}>Sau</button>
      </div>
    </>
  );
}

export default GameHistory;