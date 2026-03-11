import React, { useState, useEffect, useRef, useMemo } from 'react';
import {

  TrendingUp, TrendingDown, Activity, 
  DollarSign, Coins, Sliders, ChevronUp, ChevronDown,
  Plus, Minus, RefreshCcw
} from 'lucide-react';
import { bootstrapGameAuth } from './authBootstrap';
import { refreshWinRates } from './winRateControl';
import { getSharedGameSocket } from './socketClient';

// --- H? TH?NG ?M THANH ---
const SFX = {
  click: 'https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3',
  call:  'https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3',
  put:   'https://assets.mixkit.co/active_storage/sfx/2572/2572-preview.mp3',
  win:   'https://assets.mixkit.co/active_storage/sfx/2019/2019-preview.mp3',
  loss:  'https://assets.mixkit.co/active_storage/sfx/2003/2003-preview.mp3',
};

// --- C?U H?NH ---
const MAX_DATA_POINTS = 1000; // Tang gi?i h?n d? luu l?ch s? d?i hon
const TICK_INTERVAL = 100; 
const ORDER_DURATION_MS = 60000;
const CHART_WIDTH_PERCENT = 80; // D?nh kho?ng tr?ng b?n ph?i cho gi? hi?n t?i
const MARKETS = [
  { id: 'okcoin', symbol: 'OK COIN', name: 'OK COIN', basePrice: 100.0, volatility: 0.9, precision: 2 },
];
const DEFAULT_MARKET_ID = MARKETS[0].id;
const DEFAULT_MARKET = MARKETS[0];
const BASE_PRICE = DEFAULT_MARKET.basePrice;
const SNAPSHOT_HISTORY_LIMIT = 420;

const resolveGameApiBase = () => {
  if (typeof window !== 'undefined') {
    const fromWindow = window.GAME_API_URL || window.API_BASE_URL || window.SOCKET_API_URL;
    if (typeof fromWindow === 'string' && fromWindow.trim()) {
      return fromWindow.trim().replace(/\/+$/, '');
    }
  }
  return 'http://localhost:4001';
};

const GAME_API_BASE = resolveGameApiBase();
const GAME_SESSION_STORAGE_KEY = 'gameSessionToken';

const readGameSessionToken = () => {
  try {
    return String(localStorage.getItem(GAME_SESSION_STORAGE_KEY) || '').trim();
  } catch (_) {
    return '';
  }
};

const createInitialMarketTicker = () =>
  MARKETS.reduce((acc, market) => {
    acc[market.id] = {
      price: market.basePrice,
      change: 0,
      changePct: 0,
    };
    return acc;
  }, {});

const normalizeCandle = (raw, fallbackPrice = BASE_PRICE, precision = 2, fallbackTimestamp = Date.now()) => {
  const safeFallback = Number.isFinite(Number(fallbackPrice)) ? Number(fallbackPrice) : BASE_PRICE;
  const open = Number.isFinite(Number(raw?.o)) ? Number(raw.o) : safeFallback;
  const close = Number.isFinite(Number(raw?.c)) ? Number(raw.c) : open;
  const high = Number.isFinite(Number(raw?.h)) ? Number(raw.h) : Math.max(open, close);
  const low = Number.isFinite(Number(raw?.l)) ? Number(raw.l) : Math.min(open, close);
  const timestampRaw = Number(raw?.timestamp || fallbackTimestamp);
  const timestamp = Number.isFinite(timestampRaw) && timestampRaw > 0 ? Math.floor(timestampRaw) : Date.now();
  const digits = Math.max(0, Math.min(8, Number(precision || 2)));
  return {
    o: Number(open.toFixed(digits)),
    h: Number(Math.max(high, open, close).toFixed(digits)),
    l: Number(Math.min(low, open, close).toFixed(digits)),
    c: Number(close.toFixed(digits)),
    timestamp,
  };
};

