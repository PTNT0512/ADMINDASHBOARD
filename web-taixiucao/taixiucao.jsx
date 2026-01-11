import React, { useState, useRef, useEffect } from 'react';
import { 
  RotateCcw, Sparkles, BrainCircuit, Loader2, Timer, EyeOff, Trophy, Coins, 
  Zap, Fingerprint, Eye, Bell, Clock, BarChart3, X, ChevronRight, History, 
  TrendingUp, Plane, Target, ShieldAlert, Crosshair, Activity, MessageSquare, 
  Send, ClipboardList, User, Radio, Scan, Move, Sun, Moon, HelpCircle 
} from 'lucide-react';

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
      const count = 80;
      const hue = random(0, 360);
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = random(2, 15);
        particles.push({
          x: x, y: y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          alpha: 1,
          color: `hsl(${hue}, 100%, 50%)`,
          decay: random(0.015, 0.03)
        });
      }
    };

    const interval = setInterval(() => {
        createFirework(random(width * 0.1, width * 0.9), random(height * 0.1, height * 0.6));
    }, 500);

    let animationFrameId;
    const loop = () => {
      animationFrameId = requestAnimationFrame(loop);
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
      ctx.fillRect(0, 0, width, height);
      ctx.globalCompositeOperation = 'lighter';

      for (let i = particles.length - 1; i >= 0; i--) {
        let p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.1;
        p.vx *= 0.95;
        p.vy *= 0.95;
        p.alpha -= p.decay;
        
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.alpha;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
        ctx.fill();
        
        if (p.alpha <= 0) particles.splice(i, 1);
      }
    };
    loop();

    const handleResize = () => {
        width = canvas.width = window.innerWidth;
        height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    return () => {
        clearInterval(interval);
        cancelAnimationFrame(animationFrameId);
        window.removeEventListener('resize', handleResize);
    };
  }, []);

  return <canvas ref={canvasRef} className="fixed inset-0 z-[150] pointer-events-none" />;
};

