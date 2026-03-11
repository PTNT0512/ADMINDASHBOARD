import React, { useEffect, useMemo, useState } from 'react';

const GAME_OPTIONS = [
  { id: 'tx', name: 'Tai xiu thuong' },
  { id: 'khongminh', name: 'Tai xiu Khong Minh' },
  { id: 'md5', name: 'Tai xiu MD5' },
  { id: 'taixiucao', name: 'Tai xiu Cao' },
  { id: 'taixiunan', name: 'Tai xiu Nan' },
  { id: 'aviator', name: 'Aviator' },
  { id: 'baccarat', name: 'Baccarat' },
  { id: 'xocdia', name: 'Xoc Dia' },
  { id: 'rongho', name: 'Rong Ho' },
  { id: 'booms', name: 'Booms' },
  { id: 'plinko', name: 'Plinko' },
  { id: 'xeng', name: 'Xeng' },
  { id: 'roulette', name: 'Roulette' },
  { id: 'trading', name: 'Trading' },
  { id: 'lottery', name: 'Lottery' },
  { id: 'lode', name: 'Lode' },
  { id: 'xoso', name: 'Xoso' },
  { id: 'xoso1phut', name: 'Xoso 1 phut' },
  { id: 'cl_tele', name: 'Chan le Tele' },
  { id: 'tx_tele', name: 'Tai xiu Tele' },
  { id: 'dice_tele', name: 'Xuc xac Tele' },
  { id: 'slot_tele', name: 'Slot Tele' },
];

const TELE_GAMES = new Set(['cl_tele', 'tx_tele', 'dice_tele', 'slot_tele']);

const normalizeGameType = (value) => {
  const raw = String(value || '').trim().toLowerCase();
  return GAME_OPTIONS.some((item) => item.id === raw) ? raw : 'tx';
};

const normalizeView = (value) => (String(value || '').trim().toLowerCase() === 'player' ? 'player' : 'session');

