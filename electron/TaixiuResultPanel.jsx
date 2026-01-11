import React, { useState } from 'react';

const TaixiuResultPanel = ({ roomType, title }) => {
    const [dices, setDices] = useState({ d1: 1, d2: 1, d3: 1 });
    const [loading, setLoading] = useState(false);

    const getIpcRenderer = () => {
        if (window.ipcRenderer) return window.ipcRenderer;
        if (window.require) {
            try { return window.require('electron').ipcRenderer; } catch (e) {}
        }
        return null;
    };

    const handleSetResult = async () => {
        const ipc = getIpcRenderer();
        if (!ipc) return;
        setLoading(true);
        try {
            const res = await ipc.invoke('set-tx-result', { 
                roomType, 
                dice1: parseInt(dices.d1), 
                dice2: parseInt(dices.d2), 
                dice3: parseInt(dices.d3) 
            });
            if (res.success) {
                alert(`✅ Đã đặt kết quả cho phiên tiếp theo: ${dices.d1} - ${dices.d2} - ${dices.d3}`);
            } else {
                alert('❌ Lỗi: ' + res.message);
            }
        } catch (e) {
            alert('❌ Lỗi hệ thống: ' + e.message);
        } finally {
            setLoading(false);
        }
    };

    const DiceSelect = ({ label, value, onChange }) => (
        <div className="flex flex-col items-center">
            <label className="mb-2 font-medium text-gray-600">{label}</label>
            <select 
                value={value} 
                onChange={(e) => onChange(e.target.value)}
                className="w-16 h-16 text-center text-xl font-bold border-2 border-gray-300 rounded-xl focus:border-blue-500 outline-none bg-white shadow-sm appearance-none cursor-pointer"
            >
                {[1, 2, 3, 4, 5, 6].map(v => <option key={v} value={v}>{v}</option>)}
            </select>
        </div>
    );

    const total = parseInt(dices.d1) + parseInt(dices.d2) + parseInt(dices.d3);
    const resultText = total > 10 ? 'TÀI' : 'XỈU';
    const resultColor = total > 10 ? 'text-red-600' : 'text-gray-800';

    return (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <h3 className="text-lg font-bold text-gray-800 uppercase mb-6 flex items-center gap-2">
                <i className="fas fa-dice text-purple-500"></i> Đặt Kết Quả: {title}
            </h3>

            <div className="flex justify-center gap-8 mb-8">
                <DiceSelect label="Xúc xắc 1" value={dices.d1} onChange={v => setDices({...dices, d1: v})} />
                <DiceSelect label="Xúc xắc 2" value={dices.d2} onChange={v => setDices({...dices, d2: v})} />
                <DiceSelect label="Xúc xắc 3" value={dices.d3} onChange={v => setDices({...dices, d3: v})} />
            </div>

            <div className="text-center mb-6">
                <div className="text-sm text-gray-500 uppercase tracking-wider font-semibold">Tổng điểm dự kiến</div>
                <div className={`text-3xl font-black ${resultColor} mt-1`}>
                    {total} - {resultText}
                </div>
            </div>

            <button 
                onClick={handleSetResult} 
                disabled={loading}
                className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white py-3 rounded-xl font-bold text-lg shadow-lg transform transition hover:-translate-y-0.5 active:translate-y-0"
            >
                {loading ? 'Đang xử lý...' : 'XÁC NHẬN KẾT QUẢ'}
            </button>
        </div>
    );
};

export default TaixiuResultPanel;