// --- Thành phần Xúc xắc 3D Tactical Siêu Chi Tiết ---
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
      className={`absolute w-full h-full border-2 flex flex-wrap p-2 shadow-[inset_0_0_15px_rgba(0,0,0,0.8)] rounded-md overflow-hidden
        ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-slate-200 border-slate-400'}`}
      style={{ transform, backfaceVisibility: 'hidden' }}
    >
      <div className={`absolute inset-0 opacity-20 ${isDarkMode ? 'bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.1)_0%,transparent_70%)]' : 'bg-[radial-gradient(circle_at_center,rgba(0,0,0,0.05)_0%,transparent_70%)]'}`} />
      <div className={`absolute top-0.5 right-1 text-[5px] font-mono tracking-tighter uppercase ${isDarkMode ? 'text-slate-500' : 'text-slate-600'}`}>K-SOÁT</div>
      
      <div className={`absolute top-1 left-1 w-1 h-1 rounded-full border shadow-inner ${isDarkMode ? 'bg-slate-700 border-slate-600' : 'bg-slate-400 border-slate-300'}`} />
      <div className={`absolute top-1 right-1 w-1 h-1 rounded-full border shadow-inner ${isDarkMode ? 'bg-slate-700 border-slate-600' : 'bg-slate-400 border-slate-300'}`} />
      <div className={`absolute bottom-1 left-1 w-1 h-1 rounded-full border shadow-inner ${isDarkMode ? 'bg-slate-700 border-slate-600' : 'bg-slate-400 border-slate-300'}`} />
      <div className={`absolute bottom-1 right-1 w-1 h-1 rounded-full border shadow-inner ${isDarkMode ? 'bg-slate-700 border-slate-600' : 'bg-slate-400 border-slate-300'}`} />

      {[...Array(9)].map((_, i) => (
        <div key={i} className="w-1/3 h-1/3 flex items-center justify-center">
          {dots[num].includes(i) && (
            <div className="relative group">
                <div className={`absolute inset-0 w-3 h-3 -translate-x-[2px] -translate-y-[2px] rounded-full border scale-150 opacity-40 ${isDarkMode ? 'border-slate-600/50' : 'border-slate-400/50'}`} />
                <div 
                    className={`w-2.5 h-2.5 rounded-full shadow-[0_0_12px_currentColor] border border-white/20 ${
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
      className="absolute transition-all duration-1000 cubic-bezier(0.34, 1.56, 0.64, 1) z-10" 
      style={{ 
        left: `${position.x}%`, 
        top: `${position.y}%`, 
        transform: `translate(-50%, -50%) rotateZ(${position.zRot}deg) ${isRevealed ? 'scale(1.15)' : 'scale(1)'}` 
      }}
    >
      <div className="absolute w-14 h-4 bg-black/60 blur-md rounded-full translate-y-9 translate-x-2 -rotate-12" />
      <div className="w-14 h-14 [perspective:800px]">
        <div 
          className={`relative w-full h-full [transform-style:preserve-3d] transition-transform duration-1000 ${isRolling ? 'animate-dice-wild' : ''}`} 
          style={{ transform: !isRolling ? faceRotations[value] : undefined }}
        >
          <Face num={1} transform="translateZ(28px)" />
          <Face num={6} transform="rotateY(180deg) translateZ(28px)" />
          <Face num={3} transform="rotateY(90deg) translateZ(28px)" />
          <Face num={4} transform="rotateY(-90deg) translateZ(28px)" />
          <Face num={2} transform="rotateX(90deg) translateZ(28px)" />
          <Face num={5} transform="rotateX(-90deg) translateZ(28px)" />
        </div>
      </div>
    </div>
  );
};

// --- Chip Quân Sự (Dog Tag Style) ---
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
  const [balance, setBalance] = useState(15000000);
  const [selectedChip, setSelectedChip] = useState(1000);
  const [currentUser, setCurrentUser] = useState(null); // State lưu thông tin người dùng đăng nhập
  const [bets, setBets] = useState({ tai: 0, xiu: 0, bao: 0 });
  
  // DUOG-FIX: Bật chế độ Demo lên TRUE để chạy được ngay mà không cần Server
  const [isDemoMode, setIsDemoMode] = useState(true); 
  const [session, setSession] = useState(7042);
  
  // Cập nhật cấu trúc lịch sử để lưu cả tổng điểm
  const [gameHistory, setGameHistory] = useState([
    { type: 'T', sum: 14 }, { type: 'X', sum: 8 }, { type: 'T', sum: 12 }, { type: 'B', sum: 9 },
    { type: 'X', sum: 5 }, { type: 'T', sum: 11 }, { type: 'X', sum: 10 }, { type: 'T', sum: 15 },
    { type: 'X', sum: 6 }, { type: 'X', sum: 7 }, { type: 'T', sum: 13 }, { type: 'T', sum: 12 },
    { type: 'X', sum: 4 }, { type: 'X', sum: 9 }, { type: 'B', sum: 18 }, { type: 'X', sum: 10 }
  ]);
  
  const [betHistory, setBetHistory] = useState([]);
  const [winningAreas, setWinningAreas] = useState([]); 
  const [jackpot, setJackpot] = useState(128464468);
  const [jackpotResult, setJackpotResult] = useState(null); // Dữ liệu quay hũ từ server
  const [dice, setDice] = useState([3, 3, 3]);
  const [isDarkMode, setIsDarkMode] = useState(true);
  
  const [dicePositions, setDicePositions] = useState([
    { x: 50, y: 50, zRot: 0 }, 
    { x: 50, y: 50, zRot: 0 }, 
    { x: 50, y: 50, zRot: 0 }
  ]);
  
  const [isRolling, setIsRolling] = useState(false);
  const [isReadyToScratch, setIsReadyToScratch] = useState(false);
  const [isScratchedDone, setIsScratchedDone] = useState(false);
  const [isScratchEnabled, setIsScratchEnabled] = useState(true);
  const [timeLeft, setTimeLeft] = useState(60); 
  const [phase, setPhase] = useState("BETTING");
  
  const [showRoadmap, setShowRoadmap] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showSessionBets, setShowSessionBets] = useState(false);
  const [showAiModal, setShowAiModal] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  
  const [aiMessage, setAiMessage] = useState("");
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [chipAnimations, setChipAnimations] = useState([]);
  const [messages, setMessages] = useState([
    { id: 1, user: 'Phi_Công_Ace', text: 'Mục tiêu Tài đang sáng!', time: '14:30' },
    { id: 2, user: 'Radar_MIG', text: 'Chuẩn bị xuất kích.', time: '14:31' }
  ]);
  
  // State cho Modal Spin Hũ
  const [showSpinModal, setShowSpinModal] = useState(false);
  const [spinDiceVals, setSpinDiceVals] = useState([1,1,1]);
  const [isSpinning, setIsSpinning] = useState(false);
  const [spinFinished, setSpinFinished] = useState(false);

  const [prediction, setPrediction] = useState(null);
  const [showBigWin, setShowBigWin] = useState(false);
  const [refundNotification, setRefundNotification] = useState(null);
  const [chatInput, setChatInput] = useState('');
  
  const [sessionBets, setSessionBets] = useState([
    { id: 'PhiCông_442', target: 'TAI', amount: 500000 },
    { id: 'PhiCông_109', target: 'XIU', amount: 1000000 }
  ]);

  const canvasRef = useRef(null);
  const isDrawing = useRef(false);
  const scratchCount = useRef(0);

  const chipList = [
    { value: 1000, color: 'from-slate-600 to-slate-800' },
    { value: 5000, color: 'from-emerald-700 to-emerald-900' },
    { value: 10000, color: 'from-sky-700 to-sky-900' },
    { value: 50000, color: 'from-amber-600 to-amber-800' },
    { value: 100000, color: 'from-purple-700 to-purple-900' },
    { value: 500000, color: 'from-red-700 to-red-900' },
    { value: 1000000, color: 'from-yellow-500 to-yellow-700' }
  ];

  const getWinnerStyle = (id) => {
    if (phase !== "RESULT" && !(phase === "SCRATCHING" && isScratchedDone)) return "";
    if (winningAreas.includes(id)) return `ring-4 ring-sky-400 shadow-[0_0_50px_rgba(56,189,248,0.8)] animate-pulse z-20 scale-[1.03] ${isDarkMode ? 'bg-sky-900/50 border-sky-300' : 'bg-sky-200/80 border-sky-500'}`;
    return "opacity-30 grayscale";
  };

  const getSectorPositions = (isSpreading = false) => {
    const jitter = isSpreading ? 0 : 5; 
    return [
      { x: 30 + (Math.random() * jitter), y: 35 + (Math.random() * jitter), zRot: Math.random() * 360 },
      { x: 70 + (Math.random() * jitter), y: 35 + (Math.random() * jitter), zRot: Math.random() * 360 },
      { x: 50 + (Math.random() * jitter), y: 72 + (Math.random() * jitter), zRot: Math.random() * 360 }
    ];
  };

  // --- XỬ LÝ ĐĂNG NHẬP TỰ ĐỘNG QUA TOKEN ---
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('tokenlogin');
    const gameParam = params.get('startgame');

    if (token && gameParam === 'taixiucao') {
      fetch('http://localhost:4001/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token })
      })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setCurrentUser(data.user);
          setBalance(data.user.balance); // Cập nhật số dư từ tài khoản
        }
      })
      .catch(err => console.error("Lỗi đăng nhập:", err));
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    // Nếu đang chạy Demo (không server) thì dùng timer cũ
    if (isDemoMode) {
      const timer = setInterval(() => {
        if (!isMounted) return;
        setTimeLeft((prev) => {
          if (prev <= 1) {
            if (phase === "BETTING") { 
                startRollingPhase(); 
                return 15; // Cho 15s để cào
            }
            else if (phase === "SCRATCHING") { 
                if (!isScratchedDone) startResultPhase(); 
                return 10; // 10s xem kết quả
            }
            else { 
                startNewSession(); 
                return 60; // 60s ván mới
            }
          }
          return prev - 1;
        });
      }, 1000);
      return () => { isMounted = false; clearInterval(timer); };
    }

    // Nếu chạy thật -> Đồng bộ với Server
    const syncInterval = setInterval(async () => {
      try {
        const res = await fetch('http://localhost:4001/api/game/status?game=taixiucao');
        if (!isMounted) return;
        const data = await res.json();

        setTimeLeft(data.timeLeft);
        if (data.jackpot) setJackpot(data.jackpot); // Cập nhật tiền hũ realtime
        
        // Xử lý Spin Hũ
        if (data.jackpotResult && !jackpotResult) {
            setJackpotResult(data.jackpotResult);
            setShowSpinModal(true);
            setIsSpinning(true);
            setSpinFinished(false);
            
            // Kết thúc quay sau 3 giây và hiển thị kết quả thật
            setTimeout(() => { 
                setSpinDiceVals(data.jackpotResult.spinDice); 
                setIsSpinning(false); 
                setSpinFinished(true); 
            }, 3000);
        } else if (!data.jackpotResult) {
            setJackpotResult(null);
            setShowSpinModal(false);
        }

        // Hiệu ứng thay đổi số liên tục khi đang quay Spin
        if (isSpinning) {
            const interval = setInterval(() => {
                setSpinDiceVals([Math.floor(Math.random()*6)+1, Math.floor(Math.random()*6)+1, Math.floor(Math.random()*6)+1]);
            }, 80);
            return () => clearInterval(interval);
        }
        
        // Đồng bộ phiên
        if (data.sessionId !== session) setSession(data.sessionId);

        // Xử lý chuyển trạng thái
        if (data.phase === 'RESULT' && phase === 'BETTING') {
          startRollingPhase(data.dice); // Server báo có kết quả -> Quay
        }
        
        if (data.phase === 'BETTING' && phase !== 'BETTING') {
          startNewSession(); // Server báo ván mới -> Reset
        }

        // Tự động mở bát nếu sắp hết giờ chờ (còn < 15s)
        if (phase === 'SCRATCHING' && data.timeLeft < 15 && !isScratchedDone) {
           startResultPhase();
        }
      } catch (e) { 
          if (!isMounted) return;
          // Nếu lỗi kết nối server thì tự động chuyển về Demo Mode để không bị treo
          console.log("Không kết nối được server, chuyển về Demo Mode");
          setIsDemoMode(true);
      }
    }, 1000);
    return () => { isMounted = false; clearInterval(syncInterval); };
  }, [phase, isDemoMode, session, isScratchedDone, dice]);

  // --- BOT TỰ ĐỘNG ĐẶT CƯỢC & CHAT ---
  useEffect(() => {
    if (phase !== "BETTING") return;

    const botInterval = setInterval(() => {
        // 70% cơ hội mỗi giây có bot hành động
        if (Math.random() > 0.3) {
            const botNames = ['PhiCông', 'Radar', 'MIG', 'Su', 'F-16', 'B-52', 'AK-47', 'Tank', 'Sniper', 'Delta', 'Viper', 'Ghost', 'Maverick'];
            const randomName = `${botNames[Math.floor(Math.random() * botNames.length)]}_${Math.floor(Math.random() * 999)}`;
            
            const rand = Math.random();
            const target = rand < 0.45 ? 'TAI' : (rand < 0.9 ? 'XIU' : 'BAO');
            const amounts = [10000, 20000, 50000, 100000, 200000, 500000, 1000000];
            const amount = amounts[Math.floor(Math.random() * amounts.length)];

            setSessionBets(prev => [{ id: randomName, target, amount }, ...prev].slice(0, 200));

            // 20% cơ hội bot chat
            if (Math.random() > 0.8) {
                const botMsgs = ['Tài nổ hũ', 'Xỉu đi anh em', 'Cầu này ảo thế', 'Theo tôi về bờ', 'Gãy cánh rồi', 'Húp trọn', 'Bão đê', 'All in Tài', 'Sợ gì mà không vào'];
                setMessages(prev => [...prev, { id: Date.now() + Math.random(), user: randomName, text: botMsgs[Math.floor(Math.random() * botMsgs.length)], time: new Date().toLocaleTimeString().slice(0, 5) }].slice(-20));
            }
        }
    }, 800);
    return () => clearInterval(botInterval);
  }, [phase]);

  // --- HIỆU ỨNG CÂN CỬA (HOÀN TIỀN) ---
  useEffect(() => {
    if (phase === 'BETTING' && timeLeft === 4) {
        const taiBets = sessionBets.filter(b => b.target === 'TAI');
        const xiuBets = sessionBets.filter(b => b.target === 'XIU');
        const taiTotal = taiBets.reduce((sum, b) => sum + b.amount, 0);
        const xiuTotal = xiuBets.reduce((sum, b) => sum + b.amount, 0);
        
        const diff = Math.abs(taiTotal - xiuTotal);
        
        const myId = currentUser ? `User_${currentUser.userId}` : 'duog (Bạn)';

        // Nếu chênh lệch > 500k thì kích hoạt cân cửa
        if (diff > 500000) {
            const largerSide = taiTotal > xiuTotal ? 'tai' : 'xiu';
            const userBetAmount = bets[largerSide];

            // Nếu user có cược bên cửa lớn hơn -> 40% cơ hội bị hoàn tiền (giả lập người cược sau)
            if (userBetAmount > 0 && Math.random() < 0.4) {
                // Hoàn lại một phần tiền ngẫu nhiên (20-80%)
                const refundVal = Math.ceil((userBetAmount * (Math.random() * 0.6 + 0.2)) / 1000) * 1000;
                
                if (refundVal > 0) {
                    setBalance(prev => prev + refundVal);
                    setBets(prev => ({ ...prev, [largerSide]: prev[largerSide] - refundVal }));
                    
                    // Cập nhật hiển thị trong danh sách cược
                    setSessionBets(prev => prev.map(b => {
                        if (b.id === myId && b.target === largerSide.toUpperCase()) {
                            return { ...b, amount: b.amount - refundVal };
                        }
                        return b;
                    }));

                    setRefundNotification({ amount: refundVal, side: largerSide === 'tai' ? 'TÀI' : 'XỈU' });
                    setTimeout(() => setRefundNotification(null), 5000);
                }
            }
        }
    }
  }, [timeLeft, phase, bets, sessionBets, currentUser]);

  const startRollingPhase = async (serverDice) => {
    setPhase("SCRATCHING"); setIsRolling(true); setWinningAreas([]);
    
    // Nếu có dice từ server truyền vào thì dùng, không thì random (cho demo)
    const newDice = serverDice || [Math.floor(Math.random()*6)+1, Math.floor(Math.random()*6)+1, Math.floor(Math.random()*6)+1];

    setDicePositions(getSectorPositions(false));
    setTimeout(() => { setDice(newDice); setIsRolling(false); setIsReadyToScratch(true); }, 1500);
  };

  const startResultPhase = () => {
    setPhase("RESULT"); 
    setIsScratchedDone(true); 
    setIsReadyToScratch(false); 
    // setTimeLeft(10); // Không set lại thời gian local nữa, dùng thời gian server
    setDicePositions(getSectorPositions(true));
    calculateWinnings(dice);
  };

  const startNewSession = () => {
    setPhase("BETTING"); setBets({ tai: 0, xiu: 0, bao: 0 }); setWinningAreas([]); setChipAnimations([]); setIsScratchedDone(false); setIsReadyToScratch(false);
    // setSession(s => s + 1); // Không tự tăng session nữa, chờ server
    if(isDemoMode) setSession(s => s + 1);
    setSessionBets([
        { id: `PhiCông_${Math.floor(Math.random()*999)}`, target: Math.random() > 0.5 ? 'TAI' : 'XIU', amount: Math.floor(Math.random()*10)*100000 },
        { id: `PhiCông_${Math.floor(Math.random()*999)}`, target: Math.random() > 0.5 ? 'TAI' : 'XIU', amount: Math.floor(Math.random()*10)*100000 }
    ]);
  };

  const calculateWinnings = (currentDice) => {
    // Kiểm tra dữ liệu đầu vào
    if (!currentDice || currentDice.length !== 3) return;

    // Ép kiểu Number để đảm bảo tính toán và so sánh chính xác tuyệt đối
    const d1 = Number(currentDice[0]);
    const d2 = Number(currentDice[1]);
    const d3 = Number(currentDice[2]);
    const sum = d1 + d2 + d3;
    const isTriple = (d1 === d2) && (d2 === d3);
    
    let res;
    // LOGIC XÁC ĐỊNH KẾT QUẢ BÀI BẢN
    if (isTriple) {
        if (sum === 3) res = 'X';      // 1-1-1 => Xỉu (Nổ Hũ)
        else if (sum === 18) res = 'T'; // 6-6-6 => Tài (Nổ Hũ)
        else res = 'B';                 // 222-555 => Bão
    } else {
        if (sum >= 11) res = 'T';       // 11-17 => Tài
        else res = 'X';                 // 4-10 => Xỉu
    }

    const wins = [];
    if (res === 'T') wins.push('tai'); 
    if (res === 'X') wins.push('xiu'); 
    if (res === 'B') wins.push('bao');
    setWinningAreas(wins);

    // --- XỬ LÝ LƯU DỮ LIỆU ---
    // Đã chuyển logic lưu sang Server (server.js) để tránh lỗi trùng lặp key.
    // Client chỉ nhận kết quả hiển thị.

    let totalWin = 0;

    Object.keys(bets).forEach(type => {
        const betVal = bets[type];
        if (typeof betVal === 'number' && betVal > 0) {
            let winAmount = 0;
            if (type === 'tai' && res === 'T') winAmount = Math.floor(betVal * 1.96);
            else if (type === 'xiu' && res === 'X') winAmount = Math.floor(betVal * 1.96);
            else if (type === 'bao' && res === 'B') winAmount = betVal * 30;
            
            if (winAmount > 0) totalWin += winAmount;
            
            const newHistoryItem = { 
                session, 
                type: type.toUpperCase(), 
                amount: betVal, 
                result: res, 
                winAmount, 
                time: new Date().toLocaleTimeString().slice(0, 5) 
            };
            setBetHistory(prev => [newHistoryItem, ...prev].slice(0, 50));
            if (winAmount > 0) setBalance(p => p + winAmount);
        }
    });

    if (totalWin >= 2000000) {
        setShowBigWin(true);
        setTimeout(() => setShowBigWin(false), 6000);
    }

    setGameHistory(prev => [{ type: res, sum }, ...prev].slice(0, 100));
  };

  const getSessionStats = (target) => {
    const targetBets = sessionBets.filter(b => b.target === target);
    const totalAmount = targetBets.reduce((sum, b) => sum + b.amount, 0);
    const totalPlayers = new Set(targetBets.map(b => b.id)).size;
    return { totalAmount, totalPlayers };
  };

  const togglePrediction = () => {
    if (prediction) {
        setPrediction(null);
    } else {
        // Logic dự đoán giả lập dựa trên lịch sử
        const lastSum = gameHistory[0]?.sum || 10;
        const randomChange = Math.floor(Math.random() * 8) - 4; // Biến động -4 đến +3
        let nextSum = lastSum + randomChange;
        if (nextSum < 3) nextSum = 3;
        if (nextSum > 18) nextSum = 18;
        
        setPrediction({
            sum: nextSum,
            type: nextSum >= 11 ? 'T' : 'X'
        });
    }
  };

  const handleBet = (type, e) => {
    if (phase !== "BETTING" || balance < selectedChip) return;
    if (type === 'tai' && bets.xiu > 0) return;
    if (type === 'xiu' && bets.tai > 0) return;

    const targetRect = e.currentTarget.getBoundingClientRect();
    const endX = targetRect.left + targetRect.width / 2 + (Math.random() * targetRect.width * 0.4 - targetRect.width * 0.2);
    const endY = targetRect.top + targetRect.height / 2 + (Math.random() * targetRect.height * 0.4 - targetRect.height * 0.2);
    const chipInfo = chipList.find(c => c.value === selectedChip);
    const animId = Date.now() + Math.random();
    
    const myId = currentUser ? `User_${currentUser.userId}` : 'duog (Bạn)';

    setChipAnimations(prev => [...prev, { id: animId, startX: window.innerWidth/2, startY: window.innerHeight-60, endX, endY, colorClass: chipInfo.color, value: selectedChip }]);
    setBets(prev => ({ ...prev, [type]: (Number(prev[type]) || 0) + selectedChip }));
    
    setSessionBets(prev => {
        const existing = prev.find(b => b.id === myId && b.target === type.toUpperCase());
        if (existing) {
            return prev.map(b => b === existing ? { ...b, amount: b.amount + selectedChip } : b);
        }
        return [{ id: myId, target: type.toUpperCase(), amount: selectedChip }, ...prev];
    });

    setBalance(prev => prev - selectedChip);

    // Nếu không phải Demo thì gửi lên Server
    if (!isDemoMode) {
      fetch('http://localhost:4001/api/game/bet', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type, amount: selectedChip, id: myId, game: 'taixiucao' })
      })
      .then(res => res.json())
      .then(data => {
          if (data.success) {
              if (data.newBalance !== undefined) setBalance(data.newBalance);
          } else {
              setBalance(prev => prev + selectedChip);
              alert(data.error || "Đặt cược thất bại");
          }
      })
      .catch(err => {
          console.error("Lỗi gửi cược:", err);
          // Không hoàn tiền ngay ở đây để tránh hack, nhưng ở demo thì cứ để vậy
          if(isDemoMode) setBalance(prev => prev + selectedChip);
      });
    }

    setTimeout(() => {
        setChipAnimations(prev => prev.filter(a => a.id !== animId));
    }, 600);
  };

  const scratch = (e) => {
    if (!isDrawing.current || !canvasRef.current) return;
    const canvas = canvasRef.current; 
    const ctx = canvas.getContext('2d'); 
    const rect = canvas.getBoundingClientRect();
    
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    
    const x = clientX - rect.left; 
    const y = clientY - rect.top;
    
    ctx.globalCompositeOperation = 'destination-out'; ctx.beginPath(); ctx.arc(x, y, 32, 0, Math.PI * 2); ctx.fill();
    
    // Tối ưu: Chỉ kiểm tra mỗi 5 frame để tránh lag nhưng nhạy hơn
    scratchCount.current += 1;
    if (scratchCount.current % 5 !== 0) return;

    try {
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height); 
      const data = imageData.data; 
      let transparent = 0;
      // Tối ưu: Bước nhảy 16 (4 pixel) thay vì kiểm tra từng pixel
      for (let i = 3; i < data.length; i += 16) { 
          if (data[i] === 0) transparent++; 
      }
      
      const totalPixels = data.length / 16;
      if (totalPixels > 0 && (transparent / totalPixels) * 100 >= 75) { // Giảm xuống 75% cho dễ cào
          startResultPhase();
      }
    } catch(err) {
      console.warn("Scratch error ignored:", err);
    }
  };

  const handleSendMessage = () => {
    if (!chatInput.trim()) return;
    const myName = currentUser ? `User_${currentUser.userId}` : 'duog';
    setMessages(prev => [...prev, { id: Date.now(), user: myName, text: chatInput, time: new Date().toLocaleTimeString().slice(0, 5) }]);
    setChatInput('');
  };

  // Tự động mở kết quả nếu tắt chế độ cào
  useEffect(() => {
    if (phase === "SCRATCHING" && isReadyToScratch && !isScratchedDone && !isScratchEnabled) {
        const timer = setTimeout(() => startResultPhase(), 500);
        return () => clearTimeout(timer);
    }
  }, [phase, isReadyToScratch, isScratchedDone, isScratchEnabled]);

  useEffect(() => {
    if (isReadyToScratch && !isScratchedDone && canvasRef.current) {
      const canvas = canvasRef.current; 
      const ctx = canvas.getContext('2d'); 
      const size = canvas.offsetWidth;
      // Fix lỗi scale trên màn hình Retina/HighDPI
      canvas.width = size; 
      canvas.height = size;
      
      ctx.fillStyle = isDarkMode ? '#0f172a' : '#cbd5e1'; 
      ctx.fillRect(0, 0, size, size);
      
      ctx.strokeStyle = isDarkMode ? 'rgba(56, 189, 248, 0.2)' : 'rgba(15, 23, 42, 0.1)'; 
      ctx.lineWidth = 1;
      
      for(let i=0; i<size; i+=20) {
        ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, size); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(size, i); ctx.stroke();
      }
      
      ctx.strokeStyle = '#38bdf8'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(size/2, size/2, size/2.5, 0, Math.PI*2); ctx.stroke();
      ctx.font = '900 14px monospace'; ctx.fillStyle = '#38bdf8'; ctx.textAlign = 'center';
      ctx.fillText('ĐANG QUÉT MỤC TIÊU...', size/2, size/2 + 5);
    }
  }, [isReadyToScratch, isScratchedDone, isDarkMode, isScratchEnabled]);

  const renderRoadmap = () => {
    const columns = []; let currentColumn = []; let lastType = null;
    [...gameHistory].reverse().forEach((item) => {
        if (item.type !== lastType && lastType !== null) { columns.push(currentColumn); currentColumn = [item]; }
        else { if (currentColumn.length >= 6) { columns.push(currentColumn); currentColumn = [item]; } else { currentColumn.push(item); } }
        lastType = item.type;
    });
    columns.push(currentColumn);
    const displayCols = columns.slice(-13); // Hiển thị 13 cột ngang theo yêu cầu
    
    return (
        <div className={`relative flex gap-1 overflow-x-auto p-3 rounded-xl border h-48 scrollbar-hide ${isDarkMode ? 'bg-black/60 border-sky-900/50' : 'bg-slate-300 border-slate-400'}`}>
            {/* LƯỚI TỌA ĐỘ 13 CỘT NGANG */}
            <div className="absolute inset-0 pointer-events-none opacity-20"
                 style={{ 
                   backgroundImage: `linear-gradient(to right, ${isDarkMode ? '#1e293b' : '#94a3b8'} 1px, transparent 1px), linear-gradient(to bottom, ${isDarkMode ? '#1e293b' : '#94a3b8'} 1px, transparent 1px)`,
                   backgroundSize: 'calc(100% / 13) calc(100% / 6)' 
                 }}>
            </div>
            {displayCols.map((col, idx) => (
                <div key={idx} className="flex flex-col gap-1 w-[calc(100%/13)] min-w-[24px] z-10">
                    {col.map((item, i) => (
                        <div key={i} className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-black border shadow-lg transition-all
                            ${item.type === 'T' ? 'bg-blue-600 border-blue-400 text-white' : item.type === 'X' ? 'bg-red-600 border-red-400 text-white' : 'bg-yellow-500 border-yellow-200 text-black'}`}>
                            {String(item.type)}
                        </div>
                    ))}
                </div>
            ))}
        </div>
    );
  };

  const renderTrendSvg = () => {
    const data = [...gameHistory].slice(0, 15).reverse();
    if (data.length === 0) return null;
    
    const mapY = (val) => 100 - ((val - 3) / (18 - 3)) * 80 - 10;
    const stepX = 100 / (data.length + (prediction ? 1 : 0) - 1);
    
    return (
        <svg className="w-full h-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none">
            {/* Đường trung bình (11 điểm) */}
            <line x1="0" y1={mapY(10.5)} x2="100" y2={mapY(10.5)} stroke="currentColor" strokeOpacity="0.2" strokeDasharray="2 2" strokeWidth="0.5" />
            
            {/* Đường xu hướng chính */}
            <polyline points={data.map((d, i) => `${i * stepX},${mapY(d.sum)}`).join(' ')} 
                      fill="none" stroke={isDarkMode ? '#38bdf8' : '#0ea5e9'} strokeWidth="2" vectorEffect="non-scaling-stroke" />
            
            {/* Các điểm dữ liệu */}
            {data.map((d, i) => (
                <circle key={i} cx={i * stepX} cy={mapY(d.sum)} r="1.5" fill={isDarkMode ? '#38bdf8' : '#0ea5e9'} />
            ))}
            
            {/* Đường dự đoán */}
            {prediction && (
                <>
                    <line x1={(data.length - 1) * stepX} y1={mapY(data[data.length - 1].sum)} x2={data.length * stepX} y2={mapY(prediction.sum)} stroke="#f59e0b" strokeWidth="2" strokeDasharray="4 2" vectorEffect="non-scaling-stroke" />
                    <circle cx={data.length * stepX} cy={mapY(prediction.sum)} r="2" fill="#f59e0b" className="animate-pulse" />
                </>
            )}
        </svg>
    );
  };

  const taiStats = getSessionStats('TAI');
  const xiuStats = getSessionStats('XIU');
  const baoStats = getSessionStats('BAO');

  return (
    <div className={`flex flex-col h-screen w-full max-w-md mx-auto overflow-hidden relative select-none font-mono transition-colors duration-500
      ${isDarkMode ? 'bg-[#07090c] text-white' : 'bg-slate-100 text-slate-900'}`}>
      
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@800&display=swap');
        .tactical-font { font-family: 'Orbitron', sans-serif; }
        @keyframes heartbeat { 0%, 100% { transform: scale(1); opacity: 0.8; } 50% { transform: scale(1.05); opacity: 1; } }
        .animate-tactical-pulse { animation: heartbeat 1.5s infinite; }
        @keyframes jet-patrol { 0%, 100% { transform: translateY(0) rotate(5deg); } 50% { transform: translateY(-8px) rotate(-5deg); } }
        .animate-jet-patrol { animation: jet-patrol 3s ease-in-out infinite; }
        @keyframes chip-fly { 0% { transform: translate(var(--start-x), var(--start-y)) scale(1.5); opacity: 1; } 100% { transform: translate(var(--end-x), var(--end-y)) scale(0.5); opacity: 0; } }
        .animate-chip-fly { animation: chip-fly 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) forwards; left: 0; top: 0; }
        .radar-line { position: absolute; width: 100%; height: 100%; background: conic-gradient(from 0deg, transparent 0%, rgba(56,189,248,0.15) 10%, transparent 20%); border-radius: 50%; animation: rotate 4s linear infinite; }
        @keyframes rotate { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        @keyframes neon-glow { 0%, 100% { border-color: rgba(56, 189, 248, 0.5); box-shadow: 0 0 10px rgba(56, 189, 248, 0.2); } 50% { border-color: rgba(56, 189, 248, 1); box-shadow: 0 0 20px rgba(56, 189, 248, 0.5); } }
        .bowl-rim { animation: neon-glow 2s ease-in-out infinite; }
        @keyframes bowl-shake { 0%, 100% { transform: translate(0, 0) rotate(0); } 10%, 30%, 50%, 70%, 90% { transform: translate(-4px, 0) rotate(-1deg); } 20%, 40%, 60%, 80% { transform: translate(4px, 0) rotate(1deg); } }
        .animate-bowl-shake { animation: bowl-shake 0.5s infinite; }
        @keyframes slot-scroll { 0% { transform: translateY(0); } 100% { transform: translateY(-50%); } }
        .animate-slot-scroll { animation: slot-scroll 0.1s linear infinite; }
        @keyframes land-reel { 0% { transform: translateY(-20px); } 50% { transform: translateY(10px); } 100% { transform: translateY(0); } }
        .animate-land-reel { animation: land-reel 0.3s ease-out forwards; }
      `}</style>

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

      {/* HIỆU ỨNG BIG WIN */}
      {showBigWin && <Fireworks />}
      {showBigWin && (
        <div className="absolute inset-0 z-[160] flex items-center justify-center pointer-events-none animate-in zoom-in duration-500">
            <div className="text-center">
                <h1 className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-b from-yellow-300 to-red-600 drop-shadow-[0_0_20px_rgba(255,215,0,0.8)] uppercase tracking-tighter animate-bounce" style={{ WebkitTextStroke: '2px white' }}>
                    BIG WIN
                </h1>
                <div className="text-4xl font-black text-white drop-shadow-[0_0_10px_rgba(0,0,0,0.8)] mt-2 animate-pulse">
                    THẮNG LỚN!
                </div>
            </div>
        </div>
      )}

      {/* THÔNG BÁO HOÀN TIỀN CÂN CỬA */}
      {refundNotification && (
        <div className="absolute top-24 left-1/2 -translate-x-1/2 z-[150] animate-in slide-in-from-top duration-500 w-max">
            <div className="bg-slate-900/90 border border-yellow-500/50 text-yellow-400 px-6 py-3 rounded-xl shadow-[0_0_20px_rgba(234,179,8,0.3)] flex items-center gap-3 backdrop-blur-md">
                <div className="p-2 bg-yellow-500/20 rounded-full animate-spin-slow">
                    <RotateCcw size={20} />
                </div>
                <div>
                    <div className="text-[10px] font-black uppercase tracking-widest text-yellow-600">CÂN CỬA HOÀN TIỀN</div>
                    <div className="text-sm font-bold">
                        Đã hoàn <span className="text-white">{(refundNotification.amount).toLocaleString()}</span> từ cửa {refundNotification.side}
                    </div>
                </div>
            </div>
        </div>
      )}

      {/* Chip bay */}
      {chipAnimations.map(anim => (
        <div key={anim.id} 
             className="fixed pointer-events-none z-[100] animate-chip-fly"
             style={{ left: 0, top: 0, '--start-x': `${anim.startX}px`, '--start-y': `${anim.startY}px`, '--end-x': `${anim.endX}px`, '--end-y': `${anim.endY}px` }}>
            <div className={`w-10 h-12 bg-gradient-to-br ${anim.colorClass} border border-white/20 flex items-center justify-center shadow-2xl`}
                 style={{ clipPath: 'polygon(15% 0%, 85% 0%, 100% 20%, 100% 80%, 85% 100%, 15% 100%, 0% 80%, 0% 20%)' }}>
                <span className="text-[6px] font-black text-white">{typeof anim.value === 'number' && anim.value >= 1000 ? `${anim.value/1000}K` : String(anim.value)}</span>
            </div>
        </div>
      ))}

      {/* Header Hũ */}
      <div className="pt-4 px-4 z-[60]">
        <div className={`w-full h-14 rounded-xl border-2 overflow-hidden flex items-center justify-between px-4 shadow-xl transition-colors
          ${isDarkMode ? 'border-slate-700 bg-[#0f172a]' : 'border-slate-300 bg-white'}`}>
            <div className="flex items-center"><FighterJet /><div className="flex flex-col leading-none"><span className="text-[10px] font-black text-sky-400 tracking-tighter uppercase">TRUNG TÂM TÁC CHIẾN</span><span className={`text-[7px] tracking-widest uppercase ${isDarkMode ? 'text-white/30' : 'text-slate-400'}`}>{currentUser ? `ID: ${currentUser.userId}` : 'KHÁCH (GUEST)'}</span></div></div>
            <div className="text-xl tactical-font text-yellow-500 drop-shadow-[0_0_8px_rgba(245,158,11,0.5)]">{(jackpot || 0).toLocaleString()}</div>
        </div>
      </div>

      {/* Điều hướng Tactical */}
      <div className="px-4 py-2 flex justify-between items-center z-50">
          <div className="flex gap-1.5">
            <button onClick={() => setShowRoadmap(true)} className={`p-1.5 rounded border active:scale-95 transition-all ${isDarkMode ? 'bg-slate-800 border-sky-500/30' : 'bg-white border-sky-500'}`}><BarChart3 size={14} className="text-sky-400" /></button>
            <button onClick={() => setShowHistory(true)} className={`p-1.5 rounded border active:scale-95 transition-all ${isDarkMode ? 'bg-slate-800 border-emerald-500/30' : 'bg-white border-emerald-500'}`}><History size={14} className="text-emerald-400" /></button>
            <button onClick={() => setShowChat(true)} className={`p-1.5 rounded border active:scale-95 transition-all ${isDarkMode ? 'bg-slate-800 border-purple-500/30' : 'bg-white border-purple-500'}`}><MessageSquare size={14} className="text-purple-400" /></button>
            <button onClick={() => setShowSessionBets(true)} className={`p-1.5 rounded border active:scale-95 transition-all ${isDarkMode ? 'bg-slate-800 border-amber-500/30' : 'bg-white border-amber-500'}`}><ClipboardList size={14} className="text-amber-400" /></button>
            <button onClick={() => setIsDarkMode(!isDarkMode)} className={`p-1.5 rounded border active:scale-95 transition-all ${isDarkMode ? 'bg-slate-800 border-yellow-500/30' : 'bg-slate-900 border-yellow-500'}`}>
                {isDarkMode ? <Sun size={14} className="text-yellow-400" /> : <Moon size={14} className="text-white" />}
            </button>
            <button onClick={() => setIsScratchEnabled(!isScratchEnabled)} className={`p-1.5 rounded border active:scale-95 transition-all ${isDarkMode ? 'bg-slate-800 border-pink-500/30' : 'bg-white border-pink-500'}`} title={isScratchEnabled ? "Tắt chế độ cào" : "Bật chế độ cào"}>
                <Fingerprint size={14} className={isScratchEnabled ? "text-pink-400" : "text-gray-400"} />
            </button>
            <button onClick={() => setShowHelp(true)} className={`p-1.5 rounded border active:scale-95 transition-all ${isDarkMode ? 'bg-slate-800 border-slate-500/30' : 'bg-white border-slate-500'}`}>
                <HelpCircle size={14} className="text-sky-400" />
            </button>
          </div>
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded border transition-colors ${isDarkMode ? 'bg-black/60 border-white/5' : 'bg-white border-black/10 shadow-sm'}`}>
            <Coins size={10} className="text-yellow-500" />
            <span className={`text-xs font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{(balance || 0).toLocaleString()}</span>
          </div>
      </div>

      {/* HIỂN THỊ 13 PHIÊN GẦN NHẤT */}
      <div className={`flex gap-1.5 p-2 overflow-x-auto scrollbar-hide border-y mx-4 rounded-md mb-2 transition-colors ${isDarkMode ? 'bg-black/40 border-white/5' : 'bg-slate-200 border-black/5'}`}>
        {gameHistory.slice(0, 13).map((h, i) => (
          <div key={i} className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-black border transition-all transform hover:scale-110 ${h.type==='T'?'bg-blue-600 border-blue-400 shadow-[0_0_8px_rgba(37,99,235,0.5)]':h.type==='X'?'bg-red-600 border-red-400 shadow-[0_0_8px_rgba(220,38,38,0.5)]':'bg-yellow-500 border-yellow-200 text-black'}`}>{String(h.type)}</div>
        ))}
      </div>

      {/* Radar Area (Bát) */}
      <div className="relative h-[250px] flex items-center justify-center perspective-1000">
        <div className={`relative w-64 h-64 flex items-center justify-center ${isRolling ? 'animate-bowl-shake' : ''}`}>
          <div className={`absolute inset-0 rounded-full border-[10px] bowl-rim flex items-center justify-center transition-colors ${isDarkMode ? 'bg-neutral-900 border-slate-800 shadow-[0_15px_40px_rgba(0,0,0,0.8)]' : 'bg-slate-300 border-slate-400 shadow-[0_15px_40px_rgba(0,0,0,0.1)]'}`}>
             {[...Array(8)].map((_, i) => (
                 <div key={i} className={`absolute w-2 h-2 rounded-sm rotate-45 border ${isDarkMode ? 'bg-slate-700 border-slate-600' : 'bg-slate-400 border-slate-500'}`} 
                      style={{ transform: `rotate(${i * 45}deg) translateY(-118px)` }} />
             ))}
          </div>

          <div className={`absolute inset-4 rounded-full overflow-hidden border shadow-[inset_0_0_30px_#000] transition-colors ${isDarkMode ? 'bg-[#020617] border-sky-500/40' : 'bg-slate-200 border-sky-500/60'}`}>
             <div className="radar-line" />
             <div className={`absolute inset-0 opacity-20 bg-[size:24px_24px] ${isDarkMode ? 'bg-[linear-gradient(to_right,#38bdf8_1px,transparent_1px),linear-gradient(to_bottom,#38bdf8_1px,transparent_1px)]' : 'bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)]'}`} />
             
             {dice.map((v, i) => (
                 <RealisticDice 
                    key={i} 
                    value={v} 
                    isRolling={isRolling} 
                    position={dicePositions[i]} 
                    isRevealed={isScratchedDone}
                    isDarkMode={isDarkMode}
                 />
             ))}
          </div>

          {(phase === "BETTING" || isRolling) && (
            <div className={`absolute inset-4 z-30 transition-all duration-700`}>
               <div className={`w-full h-full backdrop-blur-md rounded-full border-2 flex flex-col items-center justify-center relative overflow-hidden group transition-colors ${isDarkMode ? 'bg-slate-900/90 border-sky-500/30' : 'bg-white/80 border-sky-500/50'}`}>
                  {phase === "BETTING" && (
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="relative w-36 h-36 flex items-center justify-center animate-tactical-pulse">
                            <svg className="absolute inset-0 w-full h-full -rotate-90 drop-shadow-[0_0_15px_rgba(56,189,248,0.4)]" viewBox="0 0 100 100">
                                <circle cx="50" cy="50" r="48" fill="none" stroke="rgba(56, 189, 248, 0.1)" strokeWidth="1" />
                                <circle cx="50" cy="50" r="45" fill="none" stroke={isDarkMode ? "#1e293b" : "#cbd5e1"} strokeWidth="6" strokeDasharray="4 2" />
                                <circle cx="50" cy="50" r="45" fill="none" stroke={timeLeft <= 5 ? "#ef4444" : "#38bdf8"} strokeWidth="5" strokeDasharray={`${(timeLeft/60) * 282} 282`} strokeLinecap="round" className="transition-all duration-1000 ease-linear" />
                            </svg>
                            <div className="flex flex-col items-center leading-none z-10">
                                <span className={`text-[9px] font-black uppercase tracking-[0.2em] mb-1 ${timeLeft <= 5 ? 'text-red-500' : 'text-sky-500/70'}`}>
                                    {timeLeft <= 5 ? 'NGUY HIỂM' : 'ĐÃ KHÓA'}
                                </span>
                                <span className={`text-5xl font-black tactical-font tracking-tighter ${timeLeft <= 5 ? 'text-red-500 animate-pulse' : 'text-sky-400'}`}>
                                    {timeLeft}
                                </span>
                            </div>
                        </div>
                    </div>
                  )}
               </div>
            </div>
          )}
          
          {/* TEXT CÂN CỬA */}
          {phase === 'BETTING' && timeLeft <= 5 && timeLeft > 0 && (
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 pointer-events-none">
                <div className="text-red-500 font-black text-xl uppercase tracking-widest animate-pulse drop-shadow-lg bg-black/60 px-4 py-1 rounded-lg border border-red-500/30 backdrop-blur-sm whitespace-nowrap">
                    ⚠️ ĐANG CÂN CỬA
                </div>
            </div>
          )}

          {/* HIỂN THỊ ĐỒNG HỒ ĐẾM NGƯỢC KHI CÀO VÀ CHỜ PHIÊN MỚI */}
          {phase !== "BETTING" && !isRolling && (
             <div className="absolute top-6 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center pointer-events-none animate-in fade-in zoom-in duration-300">
                <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full border shadow-[0_0_15px_rgba(56,189,248,0.3)] backdrop-blur-md ${isDarkMode ? 'bg-slate-900/80 border-sky-500/40' : 'bg-white/80 border-sky-500/50'}`}>
                    <Clock size={12} className={timeLeft <= 5 ? "text-red-500 animate-ping" : "text-sky-400 animate-spin-slow"} />
                    <span className={`text-sm font-black tactical-font tracking-widest ${timeLeft <= 5 ? "text-red-500" : "text-sky-400"}`}>
                        {timeLeft}s
                    </span>
                </div>
             </div>
          )}

          {phase === "SCRATCHING" && !isRolling && !isScratchedDone && isScratchEnabled && (
            <div className="absolute inset-4 z-40 rounded-full overflow-hidden shadow-2xl cursor-crosshair">
              <canvas 
                ref={canvasRef} 
                className="w-full h-full" 
                style={{ touchAction: 'none' }}
                onMouseDown={()=>isDrawing.current=true} 
                onMouseUp={()=>isDrawing.current=false} 
                onMouseLeave={()=>isDrawing.current=false} 
                onMouseMove={scratch} 
                onTouchStart={()=>isDrawing.current=true} 
                onTouchEnd={()=>isDrawing.current=false} 
                onTouchMove={scratch} 
              />
            </div>
          )}
        </div>
      </div>

      {/* Cửa đặt cược */}
      <div className={`flex-1 p-4 flex flex-col justify-center gap-4 transition-colors ${isDarkMode ? 'bg-[#0a0f14]' : 'bg-slate-200'}`}>
        <div className="grid grid-cols-2 gap-4 h-32">
          <button disabled={phase !== "BETTING"} onClick={(e) => handleBet('xiu', e)} className={`relative rounded-xl border-2 transition-all flex flex-col items-center justify-center overflow-hidden ${getWinnerStyle('xiu')} ${phase === "BETTING" ? 'border-red-500/40 bg-red-950/10 active:scale-95' : 'border-slate-800'}`}>
            <Crosshair className="absolute top-2 left-2 opacity-20 text-red-500" size={14} />
            <span className="text-[10px] font-black text-red-500/60 uppercase mb-1">Mục Tiêu Alpha</span>
            <span className="text-4xl font-black tactical-font text-red-600 drop-shadow-[0_0_8px_#ef4444]">XỈU</span>
            <div className="flex items-center gap-2 mt-1 opacity-80">
                <div className="flex items-center gap-0.5 text-[9px] font-bold text-red-400"><User size={10} /> {xiuStats.totalPlayers}</div>
                <div className="flex items-center gap-0.5 text-[9px] font-bold text-red-400"><Coins size={10} /> {(xiuStats.totalAmount/1000000).toFixed(1)}M</div>
            </div>
            {bets.xiu > 0 && <div className="absolute bottom-2 right-2 bg-red-600 text-white text-[9px] font-black px-1.5 py-0.5 rounded-sm animate-bounce">{(bets.xiu || 0).toLocaleString()}</div>}
          </button>
          <button disabled={phase !== "BETTING"} onClick={(e) => handleBet('tai', e)} className={`relative rounded-xl border-2 transition-all flex flex-col items-center justify-center overflow-hidden ${getWinnerStyle('tai')} ${phase === "BETTING" ? 'border-sky-500/40 bg-sky-950/10 active:scale-95' : 'border-slate-800'}`}>
            <Crosshair className="absolute top-2 left-2 opacity-20 text-sky-500" size={14} />
            <span className="text-[10px] font-black text-sky-500/60 uppercase mb-1">Mục Tiêu Bravo</span>
            <span className="text-4xl font-black tactical-font text-sky-500 drop-shadow-[0_0_8px_#38bdf8]">TÀI</span>
            <div className="flex items-center gap-2 mt-1 opacity-80">
                <div className="flex items-center gap-0.5 text-[9px] font-bold text-sky-400"><User size={10} /> {taiStats.totalPlayers}</div>
                <div className="flex items-center gap-0.5 text-[9px] font-bold text-sky-400"><Coins size={10} /> {(taiStats.totalAmount/1000000).toFixed(1)}M</div>
            </div>
            {bets.tai > 0 && <div className="absolute bottom-2 right-2 bg-sky-600 text-white text-[9px] font-black px-1.5 py-0.5 rounded-sm animate-bounce">{(bets.tai || 0).toLocaleString()}</div>}
          </button>
        </div>
        <button disabled={phase !== "BETTING"} onClick={(e) => handleBet('bao', e)} className={`w-full py-5 rounded-xl border-2 transition-all relative flex flex-col items-center justify-center overflow-hidden ${getWinnerStyle('bao')} ${phase === "BETTING" ? 'border-amber-500/40 bg-amber-950/10 active:scale-95' : 'border-slate-800'}`}>
          <div className="absolute inset-0 opacity-10 bg-[repeating-linear-gradient(45deg,#f59e0b,#f59e0b_10px,#000_10px,#000_20px)]" />
          <div className="flex items-center gap-3"><ShieldAlert size={20} className="text-amber-500 animate-pulse" /><span className="text-2xl font-black tactical-font text-amber-500 italic uppercase">BÃO TÁP (X30)</span></div>
          <div className="flex items-center gap-3 mt-1 opacity-80 absolute bottom-2">
                <div className="flex items-center gap-0.5 text-[9px] font-bold text-amber-500"><User size={10} /> {baoStats.totalPlayers}</div>
                <div className="flex items-center gap-0.5 text-[9px] font-bold text-amber-500"><Coins size={10} /> {(baoStats.totalAmount/1000000).toFixed(1)}M</div>
          </div>
          {bets.bao > 0 && <div className="absolute top-1 right-4 bg-amber-500 text-black text-[10px] font-black px-3 py-0.5 rounded-sm animate-bounce">{(bets.bao || 0).toLocaleString()}</div>}
        </button>
      </div>

      {/* Chip Selection Area */}
      <div className="px-4 pb-6 pt-1 z-50">
        <div className={`rounded-xl border py-3 px-2 flex justify-center gap-1 shadow-2xl overflow-hidden backdrop-blur-xl transition-colors
          ${isDarkMode ? 'border-white/10 bg-slate-900/90' : 'border-black/10 bg-white/90'}`}>
            {chipList.map((chip) => (
                <MilitaryChip key={chip.value} value={chip.value} colorClass={chip.color} isSelected={selectedChip === chip.value} onClick={() => setSelectedChip(chip.value)} isDarkMode={isDarkMode} />
            ))}
        </div>
      </div>

      {/* MODAL RADAR (SOI CẦU) */}
      {showRoadmap && (
        <div className={`absolute inset-0 z-[100] backdrop-blur-2xl p-6 flex flex-col font-mono animate-in slide-in-from-bottom duration-300 ${isDarkMode ? 'bg-slate-950/98' : 'bg-slate-100/98'}`}>
            <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-3 text-sky-400"><Target size={24} className="animate-spin-slow" /><h2 className={`text-xl tactical-font uppercase ${isDarkMode ? 'text-sky-400' : 'text-slate-800'}`}>Radar Tác Chiến</h2></div>
                <button onClick={() => setShowRoadmap(false)} className={`p-2 rounded-full border transition-colors ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-white border-slate-300'}`}><X size={20} /></button>
            </div>
            <div className={`flex-1 border rounded-xl p-4 overflow-y-auto flex flex-col gap-6 shadow-inner transition-colors ${isDarkMode ? 'bg-black/40 border-white/5' : 'bg-white border-slate-300'}`}>
                {/* THỐNG KÊ NHANH */}
                <div className="grid grid-cols-3 gap-3 text-[9px] font-black uppercase text-center">
                    <div className="bg-sky-600/10 border border-sky-500/30 p-2 rounded-lg text-sky-400">Tài: {gameHistory.filter(x=>x.type==='T').length}</div>
                    <div className="bg-red-600/10 border border-red-500/30 p-2 rounded-lg text-red-400">Xỉu: {gameHistory.filter(x=>x.type==='X').length}</div>
                    <div className="bg-yellow-600/10 border border-yellow-500/30 p-2 rounded-lg text-yellow-400">Bão: {gameHistory.filter(x=>x.type==='B').length}</div>
                </div>

                {/* BIỂU ĐỒ CẦU 13 CỘT VỚI LƯỚI */}
                <div>
                    <h3 className={`text-[10px] font-black uppercase mb-3 tracking-widest ${isDarkMode ? 'text-gray-500' : 'text-slate-400'}`}>Biểu Đồ Radar (13 Cột)</h3>
                    {renderRoadmap()}
                </div>

                {/* BIỂU ĐỒ XU HƯỚNG & DỰ ĐOÁN */}
                <div>
                    <div className="flex justify-between items-center mb-2">
                        <h3 className={`text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'text-gray-500' : 'text-slate-400'}`}>Biểu Đồ Xu Hướng & Dự Đoán</h3>
                        <button onClick={togglePrediction} className="flex items-center gap-1 px-2 py-1 rounded bg-sky-600 text-white text-[9px] font-bold uppercase hover:bg-sky-500 transition-colors shadow-lg active:scale-95">
                            <BrainCircuit size={10} /> {prediction ? 'Tắt Dự Đoán' : 'AI Phân Tích'}
                        </button>
                    </div>
                    <div className={`relative h-32 w-full border-l border-b p-2 rounded-lg ${isDarkMode ? 'border-white/10 bg-black/20' : 'border-slate-300 bg-slate-50'}`}>
                        {renderTrendSvg()}
                    </div>
                    {prediction && (
                        <div className="mt-2 flex items-center justify-center gap-2 animate-in fade-in slide-in-from-bottom bg-yellow-500/10 p-2 rounded border border-yellow-500/20">
                            <span className="text-[10px] text-yellow-500 uppercase font-bold">Dự đoán phiên kế:</span>
                            <span className={`text-sm font-black ${prediction.type === 'T' ? 'text-sky-500' : 'text-red-500'}`}>{prediction.sum} - {prediction.type === 'T' ? 'TÀI' : 'XỈU'}</span>
                        </div>
                    )}
                </div>

                {/* CẦU CHI TIẾT TỔNG ĐIỂM */}
                <div>
                    <h3 className={`text-[10px] font-black uppercase mb-3 tracking-widest ${isDarkMode ? 'text-gray-500' : 'text-slate-400'}`}>Cầu Chi Tiết (Tổng Điểm)</h3>
                    <div className={`grid grid-cols-7 gap-2 p-3 rounded-xl border ${isDarkMode ? 'bg-black/40 border-white/5' : 'bg-slate-200 border-black/5'}`}>
                        {gameHistory.slice(0, 14).map((h, i) => (
                            <div key={i} className="flex flex-col items-center gap-1">
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-black shadow-md border
                                    ${h.type === 'T' ? 'bg-blue-900/40 border-blue-500 text-blue-400' : h.type === 'X' ? 'bg-red-900/40 border-red-500 text-red-400' : 'bg-yellow-900/40 border-yellow-500 text-yellow-400'}`}>
                                    {String(h.sum)}
                                </div>
                                <span className={`text-[7px] font-bold ${isDarkMode ? 'text-slate-500' : 'text-slate-600'}`}>P-{14-i}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
            <button onClick={() => setShowRoadmap(false)} className="w-full mt-6 py-4 bg-sky-600 text-white font-black tactical-font uppercase text-xs border-b-4 border-sky-800">Xác Nhận</button>
        </div>
      )}

      {/* MODAL HƯỚNG DẪN */}
      {showHelp && (
        <div className={`absolute inset-0 z-[200] backdrop-blur-3xl p-6 flex flex-col font-mono animate-in zoom-in duration-300 ${isDarkMode ? 'bg-slate-950/95' : 'bg-slate-100/95'}`}>
            <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-3 text-sky-400"><HelpCircle size={24} /><h2 className={`text-xl tactical-font uppercase ${isDarkMode ? 'text-sky-400' : 'text-slate-800'}`}>Cẩm Nang Tác Chiến</h2></div>
                <button onClick={() => setShowHelp(false)} className={`p-2 rounded-full border ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-white border-slate-300'}`}><X size={20} /></button>
            </div>
            <div className={`flex-1 overflow-y-auto p-4 rounded-xl border leading-relaxed text-sm ${isDarkMode ? 'bg-black/40 border-white/5 text-gray-300' : 'bg-white border-slate-300 text-slate-700'}`}>
                <h3 className="text-sky-500 font-black mb-2 uppercase">1. Quy tắc cơ bản:</h3>
                <p className="mb-4">Dự đoán tổng điểm của 3 mục tiêu (xúc xắc) sau khi quét radar.</p>
                <h3 className="text-red-500 font-black mb-2 uppercase">2. Mục tiêu Alpha (XỈU):</h3>
                <p className="mb-4">Tổng điểm từ 4 đến 10. Tỉ lệ đầu tư: 1 đền 1.</p>
                <h3 className="text-sky-500 font-black mb-2 uppercase">3. Mục tiêu Bravo (TÀI):</h3>
                <p className="mb-4">Tổng điểm từ 11 đến 17. Tỉ lệ đầu tư: 1 đền 1.</p>
                <h3 className="text-amber-500 font-black mb-2 uppercase">4. BÃO TÁP:</h3>
                <p className="mb-4">Cả 3 mục tiêu có điểm số bằng nhau. Tỉ lệ đầu tư cực lớn: 1 đền 30.</p>
                <h3 className="text-yellow-500 font-black mb-2 uppercase italic underline">5. QUY TẮC PHI ĐỘI:</h3>
                <p className="font-bold text-red-400">Bạn KHÔNG THỂ đặt cược cùng lúc vào TÀI và XỈU trong một phiên để đảm bảo tính chiến thuật.</p>
            </div>
            <button onClick={() => setShowHelp(false)} className="w-full mt-6 py-4 bg-sky-600 text-white font-black tactical-font uppercase text-xs border-b-4 border-sky-800">Rõ thưa Chỉ Huy!</button>
        </div>
      )}

      {/* MODAL LỊCH SỬ CƯỢC */}
      {showHistory && (
        <div className={`absolute inset-0 z-[100] backdrop-blur-2xl p-6 flex flex-col animate-in slide-in-from-bottom duration-300 ${isDarkMode ? 'bg-slate-950/98' : 'bg-slate-100/98'}`}>
            <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-3 text-emerald-400"><History size={24} /><h2 className={`text-xl tactical-font uppercase ${isDarkMode ? 'text-emerald-400' : 'text-slate-800'}`}>Nhật Ký Chiến Dịch</h2></div>
                <button onClick={() => setShowHistory(false)} className={`p-2 rounded-full border transition-colors ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-white border-slate-300'}`}><X size={20} /></button>
            </div>
            <div className={`flex-1 border rounded-xl overflow-hidden flex flex-col shadow-inner transition-colors ${isDarkMode ? 'bg-black/40 border-white/5' : 'bg-white border-slate-300'}`}>
                <div className="grid grid-cols-4 bg-white/5 p-3 text-[9px] font-black uppercase text-gray-500 text-center border-b border-white/5 tracking-widest">
                    <span>PHIÊN</span><span>MỤC TIÊU</span><span>ĐẦU TƯ</span><span>KẾT QUẢ</span>
                </div>
                <div className="flex-1 overflow-y-auto scrollbar-hide">
                    {betHistory.length > 0 ? betHistory.map((bet, i) => (
                        <div key={i} className="grid grid-cols-4 p-4 text-[10px] font-bold text-center border-b border-white/5 items-center">
                            <span className="text-gray-600">#{String(bet.session)}</span>
                            <span className={bet.type === 'TAI' ? 'text-sky-400' : bet.type === 'XIU' ? 'text-red-400' : 'text-amber-400'}>{String(bet.type)}</span>
                            <span className="text-gray-400">{(bet.amount || 0).toLocaleString()}</span>
                            <span className={bet.winAmount > 0 ? 'text-emerald-400' : 'text-gray-700'}>{bet.winAmount > 0 ? `+${bet.winAmount.toLocaleString()}` : 'THẤT BẠI'}</span>
                        </div>
                    )) : (
                        <div className="flex flex-col items-center justify-center h-full opacity-10">
                            <Plane size={64} className="mb-4 animate-bounce" />
                            <p className="text-xs font-black uppercase text-center">Chưa có dữ liệu</p>
                        </div>
                    )}
                </div>
            </div>
            <button onClick={() => setShowHistory(false)} className="w-full mt-6 py-4 bg-emerald-600 text-white font-black tactical-font uppercase text-xs border-b-4 border-emerald-800">Thoát Nhật Ký</button>
        </div>
      )}

      {/* MODAL TÌNH BÁO PHIÊN */}
      {showSessionBets && (
        <div className={`absolute inset-0 z-[100] backdrop-blur-2xl p-6 flex flex-col animate-in slide-in-from-left duration-300 ${isDarkMode ? 'bg-slate-950/98' : 'bg-slate-100/98'}`}>
            <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-3 text-amber-400"><Activity size={24} /><h2 className={`text-xl tactical-font uppercase ${isDarkMode ? 'text-amber-400' : 'text-slate-800'}`}>Tình Báo Phiên</h2></div>
                <button onClick={() => setShowSessionBets(false)} className={`p-2 rounded-full border transition-colors ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-white border-slate-300'}`}><X size={20} /></button>
            </div>
            <div className={`flex-1 border rounded-xl overflow-hidden flex flex-col shadow-inner transition-colors ${isDarkMode ? 'bg-black/40 border-white/5' : 'bg-white border-slate-300'}`}>
                <div className="grid grid-cols-3 bg-white/5 p-3 text-[9px] font-black uppercase text-gray-500 text-center border-b border-white/5 tracking-widest">
                    <span>MÃ PHI CÔNG</span><span>MỤC TIÊU</span><span>CHI PHÍ</span>
                </div>
                <div className="flex-1 overflow-y-auto scrollbar-hide">
                    {sessionBets.length > 0 ? sessionBets.map((b, i) => (
                        <div key={i} className="grid grid-cols-3 p-4 text-[10px] font-bold text-center border-b border-white/5 items-center">
                            <div className="flex items-center gap-2 justify-center text-gray-400"><User size={10} /> {String(b.id)}</div>
                            <span className={b.target === 'TAI' ? 'text-sky-400' : b.target === 'XIU' ? 'text-red-400' : 'text-amber-400'}>{String(b.target)}</span>
                            <span className="text-gray-300">{(b.amount || 0).toLocaleString()}</span>
                        </div>
                    )) : (
                        <div className="flex flex-col items-center justify-center h-full opacity-10">
                            <Radio size={64} className="mb-4 animate-pulse" />
                            <p className="text-xs font-black uppercase">Đang quét tần số...</p>
                        </div>
                    )}
                </div>
            </div>
            <button onClick={() => setShowSessionBets(false)} className="w-full mt-6 py-4 bg-amber-600 text-white font-black tactical-font uppercase text-xs border-b-4 border-amber-800">Đóng Tình Báo</button>
        </div>
      )}

      {/* MODAL RADIO CHAT */}
      {showChat && (
        <div className={`absolute inset-0 z-[100] backdrop-blur-2xl p-6 flex flex-col animate-in slide-in-from-right duration-300 ${isDarkMode ? 'bg-slate-950/98' : 'bg-slate-100/98'}`}>
            <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-3 text-purple-400"><Radio size={24} className="animate-pulse" /><h2 className={`text-xl tactical-font uppercase ${isDarkMode ? 'text-purple-400' : 'text-slate-800'}`}>Liên Lạc Vô Tuyến</h2></div>
                <button onClick={() => setShowChat(false)} className={`p-2 rounded-full border transition-colors ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-white border-slate-300'}`}><X size={20} /></button>
            </div>
            <div className={`flex-1 border rounded-xl p-4 overflow-y-auto mb-4 flex flex-col gap-3 custom-scrollbar transition-colors ${isDarkMode ? 'bg-black/40 border-white/5' : 'bg-white border-slate-300 shadow-inner'}`}>
                {messages.map(msg => (
                    <div key={msg.id} className={`flex flex-col ${msg.user === (currentUser ? `User_${currentUser.userId}` : 'duog') ? 'items-end' : 'items-start'}`}>
                        <div className="flex items-center gap-2 mb-1">
                            <span className={`text-[8px] font-black uppercase ${msg.user === (currentUser ? `User_${currentUser.userId}` : 'duog') ? 'text-sky-400' : 'text-gray-500'}`}>{String(msg.user)}</span>
                            <span className="text-[7px] text-white/20">{String(msg.time)}</span>
                        </div>
                        <div className={`px-3 py-2 rounded-lg text-xs max-w-[80%] border ${msg.user === (currentUser ? `User_${currentUser.userId}` : 'duog') ? 'bg-sky-600/20 border-sky-500/30 text-sky-100' : 'bg-slate-100 border-slate-200 text-slate-800'}`}>
                            {String(msg.text)}
                        </div>
                    </div>
                ))}
            </div>
            <div className={`flex gap-2 p-2 rounded-xl border items-center transition-colors ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-white border-slate-300'}`}>
                <input 
                    type="text" 
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                    placeholder="Truyền tin..." 
                    className={`flex-1 bg-transparent border-none outline-none text-xs p-2 ${isDarkMode ? 'text-sky-400' : 'text-slate-900'}`}
                />
                <button onClick={handleSendMessage} className="p-2 bg-sky-600 rounded-lg"><Send size={16} /></button>
            </div>
        </div>
      )}

      {/* Floating AI Button */}
      <div className="absolute bottom-32 right-4 z-[60] flex flex-col gap-3">
        <button onClick={async () => { setIsAiLoading(true); setShowAiModal(true); setAiMessage("Radar đang quét cầu..."); setTimeout(() => { setIsAiLoading(false); }, 1000); }} 
                className="w-13 h-13 bg-sky-600 rounded-xl border-2 border-sky-400 shadow-[0_0_20px_rgba(14,165,233,0.4)] flex items-center justify-center active:scale-90 transition-all">
            <Activity size={24} className="text-white animate-pulse"/>
        </button>
      </div>

      {/* AI Modal */}
      {showAiModal && (
        <div className="absolute inset-0 z-[300] flex items-center justify-center p-8 bg-black/90 backdrop-blur-md">
            <div className="w-full bg-slate-900 border-2 border-sky-500/40 rounded-3xl p-8 shadow-2xl text-center relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-sky-500 animate-pulse" />
                <h3 className="text-sky-500 font-black mb-6 flex items-center justify-center gap-3 text-xl tracking-tighter italic uppercase"><Zap size={24}/> Phân Tích Radar</h3>
                <div className="min-h-[100px] flex items-center justify-center italic text-sm text-sky-200 font-semibold leading-relaxed px-2">
                    {isAiLoading ? <Loader2 className="animate-spin text-sky-500" size={36}/> : <p>"{aiMessage}"</p>}
                </div>
                <button onClick={() => setShowAiModal(false)} className="w-full mt-8 py-4 bg-sky-600 text-white font-black rounded-xl shadow-xl uppercase tracking-widest text-sm border-b-4 border-sky-800">Đã hiểu!</button>
            </div>
        </div>
      )}

    </div>
  );
};

export default App;