import React, { createContext, useContext, useState, useCallback, useRef } from 'react';

const ToastContext = createContext();

export const useToast = () => useContext(ToastContext);

// Đây là hook IPC. Nó là nơi DUY NHẤT được phép truy cập `window.require`.
export const useIpc = () => {
  const invoke = useCallback(async (channel, ...args) => {
    if (window.require) {
      const { ipcRenderer } = window.require('electron');
      return await ipcRenderer.invoke(channel, ...args);
    }
    console.warn(`IPC channel "${channel}" call ignored: IPC not available.`);
    return Promise.resolve({ success: false, message: 'IPC not available' });
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