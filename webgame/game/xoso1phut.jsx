import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Wallet, Trophy, AlertCircle, Trash2, CheckCircle2, TrendingUp, Coins, Zap, RefreshCcw, LayoutDashboard, History, Table, Calendar, MapPin, ChevronDown, Clock, X, Star, ChevronLeft, ChevronRight, HelpCircle, Hash, Sparkles, Filter, Info, BookOpen, Plus, Minus, ReceiptText, Calculator, Timer, PlayCircle, XCircle, ChevronUp } from 'lucide-react';

// --- CẤU HÌNH ĐẦY ĐỦ KIỂU CHƠI ---
const GAME_CONFIG = {
  lo2: { name: 'Lô 2 số', rate: 80, price: 23, unit: 'điểm', digits: 2 },
  lo3: { name: 'Lô 3 số', rate: 400, price: 13, unit: 'điểm', digits: 3 },
  de: { name: 'Đề Đuôi', rate: 70, price: 1, unit: 'nghìn', digits: 2 },
  bacang: { name: 'Ba Càng', rate: 400, price: 1, unit: 'nghìn', digits: 3 },
  dedau: { name: 'Đề đầu', rate: 70, price: 1, unit: 'nghìn', digits: 2 },
  dau: { name: 'Đầu', rate: 9, price: 1, unit: 'nghìn', digits: 1 },
  duoi: { name: 'Đuôi', rate: 9, price: 1, unit: 'nghìn', digits: 1 },
  xien2: { name: 'Xiên 2', rate: 10, price: 1, unit: 'nghìn', digits: 2, min: 2 },
  xien3: { name: 'Xiên 3', rate: 40, price: 1, unit: 'nghìn', digits: 2, min: 3 },
  xien4: { name: 'Xiên 4', rate: 170, price: 1, unit: 'nghìn', digits: 2, min: 4 },
};

const DRAW_PERIODS = [
  { id: '1m', name: 'Siêu tốc 1p', seconds: 60 },
  { id: '5m', name: 'Siêu tốc 5p', seconds: 300 },
  { id: '30m', name: 'Siêu tốc 30p', seconds: 1800 }
];

const formatCurrency = (amount) => {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
};

const padNumber = (num, length = 2) => num.toString().padStart(length, '0');

const generateFinalResult = () => {
  const gen = (len) => Math.floor(Math.random() * Math.pow(10, len)).toString().padStart(len, '0');
  return {
    special: gen(5),
    g1: gen(5),
    g2: [gen(5), gen(5)],
    g3: Array.from({ length: 6 }, () => gen(5)),
    g4: Array.from({ length: 4 }, () => gen(4)),
    g5: Array.from({ length: 6 }, () => gen(4)),
    g6: Array.from({ length: 3 }, () => gen(3)),
    g7: Array.from({ length: 4 }, () => gen(2)),
    timestamp: new Date().getTime()
  };
};

