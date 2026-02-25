import React, { useState, useRef, useEffect } from 'react';
import { 
  RotateCcw, Sparkles, BrainCircuit, Loader2, Timer, EyeOff, Trophy, Coins, 
  Zap, Fingerprint, Eye, Bell, Clock, BarChart3, X, ChevronRight, History, 
  TrendingUp, Plane, Target, ShieldAlert, Crosshair, Activity, MessageSquare, 
  Send, ClipboardList, User, Radio, Scan, Move, Sun, Moon, HelpCircle, ArrowUp, Bomb, Power, ShieldCheck, Flame 
} from 'lucide-react';
import { io } from "socket.io-client";

// --- Component Pháo Hoa ---
const Fireworks = () => {
  const canvasRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let width = canvas.width = window.innerWidth;
    let height = canvas.height = window.innerHeight;
    let particles = [];
    const random = (min, max) => Math.random() * (max - min) + min;
    const createFirework = (x, y) => {
      const count = 80; const hue = random(0, 360);
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2; const speed = random(2, 15);
        particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, alpha: 1, color: `hsl(${hue}, 100%, 50%)`, decay: random(0.015, 0.03) });
      }
    };
    const interval = setInterval(() => { createFirework(random(width * 0.1, width * 0.9), random(height * 0.1, height * 0.6)); }, 500);
    let animationFrameId;
    const loop = () => {
      animationFrameId = requestAnimationFrame(loop);
      ctx.globalCompositeOperation = 'destination-out'; ctx.fillStyle = 'rgba(0, 0, 0, 0.2)'; ctx.fillRect(0, 0, width, height);
      ctx.globalCompositeOperation = 'lighter';
      for (let i = particles.length - 1; i >= 0; i--) {
        let p = particles[i]; p.x += p.vx; p.y += p.vy; p.vy += 0.1; p.vx *= 0.95; p.vy *= 0.95; p.alpha -= p.decay;
        ctx.fillStyle = p.color; ctx.globalAlpha = p.alpha; ctx.beginPath(); ctx.arc(p.x, p.y, 2, 0, Math.PI * 2); ctx.fill();
        if (p.alpha <= 0) particles.splice(i, 1);
      }
    };
    loop();
    const handleResize = () => { width = canvas.width = window.innerWidth; height = canvas.height = window.innerHeight; };
    window.addEventListener('resize', handleResize);
    return () => { clearInterval(interval); cancelAnimationFrame(animationFrameId); window.removeEventListener('resize', handleResize); };
  }, []);
  return <canvas ref={canvasRef} className="fixed inset-0 z-[150] pointer-events-none" />;
};

// --- Hằng số Toàn cục ---
const CHIP_LIST = [
  { value: 1000, color: 'from-slate-600 to-slate-800' },
  { value: 5000, color: 'from-emerald-700 to-emerald-900' },
  { value: 10000, color: 'from-sky-700 to-sky-900' },
  { value: 50000, color: 'from-amber-600 to-amber-800' },
  { value: 100000, color: 'from-purple-700 to-purple-900' },
  { value: 500000, color: 'from-red-700 to-red-900' },
  { value: 1000000, color: 'from-yellow-500 to-yellow-700' }
];

// --- Thành phần Xúc xắc 3D Tactical ---
const RealisticDice = ({ value, isRolling, position, isRevealed, isDarkMode }) => {
  const faceRotations = {
    1: 'rotateX(0deg) rotateY(0deg)',
    2: 'rotateX(-90deg) rotateY(0deg)',
    3: 'rotateX(0deg) rotateY(-90deg)',
    4: 'rotateX(0deg) rotateY(90deg)',
    5: 'rotateX(90deg) rotateY(0deg)',
    6: 'rotateX(180deg) rotateY(0deg)',
  };

  const dots = {
    1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8]
  };

  const Face = ({ num, transform }) => (
    <div 
      className={`absolute w-full h-full border-2 flex flex-wrap p-1.5 shadow-[inset_0_0_12px_rgba(0,0,0,0.8)] rounded-md overflow-hidden transition-all duration-300
        ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-slate-200 border-slate-400'}`}
      style={{ transform, backfaceVisibility: 'hidden' }}
    >
      <div className={`absolute inset-0 opacity-20 ${isDarkMode ? 'bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.1)_0%,transparent_70%)]' : 'bg-[radial-gradient(circle_at_center,rgba(0,0,0,0.05)_0%,transparent_70%)]'}`} />
      <div className={`absolute top-0.5 right-1 text-[4px] font-mono tracking-tighter uppercase ${isDarkMode ? 'text-slate-500' : 'text-slate-600'}`}>K-SOÁT</div>
      
      {[...Array(4)].map((_, i) => (
          <div key={i} className={`absolute w-0.5 h-0.5 rounded-full border shadow-inner ${isDarkMode ? 'bg-slate-700 border-slate-600' : 'bg-slate-400 border-slate-300'} 
            ${i === 0 ? 'top-1 left-1' : i === 1 ? 'top-1 right-1' : i === 2 ? 'bottom-1 left-1' : 'bottom-1 right-1'}`} />
      ))}

      {[...Array(9)].map((_, i) => (
        <div key={i} className="w-1/3 h-1/3 flex items-center justify-center">
          {dots[num] && dots[num].includes(i) && (
            <div className="relative group">
                <div className={`absolute inset-0 w-2.5 h-2.5 -translate-x-[1px] -translate-y-[1px] rounded-full border scale-150 opacity-40 ${isDarkMode ? 'border-slate-600/50' : 'border-slate-400/50'}`} />
                <div 
                    className={`w-2 h-2 rounded-full shadow-[0_0_10px_currentColor] border border-white/20 ${
                        num === 1 || num === 4 ? 'text-red-500 bg-red-600' : 'text-sky-400 bg-sky-500'
                    }`} 
                />
            </div>
          )}
        </div>
      ))}
    </div>
  );

  return (
    <div 
      className={`absolute transition-all duration-1000 cubic-bezier(0.34, 1.56, 0.64, 1) z-10`} 
      style={{ 
        left: `${position.x}%`, 
        top: `${position.y}%`, 
        transform: `translate(-50%, -50%) rotateZ(${position.zRot}deg) ${isRevealed ? 'scale(1.3)' : 'scale(1)'}` 
      }}
    >
      <div className="absolute w-11 h-3 bg-black/60 blur-md rounded-full translate-y-7 translate-x-1 -rotate-12" />
      <div className="w-11 h-11 [perspective:600px]">
        <div 
          className={`relative w-full h-full [transform-style:preserve-3d] transition-transform duration-1000 ${isRolling ? 'animate-dice-wild' : ''}`} 
          style={{ transform: !isRolling ? faceRotations[value] : undefined }}
        >
          <Face num={1} transform="translateZ(22px)" />
          <Face num={6} transform="rotateY(180deg) translateZ(22px)" />
          <Face num={3} transform="rotateY(90deg) translateZ(22px)" />
          <Face num={4} transform="rotateY(-90deg) translateZ(22px)" />
          <Face num={2} transform="rotateX(90deg) translateZ(22px)" />
          <Face num={5} transform="rotateX(-90deg) translateZ(22px)" />
        </div>
      </div>
    </div>
  );
};

