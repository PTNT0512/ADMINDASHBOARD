import React, { useState, useEffect } from 'react';

const AgencyList = () => {
    const [agencies, setAgencies] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        loadAgencies();
    }, []);

    const loadAgencies = async () => {
        setLoading(true);
        try {
            if (window.require) {
                const { ipcRenderer } = window.require('electron');
                const result = await ipcRenderer.invoke('get-agency-list');
                if (result.success) {
                    setAgencies(result.data);
                } else {
                    console.error("Lỗi tải danh sách đại lý:", result.message);
                }
            }
        } catch (error) {
            console.error("Lỗi tải danh sách đại lý:", error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="card shadow-sm">
            <div className="card-header bg-white py-3 d-flex justify-content-between align-items-center">
                <h5 className="mb-0 text-primary fw-bold">👥 Danh Sách Đại Lý (Top 100)</h5>
                <button className="btn btn-sm btn-outline-primary" onClick={loadAgencies}>🔄 Làm mới</button>
            </div>
            <div className="card-body p-0">
                <div className="table-responsive">
                    <table className="table table-hover table-striped align-middle mb-0">
                        <thead className="table-light">
                            <tr>
                                <th className="ps-4">ID</th>
                                <th>Cấp độ</th>
                                <th>Số dư</th>
                                <th>Đã giới thiệu</th>
                                <th>Hoa hồng tích lũy</th>
                                <th>Ngày tham gia</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan="6" className="text-center py-5 text-muted">Đang tải dữ liệu...</td></tr>
                            ) : agencies.length === 0 ? (
                                <tr><td colSpan="6" className="text-center py-5 text-muted">Chưa có đại lý nào.</td></tr>
                            ) : (
                                agencies.map(user => (
                                    <tr key={user._id}>
                                        <td className="ps-4"><span className="badge bg-secondary">{user.userId}</span></td>
                                        <td><span className={`badge bg-${user.vip > 1 ? 'warning text-dark' : 'info'}`}>VIP {user.vip || 1}</span></td>
                                        <td className="fw-bold text-success">{user.balance?.toLocaleString()} ₫</td>
                                        <td><strong>{user.ref}</strong> thành viên</td>
                                        <td className="text-primary fw-bold">{user.dailyPoints?.toLocaleString()} ₫</td>
                                        <td>{new Date(user.date).toLocaleDateString('vi-VN')}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default AgencyList;