const mergeLatestCandle = (history = [], latest, market) => {
  if (!latest || !market) return history;
  const normalized = normalizeCandle(latest, market.basePrice, market.precision);
  const source = Array.isArray(history) ? history : [];
  if (source.length === 0) return [normalized];
  const last = source[source.length - 1];
  if (Number(last?.timestamp || 0) === Number(normalized.timestamp || 0)) {
    const clone = source.slice();
    clone[clone.length - 1] = normalized;
    return clone;
  }
  if (Number(last?.timestamp || 0) > Number(normalized.timestamp || 0)) {
    return source;
  }
  const appended = [...source, normalized];
  if (appended.length > MAX_DATA_POINTS) {
    return appended.slice(appended.length - MAX_DATA_POINTS);
  }
  return appended;
};

const TacticalTrade = () => {
  // --- STATE ---
  const [balance, setBalance] = useState(50000.00);
  useEffect(() => {
    bootstrapGameAuth({
      onBalance: setBalance,
    }).catch((error) => console.error('Game auth bootstrap failed:', error));
    refreshWinRates().catch(() => {});
  }, []);
  const [betAmount, setBetAmount] = useState(100);
  const duration = ORDER_DURATION_MS;
  const [currentPrice, setCurrentPrice] = useState(BASE_PRICE);
  const [selectedMarketId] = useState(DEFAULT_MARKET_ID);
  const [marketTicker, setMarketTicker] = useState(() => createInitialMarketTicker());
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // ?i?u khi?n Viewport
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
  const selectedMarket = useMemo(
    () => MARKETS.find((market) => market.id === selectedMarketId) || DEFAULT_MARKET,
    [selectedMarketId],
  );

  // Refs cho tuong t?c k?o (Panning)
  const isDragging = useRef(false);
  const lastMouseX = useRef(0);
  const touchStartDist = useRef(null);
  const chartRef = useRef(null);
  const socketRef = useRef(null);
  const currentPriceRef = useRef(currentPrice);
  const marketHistoriesRef = useRef(new Map());
  const lastRenderedCandleTsRef = useRef(0);
  const resolvingOrderIdsRef = useRef(new Set());

  useEffect(() => {
    currentPriceRef.current = currentPrice;
  }, [currentPrice]);

  // L?c d? li?u hi?n th? d?a tr?n Zoom v? Offset
  const priceHistory = useMemo(() => {
    if (fullPriceHistory.length === 0) return [];
    
    // ?i?m k?t th?c: n?u offset = 0 l? n?n m?i nh?t
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

  const formatPriceByMarket = (value, market = selectedMarket) => {
    const precision = market?.precision ?? 2;
    return Number(value || 0).toLocaleString('en-US', {
      minimumFractionDigits: precision,
      maximumFractionDigits: precision,
    });
  };

  // --- LOGIC ?I?U KHI?N BI?U ?? ---

  const handleZoom = (delta) => {
    setVisiblePoints(prev => {
      const next = prev + (delta > 0 ? 5 : -5);
      return Math.max(15, Math.min(next, 200));
    });
  };

  const handleWheel = (e) => {
    if (e.cancelable) {
      e.preventDefault();
    }
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
        // K?o ngang b?ng chu?t/trackpad
        setScrollOffset(prev => Math.max(0, Math.min(prev + (e.deltaX > 0 ? 1 : -1), fullPriceHistory.length - visiblePoints)));
    } else {
        // Ph?ng to thu nh?
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
        const sensitivity = 0.5; // ?i?u ch?nh d? nh?y k?o
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
      // Zoom c?m ?ng
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
        // K?o c?m ?ng
        onDrag(e.touches[0].clientX);
    }
  };

  // Market stream from server (stable across refresh)
  useEffect(() => {
    let isMounted = true;
    let refreshTimer = null;

    const triggerRefreshPulse = (timestamp) => {
      const ts = Number(timestamp || 0);
      if (!Number.isFinite(ts) || ts <= 0) return;
      if (lastRenderedCandleTsRef.current === 0) {
        lastRenderedCandleTsRef.current = ts;
        return;
      }
      if (ts === lastRenderedCandleTsRef.current) return;
      lastRenderedCandleTsRef.current = ts;
      setIsRefreshing(true);
      if (refreshTimer) clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => setIsRefreshing(false), 420);
    };

    const mergeTicker = (incoming = {}) => {
      if (!incoming || typeof incoming !== 'object') return;
      setMarketTicker((prev) => {
        const next = { ...prev };
        for (const market of MARKETS) {
          const row = incoming[market.id];
          if (!row) continue;
          next[market.id] = {
            price: Number(row.price ?? next[market.id]?.price ?? market.basePrice),
            change: Number(row.change ?? next[market.id]?.change ?? 0),
            changePct: Number(row.changePct ?? next[market.id]?.changePct ?? 0),
          };
        }
        return next;
      });
    };

    const applySnapshot = (snapshot = {}) => {
      if (!isMounted || !snapshot || typeof snapshot !== 'object') return;
      mergeTicker(snapshot.markets || {});

      const historyByMarket = snapshot.historyByMarket || {};
      for (const market of MARKETS) {
        const source = Array.isArray(historyByMarket[market.id]) ? historyByMarket[market.id] : null;
        if (source && source.length > 0) {
          const normalized = source
            .slice(-MAX_DATA_POINTS)
            .map((item) => normalizeCandle(item, market.basePrice, market.precision))
            .sort((a, b) => Number(a.timestamp || 0) - Number(b.timestamp || 0));
          if (normalized.length > 0) {
            marketHistoriesRef.current.set(market.id, normalized);
            continue;
          }
        }
        if (!marketHistoriesRef.current.has(market.id)) {
          const fallbackPrice = Number(snapshot?.markets?.[market.id]?.price ?? market.basePrice);
          marketHistoriesRef.current.set(market.id, [
            normalizeCandle(null, fallbackPrice, market.precision, Date.now()),
          ]);
        }
      }

      const selectedId = selectedMarketId;
      const selectedHistory = marketHistoriesRef.current.get(selectedId) || [];
      if (selectedHistory.length > 0) {
        const nextHistory = selectedHistory.slice(-MAX_DATA_POINTS);
        const latest = nextHistory[nextHistory.length - 1];
        setFullPriceHistory(nextHistory);
        setCurrentPrice(Number(latest?.c || BASE_PRICE));
        triggerRefreshPulse(latest?.timestamp);
      }
    };

    const applyUpdate = (payload = {}) => {
      if (!isMounted || !payload || typeof payload !== 'object') return;
      mergeTicker(payload.markets || {});

      const latestCandles = payload.latestCandles || {};
      const selectedId = selectedMarketId;
      let selectedHistoryChanged = false;
      let nextSelectedPrice = null;
      let nextSelectedTs = null;

      for (const market of MARKETS) {
        const latest = latestCandles[market.id];
        if (!latest) continue;
        const previous = marketHistoriesRef.current.get(market.id) || [];
        const merged = mergeLatestCandle(previous, latest, market);
        marketHistoriesRef.current.set(market.id, merged);
        if (market.id === selectedId) {
          selectedHistoryChanged = true;
          const last = merged[merged.length - 1];
          nextSelectedPrice = Number(last?.c || market.basePrice);
          nextSelectedTs = Number(last?.timestamp || 0);
          setFullPriceHistory(merged.slice(-MAX_DATA_POINTS));
        }
      }

      if (selectedHistoryChanged && Number.isFinite(nextSelectedPrice)) {
        setCurrentPrice(nextSelectedPrice);
        triggerRefreshPulse(nextSelectedTs);
        return;
      }

      const fallbackPrice = Number(payload?.markets?.[selectedId]?.price);
      if (Number.isFinite(fallbackPrice) && fallbackPrice > 0) {
        setCurrentPrice(fallbackPrice);
      }
    };

    const fetchSnapshot = async () => {
      try {
        const response = await fetch(`${GAME_API_BASE}/api/game/trading-market-snapshot?limit=${SNAPSHOT_HISTORY_LIMIT}`);
        if (!response.ok) return;
        const data = await response.json();
        if (data?.success && data?.data) {
          applySnapshot(data.data);
        }
      } catch (error) {
        console.warn('[Trading] Snapshot fetch failed:', error?.message || error);
      }
    };

    const socket = getSharedGameSocket(GAME_API_BASE);
    socketRef.current = socket;

    const requestSnapshotViaSocket = () => {
      socket.emit('trading_market:request_snapshot', { limit: SNAPSHOT_HISTORY_LIMIT }, (response) => {
        if (!isMounted) return;
        if (response?.success && response?.data) {
          applySnapshot(response.data);
        }
      });
    };

    const onConnect = () => requestSnapshotViaSocket();
    const onSnapshot = (payload) => applySnapshot(payload || {});
    const onUpdate = (payload) => applyUpdate(payload || {});

    socket.on('connect', onConnect);
    socket.on('trading_market_snapshot', onSnapshot);
    socket.on('trading_market_update', onUpdate);

    fetchSnapshot();
    if (socket.connected) requestSnapshotViaSocket();

    return () => {
      isMounted = false;
      if (refreshTimer) clearTimeout(refreshTimer);
      socket.off('connect', onConnect);
      socket.off('trading_market_snapshot', onSnapshot);
      socket.off('trading_market_update', onUpdate);
    };
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Date.now());
    }, TICK_INTERVAL);
    return () => clearInterval(interval);
  }, []);

  const resolveTradeOrder = async (trade) => {
    const orderId = String(trade?.orderId || trade?.id || '').trim();
    if (!orderId) return;
    if (resolvingOrderIdsRef.current.has(orderId)) return;
    resolvingOrderIdsRef.current.add(orderId);

    try {
      const sessionToken = readGameSessionToken();
      if (!sessionToken) {
        throw new Error('Phien dang nhap het han');
      }

      const response = await fetch(`${GAME_API_BASE}/api/game/trading-order/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionToken,
          orderId,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.success) {
        throw new Error(data?.message || data?.error || 'Khong the xu ly ket qua lenh');
      }

      const settledOrder = data?.data?.order || {};
      const isWin = settledOrder?.isWin === true;
      const exitPrice = Number(settledOrder?.exitPrice || currentPriceRef.current);
      const nextBalance = Number(data?.data?.newBalance);

      if (Number.isFinite(nextBalance)) {
        setBalance(nextBalance);
      }

      if (isWin) {
        playSound('win');
      } else {
        playSound('loss');
      }

      setHistory((h) => [{
        ...trade,
        orderId,
        exitPrice,
        isWin,
      }, ...h].slice(0, 15));
      setActiveTrades((prevTrades) => prevTrades.filter((item) => String(item?.orderId || item?.id || '') !== orderId));
    } catch (error) {
      const msg = String(error?.message || 'Khong the xu ly lenh').toLowerCase();
      if (msg.includes('khong tim thay lenh') || msg.includes('ban khong co quyen')) {
        setActiveTrades((prevTrades) => prevTrades.filter((item) => String(item?.orderId || item?.id || '') !== orderId));
      }
    } finally {
      resolvingOrderIdsRef.current.delete(orderId);
    }
  };

  useEffect(() => {
    if (!Array.isArray(activeTrades) || activeTrades.length === 0) return;
    activeTrades.forEach((trade) => {
      if (now >= Number(trade?.endTime || 0)) {
        resolveTradeOrder(trade);
      }
    });
  }, [now, activeTrades]);

  const handleTrade = async (type) => {
    const side = String(type || '').toUpperCase() === 'PUT' ? 'PUT' : 'CALL';
    const amount = Math.max(1, Math.floor(Number(betAmount) || 0));
    if (amount <= 0) {
      setNotification('So tien lenh khong hop le');
      setTimeout(() => setNotification(null), 3000);
      return;
    }
    if (balance < amount) {
      setNotification('KHONG DU SO DU');
      setTimeout(() => setNotification(null), 3000);
      return;
    }

    try {
      const sessionToken = readGameSessionToken();
      if (!sessionToken) {
        throw new Error('Phien dang nhap game da het han');
      }

      const response = await fetch(`${GAME_API_BASE}/api/game/trading-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionToken,
          side,
          amount,
          durationMs: duration,
          marketId: selectedMarket.id,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.success) {
        throw new Error(data?.message || data?.error || 'Khong the dat lenh');
      }

      const order = data?.data?.order || {};
      const newBalance = Number(data?.data?.newBalance);
      if (Number.isFinite(newBalance)) {
        setBalance(newBalance);
      }

      playSound(side === 'CALL' ? 'call' : 'put');
      setActiveTrades((prev) => [...prev, {
        id: String(order?.orderId || Date.now()),
        orderId: String(order?.orderId || ''),
        type: side,
        amount: Number(order?.amount || amount),
        entryPrice: Number(order?.entryPrice || currentPrice),
        marketId: order?.marketId || selectedMarket.id,
        marketSymbol: order?.marketSymbol || selectedMarket.symbol,
        precision: selectedMarket.precision,
        startTime: Number(order?.createdAt || Date.now()),
        endTime: Number(order?.endTime || (Date.now() + duration)),
        totalDuration: Number(order?.durationMs || duration),
      }]);
    } catch (error) {
      setNotification(String(error?.message || 'Khong the dat lenh'));
      setTimeout(() => setNotification(null), 3000);
    }
  };

  const getMinMax = () => {
    if (priceHistory.length === 0) {
      const base = Number(selectedMarket?.basePrice || BASE_PRICE);
      return { min: base - 1, max: base + 1, range: 2 };
    }
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
  const selectedTicker = marketTicker[selectedMarketId] || {
    price: selectedMarket.basePrice,
    change: 0,
    changePct: 0,
  };
  const isTickerUp = Number(selectedTicker.change || 0) >= 0;

  return (
    <div
      className="h-[100dvh] w-full max-w-[430px] mx-auto bg-[#05070a] text-[#f3ba2f] font-sans flex flex-col overflow-hidden select-none relative"
      style={{
        paddingTop: 'max(0.2rem, env(safe-area-inset-top))',
        paddingBottom: 'max(0.2rem, env(safe-area-inset-bottom))',
        paddingLeft: 'max(0.2rem, env(safe-area-inset-left))',
        paddingRight: 'max(0.2rem, env(safe-area-inset-right))',
      }}
    >
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
      <div className="h-14 shrink-0 w-full bg-[#0d1017] border-b border-white/5 flex justify-between items-center px-3 z-30">
          <div className="flex items-center gap-3">
              <div className="p-1.5 bg-amber-500 rounded-lg">
                  <Coins size={18} className="text-black" />
              </div>
              <div className="flex flex-col leading-none">
                <h1 className="text-base font-black italic text-white uppercase">{selectedMarket.symbol}</h1>
                <span className="text-[9px] text-white/40 font-bold uppercase tracking-wider">{selectedMarket.name}</span>
              </div>
          </div>
          <div className="bg-[#11141b] px-3 py-1 rounded-lg border border-amber-500/20 flex flex-col items-end">
              <span className="text-base md:text-lg font-mono font-bold text-white">
                ${balance.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
              </span>
          </div>
      </div>

      {/* MAIN CONTENT */}
      <div className="flex-1 flex flex-col overflow-hidden relative gap-2">
        {/* CHART AREA */}
        <div className="order-1 h-[44dvh] min-h-[300px] max-h-[430px] relative bg-[#0d1017] flex flex-col overflow-hidden rounded-xl border border-white/5">
            
            {/* GIA HIEN TAI FLOAT */}
            <div className="absolute top-3 left-3 z-20 flex flex-col pointer-events-none">
                <span className="text-[10px] text-amber-500/60 font-bold uppercase tracking-widest">Live Market Price</span>
                <span className={`text-[clamp(1.7rem,7.5vw,2.6rem)] font-mono font-black ${isRefreshing ? 'text-white' : 'text-amber-500'}`}>
                    {formatPriceByMarket(currentPrice)}
                </span>
            </div>

            {/* DIEU KHIEN BIEU DO (ZOOM/PAN) */}
            <div className="absolute bottom-3 right-12 z-30 flex flex-col gap-2">
                {scrollOffset > 0 && (
                    <button 
                        onClick={() => setScrollOffset(0)}
                        className="p-2 bg-amber-500 text-black rounded-full shadow-lg transition-transform flex items-center gap-2 px-3"
                    >
                        <RefreshCcw size={16}/> <span className="text-[10px] font-bold">VE HIEN TAI</span>
                    </button>
                )}
                <div className="flex gap-1 bg-black/50 p-1 rounded-full border border-white/10 backdrop-blur-md">
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
                    <div className="absolute right-0 top-0 bottom-0 w-12 bg-black/40 border-l border-white/5 flex flex-col justify-between py-4 pointer-events-none backdrop-blur-sm">
                        {[0, 1, 2, 3, 4].map(i => (
                            <div key={i} className="text-[10px] font-mono text-amber-500/50 px-2 text-right">
                                {formatPriceByMarket(max - (i * (max - min) / 4))}
                            </div>
                        ))}
                        {/* Current Price Label on Axis */}
                        <div className="absolute right-0 bg-white text-black px-1.5 py-0.5 text-[10px] font-bold z-30 shadow-lg" style={{ top: `${getPriceY(currentPrice)}%`, transform: 'translateY(-50%)' }}>
                            {formatPriceByMarket(currentPrice)}
                        </div>
                    </div>
                </div>
            </div>
        </div>

        {/* SIDEBAR CONTROLS */}
        <div className="order-2 flex-1 min-h-0 bg-[#0d1017] border border-white/5 rounded-xl flex flex-col z-20 shadow-2xl overflow-hidden">
            <div onClick={() => setIsControlsExpanded(!isControlsExpanded)} className="px-4 py-3 bg-[#1a1d26] flex items-center justify-between border-b border-white/5">
                <span className="text-[11px] font-black text-white uppercase flex items-center gap-2 tracking-widest"><Sliders size={14} className="text-amber-500"/> Thiết lập lệnh</span>
                <div>{isControlsExpanded ? <ChevronDown size={14}/> : <ChevronUp size={14}/>}</div>
            </div>

            <div className={`overflow-hidden transition-all duration-300 ${isControlsExpanded ? 'max-h-[520px]' : 'max-h-0'}`}>
                <div className="p-4 bg-[#13161f] space-y-4">
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
                        <div className="rounded-xl border border-amber-500/30 bg-black/40 px-4 py-3 text-center">
                            <span className="text-sm font-black text-amber-400">1 phút / 1 lệnh</span>
                        </div>
                     </div>

                    <div className="bg-black/40 border border-white/10 rounded-xl p-3 flex items-center justify-between">
                      <div>
                        <p className="text-[10px] text-white/50 uppercase font-bold tracking-wider">Thi truong</p>
                        <p className="text-sm text-white font-black uppercase">{selectedMarket.symbol}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-mono font-bold text-white">{formatPriceByMarket(selectedTicker.price, selectedMarket)}</p>
                        <p className={`text-[10px] font-black ${isTickerUp ? 'text-emerald-400' : 'text-red-400'}`}>
                          {isTickerUp ? '+' : ''}{formatPriceByMarket(selectedTicker.change, selectedMarket)} ({isTickerUp ? '+' : ''}{Number(selectedTicker.changePct || 0).toFixed(2)}%)
                        </p>
                      </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-3 p-4 border-b border-white/5 bg-[#0d1017]">
                <button onClick={() => handleTrade('CALL')} className="group relative h-20 bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-white rounded-2xl flex flex-col items-center justify-center transition-all shadow-[0_8px_20px_rgba(16,185,129,0.3)]">
                    <TrendingUp size={21} className="mb-1 group-hover:translate-y-[-2px] transition-transform" />
                    <span className="font-black uppercase italic text-[13px] tracking-tighter">MUA (Call)</span>
                </button>
                <button onClick={() => handleTrade('PUT')} className="group relative h-20 bg-red-500 hover:bg-red-400 active:scale-95 text-white rounded-2xl flex flex-col items-center justify-center transition-all shadow-[0_8px_20px_rgba(239,68,68,0.3)]">
                    <TrendingDown size={21} className="mb-1 group-hover:translate-y-[2px] transition-transform" />
                    <span className="font-black uppercase italic text-[13px] tracking-tighter">BÁN (Put)</span>
                </button>
            </div>

            <div className={`flex flex-col bg-[#0a0c10] transition-all duration-300 ${isHistoryExpanded ? 'flex-1 min-h-[200px]' : 'h-[130px] shrink-0'}`}>
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
                                        <span className="text-[9px] text-amber-500/70 font-mono">{trade.marketSymbol || selectedMarket.symbol}</span>
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
                                        <span className="text-xs font-mono font-bold text-white">${formatPriceByMarket(trade.entryPrice, { precision: trade.precision ?? selectedMarket.precision })}</span>
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

