import React from 'react'
import '../theme/admin-redesign.css'

export default function GlobalLayout({ children, onLogout, title }) {
  return (
    <div className="admin-shell">
      <header className="admin-header">
        <div className="admin-header-left">
          <button className="brand">Admin Dashboard</button>
        </div>
        <div className="admin-header-center">{title || ''}</div>
        <div className="admin-header-right">
          <button className="search-btn">🔍</button>
          <button className="notifications-btn">🔔</button>
          <button className="logout-btn" onClick={onLogout}>Đăng xuất</button>
        </div>
      </header>

      <main className="admin-main">
        <aside className="admin-sidebar" aria-hidden>
          <nav>
            <button className="nav-btn">Trang chủ</button>
            <button className="nav-btn">Người dùng</button>
            <button className="nav-btn">Giao dịch</button>
            <button className="nav-btn">Cài đặt</button>
          </nav>
        </aside>

        <section className="admin-content">
          <div className="content-inner">
            {children}
          </div>
        </section>
      </main>
    </div>
  )
}
