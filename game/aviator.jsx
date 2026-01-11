import React, { useState, useEffect, useRef } from 'react';
import { Wallet, ShieldCheck, Clock, ArrowRightCircle, XCircle, Trophy, Sparkles } from 'lucide-react';

const AviatorGame = () => {
  // --- States Hệ thống ---
  const [multiplier, setMultiplier] = useState(1.00);
  const [isFlying, setIsFlying] = useState(false);
  const [betAmount, setBetAmount] = useState(10000);
  const [balance, setBalance] = useState(5000000);
  const [isCrashed, setIsCrashed] = useState(false);
  const [history, setHistory] = useState([1.95, 12.40, 1.05, 3.20, 1.15, 2.10, 8.45]);
  const [cashedOut, setCashedOut] = useState(null);
  const [waitTime, setWaitTime] = useState(7); 
  
  // --- State Hũ Thưởng (Jackpot) ---
  const [jackpot, setJackpot] = useState(125430000);
  const [isJackpotWon, setIsJackpotWon] = useState(false);
  const [wonJackpotAmount, setWonJackpotAmount] = useState(0);

  // Logic Cược
  const [isBetPlacedForCurrent, setIsBetPlacedForCurrent] = useState(false); 
  const [isBetPlacedForNext, setIsBetPlacedForNext] = useState(false); 

  const canvasRef = useRef(null);
  const requestRef = useRef();
  const startTimeRef = useRef();
  const stars = useRef([]);
  const nebulas = useRef([]);
  const rocketImg = useRef(null);
  const exhaustParticles = useRef([]);
  const currentCrashPoint = useRef(2.00);

  // Khởi tạo tài nguyên
  useEffect(() => {
    const img = new Image();
    img.src = 'https://i.imgur.com/RKezcvf.png';
    img.onload = () => { rocketImg.current = img; };
    
    const handleResize = () => {
        if (canvasRef.current) {
            canvasRef.current.width = window.innerWidth;
            canvasRef.current.height = window.innerHeight * 0.6;
        }
    };
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const initUniverse = (w, h) => {
    stars.current = Array.from({ length: 80 }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      speed: Math.random() * 1.5 + 0.5,
      size: Math.random() * 2,
      opacity: Math.random()
    }));
    nebulas.current = Array.from({ length: 3 }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        size: Math.random() * 300 + 200,
        color: Math.random() > 0.5 ? 'rgba(76, 29, 149, 0.15)' : 'rgba(30, 58, 138, 0.15)',
        speed: Math.random() * 0.2 + 0.1
    }));
    exhaustParticles.current = [];
  };

  const updateMultiplier = (time) => {
    if (!startTimeRef.current) startTimeRef.current = time;
    const elapsed = (time - startTimeRef.current) / 1000;
    
    const newMultiplier = 1 + (Math.pow(elapsed, 1.3) * 0.1); 
    setMultiplier(newMultiplier);

    // Kiểm tra Nổ Hũ (Xác suất nhỏ khi trên 50x)
    if (newMultiplier >= 50 && isBetPlacedForCurrent && !isJackpotWon && Math.random() < 0.001) {
        triggerJackpot();
    }

    if (newMultiplier >= currentCrashPoint.current) {
      handleCrash(newMultiplier);
      return;
    }

    draw(newMultiplier, elapsed);
    requestRef.current = requestAnimationFrame(updateMultiplier);
  };

  const triggerJackpot = () => {
    const winAmount = Math.floor(jackpot * 0.5); 
    setWonJackpotAmount(winAmount);
    setBalance(prev => prev + winAmount);
    setJackpot(prev => prev - winAmount);
    setIsJackpotWon(true);
    setTimeout(() => setIsJackpotWon(false), 5000);
  };

  const startNewRound = () => {
    setIsFlying(true);
    setIsCrashed(false);
    setCashedOut(null);
    setMultiplier(1.00);
    startTimeRef.current = null;
    
    const rand = Math.random();
    if (rand < 0.1) currentCrashPoint.current = 1.00;
    else if (rand < 0.3) currentCrashPoint.current = 1.1 + (Math.random() * 0.4);
    else if (rand < 0.95) currentCrashPoint.current = 1.5 + (Math.random() * 5);
    else currentCrashPoint.current = 20 + (Math.random() * 100); 
    
    const canvas = canvasRef.current;
    if (canvas) initUniverse(canvas.width, canvas.height);
    
    requestRef.current = requestAnimationFrame(updateMultiplier);
  };

  const handleCrash = (finalMult) => {
    cancelAnimationFrame(requestRef.current);
    setIsFlying(false);
    setIsCrashed(true);
    
    setIsBetPlacedForCurrent(prevCurrent => {
      if (isBetPlacedForNext) return true;
      return false; 
    });
    setIsBetPlacedForNext(false);

    setHistory(prev => [finalMult, ...prev].slice(0, 15));
    setWaitTime(7); 
  };

  useEffect(() => {
    let timer;
    if (waitTime > 0 && !isFlying) {
      timer = setInterval(() => {
        setWaitTime(prev => {
            if (prev <= 1) {
                clearInterval(timer);
                return 0;
            }
            return prev - 1;
        });
      }, 1000);
    } else if (waitTime === 0 && !isFlying) {
      startNewRound();
    }
    return () => clearInterval(timer);
  }, [waitTime, isFlying]);

  const handleBetClick = () => {
    if (isFlying && isBetPlacedForCurrent && !cashedOut) return;

    if (!isFlying) {
        if (isBetPlacedForCurrent) {
            setBalance(prev => prev + betAmount);
            setIsBetPlacedForCurrent(false);
        } else {
            if (balance < betAmount) return;
            setBalance(prev => prev - betAmount);
            setJackpot(prev => prev + Math.floor(betAmount * 0.01)); 
            setIsBetPlacedForCurrent(true);
        }
    } else {
        if (isBetPlacedForNext) {
            setBalance(prev => prev + betAmount);
            setIsBetPlacedForNext(false);
        } else {
            if (balance < betAmount) return;
            setBalance(prev => prev - betAmount);
            setJackpot(prev => prev + Math.floor(betAmount * 0.01)); 
            setIsBetPlacedForNext(true);
        }
    }
  };

  const handleCashOut = () => {
    if (!isFlying || !isBetPlacedForCurrent || cashedOut) return;
    const winAmount = Math.floor(betAmount * multiplier);
    setBalance(prev => prev + winAmount);
    setCashedOut(multiplier);
    setIsBetPlacedForCurrent(false); 
    setTimeout(() => setCashedOut(null), 2500);
  };

  const drawExhaust = (ctx, x, y, isMoving) => {
    if (!isMoving) return;
    if (Math.random() > 0.1) {
      exhaustParticles.current.push({
        x: x + (Math.random() - 0.5) * 8,
        y: y + 20,
        vx: (Math.random() - 0.5) * 1,
        vy: Math.random() * 5 + 6,
        life: 1,
        size: Math.random() * 15 + 10,
        color: Math.random() > 0.5 ? '#f87171' : '#fbbf24'
      });
    }
    ctx.save();
    for (let i = exhaustParticles.current.length - 1; i >= 0; i--) {
      const p = exhaustParticles.current[i];
      p.x += p.vx; p.y += p.vy; p.life -= 0.03;
      if (p.life <= 0) { exhaustParticles.current.splice(i, 1); continue; }
      const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size);
      grad.addColorStop(0, p.color);
      grad.addColorStop(1, 'transparent');
      ctx.globalAlpha = p.life * 0.6;
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  };

  const draw = (mult, time) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;

    ctx.clearRect(0, 0, w, h);

    nebulas.current.forEach(n => {
        n.y += n.speed * (1 + (mult - 1) * 0.5);
        if (n.y - n.size > h) n.y = -n.size;
        const g = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.size);
        g.addColorStop(0, n.color);
        g.addColorStop(1, 'transparent');
        ctx.fillStyle = g;
        ctx.fillRect(n.x - n.size, n.y - n.size, n.size * 2, n.size * 2);
    });

    ctx.fillStyle = 'white';
    stars.current.forEach(s => {
      s.y += s.speed * (1 + (mult - 1) * 3);
      if (s.y > h) { s.y = 0; s.x = Math.random() * w; }
      ctx.globalAlpha = s.opacity * (Math.random() * 0.5 + 0.5);
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;

    const centerX = w / 2;
    const targetY = h * 0.65;
    const currentY = Math.max(h - (time * 150), targetY);

    drawExhaust(ctx, centerX, currentY, mult > 1);

    if (rocketImg.current) {
      ctx.save();
      ctx.translate(centerX, currentY);
      const shake = Math.min(mult * 0.8, 4);
      ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
      const size = 130;
      ctx.shadowBlur = 40;
      ctx.shadowColor = 'rgba(239, 68, 68, 0.7)';
      ctx.drawImage(rocketImg.current, -size/2, -size/2, size, size);
      ctx.restore();
    }
  };

  const formatCurrency = (val) => {
    return val.toLocaleString('vi-VN') + 'đ';
  };

  return (
    <div className="flex flex-col h-screen bg-[#020205] text-white font-sans overflow-hidden select-none safe-bottom">
      
      {/* Header */}
      <div className="px-4 py-3 flex items-center justify-between bg-[#050508]/95 backdrop-blur-md border-b border-white/5 z-40">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 bg-red-600 rounded-xl flex items-center justify-center shadow-lg shadow-red-600/30">
             <img src="https://i.imgur.com/RKezcvf.png" alt="Logo" className="w-7 h-7 object-contain" />
          </div>
          <div>
            <div className="font-black italic text-sm leading-none tracking-tighter uppercase">Rocket<span className="text-red-500">Elite</span></div>
            <div className="text-[9px] text-white/40 font-bold uppercase tracking-widest mt-0.5 leading-none">Vòng quay 24/7</div>
          </div>
        </div>
        
        <div className="flex flex-col items-end gap-1">
          {/* Ví tiền VNĐ */}
          <div className="flex items-center gap-1.5 bg-black/60 pl-2 pr-3 py-1 rounded-full border border-white/10">
            <Wallet size={10} className="text-emerald-500" />
            <span className="font-mono font-black text-emerald-400 text-xs tracking-tight">{formatCurrency(balance)}</span>
          </div>
          
          {/* Hũ Thưởng VNĐ */}
          <div className="flex items-center gap-1.5 bg-gradient-to-r from-amber-600/20 to-amber-900/40 pl-2 pr-3 py-1 rounded-full border border-amber-500/30 shadow-[0_0_10px_rgba(245,158,11,0.2)]">
            <Trophy size={10} className="text-amber-400" />
            <span className="font-mono font-black text-amber-400 text-[10px] tracking-widest animate-pulse">
                {formatCurrency(jackpot)}
            </span>
          </div>
        </div>
      </div>

      {/* Lịch sử */}
      <div className="flex items-center gap-2 overflow-x-auto px-4 py-2 no-scrollbar bg-black/40 border-b border-white/5 z-30">
        {history.map((val, i) => (
          <div key={i} className={`flex-shrink-0 px-3 py-0.5 rounded-lg text-[10px] font-black border ${val >= 2 ? 'text-fuchsia-400 border-fuchsia-500/30 bg-fuchsia-500/10' : 'text-blue-400 border-blue-500/30 bg-blue-500/10'}`}>
            {val.toFixed(2)}x
          </div>
        ))}
      </div>

      {/* Vùng đồ họa Space */}
      <div className="relative flex-1 flex flex-col overflow-hidden">
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
        
        <div className="absolute top-12 left-0 right-0 flex flex-col items-center justify-center pointer-events-none z-10">
          {isCrashed ? (
            <div className="text-center animate-in zoom-in duration-300">
              <div className="text-5xl font-black text-red-600 italic tracking-tighter drop-shadow-[0_0_30px_rgba(220,38,38,0.8)] uppercase">VỤT MẤT!</div>
              <div className="text-xl font-mono text-white/60 mt-1 font-bold">x{multiplier.toFixed(2)}</div>
            </div>
          ) : (
            <div className="flex flex-col items-center">
              <div className={`text-7xl leading-none font-black italic tracking-tighter transition-all duration-300 ${cashedOut ? 'text-emerald-400 scale-90 opacity-80' : 'text-white/90'}`}>
                {multiplier.toFixed(2)}<span className="text-2xl ml-1 text-red-500">x</span>
              </div>
              {!isFlying && !isCrashed && (
                  <div className="flex items-center gap-2 text-[10px] text-white/30 font-bold uppercase tracking-[0.3em] mt-3 bg-white/5 px-4 py-1.5 rounded-full border border-white/5">
                      <Clock size={10} className="animate-pulse" /> Đang nhận cược...
                  </div>
              )}
            </div>
          )}
        </div>

        {/* Thanh đếm ngược */}
        {waitTime > 0 && !isFlying && (
          <div className="absolute bottom-12 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-3 w-full px-12">
            <div className="w-full max-w-[180px] h-1.5 bg-white/5 rounded-full overflow-hidden border border-white/5">
                <div 
                    className="h-full bg-red-500 transition-all duration-1000 ease-linear shadow-[0_0_15px_rgba(239,68,68,0.8)]"
                    style={{ width: `${(waitTime / 7) * 100}%` }}
                ></div>
            </div>
            <div className="text-[10px] font-black italic text-white/40 tracking-[0.2em] uppercase">
                Khởi hành sau {waitTime}s
            </div>
          </div>
        )}
      </div>

      {/* Bảng điều khiển cược */}
      <div className="p-4 pt-6 pb-10 bg-[#08080c] border-t border-white/5 rounded-t-[45px] shadow-[0_-30px_80px_rgba(0,0,0,0.9)] z-40">
        
        <div className="flex justify-between items-center mb-5 px-2">
          <div className="flex items-center gap-1.5 text-white/20 font-bold text-[9px] uppercase tracking-widest">
            <ShieldCheck size={12} className="text-red-600" /> Hệ thống minh bạch
          </div>
          <div className="flex gap-2">
            {[10000, 50000, 100000, 500000].map(v => (
              <button 
                key={v} 
                onClick={() => setBetAmount(v)} 
                disabled={isBetPlacedForCurrent || isBetPlacedForNext}
                className={`px-3 py-1.5 border rounded-xl text-[10px] font-black transition-all ${isBetPlacedForCurrent || isBetPlacedForNext ? 'opacity-30 border-white/5 bg-transparent' : 'bg-white/5 border-white/10 active:bg-white/20 active:scale-95'}`}
              >
                +{v/1000}k
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-3 h-16">
          <div className="w-1/3 bg-black/60 border border-white/10 rounded-[24px] flex flex-col items-center justify-center relative overflow-hidden">
             <div className="text-[8px] font-bold text-white/20 uppercase absolute top-2">Số tiền</div>
             <input 
              type="number" 
              value={betAmount}
              disabled={isBetPlacedForCurrent || isBetPlacedForNext}
              onChange={(e) => setBetAmount(Math.max(1000, parseInt(e.target.value) || 0))}
              className={`w-full bg-transparent text-center font-mono font-black text-base focus:outline-none pt-2 ${isBetPlacedForCurrent || isBetPlacedForNext ? 'opacity-30' : ''}`}
            />
          </div>

          <div className="flex-1">
            {isFlying ? (
              isBetPlacedForCurrent && !cashedOut ? (
                <button 
                  onClick={handleCashOut}
                  className="w-full h-full rounded-[24px] font-black uppercase italic shadow-2xl active:scale-[0.96] transition-all flex flex-col items-center justify-center border-t border-white/20 bg-gradient-to-br from-emerald-400 to-emerald-600 text-white shadow-emerald-900/40"
                >
                  <span className="text-[9px] opacity-70 tracking-widest leading-none mb-0.5 text-emerald-100">CHỐT LỜI</span>
                  <span className="text-base leading-none font-mono font-black">{formatCurrency(betAmount * multiplier)}</span>
                </button>
              ) : (
                <button 
                  onClick={handleBetClick}
                  className={`w-full h-full rounded-[24px] font-black uppercase italic shadow-2xl active:scale-[0.96] transition-all flex flex-col items-center justify-center border-t border-white/20 ${isBetPlacedForNext ? 'bg-amber-600/20 text-amber-500 border-amber-600/30' : 'bg-slate-800 text-slate-400 border-white/5'}`}
                >
                  <span className="text-[9px] opacity-70 leading-none">{isBetPlacedForNext ? 'HUỶ CƯỢC' : 'ĐẶT CHO'}</span>
                  <span className="text-base leading-none flex items-center gap-1 uppercase tracking-tighter">Phiên kế <ArrowRightCircle size={14}/></span>
                </button>
              )
            ) : (
              <button 
                onClick={handleBetClick}
                className={`w-full h-full rounded-[24px] font-black text-lg uppercase italic shadow-xl active:scale-[0.96] transition-all flex flex-col items-center justify-center border-t border-white/10 ${isBetPlacedForCurrent ? 'bg-amber-600/20 text-amber-500 border-amber-600/30' : 'bg-gradient-to-r from-red-600 to-red-800 text-white'}`}
              >
                {isBetPlacedForCurrent ? (
                    <>
                        <span className="text-[10px] opacity-70 leading-none tracking-widest flex items-center gap-1">ĐÃ ĐẶT <XCircle size={10}/></span>
                        <span className="text-lg leading-none font-bold uppercase tracking-tighter">HUỶ CƯỢC</span>
                    </>
                ) : (
                    <>
                        <span className="text-[10px] opacity-70 leading-none tracking-widest">SẴN SÀNG</span>
                        <span className="text-lg leading-none font-bold uppercase tracking-tighter">ĐẶT CƯỢC</span>
                    </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Hiệu ứng trúng thưởng thường */}
      {cashedOut && (
        <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none px-8">
          <div className="bg-gradient-to-br from-emerald-500/90 to-[#020205] backdrop-blur-xl px-12 py-8 rounded-[40px] shadow-[0_0_80px_rgba(16,185,129,0.3)] text-center border border-emerald-500/30 animate-in zoom-in duration-500">
            <div className="text-[10px] font-black uppercase tracking-[0.4em] mb-2 text-emerald-400">Thành công!</div>
            <div className="text-3xl font-black italic text-white">+{formatCurrency(betAmount * cashedOut)}</div>
            <div className="text-sm font-mono mt-2 text-emerald-200">{cashedOut.toFixed(2)}x</div>
          </div>
        </div>
      )}

      {/* HIỆU ỨNG NỔ HŨ (JACKPOT) VNĐ */}
      {isJackpotWon && (
        <div className="fixed inset-0 flex items-center justify-center z-[100] px-6 bg-black/60 backdrop-blur-sm">
            <div className="bg-gradient-to-b from-amber-400 via-amber-600 to-amber-900 p-1 rounded-[40px] shadow-[0_0_100px_rgba(245,158,11,0.6)] animate-in zoom-in spin-in-1 duration-700">
                <div className="bg-[#08080c] px-10 py-12 rounded-[38px] text-center flex flex-col items-center border border-amber-300/30">
                    <div className="relative mb-4">
                        <Trophy size={80} className="text-amber-400 animate-bounce" />
                        <Sparkles size={30} className="text-white absolute -top-4 -right-4 animate-pulse" />
                        <Sparkles size={20} className="text-amber-200 absolute -bottom-2 -left-6 animate-pulse delay-150" />
                    </div>
                    <div className="text-amber-500 font-black text-xs uppercase tracking-[0.5em] mb-2 text-center leading-none">SIÊU HŨ ĐÃ NỔ</div>
                    <div className="text-3xl font-black italic text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.4)]">
                        +{formatCurrency(wonJackpotAmount)}
                    </div>
                    <div className="mt-6 px-6 py-2 bg-amber-500 text-black font-black rounded-full uppercase italic text-sm tracking-tighter shadow-lg">
                        Chúc mừng PTNT!
                    </div>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default AviatorGame;