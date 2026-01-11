import React, { useState, useEffect } from 'react';
import { Activity, Power, Server, Terminal, RefreshCw, Play, Square, Globe, Cpu } from 'lucide-react';

const ServerManager = () => {
  const [servers, setServers] = useState({
    gameEngine: { name: 'Game Engine (Internal)', port: 'INTERNAL', running: false, loading: false, id: 'game-engine', description: 'Hệ thống xử lý game nội bộ (Dashboard).' },
    gameAdmin: { name: 'Game Admin Server', port: 4002, running: false, loading: false, id: 'game-server', description: 'Server xử lý logic game, kết quả, bot.' },
    taixiuWeb: { name: 'Tài Xỉu Web Server', port: 4003, running: false, loading: false, id: 'taixiu-web', description: 'Web server hiển thị game Tài Xỉu.' },
  });
  
  const [extraGames, setExtraGames] = useState([]);

  // Helper to get ipcRenderer
  const getIpcRenderer = () => {
    if (window.ipcRenderer) return window.ipcRenderer;
    if (window.require) {
      try { return window.require('electron').ipcRenderer; } catch (e) {}
    }
    return null;
  };

  const ipc = getIpcRenderer();

  const fetchStatuses = async () => {
    if (!ipc) return;

    try {
        // Main Servers
        const gameServerStatus = await ipc.invoke('get-game-server-status');
        const taixiuWebStatus = await ipc.invoke('get-taixiu-web-status');
        const gameEngineStatus = await ipc.invoke('get-game-engine-status');

        setServers(prev => ({
            ...prev,
            gameAdmin: { ...prev.gameAdmin, running: gameServerStatus.running },
            taixiuWeb: { ...prev.taixiuWeb, running: taixiuWebStatus.running },
            gameEngine: { ...prev.gameEngine, running: gameEngineStatus.running },
        }));

        // Extra Games
        const extras = await ipc.invoke('get-extra-games-status');
        setExtraGames(extras);
    } catch (error) {
        console.error("Error fetching server statuses:", error);
    }
  };

  useEffect(() => {
    fetchStatuses();
    const interval = setInterval(fetchStatuses, 3000);
    return () => clearInterval(interval);
  }, []);

  const toggleServer = async (key, serverInfo) => {
    if (!ipc) return;
    
    setServers(prev => ({ ...prev, [key]: { ...prev[key], loading: true } }));
    
    const action = serverInfo.running ? 'stop' : 'start';
    const channel = `${action}-${serverInfo.id}`;
    
    try {
      await ipc.invoke(channel);
      setTimeout(fetchStatuses, 1000);
    } catch (error) {
      console.error(`Failed to ${action} ${serverInfo.name}`, error);
    } finally {
      setServers(prev => ({ ...prev, [key]: { ...prev[key], loading: false } }));
    }
  };

  const toggleExtraGame = async (gameId) => {
    if (!ipc) return;
    try {
      await ipc.invoke('toggle-extra-game', gameId);
      setTimeout(fetchStatuses, 1000);
    } catch (error) {
      console.error(`Failed to toggle ${gameId}`, error);
    }
  };

  return (
    <div className="p-6 bg-slate-50 min-h-screen font-sans text-slate-800">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
          <Server className="text-blue-600" size={32} /> 
          Quản Lý Server
        </h1>
        <p className="text-slate-500 mt-2">Điều khiển trạng thái hoạt động của các server game và web client.</p>
      </div>

      {/* Core System Servers */}
      <div className="mb-10">
        <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
            <Cpu size={20} className="text-indigo-600"/> Backend Servers
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {Object.entries(servers).map(([key, server]) => (
            <div key={key} className={`bg-white rounded-xl p-6 border-l-4 shadow-sm transition-all hover:shadow-md ${server.running ? 'border-green-500' : 'border-slate-300'}`}>
                <div className="flex justify-between items-start mb-4">
                    <div>
                        <h3 className="font-bold text-lg text-slate-800">{server.name}</h3>
                        <p className="text-sm text-slate-500 mt-1">{server.description}</p>
                    </div>
                    <div className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 ${server.running ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                        <div className={`w-2 h-2 rounded-full ${server.running ? 'bg-green-500 animate-pulse' : 'bg-slate-400'}`}></div>
                        {server.running ? 'RUNNING' : 'STOPPED'}
                    </div>
                </div>
                
                <div className="flex items-center justify-between mt-6">
                    <div className="text-xs font-mono bg-slate-100 px-2 py-1 rounded text-slate-600 border border-slate-200">
                        PORT: {server.port}
                    </div>
                    <button
                        onClick={() => toggleServer(key, server)}
                        disabled={server.loading}
                        className={`px-5 py-2 rounded-lg font-bold text-sm flex items-center gap-2 transition-all transform active:scale-95
                            ${server.running 
                            ? 'bg-red-100 text-red-600 hover:bg-red-200' 
                            : 'bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-600/20'
                            } ${server.loading ? 'opacity-70 cursor-wait' : ''}`}
                    >
                        {server.loading ? <RefreshCw className="animate-spin" size={16} /> : (server.running ? <Square size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />)}
                        {server.loading ? 'Đang xử lý...' : (server.running ? 'Tắt Server' : 'Bật Server')}
                    </button>
                </div>
            </div>
            ))}
        </div>
      </div>

      {/* Game Clients */}
      <div>
        <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
            <Globe size={20} className="text-teal-600"/> Game Clients (Frontend)
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {extraGames.map((game) => (
            <div key={game.id} className={`bg-white rounded-xl p-5 border border-slate-200 shadow-sm hover:shadow-md transition-all relative overflow-hidden group`}>
                {game.running && <div className="absolute top-0 right-0 w-20 h-20 bg-green-500/5 rounded-bl-[100px] -mr-10 -mt-10 z-0 transition-all group-hover:bg-green-500/10"></div>}
                
                <div className="relative z-10">
                    <div className="flex justify-between items-start mb-3">
                        <h3 className="font-bold text-lg text-slate-800">{game.title || game.id}</h3>
                        <div className={`w-3 h-3 rounded-full ${game.running ? 'bg-green-500 shadow-[0_0_8px_#22c55e]' : 'bg-slate-300'}`}></div>
                    </div>
                    
                    <div className="text-xs text-slate-500 mb-5 font-mono flex items-center gap-2">
                        <span className="bg-slate-100 px-2 py-0.5 rounded border border-slate-200">Port: {game.port}</span>
                    </div>

                    <button
                        onClick={() => toggleExtraGame(game.id)}
                        className={`w-full py-2.5 rounded-lg font-bold text-sm flex items-center justify-center gap-2 transition-all
                            ${game.running 
                            ? 'bg-white border-2 border-red-100 text-red-500 hover:bg-red-50 hover:border-red-200' 
                            : 'bg-slate-800 text-white hover:bg-slate-700 shadow-lg shadow-slate-800/20'
                            }`}
                    >
                        {game.running ? <Square size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" />}
                        {game.running ? 'Dừng Client' : 'Chạy Client'}
                    </button>
                </div>
            </div>
            ))}
        </div>
      </div>
    </div>
  );
};

export default ServerManager;