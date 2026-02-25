import React, { useState, useEffect, useRef } from 'react';
import { 
  Wallet, 
  History, 
  LayoutDashboard, 
  TrendingUp, 
  CircleDot,
  MousePointer2,
  Zap,
  Trash2,
  CheckCircle2,
  Sparkles,
  BarChart3,
  ChevronDown,
  ChevronUp,
  Info
} from 'lucide-react';

// --- CONFIGURATION ---
const CHIPS = [
  { value: 10000, label: '10K', color: 'from-blue-600 to-blue-400 shadow-blue-500/50' },
  { value: 50000, label: '50K', color: 'from-emerald-600 to-emerald-400 shadow-emerald-500/50' },
  { value: 100000, label: '100K', color: 'from-rose-600 to-rose-400 shadow-rose-500/50' },
  { value: 500000, label: '500K', color: 'from-purple-600 to-purple-400 shadow-purple-500/50' },
  { value: 1000000, label: '1M', color: 'from-amber-600 to-amber-400 shadow-amber-500/50' },
];

const BET_OPTIONS = {
  numbers: { 
    items: ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'],
    rate: 9,
  },
  size: {
    items: [
      { id: 'small', label: 'XỈU', rate: 1.95, color: 'from-cyan-500/20 to-blue-500/20 border-blue-500/50' },
      { id: 'large', label: 'TÀI', rate: 1.95, color: 'from-orange-500/20 to-red-500/20 border-red-500/50' },
      { id: 'draw', label: 'HÒA', rate: 5, color: 'from-purple-500/20 to-indigo-500/20 border-purple-500/50' }
    ],
  },
  color: {
    items: [
      { id: 'green', label: 'XANH', color: 'bg-emerald-500', rate: 1.95 },
      { id: 'purple', label: 'TÍM', color: 'bg-purple-500', rate: 5 },
      { id: 'red', label: 'ĐỎ', color: 'bg-rose-500', rate: 1.95 }
    ],
  }
};

const formatVND = (amount: number) => {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
};

const shortMoney = (amount: number) => {
  if (Math.abs(amount) >= 1000000) return (amount / 1000000).toFixed(1) + 'M';
  if (Math.abs(amount) >= 1000) return (amount / 1000) + 'K';
  return amount.toString();
};

