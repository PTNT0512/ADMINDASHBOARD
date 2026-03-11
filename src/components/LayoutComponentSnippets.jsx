// ============================================
// READY-TO-USE COMPONENT SNIPPETS
// ============================================

// Copy-paste các components này vào JSX files của bạn

// ============================================
// 1. DASHBOARD STATS COMPONENT
// ============================================

export function DashboardStats() {
  const stats = [
    { title: '👥 Tổng Người Dùng', value: 12345, meta: '+5% tuần này' },
    { title: '💰 Tổng Số Dư', value: 50500000, meta: 'VNĐ' },
    { title: '📊 Giao Dịch Hôm Nay', value: 1234, meta: '+12 so với hôm qua' },
    { title: '✓ Hoạt Động', value: 892, meta: 'Online now' },
  ];

  return (
    <div className="dashboard-stats">
      {stats.map((stat, idx) => (
        <div key={idx} className="stat-card">
          <div className="stat-card-title">{stat.title}</div>
          <div className="stat-card-value">
            {typeof stat.value === 'number' ? 
              stat.value.toLocaleString() : 
              stat.value
            }
          </div>
          <div className="stat-card-meta">{stat.meta}</div>
        </div>
      ))}
    </div>
  );
}

// ============================================
// 2. FORM COMPONENT
// ============================================

