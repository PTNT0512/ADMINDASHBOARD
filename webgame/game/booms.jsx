import React, { useState, useEffect, useRef } from 'react';
import { Minus, Plus, Info, Bomb, Volume2, VolumeX, ChevronLeft, Target, Shield, Crosshair, Cpu, Medal } from 'lucide-react';

// --- CẤU HÌNH ẢNH CỦA BẠN ---
const USER_IMAGES = {
  blueGem: "https://i.imgur.com/ZivVeVB.png", 
  greenGem: "https://i.imgur.com/2UmKKYU.png"
};

// --- MÌN QUÂN SỰ (VẼ BẰNG SVG) ---
const TacticalMine = () => (
  <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-[0_0_15px_rgba(239,68,68,0.8)]">
    <defs>
      <radialGradient id="mineBody" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor="#450a0a" />
        <stop offset="80%" stopColor="#1f1f1f" />
        <stop offset="100%" stopColor="#000000" />
      </radialGradient>
    </defs>
    <circle cx="50" cy="50" r="35" fill="url(#mineBody)" stroke="#ef4444" strokeWidth="1" />
    <circle cx="50" cy="50" r="25" fill="none" stroke="#7f1d1d" strokeWidth="2" strokeDasharray="5 5" />
    <circle cx="50" cy="50" r="8" fill="#ef4444" className="animate-ping" style={{animationDuration: '1s'}} />
    <circle cx="50" cy="50" r="5" fill="#fecaca" />
    <path d="M50,15 L50,10 M85,50 L90,50 M50,85 L50,90 M15,50 L10,50 M25,25 L20,20 M75,75 L80,80 M25,75 L20,80 M75,25 L80,20" stroke="#555" strokeWidth="3" strokeLinecap="round" />
  </svg>
);

// --- Ô CHƯA MỞ (TACTICAL COVER) ---
const TacticalCover = ({ isActive }) => (
  <div className="absolute inset-0 w-full h-full flex items-center justify-center overflow-hidden">
      {/* Background Texture */}
      <div className="absolute inset-0 opacity-10 bg-[linear-gradient(45deg,transparent_25%,#000_25%,#000_50%,transparent_50%,transparent_75%,#000_75%,#000_100%)] bg-[length:8px_8px]"></div>
      
      {/* Tech Corners */}
      <div className={`absolute top-1 left-1 w-2 h-2 border-t-2 border-l-2 transition-colors duration-300 ${isActive ? 'border-emerald-500/80' : 'border-slate-500/30'}`}></div>
      <div className={`absolute top-1 right-1 w-2 h-2 border-t-2 border-r-2 transition-colors duration-300 ${isActive ? 'border-emerald-500/80' : 'border-slate-500/30'}`}></div>
      <div className={`absolute bottom-1 left-1 w-2 h-2 border-b-2 border-l-2 transition-colors duration-300 ${isActive ? 'border-emerald-500/80' : 'border-slate-500/30'}`}></div>
      <div className={`absolute bottom-1 right-1 w-2 h-2 border-b-2 border-r-2 transition-colors duration-300 ${isActive ? 'border-emerald-500/80' : 'border-slate-500/30'}`}></div>

      {/* Center Icon */}
      <div className={`transition-all duration-300 ${isActive ? 'text-emerald-500/50 scale-110' : 'text-slate-600/30 scale-100'}`}>
          <Crosshair size="40%" strokeWidth={2} />
      </div>
  </div>
);

// --- ÂM THANH ---
const SFX = {
  click: 'https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3',
  gem:   'https://assets.mixkit.co/active_storage/sfx/2000/2000-preview.mp3',
  rare:  'https://assets.mixkit.co/active_storage/sfx/1435/1435-preview.mp3', 
  bomb:  'https://assets.mixkit.co/active_storage/sfx/2003/2003-preview.mp3',
  win:   'https://assets.mixkit.co/active_storage/sfx/2019/2019-preview.mp3',
};

