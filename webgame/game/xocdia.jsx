import React, { useState, useEffect, useRef } from 'react';
import { RefreshCcw, Wallet, History, Trash2, Zap } from 'lucide-react';

const PAYOUTS = {
  CHAN: 1, LE: 1, FOUR_RED: 12, FOUR_WHITE: 12, THREE_RED: 2.6, THREE_WHITE: 2.6
};

const CHIP_DATA = [
  { value: 5, color: '#475569', text: '#ffffff' },
  { value: 10, color: '#cbd5e1', text: '#0f172a' },
  { value: 50, color: '#3b82f6', text: '#ffffff' },
  { value: 100, color: '#10b981', text: '#ffffff' },
  { value: 500, color: '#8b5cf6', text: '#ffffff' },
  { value: 1000, color: '#f59e0b', text: '#ffffff' },
  { value: 2000, color: '#ef4444', text: '#ffffff' },
  { value: 5000, color: '#ec4899', text: '#ffffff' }
];

const MiniCoins = ({ reds, whites }) => {
    return (
        <div className="flex gap-1 mb-1 bg-black/20 p-1 rounded-lg">
            {[...Array(reds)].map((_, i) => (
                <div key={`r-${i}`} className="w-3 h-3 rounded-full bg-gradient-to-tr from-red-600 via-red-500 to-red-400 shadow-sm border border-red-800" />
            ))}
            {[...Array(whites)].map((_, i) => (
                <div key={`w-${i}`} className="w-3 h-3 rounded-full bg-[radial-gradient(circle_at_center,_#ffffff_0%,_#e2e8f0_60%,_#94a3b8_100%)] shadow-sm border border-slate-400" />
            ))}
        </div>
    );
};