export default function LoDeApp() {
  const [balance, setBalance] = useState(10000000);
  const [betType, setBetType] = useState('lo2');
  const [selectedNumbers, setSelectedNumbers] = useState([]);
  const [amount, setAmount] = useState('');
  const [history, setHistory] = useState([]);
  const [activeTab, setActiveTab] = useState('play');
  const [selectedPeriod, setSelectedPeriod] = useState(DRAW_PERIODS[0]);
  const [expandedBetId, setExpandedBetId] = useState(null);
  
  // Trạng thái chọn đầu số cho 3 càng / lô 3 số
  const [hundredsDigit, setHundredsDigit] = useState(0);
  
  // Trạng thái Bảng kết quả
  const [showLiveBoard, setShowLiveBoard] = useState(false);
  const [currentDrawingPeriod, setCurrentDrawingPeriod] = useState(null);
  const [isFinishingDraw, setIsFinishingDraw] = useState(false);
  const [autoCloseTimer, setAutoCloseTimer] = useState(0);

  // Kết quả hiển thị
  const [displayResults, setDisplayResults] = useState({ 
    '1m': generateFinalResult(), 
    '5m': generateFinalResult(), 
    '30m': generateFinalResult() 
  });
  const [timeLeft, setTimeLeft] = useState({ '1m': 60, '5m': 300, '30m': 1800 });

  // Reset đầu số khi đổi kiểu chơi
  useEffect(() => {
    setHundredsDigit(0);
  }, [betType]);

  const runSpinEffect = async (periodId) => {
    setCurrentDrawingPeriod(periodId);
    setShowLiveBoard(true);
    setIsFinishingDraw(false);
    setAutoCloseTimer(0);

    const finalResult = generateFinalResult();
    const tempResult = JSON.parse(JSON.stringify(finalResult));
    
    const emptyResult = {
        special: '-----', g1: '-----', g2: ['-----','-----'], 
        g3: Array(6).fill('-----'), g4: Array(4).fill('----'),
        g5: Array(6).fill('----'), g6: Array(3).fill('---'), g7: Array(4).fill('--')
    };
    setDisplayResults(prev => ({ ...prev, [periodId]: emptyResult }));

    const sequence = ['g7', 'g6', 'g5', 'g4', 'g3', 'g2', 'g1', 'special'];
    
    for (const key of sequence) {
      const startTime = Date.now();
      const duration = 700; 
      
      while (Date.now() - startTime < duration) {
        const rolling = JSON.parse(JSON.stringify(emptyResult));
        sequence.slice(0, sequence.indexOf(key)).forEach(k => {
            rolling[k] = finalResult[k];
        });

        const genRolling = (len) => Math.floor(Math.random() * Math.pow(10, len)).toString().padStart(len, '0');
        
        if (Array.isArray(rolling[key])) {
          rolling[key] = tempResult[key].map(n => genRolling(n.length));
        } else {
          rolling[key] = genRolling(tempResult[key].length);
        }
        
        setDisplayResults(prev => ({ ...prev, [periodId]: rolling }));
        await new Promise(r => setTimeout(r, 40));
      }
      
      emptyResult[key] = finalResult[key];
      setDisplayResults(prev => ({ ...prev, [periodId]: { ...emptyResult } }));
    }

    setIsFinishingDraw(true);
    checkBetsAfterDraw(periodId, finalResult);

    let count = 8;
    setAutoCloseTimer(count);
    const closeTimer = setInterval(() => {
        count -= 1;
        setAutoCloseTimer(count);
        if (count <= 0) {
            clearInterval(closeTimer);
            setShowLiveBoard(false);
            setIsFinishingDraw(false);
        }
    }, 1000);
  };

  const checkBetsAfterDraw = (periodId, finalResult) => {
    setHistory(current => current.map(bet => {
      if (bet.status === 'ĐANG CHỜ' && bet.periodId === periodId) {
        const isWin = checkWinLogic(bet, finalResult);
        if (isWin) {
          const rate = GAME_CONFIG[bet.betTypeCode].rate;
          const winMoney = (bet.unitPrice) * rate * 1000;
          const totalWin = winMoney * (bet.numbers.split(',').length);
          setBalance(b => b + totalWin);
          return { ...bet, status: 'THẮNG', winAmount: totalWin };
        }
        return { ...bet, status: 'THUA' };
      }
      return bet;
    }));
  };

  const checkWinLogic = (bet, res) => {
    const all = [res.special, res.g1, ...res.g2, ...res.g3, ...res.g4, ...res.g5, ...res.g6, ...res.g7];
    const nums = bet.numbers.split(',');
    switch(bet.betTypeCode) {
      case 'de': return nums.includes(res.special.slice(-2));
      case 'bacang': return nums.includes(res.special.slice(-3));
      case 'lo2': return nums.some(n => all.some(r => r.endsWith(n)));
      case 'lo3': return nums.some(n => all.some(r => r.endsWith(n)));
      default: return Math.random() > 0.8;
    }
  };

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        const next = { ...prev };
        DRAW_PERIODS.forEach(p => {
          if (next[p.id] <= 1) {
            next[p.id] = p.seconds;
            runSpinEffect(p.id);
          } else {
            next[p.id] -= 1;
          }
        });
        return next;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleBet = () => {
    const config = GAME_CONFIG[betType];
    const unitP = parseFloat(amount) || 0;
    const cost = selectedNumbers.length * unitP * config.price * 1000;
    
    if (selectedNumbers.length === 0 || !amount || cost > balance) return;
    
    setBalance(prev => prev - cost);
    setHistory(prev => [{
      id: Date.now(),
      type: config.name,
      betTypeCode: betType,
      numbers: selectedNumbers.join(','),
      unitPrice: unitP,
      bet: cost,
      status: 'ĐANG CHỜ',
      date: new Date().toLocaleTimeString(),
      periodId: selectedPeriod.id,
      rate: config.rate,
      priceConfig: config.price
    }, ...prev]);
    setSelectedNumbers([]);
    setAmount('');
  };

  const betSummary = useMemo(() => {
    const config = GAME_CONFIG[betType];
    const unitPrice = parseFloat(amount) || 0;
    const totalCost = selectedNumbers.length * unitPrice * config.price * 1000;
    const winPerOne = unitPrice * config.rate * 1000;
    const pricePerOne = unitPrice * config.price * 1000;

    return { rate: config.rate, pricePerOne, winPerOne, totalCost };
  }, [betType, amount, selectedNumbers]);

  const toggleExpand = (id) => {
    setExpandedBetId(expandedBetId === id ? null : id);
  };

  const renderResultTable = (res, isMainTab = false) => {
    if (!res) return null;
    return (
      <table className="w-full border-collapse bg-zinc-950 text-center rounded-xl overflow-hidden">
        <tbody>
          <tr className="border-b border-zinc-900">
            <td className="w-14 py-3 text-[9px] font-black text-red-500 uppercase border-r border-zinc-900 bg-red-950/20">ĐB</td>
            <td className={`py-3 font-black text-red-500 tracking-[0.2em] ${isMainTab ? 'text-2xl' : 'text-3xl'}`}>{res.special}</td>
          </tr>
          <tr className="border-b border-zinc-900">
            <td className="py-2 text-[9px] font-black text-zinc-500 uppercase border-r border-zinc-900">G1</td>
            <td className="py-2 text-lg font-bold text-zinc-200">{res.g1}</td>
          </tr>
          <tr className="border-b border-zinc-900 bg-zinc-900/30">
            <td className="py-2 text-[9px] font-black text-zinc-500 uppercase border-r border-zinc-900">G2</td>
            <td className="py-2 px-2 flex justify-around font-bold text-zinc-200 text-sm sm:text-base">
              {res.g2.map((n, i) => <span key={i}>{n}</span>)}
            </td>
          </tr>
          <tr className="border-b border-zinc-900">
            <td className="py-2 text-[9px] font-black text-zinc-500 uppercase border-r border-zinc-900">G3</td>
            <td className="py-2 px-1 grid grid-cols-3 gap-y-2 font-bold text-zinc-200 text-[11px] sm:text-sm">
              {res.g3.map((n, i) => <span key={i}>{n}</span>)}
            </td>
          </tr>
          <tr className="border-b border-zinc-900 bg-zinc-900/30">
            <td className="py-2 text-[9px] font-black text-zinc-500 uppercase border-r border-zinc-900">G4</td>
            <td className="py-2 px-1 flex justify-around font-bold text-zinc-300 text-xs sm:text-sm italic">
              {res.g4.map((n, i) => <span key={i}>{n}</span>)}
            </td>
          </tr>
          <tr className="border-b border-zinc-900">
            <td className="py-2 text-[9px] font-black text-zinc-500 uppercase border-r border-zinc-900">G5</td>
            <td className="py-2 px-1 grid grid-cols-3 gap-y-2 font-bold text-zinc-300 text-[11px] sm:text-sm">
              {res.g5.map((n, i) => <span key={i}>{n}</span>)}
            </td>
          </tr>
          <tr className="border-b border-zinc-900 bg-zinc-900/30">
            <td className="py-2 text-[9px] font-black text-zinc-500 uppercase border-r border-zinc-900">G6</td>
            <td className="py-2 px-1 flex justify-around font-black text-zinc-200 italic text-sm">
              {res.g6.map((n, i) => <span key={i}>{n}</span>)}
            </td>
          </tr>
          <tr className="bg-red-950/10">
            <td className="py-3 text-[9px] font-black text-red-500 uppercase border-r border-zinc-900">G7</td>
            <td className="py-3 px-1 flex justify-around font-black text-red-500 text-base sm:text-lg">
              {res.g7.map((n, i) => <span key={i}>{n}</span>)}
            </td>
          </tr>
        </tbody>
      </table>
    );
  };

  return (
    <div className="min-h-[100dvh] bg-[#050505] text-white font-sans w-full max-w-md mx-auto flex flex-col relative border-x border-zinc-800 shadow-2xl overflow-hidden">
      
      {/* BẢNG KẾT QUẢ ĐẦY ĐỦ */}
      {showLiveBoard && currentDrawingPeriod && displayResults[currentDrawingPeriod] && (
          <div className="absolute inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-start justify-center p-3 animate-in fade-in duration-300">
              <div className="w-full max-h-[90vh] bg-zinc-900 border border-zinc-700 rounded-2xl shadow-[0_0_50px_rgba(0,0,0,1)] overflow-hidden flex flex-col animate-in zoom-in-95 duration-300">
                  <div className="bg-red-600 px-4 py-3 flex justify-between items-center shrink-0">
                      <div className="flex items-center gap-2">
                        <Zap size={16} className="fill-white animate-pulse" />
                        <span className="text-xs font-black uppercase italic tracking-widest">
                            {DRAW_PERIODS.find(p=>p.id===currentDrawingPeriod)?.name}
                        </span>
                      </div>
                      <button onClick={() => setShowLiveBoard(false)} className="text-white/60 hover:text-white">
                        <XCircle size={20} />
                      </button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-1 bg-zinc-950">
                      {renderResultTable(displayResults[currentDrawingPeriod])}
                  </div>
                  {isFinishingDraw && (
                    <div className="bg-zinc-900 p-3 shrink-0">
                      <div className="w-full h-1 bg-zinc-800 rounded-full overflow-hidden">
                        <div className="h-full bg-red-600 transition-all duration-1000 ease-linear" style={{ width: `${(autoCloseTimer / 8) * 100}%` }} />
                      </div>
                      <p className="text-[8px] text-center font-bold text-zinc-600 mt-2 uppercase tracking-widest">Tự động đóng trong {autoCloseTimer}s</p>
                    </div>
                  )}
              </div>
          </div>
      )}

      {/* Header Chính */}
      <div className="p-4 flex justify-between items-center bg-zinc-900/80 border-b border-white/5 backdrop-blur-md sticky top-0 z-40 h-16 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-red-600 rounded-lg flex items-center justify-center shadow-lg shadow-red-900/20">
            <Trophy size={18} strokeWidth={3} />
          </div>
          <h1 className="text-base sm:text-lg font-black italic tracking-tighter uppercase leading-none">Siêu Tốc Live</h1>
        </div>
        <div className="text-right">
          <p className="text-[8px] font-bold text-zinc-500 uppercase leading-none mb-1">Ví {typeof duog !== 'undefined' ? 'duog' : 'Người chơi'}</p>
          <p className="text-sm sm:text-base font-black text-yellow-500 leading-none">{formatCurrency(balance).replace('₫', '')}đ</p>
        </div>
      </div>

      {/* Đài & Timer */}
      <div className="bg-zinc-950 p-3 flex justify-center items-center gap-2 border-b border-zinc-900 shrink-0">
        <div className="flex gap-2 max-w-full overflow-x-auto no-scrollbar justify-center w-full">
            {DRAW_PERIODS.map(p => (
              <button 
                key={p.id} 
                onClick={() => setSelectedPeriod(p)} 
                className={`shrink-0 flex flex-col items-center justify-center w-[30%] min-w-[90px] py-2.5 rounded-xl border transition-all duration-300 ${selectedPeriod.id === p.id ? 'bg-red-600 border-red-400 shadow-[0_0_15px_rgba(220,38,38,0.4)]' : 'bg-zinc-900 border-zinc-800 opacity-60'}`}
              >
                <p className="text-[7px] font-black uppercase opacity-80 mb-1 text-center">{p.name}</p>
                <div className="flex items-center gap-1.5">
                   <p className="text-[11px] font-mono font-black">{timeLeft[p.id]}s</p>
                   <Timer size={10} className={selectedPeriod.id === p.id ? 'animate-pulse' : ''} />
                </div>
              </button>
            ))}
        </div>
      </div>

      {/* Main Content Area - Scrollable */}
      <main className="flex-1 overflow-y-auto custom-scrollbar overflow-x-hidden pb-24">
        {activeTab === 'play' && (
          <div className="p-4 space-y-4 sm:space-y-5">
            
            {/* --- KHU VỰC CHỌN KIỂU CHƠI --- */}
            <div className="w-full relative">
                <div className="flex overflow-x-auto scroll-smooth no-scrollbar gap-2 py-2 px-2 -mx-2 touch-pan-x">
                    <div className="flex gap-2 flex-nowrap">
                        {Object.keys(GAME_CONFIG).map(k => (
                          <button 
                            key={k} 
                            onClick={() => {setBetType(k); setSelectedNumbers([]);}} 
                            className={`shrink-0 px-4 py-3 rounded-xl text-[10px] font-black uppercase border transition-all whitespace-nowrap shadow-sm ${betType === k ? 'bg-white text-black border-white shadow-white/10 scale-105' : 'bg-zinc-900 text-zinc-500 border-zinc-800 hover:border-zinc-700'}`}
                          >
                            {GAME_CONFIG[k].name}
                          </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* --- TAB CHỌN HÀNG TRĂM (DÀNH CHO 3 SỐ) --- */}
            {GAME_CONFIG[betType].digits === 3 && (
                <div className="bg-zinc-900/50 p-2 rounded-2xl border border-zinc-800 flex flex-col gap-2">
                    <p className="text-[8px] font-black text-zinc-500 uppercase px-2 tracking-widest">Chọn đầu số (Hàng trăm)</p>
                    <div className="flex overflow-x-auto no-scrollbar gap-2 px-1">
                        {Array.from({length: 10}).map((_, i) => (
                            <button 
                                key={i} 
                                onClick={() => setHundredsDigit(i)}
                                className={`shrink-0 w-12 py-2 rounded-lg font-black text-xs border transition-all ${hundredsDigit === i ? 'bg-yellow-500 border-yellow-400 text-black shadow-lg shadow-yellow-500/20' : 'bg-black border-zinc-800 text-zinc-500'}`}
                            >
                                {i}xx
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Number Selector Box */}
            <div className="bg-zinc-900/30 rounded-2xl p-4 border border-zinc-800/50">
              <div className="flex justify-between items-center mb-3 px-1">
                <div className="flex items-center gap-2">
                   <Hash size={12} className="text-red-500" />
                   <span className="text-[9px] font-black text-zinc-500 uppercase tracking-[0.2em]">
                        {GAME_CONFIG[betType].name} {GAME_CONFIG[betType].digits === 3 ? `(Đầu ${hundredsDigit})` : ''}
                   </span>
                </div>
                <span className="text-[8px] font-bold text-zinc-600 uppercase">Đã chọn: {selectedNumbers.length}</span>
              </div>
              <div className="grid grid-cols-5 gap-2 h-[35vh] min-h-[220px] overflow-y-auto pr-1 custom-scrollbar touch-pan-y">
                {Array.from({length: 100}).map((_, i) => {
                  let n;
                  if (GAME_CONFIG[betType].digits === 1) {
                      if (i >= 10) return null; // Chỉ hiện 10 số cho Đầu/Đuôi
                      n = i.toString();
                  } else if (GAME_CONFIG[betType].digits === 3) {
                      // Tạo số có 3 chữ số dựa trên hàng trăm đang chọn
                      n = (hundredsDigit * 100 + i).toString().padStart(3, '0');
                  } else {
                      // Mặc định 2 chữ số
                      n = i.toString().padStart(2, '0');
                  }
                  
                  const active = selectedNumbers.includes(n);
                  return (
                    <button key={n} onClick={() => setSelectedNumbers(prev => prev.includes(n) ? prev.filter(x=>x!==n) : [...prev, n])} className={`aspect-square rounded-xl flex items-center justify-center font-mono font-black text-base border transition-all ${active ? 'bg-red-600 border-red-400 text-white' : 'bg-black border-zinc-800 text-zinc-800 hover:border-zinc-700'}`}>
                      {n}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Bet Input Section */}
            <div className="bg-zinc-900 rounded-3xl p-5 border border-zinc-800 space-y-4 shadow-inner">
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center px-1">
                    <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Số {GAME_CONFIG[betType].unit} / 1 con</p>
                    <div className="text-[9px] font-black text-yellow-500 uppercase bg-yellow-500/10 px-2 py-0.5 rounded-full border border-yellow-500/20">
                      Tỉ lệ: x{betSummary.rate}
                    </div>
                  </div>
                  <div className="relative">
                      <input 
                        type="number" 
                        value={amount} 
                        onChange={(e) => setAmount(e.target.value)} 
                        placeholder="0" 
                        className="w-full bg-black border border-zinc-800 p-4 rounded-2xl text-2xl font-black text-yellow-500 outline-none focus:border-yellow-500/50 transition-colors placeholder:text-zinc-900" 
                      />
                      <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-zinc-600 uppercase">{GAME_CONFIG[betType].unit}</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                   <div className="bg-black/40 border border-zinc-800/50 p-3 rounded-xl">
                      <p className="text-[8px] font-bold text-zinc-500 uppercase mb-1">Tiền đánh / 1 con</p>
                      <p className="text-xs font-black text-zinc-300">{formatCurrency(betSummary.pricePerOne)}</p>
                   </div>
                   <div className="bg-black/40 border border-zinc-800/50 p-3 rounded-xl">
                      <p className="text-[8px] font-bold text-zinc-500 uppercase mb-1">Tiền thắng / 1 con</p>
                      <p className="text-xs font-black text-green-500">{formatCurrency(betSummary.winPerOne)}</p>
                   </div>
                </div>

                <div className="flex justify-between items-center bg-zinc-800/20 p-3 rounded-xl border border-dashed border-zinc-700">
                   <span className="text-[9px] font-black text-zinc-400 uppercase">Tổng cộng ({selectedNumbers.length} số)</span>
                   <span className="text-sm font-black text-white">{formatCurrency(betSummary.totalCost)}</span>
                </div>
              </div>

              <button 
                onClick={handleBet} 
                disabled={selectedNumbers.length === 0 || !amount || betSummary.totalCost > balance}
                className={`w-full py-4 rounded-2xl font-black uppercase text-sm shadow-xl flex items-center justify-center gap-2 active:scale-95 transition-all ${selectedNumbers.length > 0 && amount && betSummary.totalCost <= balance ? 'bg-gradient-to-r from-red-600 to-red-800 text-white' : 'bg-zinc-800 text-zinc-600 cursor-not-allowed opacity-50'}`}
              >
                <Zap size={16} fill="currentColor" /> ĐẶT CƯỢC {selectedPeriod.name}
              </button>
            </div>
          </div>
        )}

        {activeTab === 'result' && (
           <div className="p-4 space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
               <div className="flex items-center justify-between">
                  <h2 className="text-sm font-black uppercase italic text-zinc-400 tracking-widest">KẾT QUẢ GẦN NHẤT</h2>
                  <div className="px-3 py-1 bg-red-600/10 border border-red-500/20 rounded-full text-[10px] font-black text-red-500 uppercase">
                    {selectedPeriod.name}
                  </div>
               </div>
               <div className="bg-zinc-900/50 rounded-2xl border border-zinc-800 overflow-hidden shadow-2xl">
                   {renderResultTable(displayResults[selectedPeriod.id], true)}
               </div>
           </div>
        )}

        {activeTab === 'history' && (
          <div className="p-4 space-y-3">
             <h2 className="text-lg font-black text-yellow-500 uppercase tracking-tighter mb-4">Lịch sử cược</h2>
             <div className="space-y-3">
                {history.length === 0 ? (
                    <div className="py-12 text-center text-zinc-700 font-bold uppercase text-[10px]">Chưa có lịch sử cược</div>
                ) : history.map(h => {
                    const isExpanded = expandedBetId === h.id;
                    const numCount = h.numbers.split(',').length;
                    const pricePerOne = h.unitPrice * h.priceConfig * 1000;
                    const winPerOne = h.unitPrice * h.rate * 1000;
                    return (
                        <div key={h.id} className="bg-zinc-900 border border-white/5 rounded-2xl overflow-hidden transition-all duration-300">
                            <button onClick={() => toggleExpand(h.id)} className="w-full text-left p-4 space-y-2 active:bg-zinc-800 transition-colors">
                                <div className="flex justify-between items-center">
                                    <div className="flex items-center gap-2">
                                        <span className="text-[9px] font-black text-red-500 uppercase">{h.type} • {DRAW_PERIODS.find(p=>p.id===h.periodId).name}</span>
                                        {isExpanded ? <ChevronUp size={12} className="text-zinc-500" /> : <ChevronDown size={12} className="text-zinc-500" />}
                                    </div>
                                    <span className={`text-[8px] font-black px-2 py-0.5 rounded-lg ${h.status==='THẮNG'?'bg-green-500 text-black':h.status==='THUA'?'bg-zinc-800 text-zinc-500':'bg-yellow-500 text-black animate-pulse'}`}>{h.status}</span>
                                </div>
                                <div className="flex justify-between items-end border-t border-white/5 pt-2">
                                    <p className="text-[9px] font-bold text-zinc-400 truncate max-w-[60%]">Số: {h.numbers}</p>
                                    <div className="text-right">
                                        <p className="text-xs font-black text-white">{formatCurrency(h.bet)}</p>
                                        {h.winAmount && <p className="text-[10px] font-black text-green-500">+{formatCurrency(h.winAmount)}</p>}
                                    </div>
                                </div>
                            </button>
                            <div className={`bg-zinc-950 px-4 overflow-hidden transition-all duration-300 ease-in-out ${isExpanded ? 'max-h-40 py-4 border-t border-white/5' : 'max-h-0'}`}>
                                <div className="grid grid-cols-2 gap-y-3">
                                    <div>
                                        <p className="text-[8px] font-bold text-zinc-500 uppercase">Hệ số thắng</p>
                                        <p className="text-xs font-black text-yellow-500">x{h.rate}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[8px] font-bold text-zinc-500 uppercase">Số lượng con</p>
                                        <p className="text-xs font-black text-zinc-300">{numCount} con</p>
                                    </div>
                                    <div>
                                        <p className="text-[8px] font-bold text-zinc-500 uppercase">Tiền đánh / 1 con</p>
                                        <p className="text-xs font-black text-zinc-300">{formatCurrency(pricePerOne)}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[8px] font-bold text-zinc-500 uppercase">Tiền thắng / 1 con</p>
                                        <p className="text-xs font-black text-green-500">{formatCurrency(winPerOne)}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}
             </div>
          </div>
        )}
      </main>

      {/* Footer Navigation */}
      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-black/95 backdrop-blur-xl border-t border-zinc-800 flex py-3 px-6 z-50 h-20 items-center">
        {[
          {id: 'play', icon: LayoutDashboard, label: 'Ghi Số'},
          {id: 'result', icon: Table, label: 'Kết Quả'},
          {id: 'history', icon: History, label: 'Lịch Sử'}
        ].map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)} className={`flex-1 flex flex-col items-center gap-1.5 transition-all ${activeTab === t.id ? 'text-red-500' : 'text-zinc-600'}`}>
            <t.icon size={20} className={activeTab === t.id ? 'animate-bounce-short' : ''} />
            <span className="text-[9px] font-black uppercase tracking-tighter">{t.label}</span>
          </button>
        ))}
      </nav>

      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #333; border-radius: 10px; }
        @keyframes bounce-short {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-2px); }
        }
        .animate-bounce-short { animation: bounce-short 1.5s ease-in-out infinite; }
        .touch-pan-x { touch-action: pan-x; }
        .touch-pan-y { touch-action: pan-y; }
      `}</style>
    </div>
  );
}