function GameHistory({
  initialGameType = 'tx',
  lockGameType = false,
  panelTitle = 'History Game',
  initialView = 'session',
}) {
  const [gameType, setGameType] = useState(normalizeGameType(initialGameType));
  const [activeView, setActiveView] = useState(normalizeView(initialView)); // session | player
  const [history, setHistory] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);

  const isTeleGame = TELE_GAMES.has(gameType);
  const selectedGame = useMemo(
    () => GAME_OPTIONS.find((item) => item.id === gameType) || GAME_OPTIONS[0],
    [gameType],
  );

  const fetchHistory = async (view, targetPage, targetGameType = gameType) => {
    if (!window.require) return;
    const safePage = Math.max(1, Number(targetPage) || 1);
    setLoading(true);

    try {
      const { ipcRenderer } = window.require('electron');
      const channel = view === 'player' ? 'get-game-player-history' : 'get-game-history';
      const result = await ipcRenderer.invoke(channel, {
        gameType: targetGameType,
        page: safePage,
        limit: 15,
      });

      if (result && result.success) {
        setHistory(Array.isArray(result.data) ? result.data : []);
        setPage(safePage);
        setTotalPages(Math.max(1, Number(result.totalPages) || 1));
      } else {
        setHistory([]);
        setPage(1);
        setTotalPages(1);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const nextGame = normalizeGameType(initialGameType);
    setGameType(nextGame);
  }, [initialGameType]);

  useEffect(() => {
    const nextView = normalizeView(initialView);
    if (TELE_GAMES.has(gameType) && nextView === 'session') {
      setActiveView('player');
      return;
    }
    setActiveView(nextView);
  }, [initialView, gameType]);

  useEffect(() => {
    if (TELE_GAMES.has(gameType) && activeView === 'session') {
      setActiveView('player');
    }
  }, [gameType, activeView]);

  useEffect(() => {
    fetchHistory(activeView, 1, gameType);
  }, [gameType, activeView]);

  const tabButtonStyle = (isActive) => ({
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    padding: '8px 14px',
    cursor: 'pointer',
    fontWeight: 700,
    background: isActive ? '#1f2937' : '#ffffff',
    color: isActive ? '#ffffff' : '#111827',
  });

  const renderSessionRows = () => {
    return history.map((item, index) => (
      <tr key={item.id || item._id || `${item.sessionId || 'session'}-${index}`}>
        <td>#{item.sessionId || '-'}</td>
        <td>{item.date ? new Date(item.date).toLocaleString('vi-VN') : '-'}</td>
        <td
          style={{
            fontWeight: 'bold',
            color: String(item.result || '').toLowerCase() === 'tai'
              ? '#e91e63'
              : (String(item.result || '').toLowerCase() === 'xiu' ? '#3f51b5' : '#111827'),
          }}
        >
          {String(item.result || '').toLowerCase() === 'tai'
            ? 'TAI'
            : (
              String(item.result || '').toLowerCase() === 'xiu'
                ? 'XIU'
                : (item.result ? String(item.result).toUpperCase() : '-')
            )}
        </td>
        <td>
          {(() => {
            const dice = Array.isArray(item.dice) && item.dice.length > 0
              ? item.dice
              : [item.dice1, item.dice2, item.dice3].filter((value) => Number.isFinite(Number(value)));
            return dice.length > 0 ? dice.join(' - ') : '-';
          })()}
        </td>
        <td>{Number(item.totalBet || 0).toLocaleString()}</td>
        <td>{Number(item.fee || 0).toLocaleString()}</td>
        <td style={{ fontWeight: 'bold', color: Number(item.profit || 0) >= 0 ? 'green' : 'red' }}>
          {Number(item.profit || 0).toLocaleString()}
        </td>
      </tr>
    ));
  };

  const renderPlayerRows = () => {
    return history.map((item, index) => {
      const isWin = typeof item.isWin === 'boolean'
        ? item.isWin
        : Number(item.winAmount || 0) > 0;

      return (
        <tr key={item.id || item._id || `${item.userId || 'u'}-${item.sessionId || 's'}-${index}`}>
          <td>{item.date ? new Date(item.date).toLocaleString('vi-VN') : '-'}</td>
          <td>{item.sessionId ? `#${item.sessionId}` : '-'}</td>
          <td>
            <div>{item.username || `User_${item.userId || 'N/A'}`}</div>
            <small style={{ color: '#666' }}>ID: {item.userId || '-'}</small>
          </td>
          <td style={{ fontWeight: 700 }}>{item.betType || '-'}</td>
          <td style={{ color: '#dc2626', fontWeight: 700 }}>
            {Number(item.betAmount || 0).toLocaleString()}
          </td>
          <td>
            {isWin
              ? <span style={{ color: 'green', fontWeight: 700 }}>THANG</span>
              : <span style={{ color: 'gray' }}>THUA</span>}
          </td>
          <td style={{ color: 'green', fontWeight: 700 }}>
            {item.winAmount === null || item.winAmount === undefined
              ? '-'
              : Number(item.winAmount || 0).toLocaleString()}
          </td>
        </tr>
      );
    });
  };

  const canPrev = page > 1 && !loading;
  const canNext = page < totalPages && !loading;

  return (
    <>
      <header>
        <h1>{panelTitle} - {selectedGame.name}</h1>
        {!lockGameType && (
          <div style={{ marginTop: '10px' }}>
            <select
              value={gameType}
              onChange={(e) => setGameType(normalizeGameType(e.target.value))}
              style={{ padding: '8px', borderRadius: '5px', border: '1px solid #ccc', minWidth: '220px' }}
            >
              {GAME_OPTIONS.map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
          </div>
        )}
      </header>

      <div style={{ display: 'flex', gap: '10px', margin: '12px 0 16px' }}>
        <button
          type="button"
          style={tabButtonStyle(activeView === 'session')}
          disabled={isTeleGame}
          onClick={() => {
            if (!isTeleGame) setActiveView('session');
          }}
        >
          Lich su phien
        </button>
        <button
          type="button"
          style={tabButtonStyle(activeView === 'player')}
          onClick={() => setActiveView('player')}
        >
          Lich su nguoi choi
        </button>
      </div>

      <div className="table-container">
        <table>
          <thead>
            {activeView === 'player' ? (
              <tr>
                <th>Thoi gian</th>
                <th>Phien</th>
                <th>Nguoi choi</th>
                <th>Cua cuoc</th>
                <th>Tien cuoc</th>
                <th>Ket qua</th>
                <th>Tien thang</th>
              </tr>
            ) : (
              <tr>
                <th>Phien</th>
                <th>Thoi gian</th>
                <th>Ket qua</th>
                <th>Xuc xac</th>
                <th>Tong cuoc</th>
                <th>Tien phe</th>
                <th>Loi nhuan</th>
              </tr>
            )}
          </thead>
          <tbody>
            {history.length > 0 && (activeView === 'player' ? renderPlayerRows() : renderSessionRows())}
            {history.length === 0 && (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '20px' }}>
                  {loading ? 'Dang tai du lieu...' : 'Chua co du lieu'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'center', gap: '10px', alignItems: 'center' }}>
        <button
          type="button"
          onClick={() => canPrev && fetchHistory(activeView, page - 1, gameType)}
          disabled={!canPrev}
          style={{ padding: '6px 15px', cursor: canPrev ? 'pointer' : 'not-allowed', background: '#f0f0f0', border: '1px solid #ccc', borderRadius: '4px' }}
        >
          Truoc
        </button>
        <span style={{ fontWeight: 'bold' }}>Trang {page} / {totalPages}</span>
        <button
          type="button"
          onClick={() => canNext && fetchHistory(activeView, page + 1, gameType)}
          disabled={!canNext}
          style={{ padding: '6px 15px', cursor: canNext ? 'pointer' : 'not-allowed', background: '#f0f0f0', border: '1px solid #ccc', borderRadius: '4px' }}
        >
          Sau
        </button>
      </div>
    </>
  );
}

export default GameHistory;
