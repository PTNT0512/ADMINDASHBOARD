import React, { useState, useEffect, useCallback, useRef } from 'react';
import Sidebar from './Sidebar';
import AgencyList from './AgencyList.jsx';
import CommissionSettings from './CommissionSettings.jsx';
import Settings from './Settings';
import UserList from './UserList';
import Balance from './Balance';
import Gift from './Gift';
import BanList from './BanList';
import Blacklist from './Blacklist';
import BankAuto from './BankAuto.jsx';
import EWallet from './EWallet';
import CpuMonitor from './CpuMonitor';
import ToolNotification from './ToolNotification';
import ToolCode from './ToolCode';
import BotManager from './BotManager';
import GameServerPanel from './GameServerPanel';
import DepositList from './DepositList';
import WithdrawList from './WithdrawList';
import GameHistory from './GameHistory';
import DailyCheckin from './DailyCheckin';
import Missions from './Missions';
import LuckyWheel from './LuckyWheel';
import TopRacing from './TopRacing';
import TxRoomPanel from './TxRoomPanel';
import Server1Panel from './Server1Panel';
import Server2Panel from './Server2Panel';
import Server3Panel from './Server3Panel';
import { useIpc, useToast } from "./ToastContext";
import GameManager from './GameManager.jsx';
import TaixiuResultPanel from './TaixiuResultPanel.jsx';
import RevenueChart from './RevenueChart.jsx';
import TaiXiuCao from './TaiXiuCao.jsx';
import TaiXiuNan from './TaiXiuNan.jsx';
import ServerManager from './ServerManager.jsx';
import { getSocket } from './socket';

