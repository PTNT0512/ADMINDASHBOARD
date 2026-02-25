import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  TrendingUp, TrendingDown, Activity, 
  DollarSign, Coins, Sliders, ChevronUp, ChevronDown,
  Plus, Minus, RefreshCcw
} from 'lucide-react';

// --- HỆ THỐNG ÂM THANH ---
const SFX = {
  click: 'https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3',
  call:  'https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3',
  put:   'https://assets.mixkit.co/active_storage/sfx/2572/2572-preview.mp3',
  win:   'https://assets.mixkit.co/active_storage/sfx/2019/2019-preview.mp3',
  loss:  'https://assets.mixkit.co/active_storage/sfx/2003/2003-preview.mp3',
};

// --- CẤU HÌNH ---
const MAX_DATA_POINTS = 1000; // Tăng giới hạn để lưu lịch sử dài hơn
const TICK_INTERVAL = 100; 
const CANDLE_DURATION = 4000; 
const DEFAULT_DURATION = 10000; 
const BASE_PRICE = 2050.00; 
const CHART_WIDTH_PERCENT = 80; // Dành khoảng trống bên phải cho giá hiện tại

const TacticalTrade = () => {
  // --- STATE ---
  const [balance, setBalance] = useState(50000.00);
  const [betAmount, setBetAmount] = useState(100);
  const [duration, setDuration] = useState(DEFAULT_DURATION);
  const [currentPrice, setCurrentPrice] = useState(BASE_PRICE);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Điều khiển Viewport
  const [visiblePoints, setVisiblePoints] = useState(50); 
  const [scrollOffset, setScrollOffset] = useState(0); 

  const [fullPriceHistory, setFullPriceHistory] = useState([]);
  const [activeTrades, setActiveTrades] = useState([]); 
  const [history, setHistory] = useState([]); 
  const [isMuted, setIsMuted] = useState(false);
  const [notification, setNotification] = useState(null); 
  const [now, setNow] = useState(Date.now()); 
  
  const [isHistoryExpanded, setIsHistoryExpanded] = useState(false);
  const [isControlsExpanded, setIsControlsExpanded] = useState(true);

  // Refs cho tương tác kéo (Panning)
  const isDragging = useRef(false);
  const lastMouseX = useRef(0);
  const lastCandleTime = useRef(Date.now());
  const touchStartDist = useRef(null);
  const chartRef = useRef(null);

  // Lọc dữ liệu hiển thị dựa trên Zoom và Offset
  const priceHistory = useMemo(() => {
    if (fullPriceHistory.length === 0) return [];
    
    // Điểm kết thúc: nếu offset = 0 là nến mới nhất
    const endIndex = fullPriceHistory.length - scrollOffset;
    const startIndex = Math.max(0, endIndex - visiblePoints);
    
    return fullPriceHistory.slice(startIndex, endIndex);
  }, [fullPriceHistory, visiblePoints, scrollOffset]);

  const playSound = (type) => {
    if (isMuted) return;
    const audio = new Audio(SFX[type]);
    audio.volume = 0.4;
    audio.play().catch(() => {});
  };

  // --- LOGIC ĐIỀU KHIỂN BIỂU ĐỒ ---

  const handleZoom = (delta) => {
    setVisiblePoints(prev => {
      const next = prev + (delta > 0 ? 5 : -5);
      return Math.max(15, Math.min(next, 200));
    });
  };

  const handleWheel = (e) => {
    e.preventDefault();
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
        // Kéo ngang bằng chuột/trackpad
        setScrollOffset(prev => Math.max(0, Math.min(prev + (e.deltaX > 0 ? 1 : -1), fullPriceHistory.length - visiblePoints)));
    } else {
        // Phóng to thu nhỏ
        handleZoom(e.deltaY);
    }
  };

  const startDrag = (clientX) => {
    isDragging.current = true;
    lastMouseX.current = clientX;
  };

  const onDrag = (clientX) => {
    if (!isDragging.current || fullPriceHistory.length < 5) return;
    const deltaX = clientX - lastMouseX.current;
    
    if (Math.abs(deltaX) > 5) {
        const sensitivity = 0.5; // Điều chỉnh độ nhạy kéo
        const moveAmount = Math.round(deltaX * sensitivity);
        
        setScrollOffset(prev => {
            const next = prev + moveAmount;
            return Math.max(0, Math.min(next, fullPriceHistory.length - visiblePoints));
        });
        lastMouseX.current = clientX;
    }
  };

  const stopDrag = () => {
    isDragging.current = false;
  };

  const handleTouchMove = (e) => {
    if (e.touches.length === 2) {
      // Zoom cảm ứng
      const dist = Math.hypot(
        e.touches[0].pageX - e.touches[1].pageX,
        e.touches[0].pageY - e.touches[1].pageY
      );
      if (touchStartDist.current !== null) {
        const delta = dist - touchStartDist.current;
        if (Math.abs(delta) > 10) {
            handleZoom(delta > 0 ? -5 : 5);
            touchStartDist.current = dist;
        }
      } else {
        touchStartDist.current = dist;
      }
    } else if (e.touches.length === 1) {
        // Kéo cảm ứng
        onDrag(e.touches[0].clientX);
    }
  };

  // Game Loop
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
        
        if (newHistory.length === 0) {
            newHistory.push({ o: BASE_PRICE, h: BASE_PRICE, l: BASE_PRICE, c: BASE_PRICE, timestamp: currentTime });
            lastCandleTime.current = currentTime;
            return newHistory;
        }

        let lastIdx = newHistory.length - 1;
        if (shouldClose) {
            const lastCandle = newHistory[lastIdx];
            const newOpen = lastCandle.c;
            if (newHistory.length >= MAX_DATA_POINTS) newHistory.shift();
            newHistory.push({ o: newOpen, h: newOpen, l: newOpen, c: newOpen, timestamp: currentTime });
            lastIdx = newHistory.length - 1;
            lastCandleTime.current = currentTime;
            
            // Nếu đang ở nến mới nhất (offset=0), giữ màn hình bám đuổi theo nến mới
            // Ngược lại nếu đang xem lịch sử thì không tự nhảy
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
        setNotification("⚠️ KHÔNG ĐỦ TIỀN!");
        setTimeout(() => setNotification(null), 3000);
        return;
    }
    playSound(type === 'CALL' ? 'call' : 'put');
    setBalance(prev => prev - betAmount);
    setActiveTrades(prev => [...prev, {
        id: Date.now(), 
        type, 
        amount: betAmount, 
        entryPrice: currentPrice,
        startTime: Date.now(), 
        endTime: Date.now() + duration,
        totalDuration: duration
    }]);
  };

  const getMinMax = () => {
    if (priceHistory.length === 0) return { min: BASE_PRICE - 1, max: BASE_PRICE + 1, range: 2 };
    const allPrices = priceHistory.flatMap(p => [p.h, p.l]);
    const minVal = Math.min(...allPrices);
    const maxVal = Math.max(...allPrices);
    const padding = (maxVal - minVal) * 0.2 || 0.5;
    return { min: minVal - padding, max: maxVal + padding, range: (maxVal - minVal) + (padding * 2) || 1 };
  };

  const getPriceY = (price) => {
      const { min, range } = getMinMax();
      return 100 - ((price - min) / range) * 100;
  };

  const { min, max } = getMinMax();

  return (
    <div className="h-[100dvh] w-full bg-[#05070a] text-[#f3ba2f] font-sans flex flex-col overflow-hidden select-none relative">
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: rgba(243, 186, 47, 0.05); }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(243, 186, 47, 0.3); border-radius: 10px; }
      `}</style>

      {notification && (
          <div className="absolute top-16 left-1/2 -translate-x-1/2 z-50 bg-red-600/90 text-white px-4 py-2 rounded-lg font-bold shadow-xl animate-bounce">
              {notification}
          </div>
      )}

      {/* HEADER */}
      <div className="h-14 shrink-0 w-full bg-[#0d1017] border-b border-white/5 flex justify-between items-center px-4 z-30">
          <div className="flex items-center gap-3">
              <div className="p-1.5 bg-amber-500 rounded-lg">
                  <Coins size={18} className="text-black" />
              </div>
              <h1 className="text-base font-black italic text-white uppercase">XAU/USD</h1>
          </div>
          <div className="bg-[#11141b] px-3 py-1 rounded-lg border border-amber-500/20 flex flex-col items-end">
              <span className="text-base md:text-lg font-mono font-bold text-white">
                ${balance.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
              </span>
          </div>
      </div>

      {/* MAIN CONTENT */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden relative">
        {/* CHART AREA */}
        <div className="order-1 lg:order-2 flex-1 relative bg-[#0d1017] flex flex-col overflow-hidden lg:border-l border-white/5">
            
            {/* GIÁ HIỆN TẠI FLOAT */}
            <div className="absolute top-4 left-4 z-20 flex flex-col pointer-events-none">
                <span className="text-[10px] text-amber-500/60 font-bold uppercase tracking-widest">Live Market Price</span>
                <span className={`text-3xl md:text-5xl font-mono font-black ${isRefreshing ? 'text-white' : 'text-amber-500'}`}>
                    {currentPrice.toFixed(2)}
                </span>
            </div>

            {/* ĐIỀU KHIỂN BIỂU ĐỒ (ZOOM/PAN) */}
            <div className="absolute bottom-6 right-16 z-30 flex flex-col gap-2">
                {scrollOffset > 0 && (
                    <button 
                        onClick={() => setScrollOffset(0)}
                        className="p-2 bg-amber-500 text-black rounded-full shadow-lg hover:scale-110 transition-transform flex items-center gap-2 px-3"
                    >
                        <RefreshCcw size={16}/> <span className="text-[10px] font-bold">VỀ HIỆN TẠI</span>
                    </button>
                )}
                <div className="flex gap-2 bg-black/50 p-1 rounded-full border border-white/10 backdrop-blur-md">
                    <button onClick={() => handleZoom(-1)} className="p-2 hover:bg-white/10 rounded-full text-white"><Plus size={18}/></button>
                    <button onClick={() => handleZoom(1)} className="p-2 hover:bg-white/10 rounded-full text-white"><Minus size={18}/></button>
                </div>
            </div>

            {/* SVG CHART */}
            <div 
                ref={chartRef}
                className={`flex-1 w-full h-full touch-none ${isDragging.current ? 'cursor-grabbing' : 'cursor-grab'}`}
                onWheel={handleWheel}
                onMouseDown={(e) => startDrag(e.clientX)}
                onMouseMove={(e) => onDrag(e.clientX)}
                onMouseUp={stopDrag}
                onMouseLeave={stopDrag}
                onTouchStart={(e) => {
                    if (e.touches.length === 1) startDrag(e.touches[0].clientX);
                    else touchStartDist.current = null;
                }}
                onTouchMove={handleTouchMove}
                onTouchEnd={() => { stopDrag(); touchStartDist.current = null; }}
            >
                <div className="w-full h-full relative">
                    <svg className="w-full h-full" preserveAspectRatio="none" viewBox="0 0 100 100">
                        {/* Grid lines */}
                        {[0, 25, 50, 75, 100].map(lvl => (
                            <line key={lvl} x1="0" y1={lvl} x2="100" y2={lvl} stroke="#f3ba2f" strokeWidth="0.05" opacity="0.1" />
                        ))}

                        {/* Trade Entry Lines */}
                        {activeTrades.map(trade => {
                            const y = getPriceY(trade.entryPrice);
                            if (y < 0 || y > 100) return null;
                            const color = trade.type === 'CALL' ? '#10b981' : '#ef4444';
                            return (
                                <g key={trade.id}>
                                    <line x1="0" y1={y} x2="100" y2={y} stroke={color} strokeWidth="0.2" strokeDasharray="1 1" opacity="0.8" />
                                    <rect x="0" y={y - 1.5} width="18" height="3" fill={color} rx="1" opacity="0.8"/>
                                    <text x="2" y={y + 0.8} fontSize="1.8" fill="white" fontWeight="bold">{trade.type} ${trade.amount}</text>
                                </g>
                            );
                        })}

                        {/* Candles */}
                        {priceHistory.map((p, i) => {
                            const x = (i / Math.max(1, priceHistory.length)) * CHART_WIDTH_PERCENT;
                            const candleWidth = (CHART_WIDTH_PERCENT / Math.max(1, priceHistory.length)) * 0.7;
                            const isGreen = p.c >= p.o;
                            const color = isGreen ? '#10b981' : '#ef4444';
                            const openY = getPriceY(p.o);
                            const closeY = getPriceY(p.c);
                            const highY = getPriceY(p.h);
                            const lowY = getPriceY(p.l);

                            return (
                                <g key={i}>
                                    <line x1={x} y1={highY} x2={x} y2={lowY} stroke={color} strokeWidth="0.25" opacity="0.8"/>
                                    <rect 
                                        x={x - candleWidth/2} 
                                        y={Math.min(openY, closeY)} 
                                        width={candleWidth} 
                                        height={Math.max(0.3, Math.abs(openY - closeY))} 
                                        fill={color} 
                                        rx={candleWidth * 0.1}
                                    />
                                </g>
                            );
                        })}

                        {/* Current Price Line & Marker */}
                        {scrollOffset === 0 && (
                            <>
                                <line x1="0" y1={getPriceY(currentPrice)} x2="100" y2={getPriceY(currentPrice)} stroke="white" strokeWidth="0.1" strokeDasharray="2 2" opacity="0.4"/>
                                <circle cx={CHART_WIDTH_PERCENT} cy={getPriceY(currentPrice)} r="0.6" fill="white" className="animate-pulse" />
                            </>
                        )}
                    </svg>

                    {/* Price Axis Labels */}
                    <div className="absolute right-0 top-0 bottom-0 w-14 bg-black/40 border-l border-white/5 flex flex-col justify-between py-4 pointer-events-none backdrop-blur-sm">
                        {[0, 1, 2, 3, 4].map(i => (
                            <div key={i} className="text-[10px] font-mono text-amber-500/50 px-2 text-right">
                                {(max - (i * (max - min) / 4)).toFixed(1)}
                            </div>
                        ))}
                        {/* Current Price Label on Axis */}
                        <div className="absolute right-0 bg-white text-black px-1.5 py-0.5 text-[10px] font-bold z-30 shadow-lg" style={{ top: `${getPriceY(currentPrice)}%`, transform: 'translateY(-50%)' }}>
                            {currentPrice.toFixed(2)}
                        </div>
                    </div>
                </div>
            </div>
        </div>

        {/* SIDEBAR CONTROLS */}
        <div className="order-2 lg:order-1 w-full lg:w-[320px] bg-[#0d1017] border-t lg:border-t-0 lg:border-r border-white/5 flex flex-col z-20 shadow-2xl">
            <div onClick={() => setIsControlsExpanded(!isControlsExpanded)} className="px-4 py-3 bg-[#1a1d26] flex items-center justify-between border-b border-white/5 lg:cursor-default">
                <span className="text-[11px] font-black text-white uppercase flex items-center gap-2 tracking-widest"><Sliders size={14} className="text-amber-500"/> Thiết lập lệnh</span>
                <div className="lg:hidden">{isControlsExpanded ? <ChevronDown size={14}/> : <ChevronUp size={14}/>}</div>
            </div>

            <div className={`overflow-hidden transition-all duration-300 ${isControlsExpanded ? 'max-h-[500px]' : 'max-h-0'} lg:max-h-none`}>
                <div className="p-5 bg-[#13161f] space-y-6">
                     <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <label className="text-[10px] font-bold text-amber-500/60 uppercase tracking-widest">Tiền cược ($)</label>
                            <div className="flex gap-1.5">
                                {[50, 100, 500].map(amt => (
                                    <button key={amt} onClick={() => setBetAmount(amt)} className="text-[10px] bg-white/5 px-2.5 py-1 rounded-md text-white/50 hover:bg-amber-500 hover:text-black transition-all">${amt}</button>
                                ))}
                            </div>
                        </div>
                        <div className="relative">
                            <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-amber-500" size={18}/>
                            <input type="number" value={betAmount} onChange={(e) => setBetAmount(Number(e.target.value))} className="w-full bg-black/50 border border-white/10 text-white font-mono font-black text-2xl pl-12 p-4 rounded-xl focus:border-amber-500 focus:outline-none transition-colors shadow-inner"/>
                        </div>
                     </div>

                     <div className="space-y-3">
                        <label className="text-[10px] font-bold text-amber-500/60 uppercase tracking-widest">Thời gian kết thúc</label>
                        <div className="flex gap-2">
                            {[10, 30, 60, 120].map(sec => (
                                <button key={sec} onClick={() => setDuration(sec * 1000)} className={`flex-1 py-3 rounded-xl text-xs font-black border transition-all ${duration === sec * 1000 ? 'bg-amber-500 text-black border-amber-500 shadow-lg shadow-amber-500/20' : 'bg-black/40 text-white/40 border-white/10 hover:border-white/30'}`}>
                                    {sec >= 60 ? `${sec/60}m` : `${sec}s`}
                                </button>
                            ))}
                        </div>
                     </div>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4 p-5 border-b border-white/5 bg-[#0d1017]">
                <button onClick={() => handleTrade('CALL')} className="group relative h-20 bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-white rounded-2xl flex flex-col items-center justify-center transition-all shadow-[0_8px_20px_rgba(16,185,129,0.3)]">
                    <TrendingUp size={21} className="mb-1 group-hover:translate-y-[-2px] transition-transform" />
                    <span className="font-black uppercase italic text-[13px] tracking-tighter">MUA (Call)</span>
                </button>
                <button onClick={() => handleTrade('PUT')} className="group relative h-20 bg-red-500 hover:bg-red-400 active:scale-95 text-white rounded-2xl flex flex-col items-center justify-center transition-all shadow-[0_8px_20px_rgba(239,68,68,0.3)]">
                    <TrendingDown size={21} className="mb-1 group-hover:translate-y-[2px] transition-transform" />
                    <span className="font-black uppercase italic text-[13px] tracking-tighter">BÁN (Put)</span>
                </button>
            </div>

            <div className={`flex flex-col bg-[#0a0c10] transition-all duration-300 ${isHistoryExpanded ? 'flex-1 min-h-[250px]' : 'h-[140px] shrink-0'}`}>
                <div onClick={() => setIsHistoryExpanded(!isHistoryExpanded)} className="px-5 py-4 bg-white/5 flex items-center justify-between border-y border-white/5 cursor-pointer hover:bg-white/10 transition-colors">
                    <span className="text-[11px] font-black text-white/70 uppercase flex items-center gap-2 tracking-widest"><Activity size={14} className="text-amber-500"/> Lệnh đang chạy</span>
                    <div className="flex items-center gap-3">
                        <span className="bg-amber-500 text-black text-[10px] px-2 py-0.5 rounded-full font-black">{activeTrades.length}</span>
                        {isHistoryExpanded ? <ChevronDown size={16}/> : <ChevronUp size={16}/>}
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-3">
                    {activeTrades.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center opacity-20 py-4">
                            <Activity size={32} />
                            <span className="text-[10px] mt-2 font-bold uppercase tracking-widest">Sẵn sàng giao dịch</span>
                        </div>
                    ) : (
                        activeTrades.map(trade => (
                            <div key={trade.id} className="bg-[#141821] p-4 rounded-xl border border-white/5 relative overflow-hidden group">
                                <div className={`absolute left-0 top-0 bottom-0 w-1 ${trade.type==='CALL'?'bg-emerald-500':'bg-red-500'}`}></div>
                                <div className="flex justify-between items-center mb-2">
                                    <div className="flex flex-col">
                                        <span className={`text-xs font-black ${trade.type==='CALL'?'text-emerald-400':'text-red-400'}`}>{trade.type} ORDER</span>
                                        <span className="text-[9px] text-white/30 font-mono">ID: {String(trade.id).slice(-6)}</span>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-sm font-mono font-black text-white">{Math.max(0, Math.ceil((trade.endTime - now) / 1000))}s</div>
                                        <div className="w-16 h-1 bg-white/10 rounded-full mt-1 overflow-hidden">
                                            <div 
                                                className="h-full bg-amber-500 transition-all duration-1000" 
                                                style={{ width: `${(Math.max(0, trade.endTime - now) / trade.totalDuration) * 100}%` }}
                                            ></div>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex justify-between items-end">
                                    <div className="flex flex-col">
                                        <span className="text-[9px] text-white/40 uppercase font-bold">Giá vào</span>
                                        <span className="text-xs font-mono font-bold text-white">${trade.entryPrice.toFixed(2)}</span>
                                    </div>
                                    <div className="text-right">
                                        <span className="text-[9px] text-white/40 uppercase font-bold">Tiền cược</span>
                                        <span className="text-xs font-mono font-bold text-amber-500">${trade.amount}</span>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default TacticalTrade;