import React, { useEffect, useState } from 'react';

const ipc = window.electron?.ipcRenderer;

function WebAppControl() {
  const [caoStatus, setCaoStatus] = useState(false);
  const [nanStatus, setNanStatus] = useState(false);
  const [loadingCao, setLoadingCao] = useState(false);
  const [loadingNan, setLoadingNan] = useState(false);

  const fetchStatus = async () => {
    if (!ipc) return;
    const cao = await ipc.invoke('get-taixiucao-web-status');
    const nan = await ipc.invoke('get-taixiunan-web-status');
    setCaoStatus(!!cao.running);
    setNanStatus(!!nan.running);
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleCao = async () => {
    setLoadingCao(true);
    if (caoStatus) await ipc.invoke('stop-taixiucao-web');
    else await ipc.invoke('start-taixiucao-web');
    setTimeout(fetchStatus, 1000);
    setLoadingCao(false);
  };

  const handleNan = async () => {
    setLoadingNan(true);
    if (nanStatus) await ipc.invoke('stop-taixiunan-web');
    else await ipc.invoke('start-taixiunan-web');
    setTimeout(fetchStatus, 1000);
    setLoadingNan(false);
  };

  return (
    <div style={{padding:20}}>
      <h3>Quản lý WebApp Tài Xỉu</h3>
      <div style={{marginBottom:10}}>
        <span>Taixiu Cao: </span>
        <button onClick={handleCao} disabled={loadingCao} style={{marginRight:10}}>
          {caoStatus ? 'Tắt' : 'Bật'}
        </button>
        <span style={{color: caoStatus ? 'green' : 'red'}}>
          {caoStatus ? 'Đang chạy' : 'Đã tắt'}
        </span>
      </div>
      <div>
        <span>Taixiu Nan: </span>
        <button onClick={handleNan} disabled={loadingNan} style={{marginRight:10}}>
          {nanStatus ? 'Tắt' : 'Bật'}
        </button>
        <span style={{color: nanStatus ? 'green' : 'red'}}>
          {nanStatus ? 'Đang chạy' : 'Đã tắt'}
        </span>
      </div>
    </div>
  );
}

export default WebAppControl;
