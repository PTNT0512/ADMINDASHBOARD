import React, { useState, useEffect } from 'react';

const ActivationLogViewer = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      // Placeholder for IPC call to fetch logs
      // const data = await window.electron?.ipcRenderer?.invoke('get-activation-logs');
      // setLogs(data || []);
      setLogs([]); // Default to empty for now
    } catch (error) {
      console.error("Error fetching logs:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  return (
    <div className="p-4 bg-base-100 rounded-box shadow-sm h-full">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">Nhật ký Kích hoạt</h2>
        <button className="btn btn-sm btn-ghost" onClick={fetchLogs}>
          <i className="fas fa-sync-alt mr-2"></i> Làm mới
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="table table-zebra w-full">
          <thead>
            <tr>
              <th>Thời gian</th>
              <th>License Key</th>
              <th>Thiết bị</th>
              <th>Trạng thái</th>
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 ? (
              <tr>
                <td colSpan="4" className="text-center py-4 text-gray-500">Chưa có dữ liệu</td>
              </tr>
            ) : (
              logs.map((log, i) => (
                <tr key={i}>
                  <td>{new Date(log.createdAt).toLocaleString()}</td>
                  <td>{log.licenseKey}</td>
                  <td>{log.machineId}</td>
                  <td>
                    <span className={`badge ${log.success ? 'badge-success' : 'badge-error'}`}>
                      {log.success ? 'Thành công' : 'Thất bại'}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ActivationLogViewer;