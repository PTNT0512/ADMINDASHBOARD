import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Wallet, Trophy, AlertCircle, Trash2, CheckCircle2, TrendingUp, Coins, Zap, RefreshCcw, LayoutDashboard, History, Table, Calendar, MapPin, ChevronDown, Clock, X, Star, ChevronLeft, ChevronRight, HelpCircle, Hash, Sparkles, Filter, Info, BookOpen, Plus, Minus, ReceiptText, Calculator } from 'lucide-react';
import { bootstrapGameAuth } from './authBootstrap';
import { refreshWinRates, shouldPlayerWin } from './winRateControl';

// --- C?U H?NH 10 KI?U CHOI ---
const GAME_CONFIG = {
  lo2: { name: 'L? 2 s?', rate: 80000, price: 23000, unit: 'di?m', digits: 2, desc: 'So s?nh 2 s? cu?i c?a t?t c? c?c gi?i. ??nh 1 di?m (23k), tr?ng 1 nh?y an 80k.' },
  lo3: { name: 'L? 3 s?', rate: 400000, price: 13000, unit: 'di?m', digits: 3, desc: 'So s?nh 3 s? cu?i c?a c?c gi?i c? t? 3 ch? s? tr? l?n.' },
  dedau: { name: '?? d?u', rate: 70000, price: 1000, unit: 'ngh?n', digits: 2, desc: 'D? do?n 2 s? c?a gi?i B?y (MB) ho?c gi?i T?m (MN/MT).' },
  de: { name: '?? ?u?i', rate: 70000, price: 1000, unit: 'ngh?n', digits: 2, desc: 'D? do?n 2 s? cu?i c?a gi?i ??c bi?t.' },
  bacang: { name: 'Ba C?ng', rate: 400000, price: 1000, unit: 'ngh?n', digits: 3, desc: 'D? do?n 3 s? cu?i c?a gi?i ??c bi?t.' },
  dau: { name: '??u', rate: 9000, price: 1000, unit: 'ngh?n', digits: 1, desc: 'D? do?n s? h?ng ch?c c?a gi?i ??c bi?t.' },
  duoi: { name: '?u?i', rate: 9000, price: 1000, unit: 'ngh?n', digits: 1, desc: 'D? do?n s? h?ng don v? c?a gi?i ??c bi?t.' },
  xien2: { name: 'Xi?n 2', rate: 10000, price: 1000, unit: 'ngh?n', digits: 2, min: 2, desc: 'Ch?n 2 c?p s?, c? 2 c?p ph?i c?ng v?.' },
  xien3: { name: 'Xi?n 3', rate: 40000, price: 1000, unit: 'ngh?n', digits: 2, min: 3, desc: 'Ch?n 3 c?p s?, c? 3 c?p ph?i c?ng v?.' },
  xien4: { name: 'Xi?n 4', rate: 170000, price: 1000, unit: 'ngh?n', digits: 2, min: 4, desc: 'Ch?n 4 c?p s?, c? 4 c?p ph?i c?ng v?.' },
};

const REGION_CONFIG = { name: 'Mi?n B?c', drawTime: '18:30' };

// D? li?u m?u k?t qu?
const MOCK_RESULTS = {
  special: "58291",
  g1: "10283",
  g2: ["92813", "44102"],
  g3: ["12093", "88273", "45612", "09123", "77123", "33210"],
  g4: ["4412", "8823", "1029", "5512"],
  g5: ["9921", "1234", "5567", "8812", "0021", "4432"],
  g6: ["123", "456", "789"],
  g7: ["12", "34", "56", "78"]
};

const formatCurrency = (amount) => {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
};

const padNumber = (num, length = 2) => num.toString().padStart(length, '0');

