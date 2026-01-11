import React, { useState } from 'react';
import { useIpc } from './ToastContext';

function LicenseActivation({ onActivationSuccess }) {
  const [licenseKey, setLicenseKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { invoke } = useIpc();

  const handleActivate = async (e) => {
    e.preventDefault();
    if (!licenseKey) return;

    setLoading(true);
    setError('');
    try {
      const result = await invoke('activate-license', licenseKey);
      if (result.success) {
        alert('Kích hoạt hệ thống thành công!');
        onActivationSuccess();
      } else {
        setError(result.message || 'Kích hoạt thất bại. Vui lòng kiểm tra lại mã Key.');
      }
    } catch (err) {
      setError('Lỗi hệ thống: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mil-login-overlay">
      <div className="mil-login-box">
        <div className="mil-box-header">
          <i className="fas fa-key"></i>
          <span>License Activation</span>
        </div>
        <form onSubmit={handleActivate} className="mil-box-body">
          <div className="mil-info-text">
            <i className="fas fa-shield-alt"></i>
            HỆ THỐNG CHƯA ĐƯỢC KÍCH HOẠT. VUI LÒNG NHẬP MÃ BẢN QUYỀN ĐƯỢC CẤP.
          </div>
          <div className="mil-input-group">
            <label>LICENSE KEY:</label>
            <input
              type="text"
              value={licenseKey}
              onChange={(e) => setLicenseKey(e.target.value.toUpperCase())}
              placeholder="LASVEGAS-XXXX-XXXX"
              autoFocus
              className="mil-input-otp"
              style={{ letterSpacing: '2px', fontSize: '18px' }}
            />
          </div>
          {error && <div className="mil-error">{error}</div>}
          <button type="submit" className="btn mil-btn-submit" disabled={loading}>
            {loading ? 'ĐANG XÁC THỰC...' : 'Kích hoạt'}
          </button>
        </form>
        <div className="mil-box-footer">
          <span>SECURITY PROTOCOL: ACTIVE</span>
          <span>STATUS: AWAITING KEY</span>
        </div>
      </div>
    </div>
  );
}

export default LicenseActivation;