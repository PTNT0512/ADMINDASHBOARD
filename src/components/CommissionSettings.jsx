import React, { useState, useEffect } from 'react';

const CommissionSettings = () => {
    const [rates, setRates] = useState({
        1: 0.5,
        2: 0.8,
        3: 1.0,
        4: 1.2,
        5: 1.5
    });
    const [loading, setLoading] = useState(false);
    const [msg, setMsg] = useState(null);

    useEffect(() => {
        loadSettings();
    }, []);

    const loadSettings = async () => {
        try {
            if (window.require) {
                const { ipcRenderer } = window.require('electron');
                const result = await ipcRenderer.invoke('get-commission-settings');
                if (result.success && result.data && result.data.rates) {
                    const setting = result.data;
                    const newRates = {};
                    // Chuyển đổi từ số thập phân trong DB (0.005) sang phần trăm hiển thị (0.5)
                    Object.keys(setting.rates).forEach(k => {
                        newRates[k] = parseFloat((setting.rates[k] * 100).toFixed(2));
                    });
                    // Merge với default để đảm bảo đủ key
                    setRates(prev => ({ ...prev, ...newRates }));
                }
            }
        } catch (err) {
            console.error("Lỗi tải cấu hình:", err);
        }
    };

    const handleSave = async () => {
        setLoading(true);
        setMsg(null);
        try {
            if (window.require) {
                const { ipcRenderer } = window.require('electron');
                const saveRates = {};
                // Chuyển đổi ngược lại từ phần trăm (0.5) sang số thập phân (0.005) để lưu
                Object.keys(rates).forEach(k => {
                    saveRates[k] = parseFloat(rates[k]) / 100;
                });
                
                const result = await ipcRenderer.invoke('save-commission-settings', saveRates);
                if (result.success) {
                    setMsg({ type: 'success', text: 'Đã lưu cấu hình thành công!' });
                    // Tự động ẩn thông báo sau 3s
                    setTimeout(() => setMsg(null), 3000);
                } else {
                    setMsg({ type: 'danger', text: result.message || 'Lỗi khi lưu cấu hình.' });
                }
            }
        } catch (err) {
            console.error(err);
            setMsg({ type: 'danger', text: 'Lỗi khi lưu cấu hình.' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="container-fluid p-0">
            <div className="card shadow-sm" style={{ maxWidth: '800px', margin: '0 auto' }}>
                <div className="card-header bg-primary text-white py-3">
                    <h5 className="mb-0 fw-bold">⚙️ Cấu Hình Tỷ Lệ Hoa Hồng Đại Lý</h5>
                </div>
                <div className="card-body p-4">
                    {msg && <div className={`alert alert-${msg.type} mb-4`}>{msg.text}</div>}
                    
                    <div className="alert alert-info mb-4">
                        <small>ℹ️ Tỷ lệ hoa hồng được tính dựa trên tổng cược của người được giới thiệu. Ví dụ: Nhập <strong>0.5</strong> nghĩa là đại lý nhận được <strong>0.5%</strong> doanh thu cược.</small>
                    </div>

                    <div className="row g-4">
                        {[1, 2, 3, 4, 5].map(level => (
                            <div className="col-md-6" key={level}>
                                <label className="form-label fw-bold text-secondary">Cấp độ VIP {level}</label>
                                <div className="input-group">
                                    <input 
                                        type="number" 
                                        className="form-control" 
                                        value={rates[level]}
                                        onChange={e => setRates({...rates, [level]: e.target.value})}
                                        step="0.1"
                                        min="0"
                                    />
                                    <span className="input-group-text bg-light fw-bold">%</span>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="mt-5 text-end border-top pt-3">
                        <button 
                            className="btn btn-success px-4 py-2 fw-bold" 
                            onClick={handleSave} 
                            disabled={loading}
                        >
                            {loading ? (
                                <span><span className="spinner-border spinner-border-sm me-2"></span>Đang lưu...</span>
                            ) : (
                                <span>💾 Lưu Thay Đổi</span>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CommissionSettings;