// Component hỗ trợ hiệu ứng nhảy số
const CountUp = ({ end, duration = 1000, suffix = "" }) => {
  const [count, setCount] = useState(0);
  const countRef = useRef(0);

  useEffect(() => {
    let startTime = null;
    const startValue = countRef.current;

    const animate = (currentTime) => {
      if (!startTime) startTime = currentTime;
      const progress = Math.min((currentTime - startTime) / duration, 1);
      const currentValue = Math.floor(progress * (end - startValue) + startValue);
      
      setCount(currentValue);
      countRef.current = currentValue;

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }, [end, duration]);

  return <span>{count.toLocaleString()}{suffix}</span>;
};

function DashboardStats({ setActiveTab }) {
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalBalance: 0,
    totalDeposit: 0,
    totalWithdraw: 0,
    pendingDeposits: 0,
    pendingWithdraws: 0,
    todayNewUsers: 0
  });
  const [chartData, setChartData] = useState([]);
  const [botStatus, setBotStatus] = useState({ loading: true, connected: false, message: '' });
  const [isUpdating, setIsUpdating] = useState(false);
  const [appVersion, setAppVersion] = useState('');

  const fetchData = useCallback(async () => {
    setIsUpdating(true);
    if (window.require) {
      const { ipcRenderer } = window.require('electron');
      
      // Lấy thống kê chung
      const result = await ipcRenderer.invoke('get-dashboard-stats');
      if (result.success) setStats(result.data);

      // Kiểm tra trạng thái Bot Chính
      const botRes = await ipcRenderer.invoke('check-main-bot-status');
      setBotStatus({ loading: false, connected: botRes.success, message: botRes.message });

      // Lấy phiên bản ứng dụng
      const ver = await ipcRenderer.invoke('get-app-version').catch(() => 'Dev');
      setAppVersion(ver);

      // Mock dữ liệu biểu đồ (Giả lập dữ liệu 7 ngày)
      const days = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
      const mockData = Array.from({length: 7}, (_, i) => {
          const d = new Date();
          d.setDate(d.getDate() - (6 - i));
          return {
              label: `${days[d.getDay()]}`,
              value: Math.floor(Math.random() * 50000000) + 10000000 // Random từ 10M đến 60M
          };
      });
      setChartData(mockData);
    }
    // Giữ hiệu ứng chạy trong 2 giây để tạo cảm giác hệ thống đang quét dữ liệu
    setTimeout(() => setIsUpdating(false), 2000);
  }, []);

  const handleCheckUpdate = async () => {
    if (window.require) {
      const { ipcRenderer } = window.require('electron');
      const res = await ipcRenderer.invoke('check-for-update');
      alert(res.message);
    }
  };

  useEffect(() => { fetchData(); }, [fetchData]);

  const Card = ({ title, value, color, suffix = "" }) => {
    const prevValue = useRef(value);
    const [dynamicColor, setDynamicColor] = useState(color);

    useEffect(() => {
      if (value !== prevValue.current) {
        if (value > prevValue.current) setDynamicColor('var(--success)');
        else setDynamicColor('var(--danger)');
        const timer = setTimeout(() => setDynamicColor(color), 2000);
        prevValue.current = value;
        return () => clearTimeout(timer);
      }
    }, [value, color]);

    return (
      <div className={`stat-card ${isUpdating ? 'updating' : ''}`} style={{
        background: 'var(--card-bg)',
        padding: '18px',
        borderRadius: '10px',
        boxShadow: '0 6px 18px rgba(15,23,42,0.04)',
        border: `1px solid rgba(15,23,42,0.04)`,
        display: 'flex', flexDirection: 'column', justifyContent: 'space-between', transition: 'all 0.25s ease'
      }}>
        <div style={{ color: 'var(--text-secondary)', fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '8px' }}>{title}</div>
        <div style={{ fontSize: '26px', fontWeight: 800, color: dynamicColor, transition: 'color 0.3s ease' }}>
          <CountUp end={value} suffix={suffix} />
        </div>
      </div>
    );
  };

  return (
    <>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <h1><i className="fas fa-chart-simple" style={{marginRight: '12px'}}></i>Admin Dashboard</h1>
          {appVersion && <span style={{ marginLeft: '12px', fontSize: '13px', color: 'var(--text-secondary)', background: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: '4px', border: '1px solid var(--border-color)' }}>v{appVersion}</span>}
        </div>
        <div style={{ 
          fontSize: '12px', 
          color: botStatus.connected ? 'var(--success)' : 'var(--danger)', 
          border: `1px solid ${botStatus.connected ? 'rgba(52,211,153,0.12)' : 'rgba(251,113,133,0.12)'}`, 
          padding: '6px 14px', 
          borderRadius: '8px', 
          background: 'var(--card-bg)',
          textAlign: 'right'
        }}>
          <i className={`fas ${botStatus.loading ? 'fa-spinner fa-spin' : (botStatus.connected ? 'fa-check-circle' : 'fa-exclamation-triangle')}`} style={{ marginRight: '8px' }}></i>
          MAIN BOT: {botStatus.loading ? 'Checking...' : botStatus.message}
        </div>
      </header>
      <div className="settings-container" style={{ background: 'transparent', border: 'none', boxShadow: 'none', padding: '0 24px' }}>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px', marginBottom: '30px' }}>
          <Card 
            title="Tổng Thành Viên" 
            value={stats.totalUsers} 
            color="#2196f3" 
          />
          <Card 
            title="Thành Viên Mới (Hôm nay)" 
            value={stats.todayNewUsers} 
            color="#00bcd4" 
          />
          <Card 
            title="Tổng Số Dư Hệ Thống" 
            value={stats.totalBalance} 
            color="#4caf50" 
            suffix=" VNĐ"
          />
        </div>

        {/* Biểu đồ doanh thu */}
        <RevenueChart data={chartData} />

        <h3 style={{ marginBottom: '15px', color: 'var(--text)', textTransform: 'none', letterSpacing: '0.2px' }}>Báo Cáo Giao Dịch</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px' }}>
          <Card 
            title="Tổng Nạp" 
            value={stats.totalDeposit} 
            color="#ff9800" 
            suffix=" VNĐ"
          />
          <Card 
            title="Tổng Rút" 
            value={stats.totalWithdraw} 
            color="#f44336" 
            suffix=" VNĐ"
          />
          <Card 
            title="Nạp Chờ Duyệt" 
            value={stats.pendingDeposits} 
            color="#ffc107" 
          />
          <Card 
            title="Rút Chờ Duyệt" 
            value={stats.pendingWithdraws} 
            color="#ff5722" 
          />
        </div>

        <div style={{ marginTop: '30px', textAlign: 'center' }}>
          <button onClick={fetchData} className="btn"><i className="fas fa-sync-alt" style={{marginRight: '10px'}}></i>Refresh</button>
          <button onClick={handleCheckUpdate} className="btn" style={{ marginLeft: '15px', backgroundColor: '#9c27b0' }}>
            <i className="fas fa-cloud-download-alt" style={{marginRight: '10px'}}></i>Cập nhật phiên bản
          </button>
        </div>

      </div>
    </>
  );
}