// --- Component Chip ---
const MilitaryChip = ({ value, colorClass, isSelected, onClick, isDarkMode }) => {
  const displayValue = value >= 1000000 ? `${value / 1000000}M` : value >= 1000 ? `${value / 1000}K` : value;
  return (
    <button
      onClick={onClick}
      className={`relative w-11 h-14 flex flex-col items-center justify-center transition-all duration-300 active:scale-90
        ${isSelected ? 'scale-115 -translate-y-2 z-10' : 'opacity-40 hover:opacity-100'}
      `}
    >
      <div className={`w-full h-full bg-gradient-to-br ${colorClass} rounded-md shadow-[0_5px_0_rgba(0,0,0,0.6)] border border-white/20`} 
           style={{ clipPath: 'polygon(20% 0%, 80% 0%, 100% 15%, 100% 85%, 80% 100%, 20% 100%, 0% 85%, 0% 15%)' }}>
          <div className="w-full h-full flex flex-col items-center justify-center relative">
            <div className={`absolute top-1.5 w-1.5 h-1.5 rounded-full shadow-inner ${isDarkMode ? 'bg-slate-900' : 'bg-slate-300'}`} />
            <span className="text-[10px] font-black text-white leading-none drop-shadow-lg tracking-tighter mt-1">{displayValue}</span>
          </div>
      </div>
      {isSelected && (
        <div className="absolute -inset-1.5 border border-sky-400 rounded-lg animate-pulse shadow-[0_0_15px_rgba(56,189,248,0.5)] z-[-1]" />
      )}
    </button>
  );
};

const FighterJet = () => (
    <div className="relative w-16 h-12 animate-jet-patrol mr-2 flex items-center justify-center scale-95">
        <svg viewBox="0 0 120 80" className="w-full h-full drop-shadow-[0_0_10px_rgba(56,189,248,0.6)]">
            <path d="M10 40 L40 35 L100 38 L115 40 L100 42 L40 45 Z" fill="#475569" stroke="#1e293b" strokeWidth="1" />
            <path d="M45 35 L30 10 L70 38 Z" fill="#64748b" stroke="#1e293b" strokeWidth="1" />
            <path d="M45 45 L30 70 L70 42 Z" fill="#64748b" stroke="#1e293b" strokeWidth="1" />
            <path d="M85 38 Q95 35 105 38 Q95 41 85 38" fill="#38bdf8" opacity="0.8" />
            <circle cx="10" cy="40" r="4" fill="#f59e0b" className="animate-pulse" />
            <text x="45" y="32" fontSize="6" fontWeight="bold" fill="#fff" transform="rotate(-15, 45, 32)">MIG30</text>
        </svg>
        <div className="absolute -top-1 -right-2 bg-red-600 text-[6px] font-black px-1 rounded-sm border border-white/20 shadow-lg italic animate-bounce">VIP</div>
    </div>
);

// --- Component Slot Reel (Cuộn Slot) ---
const SlotReel = ({ value, isSpinning, isDarkMode }) => {
  return (
    <div className="relative w-20 h-28 bg-[#111] border-2 border-[#444] rounded-md overflow-hidden shadow-[inset_0_0_10px_#000]">
      <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black/60 z-10 pointer-events-none"></div>
      {isSpinning ? (
        <div className="w-full flex flex-col items-center animate-slot-scroll opacity-50 blur-[1px]">
           {[...Array(6)].map((_, i) => (
             <div key={i} className="w-full h-28 flex items-center justify-center border-b border-white/5">
                <div className="w-12 h-12 bg-white/10 rounded-full"></div>
             </div>
           ))}
        </div>
      ) : (
        <div className="w-full h-full relative animate-land-reel">
           <RealisticDice value={value} isRolling={false} position={{x:50, y:50, zRot:0}} isRevealed={true} isDarkMode={isDarkMode} />
        </div>
      )}
    </div>
  )
}

