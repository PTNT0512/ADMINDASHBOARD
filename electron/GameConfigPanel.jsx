import React, { useState, useEffect } from 'react';

const GameConfigPanel = ({ gameType, title }) => {
    const [config, setConfig] = useState('');
    const [loading, setLoading] = useState(false);
    const [jsonError, setJsonError] = useState(null);

    const getIpcRenderer = () => {
        if (window.ipcRenderer) return window.ipcRenderer;
        if (window.require) {
            try { return window.require('electron').ipcRenderer; } catch (e) {}
        }
        return null;
    };

    const loadConfig = async () => {
        const ipc = getIpcRenderer();
        if (!ipc) return;
        setLoading(true);
        setJsonError(null);
        try {
            const res = await ipc.invoke('get-game-settings', gameType);
            if (res.success && res.data) {
                // Loại bỏ các trường hệ thống của Mongoose để dễ nhìn
                const { _id, __v, roomType, ...editableData } = res.data;
                setConfig(JSON.stringify(editableData, null, 4));
            } else {
                setConfig('{}');
            }
        } catch (e) {
            console.error(e);
            alert('Lỗi tải cấu hình: ' + e.message);
        } finally {
            setLoading(false);
        }
    };

    const handleConfigChange = (e) => {
        const val = e.target.value;
        setConfig(val);
        try {
            JSON.parse(val);
            setJsonError(null);
        } catch (err) {
            setJsonError(err.message);
        }
    };

    const saveConfig = async () => {
        const ipc = getIpcRenderer();
        if (!ipc) return;
        
        if (jsonError) {
            alert('❌ Vui lòng sửa lỗi cú pháp JSON trước khi lưu.');
            return;
        }

        try {
            const parsedData = JSON.parse(config);
            setLoading(true);
            const res = await ipc.invoke('save-game-settings', { gameType, data: parsedData });
            if (res.success) {
                alert('✅ Lưu cấu hình thành công!');
            } else {
                alert('❌ Lỗi lưu: ' + res.message);
            }
        } catch (e) {
            setJsonError(e.message);
            alert('❌ Lỗi định dạng JSON: ' + e.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadConfig();
    }, [gameType]);

    return (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-gray-800 uppercase flex items-center gap-2">
                    <i className="fas fa-cogs text-blue-500"></i> Cấu hình: {title}
                </h3>
                <button 
                    onClick={loadConfig}
                    className="text-sm text-gray-500 hover:text-blue-600"
                >
                    <i className="fas fa-sync-alt"></i> Làm mới
                </button>
            </div>
            
            <textarea
                value={config}
                onChange={handleConfigChange}
                className={`w-full h-96 p-4 font-mono text-sm bg-gray-50 border rounded-lg focus:ring-2 outline-none ${jsonError ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'}`}
                placeholder="Nhập cấu hình JSON tại đây..."
            ></textarea>
            
            {jsonError && (
                <div className="mt-2 text-red-500 text-sm font-medium animate-pulse">
                    <i className="fas fa-exclamation-circle mr-1"></i> Lỗi cú pháp JSON: {jsonError}
                </div>
            )}
            
            <div className="mt-4 flex justify-end">
                <button onClick={saveConfig} disabled={loading || !!jsonError} className={`px-6 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${loading || !!jsonError ? 'bg-gray-400 cursor-not-allowed text-gray-100' : 'bg-blue-600 hover:bg-blue-700 text-white'}`}>
                    {loading ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-save"></i>} Lưu Cấu Hình
                </button>
            </div>
        </div>
    );
};

export default GameConfigPanel;