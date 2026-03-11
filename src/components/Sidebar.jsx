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
  isSetTaiXiuExpanded, setIsSetTaiXiuExpanded,
  isGameHistoryExpanded, setIsGameHistoryExpanded,
  isGameHistory2Expanded, setIsGameHistory2Expanded,
  isTaiXiuCaoNanExpanded, setIsTaiXiuCaoNanExpanded,
  onLogout,
}) {
  const [collapsed, setCollapsed] = useState(false);

  const MenuItem = ({ id, icon, label }) => (
    <div
      className={`nav-item ${activeTab === id ? 'active' : ''}`}
      onClick={() => setActiveTab(id)}
      title={collapsed ? label : ''}
      style={{ justifyContent: collapsed ? 'center' : 'flex-start', padding: collapsed ? '15px 0' : '12px 15px' }}
    >
      <i className={`fas ${icon}`} style={{ width: '24px', textAlign: 'center', fontSize: '16px' }} />
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
        padding: collapsed ? '10px 0' : '10px 15px 10px 48px',
      }}
      title={collapsed ? label : ''}
    >
      <i className="fas fa-circle" style={{ fontSize: '6px', marginRight: collapsed ? '0' : '10px', opacity: 0.5 }} />
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
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            justifyContent: collapsed ? 'center' : 'flex-start',
            width: collapsed ? '100%' : 'auto',
          }}
        >
          <i className={`fas ${icon}`} style={{ width: '24px', textAlign: 'center', fontSize: '16px' }} />
          {!collapsed && <span>{title}</span>}
        </div>
        {!collapsed && <i className={`fas fa-chevron-${expanded ? 'down' : 'right'}`} style={{ fontSize: '12px', opacity: 0.7 }} />}
      </div>
      {expanded && !collapsed && children}
    </div>
  );

  return (
    <aside
      className="sidebar"
      style={{
        overflowY: 'auto',
        height: '100vh',
        paddingBottom: '50px',
        width: collapsed ? '70px' : '260px',
        transition: 'width 0.3s ease',
        flexShrink: 0,
      }}
    >
      <div
        style={{
          padding: '20px 10px',
          marginBottom: '10px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'space-between',
          borderBottom: '1px solid rgba(0,0,0,0.05)',
        }}
      >
        {!collapsed && (
          <h2 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--primary)', fontWeight: '800', whiteSpace: 'nowrap' }}>
            <i className="fas fa-dice-d20 mr-2" /> LAS VEGAS
          </h2>
        )}
        {collapsed && <i className="fas fa-dice-d20" style={{ fontSize: '1.5rem', color: 'var(--primary)' }} />}

        <button
          onClick={() => setCollapsed(!collapsed)}
          style={{
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--text-secondary)',
            padding: '5px',
          }}
        >
          <i className={`fas ${collapsed ? 'fa-chevron-right' : 'fa-bars'}`} />
        </button>
      </div>

      <MenuItem id="dashboard" icon="fa-chart-line" label="Tổng quan" />

      <MenuGroup title="Đại lý" icon="fa-users-cog" expanded={isAgencyExpanded} setExpanded={setIsAgencyExpanded}>
        <SubMenuItem id="agency_list" label="Danh sách đại lý" />
        <SubMenuItem id="commission_settings" label="Cấu hình hoa hồng" />
      </MenuGroup>

      <MenuGroup title="Thành viên" icon="fa-users" expanded={isMembersExpanded} setExpanded={setIsMembersExpanded}>
        <SubMenuItem id="users" label="Danh sách thành viên" />
        <SubMenuItem id="balance" label="Cộng/Trừ tiền" />
        <SubMenuItem id="gift" label="Tặng quà" />
        <SubMenuItem id="ban_list" label="Danh sách cấm" />
        <SubMenuItem id="blacklist" label="Danh sách đen" />
      </MenuGroup>

      <MenuGroup title="Giao dịch" icon="fa-exchange-alt" expanded={isTransactionExpanded} setExpanded={setIsTransactionExpanded}>
        <SubMenuItem id="deposits" label="Lịch sử nạp" />
        <SubMenuItem id="deposit_error_orders" label="Lệnh nạp lỗi" />
        <SubMenuItem id="withdraw_orders" label="Lệnh rút" />
        <SubMenuItem id="withdraws" label="Lịch sử rút" />
      </MenuGroup>

      <MenuGroup title="Ngân hàng" icon="fa-university" expanded={isBankingExpanded} setExpanded={setIsBankingExpanded}>
        <SubMenuItem id="bank_auto" label="Bank Auto" />
        <SubMenuItem id="e_wallet" label="Ví điện tử" />
      </MenuGroup>

      <MenuGroup title="Tài Xỉu" icon="fa-dice" expanded={isTxRoomExpanded} setExpanded={setIsTxRoomExpanded}>
        <SubMenuItem id="tx_room" label="Phòng thường" />
        <SubMenuItem id="tx_khongminh_room" label="Phòng Không Minh" />
      </MenuGroup>

      <MenuGroup title="Set Tài Xỉu" icon="fa-sliders-h" expanded={isSetTaiXiuExpanded} setExpanded={setIsSetTaiXiuExpanded}>
        <SubMenuItem id="set_taixiu_double" label="Tài Xỉu Double" />
        <SubMenuItem id="set_taixiu_md5" label="Tài Xỉu MD5" />
        <SubMenuItem id="set_minipoker" label="MiniPoker" />
        <SubMenuItem id="set_baucua" label="Bầu Cua" />
        <SubMenuItem id="set_xocdia" label="Xóc Đĩa" />
      </MenuGroup>

      <MenuGroup title="Lịch sử game" icon="fa-history" expanded={isGameHistoryExpanded} setExpanded={setIsGameHistoryExpanded}>
        <SubMenuItem id="history_tx" label="Tài xỉu thường" />
        <SubMenuItem id="history_khongminh" label="Tài xỉu Không Minh" />
        <SubMenuItem id="history_cl_tele" label="Chẵn lẻ Tele" />
        <SubMenuItem id="history_tx_tele" label="Tài xỉu Tele" />
        <SubMenuItem id="history_dice_tele" label="Xúc xắc Tele" />
        <SubMenuItem id="history_slot_tele" label="Slot Tele" />
      </MenuGroup>

      <MenuGroup title="Lịch sử game 2" icon="fa-clock-rotate-left" expanded={isGameHistory2Expanded} setExpanded={setIsGameHistory2Expanded}>
        <SubMenuItem id="history2_taixiucao" label="Tài xỉu Cào" />
        <SubMenuItem id="history2_taixiunan" label="Tài xỉu Nặn" />
        <SubMenuItem id="history2_aviator" label="Aviator" />
        <SubMenuItem id="history2_baccarat" label="Baccarat" />
        <SubMenuItem id="history2_xocdia" label="Xóc Đĩa" />
        <SubMenuItem id="history2_rongho" label="Rồng Hổ" />
        <SubMenuItem id="history2_booms" label="Booms" />
        <SubMenuItem id="history2_plinko" label="Plinko" />
        <SubMenuItem id="history2_xeng" label="Xèng" />
        <SubMenuItem id="history2_roulette" label="Roulette" />
        <SubMenuItem id="history2_trading" label="Trading" />
        <SubMenuItem id="history2_lottery" label="Lottery" />
        <SubMenuItem id="history2_lode" label="Lô đề" />
        <SubMenuItem id="history2_xoso" label="Xổ số" />
        <SubMenuItem id="history2_xoso1phut" label="Xổ số 1 phút" />
      </MenuGroup>

      <MenuGroup title="Minigame" icon="fa-puzzle-piece" expanded={isMinigameExpanded} setExpanded={setIsMinigameExpanded}>
        <SubMenuItem id="tool_code" label="Giftcode" />
        <SubMenuItem id="daily_checkin" label="Điểm danh" />
        <SubMenuItem id="missions" label="Nhiệm vụ" />
        <SubMenuItem id="lucky_wheel" label="Vòng quay" />
        <SubMenuItem id="top_racing" label="Đua top" />
      </MenuGroup>

      {!collapsed && (
        <>
          <div style={{ margin: '10px 0', borderTop: '1px solid rgba(0,0,0,0.05)' }} />
          <div style={{ padding: '10px 15px', fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--muted)', textTransform: 'uppercase' }}>
            Hệ thống
          </div>
        </>
      )}
      {collapsed && <div style={{ margin: '10px 0', borderTop: '1px solid rgba(0,0,0,0.05)' }} />}

      <MenuItem id="bot_manager" icon="fa-robot" label="Bot Manager" />
      <MenuItem id="server_manager" icon="fa-server" label="Quản lý Server" />
      <MenuItem id="session_control" icon="fa-sliders-h" label="Điều khiển phiên game" />
      <MenuItem id="trading_market_control" icon="fa-chart-line" label="Can thiệp thị trường" />
      <MenuItem id="win_rate_control" icon="fa-percent" label="Tỷ lệ thắng game" />
      <MenuItem id="landing_settings" icon="fa-window-restore" label="Landing Settings" />
      <MenuItem id="game_menu_buttons" icon="fa-list" label="Game Menu Buttons" />
      <MenuItem id="bot_content" icon="fa-comment-dots" label="Nội dung Bot" />
      <MenuItem id="cskh_users" icon="fa-users" label="Quản lý CSKH" />
      <MenuItem id="settings" icon="fa-cogs" label="Cài đặt chung" />
      <MenuItem id="cpu_monitor" icon="fa-microchip" label="Monitor" />

      <div style={{ marginTop: 'auto', padding: '10px' }}>
        <div
          className="nav-item"
          onClick={onLogout}
          style={{ justifyContent: collapsed ? 'center' : 'flex-start', color: 'var(--danger)', padding: collapsed ? '15px 0' : '12px 15px' }}
          title="Đăng xuất"
        >
          <i className="fas fa-sign-out-alt" style={{ width: '24px', textAlign: 'center', fontSize: '16px' }} />
          {!collapsed && <span style={{ marginLeft: '10px' }}>Đăng xuất</span>}
        </div>
      </div>
    </aside>
  );
}

export default Sidebar;
