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
import TaixiuResultPanel from './TaixiuResultPanel.jsx';
import ServerManager from './ServerManager.jsx';
import SessionControlManager from './SessionControlManager.jsx';
import WinRateManager from './WinRateManager.jsx';
import TradingMarketControl from './TradingMarketControl.jsx';
import LandingSettings from './LandingSettings.jsx';
import CskhUserManager from './CskhUserManager.jsx';
import GameMenuButtonManager from './GameMenuButtonManager.jsx';
import BotContentManager from './BotContentManager.jsx';
import SetTaiXiuManager from './SetTaiXiuManager.jsx';
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
    todayNewUsers: 0,
    totalBet: 0,
    totalWin: 0,
    totalLose: 0,
    profitToday: 0,
    profitWeek: 0,
    profitMonth: 0
  });
  const [botStatus, setBotStatus] = useState({ loading: true, connected: false, message: '' });
  const [isUpdating, setIsUpdating] = useState(false);
  const [appVersion, setAppVersion] = useState('-');
  const [updateStatus, setUpdateStatus] = useState({
    message: '',
    checking: false,
    available: false,
    downloading: false,
    downloaded: false,
    progress: 0,
    latestVersion: null,
    isPortable: false,
    isWebOnly: false,
    manualUpdate: false,
    releasePage: '',
    licenseAllowsUpdates: true,
    licenseUpdateMessage: '',
  });

  const { invoke } = useIpc();
  const { showToast } = useToast();

  const fetchData = useCallback(async () => {
    setIsUpdating(true);

    try {
      const [statsRes, botRes, versionRes, updaterRes] = await Promise.all([
        invoke('get-dashboard-stats'),
        invoke('check-main-bot-status'),
        invoke('get-app-version'),
        invoke('get-update-state'),
      ]);

      if (statsRes?.success && statsRes.data) setStats(statsRes.data);
      setBotStatus({ loading: false, connected: !!botRes?.success, message: botRes?.message || 'Offline' });

      if (versionRes?.success && versionRes.version) {
        setAppVersion(String(versionRes.version));
      }

      if (updaterRes?.success && updaterRes.data) {
        setUpdateStatus((prev) => ({ ...prev, ...updaterRes.data }));
      }

    } catch (error) {
      console.error('Dashboard fetchData error:', error);
    } finally {
      setTimeout(() => setIsUpdating(false), 500);
    }
  }, [invoke]);

  const handleCheckUpdate = useCallback(async () => {
    const result = await invoke('check-for-updates');
    if (!result?.success) {
      showToast(result?.message || 'Khong the kiem tra cap nhat', 'error');
      if (result?.data) {
        setUpdateStatus((prev) => ({ ...prev, ...result.data }));
      }
      return;
    }
    showToast(result.message || 'Da bat dau kiem tra cap nhat', 'info');
    if (result?.data) {
      setUpdateStatus((prev) => ({ ...prev, ...result.data }));
    }
  }, [invoke, showToast]);

  const handleDownloadUpdate = useCallback(async () => {
    const result = await invoke('download-update');
    if (!result?.success) {
      showToast(result?.message || 'Khong the tai cap nhat', 'error');
      return;
    }
    showToast(result.message || 'Dang tai cap nhat', 'info');
  }, [invoke, showToast]);

  const handleInstallUpdate = useCallback(async () => {
    const result = await invoke('install-update');
    if (!result?.success) {
      showToast(result?.message || 'Khong the cai dat cap nhat', 'error');
      return;
    }
    showToast(result.message || 'Dang cai dat cap nhat', 'success');
  }, [invoke, showToast]);

  const handleOpenReleasePage = useCallback(async () => {
    const result = await invoke('open-update-page');
    const releaseUrl = result?.url || updateStatus.releasePage;
    const isElectronRuntime = !!(window && window.process && window.process.versions && window.process.versions.electron);

    if (result?.blocked || updateStatus.licenseAllowsUpdates === false) {
      showToast(result?.message || updateStatus.licenseUpdateMessage || 'Key hien tai khong duoc phep cap nhat tu GitHub', 'error');
      return;
    }

    if (!result?.success) {
      if (!isElectronRuntime && releaseUrl) {
        window.open(releaseUrl, '_blank', 'noopener,noreferrer');
      }
      showToast(result?.message || 'Khong mo duoc trang cap nhat', 'error');
      return;
    }

    if (!isElectronRuntime && releaseUrl) {
      window.open(releaseUrl, '_blank', 'noopener,noreferrer');
    }

    showToast(result.message || 'Da mo trang cap nhat', 'info');
  }, [invoke, showToast, updateStatus.releasePage]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (!window.require) return undefined;

    let ipcRenderer;
    try {
      ipcRenderer = window.require('electron').ipcRenderer;
    } catch (error) {
      return undefined;
    }

    const onUpdateStatus = (_event, payload) => {
      if (!payload) return;
      setUpdateStatus((prev) => ({ ...prev, ...payload }));
      if (payload.currentVersion) {
        setAppVersion(String(payload.currentVersion));
      }
    };

    ipcRenderer.on('update-status', onUpdateStatus);
    return () => {
      ipcRenderer.removeListener('update-status', onUpdateStatus);
    };
  }, []);

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
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <h1><i className="fas fa-chart-simple" style={{ marginRight: '12px' }}></i>Admin Dashboard</h1>
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)', border: '1px solid rgba(15,23,42,0.08)', borderRadius: '8px', padding: '4px 10px', background: 'var(--card-bg)' }}>
            v{appVersion}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <button onClick={handleCheckUpdate} className="btn" disabled={updateStatus.checking || updateStatus.licenseAllowsUpdates === false} style={{ padding: '8px 12px', opacity: updateStatus.licenseAllowsUpdates === false ? 0.6 : 1, cursor: updateStatus.licenseAllowsUpdates === false ? 'not-allowed' : 'pointer' }}>
            <i className={`fas ${updateStatus.checking ? 'fa-spinner fa-spin' : 'fa-cloud-arrow-down'}`} style={{ marginRight: '8px' }}></i>
            {updateStatus.licenseAllowsUpdates === false ? 'Cap nhat bi khoa' : 'Kiem tra cap nhat'}
          </button>

          {updateStatus.licenseAllowsUpdates !== false && updateStatus.available && !updateStatus.downloaded && !updateStatus.isPortable && !updateStatus.isWebOnly && !updateStatus.manualUpdate && (
            <button onClick={handleDownloadUpdate} className="btn" style={{ padding: '8px 12px', background: '#2563eb' }}>
              {updateStatus.downloading ? `Dang tai ${updateStatus.progress || 0}%` : 'Tai ban moi'}
            </button>
          )}

          {updateStatus.licenseAllowsUpdates !== false && updateStatus.downloaded && !updateStatus.isPortable && !updateStatus.isWebOnly && !updateStatus.manualUpdate && (
            <button onClick={handleInstallUpdate} className="btn" style={{ padding: '8px 12px', background: '#16a34a' }}>
              Cai dat & khoi dong lai
            </button>
          )}

          {updateStatus.licenseAllowsUpdates !== false && (updateStatus.isPortable || updateStatus.isWebOnly || updateStatus.manualUpdate) && updateStatus.available && (
            <button onClick={handleOpenReleasePage} className="btn" style={{ padding: '8px 12px', background: '#f59e0b' }}>
              {updateStatus.isWebOnly ? 'Mo GitHub Releases' : 'Mo trang tai ban moi'}
            </button>
          )}

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
        </div>
      </header>

      {updateStatus.licenseAllowsUpdates === false && updateStatus.licenseUpdateMessage && (
        <div style={{
          marginTop: '10px',
          marginBottom: '14px',
          fontSize: '13px',
          color: '#b91c1c',
          background: '#fee2e2',
          border: '1px solid #fecaca',
          padding: '10px 12px',
          borderRadius: '8px'
        }}>
          {updateStatus.licenseUpdateMessage}
        </div>
      )}

      {updateStatus.message && (
        <div style={{
          marginTop: '10px',
          marginBottom: '14px',
          fontSize: '13px',
          color: updateStatus.error ? '#b91c1c' : '#0f172a',
          background: updateStatus.error ? '#fee2e2' : '#e0f2fe',
          border: `1px solid ${updateStatus.error ? '#fecaca' : '#bae6fd'}`,
          padding: '10px 12px',
          borderRadius: '8px'
        }}>
          {updateStatus.message}
          {updateStatus.latestVersion ? ` (Latest: ${updateStatus.latestVersion})` : ''}
        </div>
      )}

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

        <h3 style={{ marginTop: '24px', marginBottom: '15px', color: 'var(--text)', textTransform: 'none', letterSpacing: '0.2px' }}>Báo Cáo Cược</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px' }}>
          <Card
            title="Tổng Cược"
            value={stats.totalBet}
            color="#0284c7"
            suffix=" VNĐ"
          />
          <Card
            title="Tổng Thắng"
            value={stats.totalWin}
            color="#16a34a"
            suffix=" VNĐ"
          />
          <Card
            title="Tổng Thua"
            value={stats.totalLose}
            color="#b91c1c"
            suffix=" VNĐ"
          />
          <Card
            title="Lợi Nhuận Ngày"
            value={stats.profitToday}
            color={stats.profitToday >= 0 ? '#16a34a' : '#b91c1c'}
            suffix=" VNĐ"
          />
          <Card
            title="Lợi Nhuận Tuần"
            value={stats.profitWeek}
            color={stats.profitWeek >= 0 ? '#16a34a' : '#b91c1c'}
            suffix=" VNĐ"
          />
          <Card
            title="Lợi Nhuận Tháng"
            value={stats.profitMonth}
            color={stats.profitMonth >= 0 ? '#16a34a' : '#b91c1c'}
            suffix=" VNĐ"
          />
        </div>

        <div style={{ marginTop: '30px', textAlign: 'center' }}>
          <button onClick={fetchData} className="btn"><i className="fas fa-sync-alt" style={{marginRight: '10px'}}></i>Refresh</button>
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
  const [isSetTaiXiuExpanded, setIsSetTaiXiuExpanded] = useState(false);
  const [isGameHistoryExpanded, setIsGameHistoryExpanded] = useState(false);
  const [isGameHistory2Expanded, setIsGameHistory2Expanded] = useState(false);
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
    const nextValue = type === 'checkbox'
      ? checked
      : (type === 'number' ? (value === '' ? '' : Number(value)) : value);

    if (!name.includes('.')) {
      setSettings(prev => ({
        ...prev,
        [name]: nextValue
      }));
      return;
    }

    const path = name.split('.');
    setSettings(prev => {
      const next = { ...(prev || {}) };
      let cursor = next;

      for (let i = 0; i < path.length - 1; i += 1) {
        const key = path[i];
        const current = cursor[key];
        cursor[key] = current && typeof current === 'object' ? { ...current } : {};
        cursor = cursor[key];
      }

      cursor[path[path.length - 1]] = nextValue;
      return next;
    });
  };

  const handleSaveSettings = async () => {
    const result = await invoke('save-settings', settings);
    if (result.success) {
      alert('Luu cai dat thanh cong!');
    } else {
      alert(result.message);
    }
  };

  const handleOptimizeNow = async () => {
    const result = await invoke('optimize-resources-now');
    if (result?.success) {
      showToast(result.message || 'Da toi uu tai nguyen.', 'success');
    } else {
      showToast(result?.message || 'Khong the toi uu tai nguyen.', 'error');
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

        isSetTaiXiuExpanded={isSetTaiXiuExpanded}
        setIsSetTaiXiuExpanded={setIsSetTaiXiuExpanded}
        
        isGameHistoryExpanded={isGameHistoryExpanded}
        setIsGameHistoryExpanded={setIsGameHistoryExpanded}
        
        isGameHistory2Expanded={isGameHistory2Expanded}
        setIsGameHistory2Expanded={setIsGameHistory2Expanded}

        isTaiXiuCaoNanExpanded={isTaiXiuCaoNanExpanded}
        setIsTaiXiuCaoNanExpanded={setIsTaiXiuCaoNanExpanded}
        
        onLogout={onLogout}
      />
      
      <main className="dashboard-content">
        {(() => {
          const historyTabMap = {
            history_tx: 'tx',
            history_khongminh: 'khongminh',
            history_md5: 'md5',
            history_taixiucao: 'taixiucao',
            history_taixiunan: 'taixiunan',
            history_cl_tele: 'cl_tele',
            history_tx_tele: 'tx_tele',
            history_dice_tele: 'dice_tele',
            history_slot_tele: 'slot_tele',
          };
          const selectedHistoryGame = historyTabMap[activeTab];
          return selectedHistoryGame ? (
            <GameHistory initialGameType={selectedHistoryGame} lockGameType />
          ) : null;
        })()}
        {(() => {
          const historyTabMap2 = {
            history2_taixiucao: 'taixiucao',
            history2_taixiunan: 'taixiunan',
            history2_aviator: 'aviator',
            history2_baccarat: 'baccarat',
            history2_xocdia: 'xocdia',
            history2_rongho: 'rongho',
            history2_booms: 'booms',
            history2_plinko: 'plinko',
            history2_xeng: 'xeng',
            history2_roulette: 'roulette',
            history2_trading: 'trading',
            history2_lottery: 'lottery',
            history2_lode: 'lode',
            history2_xoso: 'xoso',
            history2_xoso1phut: 'xoso1phut',
          };
          const selectedHistoryGame2 = historyTabMap2[activeTab];
          return selectedHistoryGame2 ? (
            <GameHistory initialGameType={selectedHistoryGame2} lockGameType panelTitle="History Game 2" initialView="player" />
          ) : null;
        })()}
        {(() => {
          const setTaiXiuTabMap = {
            set_taixiu_double: 'double',
            set_taixiu_md5: 'md5',
            set_minipoker: 'minipoker',
            set_baucua: 'baucua',
            set_xocdia: 'xocdia',
          };
          const selectedSetGame = setTaiXiuTabMap[activeTab];
          return selectedSetGame ? <SetTaiXiuManager game={selectedSetGame} /> : null;
        })()}

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
        {activeTab === 'deposits' && <DepositList mode="history" />}
        {activeTab === 'deposit_error_orders' && <DepositList mode="error" />}
        {activeTab === 'withdraw_orders' && <WithdrawList mode="orders" />}
        {activeTab === 'withdraws' && <WithdrawList mode="history" />}
        {activeTab === 'game_history' && <GameHistory />}

        {/* Ngân hàng */}
        {activeTab === 'bank_auto' && <BankAuto invoke={invoke} showToast={showToast} />}
        {activeTab === 'e_wallet' && <EWallet />}

        {/* TX Room */}
        {activeTab === 'tx_room' && <TxRoomPanel title="Tài Xỉu Room" roomType="tx" />}
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
        {activeTab === 'session_control' && <SessionControlManager />}
        {activeTab === 'trading_market_control' && <TradingMarketControl />}
        {activeTab === 'win_rate_control' && <WinRateManager />}
        {activeTab === 'landing_settings' && <LandingSettings />}
        {activeTab === 'game_menu_buttons' && <GameMenuButtonManager />}
        {activeTab === 'bot_content' && <BotContentManager />}
        {activeTab === 'cskh_users' && <CskhUserManager />}
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
            onOptimizeNow={handleOptimizeNow}
          />
        )}
      </main>
    </div>
  );
}

export default Dashboard;


