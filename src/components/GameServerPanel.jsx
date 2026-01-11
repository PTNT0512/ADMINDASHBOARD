import React, { useEffect, useState } from 'react';
import ioClient from 'socket.io-client';
import { useIpc } from './ToastContext';

export default function GameServerPanel() {
  const [running, setRunning] = useState(false);
  const [pid, setPid] = useState(null);
  const [logs, setLogs] = useState([]);
  const [socket, setSocket] = useState(null);

  const { invoke } = useIpc();

  useEffect(() => {
    invoke('get-game-server-status').then(res => {
      if (res && res.success) { setRunning(res.running); setPid(res.pid); }
    }).catch(()=>{});

    // Connect to socket.io on same origin
    const s = ioClient('http://localhost:4001');
    setSocket(s);
    s.on('connect', () => {});
    s.on('game-server-log', (data) => {
      setLogs(prev => [...prev.slice(-199), { ...data, time: data.time || new Date() }]);
    });
    s.on('game-server-started', (d) => { setRunning(true); setPid(d.pid); });
    s.on('game-server-exit', () => { setRunning(false); setPid(null); });

    return () => { try { s.disconnect(); } catch(e){} };
  }, []);

  const start = async () => {
    const res = await invoke('start-game-server');
    if (res && res.success) setRunning(true);
  };
  const stop = async () => {
    const res = await invoke('stop-game-server');
    if (res && res.success) setRunning(false);
  };

  return (
    <div style={{ padding: 12, borderRadius: 8, background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
      <h3 style={{ margin: 0, marginBottom: 8 }}>Game Server</h3>
      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        <button onClick={start} disabled={running} style={{ padding: '6px 10px' }}>Start</button>
        <button onClick={stop} disabled={!running} style={{ padding: '6px 10px' }}>Stop</button>
        <div style={{ marginLeft: 'auto', fontSize: 12, color: '#555' }}>{running ? `Running (pid ${pid})` : 'Stopped'}</div>
      </div>
      <div style={{ maxHeight: 220, overflow: 'auto', background: '#0f172a', color: '#e6eef8', padding: 8, borderRadius: 6 }}>
        {logs.length === 0 ? <div style={{ fontSize: 12, color: '#9aa9bf' }}>No logs yet</div> : logs.map((l, i) => (
          <div key={i} style={{ fontFamily: 'monospace', fontSize: 12, marginBottom: 6 }}>[{new Date(l.time).toLocaleTimeString()}] {l.message}</div>
        ))}
      </div>
    </div>
  );
}
