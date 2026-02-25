import React, { createContext, useContext, useState, useCallback, useRef } from 'react';

const ToastContext = createContext();

export const useToast = () => useContext(ToastContext);

// Danh sách các kênh API chỉ chạy qua HTTP (Server phụ), không qua Electron IPC
// Giúp tránh lỗi "No handler registered" trong console khi chạy trên Electron
const HTTP_ONLY_CHANNELS = [
  'get-zalopay-status',
  'start-zalopay-worker',
  'stop-zalopay-worker'
];

// Đây là hook IPC. Nó là nơi DUY NHẤT được phép truy cập `window.require`.
export const useIpc = () => {
  const invoke = useCallback(async (channel, ...args) => {
    let ipc = null;

    // Chỉ tìm kiếm IPC nếu channel không nằm trong danh sách HTTP-only
    if (!HTTP_ONLY_CHANNELS.includes(channel)) {
      // 1. Kiểm tra nếu được expose trực tiếp (contextBridge)
      if (window.ipcRenderer) {
        ipc = window.ipcRenderer;
      } 
      // 2. Kiểm tra nếu expose qua namespace 'electron'
      else if (window.electron && window.electron.ipcRenderer) {
        ipc = window.electron.ipcRenderer;
      }
      // 3. Kiểm tra nodeIntegration (window.require)
      else if (window.require) {
        try {
          const { ipcRenderer } = window.require('electron');
          ipc = ipcRenderer;
        } catch (e) {}
      }
    }

    if (ipc) {
      try {
        return await ipc.invoke(channel, ...args);
      } catch (error) {
        // Nếu lỗi là do chưa đăng ký handler trong Electron Main, fallback sang HTTP
        if (error.message && error.message.includes('No handler registered')) {
          console.warn(`[useIpc] IPC Handler missing for '${channel}', falling back to HTTP API.`);
        } else {
          throw error; // Các lỗi khác thì ném ra bình thường
        }
      }
    }

    // --- FALLBACK TO HTTP API FOR BROWSER ---
    try {
      // Địa chỉ của Game Admin Server, cần đảm bảo server này đang chạy
      const API_URL = 'http://localhost:4001'; 
      const endpoint = `/api/${channel}`;
      const body = args[0] || {}; // Giả định payload là argument đầu tiên

      const method = channel.startsWith('get-') ? 'GET' : 'POST';

      const response = await fetch(API_URL + endpoint, {
        method: method,
        headers: method === 'POST' ? { 'Content-Type': 'application/json' } : {},
        body: method === 'POST' ? JSON.stringify(body) : undefined,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: `Lỗi HTTP: ${response.status}` }));
        return { success: false, message: errorData.message || 'Lỗi mạng' };
      }

      return await response.json();
    } catch (error) {
      console.error(`API call for "${channel}" failed:`, error);
      return { success: false, message: 'Không thể kết nối tới server API.' };
    }
  }, []);

  return { invoke };
};

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);
  const audioRef = useRef(null);

  const showToast = useCallback((message, type = 'info') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    
    // Phát âm thanh
    if (audioRef.current) {
      // Giả sử file notification.mp3 nằm trong thư mục public/ của bạn
      audioRef.current.src = './notification.mp3'; 
      audioRef.current.play().catch(err => {
        console.warn('Không thể phát âm thanh thông báo:', err.message);
      });
    }

    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 5000);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="toast-container position-fixed bottom-0 end-0 p-3" style={{ zIndex: 1100 }}>
        {toasts.map(toast => (
          <div key={toast.id} className={`toast show bg-${toast.type} text-white`} role="alert" aria-live="assertive" aria-atomic="true">
            <div className="toast-body">{toast.message}</div>
          </div>
        ))}
      </div>
      <audio ref={audioRef} preload="auto" style={{ display: 'none' }} />
    </ToastContext.Provider>
  );
};