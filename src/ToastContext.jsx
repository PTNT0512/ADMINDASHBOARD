import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';

const ToastContext = createContext();

export const useToast = () => useContext(ToastContext);

export const ToastProvider = ({ children }) => {
  const [toast, setToast] = useState(null);
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Tải cấu hình âm thanh và lắng nghe thay đổi từ hệ thống
  useEffect(() => {
    const loadPreference = async () => {
      if (window.require) {
        const { ipcRenderer } = window.require('electron');
        const result = await ipcRenderer.invoke('get-settings');
        if (result.success && result.data) {
          setSoundEnabled(result.data.enableSound !== false);
        }
      }
    };
    loadPreference();

    if (window.require) {
      const { ipcRenderer } = window.require('electron');
      const updateHandler = () => loadPreference();
      ipcRenderer.on('settings-updated', updateHandler);
      return () => ipcRenderer.removeListener('settings-updated', updateHandler);
    }
  }, []);

  const showToast = useCallback((message, type = 'info') => {
    setToast({ message, type });

    // Phát âm thanh thông báo dựa trên loại Toast nếu âm thanh được bật trong cài đặt
    if (soundEnabled) {
      const sounds = {
        error: './error.mp3',
        success: './success.mp3',
        info: './info.mp3'
      };

      const audioPath = sounds[type];
      if (audioPath) {
        const audio = new Audio(audioPath);
        audio.play().catch(err => console.warn('Không thể phát âm thanh thông báo:', err));
      }
    }

    // Tự động ẩn sau 4 giây
    setTimeout(() => setToast(null), 4000);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {toast && (
        <div className={`toast-message ${toast.type}`}>
          {toast.type === 'error' ? '❌ ' : toast.type === 'success' ? '✅ ' : '🔔 '}
          {toast.message}
        </div>
      )}
    </ToastContext.Provider>
  );
};

// Custom hook để gọi IPC và tự động xử lý lỗi
export const useIpc = () => {
  const { showToast } = useToast();

  const invoke = async (channel, ...args) => {
    if (!window.require) return { success: false, message: 'Không tìm thấy môi trường Electron' };
    
    try {
      const { ipcRenderer } = window.require('electron');
      const response = await ipcRenderer.invoke(channel, ...args);

      // Nếu backend trả về success: false, tự động hiện Toast lỗi
      if (response && response.success === false) {
        showToast(response.message || 'Đã có lỗi xảy ra', 'error');
      }
      return response;
    } catch (error) {
      showToast('Lỗi kết nối hệ thống: ' + error.message, 'error');
      return { success: false, message: error.message };
    }
  };

  return { invoke };
};