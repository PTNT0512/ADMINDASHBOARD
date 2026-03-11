# CSKH Employee Management & Login System

## Các tệp được tạo/sửa:

### 1. Mô Hình Dữ Liệu
**[src/models/CskhUser.js]** - Model quản lý nhân viên CSKH
- Trường: username, password, fullName, email, phone, status, role, department, notes, lastLogin
- Mã hóa mật khẩu tự động với bcrypt
- Phương thức comparePassword() để xác thực

### 2. Giao Diện Dashboard Admin
**[src/components/CskhUserManager.jsx]** - Trang quản lý nhân viên CSKH
- Hiển thị danh sách tất cả nhân viên
- Tạo nhân viên mới
- Cập nhật thông tin nhân viên
- Xóa nhân viên
- Phân quyền: staff, supervisor, manager
- Quản lý trạng thái: active, inactive

**Tích hợp vào Dashboard:**
- [src/components/Dashboard.jsx] - Thêm CskhUserManager import và tab
- [src/components/Sidebar.jsx] - Thêm menu "Quản Lý CSKH"

### 3. CSKH App Login
**[cskh-app/CskhLogin.jsx]** - Trang đăng nhập cho CSKH app
- Giao diện hiện đại với gradient
- Ghi nhớ tên đăng nhập
- Xác thực qua API
- Lưu token và user info vào localStorage

**[cskh-app/CskhLogin.css]** - Styling cho trang login
- Thiết kế gradient modern
- Responsive design
- Animation effects

**[cskh-app/App.jsx]** - Cập nhật CSKH app chính
- Tích hợp CskhLogin
- Kiểm tra session khi khởi động
- Hiển thị tên người dùng
- Nút Đăng Xuất

### 4. Backend IPC Handlers
**[electron/dashboard.cjs]** - Thêm:
- Import CskhUser model
- IPC Handler: `get-cskh-users` - Lấy danh sách nhân viên
- IPC Handler: `create-cskh-user` - Tạo nhân viên mới
- IPC Handler: `update-cskh-user` - Cập nhật nhân viên
- IPC Handler: `delete-cskh-user` - Xóa nhân viên
- API Endpoint: `POST /api/cskh/login` - Xác thực đăng nhập

## Cách Sử Dụng:

### Từ Dashboard Admin:
1. Vào menu "Quản Lý CSKH"
2. Click "Thêm Nhân Viên"
3. Điền thông tin: tên đăng nhập, mật khẩu, họ tên, email, vai trò, v.v.
4. Click "Tạo" để lưu
5. Có thể sửa hoặc xóa nhân viên từ bảng danh sách

### Từ CSKH App:
1. Truy cập trang CSKH app (port 3001)
2. Nhập tên đăng nhập và mật khẩu
3. Tùy chọn "Ghi nhớ tên đăng nhập"
4. Click "Đăng Nhập"
5. Nếu thành công, sẽ vào giao diện chính
6. Click "Đăng Xuất" để thoát

## Tính Năng Chính:

✅ Quản lý toàn bộ tài khoản nhân viên CSKH
✅ Phân quyền theo vai trò (staff, supervisor, manager)
✅ Kiểm soát trạng thái nhân viên (active/inactive)
✅ Mã hóa mật khẩu với bcrypt
✅ Xác thực session với token
✅ Ghi nhớ lần đăng nhập cuối
✅ Giao diện login hiện đại
✅ Quản lý hồ sơ nhân viên đầy đủ

## API Endpoints:

### POST /api/cskh/login
Đăng nhập CSKH app
- Body: `{ username, password }`
- Response: `{ success, token, user }`

### IPC Channels (Electron):
- `get-cskh-users` - Lấy danh sách
- `create-cskh-user` - Tạo mới
- `update-cskh-user` - Cập nhật
- `delete-cskh-user` - Xóa
