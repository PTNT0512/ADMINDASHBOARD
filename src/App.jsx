import React, { useState, useEffect } from 'react';
import './App.css';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import LicenseActivation from './components/LicenseActivation';
import CenterDashboard from './components/CenterDashboard';
import ChangePasswordModal from './components/ChangePasswordModal';
import { ToastProvider, useToast, useIpc } from './components/ToastContext';

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userRole, setUserRole] = useState('');
  const [isLicensed, setIsLicensed] = useState(false);
  const [isCheckingStatus, setIsCheckingStatus] = useState(true); // Trạng thái kiểm tra ban đầu
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [tempCredentials, setTempCredentials] = useState(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [updateMsg, setUpdateMsg] = useState('');
  const { invoke } = useIpc();
  const { showToast } = useToast();

  // Hàm xử lý khi đăng nhập thành công (dùng cho cả OTP và mật khẩu)
  const handleLoginSuccess = (data) => {
    setUserRole(data.role);
    setIsLoggedIn(true);
    checkLicenseAndProceed(); // Kiểm tra bản quyền ngay sau khi đăng nhập thành công
    setError('');
  };

  // Hàm kiểm tra bản quyền, sẽ được gọi sau khi đăng nhập thành công
  const checkLicenseAndProceed = async () => {
    if (import.meta.env.VITE_APP_MODE === 'dashboard') {
      const result = await invoke('check-license-status');
      if (result.success) {
        setIsLicensed(result.activated);
      }
    } else {
      setIsLicensed(true); // Center mode không cần check
    }
    setIsCheckingStatus(false); // Hoàn tất kiểm tra
  };

  useEffect(() => {
    // Lắng nghe thông báo update từ Main Process
    if (window.require) {
      const { ipcRenderer } = window.require('electron');
      ipcRenderer.on('update-message', (event, message) => {
        console.log('Update status:', message);
        showToast(message, 'info');
        setUpdateMsg(message);
      });
      // Cleanup
      return () => ipcRenderer.removeAllListeners('update-message');
    }
  }, []);

  const handleLogin = async (usernameInput, passwordInput) => {
    setIsLoggingIn(true);
    try {
      const result = await invoke('login-request', { 
        username: usernameInput, 
        password: passwordInput
      });

      if (result.success) {
        // Luôn gọi handleLoginSuccess để thiết lập trạng thái đăng nhập
        // và kích hoạt quy trình kiểm tra bản quyền.
        handleLoginSuccess(result);
        if (result.needPasswordChange) {
          setTempCredentials({ username: usernameInput, password: passwordInput });
          setShowPasswordModal(true);
        }
      }
      setError(result.success ? '' : result.message);
    } catch (err) {
      console.error(err);
      setError('Lỗi kết nối cơ sở dữ liệu!');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleActivationSuccess = () => {
    setIsLicensed(true);
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setUserRole('');
    setIsLicensed(false); // Reset license status on logout
    setIsCheckingStatus(true); // Sẵn sàng cho lần đăng nhập sau
    setShowPasswordModal(false);
    setUsername('');
    setPassword('');
  };

  // Giao diện render chính
  // 1. Chưa đăng nhập -> Hiện trang Login
  // Giao diện trang Login
  if (!isLoggedIn) {
    return (
      <Login 
        onLogin={handleLogin} 
        onLoginSuccess={handleLoginSuccess} 
        error={error} 
        updateMsg={updateMsg}
        loading={isLoggingIn} 
      />
    );
  }

  // 2. Đã đăng nhập, nhưng đang kiểm tra bản quyền -> Hiện màn hình chờ
  if (isCheckingStatus) {
    return <div className="mil-login-overlay"><div className="mil-status-container"><div className="mil-blink">VERIFYING SYSTEM LICENSE...</div></div></div>;
  }

  return (
    <>
      {/* Modal đổi mật khẩu sẽ hiển thị đè lên trên các giao diện khác */}
      {showPasswordModal && (
        <ChangePasswordModal 
          username={tempCredentials.username}
          oldPassword={tempCredentials.password}
          onSuccess={() => {
            setShowPasswordModal(false);
          }}
        />
      )}

      {/* 3. Dựa vào trạng thái bản quyền và vai trò để hiển thị giao diện phù hợp */}
      {import.meta.env.VITE_APP_MODE === 'dashboard' && !isLicensed ? (
        <LicenseActivation onActivationSuccess={handleActivationSuccess} />
      ) : userRole === 'superadmin' ? (
        <CenterDashboard onLogout={handleLogout} />
      ) : (
        <Dashboard onLogout={handleLogout} />
      )}
    </>
  );
}

export default function AppWrapper() {
  return (
    <ToastProvider>
      <App />
    </ToastProvider>
  );
}
