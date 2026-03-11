import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { getDashboardApiBaseUrl } from '../utils/runtime-endpoints';
import { normalizeMojibakeText, normalizePayload } from '../utils/mojibake';

const ToastContext = createContext();

export const useToast = () => useContext(ToastContext);

const HTTP_ONLY_CHANNELS = [
  'get-zalopay-status',
  'start-zalopay-worker',
  'stop-zalopay-worker'
];

export const useIpc = () => {
  const invoke = useCallback(async (channel, ...args) => {
    let ipc = null;

    if (!HTTP_ONLY_CHANNELS.includes(channel)) {
      if (window.ipcRenderer) {
        ipc = window.ipcRenderer;
      } else if (window.electron && window.electron.ipcRenderer) {
        ipc = window.electron.ipcRenderer;
      } else if (window.require) {
        try {
          const { ipcRenderer } = window.require('electron');
          ipc = ipcRenderer;
        } catch (e) {}
      }
    }

    if (ipc) {
      try {
        const result = await ipc.invoke(channel, ...args);
        return normalizePayload(result);
      } catch (error) {
        if (error.message && error.message.includes('No handler registered')) {
          console.warn(`[useIpc] IPC Handler missing for '${channel}', falling back to HTTP API.`);
        } else {
          throw error;
        }
      }
    }

    const cskhRestMap = {
      'get-cskh-users': { method: 'GET', endpoint: '/api/cskh/users' },
      'create-cskh-user': { method: 'POST', endpoint: '/api/cskh/users' },
      'update-cskh-user': {
        method: 'PUT',
        endpoint: `/api/cskh/users/${args[0]?.id || ''}`
      },
      'delete-cskh-user': {
        method: 'DELETE',
        endpoint: `/api/cskh/users/${args[0]?.id || ''}`
      }
    };

    try {
      const API_URL = getDashboardApiBaseUrl();
      const mapped = cskhRestMap[channel];
      const endpoint = mapped ? mapped.endpoint : `/api/${channel}`;
      const body = args[0] || {};
      const method = mapped ? mapped.method : (channel.startsWith('get-') ? 'GET' : 'POST');
      const cskhToken = localStorage.getItem('cskhToken');
      const headers = {};
      if (['POST', 'PUT', 'PATCH'].includes(method)) headers['Content-Type'] = 'application/json';
      if (mapped && cskhToken) headers.Authorization = `Bearer ${cskhToken}`;
      if (mapped && !cskhToken) {
        return normalizePayload({ success: false, message: 'Chua dang nhap CSKH hoac token da het han' });
      }

      const response = await fetch(API_URL + endpoint, {
        method,
        headers,
        body: ['POST', 'PUT', 'PATCH'].includes(method) ? JSON.stringify(body) : undefined
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: `Loi HTTP: ${response.status}` }));
        return normalizePayload({ success: false, message: errorData.message || 'Loi mang' });
      }

      const data = await response.json();
      return normalizePayload(data);
    } catch (error) {
      console.error(`API call for "${channel}" failed:`, error);
      return normalizePayload({ success: false, message: 'Khong the ket noi toi server API.' });
    }
  }, []);

  return { invoke };
};

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);
  const audioRef = useRef(null);
  const toastTypeStyles = {
    error: { background: '#b91c1c', border: '1px solid #7f1d1d' },
    success: { background: '#15803d', border: '1px solid #14532d' },
    info: { background: '#1d4ed8', border: '1px solid #1e3a8a' }
  };

  const showToast = useCallback((message, type = 'info') => {
    const id = Date.now();
    const normalizedMessage = normalizeMojibakeText(String(message ?? ''));
    setToasts((prev) => [...prev, { id, message: normalizedMessage, type }]);

    if (audioRef.current) {
      audioRef.current.src = './notification.mp3';
      audioRef.current.play().catch(() => {});
    }

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div
        style={{
          position: 'fixed',
          right: 16,
          bottom: 16,
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          maxWidth: 420
        }}
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role="alert"
            aria-live="assertive"
            aria-atomic="true"
            style={{
              color: '#fff',
              borderRadius: 10,
              padding: '10px 12px',
              boxShadow: '0 10px 25px rgba(0,0,0,0.35)',
              fontSize: 14,
              lineHeight: 1.4,
              ...toastTypeStyles[toast.type || 'info']
            }}
          >
            {toast.message}
          </div>
        ))}
      </div>
      <audio ref={audioRef} preload="auto" style={{ display: 'none' }} />
    </ToastContext.Provider>
  );
};



