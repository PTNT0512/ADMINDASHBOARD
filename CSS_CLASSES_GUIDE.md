# 📱 Hướng Dẫn Sử Dụng Các Layout Classes Mới

## 1. Dashboard Stats Cards

### HTML
```jsx
<div className="dashboard-stats">
  <div className="stat-card">
    <div className="stat-card-title">👥 Tổng Người Dùng</div>
    <div className="stat-card-value">12,345</div>
    <div className="stat-card-meta">+5% so với tuần trước</div>
  </div>
  
  <div className="stat-card">
    <div className="stat-card-title">💰 Tổng Số Dư</div>
    <div className="stat-card-value">50.5M</div>
    <div className="stat-card-meta">VNĐ</div>
  </div>
</div>
```

### Tính năng
- ✨ Hover effect với `translateY(-8px)`
- 💫 Smooth shadow transitions
- 🎨 Gradient background
- 📊 Responsive grid (auto-fit minmax 220px)
- ⌚ CountUp animation tự động

---

## 2. Form Containers

### HTML
```jsx
<div className="form-container">
  <div className="form-group">
    <label>Tên Người Dùng</label>
    <input type="text" placeholder="Nhập tên..." />
  </div>
  
  <div className="form-group">
    <label>Email</label>
    <input type="email" placeholder="example@email.com" />
  </div>
  
  <button>Gửi</button>
</div>
```

### Tính năng
- 🎯 Clear visual hierarchy
- ✏️ Smooth input focus effects
- 🎨 Gradient background hover
- 🔄 Label color change on focus
- 📱 Responsive layout

### Custom Input Styling
```css
/* Auto-apply trong form-container */
input, select, textarea {
  /* Already styled with smooth transitions */
}

input:focus {
  /* Green border + light shadow */
}
```

---

## 3. Data Tables

### HTML
```jsx
<div className="data-table-wrapper">
  <table className="data-table">
    <thead>
      <tr>
        <th>STT</th>
        <th>Tên</th>
        <th>Email</th>
        <th>Hành Động</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>1</td>
        <td>John Doe</td>
        <td>john@example.com</td>
        <td>
          <div className="action-buttons">
            <button className="action-btn edit">Sửa</button>
            <button className="action-btn delete">Xóa</button>
          </div>
        </td>
      </tr>
    </tbody>
  </table>
</div>
```

### Tính năng
- 📊 Gradient header background
- 🎨 Hover row effect (light green background)
- 🔘 Action buttons with colors
- 🏞️ Rounded corners wrapper
- 📱 Responsive with horizontal scroll

---

## 4. Action Buttons in Tables

### HTML
```jsx
<div className="action-buttons">
  <button className="action-btn edit">Sửa</button>
  <button className="action-btn delete">Xóa</button>
  <button className="action-btn">Xem</button>
</div>
```

### Class Variants
- `.action-btn.edit` - Green background
- `.action-btn.delete` - Red background
- `.action-btn` - Primary color

### Tính năng
- ✨ Smooth hover effects
- 🎨 Color-coded by action
- 🔄 Responsive (flex wrap → column on mobile)

---

## 5. List Components

### HTML
```jsx
<div className="list-container">
  <div className="list-item-modern">
    <span>📝</span>
    <div>
      <strong>Tiêu đề</strong>
      <p>Mô tả ngắn</p>
    </div>
  </div>
  
  <div className="list-item-modern">
    <span>✓</span>
    <div>
      <strong>Hoàn thành</strong>
      <p>Đã xong</p>
    </div>
  </div>
</div>
```

### Tính năng
- 🎯 Left border indicator on hover
- 🔄 Smooth slide animation
- 📱 Padding adjustment on hover
- 🎨 Subtle background color

---

## 6. Badges & Status

### HTML
```jsx
<span className="badge status-active">Hoạt động</span>
<span className="badge status-inactive">Không hoạt động</span>
<span className="badge status-pending">Đang chờ</span>
```

### Class Variants
- `.badge.status-active` - Green
- `.badge.status-inactive` - Gray
- `.badge.status-pending` - Amber/Yellow

### Tính năng
- 💫 Pulse animation
- 🎨 Color-coded status
- 📌 Rounded pill shape
- ⚡ Smooth transitions

---

## 7. Modals & Dialogs

### HTML
```jsx
<div className="modal-overlay">
  <div className="modal-dialog">
    <div className="modal-header">
      <h2>Tiêu đề Modal</h2>
      <button onClick={onClose}>×</button>
    </div>
    
    <div className="modal-body">
      {/* Content */}
    </div>
    
    <div className="modal-footer">
      <button>Hủy</button>
      <button className="btn success">Xác nhận</button>
    </div>
  </div>
</div>
```

### Tính năng
- 🎬 Scale-in animation
- 🌫️ Blur backdrop
- 🎨 Clean white design
- 📱 Responsive max-width
- 🔘 Semantic footer buttons

---

## 8. Tabs

### HTML
```jsx
<div className="tabs-container">
  <button className="tab-button active">Tab 1</button>
  <button className="tab-button">Tab 2</button>
  <button className="tab-button">Tab 3</button>
</div>

<div className="tab-content">
  {/* Content for active tab */}
</div>
```

### Tính năng
- 🎯 Underline animation on active
- 🔄 Smooth color transitions
- 🎨 Green underline (primary color)
- 📱 Scrollable on mobile
- ⌚ :active pseudo-class styling

