import React, { useState, useEffect } from 'react';
import { Users, Plus, Edit2, Trash2, Eye, EyeOff, Check, X } from 'lucide-react';
import { useIpc, useToast } from './ToastContext';

const CskhUserManager = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [showPassword, setShowPassword] = useState({});
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    fullName: '',
    email: '',
    phone: '',
    status: 'active',
    role: 'staff',
    department: '',
    notes: ''
  });

  const { invoke } = useIpc();
  const { showToast } = useToast();

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const response = await invoke('get-cskh-users');
      if (response.success) {
        setUsers(response.data || []);
      } else {
        showToast(response.message || 'Loi khi tai danh sach nhan vien', 'error');
      }
    } catch (error) {
      console.error('Error fetching users:', error);
      showToast('Loi khi tai danh sach nhan vien', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const resetForm = () => {
    setFormData({
      username: '',
      password: '',
      fullName: '',
      email: '',
      phone: '',
      status: 'active',
      role: 'staff',
      department: '',
      notes: ''
    });
    setEditingId(null);
    setShowForm(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.username) {
      showToast('Vui long nhap ten dang nhap', 'error');
      return;
    }

    if (editingId) {
      // Update existing user
      if (formData.password && formData.password.length < 6) {
        showToast('Mat khau phai co it nhat 6 ky tu', 'error');
        return;
      }
      try {
        const response = await invoke('update-cskh-user', {
          id: editingId,
          ...formData
        });
        if (response.success) {
          showToast('Cap nhat nhan vien thanh cong', 'success');
          resetForm();
          fetchUsers();
        } else {
          showToast(response.message || 'Loi khi cap nhat', 'error');
        }
      } catch (error) {
        showToast('Loi khi cap nhat nhan vien', 'error');
      }
    } else {
      // Create new user
      if (!formData.password || formData.password.length < 6) {
        showToast('Mat khau phai co it nhat 6 ky tu', 'error');
        return;
      }
      try {
        const response = await invoke('create-cskh-user', formData);
        if (response.success) {
          showToast('Tao nhan vien thanh cong', 'success');
          resetForm();
          fetchUsers();
        } else {
          showToast(response.message || 'Loi khi tao nhan vien', 'error');
        }
      } catch (error) {
        showToast('Loi khi tao nhan vien', 'error');
      }
    }
  };

  const handleEdit = (user) => {
    setFormData({
      username: user.username,
      password: '',
      fullName: user.fullName || '',
      email: user.email || '',
      phone: user.phone || '',
      status: user.status || 'active',
      role: user.role || 'staff',
      department: user.department || '',
      notes: user.notes || ''
    });
    setEditingId(user._id);
    setShowForm(true);
  };

  const handleDelete = async (id, username) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa nhân viên "${username}"?`)) {
      return;
    }

    try {
      const response = await invoke('delete-cskh-user', { id });
      if (response.success) {
        showToast('Xoa nhan vien thanh cong', 'success');
        fetchUsers();
      } else {
        showToast(response.message || 'Loi khi xoa', 'error');
      }
    } catch (error) {
      showToast('Loi khi xoa nhan vien', 'error');
    }
  };

  return (
    <div className="p-6 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 min-h-screen">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Users className="w-8 h-8 text-cyan-400" />
            <h1 className="text-3xl font-bold text-white">Quản Lý Nhân Viên CSKH</h1>
          </div>
          <button
            onClick={() => {
              resetForm();
              setShowForm(!showForm);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-cyan-500 hover:bg-cyan-600 text-white rounded-lg font-medium transition"
          >
            <Plus className="w-4 h-4" />
            Thêm Nhân Viên
          </button>
        </div>

        {/* Form */}
        {showForm && (
          <div className="bg-slate-700 border border-slate-600 rounded-lg p-6 mb-8">
            <h2 className="text-xl font-bold text-white mb-4">
              {editingId ? 'Cập Nhật Nhân Viên' : 'Tạo Nhân Viên Mới'}
            </h2>
            <form onSubmit={handleSubmit}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm text-gray-300 mb-2">Tên Đăng Nhập *</label>
                  <input
                    type="text"
                    name="username"
                    value={formData.username}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 bg-slate-600 text-white border border-slate-500 rounded-lg focus:outline-none focus:border-cyan-400"
                    required
                    disabled={editingId ? true : false}
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-300 mb-2">
                    Mật Khẩu {editingId ? '(để trống nếu không đổi)' : '*'}
                  </label>
                  <input
                    type="password"
                    name="password"
                    value={formData.password}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 bg-slate-600 text-white border border-slate-500 rounded-lg focus:outline-none focus:border-cyan-400"
                    required={!editingId}
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-300 mb-2">Họ Tên</label>
                  <input
                    type="text"
                    name="fullName"
                    value={formData.fullName}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 bg-slate-600 text-white border border-slate-500 rounded-lg focus:outline-none focus:border-cyan-400"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-300 mb-2">Email</label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 bg-slate-600 text-white border border-slate-500 rounded-lg focus:outline-none focus:border-cyan-400"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-300 mb-2">Số Điện Thoại</label>
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 bg-slate-600 text-white border border-slate-500 rounded-lg focus:outline-none focus:border-cyan-400"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-300 mb-2">Phòng Ban</label>
                  <input
                    type="text"
                    name="department"
                    value={formData.department}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 bg-slate-600 text-white border border-slate-500 rounded-lg focus:outline-none focus:border-cyan-400"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-300 mb-2">Vai Trò</label>
                  <select
                    name="role"
                    value={formData.role}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 bg-slate-600 text-white border border-slate-500 rounded-lg focus:outline-none focus:border-cyan-400"
                  >
                    <option value="staff">Nhân Viên</option>
                    <option value="supervisor">Giám Sát</option>
                    <option value="manager">Quản Lý</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-300 mb-2">Trạng Thái</label>
                  <select
                    name="status"
                    value={formData.status}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 bg-slate-600 text-white border border-slate-500 rounded-lg focus:outline-none focus:border-cyan-400"
                  >
                    <option value="active">Hoạt Động</option>
                    <option value="inactive">Ngưng Hoạt Động</option>
                  </select>
                </div>
              </div>
              <div className="mb-4">
                <label className="block text-sm text-gray-300 mb-2">Ghi Chú</label>
                <textarea
                  name="notes"
                  value={formData.notes}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 bg-slate-600 text-white border border-slate-500 rounded-lg focus:outline-none focus:border-cyan-400"
                  rows="3"
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="submit"
                  className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg font-medium transition"
                >
                  {editingId ? 'Cập Nhật' : 'Tạo'}
                </button>
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg font-medium transition"
                >
                  Hủy
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Table */}
        <div className="bg-slate-700 border border-slate-600 rounded-lg overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-gray-400">Đang tải dữ liệu...</div>
          ) : users.length === 0 ? (
            <div className="p-8 text-center text-gray-400">Chưa có nhân viên nào</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-800 border-b border-slate-600">
                  <tr>
                    <th className="px-6 py-3 text-left text-sm font-medium text-gray-300">Tên Đăng Nhập</th>
                    <th className="px-6 py-3 text-left text-sm font-medium text-gray-300">Họ Tên</th>
                    <th className="px-6 py-3 text-left text-sm font-medium text-gray-300">Email</th>
                    <th className="px-6 py-3 text-left text-sm font-medium text-gray-300">Vai Trò</th>
                    <th className="px-6 py-3 text-left text-sm font-medium text-gray-300">Trạng Thái</th>
                    <th className="px-6 py-3 text-left text-sm font-medium text-gray-300">Hành Động</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-600">
                  {users.map(user => (
                    <tr key={user._id} className="hover:bg-slate-600 transition">
                      <td className="px-6 py-4 text-sm text-white">{user.username}</td>
                      <td className="px-6 py-4 text-sm text-gray-300">{user.fullName || '-'}</td>
                      <td className="px-6 py-4 text-sm text-gray-300">{user.email || '-'}</td>
                      <td className="px-6 py-4 text-sm">
                        <span className="px-2 py-1 bg-blue-600 text-white rounded text-xs">
                          {user.role === 'staff' ? 'Nhân Viên' : user.role === 'supervisor' ? 'Giám Sát' : 'Quản Lý'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <div className="flex items-center gap-1">
                          {user.status === 'active' ? (
                            <Check className="w-4 h-4 text-green-400" />
                          ) : (
                            <X className="w-4 h-4 text-red-400" />
                          )}
                          <span className={user.status === 'active' ? 'text-green-400' : 'text-red-400'}>
                            {user.status === 'active' ? 'Hoạt Động' : 'Ngưng'}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm flex gap-2">
                        <button
                          onClick={() => handleEdit(user)}
                          className="p-2 hover:bg-slate-500 rounded transition text-cyan-400"
                          title="Chỉnh sửa"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(user._id, user.username)}
                          className="p-2 hover:bg-red-900 rounded transition text-red-400"
                          title="Xóa"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CskhUserManager;

