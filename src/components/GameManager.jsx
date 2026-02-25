import React, { useState, useEffect } from 'react';
import { useIpc } from '../components/ToastContext';

const GameManager = () => {
    const { invoke } = useIpc();
    const [settings, setSettings] = useState({});
    const [stats, setStats] = useState({});
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        loadSettings();
        loadStats();
        const interval = setInterval(loadStats, 3000);
        return () => clearInterval(interval);
    }, []);

    const loadSettings = async () => {
        const result = await invoke('get-settings');
        if (result.success && result.data) {
            setSettings(result.data);
        }
    };

    const loadStats = async () => {
        // Gọi IPC để lấy thống kê từ MiniGameHistory
        const result = await invoke('get-game-stats');
        console.log("Game Stats Result:", result); // Kiểm tra dữ liệu trả về trong Console (F12)

        if (result.success && result.data) {
            // Xử lý nếu dữ liệu trả về là mảng (từ aggregation)
            if (Array.isArray(result.data)) {
                const statsObj = {};
                // Dữ liệu từ aggregate đã có dạng { _id: 'game_key', revenue: X, profit: Y }
                // Chỉ cần chuyển nó thành object với key là _id
                result.data.forEach(item => {                    
                    statsObj[item._id] = item;
                });
                setStats(statsObj);
            } else {
                setStats(result.data);
            }
        }
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setSettings(prev => ({ ...prev, [name]: parseInt(value) || 0 }));
    };

    const handleSave = async () => {
        setLoading(true);
        const result = await invoke('save-settings', settings);
        setLoading(false);
        if (result.success) {
            alert('Đã lưu cấu hình game thành công!');
        } else {
            alert('Lỗi khi lưu: ' + result.message);
        }
    };

    const GameRow = ({ name, gameKey, minKey, maxKey, isFixed = false }) => {
        const gameStat = stats[gameKey] || { revenue: 0, profit: 0 };
        const profitColor = gameStat.profit >= 0 ? 'text-success' : 'text-danger';
        
        return (
        <tr>
            <td style={{ padding: '12px', borderBottom: '1px solid #eee', fontWeight: 'bold' }}>{name}</td>
            <td style={{ padding: '12px', borderBottom: '1px solid #eee' }}>
                <input 
                    type="number" 
                    name={minKey} 
                    value={settings[minKey] || 0} 
                    onChange={handleChange}
                    className="form-control"
                    style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                    disabled={!minKey}
                />
                {isFixed && <small style={{display:'block', color:'#666', marginTop:'4px'}}>* Cược cố định</small>}
            </td>
            <td style={{ padding: '12px', borderBottom: '1px solid #eee' }}>
                {!isFixed ? (
                    <input 
                        type="number" 
                        name={maxKey} 
                        value={settings[maxKey] || 0} 
                        onChange={handleChange}
                        className="form-control"
                        style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                    />
                ) : (
                    <span style={{ color: '#999' }}>---</span>
                )}
            </td>
            <td style={{ padding: '12px', borderBottom: '1px solid #eee', textAlign: 'center' }}>
                <span className="fw-bold">{gameStat.revenue.toLocaleString()} ₫</span>
            </td>
            <td style={{ padding: '12px', borderBottom: '1px solid #eee', textAlign: 'center' }}>
                <span className={`fw-bold ${profitColor}`}>{gameStat.profit.toLocaleString()} ₫</span>
            </td>
        </tr>
        );
    };

    return (
        <div className="card shadow-sm">
            <div className="card-header bg-primary text-white" style={{ padding: '15px', borderRadius: '8px 8px 0 0' }}>
                <h5 className="mb-0" style={{ margin: 0, fontSize: '18px', background: '#0f0e0e' }}>🎮 Quản Lý & Thống Kê Trò Chơi</h5>
            </div>
            <div className="card-body" style={{ padding: '20px', background: '#fff', borderRadius: '0 0 8px 8px' }}>
                <div className="table-responsive">
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ background: '#f8f9fa' }}>
                                <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #dee2e6' }}>Tên Trò Chơi</th>
                                <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #dee2e6', width: '20%' }}>Min Cược (VNĐ)</th>
                                <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #dee2e6', width: '20%' }}>Max Cược (VNĐ)</th>
                                <th style={{ padding: '12px', textAlign: 'center', borderBottom: '2px solid #dee2e6' }}>Doanh Thu (Tổng Cược)</th>
                                <th style={{ padding: '12px', textAlign: 'center', borderBottom: '2px solid #dee2e6' }}>Lợi Nhuận</th>
                            </tr>
                        </thead>
                        <tbody>
                            <GameRow name="🎲 Chẵn Lẻ Telegram" gameKey="cl_tele" minKey="minBetCL" maxKey="maxBetCL" />
                            <GameRow name="📈 Tài Xỉu Telegram" gameKey="tx_tele" minKey="minBetTX" maxKey="maxBetTX" />
                            <GameRow name="🎲 Xúc Xắc (Dice)" gameKey="dice_tele" minKey="minBetDice" maxKey="maxBetDice" />
                            <GameRow name="🎰 Slot Machine" gameKey="slot_tele" minKey="minBetSlot" maxKey="" isFixed={true} />
                            
                            {/* Các game Room (Cấu hình Min/Max chỉnh trong Room Panel, ở đây chỉ hiện thống kê) */}
                            <tr style={{background: '#f0f0f0'}}><td colSpan="5" style={{padding: '8px', fontWeight: 'bold', color: '#666'}}>--- GAME PHÒNG (ROOM) ---</td></tr>
                            <GameRow name="🔴 Tài Xỉu Thường" gameKey="tx" />
                            <GameRow name="⚫ Tài Xỉu MD5" gameKey="md5" />
                            <GameRow name="🔵 Tài Xỉu Khổng Minh" gameKey="khongminh" />
                        </tbody>
                    </table>
                </div>

                <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end' }}>
                    <button 
                        onClick={handleSave} 
                        disabled={loading}
                        style={{ padding: '10px 25px', background: '#28a745', color: '#fff', border: 'none', borderRadius: '5px', cursor: 'pointer', fontSize: '16px' }}
                    >
                        {loading ? 'Đang lưu...' : '💾 Lưu Cấu Hình'}
                    </button>
                </div>
                
                <p style={{ marginTop: '15px', color: '#666', fontSize: '13px', fontStyle: 'italic' }}>
                    * Lưu ý: Các thay đổi về Min/Max cược sẽ có hiệu lực ngay lập tức trên Bot.
                </p>
            </div>
        </div>
    );
};

export default GameManager;