---

## 9. Alerts & Notifications

### HTML
```jsx
<div className="alert success">
  <span>✓</span>
  <span>Thao tác thành công!</span>
</div>

<div className="alert error">
  <span>✕</span>
  <span>Có lỗi xảy ra</span>
</div>

<div className="alert warning">
  <span>⚠</span>
  <span>Cảnh báo</span>
</div>
```

### Class Variants
- `.alert.success` - Green
- `.alert.error` - Red
- `.alert.warning` - Amber
- `.alert.info` - Cyan

### Tính năng
- 🎨 Color-coded message
- 🎬 Slide-in animation
- 📝 Left border indicator
- 💫 Smooth appearance

---

## 10. Section Headers

### HTML
```jsx
<div className="section-header">
  <h2>Danh Sách Người Dùng</h2>
  <p>Quản lý tất cả người dùng trong hệ thống</p>
</div>
```

### Tính năng
- 🎨 Green bottom border
- 📊 Clear typography hierarchy
- 🎬 Fade-in animation
- 📱 Responsive sizing

---

## 11. Form Groups

### HTML
```jsx
<div className="form-group">
  <label>Mật khẩu</label>
  <input 
    type="password" 
    placeholder="Nhập mật khẩu..."
  />
</div>
```

### Tính năng
- 🎯 Auto-focus styling
- 🎨 Label color change on focus
- 📝 Clear labeling
- 🔄 Smooth transitions

---

## 12. Loading States

### HTML
```jsx
<div className="loading-container">
  <div className="loading-spinner-modern"></div>
  <div className="loading-text">Đang tải...</div>
</div>
```

### Tính năng
- ⌚ Smooth rotation animation
- 🎨 Primary color spinner
- 📝 Optional text label
- 💫 Centered layout

---

## 13. Empty States

### HTML
```jsx
<div className="empty-state">
  <div className="empty-state-icon">📭</div>
  <h3>Không có dữ liệu</h3>
  <p>Hiện chưa có mục nào để hiển thị</p>
</div>
```

### Tính năng
- 🎨 Centered layout
- 💫 Subtle styling
- 📝 Clear messaging
- 🎯 Visual hierarchy

---

## 14. Grid System

### HTML
```jsx
<div className="row">
  <div className="col-md-6">
    {/* 50% width on desktop */}
  </div>
  <div className="col-md-6">
    {/* 50% width on desktop */}
  </div>
</div>

<div className="row">
  <div className="col-md-4">
    {/* 33.33% width on desktop */}
  </div>
  <div className="col-md-4">
    {/* 33.33% width on desktop */}
  </div>
  <div className="col-md-4">
    {/* 33.33% width on desktop */}
  </div>
</div>
```

### Breakpoints
- Desktop (1024px+): Full size
- Tablet (768px-1023px): 50% or flexible
- Mobile (<768px): 100% (full width)

### Tính năng
- 📱 Responsive columns
- 🔄 Gap management
- 📊 Flexible layouts
- ⚡ Auto-fit grid

---

## 15. Cards Grid

### HTML
```jsx
<div className="cards-grid">
  <div className="card">
    <h3>Card Title</h3>
    <p>Card content here</p>
  </div>
  
  <div className="card">
    <h3>Another Card</h3>
    <p>More content</p>
  </div>
</div>
```

### Tính năng
- 🎨 Auto-fit minmax(300px, 1fr)
- 📱 Responsive columns
- 💫 Smooth transitions
- 🎯 Equal card sizing

---

## Responsive Breakpoints

### Desktop (1024px+)
```css
/* Full layouts, side-by-side cards, all features visible */
```

### Tablet (768px - 1023px)
```css
/* 2-column layouts, reduced padding */
col-md-4 → 50% width
col-md-6 → 50% width
```

### Mobile (<768px)
```css
/* Single column, touch-friendly sizes */
All columns → 100% width
Buttons → Full width
Modals → 95% width
```

### Small Mobile (<480px)
```css
/* Minimal padding, optimized for small screens */
Padding reduced further
Fonts slightly smaller
Single column only
```

---

## Color System

### Primary Colors
- Main: `#10b981` (Xanh lá)
- Hover: `#059669` (Xanh lá đậm)
- Light: `#6ee7b7` (Xanh lá nhạt)

### Text Colors
- Main: `#064e3b` (Xanh lá rất đậm)
- Secondary: `#10b981` (Xanh lá)

### Background Colors
- App: `#ffffff` (Trắng)
- Panel: `#f0fdf4` (Xanh lá cực nhạt)

### Status Colors
- Success: `#059669` (Xanh)
- Error: `#dc2626` (Đỏ)
- Warning: `#f59e0b` (Vàng)
- Info: `#0891b2` (Xanh dương)

---

## Animation Timing

Tất cả animations sử dụng:
- **Easing**: `cubic-bezier(0.4, 0, 0.2, 1)` (standard)
- **Duration**: 0.2s - 0.5s

Ví dụ:
```css
transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
```

---

## Best Practices

1. **Luôn sử dụng className** thay vì inline styles
2. **Combine classes** cho multiple effects
3. **Respect responsive breakpoints** khi design
4. **Use semantic HTML** cho accessibility
5. **Test hover states** trên mouse devices
6. **Test touch interactions** trên mobile devices

---

✨ Tất cả CSS classes đã được thiết kế để mềm mại, đẹp mắt, và responsive!
