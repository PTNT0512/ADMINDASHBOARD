import React, { useState, useEffect } from 'react';

const ExtraGamesManager = () => {
    const [games, setGames] = useState([]);
    const [loading, setLoading] = useState({});
    const [logs, setLogs] = useState({});

    // Hàm an toàn để lấy ipcRenderer trong môi trường Electron
    const getIpcRenderer = () => {
        if (window.ipcRenderer) return window.ipcRenderer;
        if (window.require) {
            try {
                const { ipcRenderer } = window.require('electron');
                return ipcRenderer;
            } catch (e) {
                console.error("Electron IPC not found");
            }
        }
        return null;
    };

    useEffect(() => {
        const ipcRenderer = getIpcRenderer();
        if (!ipcRenderer) return;

        // 1. Lấy trạng thái ban đầu khi component mount
        ipcRenderer.invoke('get-extra-games-status').then((result) => {
            if (Array.isArray(result)) {
                setGames(result);
                // Lấy logs ban đầu cho từng game
                result.forEach(game => {
                    ipcRenderer.invoke('get-extra-game-logs', game.id).then(res => {
                        if (res.success) {
                            setLogs(prev => ({ ...prev, [game.id]: res.logs }));
                        }
                    });
                });
            }
        });

        // 2. Lắng nghe sự kiện thay đổi trạng thái từ main process (real-time)
        const handleStatusUpdate = (event, { id, running }) => {
            setGames(prevGames => prevGames.map(game => 
                game.id === id ? { ...game, running } : game
            ));
        };

        // 3. Lắng nghe log mới
        const handleLogUpdate = (event, { id, log }) => {
            setLogs(prev => {
                const currentLogs = prev[id] || [];
                const newLogs = [...currentLogs, log];
                if (newLogs.length > 50) newLogs.shift(); // Giữ lại 50 dòng mới nhất
                return { ...prev, [id]: newLogs };
            });
        };

        ipcRenderer.on('extra-game-status', handleStatusUpdate);
        ipcRenderer.on('extra-game-log', handleLogUpdate);

        // Cleanup listener khi unmount
        return () => {
            ipcRenderer.removeListener('extra-game-status', handleStatusUpdate);
            ipcRenderer.removeListener('extra-game-log', handleLogUpdate);
        };
    }, []);

    const toggleGame = async (gameId) => {
        const ipcRenderer = getIpcRenderer();
        if (!ipcRenderer) return;

        setLoading(prev => ({ ...prev, [gameId]: true }));
        try {
            const result = await ipcRenderer.invoke('toggle-extra-game', gameId);
            if (!result.success && result.message) {
                alert('Lỗi: ' + result.message);
            }
        } catch (error) {
            console.error("Toggle error:", error);
        } finally {
            setLoading(prev => ({ ...prev, [gameId]: false }));
        }
    };

    return (
        <div className="p-6 bg-white rounded-xl shadow-sm border border-gray-100 mb-6">
            <h2 className="text-xl font-bold mb-6 text-gray-800 flex items-center gap-2">
                <i className="fas fa-gamepad text-blue-500"></i> Quản lý Game Ports (1111-2222)
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
                {games.map((game) => (
                    <div key={game.id} className={`relative border rounded-xl p-4 flex flex-col justify-between transition-all duration-200 ${game.running ? 'bg-green-50 border-green-200 shadow-green-100' : 'bg-gray-50 border-gray-200'}`}>
                        
                        <div className="flex justify-between items-start mb-3">
                            <div>
                                <h3 className="font-bold text-lg uppercase text-gray-700">{game.id}</h3>
                                <div className="flex items-center gap-1 text-xs text-gray-500 font-mono bg-white px-2 py-1 rounded border border-gray-100 inline-block mt-1">
                                    <i className="fas fa-network-wired"></i> :{game.port}
                                </div>
                            </div>
                            <div className={`w-3 h-3 rounded-full shadow-sm ${game.running ? 'bg-green-500 animate-pulse' : 'bg-gray-300'}`}></div>
                        </div>

                        <div className="mt-auto space-y-2">
                            <button
                                onClick={() => toggleGame(game.id)}
                                disabled={loading[game.id]}
                                className={`w-full py-2 px-3 rounded-lg font-medium text-sm transition-all flex items-center justify-center gap-2 ${
                                    game.running 
                                        ? 'bg-white border border-red-200 text-red-600 hover:bg-red-50' 
                                        : 'bg-blue-600 text-white hover:bg-blue-700 shadow-md shadow-blue-200'
                                } ${loading[game.id] ? 'opacity-70 cursor-wait' : ''}`}
                            >
                                {loading[game.id] ? (
                                    <><i className="fas fa-spinner fa-spin"></i> Xử lý...</>
                                ) : (
                                    game.running ? <><i className="fas fa-power-off"></i> Tắt Game</> : <><i className="fas fa-play"></i> Bật Game</>
                                )}
                            </button>
                            
                            {game.running && (
                                <a 
                                    href={`http://localhost:${game.port}`} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="block w-full text-center py-2 px-3 rounded-lg bg-white border border-gray-200 text-gray-600 text-sm hover:text-blue-600 hover:border-blue-300 transition-colors"
                                >
                                    <i className="fas fa-external-link-alt mr-1"></i> Mở Web
                                </a>
                            )}
                        </div>

                        {/* Khu vực hiển thị Log */}
                        <div className="mt-3 bg-gray-900 rounded-lg p-2 h-32 overflow-y-auto text-[10px] font-mono border border-gray-700 shadow-inner">
                            {(logs[game.id] || []).length === 0 ? (
                                <div className="text-gray-500 italic text-center pt-10">Waiting for logs...</div>
                            ) : (
                                (logs[game.id] || []).slice().reverse().map((log, idx) => (
                                    <div key={idx} className={`mb-1 break-all border-b border-gray-800 pb-1 last:border-0 ${log.type === 'error' ? 'text-red-400' : 'text-green-400'}`}>
                                        <span className="text-gray-500 mr-1">[{new Date(log.time).toLocaleTimeString()}]</span>
                                        {log.message}
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                ))}
            </div>
            
            {games.length === 0 && (
                <div className="text-center py-8 text-gray-400">
                    <i className="fas fa-spinner fa-spin text-2xl mb-2"></i>
                    <p>Đang tải danh sách game...</p>
                </div>
            )}
        </div>
    );
};

export default ExtraGamesManager;