import React, { useState } from 'react';

function Sidebar({
  activeTab, setActiveTab,
  isMembersExpanded, setIsMembersExpanded,
  isAgencyExpanded, setIsAgencyExpanded,
  isBankingExpanded, setIsBankingExpanded,
  isToolExpanded, setIsToolExpanded,
  isTransactionExpanded, setIsTransactionExpanded,
  isMinigameExpanded, setIsMinigameExpanded,
  isTxRoomExpanded, setIsTxRoomExpanded,
  isGamesExpanded, setIsGamesExpanded,
  isTaiXiuCaoNanExpanded, setIsTaiXiuCaoNanExpanded,
  onLogout
}) {
  const [collapsed, setCollapsed] = useState(false);

  const MenuItem = ({ id, icon, label }) => (
    <div 
      className={`nav-item ${activeTab === id ? 'active' : ''}`} 
      onClick={() => setActiveTab(id)}
      title={collapsed ? label : ''}
      style={{ justifyContent: collapsed ? 'center' : 'flex-start', padding: collapsed ? '15px 0' : '12px 15px' }}
    >
      <i className={`fas ${icon}`} style={{ width: '24px', textAlign: 'center', fontSize: '16px' }}></i>
      {!collapsed && <span style={{ marginLeft: '10px' }}>{label}</span>}
    </div>
  );

  const SubMenuItem = ({ id, label }) => (
    <div 
      className={`nav-item ${activeTab === id ? 'active' : ''}`} 
      onClick={() => setActiveTab(id)}
      style={{ 
        paddingLeft: collapsed ? '0' : '48px', 
        fontSize: '0.9em',
        justifyContent: collapsed ? 'center' : 'flex-start',
        padding: collapsed ? '10px 0' : '10px 15px 10px 48px'
      }}
      title={collapsed ? label : ''}
    >
      <i className="fas fa-circle" style={{ fontSize: '6px', marginRight: collapsed ? '0' : '10px', opacity: 0.5 }}></i>
      {!collapsed && <span>{label}</span>}
    </div>
  );

  const MenuGroup = ({ title, icon, expanded, setExpanded, children }) => (
    <div className="menu-group">
      <div 
        className="nav-item" 
        onClick={() => {
          if (collapsed) setCollapsed(false);
          setExpanded(!expanded);
        }}
        style={{ justifyContent: collapsed ? 'center' : 'space-between', padding: collapsed ? '15px 0' : '12px 15px' }}
        title={collapsed ? title : ''}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', justifyContent: collapsed ? 'center' : 'flex-start', width: collapsed ? '100%' : 'auto' }}>
          <i className={`fas ${icon}`} style={{ width: '24px', textAlign: 'center', fontSize: '16px' }}></i>
          {!collapsed && <span>{title}</span>}
        </div>
        {!collapsed && <i className={`fas fa-chevron-${expanded ? 'down' : 'right'}`} style={{ fontSize: '12px', opacity: 0.7 }}></i>}
      </div>
      {expanded && !collapsed && children}
    </div>
  );

  return (
    <aside className="sidebar" style={{ 
      overflowY: 'auto', 
      height: '100vh', 
      paddingBottom: '50px',
      width: collapsed ? '70px' : '260px',
      transition: 'width 0.3s ease',
      flexShrink: 0
    }}>
      <div style={{ 
        padding: '20px 10px', 
        marginBottom: '10px', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: collapsed ? 'center' : 'space-between',
        borderBottom: '1px solid rgba(0,0,0,0.05)'
      }}>
        {!collapsed && (
          <h2 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--primary)', fontWeight: '800', whiteSpace: 'nowrap' }}>
            <i className="fas fa-dice-d20 mr-2"></i> LAS VEGAS
          </h2>
        )}
        {collapsed && <i className="fas fa-dice-d20" style={{ fontSize: '1.5rem', color: 'var(--primary)' }}></i>}
        
        <button 
          onClick={() => setCollapsed(!collapsed)}
          style={{
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--text-secondary)',
            padding: '5px'
          }}
        >
          <i className={`fas ${collapsed ? 'fa-chevron-right' : 'fa-bars'}`}></i>
        </button>
      </div>

      <MenuItem id="dashboard" icon="fa-chart-line" label="Tổng Quan" />

      {/* PHẦN ĐẠI LÝ BẠN ĐANG TÌM */}
      <MenuGroup 
        title="Đại Lý" 
        icon="fa-users-cog" 
        expanded={isAgencyExpanded} 
        setExpanded={setIsAgencyExpanded}
      >
        <SubMenuItem id="agency_list" label="Danh sách đại lý" />
        <SubMenuItem id="commission_settings" label="Cấu hình hoa hồng" />
      </MenuGroup>

      <MenuGroup 
        title="Thành Viên" 
        icon="fa-users" 
        expanded={isMembersExpanded} 
        setExpanded={setIsMembersExpanded}
      >
        <SubMenuItem id="users" label="Danh sách thành viên" />
        <SubMenuItem id="balance" label="Cộng/Trừ tiền" />
        <SubMenuItem id="gift" label="Tặng quà" />
        <SubMenuItem id="ban_list" label="Danh sách cấm" />
        <SubMenuItem id="blacklist" label="Danh sách đen" />
      </MenuGroup>

      <MenuGroup 
        title="Giao Dịch" 
        icon="fa-exchange-alt" 
        expanded={isTransactionExpanded} 
        setExpanded={setIsTransactionExpanded}
      >
        <SubMenuItem id="deposits" label="Lịch sử Nạp" />
        <SubMenuItem id="withdraws" label="Lịch sử Rút" />
      </MenuGroup>

      <MenuGroup 
        title="Ngân Hàng" 
        icon="fa-university" 
        expanded={isBankingExpanded} 
        setExpanded={setIsBankingExpanded}
      >
        <SubMenuItem id="bank_auto" label="Bank Auto" />
        <SubMenuItem id="e_wallet" label="Ví điện tử" />
      </MenuGroup>

      <MenuGroup 
        title="Trò Chơi" 
        icon="fa-gamepad" 
        expanded={isGamesExpanded} 
        setExpanded={setIsGamesExpanded}
      >
        <SubMenuItem id="taixiu_cao" label="Tài Xỉu Cào" />
        <SubMenuItem id="taixiu_nan" label="Tài Xỉu Nặn" />
        <SubMenuItem id="game_config" label="Cấu hình Game" />
      </MenuGroup>

      <MenuGroup 
        title="Tài Xỉu" 
        icon="fa-dice" 
        expanded={isTxRoomExpanded} 
        setExpanded={setIsTxRoomExpanded}
      >
        <SubMenuItem id="tx_room" label="Phòng Thường" />
        <SubMenuItem id="tx_md5_room" label="Phòng MD5" />
        <SubMenuItem id="tx_khongminh_room" label="Phòng Khổng Minh" />
      </MenuGroup>

      <MenuGroup 
        title="Minigame" 
        icon="fa-puzzle-piece" 
        expanded={isMinigameExpanded} 
        setExpanded={setIsMinigameExpanded}
      >
        <SubMenuItem id="tool_code" label="Giftcode" />
        <SubMenuItem id="daily_checkin" label="Điểm danh" />
        <SubMenuItem id="missions" label="Nhiệm vụ" />
        <SubMenuItem id="lucky_wheel" label="Vòng quay" />
        <SubMenuItem id="top_racing" label="Đua Top" />
      </MenuGroup>

      {!collapsed && (
        <>
          <div style={{ margin: '10px 0', borderTop: '1px solid rgba(0,0,0,0.05)' }}></div>
          <div style={{ padding: '10px 15px', fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--muted)', textTransform: 'uppercase' }}>Hệ Thống</div>
        </>
      )}
      {collapsed && <div style={{ margin: '10px 0', borderTop: '1px solid rgba(0,0,0,0.05)' }}></div>}
      
      <MenuItem id="bot_manager" icon="fa-robot" label="Bot Manager" />
      <MenuItem id="settings" icon="fa-cogs" label="Cài đặt chung" />
      <MenuItem id="cpu_monitor" icon="fa-microchip" label="Monitor" />
      
      <div style={{ marginTop: 'auto', padding: '10px' }}>
         <div 
            className="nav-item" 
            onClick={onLogout}
            style={{ justifyContent: collapsed ? 'center' : 'flex-start', color: 'var(--danger)', padding: collapsed ? '15px 0' : '12px 15px' }}
            title="Đăng xuất"
         >
            <i className="fas fa-sign-out-alt" style={{ width: '24px', textAlign: 'center', fontSize: '16px' }}></i>
            {!collapsed && <span style={{ marginLeft: '10px' }}>Đăng xuất</span>}
         </div>
      </div>
    </aside>
  );
}

export default Sidebar;