const TurboMinesTactical = () => {
  // --- STATE ---
  const [balance, setBalance] = useState(25000.00);
  const [betAmount, setBetAmount] = useState(10);
  const [mineCount, setMineCount] = useState(3);
  const [gridSize, setGridSize] = useState(5);
  const [turboMode, setTurboMode] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  // Game State
  const [gameState, setGameState] = useState('IDLE'); 
  const [grid, setGrid] = useState([]); 
  const [currentMultiplier, setCurrentMultiplier] = useState(1.0);
  const [currentWin, setCurrentWin] = useState(0);
  const [shake, setShake] = useState(false); 

  const playSound = (type) => {
    if (isMuted) return;
    const audio = new Audio(SFX[type]);
    audio.volume = 0.5;
    audio.play().catch(() => {});
  };

  useEffect(() => {
    if (gameState === 'IDLE') {
        const totalCells = gridSize * gridSize;
        setGrid(Array(totalCells).fill({ type: 'empty', revealed: false }));
    }
  }, [gridSize, gameState]);

  // --- LOGIC TÍNH THƯỞNG MỚI (ĐỘ KHÓ CAO = NHÂN NHIỀU) ---
  const calculateWin = (currentMult, isRare) => {
      // Hệ số tăng trưởng dựa trên số lượng mìn (mineCount)
      // Mìn càng nhiều, baseIncrease càng lớn -> Multiplier nhảy vọt nhanh hơn
      // Ví dụ: 3 mìn -> tăng ~15%/bước. 10 mìn -> tăng ~60%/bước.
      const difficultyFactor = 1.10 + (mineCount * 0.05); 
      
      // Bonus Lục Bảo cũng nhân theo độ khó
      const rareBonus = isRare ? (0.5 * (1 + mineCount * 0.2)) : 0; 
      
      const nextMult = (currentMult * difficultyFactor) + rareBonus;
      return parseFloat(nextMult.toFixed(2));
  };

  const handleReset = () => {
      setGameState('IDLE');
      setCurrentMultiplier(1.0);
      setCurrentWin(0);
      const totalCells = gridSize * gridSize;
      setGrid(Array(totalCells).fill({ type: 'empty', revealed: false }));
  };

  const handleStart = () => {
    if (balance < betAmount) {
        alert("THIẾU NGÂN SÁCH CHIẾN DỊCH!");
        return;
    }

    playSound('click');
    setBalance(prev => prev - betAmount);
    setGameState('PLAYING');
    setCurrentMultiplier(1.0);
    setCurrentWin(betAmount);

    const totalCells = gridSize * gridSize;
    const newGrid = Array(totalCells).fill(null).map((_, i) => ({ 
        id: i, 
        type: 'blue', 
        revealed: false 
    }));

    const indices = Array.from({ length: totalCells }, (_, i) => i);
    for (let i = indices.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [indices[i], indices[j]] = [indices[j], indices[i]];
    }

    // 1. Đặt Mìn
    for (let i = 0; i < mineCount; i++) {
        newGrid[indices[i]].type = 'mine';
    }

    // 2. Đặt Lục Bảo (Rare)
    const safeIndices = indices.slice(mineCount);
    const rareCount = Math.floor(safeIndices.length * 0.2); 
    
    for (let i = 0; i < rareCount; i++) {
        newGrid[safeIndices[i]].type = 'green';
    }

    setGrid(newGrid);
  };

  const handleTileClick = (index) => {
    if (gameState !== 'PLAYING' || grid[index].revealed) return;

    const newGrid = [...grid];
    const cell = newGrid[index];
    cell.revealed = true;

    if (cell.type === 'mine') {
        playSound('bomb');
        setShake(true); 
        setTimeout(() => setShake(false), 500);
        setGameState('GAMEOVER');
        setGrid(newGrid);
    } else {
        const isRare = cell.type === 'green';
        playSound(isRare ? 'rare' : 'gem');
        setGrid(newGrid);
        
        const nextMult = calculateWin(currentMultiplier, isRare);
        const nextWin = betAmount * nextMult;
        
        setCurrentMultiplier(nextMult);
        setCurrentWin(nextWin);

        const remainingSafe = newGrid.filter(c => c.type !== 'mine' && !c.revealed).length;
        if (remainingSafe === 0) {
            handleCashout(nextWin);
        }
    }
  };

  const handleCashout = (finalWin = currentWin) => {
      playSound('win');
      setBalance(prev => prev + finalWin);
      setGameState('VICTORY');
      setGrid(prev => prev.map(c => ({...c, revealed: true})));
  };

  const getCellContent = (cell) => {
      // 1. Chưa mở
      if (!cell.revealed) {
          if ((gameState === 'GAMEOVER' || gameState === 'VICTORY') && cell.type === 'mine') {
              return <Bomb size={gridSize > 5 ? 16 : 24} className="text-red-900/50 fill-black opacity-50" />;
          }
          if (gameState !== 'IDLE' && gameState !== 'PLAYING' && cell.type !== 'mine') {
               return <div className={`w-1.5 h-1.5 rounded-full ${cell.type === 'green' ? 'bg-emerald-500/20' : 'bg-blue-500/20'}`}></div>
          }
          return <TacticalCover isActive={gameState === 'PLAYING'} />;
      }

      // 2. Mở trúng Mìn
      if (cell.type === 'mine') {
          return (
            <div className="relative w-[80%] h-[80%] animate-bounce">
                <TacticalMine />
            </div>
          );
      }
      
      // 3. Mở trúng Lục Bảo (Ảnh)
      if (cell.type === 'green') {
          return (
            <div className="relative animate-pulse w-[80%] h-[80%] flex items-center justify-center">
                <div className="absolute inset-0 bg-emerald-500/30 blur-xl rounded-full"></div>
                <img 
                    src={USER_IMAGES.greenGem} 
                    alt="Green Gem"
                    className="relative z-10 w-full h-full object-contain drop-shadow-[0_0_15px_rgba(16,185,129,0.8)] transition-transform duration-300 transform scale-110"
                />
            </div>
          );
      }

      // 4. Mở trúng Kim Cương Xanh (Ảnh)
      return (
        <div className="relative animate-in zoom-in duration-300 w-[70%] h-[70%] flex items-center justify-center">
            <div className="absolute inset-0 bg-blue-500/20 blur-lg rounded-full"></div>
            <img 
                src={USER_IMAGES.blueGem} 
                alt="Blue Gem"
                className="relative z-10 w-full h-full object-contain drop-shadow-[0_0_10px_rgba(59,130,246,0.8)]"
            />
        </div>
      );
  };

  return (
    <div className={`min-h-screen bg-[#0b1120] text-emerald-100 font-mono flex flex-col items-center justify-center p-0 md:p-4 overflow-hidden select-none relative ${shake ? 'animate-shake' : ''}`}>
      <style>{`
        @keyframes scan { 0% { background-position: 0% 0%; } 100% { background-position: 0% 100%; } }
        .scanlines { background: linear-gradient(to bottom, rgba(16,185,129,0), rgba(16,185,129,0) 50%, rgba(0,0,0,0.2) 50%, rgba(0,0,0,0.2)); background-size: 100% 4px; }
        @keyframes shake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-5px); } 75% { transform: translateX(5px); } }
        .animate-shake { animation: shake 0.2s ease-in-out infinite; }
      `}</style>

      {/* --- BACKGROUND EFFECTS --- */}
      <div className="absolute inset-0 pointer-events-none opacity-20 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:20px_20px]"></div>
      <div className="absolute inset-0 pointer-events-none scanlines opacity-30 z-0"></div>

      {/* --- MOBILE HEADER --- */}
      <div className="w-full flex justify-between items-center p-3 bg-[#0f172a]/90 backdrop-blur-md border-b border-emerald-900/50 sticky top-0 z-50 md:hidden shadow-lg">
          <div className="flex items-center gap-2">
              <ChevronLeft size={20} className="text-emerald-500" />
              <div className="text-xs font-bold text-emerald-500 tracking-widest flex items-center gap-1">
                  <Target size={14}/> TAC-MINES
              </div>
          </div>
          <div className="flex items-center gap-3">
              <div className="text-right">
                  <div className="text-[9px] text-slate-500 uppercase">Balance</div>
                  <div className="text-sm font-bold text-emerald-400 font-mono">${balance.toLocaleString()}</div>
              </div>
              <button onClick={() => setIsMuted(!isMuted)} className="text-slate-500">
                  {isMuted ? <VolumeX size={18}/> : <Volume2 size={18}/>}
              </button>
          </div>
      </div>

      {/* --- DESKTOP HEADER --- */}
      <div className="hidden md:flex w-full max-w-[1000px] justify-between items-center mb-6 z-10 px-4">
        <div className="flex items-center gap-3">
            <div className="p-2 border border-emerald-800 rounded bg-[#0f172a] text-emerald-500 hover:bg-emerald-900/30 cursor-pointer transition-colors">
                <ChevronLeft size={20}/>
            </div>
            <h1 className="text-2xl font-black italic tracking-tighter text-white flex items-center gap-2">
                <Crosshair className="text-emerald-500" /> TURBO <span className="text-emerald-500">MINES</span>
            </h1>
        </div>
        <div className="flex items-center gap-4">
            <div className="bg-[#0f172a] px-5 py-2 rounded border border-emerald-900/50 flex items-center gap-3 shadow-[0_0_15px_rgba(16,185,129,0.1)]">
                <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981] animate-pulse"></div>
                <div>
                    <div className="text-[10px] text-slate-500 uppercase leading-none">Credit Balance</div>
                    <div className="text-xl font-bold text-white font-mono leading-none mt-1">${balance.toLocaleString()}</div>
                </div>
            </div>
            <button onClick={() => setIsMuted(!isMuted)} className={`p-3 rounded border border-emerald-900/50 transition-colors ${isMuted ? 'bg-red-900/20 text-red-500' : 'bg-[#0f172a] text-emerald-500 hover:bg-emerald-900/20'}`}>
                {isMuted ? <VolumeX size={20}/> : <Volume2 size={20}/>}
            </button>
        </div>
      </div>

      {/* === MAIN LAYOUT === */}
      <div className="flex flex-col md:flex-row gap-4 w-full max-w-[1000px] h-full md:h-[600px] relative z-10 p-2 md:p-0">
        
        {/* --- LEFT: CONTROLS --- */}
        <div className="order-2 md:order-1 w-full md:w-[320px] bg-[#0f172a]/90 backdrop-blur-md rounded-xl border border-emerald-900/50 shadow-2xl flex flex-col overflow-hidden">
          <div className="h-1 w-full bg-gradient-to-r from-emerald-900 via-emerald-500 to-emerald-900 opacity-50"></div>

          <div className="p-4 md:p-6 flex flex-col h-full gap-4">
            
            {/* Input Group: Mines */}
            <div>
                <div className="flex justify-between text-[10px] font-bold text-slate-400 mb-1 uppercase tracking-wider">
                    <span>Threat Level (Mines)</span>
                    <span className="text-emerald-400">{mineCount}</span>
                </div>
                <div className="bg-[#0b1120] p-1 rounded border border-emerald-900/30 flex items-center justify-between">
                   <button 
                        onClick={() => gameState === 'IDLE' && setMineCount(Math.max(1, mineCount-1))}
                        disabled={gameState !== 'IDLE'}
                        className="w-10 h-10 flex items-center justify-center bg-[#1e293b] text-emerald-500 hover:bg-emerald-900/30 rounded transition disabled:opacity-30 disabled:cursor-not-allowed"
                   >
                       <Minus size={16} strokeWidth={3} />
                   </button>
                   
                   <div className="flex gap-1">
                       {Array(5).fill(0).map((_, i) => (
                           <div key={i} className={`w-2 h-2 rounded-full ${i < (mineCount % 5) || mineCount >= 5 ? 'bg-red-500 shadow-[0_0_5px_#ef4444]' : 'bg-slate-800'}`}></div>
                       ))}
                   </div>

                   <button 
                        onClick={() => gameState === 'IDLE' && setMineCount(Math.min(24, mineCount+1))}
                        disabled={gameState !== 'IDLE'}
                        className="w-10 h-10 flex items-center justify-center bg-[#1e293b] text-emerald-500 hover:bg-emerald-900/30 rounded transition disabled:opacity-30 disabled:cursor-not-allowed"
                   >
                       <Plus size={16} strokeWidth={3} />
                   </button>
                </div>
            </div>

            {/* Input Group: Bet Amount */}
            <div>
                <div className="flex justify-between text-[10px] font-bold text-slate-400 mb-1 uppercase tracking-wider">
                    <span>Wager (Bet)</span>
                    <span className="text-emerald-400 flex items-center gap-1"><Cpu size={10}/> SYSTEM READY</span>
                </div>
                <div className="bg-[#0b1120] p-2 rounded border border-emerald-900/30">
                   <div className="flex items-center gap-2 mb-2 border-b border-slate-800 pb-1">
                        <span className="text-emerald-600 text-lg font-mono">$</span>
                        <input 
                            type="number" 
                            value={betAmount} 
                            onChange={(e) => setBetAmount(Number(e.target.value))}
                            disabled={gameState !== 'IDLE'}
                            className="bg-transparent text-white font-mono font-bold text-xl w-full focus:outline-none"
                        />
                   </div>
                   <div className="grid grid-cols-4 gap-1">
                      {['MIN', '1/2', 'x2', 'MAX'].map((txt) => (
                        <button 
                            key={txt} 
                            onClick={() => {
                                if (gameState !== 'IDLE') return;
                                if (txt === 'MIN') setBetAmount(1);
                                if (txt === '1/2') setBetAmount(Math.max(1, betAmount/2));
                                if (txt === 'x2') setBetAmount(betAmount*2);
                                if (txt === 'MAX') setBetAmount(balance);
                            }}
                            disabled={gameState !== 'IDLE'}
                            className="bg-[#1e293b] hover:bg-emerald-900/20 h-8 rounded text-[9px] font-bold text-slate-400 hover:text-emerald-400 uppercase transition border border-slate-700 disabled:opacity-30"
                        >
                            {txt}
                        </button>
                      ))}
                   </div>
                </div>
            </div>

            {/* Stats Panel */}
            <div className={`transition-all duration-300 overflow-hidden ${gameState === 'PLAYING' ? 'max-h-24 opacity-100' : 'max-h-0 opacity-0'}`}>
                <div className="bg-emerald-900/10 border border-emerald-500/30 rounded p-3 flex justify-between items-center">
                    <div>
                        <div className="text-[9px] text-emerald-400 uppercase tracking-widest">Potential Win</div>
                        <div className="text-xl font-bold text-white font-mono">${currentWin.toFixed(2)}</div>
                    </div>
                    <div className="text-right">
                        <div className="text-[9px] text-emerald-400 uppercase tracking-widest">Mult</div>
                        <div className="text-xl font-bold text-emerald-300 font-mono">x{currentMultiplier}</div>
                    </div>
                </div>
            </div>

            {/* ACTION BUTTON */}
            <div className="mt-auto">
                <button
                    onClick={gameState === 'PLAYING' ? () => handleCashout() : handleStart}
                    disabled={gameState === 'GAMEOVER' || gameState === 'VICTORY'}
                    className={`
                        relative w-full h-16 rounded overflow-hidden group transition-all
                        ${gameState === 'PLAYING' 
                            ? 'bg-gradient-to-r from-emerald-600 to-green-500 hover:brightness-110' 
                            : 'bg-gradient-to-r from-orange-600 to-amber-500 hover:brightness-110'}
                        disabled:opacity-50 disabled:grayscale
                    `}
                >
                    <div className="absolute inset-0 opacity-20 bg-[linear-gradient(45deg,transparent_25%,#000_25%,#000_50%,transparent_50%,transparent_75%,#000_75%,#000_100%)] bg-[length:10px_10px]"></div>
                    
                    <div className="relative z-10 flex items-center justify-center gap-2 h-full">
                        {gameState === 'PLAYING' ? (
                            <>
                                <Shield className="w-5 h-5 text-emerald-900 fill-emerald-200" />
                                <div className="text-center leading-none">
                                    <span className="block text-[10px] font-black text-emerald-900 uppercase tracking-widest">SECURE DATA</span>
                                    <span className="block text-xl font-black text-white drop-shadow-md tracking-wide">CASHOUT</span>
                                </div>
                            </>
                        ) : (
                            <>
                                <Target className="w-6 h-6 text-orange-900" />
                                <span className="text-xl font-black text-white tracking-widest drop-shadow-md">
                                    ENGAGE
                                </span>
                            </>
                        )}
                    </div>
                    
                    <div className="absolute bottom-0 left-0 w-full h-1 bg-white/20"></div>
                </button>
            </div>

          </div>
        </div>

        {/* --- RIGHT: GRID --- */}
        <div className="order-1 md:order-2 flex-1 bg-[#0f172a]/80 backdrop-blur-sm rounded-xl p-1 relative flex items-center justify-center border border-emerald-900/30 shadow-2xl">
            <div className="absolute inset-0 rounded-xl border-2 border-dashed border-emerald-900/20 pointer-events-none"></div>
            <div className="absolute top-2 left-2 text-[8px] text-emerald-900 font-mono hidden md:block">SEC-09</div>
            <div className="absolute bottom-2 right-2 text-[8px] text-emerald-900 font-mono hidden md:block">GRID-X5</div>

            <div className="w-full max-w-[500px] aspect-square p-2 md:p-6 relative">
                <div 
                    className="w-full h-full grid gap-1.5 md:gap-2 transition-all duration-300"
                    style={{ 
                        gridTemplateColumns: `repeat(${gridSize}, minmax(0, 1fr))`,
                        gridTemplateRows: `repeat(${gridSize}, minmax(0, 1fr))` 
                    }}
                >
                   {grid.map((cell, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleTileClick(idx)}
                        disabled={gameState !== 'PLAYING' || cell.revealed}
                        className={`
                            w-full h-full relative rounded md:rounded-lg transition-all duration-150 flex items-center justify-center overflow-hidden
                            ${!cell.revealed 
                                ? `bg-[#1e293b] border-b-4 border-[#0f1115] hover:-translate-y-0.5 active:border-b-0 active:translate-y-1` 
                                : `bg-[#0b1120] border border-[#1e293b] shadow-inner`
                            }
                            ${gameState === 'PLAYING' && !cell.revealed ? 'cursor-pointer hover:border-emerald-500/50 hover:bg-[#2a2d36]' : 'cursor-default'}
                            ${cell.revealed && cell.type === 'mine' ? 'bg-red-950/50 border-red-900' : ''}
                            ${cell.revealed && cell.type === 'green' ? 'bg-emerald-950/50 border-emerald-900' : ''}
                        `}
                      >
                          {getCellContent(cell)}
                      </button>
                   ))}
                </div>

                {/* OVERLAYS */}
                {gameState === 'GAMEOVER' && (
                    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center pointer-events-auto bg-black/90 backdrop-blur-md rounded-xl animate-in zoom-in duration-300 border-2 border-red-600 shadow-[0_0_50px_rgba(220,38,38,0.5)]">
                        <Bomb size={64} className="text-red-500 mb-2 drop-shadow-lg" />
                        <div className="text-3xl font-black text-red-500 tracking-widest mb-4">MISSION FAILED</div>
                        <button 
                            onClick={handleReset}
                            className="bg-red-600 hover:bg-red-500 text-white font-bold py-2 px-8 rounded-lg shadow-lg active:scale-95 transition-all"
                        >
                            OK
                        </button>
                    </div>
                )}
                {gameState === 'VICTORY' && (
                    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center pointer-events-auto bg-black/90 backdrop-blur-md rounded-xl animate-in zoom-in duration-300 border-2 border-emerald-500 shadow-[0_0_50px_rgba(16,185,129,0.5)]">
                        <Medal size={64} className="text-emerald-400 mb-2 animate-pulse drop-shadow-lg" />
                        <div className="text-3xl font-black text-emerald-400 tracking-widest mb-1">SUCCESS</div>
                        <div className="text-xl text-white font-mono bg-emerald-900/50 px-4 py-1 rounded mb-4">+${currentWin.toFixed(2)}</div>
                        <button 
                            onClick={handleReset}
                            className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2 px-8 rounded-lg shadow-lg active:scale-95 transition-all"
                        >
                            OK
                        </button>
                    </div>
                )}
            </div>
        </div>

      </div>
    </div>
  );
};
 
export default TurboMinesTactical;