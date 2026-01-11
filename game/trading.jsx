import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Volume2, VolumeX, TrendingUp, TrendingDown, Activity, Clock, DollarSign, Target, ChevronLeft, Shield, AlertCircle, BarChart2, Coins, ZoomIn, ZoomOut, MousePointer2, Move, Timer } from 'lucide-react';

// --- HỆ THỐNG ÂM THANH ---
const SFX = {
  click: 'https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3',
  call:  'https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3',
  put:   'https://assets.mixkit.co/active_storage/sfx/2572/2572-preview.mp3',
  win:   'https://assets.mixkit.co/active_storage/sfx/2019/2019-preview.mp3',
  loss:  'https://assets.mixkit.co/active_storage/sfx/2003/2003-preview.mp3',
};

// --- CẤU HÌNH THỊ TRƯỜNG VÀNG (XAU/USD) ---
const MAX_DATA_POINTS = 300; 
const TICK_INTERVAL = 100; 
const CANDLE_DURATION = 4000; 
const EXPIRATION_TIME = 10000; 
const BASE_PRICE = 2050.00; 

const TacticalTrade = () => {
  // --- STATE ---
  const [balance, setBalance] = useState(50000.00);
  const [betAmount, setBetAmount] = useState(100);
  const [currentPrice, setCurrentPrice] = useState(BASE_PRICE);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  const [visiblePoints, setVisiblePoints] = useState(50); 
  const [scrollOffset, setScrollOffset] = useState(0); 

  const [fullPriceHistory, setFullPriceHistory] = useState(
    new Array(MAX_DATA_POINTS).fill(null).map((_, i) => ({ 
      o: BASE_PRICE, h: BASE_PRICE + 0.5, l: BASE_PRICE - 0.5, c: BASE_PRICE,
      timestamp: Date.now() - (MAX_DATA_POINTS - i) * CANDLE_DURATION
    }))
  );
  
  const [activeTrades, setActiveTrades] = useState([]); 
  const [history, setHistory] = useState([]); 
  const [isMuted, setIsMuted] = useState(false);
  const [notification, setNotification] = useState(null); 
  const [chartType, setChartType] = useState('CANDLE');
  const [now, setNow] = useState(Date.now()); 

  const lastCandleTime = useRef(Date.now());
  const touchStartDist = useRef(null);

  const priceHistory = useMemo(() => {
    const end = fullPriceHistory.length - scrollOffset;
    const start = Math.max(0, end - visiblePoints);
    return fullPriceHistory.slice(start, end);
  }, [fullPriceHistory, visiblePoints, scrollOffset]);

  const playSound = (type) => {
    if (isMuted) return;
    const audio = new Audio(SFX[type]);
    audio.volume = 0.4;
    audio.play().catch(() => {});
  };

  const handleWheel = (e) => {
    e.preventDefault();
    const zoomSpeed = 2;
    if (e.deltaY < 0) {
      setVisiblePoints(prev => Math.max(prev - zoomSpeed, 15));
    } else {
      setVisiblePoints(prev => Math.min(prev + zoomSpeed, MAX_DATA_POINTS));
    }
  };

  const handleTouchMove = (e) => {
    if (e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[0].pageX - e.touches[1].pageX,
        e.touches[0].pageY - e.touches[1].pageY
      );
      if (touchStartDist.current === null) {
        touchStartDist.current = dist;
      } else {
        const delta = dist - touchStartDist.current;
        if (Math.abs(delta) > 5) {
          if (delta > 0) setVisiblePoints(prev => Math.max(prev - 2, 15));
          else setVisiblePoints(prev => Math.min(prev + 2, MAX_DATA_POINTS));
          touchStartDist.current = dist;
        }
      }
    }
  };

  const handleTouchEnd = () => {
    touchStartDist.current = null;
  };

  useEffect(() => {
    const interval = setInterval(() => {
      const currentTime = Date.now();
      setNow(currentTime); 

      const shouldClose = currentTime - lastCandleTime.current >= CANDLE_DURATION;
      
      if (shouldClose) {
        setIsRefreshing(true);
        setTimeout(() => setIsRefreshing(false), 400);
      }

      setFullPriceHistory(prev => {
        const newHistory = [...prev];
        let lastIdx = newHistory.length - 1;
        if (shouldClose) {
            const lastCandle = newHistory[lastIdx];
            const newOpen = lastCandle.c;
            newHistory.shift();
            newHistory.push({ o: newOpen, h: newOpen, l: newOpen, c: newOpen, timestamp: currentTime });
            lastIdx = newHistory.length - 1;
            lastCandleTime.current = currentTime;
        }
        const candle = { ...newHistory[lastIdx] };
        const change = (Math.random() - 0.5) * 0.45; 
        const newClose = Number((candle.c + change).toFixed(2));
        candle.c = newClose;
        candle.h = Number(Math.max(candle.h, newClose + Math.random() * 0.2).toFixed(2));
        candle.l = Number(Math.min(candle.l, newClose - Math.random() * 0.2).toFixed(2));
        newHistory[lastIdx] = candle;
        setCurrentPrice(newClose);
        return newHistory;
      });

      setActiveTrades(prevTrades => {
        const remainingTrades = [];
        prevTrades.forEach(trade => {
          if (currentTime >= trade.endTime) {
            let isWin = (trade.type === 'CALL' && currentPrice > trade.entryPrice) ||
                        (trade.type === 'PUT' && currentPrice < trade.entryPrice);
            if (isWin) { setBalance(b => b + (trade.amount * 1.85)); playSound('win'); }
            else { playSound('loss'); }
            setHistory(h => [{ ...trade, exitPrice: currentPrice, isWin }, ...h].slice(0, 15));
          } else {
            remainingTrades.push(trade);
          }
        });
        return remainingTrades;
      });
    }, TICK_INTERVAL);
    return () => clearInterval(interval);
  }, [currentPrice]); 

  const handleTrade = (type) => {
    if (balance < betAmount) {
        setNotification("⚠️ KHÔNG ĐỦ KÝ QUỸ!");
        setTimeout(() => setNotification(null), 3000);
        return;
    }
    playSound(type === 'CALL' ? 'call' : 'put');
    setBalance(prev => prev - betAmount);
    setActiveTrades(prev => [...prev, {
        id: Date.now(), type, amount: betAmount, entryPrice: currentPrice,
        startTime: Date.now(), endTime: Date.now() + EXPIRATION_TIME,
    }]);
  };

  const getMinMax = () => {
    const allPrices = priceHistory.flatMap(p => [p.h, p.l]);
    const min = Math.min(...allPrices) - 0.5;
    const max = Math.max(...allPrices) + 0.5;
    return { min, max, range: max - min || 1 };
  };

  const getPriceY = (price) => {
      const { min, range } = getMinMax();
      return 100 - ((price - min) / range) * 100;
  };

  const { min, max } = getMinMax();

  return (
    <div className="min-h-screen bg-[#05070a] text-[#f3ba2f] font-sans flex flex-col items-center justify-center p-0 md:p-4 overflow-hidden select-none relative">
      
      {/* CUSTOM SCROLLBAR CSS */}
      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(243, 186, 47, 0.05);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(243, 186, 47, 0.3);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(243, 186, 47, 0.5);
        }
      `}</style>

      {/* HEADER */}
      <div className="w-full max-w-[1300px] flex justify-between items-center mb-4 z-20 px-6">
          <div className="flex items-center gap-4">
              <div className="p-2 bg-amber-500 rounded-lg">
                  <Coins size={20} className="text-black" />
              </div>
              <div>
                <h1 className="text-xl font-black italic text-white uppercase tracking-tighter">XAU/USD <span className="text-amber-500">PRO</span></h1>
                <div className="text-[9px] text-amber-500/50 font-bold tracking-widest flex items-center gap-1">
                    <Activity size={10} /> LIVE MARKET DATA
                </div>
              </div>
          </div>
          <div className="bg-[#11141b] px-5 py-1.5 rounded-xl border border-amber-500/20 flex flex-col items-end shadow-lg shadow-black/50">
              <span className="text-[8px] text-amber-500/50 font-bold uppercase">Tài khoản thực</span>
              <span className="text-xl font-mono font-bold text-white tracking-tight">${balance.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
          </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-4 w-full max-w-[1300px] h-[750px] z-10 px-4 md:px-0">
        
        {/* PANEL TRÁI */}
        <div className="w-full lg:w-[320px] bg-[#0d1017] rounded-2xl border border-amber-500/10 flex flex-col p-5 shadow-2xl">
            <div className="space-y-4 flex flex-col h-full">
                <div className="space-y-2">
                    <label className="text-[10px] font-bold text-amber-500/40 uppercase tracking-widest px-1">Ký quỹ (Amount)</label>
                    <div className="relative group">
                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-amber-500/40" size={16}/>
                        <input 
                            type="number" 
                            value={betAmount} 
                            onChange={(e) => setBetAmount(Number(e.target.value))}
                            className="bg-black border border-amber-500/20 text-white font-mono font-bold text-xl w-full pl-10 p-3 rounded-xl focus:outline-none focus:border-amber-500/50 transition-colors"
                        />
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <button onClick={() => handleTrade('CALL')} className="h-20 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl flex flex-col items-center justify-center transition-all active:scale-95 shadow-lg shadow-emerald-900/20">
                        <TrendingUp size={24} />
                        <span className="font-black uppercase italic text-[11px] mt-1 tracking-wider">MUA (CALL)</span>
                    </button>
                    <button onClick={() => handleTrade('PUT')} className="h-20 bg-red-500 hover:bg-red-600 text-white rounded-xl flex flex-col items-center justify-center transition-all active:scale-95 shadow-lg shadow-red-900/20">
                        <TrendingDown size={24} />
                        <span className="font-black uppercase italic text-[11px] mt-1 tracking-wider">BÁN (PUT)</span>
                    </button>
                </div>

                <div className="flex-1 overflow-hidden flex flex-col gap-6 pt-2">
                    {/* LỆNH ĐANG MỞ */}
                    <div className="flex flex-col min-h-0">
                        <div className="flex justify-between items-center mb-2 px-1">
                            <span className="text-[10px] font-bold text-amber-500/60 uppercase flex items-center gap-1.5">
                                <Timer size={12}/> Đang chạy
                            </span>
                            <span className="bg-amber-500/10 text-amber-500 text-[10px] font-bold px-1.5 py-0.5 rounded">
                                {activeTrades.length}
                            </span>
                        </div>
                        <div className="custom-scrollbar overflow-y-auto space-y-2 pr-2 max-h-[160px]">
                            {activeTrades.length === 0 && (
                                <div className="text-[10px] italic text-white/10 text-center py-4 bg-white/[0.02] rounded-lg border border-dashed border-white/5">
                                    Không có lệnh đang mở
                                </div>
                            )}
                            {activeTrades.map(trade => {
                                const timeLeft = Math.max(0, Math.ceil((trade.endTime - now) / 1000));
                                return (
                                    <div key={trade.id} className="flex items-center justify-between p-3 rounded-xl bg-[#141821] border border-white/5 group hover:border-amber-500/30 transition-all duration-300">
                                        <div className="flex flex-col">
                                            <span className={`text-[11px] font-black tracking-tight ${trade.type === 'CALL' ? 'text-emerald-400' : 'text-red-400'}`}>{trade.type}</span>
                                            <span className="text-[10px] font-mono text-white/40">Ký quỹ: ${trade.amount}</span>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-[12px] font-mono font-bold text-white flex items-center justify-end gap-1">
                                                {timeLeft}s <Clock size={10} className="text-amber-500"/>
                                            </div>
                                            <div className="w-14 h-1 bg-white/5 rounded-full mt-1.5 overflow-hidden">
                                                <div 
                                                    className={`h-full ${timeLeft < 3 ? 'bg-red-500 animate-pulse' : 'bg-amber-500'} transition-all duration-300`} 
                                                    style={{ width: `${(timeLeft / (EXPIRATION_TIME/1000)) * 100}%` }}
                                                ></div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* LỊCH SỬ LỆNH */}
                    <div className="flex flex-col flex-1 min-h-0">
                        <span className="text-[10px] font-bold text-white/30 uppercase mb-3 px-1 flex items-center gap-1.5 tracking-widest">
                            <Clock size={12}/> Lịch sử khớp lệnh
                        </span>
                        <div className="custom-scrollbar flex-1 overflow-y-auto space-y-2 pr-2">
                            {history.length === 0 && <div className="text-[10px] text-center text-white/10 mt-10 tracking-widest">CHƯA CÓ DỮ LIỆU</div>}
                            {history.map(h => (
                                <div key={h.id} className={`flex justify-between items-center p-3 rounded-xl border ${h.isWin ? 'bg-emerald-500/5 border-emerald-500/10' : 'bg-red-500/5 border-red-500/10'} hover:scale-[1.02] transition-transform cursor-default`}>
                                    <div className="flex flex-col">
                                        <div className="flex items-center gap-2">
                                            <span className={`text-[11px] font-black ${h.type === 'CALL' ? 'text-emerald-400' : 'text-red-400'}`}>{h.type}</span>
                                            <span className={`text-[8px] font-bold px-1 rounded ${h.isWin ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                                                {h.isWin ? 'PROFIT' : 'LOSS'}
                                            </span>
                                        </div>
                                        <span className="text-[9px] font-mono text-white/30 mt-0.5">{new Date(h.id).toLocaleTimeString()}</span>
                                    </div>
                                    <div className="flex flex-col items-end">
                                        <span className={`text-[12px] font-mono font-bold ${h.isWin ? 'text-emerald-400' : 'text-red-400'}`}>
                                            {h.isWin ? '+' : '-'}${h.isWin ? (h.amount * 0.85).toFixed(1) : h.amount}
                                        </span>
                                        <span className="text-[8px] font-mono text-white/20">Strike: {h.entryPrice}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>

        {/* CHART AREA */}
        <div className="flex-1 bg-[#0d1017] rounded-2xl p-0 relative border border-amber-500/10 flex flex-col overflow-hidden shadow-2xl">
            
            <div className="p-4 flex justify-between items-center bg-black/20 border-b border-amber-500/5">
                <div className="flex flex-col">
                    <span className="text-[10px] text-amber-500/40 font-bold uppercase tracking-widest text-white/60">GOLD / USD (Real-time)</span>
                    <span className="text-4xl font-mono font-black text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.1)]">{currentPrice.toFixed(2)}</span>
                </div>
                <div className="flex items-center gap-3 bg-black/40 px-3 py-2 rounded-lg border border-white/5">
                    <div className="flex flex-col items-end">
                        <span className="text-[8px] text-amber-500/40 uppercase font-bold tracking-widest">Zoom Level</span>
                        <span className="text-[10px] font-mono text-amber-500 font-bold">{Math.round((MAX_DATA_POINTS/visiblePoints)*100)}%</span>
                    </div>
                    <div className="w-px h-6 bg-white/10"></div>
                    <div className="text-amber-500/30">
                        <MousePointer2 size={16} />
                    </div>
                </div>
            </div>

            <div 
                className="flex-1 flex overflow-hidden relative cursor-crosshair touch-none"
                onWheel={handleWheel}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
            >
                <div className="flex-1 relative m-4 mr-16 mb-12">
                    <svg className="w-full h-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 100 100">
                        {[0, 25, 50, 75, 100].map(lvl => (
                            <line key={lvl} x1="0" y1={lvl} x2="100" y2={lvl} stroke="#f3ba2f" strokeWidth="0.03" opacity="0.1" />
                        ))}

                        {activeTrades.map(trade => {
                            const y = getPriceY(trade.entryPrice);
                            const color = trade.type === 'CALL' ? '#10b981' : '#ef4444';
                            return (
                                <g key={trade.id} className="animate-in fade-in">
                                    <line x1="-10" y1={y} x2="110" y2={y} stroke={color} strokeWidth="0.2" strokeDasharray="1.5 1.5" />
                                    <rect x="-2" y={y - 1.5} width="12" height="3" fill={color} rx="0.5" />
                                    <text x="4" y={y + 0.8} fontSize="2.2" fill="white" fontWeight="black" textAnchor="middle">
                                        {trade.type}
                                    </text>
                                </g>
                            );
                        })}

                        {priceHistory.map((p, i) => {
                            const x = (i / (priceHistory.length - 1)) * 100;
                            const candleWidth = (100 / priceHistory.length) * 0.7;
                            const isGreen = p.c >= p.o;
                            const color = isGreen ? '#10b981' : '#ef4444';
                            const openY = getPriceY(p.o);
                            const closeY = getPriceY(p.c);
                            const highY = getPriceY(p.h);
                            const lowY = getPriceY(p.l);

                            return (
                                <g key={i}>
                                    <line x1={x} y1={highY} x2={x} y2={lowY} stroke={color} strokeWidth="0.3" />
                                    <rect x={x - candleWidth/2} y={Math.min(openY, closeY)} width={candleWidth} height={Math.max(0.4, Math.abs(openY - closeY))} fill={color} />
                                </g>
                            );
                        })}

                        <line x1="0" y1={getPriceY(currentPrice)} x2="100" y2={getPriceY(currentPrice)} stroke="white" strokeWidth="0.1" strokeDasharray="1 2" opacity="0.5"/>
                    </svg>

                    <div className="absolute -bottom-8 left-0 right-0 h-8 flex justify-between px-1 border-t border-amber-500/10">
                        {priceHistory.filter((_, i) => i % Math.ceil(priceHistory.length/6) === 0).map((p, i) => (
                            <div key={i} className="text-[8px] font-mono text-amber-500/30 pt-2 uppercase">
                                {new Date(p.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                            </div>
                        ))}
                    </div>
                </div>

                <div className="w-16 h-full bg-black/20 border-l border-amber-500/5 relative flex flex-col justify-between py-4">
                    {[0, 1, 2, 3, 4].map(i => {
                        const priceLevel = max - (i * (max - min) / 4);
                        return (
                            <div key={i} className="text-[9px] font-mono font-bold text-amber-500/40 px-2">
                                {priceLevel.toFixed(2)}
                            </div>
                        );
                    })}
                    <div 
                        className="absolute right-0 bg-white text-black px-1.5 py-0.5 text-[10px] font-black z-30 shadow-lg transition-all duration-100"
                        style={{ top: `${getPriceY(currentPrice)}%`, transform: 'translateY(-50%)' }}
                    >
                        {currentPrice.toFixed(2)}
                    </div>
                </div>
            </div>

            <div className="px-6 py-2 bg-amber-500/5 border-t border-amber-500/10 flex justify-between items-center">
                <div className="flex items-center gap-4 text-[9px] font-bold text-amber-500/40 tracking-wider">
                    <span className="flex items-center gap-1.5 text-emerald-500"><Target size={10}/> CALL: PROFIT UP</span>
                    <span className="flex items-center gap-1.5 text-red-500"><Target size={10}/> PUT: PROFIT DOWN</span>
                </div>
                <div className="text-[9px] font-black text-amber-500/60 uppercase italic">
                    Binary Options Elite Simulator
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default TacticalTrade;