function Dashboard({ onLogout }) {
  const [activeTab, setActiveTab] = useState('dashboard');
  
  // States cho Sidebar
  const [isMembersExpanded, setIsMembersExpanded] = useState(false);
  const [isAgencyExpanded, setIsAgencyExpanded] = useState(false);
  const [isBankingExpanded, setIsBankingExpanded] = useState(false);
  const [isToolExpanded, setIsToolExpanded] = useState(false);
  const [isTransactionExpanded, setIsTransactionExpanded] = useState(false);
  const [isMinigameExpanded, setIsMinigameExpanded] = useState(false);
  const [isTxRoomExpanded, setIsTxRoomExpanded] = useState(false);
  const [isGamesExpanded, setIsGamesExpanded] = useState(false);
  const [isTaiXiuCaoNanExpanded, setIsTaiXiuCaoNanExpanded] = useState(false);

  // States cho các component con
  const [users, setUsers] = useState([]);
  const [settings, setSettings] = useState({});
  const { invoke } = useIpc();
  const { showToast } = useToast();

  // Load settings từ DB khi component mount
  useEffect(() => {
    const loadSettings = async () => {
      const result = await invoke('get-settings');
      if (result.success && result.data) {
        const { _id, __v, ...dbSettings } = result.data;
        setSettings(prev => ({ ...prev, ...dbSettings }));
      }
    };
    loadSettings();
  }, [invoke]);

  // Lắng nghe sự kiện nạp tiền ZaloPay thành công từ Server
  useEffect(() => {
    const socket = getSocket();
    
    // Log khi kết nối socket thành công để đảm bảo Dashboard đang online
    socket.on('connect', () => console.log('✅ [Dashboard] Socket connected:', socket.id));

    const handleZaloPaySuccess = async (data) => {
      console.log('💰 [Dashboard] ZaloPay Deposit Success:', data);
      showToast(`✅ Nạp ZaloPay thành công: ${data.amount.toLocaleString()}đ`, 'success');
      
      // Gửi yêu cầu cho Main Process để Bot thông báo
      const content = `✅ <b>NẠP TIỀN ZALOPAY THÀNH CÔNG</b>\n\n` +
                      `💰 Số tiền: <b>${parseInt(data.amount).toLocaleString()} ₫</b>\n` +
                      `📝 Mã GD: <code>${data.transId}</code>\n` +
                      `💵 Số dư mới: <b>${parseInt(data.balance).toLocaleString()} ₫</b>\n\n` +
                      `Cảm ơn bạn đã tin tưởng và sử dụng dịch vụ!`;
      
      const res = await invoke('send-notification', { userId: data.userId, content });
      if (!res.success) {
          console.error('❌ [Dashboard] Bot notify failed:', res.message);
          showToast(`⚠️ Lỗi gửi tin nhắn Bot: ${res.message}`, 'warning');
      } else {
          console.log('✅ [Dashboard] Bot notified user successfully');
      }
    };

    socket.on('zalopay_deposit_success', handleZaloPaySuccess);
    return () => {
      socket.off('zalopay_deposit_success', handleZaloPaySuccess);
    };
  }, [invoke, showToast]);

  // Hàm tải danh sách user
  const fetchUsers = useCallback(async () => {
    const result = await invoke('get-users');
    if (result.success) {
      setUsers(result.data);
    }
  }, [invoke]);

  // Tải danh sách user khi vào tab 'users'
  useEffect(() => {
    if (activeTab === 'users') {
      fetchUsers();
    }
  }, [activeTab, fetchUsers]);

  const handleSettingChange = (e) => {
    const { name, value, type, checked } = e.target;
    setSettings(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSaveSettings = async () => {
    const result = await invoke('save-settings', settings);
    if (result.success) {
      alert('Lưu cài đặt thành công!');
    } else {
      alert(result.message);
    }
  };

  return (
    <div className="dashboard-layout">
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab}
        
        isMembersExpanded={isMembersExpanded}
        setIsMembersExpanded={setIsMembersExpanded}
        
        isAgencyExpanded={isAgencyExpanded}
        setIsAgencyExpanded={setIsAgencyExpanded}
        
        isBankingExpanded={isBankingExpanded}
        setIsBankingExpanded={setIsBankingExpanded}
        
        isToolExpanded={isToolExpanded}
        setIsToolExpanded={setIsToolExpanded}
        
        isTransactionExpanded={isTransactionExpanded}
        setIsTransactionExpanded={setIsTransactionExpanded}
        
        isMinigameExpanded={isMinigameExpanded}
        setIsMinigameExpanded={setIsMinigameExpanded}
        
        isTxRoomExpanded={isTxRoomExpanded}
        setIsTxRoomExpanded={setIsTxRoomExpanded}
        
        isGamesExpanded={isGamesExpanded}
        setIsGamesExpanded={setIsGamesExpanded}
        
        isTaiXiuCaoNanExpanded={isTaiXiuCaoNanExpanded}
        setIsTaiXiuCaoNanExpanded={setIsTaiXiuCaoNanExpanded}
        
        onLogout={onLogout}
      />
      
      <main className="dashboard-content">
        {activeTab === 'dashboard' && <DashboardStats setActiveTab={setActiveTab} />}
        
        {/* Đại lý */}
        {activeTab === 'agency_list' && <AgencyList />}
        {activeTab === 'commission_settings' && <CommissionSettings />}
        
        {/* Thành viên */}
        {activeTab === 'users' && <UserList users={users} onRefresh={fetchUsers} />}
        {activeTab === 'balance' && <Balance />}
        {activeTab === 'gift' && <Gift />}
        {activeTab === 'ban_list' && <BanList />}
        {activeTab === 'blacklist' && <Blacklist />}

        {/* Nạp Rút */}
        {activeTab === 'deposits' && <DepositList />}
        {activeTab === 'withdraws' && <WithdrawList />}
        {activeTab === 'game_history' && <GameHistory />}

        {/* Ngân hàng */}
        {activeTab === 'bank_auto' && <BankAuto invoke={invoke} showToast={showToast} />}
        {activeTab === 'e_wallet' && <EWallet />}

        {/* Trò chơi */}
        {activeTab === 'taixiu_cao' && <TaiXiuCao />}
        {activeTab === 'taixiu_nan' && <TaiXiuNan />}

        {/* Cấu hình Game & Kết quả */}
        {activeTab === 'game_config' && <GameManager />}

        {/* TX Room */}
        {activeTab === 'tx_room' && <TxRoomPanel title="Tài Xỉu Room" roomType="tx" />}
        {activeTab === 'tx_md5_room' && <TxRoomPanel title="Tài Xỉu MD5 Room" roomType="md5" />}
        {activeTab === 'tx_khongminh_room' && <TxRoomPanel title="Tài Xỉu Khổng Minh Room 1" roomType="khongminh" />}

        {/* Minigame */}
        {activeTab === 'tool_code' && <ToolCode />}
        {activeTab === 'daily_checkin' && <DailyCheckin />}
        {activeTab === 'missions' && <Missions />}
        {activeTab === 'lucky_wheel' && <LuckyWheel />}
        {activeTab === 'top_racing' && <TopRacing />}

        {/* Tool */}
        {activeTab === 'tool_notification' && <ToolNotification />}

        {/* Hệ thống */}
        {activeTab === 'bot_manager' && <BotManager />}
        {activeTab === 'server_manager' && <ServerManager />}
        {activeTab === 'game_server' && <GameServerPanel />}
        {activeTab === 'server_1' && <Server1Panel />}
        {activeTab === 'server_2' && <Server2Panel />}
        {activeTab === 'server_3' && <Server3Panel />}
        {activeTab === 'cpu_monitor' && <CpuMonitor />}
        {activeTab === 'settings' && (
          <Settings 
            settings={settings} 
            onSettingChange={handleSettingChange} 
            onSaveSettings={handleSaveSettings} 
          />
        )}
      </main>
    </div>
  );
}

export default Dashboard;