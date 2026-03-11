import React, { Suspense, lazy, useState } from 'react';
import './App.css';
import './components/LayoutEnhancements.css';
import Login from './components/Login';
import CenterDashboard from './components/CenterDashboard';
import ChangePasswordModal from './components/ChangePasswordModal';
import { useIpc } from './components/ToastContext';

const APP_MODE = import.meta.env.VITE_APP_MODE === 'center' ? 'center' : 'dashboard';
const Dashboard = APP_MODE === 'dashboard' ? lazy(() => import('./components/Dashboard')) : null;
const LicenseActivation = APP_MODE === 'dashboard' ? lazy(() => import('./components/LicenseActivation')) : null;

function AdminPanel() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userRole, setUserRole] = useState('');
  const [isLicensed, setIsLicensed] = useState(false);
  const [isCheckingStatus, setIsCheckingStatus] = useState(true);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [tempCredentials, setTempCredentials] = useState(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [error, setError] = useState('');
  const { invoke } = useIpc();

  const loadingView = (
    <div className="mil-login-overlay">
      <div className="mil-status-container">
        <div className="mil-blink">VERIFYING SYSTEM...</div>
      </div>
    </div>
  );

  const checkLicenseAndProceed = async () => {
    if (APP_MODE === 'dashboard') {
      const result = await invoke('check-license-status');
      if (result.success) {
        setIsLicensed(result.activated);
      }
    } else {
      setIsLicensed(true);
    }
    setIsCheckingStatus(false);
  };

  const handleLoginSuccess = (data) => {
    setUserRole(data.role);
    setIsLoggedIn(true);
    checkLicenseAndProceed();
    setError('');
  };

  const handleLogin = async (usernameInput, passwordInput) => {
    setIsLoggingIn(true);
    try {
      const result = await invoke('login-request', {
        username: usernameInput,
        password: passwordInput,
      });

      if (result.success) {
        handleLoginSuccess(result);
        if (result.needPasswordChange) {
          setTempCredentials({ username: usernameInput, password: passwordInput });
          setShowPasswordModal(true);
        }
      }
      setError(result.success ? '' : result.message);
    } catch (loginError) {
      console.error(loginError);
      setError('Loi ket noi co so du lieu!');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleActivationSuccess = () => {
    setIsLicensed(true);
  };

  const handleLogout = () => {
    try {
      if (typeof window !== 'undefined' && typeof window.__adminWebClearSessionToken === 'function') {
        window.__adminWebClearSessionToken();
      }
    } catch (_) {}
    setIsLoggedIn(false);
    setUserRole('');
    setIsLicensed(false);
    setIsCheckingStatus(true);
    setShowPasswordModal(false);
  };

  if (!isLoggedIn) {
    return (
      <Login
        onLogin={handleLogin}
        onLoginSuccess={handleLoginSuccess}
        error={error}
        loading={isLoggingIn}
      />
    );
  }

  if (isCheckingStatus) {
    return loadingView;
  }

  return (
    <>
      {showPasswordModal ? (
        <ChangePasswordModal
          username={tempCredentials.username}
          oldPassword={tempCredentials.password}
          onSuccess={() => {
            setShowPasswordModal(false);
          }}
        />
      ) : null}

      <Suspense fallback={loadingView}>
        {userRole === 'superadmin' ? (
          <CenterDashboard onLogout={handleLogout} />
        ) : APP_MODE === 'dashboard' && !isLicensed && LicenseActivation ? (
          <LicenseActivation onActivationSuccess={handleActivationSuccess} />
        ) : APP_MODE === 'dashboard' && Dashboard ? (
          <Dashboard onLogout={handleLogout} />
        ) : null}
      </Suspense>
    </>
  );
}

export default AdminPanel;