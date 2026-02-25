import React, { useState, useEffect } from 'react';

const AdminManager = () => {
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({ id: null, username: '', password: '', role: 'Admin', status: 'Active' });

  // Helper function to invoke IPC
  const invoke = async (channel, ...args) => {
    if (window.require) {
      try {
        const { ipcRenderer } = window.require('electron');
        return await ipcRenderer.invoke(channel, ...args);
      } catch (e) {
        console.error(e);
        return { success: false, message: e.message };
      }
    }
    return { success: false, message: "Electron not found" };
  };

  const fetchAdmins = async () => {
    setLoading(true);
    const result = await invoke('get-admins');
    if (result.success) {
      setAdmins(result.data);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchAdmins();
  }, []);

  const handleAdd = () => {
    setIsEditing(false);
    setFormData({ id: null, username: '', password: '', role: 'Admin', status: 'Active' });
    setShowModal(true);
  };

  const handleEdit = (admin) => {
    setIsEditing(true);
    setFormData({ ...admin, password: '' }); // Clear password for security
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Bạn có chắc chắn muốn xóa Admin này?')) {
      const result = await invoke('delete-admin', id);
      if (result.success) {
        fetchAdmins();
      } else {
        alert('Lỗi: ' + result.message);
      }
    }
  };

  const handleToggleStatus = async (admin) => {
    if (admin.role === 'Super Admin') return;
    const newStatus = admin.status === 'Active' ? 'Locked' : 'Active';
    const payload = { ...admin, status: newStatus };
    delete payload.password; // Không gửi password khi chỉ đổi trạng thái
    const result = await invoke('update-admin', payload);
    if (result.success) {
      fetchAdmins();
    } else {
      alert('Lỗi: ' + result.message);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.username) return alert('Vui lòng nhập tên tài khoản');
    if (!isEditing && !formData.password) return alert('Vui lòng nhập mật khẩu');

    const channel = isEditing ? 'update-admin' : 'create-admin';
    
    const payload = { ...formData };
    if (isEditing && !payload.password) delete payload.password;

    const result = await invoke(channel, payload);

    if (result.success) {
      setShowModal(false);
      fetchAdmins();
    } else {
      alert('Lỗi: ' + result.message);
    }
  };

  return (
    <div className="p-6 bg-white rounded-xl shadow-sm border border-gray-200 h-full relative">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
          <i className="fas fa-user-shield text-blue-600"></i> Quản lý Admin
        </h2>
        <button 
          onClick={handleAdd}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm flex items-center gap-2"
        >
          <i className="fas fa-plus"></i> Thêm Admin
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b-2 border-gray-100 text-gray-500 text-xs uppercase tracking-wider">
              <th className="py-3 px-4">ID</th>
              <th className="py-3 px-4">Tài khoản</th>
              <th className="py-3 px-4">Vai trò</th>
              <th className="py-3 px-4">Trạng thái</th>
              <th className="py-3 px-4">Đăng nhập cuối</th>
              <th className="py-3 px-4 text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody className="text-sm text-gray-700">
            {loading ? (
               <tr><td colSpan="6" className="text-center py-4">Đang tải...</td></tr>
            ) : admins.length === 0 ? (
               <tr><td colSpan="6" className="text-center py-4">Chưa có dữ liệu</td></tr>
            ) : (
              admins.map((admin) => (
                <tr key={admin.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                  <td className="py-3 px-4 text-gray-500">#{admin.id}</td>
                  <td className="py-3 px-4 font-bold text-gray-800">{admin.username}</td>
                  <td className="py-3 px-4">
                    <span className={`px-2 py-1 rounded text-xs font-bold border ${admin.role === 'Super Admin' ? 'bg-purple-100 text-purple-700 border-purple-200' : 'bg-blue-100 text-blue-700 border-blue-200'}`}>
                      {admin.role}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <span className={`px-2 py-1 rounded text-xs font-bold border ${admin.status === 'Active' ? 'bg-green-100 text-green-700 border-green-200' : 'bg-red-100 text-red-700 border-red-200'}`}>
                      {admin.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-gray-500 font-mono text-xs">
                    {admin.lastLogin ? new Date(admin.lastLogin).toLocaleString() : 'Chưa đăng nhập'}
                  </td>
                  <td className="py-3 px-4 text-right">
                    {admin.role !== 'Super Admin' && (
                      <button 
                        onClick={() => handleToggleStatus(admin)}
                        className={`text-gray-400 hover:text-${admin.status === 'Active' ? 'red' : 'green'}-600 transition-colors mx-2`}
                        title={admin.status === 'Active' ? 'Khóa tài khoản' : 'Mở khóa'}
                      >
                        <i className={`fas fa-${admin.status === 'Active' ? 'lock' : 'unlock'}`}></i>
                      </button>
                    )}
                    <button 
                      onClick={() => handleEdit(admin)}
                      className="text-gray-400 hover:text-blue-600 transition-colors mx-2" 
                      title="Chỉnh sửa"
                    >
                      <i className="fas fa-edit"></i>
                    </button>
                    {admin.role !== 'Super Admin' && (
                      <button 
                        onClick={() => handleDelete(admin.id)}
                        className="text-gray-400 hover:text-red-600 transition-colors" 
                        title="Xóa"
                      >
                        <i className="fas fa-trash-alt"></i>
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-lg w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h3 className="font-bold text-lg text-gray-800">{isEditing ? 'Chỉnh sửa Admin' : 'Thêm Admin mới'}</h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <i className="fas fa-times"></i>
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tài khoản</label>
                <input 
                  type="text" 
                  value={formData.username}
                  onChange={(e) => setFormData({...formData, username: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Nhập tên đăng nhập"
                  disabled={isEditing}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {isEditing ? 'Mật khẩu mới (Để trống nếu không đổi)' : 'Mật khẩu'}
                </label>
                <input 
                  type="password" 
                  value={formData.password}
                  onChange={(e) => setFormData({...formData, password: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder={isEditing ? "******" : "Nhập mật khẩu"}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Vai trò</label>
                  <select 
                    value={formData.role}
                    onChange={(e) => setFormData({...formData, role: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="Admin">Admin</option>
                    <option value="Super Admin">Super Admin</option>
                    <option value="Support">Support</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Trạng thái</label>
                  <select 
                    value={formData.status}
                    onChange={(e) => setFormData({...formData, status: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="Active">Active</option>
                    <option value="Locked">Locked</option>
                  </select>
                </div>
              </div>

              <div className="pt-4 flex justify-end gap-3">
                <button 
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium transition-colors"
                >
                  Hủy bỏ
                </button>
                <button 
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors shadow-sm"
                >
                  {isEditing ? 'Cập nhật' : 'Tạo mới'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminManager;