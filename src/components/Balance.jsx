import React, { useState, useEffect } from 'react';
import { 
  Wallet, 
  History, 
  ArrowUpCircle, 
  ArrowDownCircle, 
  Settings, 
  Activity, 
  ShieldCheck,
  Zap
} from 'lucide-react';

function App() {
  const [userId, setUserId] = useState('');
  const [amount, setAmount] = useState('');
  const [action, setAction] = useState('add');
  const [message, setMessage] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);
  const [logs, setLogs] = useState([]);

  const fetchLogs = async () => {
    if (window.require) {
      const { ipcRenderer } = window.require('electron');
      const result = await ipcRenderer.invoke('get-balance-logs');
      if (result.success) {
        setLogs(result.data);
      }
    }
  };

  useEffect(() => { fetchLogs(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!userId || !amount) {
      setMessage('Vui lòng nhập đầy đủ User ID và Số tiền');
      setIsSuccess(false);
      return;
    }

    if (window.require) {
      try {
        const { ipcRenderer } = window.require('electron');
        const result = await ipcRenderer.invoke('update-balance', {
          userId,
          amount,
          action
        });

        if (result.success) {
          setMessage(`Thành công! Số dư mới: ${result.newBalance.toLocaleString()}`);
          setIsSuccess(true);
          setAmount('');
          fetchLogs();
        } else {
          setMessage(`Lỗi: ${result.message}`);
          setIsSuccess(false);
        }
      } catch (error) {
        setMessage('Lỗi kết nối hệ thống');
        setIsSuccess(false);
      }
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 p-4 md:p-6 lg:p-8 antialiased font-sans flex flex-col overflow-x-hidden">
      <style>{`
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-spin-slow {
          animation: spin-slow 8s linear infinite;
        }
        .custom-input {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          color: #1e293b;
          transition: all 0.2s;
        }
        .custom-input:focus {
          border-color: #000000;
          box-shadow: 0 0 0 2px rgba(0, 0, 0, 0.05);
          outline: none;
        }
        .btn-black {
          background: #000000;
          color: #ffffff;
          transition: all 0.2s;
          border: none;
        }
        .btn-black:hover {
          background: #262626;
          transform: translateY(-1px);
        }
        .btn-black:active {
          transform: translateY(1px);
        }
        .white-glass-card {
          background: rgba(255, 255, 255, 0.7);
          backdrop-filter: blur(10px);
          border: 1px solid rgba(0, 0, 0, 0.05);
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03);
        }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
        
        select option {
          background-color: #ffffff;
          color: #000000;
        }
      `}</style>

      {/* HEADER - Black and White style */}
      <header className="mb-6 lg:mb-10 flex flex-col md:flex-row items-center justify-between bg-white p-5 lg:p-7 rounded-2xl md:rounded-[2rem] border border-slate-200 shadow-sm gap-4">
        <div className="flex items-center gap-4 lg:gap-5 w-full md:w-auto">

          <div>
            <h1 className="text-xl lg:text-3xl font-black italic tracking-tighter text-black uppercase flex items-center gap-2">
              QUẢN LÝ VÍ
              <Zap size={18} className="text-yellow-500 animate-pulse fill-yellow-500" />
            </h1>
          </div>
        </div>


      </header>

      {/* MAIN CONTENT */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 lg:gap-8 flex-grow">
        
        {/* FORM SECTION - White Minimal */}
        <div className="xl:col-span-4 lg:sticky lg:top-8 self-start">
          <div className="white-glass-card p-6 lg:p-8 rounded-[1.5rem] lg:rounded-[2.5rem] relative overflow-hidden">

            
            <form onSubmit={handleSubmit} className="space-y-5 lg:space-y-6 relative z-10">
              <div className="space-y-2">
                <label className="text-[9px] lg:text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                   MÃ NGƯỜI DÙNG (USER ID)
                </label>
                <input
                  type="number"
                  className="custom-input w-full p-3 lg:p-4 rounded-xl lg:rounded-2xl font-mono text-base lg:text-lg"
                  value={userId}
                  onChange={(e) => setUserId(e.target.value)}
                  placeholder="ID..."
                />
              </div>

              <div className="space-y-2">
                <label className="text-[9px] lg:text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">SỐ TIỀN GIAO DỊCH</label>
                <div className="relative">
                  <input
                    type="number"
                    className="custom-input w-full p-3 lg:p-4 rounded-xl lg:rounded-2xl font-mono text-base lg:text-lg text-black font-bold pr-12"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[9px] lg:text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">PHƯƠNG THỨC</label>
                <div className="grid grid-cols-2 gap-2 lg:gap-3">
                  <button 
                    type="button"
                    onClick={() => setAction('add')}
                    className={`p-3 rounded-lg lg:rounded-xl border flex items-center justify-center gap-1.5 font-black text-[10px] lg:text-[10px] transition-all ${
                      action === 'add' ? 'bg-black text-white border-black shadow-md' : 'bg-white border-slate-200 text-slate-400'
                    }`}
                  >
                    <ArrowUpCircle size={12} /> CỘNG TIỀN
                  </button>
                  <button 
                    type="button"
                    onClick={() => setAction('subtract')}
                    className={`p-3 rounded-lg lg:rounded-xl border flex items-center justify-center gap-1.5 font-black text-[10px] lg:text-[10px] transition-all ${
                      action === 'subtract' ? 'bg-black text-red border-black shadow-md' : 'bg-white border-slate-200 text-slate-400'
                    }`}
                  >
                    <ArrowDownCircle size={12} /> TRỪ TIỀN
                  </button>
                </div>
              </div>
              
              {message && (
                <div className={`p-4 rounded-xl lg:rounded-2xl text-[10px] lg:text-xs font-bold border animate-in fade-in slide-in-from-top-2 duration-300 ${
                  isSuccess 
                  ? 'bg-emerald-50 text-emerald-600 border-emerald-100' 
                  : 'bg-red-50 text-red-600 border-red-100'
                }`}>
                  {message}
                </div>
              )}

              <button type="submit" className="btn-black w-full py-4 lg:py-5 rounded-xl lg:rounded-2xl font-black uppercase tracking-widest mt-2 flex items-center justify-center gap-3 text-sm shadow-xl shadow-black/10">
                <Zap size={18} /> THỰC THI LỆNH
              </button>
            </form>
          </div>
        </div>

        {/* LOGS SECTION - High Contrast */}
        <div className="xl:col-span-8 white-glass-card rounded-[1.5rem] lg:rounded-[2.5rem] overflow-hidden flex flex-col min-h-[500px] xl:max-h-[calc(100vh-12rem)]">
          <div className="p-4 lg:p-6 border-b border-slate-100 bg-white/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <h3 className="text-[12px] lg:text-sm font-black uppercase tracking-widest flex items-center gap-3 text-black">
              <History size={18} className="text-black" />
              NHẬT KÝ GIAO DỊCH
            </h3>
            <div className="flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-full border border-slate-200">
               <span className="w-1.5 h-1.5 rounded-full bg-black animate-pulse"></span>
               <span className="text-[9px] lg:text-[10px] text-slate-500 font-black tracking-tighter uppercase">Real-time Feed</span>
            </div>
          </div>

          <div className="overflow-auto flex-1 custom-scrollbar">
            <table className="w-full text-left border-collapse min-w-[700px]">
              <thead className="sticky top-0 bg-[#f1f5f9] z-10">
                <tr className="border-b border-slate-200 text-[8px] lg:text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">
                  <th className="px-6 py-4 lg:px-8 lg:py-5">Thời gian</th>
                  <th className="px-6 py-4 lg:px-6 lg:py-5">User</th>
                  <th className="px-6 py-4 lg:px-6 lg:py-5 text-center">Hành động</th>
                  <th className="px-6 py-4 lg:px-6 lg:py-5 text-right">Biến động</th>
                  <th className="px-6 py-4 lg:px-8 lg:py-5 text-right">Số dư hiện tại</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {logs.length > 0 ? logs.map(log => (
                  <tr key={log.id} className="hover:bg-slate-50 transition-colors group">
                    <td className="px-6 py-4 lg:px-8 lg:py-5 text-[10px] lg:text-[11px] font-mono text-slate-400">
                      {new Date(log.date).toLocaleString('vi-VN')}
                    </td>
                    <td className="px-6 py-4 lg:px-6 lg:py-5">
                      <div className="flex items-center gap-2">
                        <span className="text-xs lg:text-sm font-bold text-black tracking-tight">#{log.userId}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 lg:px-6 lg:py-5 text-center">
                      <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-[8px] lg:text-[9px] font-black uppercase border ${
                        log.action === 'add' 
                        ? 'bg-emerald-50 text-emerald-600 border-emerald-100' 
                        : 'bg-red-50 text-red-600 border-red-100'
                      }`}>
                        {log.action === 'add' ? 'Nạp tiền' : 'Trừ tiền'}
                      </div>
                    </td>
                    <td className={`px-6 py-4 lg:px-6 lg:py-5 text-right font-mono font-black text-xs lg:text-sm ${log.action === 'add' ? 'text-emerald-600' : 'text-red-600'}`}>
                      {log.action === 'add' ? '+' : '-'}{log.amount.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 lg:px-8 lg:py-5 text-right">
                      <div className="text-[9px] lg:text-[10px] text-slate-300 font-mono line-through">{log.oldBalance.toLocaleString()}</div>
                      <div className="text-xs lg:text-sm font-mono font-black text-black">{log.newBalance.toLocaleString()}</div>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan="5" className="px-6 py-24 text-center text-slate-300 font-black uppercase tracking-[0.3em] italic text-[10px]">
                      Hệ thống trống
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;