export function FormExample() {
  const [formData, setFormData] = React.useState({
    name: '',
    email: '',
    message: '',
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    console.log('Form submitted:', formData);
  };

  return (
    <form className="form-container" onSubmit={handleSubmit}>
      <div className="form-group">
        <label>Tên của bạn</label>
        <input
          type="text"
          name="name"
          placeholder="Nhập tên..."
          value={formData.name}
          onChange={handleChange}
          required
        />
      </div>

      <div className="form-group">
        <label>Email</label>
        <input
          type="email"
          name="email"
          placeholder="example@email.com"
          value={formData.email}
          onChange={handleChange}
          required
        />
      </div>

      <div className="form-group">
        <label>Tin nhắn</label>
        <textarea
          name="message"
          placeholder="Nhập tin nhắn..."
          rows="4"
          value={formData.message}
          onChange={handleChange}
          required
        />
      </div>

      <button type="submit" className="btn">
        Gửi
      </button>
    </form>
  );
}

// ============================================
// 3. DATA TABLE COMPONENT
// ============================================

export function DataTableExample() {
  const data = [
    { id: 1, name: 'John Doe', email: 'john@example.com', status: 'active' },
    { id: 2, name: 'Jane Smith', email: 'jane@example.com', status: 'active' },
    { id: 3, name: 'Bob Johnson', email: 'bob@example.com', status: 'inactive' },
  ];

  const getStatusClass = (status) => `status-${status}`;

  const handleEdit = (id) => alert(`Edit user ${id}`);
  const handleDelete = (id) => {
    if (confirm('Bạn chắc chắn muốn xóa?')) {
      console.log('Deleted user', id);
    }
  };

  return (
    <div className="data-table-wrapper">
      <table className="data-table">
        <thead>
          <tr>
            <th>STT</th>
            <th>Tên</th>
            <th>Email</th>
            <th>Trạng Thái</th>
            <th>Hành Động</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row, idx) => (
            <tr key={row.id}>
              <td>{idx + 1}</td>
              <td>{row.name}</td>
              <td>{row.email}</td>
              <td>
                <span className={`badge ${getStatusClass(row.status)}`}>
                  {row.status === 'active' ? '✓ Hoạt động' : '✕ Không hoạt động'}
                </span>
              </td>
              <td>
                <div className="action-buttons">
                  <button 
                    className="action-btn edit"
                    onClick={() => handleEdit(row.id)}
                  >
                    Sửa
                  </button>
                  <button 
                    className="action-btn delete"
                    onClick={() => handleDelete(row.id)}
                  >
                    Xóa
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ============================================
// 4. MODAL COMPONENT
// ============================================

export function ModalExample() {
  const [isOpen, setIsOpen] = React.useState(false);

  return (
    <>
      <button className="btn" onClick={() => setIsOpen(true)}>
        Mở Modal
      </button>

      {isOpen && (
        <div className="modal-overlay" onClick={() => setIsOpen(false)}>
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Tiêu đề Modal</h2>
              <button 
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '24px',
                  cursor: 'pointer',
                  color: 'var(--text-main)',
                }}
                onClick={() => setIsOpen(false)}
              >
                ×
              </button>
            </div>

            <div className="modal-body">
              <p>Đây là nội dung của modal. Bạn có thể thêm form, text, hoặc bất kỳ element nào ở đây.</p>
            </div>

            <div className="modal-footer">
              <button 
                className="btn secondary"
                onClick={() => setIsOpen(false)}
              >
                Hủy
              </button>
              <button 
                className="btn success"
                onClick={() => {
                  console.log('Confirmed');
                  setIsOpen(false);
                }}
              >
                Xác nhận
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ============================================
// 5. TABS COMPONENT
// ============================================

export function TabsExample() {
  const [activeTab, setActiveTab] = React.useState(0);

  const tabs = [
    { label: 'Tổng Quan', content: 'Nội dung tab 1' },
    { label: 'Cài Đặt', content: 'Nội dung tab 2' },
    { label: 'Báo Cáo', content: 'Nội dung tab 3' },
  ];

  return (
    <div>
      <div className="tabs-container">
        {tabs.map((tab, idx) => (
          <button
            key={idx}
            className={`tab-button ${activeTab === idx ? 'active' : ''}`}
            onClick={() => setActiveTab(idx)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div style={{ padding: '24px' }}>
        {tabs[activeTab].content}
      </div>
    </div>
  );
}

// ============================================
// 6. ALERT COMPONENT
// ============================================

export function AlertExample() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div className="alert success">
        <span>✓</span>
        <span>Thao tác hoàn thành thành công!</span>
      </div>

      <div className="alert error">
        <span>✕</span>
        <span>Có lỗi xảy ra vui lòng thử lại</span>
      </div>

      <div className="alert warning">
        <span>⚠</span>
        <span>Cảnh báo: Dữ liệu sắp hết hạn</span>
      </div>

      <div className="alert info">
        <span>ℹ</span>
        <span>Thông tin: Hệ thống đang bảo trì</span>
      </div>
    </div>
  );
}

// ============================================
// 7. LOADING STATE COMPONENT
// ============================================

export function LoadingExample() {
  return (
    <div className="loading-container">
      <div className="loading-spinner-modern"></div>
      <div className="loading-text">Đang tải dữ liệu...</div>
    </div>
  );
}

// ============================================
// 8. EMPTY STATE COMPONENT
// ============================================

export function EmptyStateExample() {
  return (
    <div className="empty-state">
      <div className="empty-state-icon">📭</div>
      <h3>Không có dữ liệu</h3>
      <p>Hiện chưa có mục nào để hiển thị. Hãy thêm mục mới để bắt đầu.</p>
    </div>
  );
}

// ============================================
// 9. GRID LAYOUT COMPONENT
// ============================================

export function GridLayoutExample() {
  return (
    <div className="row">
      <div className="col-md-6">
        <div className="card">
          <h3>Cột 1</h3>
          <p>Nội dung cột đầu tiên</p>
        </div>
      </div>

      <div className="col-md-6">
        <div className="card">
          <h3>Cột 2</h3>
          <p>Nội dung cột thứ hai</p>
        </div>
      </div>

      <div className="col-md-4">
        <div className="card">
          <h3>1/3 Cột</h3>
          <p>25% width</p>
        </div>
      </div>

      <div className="col-md-4">
        <div className="card">
          <h3>1/3 Cột</h3>
          <p>25% width</p>
        </div>
      </div>

      <div className="col-md-4">
        <div className="card">
          <h3>1/3 Cột</h3>
          <p>25% width</p>
        </div>
      </div>
    </div>
  );
}

// ============================================
// 10. CARD GRID COMPONENT
// ============================================

export function CardGridExample() {
  const cards = [
    { title: 'Card 1', description: 'Mô tả card 1' },
    { title: 'Card 2', description: 'Mô tả card 2' },
    { title: 'Card 3', description: 'Mô tả card 3' },
    { title: 'Card 4', description: 'Mô tả card 4' },
  ];

  return (
    <div className="cards-grid">
      {cards.map((card, idx) => (
        <div key={idx} className="card">
          <h3>{card.title}</h3>
          <p>{card.description}</p>
          <button className="btn">Xem Chi Tiết</button>
        </div>
      ))}
    </div>
  );
}

// ============================================
// 11. SECTION WITH HEADER COMPONENT
// ============================================

export function SectionExample() {
  return (
    <div>
      <div className="section-header">
        <h2>Danh Sách Người Dùng</h2>
        <p>Quản lý và theo dõi tất cả người dùng trong hệ thống</p>
      </div>

      <div className="list-container">
        <div className="list-item-modern">
          <span>👤</span>
          <div>
            <strong>John Doe</strong>
            <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'var(--text-secondary)' }}>
              john@example.com
            </p>
          </div>
        </div>

        <div className="list-item-modern">
          <span>👤</span>
          <div>
            <strong>Jane Smith</strong>
            <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'var(--text-secondary)' }}>
              jane@example.com
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================
// 12. COMBINED DASHBOARD EXAMPLE
// ============================================

export function DashboardExample() {
  return (
    <div style={{ padding: '24px' }}>
      {/* Stats */}
      <DashboardStats />

      {/* Section Header */}
      <div className="section-header" style={{ marginTop: '32px' }}>
        <h2>Quản Lý Người Dùng</h2>
        <p>Xem và quản lý tất cả người dùng trong hệ thống</p>
      </div>

      {/* Table */}
      <DataTableExample />

      {/* Alert */}
      <div className="alert info" style={{ marginTop: '24px' }}>
        <span>ℹ</span>
        <span>Dữ liệu được cập nhật mỗi 5 phút</span>
      </div>
    </div>
  );
}

// ============================================
// EXPORT ALL
// ============================================

export default {
  DashboardStats,
  FormExample,
  DataTableExample,
  ModalExample,
  TabsExample,
  AlertExample,
  LoadingExample,
  EmptyStateExample,
  GridLayoutExample,
  CardGridExample,
  SectionExample,
  DashboardExample,
};
