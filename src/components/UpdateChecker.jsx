import React, { useState, useEffect } from 'react';

const UpdateChecker = () => {
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);
  const [version, setVersion] = useState('');

  // Helper để lấy ipcRenderer an toàn
  const getIpcRenderer = () => {
    if (window.ipcRenderer) return window.ipcRenderer;
    if (window.require) {
      try { return window.require('electron').ipcRenderer; } catch (e) {}
    }
    return null;
  };

  useEffect(() => {
    const ipc = getIpcRenderer();
    if (ipc) {
      // Lấy phiên bản hiện tại khi component mount
      ipc.invoke('get-app-version').then(ver => setVersion(ver)).catch(() => {});

      // Lắng nghe thông báo cập nhật từ Main Process
      const handleMessage = (event, text) => {
        setStatus(text);
        // Tắt loading khi có kết quả cuối cùng
        if (text.includes('Tải xong') || text.includes('mới nhất') || text.includes('Lỗi')) {
          setLoading(false);
        }
      };
      ipc.on('update-message', handleMessage);

      // Cleanup listener khi unmount
      return () => ipc.removeListener('update-message', handleMessage);
    }
  }, []);

  const handleCheck = async () => {
    const ipc = getIpcRenderer();
    if (!ipc) {
      setStatus('Không tìm thấy môi trường Electron');
      return;
    }
    
    setLoading(true);
    setStatus('Đang kết nối...');
    try {
      // Gọi sự kiện check-for-update bên Main Process
      const res = await ipc.invoke('check-for-update');
      if (!res.success) {
        setStatus(res.message);
        setLoading(false);
      }
    } catch (e) {
      setStatus('Lỗi: ' + e.message);
      setLoading(false);
    }
  };

  return (
    <div className="p-4 bg-white rounded-lg shadow border border-gray-200 max-w-sm">
      <div className="flex justify-between items-center mb-3">
        <h3 className="font-bold text-gray-800">Cập nhật phần mềm</h3>
        {version && <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">v{version}</span>}
      </div>
      
      <div className="flex flex-col gap-3">
        <div className="text-sm text-gray-600 min-h-[20px]">
          {status || 'Nhấn nút bên dưới để kiểm tra bản cập nhật mới.'}
        </div>
        
        <button
          onClick={handleCheck}
          disabled={loading}
          className={`w-full py-2 px-4 rounded font-medium transition-all flex justify-center items-center gap-2
            ${loading 
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
              : 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm hover:shadow'
            }`}
        >
          {loading && (
            <svg className="animate-spin h-4 w-4 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          )}
          {loading ? 'Đang kiểm tra...' : 'Kiểm tra ngay'}
        </button>
      </div>
    </div>
  );
};

export default UpdateChecker;