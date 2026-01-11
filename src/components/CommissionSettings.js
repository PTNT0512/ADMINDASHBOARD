import React, { useState, useEffect } from 'react';
// Import Model (Lưu ý: Chỉ hoạt động nếu App là Electron có Node Integration hoặc SSR)
const CommissionSetting = require('../models/CommissionSetting');

const CommissionSettings = () => {
    const [rates, setRates] = useState({
        1: 0.5,
        2: 0.8,
        3: 1.0,
        4: 1.2,
        5: 1.5
    });
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });

    useEffect(() => {
        loadSettings();
    }, []);

    const loadSettings = async () => {
        try {
            const setting = await CommissionSetting.findOne({ key: 'default' });
            if (setting && setting.rates) {
                const newRates = {};
                // Chuyển đổi từ số thập phân sang phần trăm (0.005 -> 0.5) để hiển thị
                Object.keys(setting.rates).forEach(key => {
                    newRates[key] = setting.rates[key] * 100;
                });
                // Merge với default để đảm bảo đủ key nếu DB thiếu
                setRates(prev => ({ ...prev, ...newRates }));
            }
        } catch (error) {
            console.error("Lỗi tải cấu hình:", error);
            setMessage({ type: 'error', text: 'Không thể tải cấu hình từ Database.' });
        }
    };

    const handleChange = (level, value) => {
        setRates(prev => ({
            ...prev,
            [level]: value
        }));
    };

    const handleSave = async () => {
        setLoading(true);
        setMessage({ type: '', text: '' });
        try {
            const saveRates = {};
            // Chuyển đổi ngược lại từ phần trăm sang số thập phân (0.5 -> 0.005) để lưu
            Object.keys(rates).forEach(key => {
                saveRates[key] = parseFloat(rates[key]) / 100;
            });

            await CommissionSetting.findOneAndUpdate(
                { key: 'default' },
                { rates: saveRates },
                { upsert: true, new: true }
            );
            setMessage({ type: 'success', text: 'Đã lưu cấu hình hoa hồng thành công!' });
        } catch (error) {
            console.error("Lỗi lưu cấu hình:", error);
            setMessage({ type: 'error', text: 'Lỗi khi lưu cấu hình.' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="card shadow-sm">
            <div className="card-header bg-primary text-white">
                <h5 className="mb-0">⚙️ Cấu Hình Tỷ Lệ Hoa Hồng Đại Lý</h5>
            </div>
            <div className="card-body">
                {message.text && (
                    <div className={`alert ${message.type === 'success' ? 'alert-success' : 'alert-danger'}`}>
                        {message.text}
                    </div>
                )}

                <div className="row">
                    {[1, 2, 3, 4, 5].map(level => (
                        <div className="col-md-6 mb-3" key={level}>
                            <label className="form-label fw-bold">Cấp độ VIP {level} (%)</label>
                            <div className="input-group">
                                <input
                                    type="number"
                                    step="0.1"
                                    className="form-control"
                                    value={rates[level]}
                                    onChange={(e) => handleChange(level, e.target.value)}
                                />
                                <span className="input-group-text">%</span>
                            </div>
                            <small className="text-muted">Nhập 0.5 nghĩa là 0.5% hoa hồng trên tổng cược.</small>
                        </div>
                    ))}
                </div>

                <div className="mt-4 d-flex justify-content-end">
                    <button 
                        className="btn btn-success px-4" 
                        onClick={handleSave} 
                        disabled={loading}
                    >
                        {loading ? (
                            <span><span className="spinner-border spinner-border-sm me-2"></span>Đang lưu...</span>
                        ) : (
                            <span>💾 Lưu Cấu Hình</span>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CommissionSettings;