function useDraggableScroll() {
  const ref = useRef(null);
  const [isDown, setIsDown] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);

  const onMouseDown = (e) => {
    setIsDown(true);
    setStartX(e.pageX - ref.current.offsetLeft);
    setScrollLeft(ref.current.scrollLeft);
  };

  const onMouseLeave = () => setIsDown(false);
  const onMouseUp = () => setIsDown(false);

  const onMouseMove = (e) => {
    if (!isDown) return;
    e.preventDefault();
    const x = e.pageX - ref.current.offsetLeft;
    const walk = (x - startX) * 2;
    ref.current.scrollLeft = scrollLeft - walk;
  };

  const onTouchStart = (e) => {
    setIsDown(true);
    setStartX(e.touches[0].pageX - ref.current.offsetLeft);
    setScrollLeft(ref.current.scrollLeft);
  };

  const onTouchMove = (e) => {
    if (!isDown) return;
    const x = e.touches[0].pageX - ref.current.offsetLeft;
    const walk = (x - startX) * 2;
    ref.current.scrollLeft = scrollLeft - walk;
  };

  return {
    ref,
    events: {
      onMouseDown,
      onMouseLeave,
      onMouseUp,
      onMouseMove,
      onTouchStart,
      onTouchMove,
      onTouchEnd: onMouseUp
    }
  };
}

