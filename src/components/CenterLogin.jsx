import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useIpc } from './ToastContext';

const CenterLogin = ({ onLoginSuccess }) => {
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState('init'); // 'init' (đang gửi yêu cầu) hoặc 'otp' (đang chờ nhập mã)
  const [error, setError] = useState('');
  const { invoke } = useIpc();
  const hasRequested = useRef(false);
  const lastSubmittedOtp = useRef('');

  // Hàm gửi yêu cầu đăng nhập để nhận OTP
  const requestOtp = useCallback(async () => {
    if (loading) return;

    setLoading(true);
    setError('');
    try {
      // Center chỉ cần username 'admincenter', mật khẩu đã được bỏ qua ở Backend
      const res = await invoke('login-request', { username: 'admincenter' });
      if (res.success && res.otpRequired) {
        setStep('otp');
      } else {
        setError(res.message || 'KHÔNG THỂ KHỞI TẠO LIÊN KẾT BẢO MẬT.');
      }
    } catch (err) {
      setError('LỖI KẾT NỐI HỆ THỐNG CHỈ HUY.');
    } finally {
      setLoading(false);
    }
  }, [invoke, loading]);

  // Tự động kích hoạt ngay khi component mount
  useEffect(() => {
    if (!hasRequested.current) {
      hasRequested.current = true;
      requestOtp();
    }
  }, []);

  // Hàm xác thực mã OTP
  const handleVerify = useCallback(async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!otp || otp.length < 6) return;

    setLoading(true);
    setError('');
    try {
      const res = await invoke('verify-otp', { otp });
      if (res.success) {
        onLoginSuccess(res);
      } else {
        setError(res.message);
      }
    } catch (err) {
      setError('LỖI HỆ THỐNG XÁC THỰC: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [otp, invoke, onLoginSuccess]);

  // Tự động nhấn Confirm khi nhập đủ 6 số
  useEffect(() => {
    if (otp.length === 6) {
      if (otp !== lastSubmittedOtp.current && !loading) {
        lastSubmittedOtp.current = otp;
        handleVerify();
      }
    } else {
      lastSubmittedOtp.current = ''; // Reset để có thể nhập lại nếu xóa bớt
    }
  }, [otp, loading, handleVerify]);

  return (
    <div className="mil-login-overlay">
      <div className="mil-login-box">
        <div className="mil-box-header">
          <i className="fas fa-user-shield"></i>
          <span>Admin Login</span>
        </div>
        
        <div className="mil-box-body">
          {step === 'init' ? (
            <div className="mil-status-container">
              <div className="mil-blink">INITIALIZING SECURE LINK...</div>
              {loading && <div className="mil-loader"></div>}
              {error && <div className="mil-error">{error}</div>}
              {error && <button onClick={requestOtp} className="btn">Thử lại</button>}
            </div>
          ) : (
            <form onSubmit={handleVerify}>
              <div className="mil-info-text">
                <i className="fas fa-shield-alt"></i>
                MÃ OTP ĐÃ ĐƯỢC GỬI TỚI TELEGRAM CHỈ ĐỊNH.
              </div>
              
              <div className="mil-input-group">
                <label>ENTER ACCESS CODE:</label>
                <input
                  type="text"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="******"
                  autoFocus
                  className="mil-input-otp"
                />
              </div>

              {error && <div className="mil-error">{error}</div>}

              <button type="submit" className="btn mil-btn-submit" disabled={loading || otp.length < 6}>
                {loading ? 'ĐANG XÁC THỰC...' : 'Xác nhận'}
              </button>
              
              <div className="mil-footer-links">
                <span onClick={requestOtp} style={{ cursor: 'pointer', textDecoration: 'underline' }}>
                  GỬI LẠI MÃ (RESEND)
                </span>
              </div>
            </form>
          )}
        </div>
        
        <div className="mil-box-footer">
          <span>ENCRYPTION: AES-256</span>
          <span>STATUS: {loading ? 'PROCESSING' : 'AWAITING'}</span>
        </div>
      </div>

      <style>{`
        .mil-login-overlay {
          position: fixed; inset:0; display:flex; align-items:center; justify-content:center; z-index:10001;
          background: rgba(15,23,42,0.06);
        }
        .mil-login-box {
          width: 420px; background: var(--card-bg); border: 1px solid rgba(15,23,42,0.04); box-shadow: var(--shadow-md); position: relative; border-radius:12px; overflow:hidden;
        }
        .mil-box-header { background: transparent; color: var(--text); padding: 14px 16px; font-weight:700; font-size:14px; display:flex; align-items:center; gap:10px }
        .mil-box-body { padding: 22px }
        .mil-status-container { text-align:center; color: var(--muted) }
        .mil-info-text { font-size:13px; color: var(--muted); margin-bottom:16px; display:flex; align-items:center; gap:8px }
        .mil-input-group label { display:block; font-size:12px; color:var(--muted); margin-bottom:8px }
        .mil-input-otp { width:100%; background:var(--card-bg); border:1px solid rgba(15,23,42,0.04); color:var(--text); padding:12px; font-size:20px; text-align:center; letter-spacing:6px; border-radius:8px }
        .mil-btn-submit { width:100%; padding:12px; }
        .mil-btn-submit:disabled { opacity:0.6; cursor:not-allowed }
        .mil-error { color: var(--danger); font-size:11px; margin-top:10px; text-align:center }
        .mil-box-footer { border-top:1px solid rgba(15,23,42,0.03); padding:8px 15px; display:flex; justify-content:space-between; font-size:12px; color:var(--muted) }
        .mil-footer-links { margin-top:12px; text-align:center; font-size:13px; color:var(--muted) }
        .mil-loader { width:20px; height:20px; border:2px solid rgba(15,23,42,0.06); border-top:2px solid rgba(96,165,250,0.2); border-radius:50%; animation:spin 1s linear infinite; margin:15px auto }
        @keyframes spin { to { transform: rotate(360deg) } }
      `}</style>
    </div>
  );
};

export default CenterLogin;