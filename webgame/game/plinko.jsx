import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Volume2, VolumeX, Play, Square, Target, Trophy, Activity, Zap, List, Clock, DollarSign } from 'lucide-react';

// --- Game Constants ---
const GRAVITY = 0.45; 
const BOUNCE_DAMPENING = 0.45;
const HORIZONTAL_RANDOMNESS = 0.25;
const AUTO_DROP_INTERVAL = 150; 

const COLORS = {
  bg: '#05070a',
  pin: '#64748b',
  ball: '#ef4444',
  ballSuper: '#38bdf8',
  ballMega: '#f59e0b',
  highMult: '#ef4444', 
  medMult: '#f59e0b',  
  lowMult: '#1e293b',  
  gate: '#38bdf8',
  text: '#10b981'
};

const generateMultipliers = (count) => {
  const weights = [100, 50, 25, 10, 5, 2, 1.2, 0.5, 0.2];
  const result = new Array(count);
  for (let i = 0; i < count; i++) {
    const distFromEdge = Math.min(i, count - 1 - i);
    const val = weights[Math.min(distFromEdge, weights.length - 1)] || 0.2;
    result[i] = val;
  }
  return result;
};

export default function App() {
  const [balance, setBalance] = useState(10000000);
  const [bet, setBet] = useState(10000);
  const [history, setHistory] = useState([]); // Short horizontal history
  const [betLogs, setBetLogs] = useState([]); // Vertical detailed history (LIMIT TO 10)
  const [isMuted, setIsMuted] = useState(false);
  const [isAuto, setIsAuto] = useState(false);
  const [stats, setStats] = useState({ totalDrops: 0, totalWins: 0, bigWins: 0 });
  const [activeBalls, setActiveBalls] = useState(0);

  const canvasRef = useRef(null);
  const scrollWrapperRef = useRef(null);
  const requestRef = useRef(null);
  const audioCtxRef = useRef(null);
  
  const gameState = useRef({
    width: 0,
    height: 0,
    balls: [],
    pins: [],
    particles: [],
    multipliers: [],
    gates: [],
    layoutGap: 20, 
    pegSize: 1.8,
    ballSize: 4.5,
    lastTime: 0,
    autoEnabled: false,
    lastAutoDrop: 0,
    currentBalance: 10000000,
    currentBet: 10000,
    startY: 60,
    rowCount: 16,
    topPerRow: 3 
  });

  useEffect(() => { gameState.current.currentBalance = balance; }, [balance]);
  useEffect(() => { gameState.current.currentBet = bet; }, [bet]);
  useEffect(() => { gameState.current.autoEnabled = isAuto; }, [isAuto]);

  const initAudio = () => {
    if (!audioCtxRef.current) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      audioCtxRef.current = new AudioContext();
    }
    if (audioCtxRef.current.state === 'suspended') audioCtxRef.current.resume();
  };

  const playSound = useCallback((type) => {
    if (isMuted || !audioCtxRef.current) return;
    const ctx = audioCtxRef.current;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    const now = ctx.currentTime;
    if (type === 'hit') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(450 + Math.random() * 150, now);
      gain.gain.setValueAtTime(0.012, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
      osc.start(now);
      osc.stop(now + 0.05);
    }
  }, [isMuted]);

  const createParticles = (x, y, color, count = 5) => {
    for (let i = 0; i < count; i++) {
      gameState.current.particles.push({
        x, y,
        vx: (Math.random() - 0.5) * 4,
        vy: (Math.random() - 0.5) * 4,
        life: 1.0,
        color
      });
    }
  };

  const generateLayout = useCallback(() => {
    const state = gameState.current;
    const wrapper = scrollWrapperRef.current;
    if (!wrapper) return;

    const width = wrapper.clientWidth;
    const paddingX = 30;
    const maxAvailableWidth = width - paddingX * 2;
    state.rowCount = 16; 
    
    const pinsInLastRow = state.topPerRow + state.rowCount - 1;
    state.layoutGap = Math.min(maxAvailableWidth / (pinsInLastRow - 1), 24);

    const totalThapHeight = (state.rowCount - 1) * state.layoutGap;
    state.startY = 40; 
    const multiplierY = state.startY + totalThapHeight + 25;
    const finalHeight = multiplierY + 40; 

    state.width = width;
    state.height = finalHeight;
    
    if (canvasRef.current) {
        canvasRef.current.width = width;
        canvasRef.current.height = finalHeight;
    }

    state.pins = [];
    state.multipliers = [];
    state.gates = [];

    for (let r = 0; r < state.rowCount; r++) {
      const pinsInRow = state.topPerRow + r;
      const rowWidth = (pinsInRow - 1) * state.layoutGap;
      const startX = (width - rowWidth) / 2;
      for (let c = 0; c < pinsInRow; c++) {
        state.pins.push({ x: startX + c * state.layoutGap, y: state.startY + r * state.layoutGap, pulse: 0 });
      }
    }

    state.gates.push({
      x: width / 2 - state.layoutGap,
      y: state.startY + Math.floor(state.rowCount * 0.4) * state.layoutGap + state.layoutGap/2,
      w: state.layoutGap * 2.5,
      h: 8,
      pulse: 0,
      minX: paddingX, 
      maxX: width - paddingX - (state.layoutGap * 2.5),
      direction: 1, 
      speed: 1.2,
    });

    const currentMults = generateMultipliers(pinsInLastRow);
    const bucketW = state.layoutGap;
    const totalWMult = currentMults.length * bucketW;
    const startXMult = (width - totalWMult) / 2;

    currentMults.forEach((val, i) => {
      let color = val >= 10 ? COLORS.highMult : (val >= 2 ? COLORS.medMult : COLORS.lowMult);
      state.multipliers.push({
        x: startXMult + (i * bucketW),
        y: multiplierY, 
        w: bucketW - 2,
        h: 28,
        value: val,
        color: color,
        pulse: 0
      });
    });
  }, []);

  const executeDrop = useCallback((betAmount) => {
    const state = gameState.current;
    const topWidth = (state.topPerRow - 1) * state.layoutGap;
    const startX = (state.width - topWidth) / 2;
    const randomX = startX + Math.random() * topWidth;

    state.balls.push({
      x: randomX,
      y: state.startY - 30,
      vx: (Math.random() - 0.5) * 0.2,
      vy: 1,
      radius: state.ballSize,
      betValue: betAmount,
      currentMult: 1,
      hitGates: [],
      timestamp: Date.now()
    });
    setStats(s => ({ ...s, totalDrops: s.totalDrops + 1 }));
    setActiveBalls(state.balls.length);
  }, []);

  const update = (time) => {
    const state = gameState.current;
    if (state.autoEnabled && time - state.lastAutoDrop > AUTO_DROP_INTERVAL) {
      if (state.currentBalance >= state.currentBet) {
        setBalance(b => {
          const newB = b - state.currentBet;
          gameState.current.currentBalance = newB;
          return newB;
        });
        executeDrop(state.currentBet);
        state.lastAutoDrop = time;
      } else {
        setIsAuto(false);
      }
    }

    state.gates.forEach(g => {
      g.x += g.direction * g.speed;
      if (g.x <= g.minX || g.x >= g.maxX) g.direction *= -1;
    });

    for (let i = state.particles.length - 1; i >= 0; i--) {
      const p = state.particles[i];
      p.x += p.vx; p.y += p.vy; p.life -= 0.04;
      if (p.life <= 0) state.particles.splice(i, 1);
    }

    for (let i = state.balls.length - 1; i >= 0; i--) {
      let b = state.balls[i];
      b.vy += GRAVITY;
      b.x += b.vx; 
      b.y += b.vy;

      if (b.x < b.radius || b.x > state.width - b.radius) {
        b.vx *= -0.5;
        b.x = b.x < b.radius ? b.radius : state.width - b.radius;
      }

      state.gates.forEach((g, idx) => {
        if (b.x > g.x && b.x < g.x + g.w && b.y > g.y && b.y < g.y + g.h && !b.hitGates.includes(idx)) {
          b.hitGates.push(idx);
          b.currentMult *= 2;
          g.pulse = 1;
          createParticles(b.x, b.y, COLORS.gate, 8);
        }
      });

      state.pins.forEach(p => {
        const dx = b.x - p.x;
        const dy = b.y - p.y;
        const distSq = dx * dx + dy * dy;
        const minDist = b.radius + state.pegSize;
        if (distSq < minDist * minDist) {
          p.pulse = 1;
          playSound('hit');
          const dist = Math.sqrt(distSq);
          const nx = dx / dist;
          const ny = dy / dist;
          const speed = Math.sqrt(b.vx * b.vx + b.vy * b.vy) * BOUNCE_DAMPENING;
          b.vx = Math.cos(Math.atan2(ny, nx) + (Math.random() - 0.5) * HORIZONTAL_RANDOMNESS) * speed;
          b.vy = Math.sin(Math.atan2(ny, nx)) * speed;
          b.x = p.x + nx * (minDist + 0.1);
          b.y = p.y + ny * (minDist + 0.1);
        }
      });

      state.multipliers.forEach((m, mIdx) => {
        if (b.y > m.y && b.y < m.y + m.h && b.x > m.x && b.x < m.x + m.w) {
          const finalMult = m.value * b.currentMult;
          const totalWin = b.betValue * finalMult;
          
          setBalance(prev => prev + totalWin);
          setStats(s => ({ 
            ...s, 
            totalWins: s.totalWins + totalWin,
            bigWins: finalMult >= 10 ? s.bigWins + 1 : s.bigWins 
          }));
          
          setHistory(prev => [{ id: Math.random(), mult: finalMult, color: m.color }, ...prev].slice(0, 15)); 
          
          // Đảm bảo log chỉ có tối đa 10 dòng gần nhất
          setBetLogs(prev => {
            const newLog = {
                id: Date.now() + Math.random(),
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
                bet: b.betValue,
                multiplier: finalMult,
                payout: totalWin,
                isWin: finalMult >= 1
            };
            return [newLog, ...prev].slice(0, 10);
          });

          m.pulse = 1;
          createParticles(b.x, m.y + m.h/2, m.color, 12);
          state.balls.splice(i, 1);
          setActiveBalls(state.balls.length);
        }
      });

      if (b.y > state.height + 100) {
        state.balls.splice(i, 1);
        setActiveBalls(state.balls.length);
      }
    }
  };

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const state = gameState.current;
    ctx.clearRect(0, 0, state.width, state.height);

    ctx.strokeStyle = 'rgba(56, 189, 248, 0.08)';
    ctx.setLineDash([4, 12]);
    ctx.beginPath();
    ctx.moveTo(0, state.startY - 50);
    ctx.lineTo(state.width, state.startY - 50);
    ctx.stroke();
    ctx.setLineDash([]);

    state.pins.forEach(p => {
      ctx.fillStyle = p.pulse > 0 ? '#60a5fa' : COLORS.pin;
      ctx.beginPath();
      ctx.arc(p.x, p.y, state.pegSize + (p.pulse * 1.5), 0, Math.PI * 2);
      ctx.fill();
      if (p.pulse > 0) p.pulse -= 0.08;
    });

    state.gates.forEach(g => {
      ctx.strokeStyle = COLORS.gate;
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 2]);
      ctx.strokeRect(g.x, g.y, g.w, g.h);
      ctx.setLineDash([]);
      ctx.fillStyle = `rgba(56, 189, 248, ${0.05 + g.pulse * 0.5})`;
      ctx.fillRect(g.x, g.y, g.w, g.h);
      if (g.pulse > 0) g.pulse -= 0.05;
    });

    state.multipliers.forEach(m => {
      ctx.fillStyle = m.color;
      ctx.globalAlpha = 0.35 + (m.pulse * 0.65);
      ctx.beginPath();
      ctx.roundRect(m.x, m.y, m.w, m.h, 6);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#fff';
      ctx.font = `bold ${Math.max(7, state.layoutGap/2.2)}px monospace`;
      ctx.textAlign = 'center';
      ctx.fillText(m.value + 'x', m.x + m.w / 2, m.y + m.h / 2 + 3);
      if (m.pulse > 0) m.pulse -= 0.05;
    });

    state.particles.forEach(p => {
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 1, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;

    state.balls.forEach(b => {
      const color = b.currentMult >= 4 ? COLORS.ballMega : (b.currentMult >= 2 ? COLORS.ballSuper : COLORS.ball);
      ctx.fillStyle = color;
      ctx.shadowBlur = b.currentMult >= 2 ? 15 : 0;
      ctx.shadowColor = color;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    });
  };

  const animate = (time) => {
    update(time);
    draw();
    requestRef.current = requestAnimationFrame(animate);
  };

  useEffect(() => {
    const handleResize = () => {
      generateLayout();
    };
    window.addEventListener('resize', handleResize);
    handleResize();
    requestRef.current = requestAnimationFrame(animate);
    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(requestRef.current);
    };
  }, [generateLayout]);

  const deployBall = () => {
    initAudio();
    if (balance >= bet) {
      setBalance(b => b - bet);
      executeDrop(bet);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#020617] flex items-center justify-center p-0 md:p-4 font-sans select-none">
      <style>{`
        .game-wrapper {
          width: 100%; height: 100vh;
          background: #05070a;
          position: relative;
          overflow-y: auto;
          display: flex; flex-direction: column;
        }
        @media (min-width: 768px) {
          .game-wrapper {
            width: 380px; height: 850px;
            border-radius: 40px;
            border: 8px solid #1e293b;
            box-shadow: 0 0 50px rgba(0,0,0,0.5);
          }
        }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .logo-glow {
            text-shadow: 0 0 30px rgba(56, 189, 248, 0.4);
        }
        .content-container {
            flex-grow: 1;
            display: flex;
            flex-direction: column;
            min-height: min-content;
            background: radial-gradient(circle at 50% 30%, #0f172a 0%, #05070a 100%);
        }
        .footer-bet-panel {
            margin-top: 10px;
        }
        .history-table th {
            text-align: left;
            padding: 8px 4px;
            font-size: 8px;
            text-transform: uppercase;
            color: #64748b;
            border-bottom: 1px solid rgba(255,255,255,0.05);
        }
        .history-table td {
            padding: 10px 4px;
            font-size: 10px;
            font-weight: 700;
            border-bottom: 1px solid rgba(255,255,255,0.02);
        }
      `}</style>

      <div className="game-wrapper no-scrollbar" ref={scrollWrapperRef}>
        <div className="content-container">
            <header className="px-5 pt-6 pb-4 bg-slate-900/40 border-b border-white/5 backdrop-blur-md">
                <div className="flex justify-between items-start mb-4">
                    <div>
                    <p className="text-[10px] text-blue-400 font-black uppercase tracking-[0.2em] mb-1">Số dư</p>
                    <p className="text-xl font-black text-white">{balance.toLocaleString()}</p>
                    </div>
                    <button onClick={() => setIsMuted(!isMuted)} className="p-2.5 bg-white/5 rounded-xl border border-white/5 hover:bg-white/10 transition-all">
                    {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} className="text-blue-400" />}
                    </button>
                </div>
            </header>

            {/* Game Arena */}
            <div className="relative">
                <div className="absolute top-[20%] left-0 right-0 flex justify-center opacity-[0.05] pointer-events-none">
                    <h1 className="text-6xl font-black italic tracking-tighter text-blue-400 logo-glow">PLINKO</h1>
                </div>
                <canvas ref={canvasRef} className="block touch-none mx-auto" />
            </div>

            {/* Control Panel */}
            <div className="footer-bet-panel px-5 space-y-4">
                <div className="flex gap-1 overflow-x-auto no-scrollbar px-1 mb-2">
                    {history.map(h => (
                    <div key={h.id} className="flex-none px-2 py-1 rounded-lg bg-black/40 border border-white/10 text-[9px] font-black" style={{color: h.color}}>
                        {h.mult}x
                    </div>
                    ))}
                </div>

                <div className="flex gap-3">
                    <div className="flex-grow bg-black/40 p-3 rounded-2xl border border-white/10">
                        <p className="text-[9px] text-slate-500 font-black mb-1 uppercase tracking-wider">Tiền cược</p>
                        <div className="flex items-center gap-2">
                            <span className="text-blue-500 text-xs font-bold">$</span>
                            <input 
                            type="number" 
                            value={bet} 
                            onChange={(e) => setBet(Math.max(100, parseInt(e.target.value) || 0))}
                            className="bg-transparent text-white font-black text-base outline-none w-full"
                            />
                        </div>
                    </div>
                    <div className="flex flex-col gap-1">
                        <button onClick={() => setBet(b => b * 2)} className="px-3 py-1 bg-white/5 border border-white/10 rounded-lg text-[8px] font-bold">2X</button>
                        <button onClick={() => setBet(b => Math.max(100, b / 2))} className="px-3 py-1 bg-white/5 border border-white/10 rounded-lg text-[8px] font-bold">1/2</button>
                    </div>
                </div>

                <div className="flex gap-3">
                    <button 
                    onClick={deployBall}
                    className="flex-grow py-4 bg-gradient-to-r from-blue-600 to-blue-500 text-white rounded-2xl font-black text-sm active:scale-95 transition-all shadow-xl shadow-blue-900/20 uppercase tracking-widest"
                    >
                    Thả Bóng
                    </button>
                    <button 
                    onClick={() => setIsAuto(!isAuto)}
                    className={`w-16 rounded-2xl border transition-all flex items-center justify-center ${isAuto ? 'bg-red-500/20 border-red-500 text-red-500' : 'bg-white/5 border-white/10 text-white'}`}
                    >
                    {isAuto ? <Square size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" />}
                    </button>
                </div>
            </div>

            {/* Bet History Table Section - STRICT 10 ROWS */}
            <div className="mt-8 px-5 pb-10">
                <div className="flex items-center gap-2 mb-4">
                    <div className="p-1.5 bg-blue-500/10 rounded-lg">
                        <List size={14} className="text-blue-400" />
                    </div>
                    <h2 className="text-xs font-black uppercase tracking-[0.15em] text-white/80">Lịch sử cược (Gần nhất 10)</h2>
                </div>

                <div className="bg-black/30 rounded-2xl border border-white/5 overflow-hidden">
                    <table className="w-full history-table border-collapse">
                        <thead>
                            <tr className="bg-white/5">
                                <th className="pl-4">Thời gian</th>
                                <th>Cược</th>
                                <th>Hệ số</th>
                                <th className="pr-4 text-right">Nhận</th>
                            </tr>
                        </thead>
                        <tbody>
                            {betLogs.length === 0 ? (
                                <tr>
                                    <td colSpan="4" className="py-10 text-center text-slate-600 font-medium italic">
                                        Chưa có dữ liệu...
                                    </td>
                                </tr>
                            ) : (
                                betLogs.map(log => (
                                    <tr key={log.id} className="hover:bg-white/5 transition-colors">
                                        <td className="pl-4 text-slate-500 font-mono">
                                            <div className="flex items-center gap-1.5">
                                                <Clock size={10} />
                                                {log.time}
                                            </div>
                                        </td>
                                        <td className="text-white flex items-center gap-1">
                                            <span className="text-blue-500/50">$</span>
                                            {log.bet.toLocaleString()}
                                        </td>
                                        <td>
                                            <span className={`px-1.5 py-0.5 rounded-md ${log.multiplier >= 10 ? 'bg-red-500/20 text-red-400' : log.multiplier >= 2 ? 'bg-amber-500/20 text-amber-400' : 'bg-slate-800 text-slate-400'}`}>
                                                {log.multiplier}x
                                            </span>
                                        </td>
                                        <td className={`pr-4 text-right ${log.isWin ? 'text-emerald-400' : 'text-slate-500'}`}>
                                            <div className="flex items-center justify-end gap-1">
                                                {log.isWin ? '+' : ''}
                                                {log.payout.toLocaleString()}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
}