export default function LoDeApp() {
  const [balance, setBalance] = useState(10000000);
  useEffect(() => {
    bootstrapGameAuth({
      onBalance: setBalance,
    }).catch((error) => console.error('Game auth bootstrap failed:', error));
    refreshWinRates().catch(() => {});
  }, []);
  const [betType, setBetType] = useState('lo2');
  const [selectedNumbers, setSelectedNumbers] = useState([]);
  const [digitTab, setDigitTab] = useState(0); 
  const [amount, setAmount] = useState('');
  const [history, setHistory] = useState([]);
  const [activeTab, setActiveTab] = useState('play');
  const [notification, setNotification] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  const menuScroll = useDraggableScroll();
  const selectedNumsScroll = useDraggableScroll();
  const digitTabsScroll = useDraggableScroll();

  // T? d?ng t?t th?ng b?o sau 3 gi?y
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => {
        setNotification(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  const last14Days = useMemo(() => {
    const dates = [];
    for (let i = 0; i < 14; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      dates.push(d.toISOString().split('T')[0]);
    }
    return dates;
  }, []);

  const toggleNumber = (numStr) => {
    const config = GAME_CONFIG[betType];
    if (config.min && selectedNumbers.length >= config.min && !selectedNumbers.includes(numStr)) return;
    if (selectedNumbers.includes(numStr)) {
      setSelectedNumbers(selectedNumbers.filter(n => n !== numStr));
    } else {
      setSelectedNumbers([...selectedNumbers, numStr]);
    }
  };

  const calculateTotalCost = () => {
    const config = GAME_CONFIG[betType];
    const betVal = parseFloat(amount) || 0;
    const price = betVal * config.price;
    if (config.min) return selectedNumbers.length === config.min ? price : 0;
    return selectedNumbers.length * price;
  };

  const calculateWinAmount = () => {
      const config = GAME_CONFIG[betType];
      const betVal = parseFloat(amount) || 0;
      return betVal * config.rate;
  };

  const handleBet = () => {
    const totalCost = calculateTotalCost();
    if (selectedNumbers.length === 0) {
      setNotification({ type: 'error', msg: 'Chua ch?n s?!' });
      return;
    }
    if (totalCost === 0) {
      setNotification({ type: 'error', msg: 'Nh?p m?c cu?c!' });
      return;
    }
    if (totalCost > balance) {
      setNotification({ type: 'error', msg: 'S? du kh?ng d?!' });
      return;
    }

    setIsProcessing(true);
    setTimeout(() => {
      setBalance(prev => prev - totalCost);
      const betId = Date.now();
      const itemCount = GAME_CONFIG[betType].min ? 1 : selectedNumbers.length;
      const winAmount = calculateWinAmount() * itemCount;
      setHistory(prev => [{ id: betId, type: GAME_CONFIG[betType].name, numbers: selectedNumbers.join(','), bet: totalCost, status: '?ANG CH?', date: selectedDate }, ...prev]);
      setNotification({ type: 'success', msg: '??t cu?c th?nh c?ng!' });
      setIsProcessing(false);
      setSelectedNumbers([]);
      setAmount('');

      setTimeout(() => {
        const isWin = shouldPlayerWin('lode');
        if (isWin) {
          setBalance(prev => prev + winAmount);
        }
        setHistory(prev => prev.map((item) => (
          item.id === betId
            ? { ...item, status: isWin ? 'THANG' : 'THUA', winAmount: isWin ? winAmount : 0 }
            : item
        )));
      }, 1800);
    }, 600);
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-zinc-100 font-sans max-w-md mx-auto flex flex-col shadow-2xl overflow-hidden border-x border-zinc-800/50 relative">
      
      {/* Th?ng b?o - Hi?u ?ng Slide & Fade trong 3 gi?y */}
      {notification && (
          <div className={`fixed top-6 left-1/2 -translate-x-1/2 z-[300] px-4 py-2 rounded-full shadow-2xl flex items-center gap-2 font-bold text-[11px] animate-in fade-in slide-in-from-top-4 out-fade-out out-slide-out-to-top-4 duration-300 border backdrop-blur-md ${
              notification.type === 'error' ? 'bg-red-500/90 border-red-400 text-white' : 'bg-green-500/90 border-green-400 text-white'
          }`}>
              {notification.type === 'error' ? <AlertCircle size={14} /> : <CheckCircle2 size={14} />}
              {notification.msg}
          </div>
      )}

      {/* Header */}
      <div className="bg-gradient-to-r from-red-900 to-zinc-950 p-4 flex justify-between items-center shrink-0 border-b border-white/5">
        <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-yellow-500 rounded-lg flex items-center justify-center text-black shadow-lg shadow-yellow-500/20">
                <Trophy size={18} strokeWidth={3} />
            </div>
            <span className="font-black italic text-xl tracking-tighter uppercase text-white">X? S? Pro</span>
        </div>
        <div className="text-right">
             <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest leading-none mb-1">V? duog</p>
             <p className="text-lg font-black text-yellow-400 leading-none">{formatCurrency(balance).replace('?', '')}d</p>
        </div>
      </div>

      <main className="flex-1 overflow-y-auto custom-scrollbar bg-zinc-950 pb-24">
        {activeTab === 'play' && (
            <div className="p-4 space-y-4">
                {/* MENU KI?U CHOI */}
                <div className="relative -mx-4">
                    <div ref={menuScroll.ref} {...menuScroll.events} className="flex gap-2 overflow-x-auto px-4 pb-2 no-scrollbar cursor-grab active:cursor-grabbing touch-pan-x">
                        {Object.keys(GAME_CONFIG).map((type) => (
                            <button key={type} onClick={() => { setBetType(type); setSelectedNumbers([]); }} className={`shrink-0 flex items-center justify-center px-4 py-3 rounded-2xl border transition-all ${betType === type ? 'bg-red-600 border-red-400 text-white shadow-lg' : 'bg-zinc-900 border-zinc-800 text-zinc-500'}`}>
                                <span className="text-[10px] font-black uppercase tracking-tight whitespace-nowrap">{GAME_CONFIG[type].name}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* KHU V?C CH?N S? */}
                <div className="bg-zinc-900/50 rounded-3xl p-4 border border-zinc-800/50">
                    <div className="flex justify-between items-center mb-4 px-1">
                        <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">B?ng {GAME_CONFIG[betType].digits} s?</span>
                        {selectedNumbers.length > 0 && (
                            <button onClick={() => setSelectedNumbers([])} className="text-red-500 text-[10px] font-black uppercase flex items-center gap-1">
                                <Trash2 size={12} /> X?a h?t
                            </button>
                        )}
                    </div>
                    {GAME_CONFIG[betType].digits === 3 && (
                        <div className="mb-4">
                            <div ref={digitTabsScroll.ref} {...digitTabsScroll.events} className="flex gap-1.5 overflow-x-auto no-scrollbar pb-2 touch-pan-x">
                                {Array.from({ length: 10 }, (_, i) => (
                                    <button key={i} onClick={() => setDigitTab(i)} className={`shrink-0 px-4 py-2 rounded-xl text-[10px] font-black border transition-all ${digitTab === i ? 'bg-red-600 text-white border-red-400 shadow-md' : 'bg-zinc-800 border-zinc-700 text-zinc-500'}`}>
                                        {`${i}xx`}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                    <div className="grid grid-cols-5 gap-2 h-64 overflow-y-auto pr-2 custom-scrollbar">
                        {(GAME_CONFIG[betType].digits === 1 ? Array.from({length: 10}) : Array.from({length: 100})).map((_, i) => {
                            const numStr = GAME_CONFIG[betType].digits === 1 ? i.toString() : (GAME_CONFIG[betType].digits === 3 ? padNumber(digitTab * 100 + i, 3) : padNumber(i, 2));
                            const isSelected = selectedNumbers.includes(numStr);
                            return (
                                <button key={numStr} onClick={() => toggleNumber(numStr)} className={`aspect-square rounded-xl flex items-center justify-center font-mono font-black text-lg border transition-all active:scale-90 ${isSelected ? 'bg-red-600 border-red-400 text-white shadow-lg' : 'bg-black border-zinc-800 text-zinc-700 hover:border-zinc-700'}`}>
                                    {numStr}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* KHU V?C CU?C */}
                <div className="bg-zinc-900 rounded-[2.5rem] p-6 border border-zinc-800 shadow-2xl space-y-5 relative">
                    <div className="space-y-3">
                        <div className="flex justify-between items-end">
                             <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                                <ReceiptText size={12} className="text-red-500" />
                                M?c cu?c ({GAME_CONFIG[betType].unit})
                             </label>
                             {amount && (
                                 <span className="text-[10px] font-bold text-zinc-400 bg-zinc-800 px-2 py-0.5 rounded-lg border border-white/5">
                                    {formatCurrency(parseFloat(amount) * GAME_CONFIG[betType].price).replace('?', '')}d / con
                                 </span>
                             )}
                        </div>
                        <div className="relative">
                            <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" className="w-full bg-black/60 border border-zinc-800 p-5 pl-14 rounded-3xl text-3xl font-black text-yellow-400 outline-none transition-all focus:border-red-600/50" />
                            <div className="absolute left-5 top-1/2 -translate-y-1/2 text-zinc-700"><Coins size={24} /></div>
                        </div>
                    </div>

                    {selectedNumbers.length > 0 && (
                        <div className="space-y-2">
                             <div className="flex justify-between items-center px-1">
                                <span className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">?ang ch?n ({selectedNumbers.length})</span>
                                <span className="text-[9px] text-zinc-700 italic">K?o d? xem ?</span>
                             </div>
                             <div ref={selectedNumsScroll.ref} {...selectedNumsScroll.events} className="flex gap-2 overflow-x-auto no-scrollbar pb-1 cursor-grab active:cursor-grabbing touch-pan-x">
                                {selectedNumbers.map(num => (
                                    <div key={num} className="shrink-0 px-3 py-1.5 bg-red-600/10 border border-red-600/30 rounded-full flex items-center gap-1.5 animate-in zoom-in-50">
                                        <span className="text-xs font-mono font-black text-red-500">{num}</span>
                                        <button onClick={() => toggleNumber(num)} className="text-red-900 hover:text-red-400 transition-colors"><X size={10} /></button>
                                    </div>
                                ))}
                             </div>
                        </div>
                    )}

                    <div className="bg-black/40 rounded-3xl border border-white/5 p-4 space-y-3">
                        <div className="flex justify-between items-center text-xs">
                            <span className="text-zinc-500 font-bold uppercase text-[10px]">T?ng thanh to?n:</span>
                            <span className="font-black text-zinc-200">{formatCurrency(calculateTotalCost())}</span>
                        </div>
                        <div className="h-px bg-zinc-800/50" />
                        <div className="flex justify-between items-center">
                            <div className="flex items-center gap-1.5">
                                <Calculator size={14} className="text-green-500" />
                                <span className="text-zinc-500 font-bold uppercase text-[10px]">Th?ng d? ki?n / 1 s?:</span>
                            </div>
                            <div className="text-right">
                                <span className="text-lg font-black text-green-500">+{formatCurrency(calculateWinAmount()).replace('?', '')}d</span>
                                <p className="text-[8px] font-black text-zinc-600 uppercase tracking-tighter">T? l? an x{GAME_CONFIG[betType].rate / (GAME_CONFIG[betType].price || 1)} l?n</p>
                            </div>
                        </div>
                    </div>

                    <button onClick={handleBet} disabled={isProcessing} className="w-full py-5 bg-gradient-to-br from-red-600 to-red-900 rounded-3xl text-white font-black uppercase text-sm shadow-xl shadow-red-950/40 active:scale-95 transition-all flex items-center justify-center gap-2">
                        {isProcessing ? <RefreshCcw className="animate-spin" size={20} /> : <><Zap size={18} fill="currentColor" />X?C NH?N CU?C</>}
                    </button>
                </div>
            </div>
        )}

        {activeTab === 'result' && (
            <div className="p-4 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                {/* Ti?u d? & Ch?n ng?y */}
                <div className="flex justify-between items-end px-1">
                    <div>
                        <h2 className="font-black text-red-500 text-xl uppercase tracking-tighter leading-none">K?t qu? XSMB</h2>
                        <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest">{selectedDate}</span>
                    </div>
                    <div className="bg-zinc-900 border border-zinc-800 px-3 py-1.5 rounded-xl flex items-center gap-2">
                        <Calendar size={12} className="text-red-500" />
                        <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="bg-transparent text-[10px] font-black uppercase outline-none text-zinc-400" />
                    </div>
                </div>

                {/* B?NG K?T QU? TRUY?N TH?NG */}
                <div className="bg-zinc-900 rounded-[2rem] border border-zinc-800 overflow-hidden shadow-2xl">
                    <table className="w-full text-center border-collapse">
                        <tbody>
                            <tr className="border-b border-zinc-800">
                                <td className="w-20 py-4 bg-red-600/5 text-red-600 font-black text-[9px] uppercase border-r border-zinc-800">??c bi?t</td>
                                <td className="py-4 text-3xl font-black text-red-600 tracking-widest animate-pulse">{MOCK_RESULTS.special}</td>
                            </tr>
                            <tr className="border-b border-zinc-800">
                                <td className="py-3 bg-zinc-800/20 text-zinc-500 font-black text-[8px] uppercase border-r border-zinc-800">Gi?i nh?t</td>
                                <td className="py-3 text-xl font-black text-zinc-200">{MOCK_RESULTS.g1}</td>
                            </tr>
                            <tr className="border-b border-zinc-800">
                                <td className="py-3 bg-zinc-800/20 text-zinc-500 font-black text-[8px] uppercase border-r border-zinc-800">Gi?i nh?</td>
                                <td className="py-3 px-4 flex justify-around text-lg font-black text-zinc-200">{MOCK_RESULTS.g2.join(' ')}</td>
                            </tr>
                            <tr className="border-b border-zinc-800">
                                <td className="py-3 bg-zinc-800/20 text-zinc-500 font-black text-[8px] uppercase border-r border-zinc-800">Gi?i ba</td>
                                <td className="py-3 px-2 grid grid-cols-3 gap-y-2 text-sm font-black text-zinc-200">{MOCK_RESULTS.g3.map(n => <span key={n}>{n}</span>)}</td>
                            </tr>
                            <tr className="border-b border-zinc-800">
                                <td className="py-2.5 bg-zinc-800/20 text-zinc-500 font-black text-[8px] uppercase border-r border-zinc-800">Gi?i tu</td>
                                <td className="py-2.5 px-4 flex justify-around text-base font-black text-zinc-200">{MOCK_RESULTS.g4.join(' ')}</td>
                            </tr>
                            <tr className="border-b border-zinc-800">
                                <td className="py-3 bg-zinc-800/20 text-zinc-500 font-black text-[8px] uppercase border-r border-zinc-800">Gi?i nam</td>
                                <td className="py-3 px-2 grid grid-cols-3 gap-y-2 text-sm font-black text-zinc-200">{MOCK_RESULTS.g5.map(n => <span key={n}>{n}</span>)}</td>
                            </tr>
                            <tr className="border-b border-zinc-800">
                                <td className="py-2.5 bg-zinc-800/20 text-zinc-500 font-black text-[8px] uppercase border-r border-zinc-800">Gi?i s?u</td>
                                <td className="py-2.5 px-4 flex justify-around text-base font-black text-zinc-200">{MOCK_RESULTS.g6.join(' ')}</td>
                            </tr>
                            <tr>
                                <td className="py-3 bg-zinc-800/20 text-zinc-500 font-black text-[8px] uppercase border-r border-zinc-800">Gi?i b?y</td>
                                <td className="py-3 px-4 flex justify-around text-lg font-black text-red-500 tracking-wider">{MOCK_RESULTS.g7.join(' ')}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                {/* L?CH S? 14 NG?Y G?N NH?T */}
                <div className="space-y-3">
                    <div className="flex items-center gap-2 px-1">
                        <History size={14} className="text-zinc-600" />
                        <h3 className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">L?ch s? 14 ng?y</h3>
                    </div>
                    <div className="space-y-2 max-h-80 overflow-y-auto pr-1 custom-scrollbar">
                        {last14Days.map((date, idx) => (
                            <button 
                                key={date} 
                                onClick={() => setSelectedDate(date)}
                                className={`w-full p-4 rounded-2xl border flex items-center justify-between transition-all group ${selectedDate === date ? 'bg-red-600/5 border-red-600/50' : 'bg-zinc-900 border-zinc-800 hover:border-zinc-700'}`}
                            >
                                <div className="flex items-center gap-3">
                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-[10px] ${selectedDate === date ? 'bg-red-600 text-white' : 'bg-zinc-800 text-zinc-500 group-hover:text-red-500'}`}>
                                        {14 - idx}
                                    </div>
                                    <div className="text-left">
                                        <p className="text-xs font-black text-zinc-300">{date.split('-').reverse().join('/')}</p>
                                        <p className="text-[8px] font-bold text-zinc-600 uppercase">Mi?n B?c</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <span className="text-[8px] font-black text-zinc-600 uppercase block">??c bi?t</span>
                                    <span className="text-xs font-mono font-black text-red-500">...{MOCK_RESULTS.special.slice(-4)}</span>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        )}

        {activeTab === 'history' && (
            <div className="p-4 space-y-3 pb-20">
                <div className="flex justify-between items-center px-1 mb-2">
                    <h2 className="font-black text-yellow-500 text-xl uppercase tracking-tighter leading-none">L?ch s? cu?c</h2>
                    <span className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">{history.length} don cu?c</span>
                </div>
                {history.length === 0 ? (
                    <div className="py-20 text-center space-y-4 opacity-30">
                        <History size={48} className="mx-auto text-zinc-700" />
                        <p className="text-zinc-700 font-black uppercase italic text-sm">Chua c? l?ch s? cu?c</p>
                    </div>
                ) : (
                    history.map(item => (
                        <div key={item.id} className="bg-zinc-900 p-4 rounded-3xl border border-white/5 space-y-3 relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-20 transition-opacity">
                                <Zap size={40} className="text-red-600" />
                            </div>
                            <div className="flex justify-between items-start relative z-10">
                                <div>
                                    <span className="text-[10px] font-black text-red-500 uppercase tracking-tight bg-red-600/10 px-2 py-0.5 rounded-lg">{item.type}</span>
                                    <p className="text-[9px] font-bold text-zinc-600 uppercase mt-1">{item.date} ? {new Date(item.id).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                                </div>
                                <span className="text-[9px] font-black px-2 py-1 rounded-md bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 uppercase animate-pulse">{item.status}</span>
                            </div>
                            <div className="flex justify-between items-end border-t border-white/5 pt-3 relative z-10">
                                <div className="space-y-1">
                                    <p className="text-[8px] text-zinc-600 uppercase font-black">S? d? ch?n</p>
                                    <p className="text-xs font-mono font-black text-zinc-300 tracking-wider">{item.numbers}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-[8px] text-zinc-600 uppercase font-black">Ti?n cu?c</p>
                                    <p className="text-sm font-black text-zinc-100">{formatCurrency(item.bet)}</p>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        )}
      </main>

      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-black/95 backdrop-blur-md border-t border-zinc-800 flex py-3 px-6 shrink-0 z-50">
        {[
            {id: 'play', icon: LayoutDashboard, label: 'Ghi S?'},
            {id: 'result', icon: Table, label: 'K?t Qu?'},
            {id: 'history', icon: History, label: 'L?ch S?'}
        ].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex-1 flex flex-col items-center gap-1 transition-all ${activeTab === tab.id ? 'text-red-500 scale-110' : 'text-zinc-600'}`}>
                <tab.icon size={22} strokeWidth={activeTab === tab.id ? 3 : 2} />
                <span className="text-[9px] font-black uppercase tracking-tighter">{tab.label}</span>
            </button>
        ))}
      </nav>

      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #27272a; border-radius: 10px; }
        input[type="number"]::-webkit-inner-spin-button { display: none; }
        input[type="date"]::-webkit-calendar-picker-indicator { filter: invert(1); opacity: 0.5; }
      `}</style>
    </div>
  );
}
