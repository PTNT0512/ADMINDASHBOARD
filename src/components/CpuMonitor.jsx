import React, { useState, useEffect, useRef } from 'react';

function CpuMonitor() {
  const [stats, setStats] = useState({ cpu: 0, mem: 0, totalMem: '0 GB', usedMem: '0 GB', uptime: '0' });
  const [logs, setLogs] = useState([]);
  const logsEndRef = useRef(null);
  const [filterText, setFilterText] = useState('');
  const [filterType, setFilterType] = useState('ALL');

  useEffect(() => {
    if (window.require) {
      const { ipcRenderer } = window.require('electron');
      
      // Get initial logs
      ipcRenderer.invoke('get-logs').then(setLogs).catch(err => console.warn("Chưa kết nối được logs:", err));

      // Listen for stats
      const handleStats = (event, data) => setStats(data);
      ipcRenderer.on('system-stats', handleStats);

      // Listen for new logs
      const handleNewLog = (event, log) => {
        setLogs(prev => [...prev.slice(-199), log]);
      };
      ipcRenderer.on('new-log', handleNewLog);

      return () => {
        ipcRenderer.removeListener('system-stats', handleStats);
        ipcRenderer.removeListener('new-log', handleNewLog);
      };
    }
  }, []);

  // Auto scroll to bottom
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  const filteredLogs = logs.filter(log => {
    if (filterType !== 'ALL' && log.type !== filterType) return false;
    if (filterText && !log.message.toLowerCase().includes(filterText.toLowerCase())) return false;
    return true;
  });

  const handleExport = async () => {
    if (window.require) {
      const content = filteredLogs.map(l => `[${l.time}] [${l.type}] ${l.message}`).join('\n');
      const { ipcRenderer } = window.require('electron');
      await ipcRenderer.invoke('export-logs', content);
    }
  };

  return (
    <>
      <header><h1>Giám Sát Hệ Thống (CPU / Logs)</h1></header>
      
      <div className="settings-container" style={{ marginBottom: '20px', flex: '0 0 auto' }}>
        <h3>Thông số máy chủ</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          
          {/* CPU Card */}
          <div style={{ background: '#f8f9fa', padding: '15px', borderRadius: '8px', border: '1px solid #e9ecef' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
              <strong>CPU Usage</strong>
              <span style={{ color: stats.cpu > 80 ? 'red' : 'green', fontWeight: 'bold' }}>{stats.cpu}%</span>
            </div>
            <div style={{ width: '100%', height: '10px', background: '#e9ecef', borderRadius: '5px', overflow: 'hidden' }}>
              <div style={{ width: `${stats.cpu}%`, height: '100%', background: stats.cpu > 80 ? '#dc3545' : '#28a745', transition: 'width 0.5s' }}></div>
            </div>
            <p style={{ fontSize: '12px', color: '#666', marginTop: '5px' }}>Uptime: {stats.uptime}</p>
          </div>

          {/* RAM Card */}
          <div style={{ background: '#f8f9fa', padding: '15px', borderRadius: '8px', border: '1px solid #e9ecef' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
              <strong>RAM Usage</strong>
              <span style={{ color: stats.mem > 80 ? 'orange' : '#1976d2', fontWeight: 'bold' }}>{stats.mem}%</span>
            </div>
            <div style={{ width: '100%', height: '10px', background: '#e9ecef', borderRadius: '5px', overflow: 'hidden' }}>
              <div style={{ width: `${stats.mem}%`, height: '100%', background: stats.mem > 80 ? '#ffc107' : '#1976d2', transition: 'width 0.5s' }}></div>
            </div>
            <p style={{ fontSize: '12px', color: '#666', marginTop: '5px' }}>{stats.usedMem} / {stats.totalMem}</p>
          </div>

        </div>
      </div>

      <div className="table-container" style={{ display: 'flex', flexDirection: 'column', flex: 1, background: '#1e1e1e', color: '#00ff00', fontFamily: 'monospace', padding: '0' }}>
        <div style={{ padding: '10px', background: '#333', color: 'white', borderBottom: '1px solid #444', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <span style={{ fontWeight: 'bold' }}>Terminal Logs</span>
            <select 
              value={filterType} 
              onChange={(e) => setFilterType(e.target.value)}
              style={{ background: '#555', color: 'white', border: 'none', padding: '4px 8px', borderRadius: '4px', fontSize: '12px' }}
            >
              <option value="ALL">ALL</option>
              <option value="INFO">INFO</option>
              <option value="WARN">WARN</option>
              <option value="ERROR">ERROR</option>
            </select>
            <input 
              placeholder="Tìm kiếm log..." 
              value={filterText} 
              onChange={(e) => setFilterText(e.target.value)}
              style={{ background: '#555', color: 'white', border: 'none', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', width: '150px' }}
            />
          </div>
          <div style={{ display: 'flex', gap: '5px' }}>
            <button onClick={handleExport} style={{ padding: '4px 12px', fontSize: '12px', background: '#2196f3', border: 'none', color: 'white' }}>Export .txt</button>
            <button onClick={() => setLogs([])} style={{ padding: '4px 12px', fontSize: '12px', background: '#666', border: 'none', color: 'white' }}>Clear</button>
          </div>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '15px' }}>
          {filteredLogs.map((log, index) => (
            <div key={index} style={{ marginBottom: '4px', wordBreak: 'break-all' }}>
              <span style={{ color: '#888' }}>[{log.time}]</span>
              <span style={{ 
                color: log.type === 'ERROR' ? '#ff4444' : log.type === 'WARN' ? '#ffbb33' : '#00ccff', 
                margin: '0 8px',
                fontWeight: 'bold'
              }}>[{log.type}]</span>
              <span>{log.message}</span>
            </div>
          ))}
          <div ref={logsEndRef} />
        </div>
      </div>
    </>
  );
}

export default CpuMonitor;