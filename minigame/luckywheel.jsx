import React, { useState, useEffect, useCallback } from 'react';
import { RotateCw, History, Trophy, X, Volume2, VolumeX, Sparkles, Star, Ticket, Gift } from 'lucide-react';

const PRIZES = [
  { label: '500', value: 500, color: '#00d2ff', secondaryColor: '#3a7bd5', icon: '💎' },
  { label: '100', value: 100, color: '#f8ff00', secondaryColor: '#f8d800', icon: '🟡' },
  { label: '0', value: 0, color: '#bdc3c7', secondaryColor: '#2c3e50', icon: '💀' },
  { label: '1000', value: 1000, color: '#ff00cc', secondaryColor: '#333399', icon: '🔥' },
  { label: '50', value: 50, color: '#00ff00', secondaryColor: '#008000', icon: '🍀' },
  { label: '200', value: 200, color: '#8e44ad', secondaryColor: '#2c3e50', icon: '🍇' },
  { label: 'JACKPOT', value: 5000, color: '#e74c3c', secondaryColor: '#c0392b', icon: '👑' },
  { label: '10', value: 10, color: '#f39c12', secondaryColor: '#d35400', icon: '⭐' },
];

export default function App() {
  const [spins, setSpins] = useState(5);
  const [isSpinning, setIsSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [history, setHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [showWinModal, setShowWinModal] = useState(false);
  const [lastPrize, setLastPrize] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [ledActive, setLedActive] = useState(false);

  useEffect(() => {
    const savedSpins = localStorage.getItem('wheel_spins');
    const savedHistory = localStorage.getItem('wheel_history');
    if (savedSpins) setSpins(parseInt(savedSpins));
    if (savedHistory) setHistory(JSON.parse(savedHistory));
  }, []);

  useEffect(() => {
    localStorage.setItem('wheel_spins', spins);
    localStorage.setItem('wheel_history', JSON.stringify(history));
  }, [spins, history]);

  useEffect(() => {
    let interval;
    if (isSpinning) {
      interval = setInterval(() => {
        setLedActive(prev => !prev);
      }, 150);
    } else {
      setLedActive(false);
    }
    return () => clearInterval(interval);
  }, [isSpinning]);

  const spinWheel = () => {
    if (isSpinning || spins <= 0) return;

    setSpins(prev => prev - 1);
    setIsSpinning(true);
    
    const extraDegrees = Math.floor(Math.random() * 360) + 2160; 
    const newRotation = rotation + extraDegrees;
    setRotation(newRotation);

    setTimeout(() => {
      setIsSpinning(false);
      
      const actualRotation = newRotation % 360;
      const segmentDegrees = 360 / PRIZES.length;
      const winningIndex = Math.floor(((360 - actualRotation) % 360) / segmentDegrees);
      const prize = PRIZES[winningIndex];

      setLastPrize(prize);
      setHistory(prev => [{ ...prize, time: new Date().toLocaleTimeString() }, ...prev].slice(0, 10));
      
      if (prize.value > 0) {
        setShowWinModal(true);
      }
    }, 4500);
  };

  const addFreeSpins = () => setSpins(prev => prev + 3);

  const getSegmentPath = (index, total) => {
    const angle = 360 / total;
    const startAngle = index * angle;
    const endAngle = (index + 1) * angle;
    
    const x1 = 50 + 50 * Math.cos((Math.PI * (startAngle - 90)) / 180);
    const y1 = 50 + 50 * Math.sin((Math.PI * (startAngle - 90)) / 180);
    const x2 = 50 + 50 * Math.cos((Math.PI * (endAngle - 90)) / 180);
    const y2 = 50 + 50 * Math.sin((Math.PI * (endAngle - 90)) / 180);

    return `M 50 50 L ${x1} ${y1} A 50 50 0 0 1 ${x2} ${y2} Z`;
  };

  return (
    <div className="min-h-screen bg-[#0f172a] text-white font-sans flex flex-col items-center justify-center p-6 overflow-hidden relative">
      
      {/* Dynamic Mesh Gradient Background */}
      <div className="absolute inset-0 overflow-hidden z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[70%] h-[70%] bg-gradient-to-br from-indigo-600/30 to-purple-600/30 rounded-full blur-[120px] animate-mesh-1"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[70%] h-[70%] bg-gradient-to-tl from-cyan-500/20 to-blue-600/20 rounded-full blur-[120px] animate-mesh-2"></div>
        <div className="absolute top-[20%] right-[10%] w-[40%] h-[40%] bg-pink-500/10 rounded-full blur-[100px] animate-mesh-3"></div>
      </div>

      {/* Glassmorphism Top Bar */}
      <div className="fixed top-8 left-1/2 -translate-x-1/2 w-full max-w-xl flex justify-between items-center px-8 z-50">
        <div className="flex items-center gap-4 bg-white/5 backdrop-blur-xl border border-white/10 p-2 pl-5 pr-2 rounded-full shadow-2xl">
          <div className="flex flex-col">
            <span className="text-[9px] font-black uppercase tracking-widest text-indigo-400">Welcome Back</span>
            <span className="text-sm font-bold text-white uppercase italic">DUOG</span>
          </div>
          <button onClick={addFreeSpins} className="bg-indigo-600 hover:bg-indigo-500 p-2.5 rounded-full transition-all active:scale-90 shadow-lg group">
            <Sparkles size={18} className="text-white group-hover:rotate-12 transition" />
          </button>
        </div>

        <div className="flex gap-3">
          <button onClick={() => setIsMuted(!isMuted)} className="bg-white/5 p-4 rounded-2xl border border-white/10 hover:bg-white/10 transition backdrop-blur-xl">
            {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
          </button>
          <button onClick={() => setShowHistory(true)} className="bg-white/5 p-4 rounded-2xl border border-white/10 hover:bg-white/10 transition backdrop-blur-xl">
            <History size={20} />
          </button>
        </div>
      </div>

      <div className="relative z-10 flex flex-col items-center gap-12">
        {/* Modern Header */}
        <div className="text-center">
          <h1 className="text-7xl md:text-8xl font-black tracking-tighter italic text-transparent bg-clip-text bg-gradient-to-b from-white to-white/40 drop-shadow-2xl">
            LUCKY<span className="text-indigo-500">SPIN</span>
          </h1>
          <div className="mt-2 py-1 px-4 bg-indigo-500/20 border border-indigo-500/30 rounded-full inline-block">
            <p className="text-indigo-400 font-black text-[10px] uppercase tracking-[0.6em]">OFFICIAL BY MIG30.VIP</p>
          </div>
        </div>

        {/* Wheel Section */}
        <div className="relative flex items-center justify-center">
          
          {/* Animated Glow Backing */}
          <div className={`absolute w-[340px] h-[340px] md:w-[480px] md:h-[480px] rounded-full transition-all duration-1000 ${ledActive ? 'bg-indigo-500/20 blur-[100px] scale-110' : 'bg-indigo-500/5 blur-[60px] scale-100'}`}></div>

          {/* Marquee Border */}
          <div className="absolute w-[440px] h-[440px] md:w-[540px] md:h-[540px] animate-spin-slow pointer-events-none opacity-40">
            <svg viewBox="0 0 200 200" className="w-full h-full">
              <path id="curve" fill="transparent" d="M 100, 100 m -85, 0 a 85,85 0 1,1 170,0 a 85,85 0 1,1 -170,0" />
              <text className="fill-white text-[7px] font-bold uppercase tracking-[1.5em]">
                <textPath xlinkHref="#curve">
                  MIG30.VIP • EXCLUSIVE REWARDS • MIG30.VIP • PREMIUM SPIN • MIG30.VIP • 
                </textPath>
              </text>
            </svg>
          </div>

          {/* Neon Ring */}
          <div className={`absolute w-[330px] h-[330px] md:w-[430px] md:h-[430px] rounded-full border-2 transition-all duration-300 ${ledActive ? 'border-indigo-400 shadow-[0_0_30px_rgba(129,140,248,0.8)]' : 'border-white/10'}`}></div>

          {/* Pointer */}
          <div className="absolute -top-6 left-1/2 -translate-x-1/2 z-40 filter drop-shadow-[0_10px_20px_rgba(0,0,0,0.5)]">
            <div className="w-10 h-14 bg-white clip-path-triangle relative rounded-t-full border-x-2 border-white">
               <div className="absolute inset-0 bg-gradient-to-b from-indigo-500 to-indigo-700"></div>
            </div>
          </div>

          {/* Main Wheel */}
          <div className={`relative p-3 rounded-full bg-white/5 backdrop-blur-sm border border-white/10 ${isSpinning ? 'animate-wheel-shake' : ''}`}>
            <div className="w-80 h-80 md:w-[420px] md:h-[420px] rounded-full border-[12px] border-[#1e293b] shadow-2xl p-1 bg-[#1e293b] relative overflow-hidden">
              
              <div 
                className="w-full h-full rounded-full overflow-hidden relative"
                style={{ 
                  transform: `rotate(${rotation}deg)`,
                  transitionTimingFunction: 'cubic-bezier(0.1, 0, 0.1, 1)',
                  transitionDuration: '4500ms'
                }}
              >
                <svg viewBox="0 0 100 100" className="w-full h-full scale-[1.01]">
                  <defs>
                    {PRIZES.map((prize, i) => (
                      <linearGradient key={`grad-${i}`} id={`grad-${i}`} x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" style={{ stopColor: prize.color, stopOpacity: 1 }} />
                        <stop offset="100%" style={{ stopColor: prize.secondaryColor, stopOpacity: 1 }} />
                      </linearGradient>
                    ))}
                  </defs>
                  {PRIZES.map((prize, i) => {
                    const angle = 360 / PRIZES.length;
                    const textAngle = (i * angle) + (angle / 2);
                    return (
                      <g key={i}>
                        <path 
                          d={getSegmentPath(i, PRIZES.length)} 
                          fill={`url(#grad-${i})`}
                          stroke="#1e293b"
                          strokeWidth="0.5"
                        />
                        <g transform={`rotate(${textAngle} 50 50)`}>
                          <text 
                            x="50" y="15" 
                            textAnchor="middle" 
                            className="text-[3.5px] font-black fill-white drop-shadow-md"
                          >
                            {prize.label}
                          </text>
                          <text x="50" y="28" textAnchor="middle" style={{ fontSize: '7px' }}>
                            {prize.icon}
                          </text>
                        </g>
                      </g>
                    )
                  })}
                </svg>
              </div>

              {/* Center Hub */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-20 h-20 bg-[#1e293b] rounded-full shadow-2xl flex items-center justify-center z-20 border-[6px] border-[#0f172a]">
                <div className="w-full h-full rounded-full bg-gradient-to-tr from-indigo-600 to-indigo-400 flex items-center justify-center">
                   <Star size={24} className="text-white fill-white animate-pulse" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Spin Control */}
        <div className="flex flex-col items-center gap-6">
          <div className="relative group">
            {spins > 0 && !isSpinning && (
               <div className="absolute -inset-8 bg-indigo-500/20 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition duration-700"></div>
            )}
            <button 
              onClick={spinWheel}
              disabled={isSpinning || spins <= 0}
              className={`
                relative px-20 py-7 rounded-3xl font-black transition-all active:scale-95 overflow-hidden group
                ${isSpinning || spins <= 0 
                  ? 'bg-white/5 text-white/20 border border-white/10 cursor-not-allowed' 
                  : 'bg-white text-slate-950 shadow-[0_20px_50px_rgba(255,255,255,0.15)] hover:shadow-indigo-500/40 hover:-translate-y-1'}
              `}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-indigo-500/10 to-transparent skew-x-[-25deg] -translate-x-full group-hover:animate-shine"></div>
              <div className="relative flex flex-col items-center">
                <span className="text-3xl tracking-tighter italic font-black uppercase">
                  {isSpinning ? <RotateCw className="animate-spin" size={32} /> : 'Spin Now'}
                </span>
                {!isSpinning && (
                  <div className={`mt-1 flex items-center gap-2 text-[10px] font-black tracking-widest ${spins > 0 ? 'text-indigo-600' : 'text-white/20'}`}>
                    <Ticket size={12} fill="currentColor" />
                    <span>{spins} LƯỢT QUAY</span>
                  </div>
                )}
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* History Drawer */}
      {showHistory && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-md" onClick={() => setShowHistory(false)}></div>
          <div className="relative w-full max-w-md bg-[#1e293b] rounded-[3rem] p-10 shadow-2xl border border-white/10 animate-in zoom-in-95 duration-300">
            <div className="flex justify-between items-center mb-8">
              <h3 className="text-2xl font-black italic tracking-tight text-white uppercase">Lịch sử của Duog</h3>
              <button onClick={() => setShowHistory(false)} className="p-2 hover:bg-white/10 rounded-xl transition"><X size={24}/></button>
            </div>
            <div className="space-y-3 max-h-[40vh] overflow-y-auto pr-2 custom-scrollbar">
              {history.length === 0 ? (
                <div className="py-20 text-center opacity-20 font-black uppercase tracking-widest text-white italic">
                    Chưa có phần thưởng
                </div>
              ) : (
                history.map((h, i) => (
                  <div key={i} className="flex items-center justify-between p-5 bg-white/5 rounded-2xl border border-white/5">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center text-xl">{h.icon}</div>
                      <div>
                        <p className="font-bold text-white">{h.label}</p>
                        <p className="text-[9px] text-white/40 font-bold uppercase tracking-tighter">{h.time}</p>
                      </div>
                    </div>
                    <div className="text-[10px] font-black text-indigo-400 bg-indigo-500/10 px-3 py-1 rounded-lg">SUCCESS</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Win Modal */}
      {showWinModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-indigo-950/40 backdrop-blur-2xl animate-in fade-in duration-700" onClick={() => setShowWinModal(false)}></div>
          <div className="relative w-full max-w-sm bg-white rounded-[4rem] p-12 text-center shadow-2xl transform animate-modal-pop">
            <div className="mb-8 flex justify-center">
              <div className="bg-indigo-600 p-8 rounded-[2.5rem] shadow-xl animate-bounce">
                <Trophy size={50} className="text-white" />
              </div>
            </div>
            <h2 className="text-4xl font-black text-slate-950 italic tracking-tighter mb-2 uppercase">Chúc mừng!</h2>
            <div className="bg-slate-50 py-10 rounded-[3rem] mb-8 border border-slate-100">
                <span className="text-7xl font-black text-indigo-600 tracking-tighter">{lastPrize?.label}</span>
                <p className="text-slate-400 font-bold text-[9px] uppercase tracking-widest mt-4">MIG30.VIP REWARD</p>
            </div>
            <button onClick={() => setShowWinModal(false)} className="w-full py-6 rounded-[2rem] bg-slate-950 text-white font-black text-xl hover:bg-indigo-600 transition-all shadow-xl active:scale-95">NHẬN NGAY</button>
          </div>
        </div>
      )}

      <style>{`
        .clip-path-triangle { clip-path: polygon(0% 0%, 100% 0%, 50% 100%); }
        
        @keyframes mesh-1 {
          0%, 100% { transform: translate(0, 0) rotate(0deg) scale(1); }
          50% { transform: translate(10%, 5%) rotate(5deg) scale(1.1); }
        }
        @keyframes mesh-2 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(-5%, -10%) scale(1.05); }
        }
        @keyframes mesh-3 {
          0%, 100% { opacity: 0.1; }
          50% { opacity: 0.2; }
        }

        @keyframes shine { 
          0% { transform: translateX(-150%) skewX(-25deg); } 
          100% { transform: translateX(150%) skewX(-25deg); } 
        }

        @keyframes wheel-shake {
          0%, 100% { transform: translate(0, 0); }
          25% { transform: translate(-0.5px, 0.5px); }
          50% { transform: translate(0.5px, -0.5px); }
        }

        @keyframes modal-pop {
          0% { transform: scale(0.7); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }

        .animate-mesh-1 { animation: mesh-1 15s ease-in-out infinite; }
        .animate-mesh-2 { animation: mesh-2 18s ease-in-out infinite; }
        .animate-mesh-3 { animation: mesh-3 12s ease-in-out infinite; }
        .animate-spin-slow { animation: spin-slow 20s linear infinite; }
        .animate-wheel-shake { animation: wheel-shake 0.1s infinite; }
        .animate-shine { animation: shine 3s infinite linear; }
        .animate-modal-pop { animation: modal-pop 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275); }

        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }
      `}</style>
    </div>
  );
}