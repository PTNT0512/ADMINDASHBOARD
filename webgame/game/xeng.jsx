import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Volume2, VolumeX, RefreshCw, Zap, Target, Shield, Radio, Flame, Crosshair } from 'lucide-react';

// --- BỘ SƯU TẬP ICON CHIBI TACTICAL (SVG) ---
const Icons = {
  // RANK -> Chibi Chevron (Bo tròn, mập mạp)
  RANK: () => (
    <svg viewBox="0 0 100 80" className="w-full h-full drop-shadow-lg">
      <defs>
        <linearGradient id="gradRank" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#60a5fa" />
          <stop offset="100%" stopColor="#2563eb" />
        </linearGradient>
      </defs>
      {/* Nền khiên tròn */}
      <path d="M50,10 L85,25 Q85,55 50,75 Q15,55 15,25 Z" fill="#1e3a8a" stroke="#3b82f6" strokeWidth="3" rx="10" />
      {/* Vạch quân hàm mập */}
      <path d="M25,35 L50,50 L75,35" fill="none" stroke="#fff" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M25,20 L50,35 L75,20" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  // NUKE -> Chibi Bomb (Tròn vo, cánh ngắn)
  NUKE: () => (
    <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-lg">
      {/* Thân bom tròn */}
      <circle cx="50" cy="55" r="35" fill="#ef4444" stroke="#7f1d1d" strokeWidth="3" />
      {/* Đỉnh bom */}
      <rect x="35" y="10" width="30" height="15" rx="5" fill="#991b1b" />
      {/* Cánh đuôi nhỏ xíu */}
      <path d="M15,55 L5,75 L25,75 Z" fill="#991b1b" />
      <path d="M85,55 L95,75 L75,75 Z" fill="#991b1b" />
      {/* Biểu tượng phóng xạ cute */}
      <circle cx="50" cy="55" r="12" fill="#222" />
      <circle cx="50" cy="55" r="5" fill="#facc15" />
      <path d="M50,55 L50,38" stroke="#facc15" strokeWidth="4" strokeLinecap="round" />
      <path d="M50,55 L65,63" stroke="#facc15" strokeWidth="4" strokeLinecap="round" />
      <path d="M50,55 L35,63" stroke="#facc15" strokeWidth="4" strokeLinecap="round" />
      {/* Highlight bóng bẩy */}
      <ellipse cx="65" cy="40" rx="8" ry="4" fill="#fff" opacity="0.4" transform="rotate(-45 65 40)" />
    </svg>
  ),
  // MEDAL -> Chibi Medal (Tròn, dây ngắn)
  MEDAL: () => (
    <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-lg">
      {/* Dây đeo ngắn */}
      <path d="M35,10 L35,45 L50,55 L65,45 L65,10 Z" fill="#3b82f6" stroke="#1d4ed8" strokeWidth="2" />
      {/* Huy chương vàng to */}
      <circle cx="50" cy="65" r="28" fill="#facc15" stroke="#b45309" strokeWidth="3" />
      <circle cx="50" cy="65" r="20" fill="none" stroke="#fef08a" strokeWidth="2" strokeDasharray="4 2" />
      {/* Ngôi sao ở giữa */}
      <path d="M50,55 L54,63 L62,63 L56,69 L58,77 L50,72 L42,77 L44,69 L38,63 L46,63 Z" fill="#b45309" />
    </svg>
  ),
  // RADAR -> Chibi Screen (Màn hình cong, quét to)
  RADAR: () => (
    <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-lg">
      {/* Khung màn hình bo tròn */}
      <rect x="10" y="15" width="80" height="70" rx="15" fill="#064e3b" stroke="#34d399" strokeWidth="4" />
      {/* Màn hình xanh */}
      <circle cx="50" cy="50" r="28" fill="#065f46" />
      {/* Vạch quét */}
      <path d="M50,50 L50,22 A28,28 0 0,1 78,50" fill="rgba(52, 211, 153, 0.4)" />
      <line x1="50" y1="50" x2="78" y2="50" stroke="#34d399" strokeWidth="2" strokeLinecap="round" />
      {/* Chấm đỏ mục tiêu */}
      <circle cx="65" cy="35" r="4" fill="#ef4444" className="animate-ping" />
      {/* Ăng ten nhỏ trên đầu */}
      <path d="M50,15 L50,5" stroke="#34d399" strokeWidth="4" strokeLinecap="round" />
      <circle cx="50" cy="5" r="3" fill="#34d399" />
    </svg>
  ),
  // SCOPE -> Chibi Crosshair (Ống ngắm to, kính dày)
  SCOPE: () => (
    <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-lg">
      {/* Vỏ ngoài dày */}
      <circle cx="50" cy="50" r="42" fill="#1f2937" stroke="#ef4444" strokeWidth="6" />
      {/* Kính */}
      <circle cx="50" cy="50" r="35" fill="rgba(239, 68, 68, 0.1)" />
      {/* Tâm ngắm bo tròn */}
      <line x1="25" y1="50" x2="75" y2="50" stroke="#ef4444" strokeWidth="4" strokeLinecap="round" />
      <line x1="50" y1="25" x2="50" y2="75" stroke="#ef4444" strokeWidth="4" strokeLinecap="round" />
      <circle cx="50" cy="50" r="15" fill="none" stroke="#ef4444" strokeWidth="2" />
      <circle cx="50" cy="50" r="4" fill="#ef4444" />
      {/* Highlight kính */}
      <path d="M60,30 Q70,40 70,55" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="3" strokeLinecap="round" />
    </svg>
  ),
  // GRENADE -> Chibi Pinecone (Tròn ung ủng)
  GRENADE: () => (
    <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-lg">
      {/* Thân lựu đạn bầu bĩnh */}
      <path d="M25,35 Q20,85 50,90 Q80,85 75,35 Z" fill="#15803d" stroke="#4ade80" strokeWidth="3" />
      {/* Các ô vuông (mập) */}
      <rect x="35" y="40" width="12" height="12" rx="3" fill="#14532d" fillOpacity="0.5" />
      <rect x="53" y="40" width="12" height="12" rx="3" fill="#14532d" fillOpacity="0.5" />
      <rect x="35" y="60" width="12" height="12" rx="3" fill="#14532d" fillOpacity="0.5" />
      <rect x="53" y="60" width="12" height="12" rx="3" fill="#14532d" fillOpacity="0.5" />
      {/* Chốt lựu đạn to */}
      <rect x="40" y="20" width="20" height="15" rx="4" fill="#64748b" />
      {/* Vòng giật tròn to */}
      <circle cx="70" cy="25" r="10" fill="none" stroke="#94a3b8" strokeWidth="3" />
    </svg>
  ),
  // AMMO -> Chibi Bullet (Ngắn, đầu tròn)
  AMMO: () => (
    <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-lg">
      {/* Vỏ đạn mập */}
      <rect x="30" y="40" width="40" height="45" rx="5" fill="#b45309" stroke="#f59e0b" strokeWidth="3" />
      {/* Đầu đạn tròn vo */}
      <path d="M30,40 L70,40 Q70,10 50,10 Q30,10 30,40 Z" fill="#fcd34d" stroke="#f59e0b" strokeWidth="3" />
      {/* Đai đạn */}
      <rect x="28" y="75" width="44" height="8" rx="2" fill="#78350f" />
      {/* Highlight bóng */}
      <path d="M40,20 Q45,20 45,60" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="3" strokeLinecap="round" />
    </svg>
  ),
  // DRONE -> Chibi Quadcopter (Tròn, cánh quạt to)
  DRONE: () => (
    <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-lg">
      {/* Thân drone tròn */}
      <circle cx="50" cy="50" r="18" fill="#ef4444" stroke="#7f1d1d" strokeWidth="2" />
      {/* Mắt camera to */}
      <circle cx="50" cy="50" r="8" fill="#38bdf8" />
      <circle cx="52" cy="48" r="3" fill="#fff" opacity="0.8" />
      {/* Cánh quạt (4 góc) */}
      <g stroke="#555" strokeWidth="3" strokeLinecap="round">
        <line x1="35" y1="35" x2="15" y2="15" />
        <line x1="65" y1="35" x2="85" y2="15" />
        <line x1="35" y1="65" x2="15" y2="85" />
        <line x1="65" y1="65" x2="85" y2="85" />
      </g>
      {/* Vòng bảo vệ cánh quạt */}
      <circle cx="15" cy="15" r="10" fill="rgba(255,255,255,0.1)" stroke="#555" strokeWidth="2" className="animate-spin" />
      <circle cx="85" cy="15" r="10" fill="rgba(255,255,255,0.1)" stroke="#555" strokeWidth="2" className="animate-spin" />
      <circle cx="85" cy="85" r="10" fill="rgba(255,255,255,0.1)" stroke="#555" strokeWidth="2" className="animate-spin" />
      <circle cx="15" cy="85" r="10" fill="rgba(255,255,255,0.1)" stroke="#555" strokeWidth="2" className="animate-spin" />
    </svg>
  )
};

// --- CẤU HÌNH VẬT PHẨM & MÀU SẮC ---
const ITEMS = [
  { id: 'RANK', label: 'RANK', group: 'BLUE', odds: 100, icon: Icons.RANK, color: '#1e3a8a' }, // Special
  { id: 'NUKE', label: 'NUKE', group: 'RED', odds: 40, icon: Icons.NUKE, color: '#450a0a' },
  { id: 'MEDAL', label: 'MEDAL', group: 'YELLOW', odds: 30, icon: Icons.MEDAL, color: '#422006' },
  { id: 'RADAR', label: 'RADAR', group: 'GREEN', odds: 20, icon: Icons.RADAR, color: '#052e16' },
  { id: 'SCOPE', label: 'SCOPE', group: 'RED', odds: 20, icon: Icons.SCOPE, color: '#450a0a' },
  { id: 'GRENADE', label: 'GRENADE', group: 'GREEN', odds: 15, icon: Icons.GRENADE, color: '#052e16' },
  { id: 'AMMO', label: 'AMMO', group: 'YELLOW', odds: 10, icon: Icons.AMMO, color: '#422006' },
  { id: 'DRONE', label: 'DRONE', group: 'RED', odds: 5, icon: Icons.DRONE, color: '#450a0a' },
];

const COLORS = {
  RED: { name: 'RED', hex: '#ef4444', bg: '#450a0a', border: '#b91c1c' },
  GREEN: { name: 'GREEN', hex: '#22c55e', bg: '#052e16', border: '#15803d' },
  YELLOW: { name: 'YELLOW', hex: '#eab308', bg: '#422006', border: '#a16207' },
  BLUE: { name: 'BLUE', hex: '#3b82f6', bg: '#172554', border: '#1d4ed8' }
};

// BẢN ĐỒ VÒNG TRÒN (24 ô)
const BOARD_MAP = [
  'AMMO', 'SCOPE', 'RANK', 'RANK', 'DRONE', 'DRONE', 'RADAR', // Top
  'RADAR', 'NUKE', // Right
  'DRONE', 'AMMO', 'AMMO', 'SCOPE', 'NUKE', 'NUKE', 'MEDAL', // Bottom (Ngược)
  'MEDAL', 'GRENADE', // Left
  'GRENADE', 'DRONE', 'DRONE', 'MEDAL', 'MEDAL', 'AMMO' // Closing
];

const PERIMETER_ITEMS = Array.from({length: 24}).map((_, i) => {
    const key = BOARD_MAP[i % BOARD_MAP.length];
    return ITEMS.find(it => it.id === key) || ITEMS[7];
});

// Hàm tính vị trí Grid 7x7
const getGridPosition = (index) => {
    if (index < 7) return { row: 1, col: index + 1 };
    if (index < 12) return { row: index - 5, col: 7 };
    if (index < 19) return { row: 7, col: 7 - (index - 12) };
    return { row: 7 - (index - 18), col: 1 };
};

export default function TacticalKingCrown() {
  const [credits, setCredits] = useState(10000);
  const [itemBets, setItemBets] = useState({}); // Cược vật phẩm
  const [colorBets, setColorBets] = useState({ RED: 0, GREEN: 0, YELLOW: 0 }); // Cược màu
  const [activeIndex, setActiveIndex] = useState(0);
  const [isSpinning, setIsSpinning] = useState(false);
  const [lastWin, setLastWin] = useState(0);
  const [message, setMessage] = useState("SẴN SÀNG TÁC CHIẾN");
  const [isMuted, setIsMuted] = useState(false);

  const audioCtxRef = useRef(null);

  // --- AUDIO ---
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
    const now = ctx.currentTime;
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === 'tick') {
        osc.type = 'square';
        osc.frequency.setValueAtTime(600, now);
        osc.frequency.exponentialRampToValueAtTime(100, now + 0.05);
        gain.gain.setValueAtTime(0.05, now);
        gain.gain.linearRampToValueAtTime(0, now + 0.05);
        osc.start(now);
        osc.stop(now + 0.05);
    } else if (type === 'win') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(200, now);
        osc.frequency.linearRampToValueAtTime(600, now + 0.3);
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.linearRampToValueAtTime(0, now + 0.5);
        osc.start(now);
        osc.stop(now + 0.5);
    } else if (type === 'click') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(800, now);
        gain.gain.setValueAtTime(0.05, now);
        gain.gain.linearRampToValueAtTime(0, now + 0.1);
        osc.start(now);
        osc.stop(now + 0.1);
    }
  }, [isMuted]);

  // --- BETTING ---
  const handleItemBet = (itemId) => {
    if (isSpinning) return;
    if (credits >= 10) {
      playSound('click');
      setCredits(prev => prev - 10);
      setItemBets(prev => ({ ...prev, [itemId]: (prev[itemId] || 0) + 10 }));
      setLastWin(0);
      setMessage("ĐANG NẠP ĐẠN...");
    }
  };

  const handleColorBet = (colorKey) => {
    if (isSpinning) return;
    if (credits >= 50) { // Cược màu đắt hơn
      playSound('click');
      setCredits(prev => prev - 50);
      setColorBets(prev => ({ ...prev, [colorKey]: prev[colorKey] + 50 }));
      setLastWin(0);
      setMessage(`ĐẶT CƯỢC ${colorKey}...`);
    }
  };

  const handleReset = () => {
      if (isSpinning) return;
      const totalItemBet = Object.values(itemBets).reduce((a, b) => a + b, 0);
      const totalColorBet = Object.values(colorBets).reduce((a, b) => a + b, 0);
      setCredits(prev => prev + totalItemBet + totalColorBet);
      setItemBets({});
      setColorBets({ RED: 0, GREEN: 0, YELLOW: 0 });
      setMessage("ĐÃ HỦY LỆNH");
  };

  // --- GAMEPLAY ---
  const handleSpin = () => {
    const totalItemBet = Object.values(itemBets).reduce((a, b) => a + b, 0);
    const totalColorBet = Object.values(colorBets).reduce((a, b) => a + b, 0);
    
    if (totalItemBet + totalColorBet === 0) {
        setMessage("CHƯA CÓ LỆNH CƯỢC!");
        return;
    }
    if (isSpinning) return;

    initAudio();
    setIsSpinning(true);
    setLastWin(0);
    setMessage("ĐANG QUÉT MỤC TIÊU...");

    // RNG
    const resultIndex = Math.floor(Math.random() * 24); 
    const resultItem = PERIMETER_ITEMS[resultIndex];

    let currentStep = 0;
    const totalSteps = 48 + ((resultIndex - activeIndex + 24) % 24); 
    
    const runLight = () => {
        let delay = 50;
        if (currentStep < 10) delay = 100 - (currentStep * 5);
        else if (currentStep > totalSteps - 20) delay = 50 + ((currentStep - (totalSteps - 20)) * 20);

        if (currentStep >= totalSteps) {
            setIsSpinning(false);
            setActiveIndex(resultIndex);
            calculateWin(resultItem);
            return;
        }

        setActiveIndex(prev => (prev + 1) % 24);
        playSound('tick');
        currentStep++;
        setTimeout(runLight, delay);
    };

    runLight();
  };

  const calculateWin = (resultItem) => {
      let totalWin = 0;

      // 1. Thắng Vật Phẩm
      const itemBet = itemBets[resultItem.id] || 0;
      if (itemBet > 0) {
          totalWin += itemBet * resultItem.odds;
      }

      // 2. Thắng Màu (Tỉ lệ x2 cho Đỏ/Xanh/Vàng nếu trúng)
      // Rank (Blue) không ăn màu nào
      if (resultItem.group !== 'BLUE') {
          const colorBet = colorBets[resultItem.group] || 0;
          if (colorBet > 0) {
              totalWin += colorBet * 2; // Tỉ lệ x2 cho màu
          }
      }

      if (totalWin > 0) {
          setLastWin(totalWin);
          setCredits(prev => prev + totalWin);
          setMessage(`MỤC TIÊU BỊ HẠ! +${totalWin.toLocaleString()}`);
          playSound('win');
      } else {
          setMessage("TRƯỢT MỤC TIÊU");
      }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#020617] text-[#e2e8f0] font-mono p-2 select-none overflow-hidden">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Share+Tech+Mono&display=swap');
        body { font-family: 'Share Tech Mono', monospace; }
        .led-active { 
            box-shadow: 0 0 20px 2px #fff, inset 0 0 10px #fff; 
            z-index: 10; 
            transform: scale(1.15); 
            border-color: #fff !important; 
            background-color: #fff !important;
        }
        .led-active svg { filter: none !important; }
        
        .scanline {
            background: linear-gradient(0deg, rgba(0,0,0,0) 0%, rgba(16, 185, 129, 0.1) 50%, rgba(0,0,0,0) 100%);
            animation: scanline 8s linear infinite;
            pointer-events: none;
        }
        @keyframes scanline { 0% { bottom: 100%; } 100% { bottom: -100px; } }
      `}</style>

      {/* Background Decor */}
      <div className="absolute inset-0 z-0 grid-bg opacity-20 pointer-events-none" style={{backgroundImage: 'radial-gradient(#1e293b 1px, transparent 1px)', backgroundSize: '30px 30px'}}></div>
      <div className="absolute inset-0 z-10 scanline w-full h-[100px] bottom-full opacity-10"></div>

      {/* --- HEADER HUD --- */}
      <div className="w-full max-w-2xl flex justify-between items-center mb-2 bg-[#0f172a] p-3 rounded-t-lg border-b-2 border-emerald-500 z-20 shadow-lg">
          <div className="flex flex-col">
              <span className="text-[10px] text-emerald-500">MISSION REWARD</span>
              <span className="text-2xl font-bold text-emerald-400">{lastWin.toLocaleString()} $</span>
          </div>
          <div className="flex flex-col items-center">
              <h1 className="text-xl font-bold text-white tracking-widest flex items-center gap-2"><Crosshair size={20}/> TACTICAL OPS</h1>
              <span className="text-[10px] text-slate-500">SYSTEM ONLINE</span>
          </div>
          <div className="flex flex-col items-end">
              <span className="text-[10px] text-emerald-500">BUDGET</span>
              <span className="text-2xl font-bold text-white">{credits.toLocaleString()} $</span>
          </div>
      </div>

      {/* --- MAIN BOARD --- */}
      <div className="relative w-full max-w-2xl aspect-square bg-[#020617] p-2 rounded-xl border border-slate-700 shadow-2xl z-20">
          <div className="absolute inset-0 border-[4px] border-slate-800 rounded-xl pointer-events-none"></div>
          
          <div className="grid grid-cols-7 grid-rows-7 gap-1 w-full h-full p-2">
              {Array.from({length: 24}).map((_, i) => {
                  const pos = getGridPosition(i);
                  const item = PERIMETER_ITEMS[i];
                  const isActive = i === activeIndex;
                  const Icon = item.icon;
                  const groupColor = COLORS[item.group]?.hex || '#fff';

                  return (
                      <div 
                        key={i}
                        className={`
                            relative flex items-center justify-center rounded border transition-all duration-75 overflow-hidden
                            ${isActive ? 'led-active' : 'bg-[#0f172a] border-slate-700'}
                        `}
                        style={{ gridRow: pos.row, gridColumn: pos.col }}
                      >
                          <div className={`w-[70%] h-[70%] transition-all ${isActive ? 'scale-110' : 'grayscale opacity-60'}`}>
                              <Icon />
                          </div>
                          {/* Color Indicator */}
                          <div className="absolute bottom-0 left-0 right-0 h-[2px]" style={{backgroundColor: groupColor}}></div>
                      </div>
                  );
              })}

              {/* CENTER DISPLAY */}
              <div className="col-start-2 col-end-7 row-start-2 row-end-7 m-1 rounded bg-[#0f172a] border border-slate-700 flex flex-col items-center justify-center relative overflow-hidden">
                  {/* Radar Scan Effect */}
                  <div className="absolute inset-0 rounded-full border border-emerald-900/30 opacity-20 animate-ping" style={{width: '200%', height: '200%', left: '-50%', top: '-50%'}}></div>
                  <div className="absolute w-full h-[1px] bg-emerald-500/20 top-1/2 animate-pulse"></div>
                  <div className="absolute h-full w-[1px] bg-emerald-500/20 left-1/2 animate-pulse"></div>

                  <div className="w-32 h-32 mb-4 drop-shadow-[0_0_15px_rgba(16,185,129,0.5)] transition-all duration-300 transform scale-110">
                      {(() => {
                          const CurrentIcon = PERIMETER_ITEMS[activeIndex].icon;
                          return <CurrentIcon />;
                      })()}
                  </div>

                  <div className="bg-black/80 px-4 py-1 rounded border border-emerald-900 mb-2">
                      <span className={`text-sm font-bold tracking-widest ${lastWin > 0 ? 'text-emerald-400' : 'text-slate-400'}`}>
                          {message}
                      </span>
                  </div>
              </div>
          </div>
      </div>

      {/* --- BETTING CONTROLS --- */}
      <div className="w-full max-w-2xl mt-2 grid grid-cols-4 md:grid-cols-8 gap-1 p-2 bg-[#0f172a] rounded-b-lg border-t border-slate-700 z-20">
          {ITEMS.map((item) => {
              const Icon = item.icon;
              const betVal = itemBets[item.id] || 0;
              const itemColor = COLORS[item.group]?.hex || '#94a3b8';
              
              return (
                  <button
                    key={item.id}
                    onClick={() => handleItemBet(item.id)}
                    disabled={isSpinning}
                    className="relative flex flex-col items-center justify-center bg-[#1e293b] hover:bg-[#334155] active:bg-[#475569] border border-slate-700 rounded p-1 h-16 transition-all group"
                    style={{borderColor: betVal > 0 ? itemColor : ''}}
                  >
                      <span className="absolute top-0 right-1 text-[8px] text-slate-400">x{item.odds}</span>
                      <div className="w-6 h-6 mb-1 opacity-80 group-hover:scale-110 transition-transform"><Icon /></div>
                      <span className={`text-[10px] font-bold ${betVal > 0 ? 'text-white' : 'text-slate-500'}`}>{betVal > 0 ? betVal : item.label}</span>
                  </button>
              )
          })}
      </div>

      {/* --- COLOR BETS & ACTIONS --- */}
      <div className="w-full max-w-2xl mt-2 flex flex-wrap gap-2 z-20">
          {/* Color Bets */}
          <div className="flex flex-1 gap-1">
              <button 
                onClick={() => handleColorBet('RED')} disabled={isSpinning}
                className="flex-1 bg-[#450a0a] border border-red-800 hover:bg-red-900 active:bg-red-800 text-red-400 font-bold py-3 rounded flex flex-col items-center justify-center relative overflow-hidden"
              >
                  <div className="flex items-center gap-1"><Flame size={12}/> RED</div>
                  {colorBets.RED > 0 && <span className="text-white text-xs">{colorBets.RED}</span>}
                  <span className="text-[8px] opacity-60">x2</span>
              </button>
              <button 
                onClick={() => handleColorBet('GREEN')} disabled={isSpinning}
                className="flex-1 bg-[#052e16] border border-green-800 hover:bg-green-900 active:bg-green-800 text-green-400 font-bold py-3 rounded flex flex-col items-center justify-center relative overflow-hidden"
              >
                  <div className="flex items-center gap-1"><Radio size={12}/> GREEN</div>
                  {colorBets.GREEN > 0 && <span className="text-white text-xs">{colorBets.GREEN}</span>}
                  <span className="text-[8px] opacity-60">x2</span>
              </button>
              <button 
                onClick={() => handleColorBet('YELLOW')} disabled={isSpinning}
                className="flex-1 bg-[#422006] border border-yellow-800 hover:bg-yellow-900 active:bg-yellow-800 text-yellow-400 font-bold py-3 rounded flex flex-col items-center justify-center relative overflow-hidden"
              >
                  <div className="flex items-center gap-1"><Shield size={12}/> YELLOW</div>
                  {colorBets.YELLOW > 0 && <span className="text-white text-xs">{colorBets.YELLOW}</span>}
                  <span className="text-[8px] opacity-60">x2</span>
              </button>
          </div>

          {/* System Actions */}
          <div className="flex gap-1">
              <button 
                onClick={handleReset} disabled={isSpinning}
                className="w-14 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded flex items-center justify-center"
              >
                  <RefreshCw size={18} />
              </button>
              <button 
                onClick={handleSpin} disabled={isSpinning}
                className="w-24 bg-emerald-600 hover:bg-emerald-500 text-black font-bold rounded shadow-[0_0_15px_rgba(16,185,129,0.4)] flex items-center justify-center gap-1"
              >
                  <Zap size={18} fill="currentColor"/> START
              </button>
              <button 
                onClick={() => setIsMuted(!isMuted)}
                className="w-12 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded flex items-center justify-center"
              >
                  {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
              </button>
          </div>
      </div>
    </div>
  );
}