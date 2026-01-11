import React, { useState, useEffect } from 'react';
import { Settings, Save, Zap, RefreshCw, Clock, Users, BrainCircuit, Skull, Heart, Ban, ShieldOff, Trash2, Bot, Activity, Dice1, Dice2, Dice3, Dice4, Dice5, Dice6, Eye } from 'lucide-react';
import io from 'socket.io-client';

const DiceIcon = ({ value, ...props }) => {
  switch (value) {
    case 1: return <Dice1 {...props} />;
    case 2: return <Dice2 {...props} />;
    case 3: return <Dice3 {...props} />;
    case 4: return <Dice4 {...props} />;
    case 5: return <Dice5 {...props} />;
    case 6: return <Dice6 {...props} />;
    default: return <Dice1 {...props} />;
  }
};

// Component hiển thị và điều khiển
const GameControlPanel = ({ 
    gameKey, gameName, 
    dice, status, info, 
    onDiceChange, onSetQuickResult, onToggleAi, onToggleAutoKill, 
    onSetPlayerStatus, onToggleBlacklist, onSpinTest, onSendResult 
}) => {
  if (!info) return <div className="text-white p-4">Đang tải dữ liệu...</div>;
  const sum = dice.reduce((a, b) => a + b, 0);
  const isTriple = dice[0] === dice[1] && dice[1] === dice[2];
  
  let result = (sum >= 11 ? 'TÀI' : 'XỈU');
  if (dice[0] === 1 && isTriple) result = 'XỈU (NỔ HŨ 100%)';
  else if (dice[0] === 6 && isTriple) result = 'TÀI (NỔ HŨ 100%)';
  else if (isTriple) result = 'BÃO (KHÔNG HŨ)';

  return (
      <div className="bg-slate-100000 border border-slate-1000 rounded-2xl p-2 shadow-2xl mx-auto  flex flex-col">
          <div className="flex items-center gap-3 border-b border-slate-00 pb-4 mb-6">
              <Settings className="text-sky-50 animate-spin-slow" size={32} />
              <div>
                  <h1 className="text-2xl font-black uppercase text-sky-500">{gameName}</h1>
                  <p className="text-xs text-slate-400">Can thiệp kết quả ván kế tiếp</p>
              </div>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-6 gap-y-4 flex-1 overflow-hidden">
            {/* --- CỘT TRÁI: ĐIỀU KHIỂN --- */}
            <div className="flex flex-col gap-4">
                {/* NÚT BẬT TẮT AI */}
                <div className="grid grid-cols-2 gap-3">
                    <button onClick={() => onToggleAi(gameKey, !info.isAiMode)} className={`w-full py-3 rounded-lg border-2 font-bold uppercase flex flex-col sm:flex-row items-center justify-center gap-2 transition-all shadow-md active:scale-95
                        ${info.isAiMode ? 'bg-red-600 border-red-400 text-white animate-pulse' : 'bg-slate-700 border-slate-600 text-slate-400'}`}>
                        <BrainCircuit size={20} />
                        <span className="text-[10px] sm:text-sm">{info.isAiMode ? 'AI (ON)' : 'AI (OFF)'}</span>
                    </button>
                    <button onClick={() => onToggleAutoKill(gameKey, !info.isAutoKillMode)} className={`w-full py-3 rounded-lg border-2 font-bold uppercase flex flex-col sm:flex-row items-center justify-center gap-2 transition-all shadow-md active:scale-95
                        ${info.isAutoKillMode ? 'bg-purple-600 border-purple-400 text-white animate-pulse' : 'bg-slate-700 border-slate-600 text-slate-400'}`}>
                        <Bot size={20} />
                        <span className="text-[10px] sm:text-sm">{info.isAutoKillMode ? 'KILL (ON)' : 'KILL (OFF)'}</span>
                    </button>
                </div>

                {/* ĐIỀU CHỈNH XÚC XẮC */}
                <div className="bg-slate-900/5 p-4 rounded-xl border border-slate-700 flex flex-col gap-3">
                    <div className="flex items-center gap-2 text-sm font-bold text-slate-300 uppercase border-b border-slate-700 pb-2">
                        <Dice5 size={16} className="text-sky-400" /> Điều chỉnh xúc xắc
                    </div>
                    <div className="flex justify-center gap-4">
                        {dice.map((val, i) => (
                            <button 
                            key={i}
                            onClick={() => onDiceChange(gameKey, i)}
                            className="w-50 h-50 bg-slate-100 rounded-lg flex items-center justify-center shadow-[0_4px_0_#94a3b8] active:translate-y-[4px] active:shadow-none transition-all"
                            >
                            <DiceIcon value={val} className="text-slate-900" size={36} strokeWidth={1.5} />
                            </button>
                        ))}
                    </div>

                    {/* Các nút chọn nhanh */}
                    <div className="grid grid-cols-2 gap-2 mt-2">
                        <button onClick={() => onSetQuickResult(gameKey, 'TAI')} className="p-3 bg-sky-600/20 border border-sky-500/50 rounded-md text-sky-400 font-bold hover:bg-sky-600 hover:text-white transition-all flex items-center justify-center gap-2 text-xs">
                            <Zap size={14} /> CHỌN TÀI
                        </button>
                        <button onClick={() => onSetQuickResult(gameKey, 'XIU')} className="p-3 bg-red-600/20 border border-red-500/50 rounded-md text-red-400 font-bold hover:bg-red-600 hover:text-white transition-all flex items-center justify-center gap-2 text-xs">
                            <Zap size={14} /> CHỌN XỈU
                        </button>
                        <button onClick={() => onSetQuickResult(gameKey, '111')} className="p-3 bg-amber-600/20 border border-amber-500/50 rounded-md text-amber-400 font-bold hover:bg-amber-600 hover:text-white transition-all text-xs">
                            NỔ HŨ 111
                        </button>
                        <button onClick={() => onSetQuickResult(gameKey, '666')} className="p-3 bg-amber-600/20 border border-amber-500/50 rounded-md text-amber-400 font-bold hover:bg-amber-600 hover:text-white transition-all text-xs">
                            NỔ HŨ 666
                        </button>
                    </div>
                </div>

                {/* DỰ ĐOÁN KẾT QUẢ */}
                <div className="text-center p-3 bg-slate-900/5 rounded-xl border-2 border-slate-700/50 shadow-inner flex flex-col gap-1">
                    <div className="flex items-center justify-center gap-2 text-xs font-bold text-slate-300 uppercase">
                        <Eye size={14} className="text-sky-400" /> Dự đoán kết quả
                    </div>
                    <div className={`text-xl font-black ${result.includes('TÀI') ? 'text-sky-500' : result.includes('XỈU') ? 'text-red-500' : 'text-yellow-500'} ${result.includes('NỔ HŨ') ? 'animate-pulse' : ''}`}>
                        {sum} - {result}
                    </div>
                </div>
            </div>

            {/* --- CỘT PHẢI: THÔNG TIN --- */}
            <div className="flex flex-col gap-4 h-full overflow-hidden">
                {/* THỐNG KÊ LIVE & THÔNG TIN PHIÊN */}
                <div className="bg-slate-900/5 p-4 rounded-xl border-2 border-slate-700/50 shadow-inner grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2 text-sm font-bold text-slate-300 uppercase mb-2">
                            <Activity size={16} className="text-sky-400" /> Thông tin phiên
                        </div>
                        <div className="text-xs text-slate-400 uppercase font-bold flex items-center gap-1"><Clock size={12}/> Phiên #{info.sessionId}</div>
                        <div className={`text-2xl font-black ${info.timeLeft <= 5 ? 'text-red-500 animate-pulse' : 'text-white'}`}>
                            {info.timeLeft}s
                        </div>
                        <div className="text-[10px] text-slate-500 uppercase tracking-widest">{info.phase === 'BETTING' ? 'ĐANG CƯỢC' : 'TRẢ KẾT QUẢ'}</div>
                    </div>
                    <div className="flex flex-col justify-center gap-2 text-xs sm:border-l sm:border-slate-700 sm:pl-4">
                         <div className="flex items-center gap-2 text-sm font-bold text-slate-300 uppercase mb-2">
                            <Users size={16} className="text-sky-400" /> Cược Live
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-sky-500 font-bold">TÀI:</span>
                            <span className="text-white font-mono">{(info.bets.tai || 0).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-red-500 font-bold">XỈU:</span>
                            <span className="text-white font-mono">{(info.bets.xiu || 0).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-yellow-500 font-bold">BÃO:</span>
                            <span className="text-white font-mono">{(info.bets.bao || 0).toLocaleString()}</span>
                        </div>
                    </div>
                </div>

                {/* DANH SÁCH CƯỢC CHI TIẾT */}
                <div className="bg-slate-900/5 rounded-xl border border-slate-700 overflow-hidden flex-1 flex flex-col">
                    <div className="p-3 bg-slate-8 border-b border-slate-700 flex items-center gap-2 text-xs font-bold text-slate-300 uppercase bg-gradient-to-r from-slate-800 to-slate-900">
                        <Users size={14} /> Danh sách cược ({info.detailedBets?.length || 0})
                    </div>
                    <div className="flex-1 overflow-y-auto custom-scrollbar">
                        <table className="w-full text-left text-[10px] uppercase">
                            <thead className="text-slate-500 bg-slate-800/50 sticky top-0">
                                <tr><th className="p-2">Người chơi</th><th className="p-2">Cửa</th><th className="p-2 text-right">Tiền</th><th className="p-2 text-center">Thao tác</th></tr>
                            </thead>
                            <tbody className="divide-y divide-slate-700/50">
                                {info.detailedBets && info.detailedBets.map((bet, idx) => {
                                    const pStatus = info.playerControl ? info.playerControl[bet.id] : null;
                                    const isIpBanned = info.blacklist && info.blacklist.includes(bet.ip);
                                    return (
                                        <tr key={idx} className={`hover:bg-white/5 transition-colors ${pStatus === 'kill' ? 'bg-red-900/20' : pStatus === 'nurture' ? 'bg-green-900/20' : ''}`}>
                                            <td className="p-2 font-bold text-slate-300">
                                                <div className="flex items-center gap-1">
                                                    {bet.id}
                                                    {pStatus === 'kill' && <Skull size={10} className="text-red-500" />}
                                                    {pStatus === 'nurture' && <Heart size={10} className="text-green-500" />}
                                                </div>
                                            </td>
                                            <td className={`p-2 font-bold ${bet.type === 'tai' ? 'text-sky-500' : bet.type === 'xiu' ? 'text-red-500' : 'text-yellow-500'}`}>{bet.type}</td>
                                            <td className="p-2 text-right font-mono text-slate-300">{bet.amount.toLocaleString()}</td>
                                            <td className="p-2">
                                                <div className="grid grid-cols-2 gap-1 w-fit mx-auto">
                                                    <button onClick={() => onSetPlayerStatus(gameKey, bet.id, 'kill')} className={`p-1.5 rounded hover:scale-105 transition-transform flex justify-center items-center ${pStatus === 'kill' ? 'bg-red-600 text-white' : 'bg-slate-700 text-slate-400 hover:bg-red-600 hover:text-white'}`} title="Giết"><Skull size={12}/></button>
                                                    <button onClick={() => onSetPlayerStatus(gameKey, bet.id, 'nurture')} className={`p-1.5 rounded hover:scale-105 transition-transform flex justify-center items-center ${pStatus === 'nurture' ? 'bg-green-600 text-white' : 'bg-slate-700 text-slate-400 hover:bg-green-600 hover:text-white'}`} title="Nuôi"><Heart size={12}/></button>
                                                    <button onClick={() => onSetPlayerStatus(gameKey, bet.id, null)} className="p-1.5 rounded bg-slate-700 text-slate-400 hover:bg-slate-600 hover:text-white hover:scale-105 transition-transform flex justify-center items-center" title="Hủy"><Ban size={12}/></button>
                                                    <button onClick={() => onToggleBlacklist(gameKey, bet.ip)} className={`p-1.5 rounded hover:scale-105 transition-transform flex justify-center items-center ${isIpBanned ? 'bg-red-500 text-white' : 'bg-slate-700 text-slate-400 hover:bg-red-500 hover:text-white'}`} title={isIpBanned ? "Bỏ chặn IP" : "Chặn IP"}>
                                                        <ShieldOff size={12}/>
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                                {(!info.detailedBets || info.detailedBets.length === 0) && <tr><td colSpan="4" className="p-4 text-center text-slate-600 italic">Chưa có người cược</td></tr>}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* DANH SÁCH BLACKLIST */}
                {info.blacklist && info.blacklist.length > 0 && (
                    <div className="bg-red-900/20 rounded-xl border border-red-900/50 p-3">
                        <h3 className="text-xs font-bold text-red-400 uppercase mb-2 flex items-center gap-2"><ShieldOff size={14}/> Danh sách đen ({info.blacklist.length})</h3>
                        <div className="flex flex-wrap gap-2">
                            {info.blacklist.map((ip, i) => (
                                <div key={i} className="bg-red-950 border border-red-800 text-red-200 text-[10px] px-2 py-1 rounded flex items-center gap-2">
                                    {ip}
                                    <button onClick={() => onToggleBlacklist(gameKey, ip)} className="hover:text-white">
                                        <Trash2 size={10} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
          </div>

          <button 
              onClick={() => onSendResult(gameKey)}
              className="w-full mt-6 py-4 bg-sky-600 hover:bg-sky-500 text-white font-bold uppercase rounded-lg shadow-lg flex items-center justify-center gap-2 transition-all active:scale-95"
          >
              <Save size={18} /> Xác Nhận Kết Quả
          </button>

          {status && (
              <div className="mt-3 text-center text-sm font-bold animate-pulse text-emerald-400">
                  {status}
              </div>
          )}
          </div>
  );
};

const TaiXiuCao = () => {
    const gameKey = 'taixiucao';
    const [gameState, setGameState] = useState({
        dice: [1, 1, 1],
        status: '',
        info: { timeLeft: 0, phase: '', sessionId: 0, bets: { tai: 0, xiu: 0, bao: 0 }, detailedBets: [], isAiMode: false, playerControl: {}, blacklist: [], isAutoKillMode: false }
    });

    useEffect(() => {
        const socket = io("http://localhost:4001");
        socket.on('connect', () => console.log('✅ Connected to Game Admin Server (TX Cao)'));
        socket.on('stats-update', (data) => {
            if (data.game === gameKey && data.stats) {
                setGameState(prev => ({ ...prev, info: data.stats }));
            }
        });
        return () => socket.disconnect();
    }, []);

    // Helper gọi API
    const callApi = async (endpoint, body) => {
        try {
            const res = await fetch(`http://localhost:4001/api/admin/${endpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ game: gameKey, ...body })
            });
            return await res.json();
        } catch (e) {
            console.error(`API Error (${endpoint}):`, e);
            return { success: false, message: e.message };
        }
    };

    const changeDice = (key, index) => {
        setGameState(prev => {
            const newDice = [...prev.dice];
            newDice[index] = newDice[index] >= 6 ? 1 : newDice[index] + 1;
            return { ...prev, dice: newDice };
        });
    };

    const setQuickResult = (key, type) => {
        let newDice;
        if (type === '111') newDice = [1, 1, 1];
        else if (type === '666') newDice = [6, 6, 6];
        else if (type === 'TAI') {
            do { newDice = [Math.floor(Math.random()*6)+1, Math.floor(Math.random()*6)+1, Math.floor(Math.random()*6)+1]; } 
            while (newDice.reduce((a,b)=>a+b,0) < 11 || newDice.reduce((a,b)=>a+b,0) > 17 || (newDice[0]===newDice[1] && newDice[0]===newDice[2]));
        } else if (type === 'XIU') {
            do { newDice = [Math.floor(Math.random()*6)+1, Math.floor(Math.random()*6)+1, Math.floor(Math.random()*6)+1]; } 
            while (newDice.reduce((a,b)=>a+b,0) < 4 || newDice.reduce((a,b)=>a+b,0) > 10 || (newDice[0]===newDice[1] && newDice[0]===newDice[2]));
        }
        setGameState(prev => ({ ...prev, dice: newDice }));
    };

    const toggleAi = async (k, v) => {
        setGameState(prev => ({...prev, info: {...prev.info, isAiMode: v}}));
        await callApi('toggle-ai', { enable: v });
    };

    const toggleAutoKill = async (k, v) => {
        setGameState(prev => ({...prev, info: {...prev.info, isAutoKillMode: v}}));
        await callApi('toggle-auto-kill', { enable: v });
    };

    const setPlayerStatus = async (k, pid, s) => {
        setGameState(prev => ({...prev, info: {...prev.info, playerControl: {...prev.info.playerControl, [pid]: s}}}));
        await callApi('player-control', { userId: pid, status: s });
    };

    const toggleBlacklist = async (key, target) => {
        const isBanned = gameState.info.blacklist.includes(target);
        const newBlacklist = isBanned ? gameState.info.blacklist.filter(ip => ip !== target) : [...gameState.info.blacklist, target];
        setGameState(prev => ({...prev, info: {...prev.info, blacklist: newBlacklist}}));
        await callApi('blacklist', { target, action: isBanned ? 'remove' : 'add' });
    };

    const spinTest = () => setGameState(prev => ({ ...prev, dice: [Math.floor(Math.random()*6)+1, Math.floor(Math.random()*6)+1, Math.floor(Math.random()*6)+1] }));
    
    const sendResult = async () => {
        setGameState(prev => ({ ...prev, status: 'Đang gửi...' }));
        const res = await callApi('set-result', { dice: gameState.dice });
        setGameState(prev => ({ ...prev, status: res.success ? '✅ Đã cài đặt thành công!' : '❌ Lỗi: ' + res.message }));
        if(res.success) setTimeout(() => setGameState(prev => ({ ...prev, status: '' })), 3000);
    };

    return (
        <div className="w-full bg-slate-900 text-white p-4 sm:p-8 font-mono">
            <style>{`
                @keyframes spin-slow { from { transform: rotate(0deg); } to { transform: rotate(360deg); } } 
                .animate-spin-slow { animation: spin-slow 3s linear infinite; }
                .custom-scrollbar::-webkit-scrollbar { width: 5px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #334155; border-radius: 20px; }
            `}</style>
            <GameControlPanel
                gameKey={gameKey}
                gameName="Tài Xỉu Cào"
                dice={gameState.dice}
                status={gameState.status}
                info={gameState.info}
                onDiceChange={changeDice}
                onSetQuickResult={setQuickResult}
                onToggleAi={toggleAi}
                onToggleAutoKill={toggleAutoKill}
                onSetPlayerStatus={setPlayerStatus}
                onToggleBlacklist={toggleBlacklist}
                onSpinTest={spinTest}
                onSendResult={sendResult}
            />
        </div>
    );
};

export default TaiXiuCao;