const App = () => {
  // --- States ---
  const [balance, setBalance] = useState(15000000);
  const [jackpot, setJackpot] = useState(128464468);
  const [selectedChip, setSelectedChip] = useState(1000);
  const [currentUser, setCurrentUser] = useState(null);
  const [bets, setBets] = useState({ tai: 0, xiu: 0, bao: 0 });
  const [session, setSession] = useState(12042);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [timeLeft, setTimeLeft] = useState(60); 
  const [phase, setPhase] = useState("BETTING");
  
  // Dữ liệu trò chơi
  const [gameHistory, setGameHistory] = useState([
    { type: 'T', sum: 14 }, { type: 'X', sum: 8 }, { type: 'T', sum: 12 }, { type: 'B', sum: 18 },
    { type: 'X', sum: 5 }, { type: 'T', sum: 11 }, { type: 'X', sum: 10 }, { type: 'T', sum: 15 }
  ]);
  const [betHistory, setBetHistory] = useState([]);
  const [winningAreas, setWinningAreas] = useState([]); 
  
  // Xúc xắc & Bát
  const [dice, setDice] = useState([3, 3, 3]);
  const [dicePositions, setDicePositions] = useState([{ x: 50, y: 50, zRot: 0 }, { x: 50, y: 50, zRot: 0 }, { x: 50, y: 50, zRot: 0 }]);
  const [isRolling, setIsRolling] = useState(false);
  const [isReadyToScratch, setIsReadyToScratch] = useState(false);
  const [isScratchedDone, setIsScratchedDone] = useState(false);
  const [isSqueezeEnabled, setIsSqueezeEnabled] = useState(true);
  
  // Logic Nặn bát
  const [bowlOffset, setBowlOffset] = useState({ x: 0, y: 0 });
  const [isBowlFading, setIsBowlFading] = useState(false); // Trạng thái tan biến của bát
  const [isDragging, setIsDragging] = useState(false);
  const isDraggingBowl = useRef(false);
  const bowlRef = useRef(null);
  const dragStart = useRef({ x: 0, y: 0 });

  // Fix rung lắc: Chỉ để React kiểm soát vị trí khi KHÔNG kéo. Khi kéo, DOM được cập nhật trực tiếp.
  useEffect(() => {
    if (bowlRef.current && !isDragging) {
      bowlRef.current.style.transform = `translate(${bowlOffset.x}px, ${bowlOffset.y}px)`;
    }
  }, [bowlOffset, isDragging]);

  // Ref để theo dõi phase hiện tại trong socket callback mà không cần dependency
  const phaseRef = useRef(phase);
  useEffect(() => { phaseRef.current = phase; }, [phase]);

  // Modals
  const [showRoadmap, setShowRoadmap] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showSessionBets, setShowSessionBets] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  
  const [messages, setMessages] = useState([{ id: 1, user: 'Phi_Công_Elite', text: 'Kéo bát ra ngoài đi chỉ huy!', time: '16:00' }]);
  const [chatInput, setChatInput] = useState('');
  const [sessionBets, setSessionBets] = useState([{ id: 'PhiCông_99', target: 'TAI', amount: 5000000 }]);
  const [prediction, setPrediction] = useState(null);
  const [showBigWin, setShowBigWin] = useState(false);
  const [refundNotification, setRefundNotification] = useState(null);
  const [chipAnimations, setChipAnimations] = useState([]); // Thêm khai báo state này
  
  // State cho Spin Hũ
  const [showSpinModal, setShowSpinModal] = useState(false);
  const [jackpotResult, setJackpotResult] = useState(null);
  const [spinDiceVals, setSpinDiceVals] = useState([1,1,1]);
  const [isSpinning, setIsSpinning] = useState(false);
  const [spinFinished, setSpinFinished] = useState(false);
  const serverJackpotData = useRef(null);

  // --- Helper Functions ---

  const getSessionStats = (target) => {
    const targetBets = sessionBets.filter(b => b.target === target);
    return { totalAmount: targetBets.reduce((s, b) => s + b.amount, 0), totalPlayers: new Set(targetBets.map(b => b.id)).size };
  };

  const calculateWinnings = (currentDice) => {
    if (!currentDice || currentDice.length !== 3) return;
    const d1 = Number(currentDice[0]); const d2 = Number(currentDice[1]); const d3 = Number(currentDice[2]);
    const sum = d1 + d2 + d3; const isTriple = (d1 === d2) && (d2 === d3);
    let res;
    if (isTriple) {
        if (sum === 3) res = 'X'; else if (sum === 18) res = 'T'; else res = 'B';
    } else { res = sum >= 11 ? 'T' : 'X'; }

    const wins = []; if (res === 'T') wins.push('tai'); if (res === 'X') wins.push('xiu'); if (res === 'B') wins.push('bao');
    setWinningAreas(wins);
    let totalWin = 0;
    let winAmount = 0; // Initialize winAmount here
    Object.keys(bets).forEach(type => {
        const betVal = bets[type];
        winAmount = ((type === 'tai' && res === 'T') || (type === 'xiu' && res === 'X')) ? Math.floor(betVal * 1.96) : (type === 'bao' && res === 'B') ? betVal * 30 : 0;
        setBetHistory(prev => [{ session, type: type.toUpperCase(), amount: betVal, result: res, winAmount, time: new Date().toLocaleTimeString().slice(0, 5) }, ...prev]);
        if (betVal > 0 && winAmount > 0) { totalWin += winAmount; setBalance(p => p + winAmount); }
    });
    if (totalWin >= 2000000) { setShowBigWin(true); setTimeout(() => setShowBigWin(false), 6000); }
    setGameHistory(prev => [{ type: res, sum }, ...prev].slice(0, 100));
  };

  const startResultPhase = () => {
    setPhase("RESULT"); setIsScratchedDone(true); setIsReadyToScratch(false); 
    calculateWinnings(dice);

    // KIỂM TRA ĐIỀU KIỆN HIỆN SPIN HŨ
    if (serverJackpotData.current) {
        const { trigger } = serverJackpotData.current;
        const hasBetXiu = bets.xiu > 0;
        const hasBetTai = bets.tai > 0;
        if ((trigger === '111' && hasBetXiu) || (trigger === '666' && hasBetTai)) {
             setJackpotResult(serverJackpotData.current); setShowSpinModal(true); setIsSpinning(true); setSpinFinished(false);
             setTimeout(() => { setSpinDiceVals(serverJackpotData.current.spinDice); setIsSpinning(false); setSpinFinished(true); }, 3000);
        }
    }
  };

  const startNewSession = () => {
    setPhase("BETTING");
    setBets({ tai: 0, xiu: 0, bao: 0 });
    setWinningAreas([]); 
    setBowlOffset({ x: 0, y: 0 });
    setIsBowlFading(false);
    setIsScratchedDone(false); // <--- Đảm bảo trạng thái nặn bát được reset
    setIsReadyToScratch(false); // <--- Đảm bảo trạng thái sẵn sàng nặn được reset
    serverJackpotData.current = null; // <--- Reset dữ liệu jackpot từ server
    setJackpotResult(null); // <--- Xóa kết quả jackpot cũ trên UI
    setShowSpinModal(false); // <--- Đóng modal spin nếu đang mở
    setSpinFinished(false); // <--- Reset trạng thái spin
    if (isDemoMode) setSession(s => s + 1); // Tự tăng session nếu chạy Demo
    setSessionBets([
        { id: `PhiCông_${Math.floor(Math.random()*999)}`, target: Math.random() > 0.5 ? 'TAI' : 'XIU', amount: Math.floor(Math.random()*10)*100000 },
        { id: `PhiCông_${Math.floor(Math.random()*999)}`, target: Math.random() > 0.5 ? 'TAI' : 'XIU', amount: Math.floor(Math.random()*10)*100000 }
    ]);
  };

  const startRollingPhase = async (serverDice) => {
    setPhase("SCRATCHING"); setIsRolling(true); setWinningAreas([]);
    
    // Nếu có dice từ server truyền vào thì dùng, không thì random (cho demo)
    const newDice = serverDice || [Math.floor(Math.random()*6)+1, Math.floor(Math.random()*6)+1, Math.floor(Math.random()*6)+1];

    setDicePositions(getSectorPositions(false));
    setTimeout(() => { setDice(newDice); setIsRolling(false); setIsReadyToScratch(true); }, 1500);
  };

  const togglePrediction = () => {
    if (prediction) setPrediction(null);
    else {
        const lastSum = gameHistory[0]?.sum || 10;
        const nextSum = Math.max(3, Math.min(18, lastSum + (Math.floor(Math.random() * 6) - 3)));
        setPrediction({ sum: nextSum, type: nextSum >= 11 ? 'T' : 'X' });
    }
  };

  // Tự động mở bát nếu tắt chế độ nặn
  useEffect(() => {
    if (phase === "SCRATCHING" && isReadyToScratch && !isScratchedDone && !isSqueezeEnabled) {
        startResultPhase();
    }
  }, [phase, isReadyToScratch, isScratchedDone, isSqueezeEnabled]);

  // --- LOGIC NẶN BÁT "TỰ DO - TAN BIẾN" ---
  const handleBowlStart = (e) => {
    if (!isReadyToScratch || isScratchedDone || isBowlFading || !isSqueezeEnabled) return;
    isDraggingBowl.current = true;
    const x = e.touches ? e.touches[0].clientX : e.clientX;
    const y = e.touches ? e.touches[0].clientY : e.clientY;
    dragStart.current = { x: x - bowlOffset.x, y: y - bowlOffset.y };
  };

  const handleBowlMove = (e) => {
    if (!isDraggingBowl.current || !bowlRef.current) return;
    const x = e.touches ? e.touches[0].clientX : e.clientX; const y = e.touches ? e.touches[0].clientY : e.clientY;
    const newX = x - dragStart.current.x; const newY = y - dragStart.current.y;
    bowlRef.current.style.transform = `translate(${newX}px, ${newY}px)`; // Cập nhật trực tiếp DOM
    const dist = Math.sqrt(newX * newX + newY * newY);
    
    // Tăng ngưỡng khoảng cách lên 170 để cảm giác "kéo ra khỏi đĩa" rõ ràng hơn
    if (dist > 170) { 
        isDraggingBowl.current = false; 
        setBowlOffset({ x: newX, y: newY }); 
        setIsBowlFading(true); 
        // Mở kết quả ngay lập tức khi bát mờ đi
        startResultPhase(); 
    }
  };

  const handleBowlEnd = () => {
    if (!isDraggingBowl.current || !bowlRef.current) return; isDraggingBowl.current = false;
    const transform = bowlRef.current.style.transform; const match = transform.match(/translate\((.+)px, (.+)px\)/);
    // Nếu thả tay mà chưa mở bát (chưa kéo đủ xa), tự động snap về 0,0 (vị trí giữa)
    if (match) { setBowlOffset({ x: 0, y: 0 }); }
  };

  const handleSendMessage = () => {
    if (!chatInput.trim()) return;
    setMessages(prev => [...prev, { id: Date.now(), user: 'duog', text: chatInput, time: new Date().toLocaleTimeString().slice(0, 5) }]);
    setChatInput('');
  };

  const getWinnerStyle = (id) => {
    if (phase !== "RESULT" && !(phase === "SCRATCHING" && isScratchedDone)) return "";
    if (winningAreas.includes(id)) return `ring-4 ring-sky-400 shadow-[0_0_50px_rgba(56,189,248,0.8)] animate-pulse z-20 scale-[1.03] ${isDarkMode ? 'bg-sky-900/50 border-sky-300' : 'bg-sky-200/80 border-sky-500'}`;
    return "opacity-30 grayscale";
  };

  const getSectorPositions = (isSpreading = false) => {
    const jitter = isSpreading ? 0 : 3; 
    return [
      { x: 30 + (Math.random() * jitter), y: 35 + (Math.random() * jitter), zRot: Math.random() * 360 },
      { x: 70 + (Math.random() * jitter), y: 35 + (Math.random() * jitter), zRot: Math.random() * 360 },
      { x: 50 + (Math.random() * jitter), y: 72 + (Math.random() * jitter), zRot: Math.random() * 360 }
    ];
  };

  const renderRoadmap = () => {
    const columns = []; let currentColumn = []; let lastType = null;
    [...gameHistory].reverse().forEach((item) => {
        if (item.type !== lastType && lastType !== null) { columns.push(currentColumn); currentColumn = [item]; }
        else { if (currentColumn.length >= 6) { columns.push(currentColumn); currentColumn = [item]; } else { currentColumn.push(item); } }
        lastType = item.type;
    });
    columns.push(currentColumn);
    const displayCols = columns.slice(-13); 
    
    return (
        <div className={`relative flex gap-1 overflow-x-auto p-3 rounded-xl border h-48 scrollbar-hide ${isDarkMode ? 'bg-black/60 border-sky-900/50' : 'bg-slate-300 border-slate-400'}`}>
            <div className="absolute inset-0 pointer-events-none opacity-20" style={{ backgroundImage: `linear-gradient(to right, ${isDarkMode ? '#1e293b' : '#94a3b8'} 1px, transparent 1px), linear-gradient(to bottom, ${isDarkMode ? '#1e293b' : '#94a3b8'} 1px, transparent 1px)`, backgroundSize: 'calc(100% / 13) calc(100% / 6)' }}></div>
            {displayCols.map((col, idx) => (
                <div key={idx} className="flex flex-col gap-1 w-[calc(100%/13)] min-w-[24px] z-10">
                    {col.map((item, i) => (
                        <div key={i} className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-black border shadow-lg
                            ${item.type === 'T' ? 'bg-blue-600 border-blue-400 text-white' : item.type === 'X' ? 'bg-red-600 border-red-400 text-white' : 'bg-yellow-500 border-yellow-200 text-black'}`}>
                            {String(item.type)}
                        </div>
                    ))}
                </div>
            ))}
        </div>
    );
  };

  // --- XỬ LÝ ĐĂNG NHẬP TỰ ĐỘNG ---
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    if (token) {
      fetch('http://localhost:4001/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token })
      })
      .then(res => res.json())
      .then(data => {
        if (data.success) { setCurrentUser(data.user); setBalance(data.user.balance); }
      }).catch(err => console.error(err));
    }
  }, []);

  // Hiệu ứng thay đổi số liên tục khi đang quay Spin
  useEffect(() => {
    if (isSpinning) {
        const interval = setInterval(() => {
            setSpinDiceVals([Math.floor(Math.random()*6)+1, Math.floor(Math.random()*6)+1, Math.floor(Math.random()*6)+1]);
        }, 80);
        return () => clearInterval(interval);
    }
  }, [isSpinning]);


  // --- ĐỒNG BỘ SERVER ---
  useEffect(() => {
    let isMounted = true;
    // 1. Logic chạy Demo (Offline)
    if (isDemoMode) {
      const timer = setInterval(() => {
        if (!isMounted) return;
        setTimeLeft((prev) => {
          if (prev <= 1) {
            if (phase === "BETTING") { 
                startRollingPhase(); 
                return 15; 
            }
            else if (phase === "SCRATCHING") { 
                if (!isScratchedDone) startResultPhase(); 
                return 10; 
            }
            else { 
                startNewSession(); 
                return 60; 
            }
          }
          return prev - 1;
        });
      }, 1000);
      return () => { isMounted = false; clearInterval(timer); };
    }

    // 2. Logic đồng bộ Server (Online) - SOCKET.IO
    const socket = io('http://localhost:4001', { transports: ['websocket'] });
    
    socket.on('connect', () => {
        console.log('[Socket] Connected to server');
    });

    socket.on('taixiunan', (data) => {
        if (!isMounted) return;
        setTimeLeft(data.timeLeft);
        if (data.jackpot) setJackpot(data.jackpot);
        if (data.jackpotResult) serverJackpotData.current = data.jackpotResult;
        if (data.sessionId !== session) setSession(data.sessionId);
        
        // Sử dụng phaseRef để kiểm tra trạng thái hiện tại
        if (data.phase === 'RESULT' && phaseRef.current === 'BETTING') startRollingPhase(data.dice);
        if (data.phase === 'BETTING' && phaseRef.current !== 'BETTING') startNewSession();
    });

    socket.on('connect_error', () => {
        console.log("Socket connect error, switching to demo");
        setIsDemoMode(true);
    });

    return () => { isMounted = false; socket.disconnect(); };
  }, [isDemoMode, session]); // Bỏ phase khỏi dependency để tránh reconnect liên tục

  // --- BOT TỰ ĐỘNG ---
  useEffect(() => {
    if (phase !== "BETTING") return;
    const botInterval = setInterval(() => {
        if (Math.random() > 0.3) {
            const botNames = ['MIG', 'Su-30', 'F-22', 'Pilot', 'Radar', 'Ghost'];
            const randomName = `${botNames[Math.floor(Math.random() * botNames.length)]}_${Math.floor(Math.random() * 999)}`;
            const target = Math.random() < 0.45 ? 'TAI' : (Math.random() < 0.9 ? 'XIU' : 'BAO');
            const amount = [10000, 50000, 100000, 500000][Math.floor(Math.random() * 4)];
            setSessionBets(prev => [{ id: randomName, target, amount }, ...prev].slice(0, 100));
            if (Math.random() > 0.85) {
                const msgs = ['Cầu đẹp quá', 'Vào Tài đi', 'Nặn thôi chỉ huy', 'Húp hũ rồi'];
                setMessages(prev => [...prev, { id: Date.now(), user: randomName, text: msgs[Math.floor(Math.random() * msgs.length)], time: new Date().toLocaleTimeString().slice(0, 5) }].slice(-20));
            }
        }
    }, 1000);
    return () => clearInterval(botInterval);
  }, [phase]);

  // --- CÂN CỬA ---
  useEffect(() => {
    if (phase === 'BETTING' && timeLeft === 4) {
        const taiTotal = sessionBets.filter(b => b.target === 'TAI').reduce((s, b) => s + b.amount, 0);
        const xiuTotal = sessionBets.filter(b => b.target === 'XIU').reduce((s, b) => s + b.amount, 0);
        const diff = Math.abs(taiTotal - xiuTotal);
        if (diff > 500000) {
            const largerSide = taiTotal > xiuTotal ? 'TAI' : 'XIU'; // Use uppercase for consistency with sessionBets.target
            const largerSideTotal = largerSide === 'TAI' ? taiTotal : xiuTotal;
            const betsOnLargerSide = sessionBets.filter(b => b.target === largerSide);

            // The total amount to be refunded from the larger side to balance it.
            // We refund the 'diff' amount.
            const totalRefundAmountToDistribute = diff;

            // Map to store actual refunds for each player ID
            const playerRefunds = {};
            
            // Calculate proportional refunds for each bet on the larger side
            betsOnLargerSide.forEach(bet => {
                // Calculate the proportional share of the total refund amount
                const proportionalRefund = (bet.amount / largerSideTotal) * totalRefundAmountToDistribute;
                // Round to nearest 1000 for practical currency handling
                const roundedRefund = Math.ceil(proportionalRefund / 1000) * 1000; 
                
                if (!playerRefunds[bet.id]) {
                    playerRefunds[bet.id] = 0;
                }
                playerRefunds[bet.id] += roundedRefund;
            });

            // Update user's balance and bets if they are affected
            const myId = currentUser ? `User_${currentUser.userId}` : 'duog (Bạn)';
            const userRefundAmount = playerRefunds[myId] || 0;

            if (userRefundAmount > 0) {
                setBalance(prev => prev + userRefundAmount);
                setBets(prev => ({ ...prev, [largerSide.toLowerCase()]: prev[largerSide.toLowerCase()] - userRefundAmount }));
                
                // Update user's bet in sessionBets
                setSessionBets(prev => prev.map(b => {
                    if (b.id === myId && b.target === largerSide) {
                        return { ...b, amount: b.amount - userRefundAmount };
                    }
                    return b;
                }));

                setRefundNotification({ amount: userRefundAmount, side: largerSide });
                setTimeout(() => setRefundNotification(null), 5000);
            }
        }
    }
  }, [timeLeft, phase, bets, sessionBets, currentUser]); // Dòng này bị thiếu
  const handleBet = (type, e) => {
    if (phase !== "BETTING" || balance < selectedChip) return;
    if ((type === 'tai' && bets.xiu > 0) || (type === 'xiu' && bets.tai > 0)) return;
    
    const targetRect = e.currentTarget.getBoundingClientRect();
    const endX = targetRect.left + targetRect.width / 2 + (Math.random() * targetRect.width * 0.4 - targetRect.width * 0.2);
    const endY = targetRect.top + targetRect.height / 2 + (Math.random() * targetRect.height * 0.4 - targetRect.height * 0.2);
    const chipInfo = CHIP_LIST.find(c => c.value === selectedChip);
    const animId = Date.now() + Math.random();

    const myId = currentUser ? `User_${currentUser.userId}` : 'duog (Bạn)';

    setChipAnimations(prev => [...prev, { id: animId, startX: window.innerWidth/2, startY: window.innerHeight-60, endX, endY, colorClass: chipInfo.color, value: selectedChip }]);
    setBets(prev => ({ ...prev, [type]: prev[type] + selectedChip }));
    setBalance(prev => prev - selectedChip);

    setSessionBets(prev => {
        const existing = prev.find(b => b.id === myId && b.target === type.toUpperCase());
        if (existing) {
            return prev.map(b => b === existing ? { ...b, amount: b.amount + selectedChip } : b);
        }
        return [{ id: myId, target: type.toUpperCase(), amount: selectedChip }, ...prev];
    });

    fetch('http://localhost:4001/api/game/bet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, amount: selectedChip, id: myId, game: 'taixiunan' })
    }).then(res => res.json()).then(data => {
        if (data.success && data.newBalance !== undefined) setBalance(data.newBalance);
        else { setBalance(prev => prev + selectedChip); alert(data.error || "Đặt cược thất bại"); }
    }).catch(e => console.error(e));
    setTimeout(() => {
        setChipAnimations(prev => prev.filter(a => a.id !== animId));
    }, 600);
  };

  const taiStats = getSessionStats('TAI');
  const xiuStats = getSessionStats('XIU');
  const baoStats = getSessionStats('BAO');

  return (
    <div className={`flex flex-col min-h-screen w-full max-w-md mx-auto overflow-y-auto relative select-none font-mono transition-colors duration-500
  ${isDarkMode ? 'bg-[#07090c] text-white' : 'bg-slate-100 text-slate-900'}`}>

      
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@800&display=swap');
        .tactical-font { font-family: 'Orbitron', sans-serif; }
        @keyframes jet-patrol { 0%, 100% { transform: translateY(0) rotate(5deg); } 50% { transform: translateY(-8px) rotate(-5deg); } }
        .animate-jet-patrol { animation: jet-patrol 3s ease-in-out infinite; }
        .radar-line { position: absolute; width: 100%; height: 100%; background: conic-gradient(from 0deg, transparent 0%, rgba(56,189,248,0.15) 10%, transparent 20%); border-radius: 50%; animation: rotate 4s linear infinite; }
        @keyframes rotate { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .bowl-rim { animation: neon-glow 2s ease-in-out infinite; }
        @keyframes neon-glow { 0%, 100% { border-color: rgba(56, 189, 248, 0.5); box-shadow: 0 0 10px rgba(56, 189, 248, 0.2); } 50% { border-color: rgba(56, 189, 248, 1); box-shadow: 0 0 20px rgba(56, 189, 248, 0.5); } }
        @keyframes bowl-shake { 0%, 100% { transform: translate(0, 0); } 20% { transform: translate(-3px, 2px); } 40% { transform: translate(3px, -2px); } 60% { transform: translate(-3px, -2px); } 80% { transform: translate(3px, 2px); } }
        .animate-bowl-shake { animation: bowl-shake 0.3s infinite; }
        @keyframes slot-scroll { 0% { transform: translateY(0); } 100% { transform: translateY(-50%); } }
        .animate-slot-scroll { animation: slot-scroll 0.1s linear infinite; }
        @keyframes land-reel { 0% { transform: translateY(-20px); } 50% { transform: translateY(10px); } 100% { transform: translateY(0); } }
        .animate-land-reel { animation: land-reel 0.3s ease-out forwards; }
      `}</style>

      {/* Header */}
      <div className="pt-4 px-4 z-[60]">
        <div className={`w-full h-14 rounded-xl border-2 overflow-hidden flex items-center justify-between px-4 shadow-xl transition-colors ${isDarkMode ? 'border-slate-700 bg-[#0f172a]' : 'border-slate-300 bg-white'}`}>
            <div className="flex items-center"><FighterJet /><div className="flex flex-col leading-none"><span className="text-[10px] font-black text-sky-400 tracking-tighter uppercase">TRUNG TÂM TÁC CHIẾN</span><span className={`text-[7px] tracking-widest uppercase ${isDarkMode ? 'text-white/30' : 'text-slate-400'}`}>MIG-30 ELITE</span></div></div>
            <div className="text-xl tactical-font text-yellow-500">{(jackpot).toLocaleString()}</div>
        </div>
      </div>

      {/* Nav */}
      <div className="px-4 py-2 flex justify-between items-center z-50">
          <div className="flex gap-1.5">
            <button onClick={() => setShowRoadmap(true)} className={`p-1.5 rounded border active:scale-95 transition-all ${isDarkMode ? 'bg-slate-800 border-sky-500/30' : 'bg-white border-sky-500'}`}><BarChart3 size={14} className="text-sky-400" /></button>
            <button onClick={() => setShowHistory(true)} className={`p-1.5 rounded border active:scale-95 transition-all ${isDarkMode ? 'bg-slate-800 border-emerald-500/30' : 'bg-white border-emerald-500'}`}><History size={14} className="text-emerald-400" /></button>
            <button onClick={() => setShowChat(true)} className={`p-1.5 rounded border active:scale-95 transition-all ${isDarkMode ? 'bg-slate-800 border-purple-500/30' : 'bg-white border-purple-500'}`}><MessageSquare size={14} className="text-purple-400" /></button>
            <button onClick={() => setShowSessionBets(true)} className={`p-1.5 rounded border active:scale-95 transition-all ${isDarkMode ? 'bg-slate-800 border-amber-500/30' : 'bg-white border-amber-500'}`}><ClipboardList size={14} className="text-amber-400" /></button>
            <button onClick={() => setIsDarkMode(!isDarkMode)} className={`p-1.5 rounded border active:scale-95 transition-all ${isDarkMode ? 'bg-slate-800 border-yellow-500/30' : 'bg-slate-900 border-yellow-500'}`}>{isDarkMode ? <Sun size={14} className="text-yellow-400" /> : <Moon size={14} className="text-white" />}</button>
            <button onClick={() => setIsSqueezeEnabled(!isSqueezeEnabled)} className={`p-1.5 rounded border active:scale-95 transition-all ${isDarkMode ? 'bg-slate-800 border-pink-500/30' : 'bg-white border-pink-500'}`} title={isSqueezeEnabled ? "Tắt chế độ nặn" : "Bật chế độ nặn"}>
                <Fingerprint size={14} className={isSqueezeEnabled ? "text-pink-400" : "text-gray-400"} />
            </button>
            <button onClick={() => setShowHelp(true)} className={`p-1.5 rounded border active:scale-95 transition-all ${isDarkMode ? 'bg-slate-800 border-slate-500/30' : 'bg-white border-slate-500'}`}><HelpCircle size={14} className="text-sky-400" /></button>
          </div>
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded border transition-colors ${isDarkMode ? 'bg-black/60 border-white/5' : 'bg-white border-black/10 shadow-sm'}`}>
            <Coins size={10} className="text-yellow-500" /><span className="text-xs font-black">{(balance).toLocaleString()}</span>
          </div>
      </div>

      {/* Mini History */}
      <div className={`flex gap-1.5 p-2 overflow-x-auto scrollbar-hide border-y mx-4 rounded-md mb-2 transition-colors ${isDarkMode ? 'bg-black/40 border-white/5' : 'bg-slate-200 border-black/5'}`}>
        {gameHistory.slice(0, 13).map((h, i) => (
          <div key={i} className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-black border transition-all transform hover:scale-110 ${h.type==='T'?'bg-blue-600 border-blue-400 shadow-[0_0_8px_rgba(37,99,235,0.5)]':h.type==='X'?'bg-red-600 border-red-400 shadow-[0_0_8px_rgba(220,38,38,0.5)]':'bg-yellow-500 border-yellow-200 text-black'}`}>{String(h.type)}</div>
        ))}
      </div>

      {/* Radar Area (Bát) */}
      <div className="relative h-[250px] flex items-center justify-center perspective-1000">

        
        <div className={`relative w-64 h-64 flex items-center justify-center ${isRolling ? 'animate-bowl-shake' : ''}`}>
          {/* ĐỒNG HỒ ĐẾM NGƯỢC - Xuất hiện khi chuẩn bị phiên mới hoặc đang nặn */}
  {phase !== "BETTING" && !isRolling && (
    <div className="absolute top-6 left-1/2 -translate-x-1/2 z-[100] flex flex-col items-center pointer-events-none animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className={`flex items-center gap-2 px-3 py-1 rounded-full border shadow-[0_0_15px_rgba(56,189,248,0.3)] backdrop-blur-md ${isDarkMode ? 'bg-slate-900/80 border-sky-500/40' : 'bg-white/80 border-sky-500/50'}`}>
            <Clock size={12} className={timeLeft <= 5 ? "text-red-500 animate-ping" : "text-sky-400 animate-spin-slow"} />
            <span className={`text-sm font-black tactical-font tracking-widest ${timeLeft <= 5 ? "text-red-500" : "text-sky-400"}`}>
                {timeLeft}s
            </span>
        </div>
    </div>
  )}
          <div className={`absolute inset-0 rounded-full border-[14px] bowl-rim transition-colors ${isDarkMode ? 'bg-neutral-900 border-slate-800 shadow-[0_25px_60px_#000]' : 'bg-slate-300 border-slate-400 shadow-[0_15px_30px_rgba(0,0,0,0.1)]'}`}></div>
          <div className={`absolute inset-4 rounded-full overflow-hidden border shadow-[inset_0_0_50px_#000] ${isDarkMode ? 'bg-[#020617] border-sky-500/40' : 'bg-slate-200 border-sky-500/60'}`}>
          
             <div className="radar-line" />
             <div className={`absolute inset-0 opacity-10 bg-[size:24px_24px] ${isDarkMode ? 'bg-[linear-gradient(to_right,#38bdf8_1px,transparent_1px),linear-gradient(to_bottom,#38bdf8_1px,transparent_1px)]' : 'bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)]'}`} />
             {dice.map((v, i) => (
                 <RealisticDice key={i} value={v} isRolling={isRolling} position={dicePositions[i]} isRevealed={isScratchedDone} isDarkMode={isDarkMode} />
             ))}
          </div>

          {/* BÁT CHỈ HUY - NẶN TỰ DO & TAN BIẾN KHI RA NGOÀI */}
          {((!isScratchedDone && (phase === "BETTING" || isRolling || isReadyToScratch)) || isBowlFading) && (
            <div 
                ref={bowlRef}
                className={`absolute inset-2 z-[100] transition-all duration-300
                    ${isDragging ? 'duration-0 scale-100 opacity-100 blur-0' : isBowlFading ? 'duration-500 scale-110 opacity-0 blur-xl pointer-events-none' : 'duration-500 ease-out'}`}
                style={{ touchAction: 'none', willChange: 'transform' }}
            >
               <div 
                  onMouseDown={handleBowlStart} onMouseMove={handleBowlMove} onMouseUp={handleBowlEnd} onMouseLeave={handleBowlEnd}
                  onTouchStart={handleBowlStart} onTouchMove={handleBowlMove} onTouchEnd={handleBowlEnd}
                  className={`w-full h-full rounded-full border-4 flex flex-col items-center justify-center relative overflow-hidden cursor-grab active:cursor-grabbing shadow-[0_30px_60px_rgba(0,0,0,0.8)]
                    ${isDarkMode ? 'bg-gradient-to-br from-slate-800 to-slate-900 border-slate-700' : 'bg-gradient-to-br from-slate-100 to-slate-200 border-slate-300'}`}
               >
                  <div className="absolute top-0 left-0 w-full h-10 bg-[repeating-linear-gradient(45deg,#000,#000_20px,#fbbf24_20px,#fbbf24_40px)] opacity-10" />
                  <div className={`w-40 h-40 rounded-full border-4 border-sky-500/30 flex items-center justify-center backdrop-blur-md bg-sky-900/10 shadow-[inset_0_0_20px_#000]`}>
                      {phase === "BETTING" ? (
                        <div className="flex flex-col items-center leading-none">
                            <span className="text-[12px] font-black text-sky-400 mb-1 tracking-widest uppercase">LOCK</span>
                            <span className="text-6xl font-black tactical-font text-sky-400">{timeLeft}</span>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center z-10 animate-pulse">
                            <Power size={36} className="text-sky-400 mb-2" />
                            <span className="text-[9px] font-black tactical-font text-sky-400 uppercase tracking-[0.3em] text-center px-6 leading-tight">Ném bát ra ngoài ô radar</span>
                        </div>
                      )}
                  </div>
               </div>
            </div>
          )}
        </div>
      </div>

      {/* Cửa đặt cược */}
      <div className={`flex-1 p-4 flex flex-col justify-center gap-4 transition-colors ${isDarkMode ? 'bg-[#0a0f14]' : 'bg-slate-200'}`}>
        <div className="grid grid-cols-2 gap-4 h-32">
          <button disabled={phase !== "BETTING"} onClick={(e) => handleBet('xiu', e)} className={`relative rounded-xl border-2 transition-all flex flex-col items-center justify-center overflow-hidden ${getWinnerStyle('xiu')} ${phase === "BETTING" ? 'border-red-500/40 bg-red-950/10 active:scale-95' : 'border-slate-800 opacity-50 cursor-not-allowed'}`}>
            <Crosshair className="absolute top-2 left-2 opacity-20 text-red-500" size={14} />
            <span className="text-[10px] font-black text-red-500/60 uppercase mb-1">Alpha</span>
            <span className="text-4xl font-black tactical-font text-red-600">XỈU</span>
            <div className="flex items-center gap-2 mt-1 opacity-80">
                <div className="flex items-center gap-0.5 text-[9px] font-bold text-red-400"><User size={10} /> {xiuStats.totalPlayers}</div>
                <div className="flex items-center gap-0.5 text-[9px] font-bold text-red-400"><Coins size={10} /> {(xiuStats.totalAmount/1000000).toFixed(1)}M</div>
            </div>
            {bets.xiu > 0 && <div className="absolute bottom-2 right-2 bg-red-600 text-white text-[9px] font-black px-1.5 py-0.5 rounded-sm animate-bounce">{(bets.xiu).toLocaleString()}</div>}
          </button>
          <button disabled={phase !== "BETTING"} onClick={(e) => handleBet('tai', e)} className={`relative rounded-xl border-2 transition-all flex flex-col items-center justify-center overflow-hidden ${getWinnerStyle('tai')} ${phase === "BETTING" ? 'border-sky-500/40 bg-sky-950/10 active:scale-95' : 'border-slate-800 opacity-50 cursor-not-allowed'}`}>
            <Crosshair className="absolute top-2 left-2 opacity-20 text-sky-500" size={14} />
            <span className="text-[10px] font-black text-sky-500/60 uppercase mb-1">Bravo</span>
            <span className="text-4xl font-black tactical-font text-sky-500">TÀI</span>
            <div className="flex items-center gap-2 mt-1 opacity-80">
                <div className="flex items-center gap-0.5 text-[9px] font-bold text-sky-400"><User size={10} /> {taiStats.totalPlayers}</div>
                <div className="flex items-center gap-0.5 text-[9px] font-bold text-sky-400"><Coins size={10} /> {(taiStats.totalAmount/1000000).toFixed(1)}M</div>
            </div>
            {bets.tai > 0 && <div className="absolute bottom-2 right-2 bg-red-600 text-white text-[9px] font-black px-1.5 py-0.5 rounded-sm animate-bounce">{(bets.tai).toLocaleString()}</div>}
          </button>
        </div>
        <button disabled={phase !== "BETTING"} onClick={(e) => handleBet('bao', e)} className={`w-full py-5 rounded-xl border-2 transition-all relative flex flex-col items-center justify-center overflow-hidden ${getWinnerStyle('bao')} ${phase === "BETTING" ? 'border-amber-500/40 bg-amber-950/10 active:scale-95' : 'border-slate-800 opacity-50 cursor-not-allowed'}`}>
          <div className="absolute inset-0 opacity-10 bg-[repeating-linear-gradient(45deg,#f59e0b,#f59e0b_10px,#000_10px,#000_20px)]" />
          <div className="flex items-center gap-3"><ShieldAlert size={20} className="text-amber-500 animate-pulse" /><span className="text-2xl font-black tactical-font text-amber-500 italic uppercase">BÃO TÁP (X30)</span></div>
          <div className="flex items-center gap-3 mt-1 opacity-80 absolute bottom-2">
                <div className="flex items-center gap-0.5 text-[9px] font-bold text-amber-500"><User size={10} /> {baoStats.totalPlayers}</div>
                <div className="flex items-center gap-0.5 text-[9px] font-bold text-amber-500"><Coins size={10} /> {(baoStats.totalAmount/1000000).toFixed(1)}M</div>
          </div>
          {bets.bao > 0 && <div className="absolute top-1 right-4 bg-amber-500 text-black text-[10px] font-black px-3 py-0.5 rounded-sm animate-bounce">{(bets.bao).toLocaleString()}</div>}
        </button>
      </div>

      {/* Chip Selection Area */}
      <div className="px-4 pb-6 pt-1 z-50">
        <div className={`rounded-xl border py-3 px-2 flex justify-center gap-1 shadow-2xl overflow-hidden backdrop-blur-xl transition-colors ${isDarkMode ? 'border-white/10 bg-slate-900/90' : 'border-black/10 bg-white/90'}`}>
            {CHIP_LIST.map((chip) => (
                <MilitaryChip key={chip.value} value={chip.value} colorClass={chip.color} isSelected={selectedChip === chip.value} onClick={() => setSelectedChip(chip.value)} isDarkMode={isDarkMode} />
            ))}
        </div>
      </div>

      {/* MODAL SPIN HŨ (MÁY SLOT 333) */}
      {showSpinModal && jackpotResult && (
        <div className="absolute inset-0 z-[200] flex flex-col items-center justify-center bg-black/90 animate-in zoom-in duration-300 backdrop-blur-sm">
            <div className="relative w-full max-w-md bg-slate-900 border-4 border-yellow-600 rounded-3xl p-8 shadow-[0_0_50px_rgba(234,179,8,0.5)] text-center overflow-hidden flex flex-col items-center">
                {/* Đèn trang trí */}
                <div className="absolute top-2 left-2 w-3 h-3 rounded-full bg-red-500 animate-ping"></div>
                <div className="absolute top-2 right-2 w-3 h-3 rounded-full bg-red-500 animate-ping"></div>
                
                <div className="w-full bg-black/40 rounded-xl p-3 mb-6 border border-yellow-500/30 shadow-[inset_0_0_10px_#000]">
                    <h2 className="text-4xl font-black text-yellow-400 uppercase animate-bounce tracking-widest drop-shadow-[0_0_10px_rgba(234,179,8,0.8)]" style={{ fontFamily: 'Orbitron' }}>JACKPOT</h2>
                    <p className="text-yellow-200/70 text-[10px] font-bold uppercase tracking-[0.3em]">MÁY QUAY THƯỞNG 333</p>
                </div>

                {/* Khung máy Slot */}
                <div className="flex gap-3 p-4 bg-[#1a1a1a] rounded-lg border-4 border-slate-600 shadow-[inset_0_0_20px_#000] mb-8 relative">
                    <div className="absolute top-1/2 left-0 w-full h-0.5 bg-red-500/60 z-20 shadow-[0_0_5px_#ef4444]"></div>
                    <SlotReel value={spinDiceVals[0]} isSpinning={isSpinning} isDarkMode={true} />
                    <SlotReel value={spinDiceVals[1]} isSpinning={isSpinning} isDarkMode={true} />
                    <SlotReel value={spinDiceVals[2]} isSpinning={isSpinning} isDarkMode={true} />
                </div>

                {/* Kết quả */}
                {spinFinished && (
                    <div className="animate-in slide-in-from-bottom duration-500">
                        {jackpotResult.percent > 0 ? (
                            <>
                                <div className={`font-black text-transparent bg-clip-text bg-gradient-to-b from-yellow-300 to-yellow-600 drop-shadow-sm ${jackpotResult.percent === 100 ? 'text-5xl animate-bounce' : 'text-4xl'}`}>
                                    +{jackpotResult.amount.toLocaleString()}
                                </div>
                                <div className={`text-yellow-500 font-bold mt-1 uppercase tracking-widest ${jackpotResult.percent === 100 ? 'text-lg animate-pulse' : 'text-sm'}`}>
                                    {jackpotResult.percent === 100 ? '💥 NỔ HŨ TƯNG BỪNG 💥' : `TRÚNG ${jackpotResult.percent}% HŨ`}
                                </div>
                            </>
                        ) : (
                            <div className="text-2xl font-black text-gray-500 uppercase">CHÚC MAY MẮN LẦN SAU</div>
                        )}
                    </div>
                )}
            </div>
        </div>
      )}



      {/* Modals */}
      {showRoadmap && (
        <div className={`absolute inset-0 z-[200] backdrop-blur-3xl p-6 flex flex-col font-mono animate-in slide-in-from-bottom duration-300 ${isDarkMode ? 'bg-slate-950/98' : 'bg-slate-100/98'}`}>
            <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-3 text-sky-400"><Target size={24} /><h2 className="text-xl tactical-font uppercase">Radar Tác Chiến</h2></div>
                <button onClick={() => setShowRoadmap(false)} className="p-2 border rounded-full"><X size={20}/></button>
            </div>
            <div className={`flex-1 border rounded-xl p-4 overflow-y-auto space-y-6 ${isDarkMode ? 'bg-black/40 border-white/5' : 'bg-white border-slate-300'}`}>
                <div className="grid grid-cols-3 gap-3 text-[9px] font-black uppercase text-center">
                    <div className="bg-sky-600/10 p-2 rounded-lg text-sky-400">Tài: {gameHistory.filter(x=>x.type==='T').length}</div>
                    <div className="bg-red-600/10 p-2 rounded-lg text-red-400">Xỉu: {gameHistory.filter(x=>x.type==='X').length}</div>
                    <div className="bg-yellow-600/10 p-2 rounded-lg text-yellow-400">Bão: {gameHistory.filter(x=>x.type==='B').length}</div>
                </div>
                <div><h3 className="text-[10px] font-black uppercase mb-3 text-slate-400 tracking-widest">Biểu đồ Radar</h3>{renderRoadmap()}</div>
                <div>
                    <h3 className="text-[10px] font-black uppercase mb-3 text-slate-400 tracking-widest">Cầu Chi Tiết</h3>
                    <div className="grid grid-cols-7 gap-2">
                        {gameHistory.slice(0, 14).map((h, i) => (
                            <div key={i} className={`h-8 rounded flex items-center justify-center font-black border ${h.type==='T'?'bg-blue-900/20 border-blue-500 text-blue-400':'bg-red-900/20 border-red-500 text-red-400'}`}>{h.sum}</div>
                        ))}
                    </div>
                </div>
            </div>
            <button onClick={() => setShowRoadmap(false)} className="w-full mt-6 py-4 bg-sky-600 text-white font-black tactical-font uppercase">Đóng</button>
        </div>
      )}

      {showHistory && (
        <div className={`absolute inset-0 z-[200] backdrop-blur-3xl p-6 flex flex-col animate-in slide-in-from-bottom duration-300 ${isDarkMode ? 'bg-slate-950/98' : 'bg-slate-100/98'}`}>
            <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-3 text-emerald-400"><History size={24} /><h2 className="text-xl tactical-font uppercase">Nhật Ký</h2></div>
                <button onClick={() => setShowHistory(false)} className="p-2 border rounded-full"><X size={20}/></button>
            </div>
            <div className={`flex-1 border rounded-xl overflow-hidden ${isDarkMode ? 'bg-black/40 border-white/5' : 'bg-white border-slate-300'}`}>
                <div className="grid grid-cols-4 bg-white/5 p-3 text-[9px] font-black uppercase text-gray-500 text-center"><span>PHIÊN</span><span>MỤC TIÊU</span><span>ĐẦU TƯ</span><span>KẾT QUẢ</span></div>
                <div className="flex-1 overflow-y-auto">
                    {betHistory.map((bet, i) => (
                        <div key={i} className="grid grid-cols-4 p-4 text-[10px] font-bold text-center border-b border-white/5">
                            <span>#{bet.session}</span><span>{bet.type}</span><span>{bet.amount.toLocaleString()}</span><span className={bet.winAmount>0?'text-emerald-400':'text-red-400'}>{bet.winAmount>0?`+${bet.winAmount.toLocaleString()}`:'THẤT BẠI'}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
      )}

      {showSessionBets && (
        <div className={`absolute inset-0 z-[200] backdrop-blur-3xl p-6 flex flex-col animate-in slide-in-from-left duration-300 ${isDarkMode ? 'bg-slate-950/98' : 'bg-slate-100/98'}`}>
            <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-3 text-amber-400"><Activity size={24} /><h2 className="text-xl tactical-font uppercase">Tình Báo</h2></div>
                <button onClick={() => setShowSessionBets(false)} className="p-2 border rounded-full"><X size={20}/></button>
            </div>
            <div className={`flex-1 border rounded-xl overflow-hidden ${isDarkMode ? 'bg-black/40 border-white/5' : 'bg-white border-slate-300'}`}>
                <div className="grid grid-cols-3 bg-white/5 p-3 text-[9px] font-black uppercase text-gray-500 text-center"><span>PILOT</span><span>MỤC TIÊU</span><span>ĐẦU TƯ</span></div>
                <div className="flex-1 overflow-y-auto">
                    {sessionBets.map((b, i) => (
                        <div key={i} className="grid grid-cols-3 p-4 text-[10px] font-bold text-center border-b border-white/5">
                            <span>{String(b.id)}</span><span className={b.target==='TAI'?'text-sky-400':'text-red-400'}>{String(b.target)}</span><span>{b.amount.toLocaleString()}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
      )}

      {showChat && (
        <div className={`absolute inset-0 z-[200] backdrop-blur-3xl p-6 flex flex-col animate-in slide-in-from-right duration-300 ${isDarkMode ? 'bg-slate-950/98' : 'bg-slate-100/98'}`}>
            <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-3 text-purple-400"><Radio size={24} /><h2 className="text-xl tactical-font uppercase">Liên Lạc</h2></div>
                <button onClick={() => setShowChat(false)} className="p-2 border rounded-full"><X size={20}/></button>
            </div>
            <div className={`flex-1 border rounded-xl p-4 overflow-y-auto mb-4 flex flex-col gap-3 transition-colors ${isDarkMode ? 'bg-black/40 border-white/5' : 'bg-white border-slate-300 shadow-inner'}`}>
                {messages.map(msg => (
                    <div key={msg.id} className={`flex flex-col ${msg.user === 'duog' ? 'items-end' : 'items-start'}`}>
                        <div className="flex items-center gap-2 mb-1"><span className={`text-[8px] font-black uppercase ${msg.user === 'duog' ? 'text-sky-400' : 'text-gray-500'}`}>{String(msg.user)}</span></div>
                        <div className={`px-3 py-2 rounded-lg text-xs max-w-[80%] border ${msg.user === 'duog' ? 'bg-sky-600/20 border-sky-500/30 text-sky-100' : 'bg-slate-100 border-slate-200 text-slate-800'}`}>
                            {String(msg.text)}
                        </div>
                    </div>
                ))}
            </div>
            <div className={`flex gap-2 p-2 rounded-xl border items-center ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-white border-slate-300'}`}>
                <input type="text" value={chatInput} onChange={(e) => setChatInput(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()} placeholder="Truyền tin..." className="flex-1 bg-transparent border-none outline-none text-xs p-2"/>
                <button onClick={handleSendMessage} className="p-2 bg-sky-600 rounded-lg"><Send size={16}/></button>
            </div>
        </div>
      )}

      {showHelp && (
        <div className={`absolute inset-0 z-[200] backdrop-blur-3xl p-6 flex flex-col animate-in zoom-in duration-300 ${isDarkMode ? 'bg-slate-950/95' : 'bg-slate-100/95'}`}>
            <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-3 text-sky-400"><HelpCircle size={24} /><h2 className="text-xl tactical-font uppercase">Hướng Dẫn</h2></div>
                <button onClick={() => setShowHelp(false)} className="p-2 border rounded-full"><X size={20}/></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 rounded-xl border bg-black/20 text-xs leading-relaxed space-y-4">
                <p><b className="text-sky-400">LUẬT CHƠI:</b> Dự đoán điểm 3 xúc xắc. XỈU (4-10), TÀI (11-17).</p>
                <p><b className="text-red-400">NẶN BÁT:</b> Nhấn giữ chiếc bát, kéo nó ra ngoài phạm vi radar. Khi vượt qua bán kính vòng tròn, bát sẽ tan biến và kích hoạt nổ kết quả!</p>
                <p><b className="text-amber-400">DUY TRÌ:</b> Hiệu ứng bùng nổ của xúc xắc sẽ giữ nguyên đến khi phiên mới bắt đầu.</p>
            </div>
            <button onClick={() => setShowHelp(false)} className="w-full mt-6 py-4 bg-sky-600 text-white font-black tactical-font uppercase">Rõ!</button>
        </div>
      )}

    </div>
  );
};

export default App;