export default function App() {
  const [balance, setBalance] = useState(10000000);
  const [activeTab, setActiveTab] = useState<'play' | 'history'>('play');
  const [timeLeft, setTimeLeft] = useState(30);
  const [drawCounter, setDrawCounter] = useState(1001); 
  
  const [pendingBets, setPendingBets] = useState<Map<string, {cat: string, label: string, amount: number, rate: number}>>(new Map());
  const [currentChip, setCurrentChip] = useState<number>(100000);
  
  const [lastResult, setLastResult] = useState<{ numbers: number[], sum: number, lastDigit: number, roundId: number }>({
    numbers: [0, 0, 0, 0, 0, 0],
    sum: 0,
    lastDigit: 0,
    roundId: 1000
  });
  const [rollingNumbers, setRollingNumbers] = useState<number[]>([0, 0, 0, 0, 0, 0]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [drawHistory, setDrawHistory] = useState<any[]>([]); 
  const [expandedRound, setExpandedRound] = useState<number | null>(null);

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          handleDraw();
          return 30;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [history]);

  useEffect(() => {
    let interval: any;
    if (isDrawing) {
      interval = setInterval(() => {
        setRollingNumbers(Array.from({ length: 6 }, () => Math.floor(Math.random() * 10)));
      }, 80);
    } else {
      setRollingNumbers(lastResult.numbers);
    }
    return () => clearInterval(interval);
  }, [isDrawing, lastResult]);

  const handleDraw = () => {
    setIsDrawing(true);
    setTimeout(() => {
      const luckyNumbers = Array.from({ length: 6 }, () => Math.floor(Math.random() * 10));
      const sum = luckyNumbers.reduce((a, b) => a + b, 0);
      const lastDigit = sum % 10;
      const resultObj = { numbers: luckyNumbers, sum, lastDigit, time: new Date().toLocaleTimeString(), roundId: drawCounter };
      
      setLastResult(resultObj);
      setDrawHistory(prev => [resultObj, ...prev].slice(0, 50)); 
      processWinners(resultObj);
      setDrawCounter(prev => prev + 1);
      setIsDrawing(false);
    }, 3000);
  };

  const processWinners = (result: { lastDigit: number, roundId: number }) => {
    setHistory(current => current.map(bet => {
      if (bet.status !== 'pending') return bet;
      let isWin = false;
      const val = result.lastDigit;

      if (bet.category === 'numbers') isWin = parseInt(bet.valueId) === val;
      else if (bet.category === 'size') {
        if (bet.valueId === 'small') isWin = val >= 0 && val <= 4;
        else if (bet.valueId === 'large') isWin = val >= 6 && val <= 9;
        else if (bet.valueId === 'draw') isWin = val === 5;
      } else if (bet.category === 'color') {
        if (bet.valueId === 'green') isWin = val >= 0 && val <= 4;
        else if (bet.valueId === 'purple') isWin = val === 5;
        else if (bet.valueId === 'red') isWin = val >= 6 && val <= 9;
      }

      if (isWin) {
        const winAmount = Math.floor(bet.amount * bet.rate);
        setBalance(b => b + winAmount);
        return { ...bet, status: 'won', winAmount, result: val };
      }
      return { ...bet, status: 'lost', result: val };
    }));
  };

  const toggleBet = (cat: string, id: string, label: string, rate: number) => {
    if (isDrawing) return;
    const newBets = new Map(pendingBets);
    if (newBets.has(id)) {
      const current = newBets.get(id)!;
      newBets.set(id, { ...current, amount: current.amount + currentChip });
    } else {
      newBets.set(id, { cat, label, amount: currentChip, rate });
    }
    setPendingBets(newBets);
  };

  const confirmAllBets = () => {
    const totalAmount = Array.from(pendingBets.values()).reduce((sum, b) => sum + b.amount, 0);
    if (totalAmount === 0 || totalAmount > balance) return;

    const newBetsList = Array.from(pendingBets.entries()).map(([id, data]) => ({
      id: `${Date.now()}-${Math.random()}`,
      roundId: drawCounter,
      category: data.cat,
      valueId: id,
      label: data.label,
      amount: data.amount,
      rate: data.rate,
      status: 'pending',
      time: new Date().toLocaleTimeString().split(' ')[0]
    }));

    setBalance(prev => prev - totalAmount);
    setHistory(prev => [...newBetsList, ...prev]);
    setPendingBets(new Map());
  };

  const clearPending = () => setPendingBets(new Map());
  const totalPendingAmount = Array.from(pendingBets.values()).reduce((sum, b) => sum + b.amount, 0);

  const getBadgeStyle = (digit: number) => {
    if (digit === 5) return "bg-purple-500 shadow-purple-500/50";
    if (digit <= 4) return "bg-emerald-500 shadow-emerald-500/50";
    return "bg-rose-500 shadow-rose-500/50";
  };

  // Group history by RoundId
  const groupedHistory = history.reduce((groups, bet) => {
    const roundId = bet.roundId;
    if (!groups[roundId]) {
      groups[roundId] = {
        roundId,
        bets: [],
        totalBet: 0,
        totalWin: 0,
        status: 'pending',
        result: null
      };
    }
    groups[roundId].bets.push(bet);
    groups[roundId].totalBet += bet.amount;
    if (bet.status === 'won') groups[roundId].totalWin += bet.winAmount;
    if (bet.status !== 'pending') {
        groups[roundId].status = 'completed';
        groups[roundId].result = bet.result;
    }
    return groups;
  }, {} as Record<number, any>);

  const sortedRounds = Object.values(groupedHistory).sort((a: any, b: any) => b.roundId - a.roundId);

  const stats = {
    total: drawHistory.length,
    small: drawHistory.filter(d => d.lastDigit >= 0 && d.lastDigit <= 4).length,
    large: drawHistory.filter(d => d.lastDigit >= 6 && d.lastDigit <= 9).length,
    draw: drawHistory.filter(d => d.lastDigit === 5).length,
  };

  return (
    <div className="min-h-screen bg-[#0a0a0c] text-slate-100 font-sans max-w-md mx-auto flex flex-col shadow-2xl relative overflow-hidden">
      
      {/* Background Decor */}
      <div className="absolute top-[-10%] left-[-20%] w-[80%] h-[40%] bg-indigo-600/10 blur-[120px] rounded-full pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-20%] w-[80%] h-[40%] bg-purple-600/10 blur-[120px] rounded-full pointer-events-none"></div>

      {/* Header Profile */}
      <div className="p-4 bg-zinc-900/40 backdrop-blur-xl sticky top-0 z-50 border-b border-white/5 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-500 to-fuchsia-500 p-[2px]">
            <div className="w-full h-full bg-[#0a0a0c] rounded-[14px] flex items-center justify-center font-black text-indigo-400">D</div>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Người chơi</span>
            <span className="text-xs font-black text-white italic">ID:1234</span>
          </div>
        </div>
        <div className="bg-zinc-800/50 px-4 py-2.5 rounded-2xl border border-white/10 flex items-center gap-2 shadow-inner group transition-all hover:border-yellow-500/50">
          <Wallet size={14} className="text-yellow-500 group-hover:scale-110 transition-transform" />
          <span className="text-sm font-black text-yellow-500 tabular-nums">{formatVND(balance)}</span>
        </div>
      </div>

      <main className="flex-1 overflow-y-auto px-4 py-6 pb-64 scrollbar-hide space-y-6 z-10">
        
        {/* Draw Board */}
        <div className="relative group">
          <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 to-purple-600 blur-2xl opacity-10 group-hover:opacity-20 transition-opacity"></div>
          <div className="relative bg-zinc-900/60 backdrop-blur-md rounded-[2.5rem] p-6 border border-white/10 shadow-2xl overflow-hidden">
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-2 bg-black/40 px-3 py-1 rounded-full border border-white/5">
                <div className={`w-2 h-2 rounded-full ${isDrawing ? 'bg-yellow-500 animate-ping' : 'bg-rose-500 shadow-[0_0_8px_red]'}`}></div>
                <span className="text-[10px] font-black uppercase text-zinc-400 tracking-widest">
                  {isDrawing ? 'Đang quay số...' : `Phiên mới: 00:${timeLeft.toString().padStart(2, '0')}`}
                </span>
              </div>
              <Sparkles size={16} className="text-indigo-400 animate-pulse" />
            </div>

            <div className="flex flex-col items-center gap-6">
              <div className="flex justify-between w-full gap-1.5">
                {rollingNumbers.map((n, i) => (
                  <div key={i} className={`flex-1 aspect-[3/4] bg-zinc-800/80 rounded-2xl flex items-center justify-center font-black text-2xl border border-white/10 shadow-lg transition-transform ${isDrawing ? 'animate-[bounce_0.2s_infinite]' : ''}`}>
                    <span className={isDrawing ? 'opacity-40 scale-110' : 'text-white'}>{n}</span>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-center gap-8 bg-gradient-to-b from-black/60 to-black/20 w-full py-4 rounded-[2rem] border border-white/5 shadow-inner">
                <div className="text-center">
                  <p className="text-[9px] font-black text-zinc-500 uppercase mb-1 tracking-tighter italic">Tổng điểm</p>
                  <p className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-t from-zinc-400 to-white">{isDrawing ? '??' : lastResult.sum}</p>
                </div>
                <div className="w-[1px] h-12 bg-gradient-to-b from-transparent via-zinc-700 to-transparent"></div>
                <div className="text-center">
                  <p className="text-[9px] font-black text-zinc-500 uppercase mb-1 tracking-tighter italic">Số cuối</p>
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-3xl font-black shadow-2xl transition-all duration-700 ${isDrawing ? 'bg-zinc-800 scale-90 rotate-12' : `${getBadgeStyle(lastResult.lastDigit)} scale-100 rotate-0`}`}>
                    {isDrawing ? '?' : lastResult.lastDigit}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {activeTab === 'play' ? (
          <div className="space-y-8 pb-10">
            {/* TÀI XỈU */}
            <section>
              <div className="flex items-center gap-2 mb-4 px-2">
                <LayoutDashboard size={14} className="text-indigo-400" />
                <h3 className="text-[11px] font-black text-zinc-400 uppercase tracking-[0.2em]">Tài - Xỉu - Hòa</h3>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {BET_OPTIONS.size.items.map(item => (
                  <button
                    key={item.id}
                    onClick={() => toggleBet('size', item.id, item.label, item.rate)}
                    disabled={isDrawing}
                    className={`h-20 rounded-[2rem] border-2 transition-all flex flex-col items-center justify-center relative overflow-hidden bg-gradient-to-br ${item.color} ${pendingBets.has(item.id) ? 'border-white scale-95 shadow-xl shadow-white/10' : 'border-white/5 opacity-80 hover:opacity-100 hover:scale-[1.02]'}`}
                  >
                    {pendingBets.has(item.id) && (
                       <div className="absolute top-0 right-0 bg-white text-black text-[9px] px-2 py-0.5 rounded-bl-xl font-black animate-pulse">
                         {pendingBets.get(item.id)!.amount / 1000}K
                       </div>
                    )}
                    <span className="text-[13px] font-black tracking-widest">{item.label}</span>
                    <span className="text-[10px] font-black text-yellow-400 mt-0.5 italic">x{item.rate}</span>
                  </button>
                ))}
              </div>
            </section>

            {/* COLOR */}
            <section>
              <div className="flex items-center gap-2 mb-4 px-2">
                <CircleDot size={14} className="text-rose-400" />
                <h3 className="text-[11px] font-black text-zinc-400 uppercase tracking-[0.2em]">Màu chiến thắng</h3>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {BET_OPTIONS.color.items.map(item => (
                  <button
                    key={item.id}
                    onClick={() => toggleBet('color', item.id, item.label, item.rate)}
                    disabled={isDrawing}
                    className={`h-16 rounded-2xl border-2 transition-all flex flex-col items-center justify-center relative ${pendingBets.has(item.id) ? 'bg-white text-black border-white scale-95' : 'bg-zinc-900/40 border-white/5'}`}
                  >
                    <div className={`w-3 h-3 rounded-full mb-1 ${item.color} shadow-[0_0_10px_currentColor]`}></div>
                    <span className="text-[10px] font-black tracking-widest uppercase">{item.label}</span>
                  </button>
                ))}
              </div>
            </section>

            {/* NUMBERS */}
            <section>
              <div className="flex items-center gap-2 mb-4 px-2">
                <Zap size={14} className="text-yellow-400" />
                <h3 className="text-[11px] font-black text-zinc-400 uppercase tracking-[0.2em]">Số cuối chính xác</h3>
              </div>
              <div className="grid grid-cols-5 gap-2.5">
                {BET_OPTIONS.numbers.items.map(num => (
                  <button
                    key={num}
                    onClick={() => toggleBet('numbers', num, num, 9)}
                    disabled={isDrawing}
                    className={`aspect-square rounded-2xl border-2 transition-all flex flex-col items-center justify-center relative group ${pendingBets.has(num) ? 'bg-indigo-600 border-indigo-400 scale-90 shadow-lg shadow-indigo-600/40' : 'bg-zinc-900/60 border-white/5 hover:border-zinc-500'}`}
                  >
                    {pendingBets.has(num) && (
                       <span className="absolute top-1 text-[8px] font-black text-white/60">
                         {pendingBets.get(num)!.amount / 1000}K
                       </span>
                    )}
                    <span className={`text-xl font-black ${pendingBets.has(num) ? 'text-white' : 'text-zinc-500 group-hover:text-white'}`}>{num}</span>
                  </button>
                ))}
              </div>
            </section>
          </div>
        ) : (
          <div className="space-y-6 pb-20 animate-in slide-in-from-right-5 duration-300">
             
             {/* SOI CAU CHART */}
             <section className="bg-zinc-900/60 backdrop-blur-md rounded-[2rem] p-5 border border-white/10">
                <div className="flex items-center justify-between mb-4">
                   <div className="flex items-center gap-2">
                     <TrendingUp size={14} className="text-indigo-400" />
                     <h3 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Bảng soi cầu (50 phiên)</h3>
                   </div>
                   <div className="flex gap-3">
                      <div className="flex items-center gap-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-rose-500"></div>
                        <span className="text-[8px] font-black text-zinc-500">TÀI</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                        <span className="text-[8px] font-black text-zinc-500">XỈU</span>
                      </div>
                   </div>
                </div>

                <div className="grid grid-cols-10 gap-2 mb-6">
                   {Array.from({ length: 20 }).map((_, i) => {
                     const data = drawHistory[19 - i]; 
                     return (
                       <div key={i} className="flex flex-col items-center gap-1">
                          <div className={`w-7 h-7 rounded-full flex items-center justify-center border-2 border-white/5 shadow-inner transition-all duration-500 ${data ? getBadgeStyle(data.lastDigit) : 'bg-zinc-800/40 opacity-20'}`}>
                             <span className="text-[10px] font-black text-white">{data ? data.lastDigit : ''}</span>
                          </div>
                          <span className="text-[7px] font-black text-zinc-600 italic uppercase">
                             {data ? (data.lastDigit === 5 ? 'H' : data.lastDigit <= 4 ? 'X' : 'T') : '-'}
                          </span>
                       </div>
                     );
                   })}
                </div>

                <div className="flex gap-2">
                   <div className="flex-1 bg-black/40 p-3 rounded-2xl border border-white/5 flex flex-col items-center">
                      <span className="text-[8px] font-black text-zinc-500 uppercase mb-1">Tài (6-9)</span>
                      <span className="text-sm font-black text-rose-500">{stats.total > 0 ? Math.round((stats.large / stats.total) * 100) : 0}%</span>
                   </div>
                   <div className="flex-1 bg-black/40 p-3 rounded-2xl border border-white/5 flex flex-col items-center">
                      <span className="text-[8px] font-black text-zinc-500 uppercase mb-1">Xỉu (0-4)</span>
                      <span className="text-sm font-black text-emerald-500">{stats.total > 0 ? Math.round((stats.small / stats.total) * 100) : 0}%</span>
                   </div>
                   <div className="flex-1 bg-black/40 p-3 rounded-2xl border border-white/5 flex flex-col items-center">
                      <span className="text-[8px] font-black text-zinc-500 uppercase mb-1">Hòa (5)</span>
                      <span className="text-sm font-black text-purple-500">{stats.total > 0 ? Math.round((stats.draw / stats.total) * 100) : 0}%</span>
                   </div>
                </div>
             </section>

             {/* PERSONAL HISTORY - ACCORDION VERSION */}
             <section className="space-y-3">
                <div className="flex items-center justify-between px-2">
                   <div className="flex items-center gap-2">
                      <History size={14} className="text-zinc-500" />
                      <h3 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Lịch sử cá nhân</h3>
                   </div>
                   <span className="text-[8px] font-black text-zinc-600 italic uppercase">Bấm để xem chi tiết</span>
                </div>
                
                {sortedRounds.length === 0 ? (
                  <div className="py-12 text-center opacity-20 border-2 border-dashed border-white/5 rounded-3xl">
                    <p className="text-[10px] font-black uppercase tracking-[0.4em]">Chưa có dữ liệu</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {sortedRounds.slice(0, 10).map((round: any) => {
                      const isExpanded = expandedRound === round.roundId;
                      const netProfit = round.totalWin - round.totalBet;
                      
                      return (
                        <div key={round.roundId} className="bg-zinc-900/40 border border-white/5 rounded-2xl overflow-hidden transition-all duration-300">
                          {/* Round Header (Dòng tóm tắt) */}
                          <button 
                            onClick={() => setExpandedRound(isExpanded ? null : round.roundId)}
                            className={`w-full flex items-center justify-between p-4 active:bg-white/5 transition-colors ${isExpanded ? 'bg-white/5' : ''}`}
                          >
                            <div className="flex items-center gap-4">
                              <span className="text-xs font-black text-zinc-500 italic">#{round.roundId}</span>
                              <div className="flex flex-col items-start">
                                <span className="text-[10px] font-black text-zinc-400 uppercase tracking-tighter">Tổng cược</span>
                                <span className="text-xs font-black text-white">{shortMoney(round.totalBet)}</span>
                              </div>
                            </div>

                            <div className="flex items-center gap-4">
                              <div className="flex flex-col items-end">
                                {round.status === 'pending' ? (
                                  <span className="text-[10px] font-black text-yellow-500 animate-pulse uppercase">Đang đợi...</span>
                                ) : (
                                  <>
                                    <span className="text-[10px] font-black text-zinc-500 uppercase tracking-tighter">Thắng/Thua</span>
                                    <span className={`text-xs font-black ${netProfit > 0 ? 'text-emerald-500' : netProfit < 0 ? 'text-rose-500' : 'text-zinc-400'}`}>
                                      {netProfit > 0 ? '+' : ''}{shortMoney(netProfit)}
                                    </span>
                                  </>
                                )}
                              </div>
                              {isExpanded ? <ChevronUp size={16} className="text-zinc-600" /> : <ChevronDown size={16} className="text-zinc-600" />}
                            </div>
                          </button>

                          {/* Round Details (Sổ ra chi tiết) */}
                          {isExpanded && (
                            <div className="px-4 pb-4 pt-2 border-t border-white/5 bg-black/20 animate-in slide-in-from-top-2 duration-200">
                               <div className="flex items-center justify-between mb-4 bg-zinc-800/30 p-2 rounded-xl border border-white/5">
                                  <div className="flex items-center gap-2">
                                     <Info size={12} className="text-indigo-400" />
                                     <span className="text-[10px] font-black text-zinc-400 uppercase">Kết quả phiên:</span>
                                  </div>
                                  {round.status === 'completed' ? (
                                    <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-black ${getBadgeStyle(round.result)}`}>
                                      {round.result}
                                    </div>
                                  ) : <span className="text-[10px] text-zinc-600">--</span>}
                               </div>

                               <div className="space-y-2">
                                  {round.bets.map((bet: any) => (
                                    <div key={bet.id} className="flex items-center justify-between text-[11px] py-1 border-b border-white/[0.02]">
                                       <div className="flex items-center gap-2">
                                          <div className="w-1 h-3 rounded-full bg-zinc-700"></div>
                                          <span className="font-bold text-zinc-400">{bet.label}</span>
                                          <span className="text-[8px] font-black text-zinc-600 uppercase">x{bet.rate}</span>
                                       </div>
                                       <div className="flex gap-4">
                                          <span className="text-zinc-500 font-bold">{shortMoney(bet.amount)}</span>
                                          <span className={`w-16 text-right font-black ${bet.status === 'won' ? 'text-emerald-500' : bet.status === 'lost' ? 'text-rose-500' : 'text-yellow-500'}`}>
                                             {bet.status === 'won' ? `+${shortMoney(bet.winAmount)}` : bet.status === 'lost' ? `-${shortMoney(bet.amount)}` : '...'}
                                          </span>
                                       </div>
                                    </div>
                                  ))}
                               </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
                <p className="text-center text-[9px] font-bold text-zinc-600 uppercase tracking-widest pt-4">Tự động xóa lịch sử sau 24h</p>
             </section>
          </div>
        )}
      </main>

      {/* FOOTER */}
      <div className={`fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-zinc-950/80 backdrop-blur-[32px] border-t border-white/10 z-[60] pb-10 pt-6 px-6 shadow-[0_-20px_80px_rgba(0,0,0,0.9)] transition-transform duration-500 ${activeTab === 'play' ? 'translate-y-0' : 'translate-y-full opacity-0 pointer-events-none'}`}>
        <div className="flex justify-between items-center gap-3 mb-8 overflow-x-auto scrollbar-hide py-2 px-1">
          {CHIPS.map(chip => (
            <button
              key={chip.value}
              onClick={() => setCurrentChip(chip.value)}
              className={`flex-shrink-0 w-14 h-14 rounded-full border-2 transition-all active:scale-95 relative group ${currentChip === chip.value ? 'scale-110 -translate-y-2 border-white brightness-110' : 'border-zinc-800 grayscale opacity-40 hover:opacity-100 hover:grayscale-0'}`}
            >
              <div className={`w-full h-full rounded-full bg-gradient-to-br ${chip.color} flex flex-col items-center justify-center shadow-2xl`}>
                <div className="w-[85%] h-[85%] rounded-full border border-dashed border-white/40 flex items-center justify-center">
                  <span className="text-[11px] font-black italic text-white drop-shadow-md">{chip.label}</span>
                </div>
              </div>
            </button>
          ))}
        </div>

        <div className="flex gap-4 items-stretch h-16">
          <div className="flex-[1.5] bg-white/5 border border-white/10 rounded-[2rem] flex items-center justify-between px-6 shadow-inner relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
            <div className="flex flex-col relative z-10">
              <span className="text-[8px] font-black text-zinc-500 uppercase tracking-widest mb-0.5">Đang rải ({pendingBets.size})</span>
              <span className="text-xl font-black text-yellow-500 tabular-nums">{formatVND(totalPendingAmount)}</span>
            </div>
            {pendingBets.size > 0 && (
              <button onClick={clearPending} className="p-2 text-rose-500/40 hover:text-rose-500 transition-colors relative z-10">
                <Trash2 size={20} />
              </button>
            )}
          </div>
          
          <button
            onClick={confirmAllBets}
            disabled={pendingBets.size === 0 || totalPendingAmount > balance || isDrawing}
            className={`flex-1 rounded-[2rem] font-black uppercase text-[10px] tracking-[0.2em] transition-all shadow-2xl flex items-center justify-center gap-2 ${pendingBets.size === 0 || isDrawing ? 'bg-zinc-800 text-zinc-600' : 'bg-gradient-to-r from-indigo-600 to-fuchsia-600 text-white shadow-indigo-600/40 active:scale-95'}`}
          >
            {isDrawing ? 'ĐỢI...' : <><CheckCircle2 size={16} /> CƯỢC</>}
          </button>
        </div>
      </div>

      {/* Nav */}
      <div className="fixed bottom-3 left-1/2 -translate-x-1/2 flex gap-20 z-[70] items-center bg-zinc-900/60 backdrop-blur-xl px-12 py-4 rounded-full border border-white/10 shadow-2xl">
          <button onClick={() => setActiveTab('play')} className={`transition-all flex flex-col items-center gap-1 ${activeTab === 'play' ? 'text-indigo-400 drop-shadow-[0_0_8px_currentColor]' : 'text-zinc-600 hover:text-zinc-400'}`}>
            <MousePointer2 size={22} fill={activeTab === 'play' ? 'currentColor' : 'none'} />
            <span className="text-[8px] font-black uppercase tracking-widest">Sảnh</span>
          </button>
          <button onClick={() => setActiveTab('history')} className={`transition-all flex flex-col items-center gap-1 ${activeTab === 'history' ? 'text-indigo-400 drop-shadow-[0_0_8px_currentColor]' : 'text-zinc-600 hover:text-zinc-400'}`}>
            <BarChart3 size={22} />
            <span className="text-[8px] font-black uppercase tracking-widest">Cầu</span>
          </button>
      </div>

      <style>{`
        @keyframes bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-3px); }
        }
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}