export default function App() {
  const [balance, setBalance] = useState(10000000); 
  const [coins, setCoins] = useState([
    { isRed: true, x: 0, y: 0, rotate: 0 },
    { isRed: true, x: 0, y: 0, rotate: 45 },
    { isRed: false, x: 0, y: 0, rotate: 90 },
    { isRed: false, x: 0, y: 0, rotate: 135 }
  ]);
  const [isShaking, setIsShaking] = useState(false);
  const [isBowlOpen, setIsBowlOpen] = useState(false);
  const [bets, setBets] = useState({ CHAN: 0, LE: 0, FOUR_RED: 0, FOUR_WHITE: 0, THREE_RED: 0, THREE_WHITE: 0 });
  const [selectedChip, setSelectedChip] = useState(10);
  const [history, setHistory] = useState([]);
  const [message, setMessage] = useState("CHÀO MỪNG ĐẾN VỚI CASINO");
  const [gameStatus, setGameStatus] = useState("BETTING"); 
  const [timer, setTimer] = useState(30);
  const [lastWin, setLastWin] = useState(0);
  const [winningFields, setWinningFields] = useState([]);

  const audioCtx = useRef(null);
  const timerRef = useRef(null);

  const initAudio = () => { if (!audioCtx.current) audioCtx.current = new (window.AudioContext || window.webkitAudioContext)(); };
  
  const playSfx = (freq, type = 'sine', duration = 0.1, vol = 0.1) => {
    initAudio();
    const ctx = audioCtx.current;
    if (ctx && ctx.state === 'suspended') ctx.resume();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    gain.gain.setValueAtTime(vol, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  };

  const formatCurrency = (num) => {
      if (num >= 1000) return (num / 1000).toLocaleString() + 'M';
      return num.toLocaleString() + 'K';
  };

  useEffect(() => {
    startNewSession();
    return () => clearInterval(timerRef.current);
  }, []);

  const startNewSession = () => {
    setGameStatus("BETTING");
    setTimer(30);
    setIsBowlOpen(false);
    setWinningFields([]);
    setLastWin(0);
    setMessage("MỜI ĐẶT CƯỢC");
    
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
        setTimer(prev => {
            if (prev <= 1) {
                clearInterval(timerRef.current);
                handleAutoShake();
                return 0;
            }
            return prev - 1;
        });
    }, 1000);
  };

  const handleAutoShake = () => {
    setGameStatus("SHAKING");
    setIsShaking(true);
    setMessage("ĐANG XÓC ĐĨA...");
    const shakeInterval = setInterval(() => playSfx(100 + Math.random() * 50, 'square', 0.05, 0.05), 100);

    setTimeout(() => {
      clearInterval(shakeInterval);
      setIsShaking(false);
      const redCount = Math.floor(Math.random() * 5); 
      const results = Array(4).fill(false).map(((_, i) => i < redCount)).sort(() => Math.random() - 0.5);
      const initialCoins = results.map((isRed) => ({
        isRed, x: Math.random() * 40 - 20, y: Math.random() * 40 - 20, rotate: Math.random() * 360
      }));
      setCoins(initialCoins);
      setTimeout(() => handleAutoOpen(initialCoins), 1500);
    }, 2000);
  };

  const handleAutoOpen = (finalResults) => {
    playSfx(800, 'sine', 0.3, 0.1);
    setIsBowlOpen(true);
    setGameStatus("RESULT");

    const zones = [{x:-45,y:-45}, {x:45,y:-45}, {x:-45,y:45}, {x:45,y:45}].sort(() => Math.random() - 0.5);
    setCoins(prev => prev.map((coin, i) => ({
        ...coin,
        x: zones[i].x + (Math.random()*25-12.5),
        y: zones[i].y + (Math.random()*25-12.5),
        rotate: Math.random() * 360
    })));

    const redCount = finalResults.filter(c => c.isRed).length;
    const isChan = redCount % 2 === 0;
    let wins = [isChan ? "CHAN" : "LE"];
    if (redCount === 4) wins.push("FOUR_RED");
    if (redCount === 0) wins.push("FOUR_WHITE");
    if (redCount === 3) wins.push("THREE_RED");
    if (redCount === 1) wins.push("THREE_WHITE");
    setWinningFields(wins);

    let totalWin = 0;
    wins.forEach(f => { if (bets[f] > 0) totalWin += bets[f] * (1 + PAYOUTS[f]); });

    if (totalWin > 0) {
        setBalance(b => b + totalWin);
        setLastWin(totalWin);
        setMessage(`CHÚC MỪNG THẮNG ${formatCurrency(totalWin)}!`);
        playSfx(1000, 'sine', 0.5, 0.1);
    } else {
        setMessage(isChan ? "KẾT QUẢ: CHẴN" : "KẾT QUẢ: LẺ");
    }
    setHistory(prev => [...prev, isChan ? 'C' : 'L'].slice(-60));
    setTimeout(() => {
        setBets({ CHAN: 0, LE: 0, FOUR_RED: 0, FOUR_WHITE: 0, THREE_RED: 0, THREE_WHITE: 0 });
        startNewSession();
    }, 7000);
  };

  const handleBet = (type) => {
    if (gameStatus !== "BETTING") return;
    if (balance >= selectedChip) {
      playSfx(400, 'sine', 0.05, 0.05);
      setBets(prev => ({ ...prev, [type]: prev[type] + selectedChip }));
      setBalance(prev => prev - selectedChip);
    }
  };

  const resetBets = () => {
    if (gameStatus !== "BETTING") return;
    playSfx(200, 'sine', 0.1, 0.05);
    const totalBet = Object.values(bets).reduce((a, b) => a + b, 0);
    setBalance(prev => prev + totalBet);
    setBets({ CHAN: 0, LE: 0, FOUR_RED: 0, FOUR_WHITE: 0, THREE_RED: 0, THREE_WHITE: 0 });
  };

  const doubleBets = () => {
    if (gameStatus !== "BETTING") return;
    const totalCurrentBet = Object.values(bets).reduce((a, b) => a + b, 0);
    if (balance >= totalCurrentBet) {
        playSfx(600, 'sine', 0.1, 0.05);
        setBalance(prev => prev - totalCurrentBet);
        setBets(prev => {
            const newBets = { ...prev };
            Object.keys(newBets).forEach(key => newBets[key] *= 2);
            return newBets;
        });
    }
  };

  const renderSoiCauMini = () => {
    const rows = 5;
    const cols = 12;
    const cells = [];
    for (let i = 0; i < rows * cols; i++) {
        const item = history[i];
        cells.push(
            <div key={i} className="w-3.5 h-3.5 md:w-4 md:h-4 border border-white/5 flex items-center justify-center bg-black/20">
                {item === 'C' && <div className="w-2.5 h-2.5 md:w-3 md:h-3 rounded-full bg-red-600 shadow-[0_0_5px_rgba(220,38,38,0.6)]" />}
                {item === 'L' && <div className="w-2.5 h-2.5 md:w-3 md:h-3 rounded-full bg-slate-100 shadow-[0_0_5px_rgba(255,255,255,0.4)]" />}
            </div>
        );
    }
    return (
        <div className="p-1.5 bg-slate-900/40 rounded-lg border border-white/10 backdrop-blur-sm shadow-xl w-full">
            <div className="flex justify-between items-center mb-1 px-1">
                <div className="flex items-center gap-2">
                    <History size={10} className="text-yellow-500" />
                    <span className="text-[8px] font-orbitron font-black text-slate-400 tracking-wider uppercase">Lịch sử</span>
                </div>
                <div className="flex gap-2">
                    <div className="flex items-center gap-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-red-600" />
                        <span className="text-[8px] font-orbitron text-red-500 font-black">{history.filter(h => h === 'C').length}</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-slate-100" />
                        <span className="text-[8px] font-orbitron text-slate-100 font-black">{history.filter(h => h === 'L').length}</span>
                    </div>
                </div>
            </div>
            <div className="grid grid-flow-col grid-rows-5 border border-white/5 rounded-sm overflow-hidden bg-black/40">
                {cells}
            </div>
        </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#05050a] text-white font-sans flex flex-col items-center select-none overflow-hidden relative">
      <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-20">
          {[...Array(15)].map((_, i) => (
              <div key={i} className="absolute bg-blue-500 rounded-full blur-3xl animate-pulse" 
                   style={{
                       width: Math.random()*150 + 100 + 'px',
                       height: Math.random()*150 + 100 + 'px',
                       left: Math.random()*100 + '%',
                       top: Math.random()*100 + '%',
                       animationDuration: Math.random()*8 + 5 + 's'
                   }} 
              />
          ))}
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Montserrat:wght@300;900&display=swap');
        .font-orbitron { font-family: 'Orbitron', sans-serif; }
        .font-montserrat { font-family: 'Montserrat', sans-serif; }
        @keyframes shake {
          0% { transform: translate(0,0) rotate(0); }
          25% { transform: translate(12px, -6px) rotate(4deg); }
          50% { transform: translate(-12px, 6px) rotate(-4deg); }
          75% { transform: translate(6px, 10px) rotate(2deg); }
          100% { transform: translate(0,0) rotate(0); }
        }
        .animate-shake { animation: shake 0.12s infinite; }
        .win-glow {
            position: relative;
            z-index: 10;
            box-shadow: 0 0 30px #eab308, inset 0 0 20px #eab308;
            border-color: #facc15 !important;
            animation: border-flow 1.2s linear infinite;
        }
        @keyframes border-flow {
            0%, 100% { filter: brightness(1); }
            50% { filter: brightness(1.6) drop-shadow(0 0 15px #eab308); }
        }
        .plate-depth {
            background: radial-gradient(circle at 45% 45%, #fdfbf7 0%, #e2dac8 40%, #c1b399 70%, #8b7d62 100%);
            box-shadow: 
                inset 0 0 50px rgba(0,0,0,0.15),
                inset 0 -10px 20px rgba(0,0,0,0.1),
                0 30px 60px -12px rgba(0,0,0,0.7),
                0 18px 36px -18px rgba(0,0,0,0.8);
            border: 1px solid rgba(255,255,255,0.4);
        }
        .plate-rim {
            background: linear-gradient(135deg, #b48d3b 0%, #f7ef8a 20%, #edcf5d 40%, #b48d3b 60%, #f7ef8a 80%, #edcf5d 100%);
            padding: 4px;
            box-shadow: 0 5px 15px rgba(0,0,0,0.4);
        }

        /* NÂNG CẤP CÁI BÁT - BOWL REFINED */
        .bowl-gradient {
            background: radial-gradient(circle at 35% 35%, #475569 0%, #1e293b 40%, #0f172a 70%, #020617 100%);
            box-shadow: 
                inset 0 12px 20px rgba(255,255,255,0.15), 
                inset 0 -4px 10px rgba(0,0,0,0.5),
                0 40px 70px rgba(0,0,0,0.8);
            border: 1px solid rgba(255,255,255,0.05);
        }
        
        /* NÂNG CẤP QUÂN VỊ - COIN REFINED */
        .coin-3d-red {
            background: radial-gradient(circle at 30% 30%, #ff5f5f 0%, #b91c1c 60%, #7f1d1d 100%);
            box-shadow: inset 0 2px 4px rgba(255,255,255,0.3), 0 6px 12px rgba(0,0,0,0.6);
        }
        .coin-3d-white {
            background: radial-gradient(circle at 30% 30%, #ffffff 0%, #e2e8f0 60%, #94a3b8 100%);
            box-shadow: inset 0 2px 4px rgba(255,255,255,0.8), 0 6px 12px rgba(0,0,0,0.5);
        }

        .chip-base-new {
            position: relative;
            width: 52px;
            height: 52px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
            border: 2px solid rgba(255,255,255,0.25);
            box-shadow: 0 4px 6px rgba(0,0,0,0.4);
        }
        .chip-base-new:active { transform: scale(0.9); }
        .chip-active-new { 
            transform: translateY(-8px); 
            box-shadow: 0 10px 20px rgba(0,0,0,0.5), 0 0 0 4px rgba(255,255,255,0.2); 
            z-index: 50;
        }
        .chip-inner-new {
            font-family: 'Orbitron', sans-serif;
            font-weight: 900;
            font-size: 11px;
            letter-spacing: -0.5px;
        }

        .bet-box {
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            background: rgba(15, 23, 42, 0.7);
            backdrop-filter: blur(12px);
            cursor: pointer;
        }
        .bet-box:hover { background: rgba(30, 41, 59, 0.9); transform: translateY(-3px); }
        .control-btn {
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid rgba(255, 255, 255, 0.1);
            padding: 8px 16px; border-radius: 12px;
            font-family: 'Orbitron', sans-serif; font-size: 10px; font-weight: 900;
            display: flex; align-items: center; gap: 6px;
            text-transform: uppercase; letter-spacing: 1px;
        }
        .no-scrollbar::-webkit-scrollbar { display: none; }
      `}</style>

      {/* Top Bar */}
      <header className="w-full max-w-5xl flex justify-between items-start p-6 z-50">
        <div className="flex flex-col items-start gap-2 w-48 md:w-64">
            {renderSoiCauMini()}
        </div>
        
        <div className="flex flex-col items-end gap-2 w-28 md:w-24">
            <div className="bg-slate-900/90 border border-white/10 px-4 py-2 rounded-xl flex items-center shadow-2xl backdrop-blur-md w-full justify-between">
                    <div className="flex flex-col">
                        <span className="text-[8px] font-bold text-slate-400 uppercase leading-none mb-1">Số dư</span>
                        <span className="font-orbitron text-base font-black text-white tracking-tighter leading-none">{formatCurrency(balance)}</span>
                    </div>
                
            </div>
            <div className="text-right px-1">
                <p className="text-[10px] font-orbitron font-bold text-slate-500 tracking-widest uppercase">ID: 1234</p>
            </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow w-full flex flex-col items-center justify-start z-10 pt-4 px-4">
        
        <div className="relative flex flex-col items-center w-full max-w-[500px]">
            {/* DISK AND BOWL AREA */}
            <div className={`relative w-[320px] h-[320px] flex items-center justify-center mb-[-40px] z-30 ${isShaking ? 'animate-shake' : ''}`}>
                <div className="absolute inset-0 rounded-full plate-rim">
                    <div className="w-full h-full rounded-full plate-depth relative flex items-center justify-center overflow-hidden">
                        {coins.map((coin, idx) => (
                            <div key={idx} 
                                className={`absolute w-12 h-12 rounded-full transition-all duration-700
                                    ${coin.isRed ? 'coin-3d-red' : 'coin-3d-white'}
                                    ${isBowlOpen ? 'opacity-100 scale-100' : 'opacity-0 scale-50'}`}
                                style={{
                                    left: `calc(50% + ${coin.x}px)`,
                                    top: `calc(50% + ${coin.y}px)`,
                                    transform: `translate(-50%, -50%) rotate(${coin.rotate}deg)`,
                                    zIndex: 10 + idx
                                }}>
                                <div className="absolute inset-1 rounded-full border border-black/5" />
                            </div>
                        ))}
                    </div>
                </div>

                {/* BOWL ELEMENT */}
                <div className={`absolute w-[290px] h-[290px] rounded-full z-40 bowl-gradient flex items-center justify-center transition-all duration-1000 cubic-bezier(0.19, 1, 0.22, 1)
                    ${isBowlOpen ? '-translate-y-[160%] opacity-0 scale-75 rotate-45' : 'translate-y-0 opacity-100'}`}>
                    <div className="relative w-32 h-32 flex items-center justify-center">
                        <svg className="absolute inset-0 w-full h-full -rotate-90">
                            <circle cx="64" cy="64" r="60" stroke="currentColor" strokeWidth="4" fill="transparent" className="text-white/5" />
                            <circle cx="64" cy="64" r="60" stroke="currentColor" strokeWidth="6" fill="transparent" 
                                className={`timer-circle ${timer <= 5 ? 'text-red-500' : 'text-yellow-500'}`}
                                strokeDasharray={377}
                                strokeDashoffset={377 - (timer / 30) * 377}
                                strokeLinecap="round"
                            />
                        </svg>
                        <div className="flex flex-col items-center">
                            <span className={`font-orbitron text-4xl font-black ${timer <= 5 ? 'text-red-500' : 'text-white'}`}>
                                {timer}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="w-full pt-12 pb-6 z-20">
                <div className="text-center mb-6 h-4">
                    <p className={`font-orbitron text-[9px] font-black tracking-[0.3em] uppercase ${lastWin > 0 ? 'text-yellow-400' : 'text-slate-500'}`}>
                        {message}
                    </p>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-4">
                    {['LE', 'CHAN'].map((type) => (
                        <div key={type} onClick={() => handleBet(type)}
                            className={`bet-box h-24 rounded-3xl border-2 flex flex-col items-center justify-center relative overflow-hidden
                            ${type === 'CHAN' ? 'border-red-500/30' : 'border-slate-400/20'}
                            ${winningFields.includes(type) ? 'win-glow' : ''}`}>
                            <span className={`font-montserrat text-2xl font-black tracking-tighter ${type === 'CHAN' ? 'text-red-500' : 'text-white'}`}>
                                {type === 'CHAN' ? 'CHẴN' : 'LẺ'}
                            </span>
                            <span className="text-[8px] font-orbitron font-bold text-slate-500 mt-1 uppercase tracking-widest">x2.0</span>
                            {bets[type] > 0 && (
                                <div className="absolute top-2 right-2">
                                    <div className="px-1.5 py-0.5 rounded-full bg-yellow-500 text-black text-[9px] font-black border border-white shadow-lg">
                                        {formatCurrency(bets[type])}
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>

                <div className="grid grid-cols-4 gap-2">
                    {[
                        { id: 'THREE_WHITE', r: 1, w: 3, p: 'x2.6' }, 
                        { id: 'THREE_RED', r: 3, w: 1, p: 'x2.6' }, 
                        { id: 'FOUR_WHITE', r: 0, w: 4, p: 'x12' }, 
                        { id: 'FOUR_RED', r: 4, w: 0, p: 'x12' }
                    ].map(item => (
                        <div key={item.id} onClick={() => handleBet(item.id)}
                            className={`bet-box py-2.5 rounded-2xl border flex flex-col items-center justify-center gap-1 min-h-[80px] relative
                            ${winningFields.includes(item.id) ? 'win-glow' : 'border-white/5'}`}>
                            {bets[item.id] > 0 && (
                                <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 bg-yellow-500 text-black px-1.5 rounded-full text-[7px] font-black border border-white shadow-md">
                                    {formatCurrency(bets[item.id])}
                                </div>
                            )}
                            <MiniCoins reds={item.r} whites={item.w} />
                            <span className="text-[8px] font-orbitron text-slate-400 font-bold">{item.p}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
      </main>

      {/* Footer - Redesigned Minimalist Chips */}
      <footer className="w-full bg-black/95 border-t border-white/10 py-5 px-4 backdrop-blur-3xl z-50 flex flex-col items-center gap-6 mt-auto shadow-[0_-15px_40px_rgba(0,0,0,0.8)] overflow-x-visible">

  <div className="flex gap-4">
    <button onClick={resetBets} className="control-btn">
      <Trash2 size={12} /> Hủy cược
    </button>
    <button onClick={doubleBets} className="control-btn">
      <Zap size={12} /> X2 Cược
    </button>
  </div>

  <div className="
    flex
    items-center
    gap-3
    overflow-x-auto
    max-w-full
    no-scrollbar
    px-2
    pb-1
    h-20
    justify-start
  ">
    {CHIP_DATA.map((chip) => (
      <div
        key={chip.value}
        onClick={() => setSelectedChip(chip.value)}
        className={`
          chip-base-new
          flex-shrink-0
          ${selectedChip === chip.value
            ? 'chip-active-new'
            : 'opacity-70 hover:opacity-100 hover:-translate-y-1'}
        `}
        style={{ backgroundColor: chip.color }}
      >
        <div className="chip-inner-new" style={{ color: chip.text }}>
          {chip.value >= 1000 ? `${chip.value / 1000}M` : `${chip.value}k`}
        </div>
        <div className="absolute inset-1 rounded-full border border-white/10" />
      </div>
    ))}
  </div>
</footer>

    </div>
  );
}