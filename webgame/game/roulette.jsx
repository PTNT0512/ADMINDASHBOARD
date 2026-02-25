import React, { useState, useEffect, useRef } from 'react';
import { Trophy, Coins, RotateCcw, History, Play, Trash2, Info } from 'lucide-react';

const ROULETTE_NUMBERS = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26
];

const RED_NUMBERS = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];

const BOARD_LAYOUT = [
  [3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36],
  [2, 5, 8, 11, 14, 17, 20, 23, 26, 29, 32, 35],
  [1, 4, 7, 10, 13, 16, 19, 22, 25, 28, 31, 34]
];

const App = () => {
  const [balance, setBalance] = useState(5000);
  const [bets, setBets] = useState({});
  const [spinning, setSpinning] = useState(false);
  const [wheelRotation, setWheelRotation] = useState(0);
  const [ballRotation, setBallRotation] = useState(0);
  const [ballStage, setBallStage] = useState('idle'); // idle, entry, spinning, dropping, hitting, settled
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [message, setMessage] = useState("Chào Duog! Hãy đặt cược và thả bóng.");
  const [selectedChip, setSelectedChip] = useState(10);

  const chips = [10, 50, 100, 500, 1000];

  const getNumberColor = (num) => {
    if (num === 0) return 'bg-emerald-600';
    return RED_NUMBERS.includes(num) ? 'bg-red-700' : 'bg-neutral-900';
  };

  const placeBet = (type) => {
    if (spinning) return;
    if (balance < selectedChip) {
      setMessage("Duog ơi, không đủ tiền cược rồi!");
      return;
    }
    setBets(prev => ({ ...prev, [type]: (prev[type] || 0) + selectedChip }));
    setBalance(prev => prev - selectedChip);
  };

  const clearBets = () => {
    if (spinning) return;
    const totalBet = Object.values(bets).reduce((a, b) => a + b, 0);
    setBalance(prev => prev + totalBet);
    setBets({});
  };

  const spinWheel = () => {
    if (spinning || Object.keys(bets).length === 0) return;

    setSpinning(true);
    setResult(null);
    setBallStage('entry'); // Giai đoạn bóng từ ngoài vào
    setMessage("Bàn quay đang khởi động...");

    const winIdx = Math.floor(Math.random() * 37);
    const winNumber = ROULETTE_NUMBERS[winIdx];
    const anglePerNumber = 360 / 37;
    
    // Vòng xoay bàn quay
    const extraWheelSpins = 4 + Math.random() * 2;
    const newWheelRotation = wheelRotation + (extraWheelSpins * 360) + (winIdx * anglePerNumber);
    
    // Vòng xoay bóng (ngược chiều)
    const centerOfPocketOffset = anglePerNumber / 2;
    const extraBallSpins = 12 + Math.random() * 3;
    const newBallRotation = ballRotation - (extraBallSpins * 360) + (winIdx * anglePerNumber) + centerOfPocketOffset;

    // Bắt đầu xoay bàn quay trước
    setWheelRotation(newWheelRotation);
    
    // Sau 500ms dealer mới thả bi vào
    setTimeout(() => {
      setBallStage('spinning');
      setBallRotation(newBallRotation);
      setMessage("Bóng đã được thả vào rãnh!");
    }, 500);

    // Timeline logic
    setTimeout(() => setBallStage('dropping'), 2500);
    setTimeout(() => setBallStage('hitting'), 4200);

    setTimeout(() => {
      setBallStage('settled');
      setResult(winNumber);
      processWinnings(winNumber);
      setSpinning(false);
      setHistory(prev => [winNumber, ...prev].slice(0, 12));
    }, 5600);
  };

  const processWinnings = (winNum) => {
    let totalWin = 0;
    const winColor = winNum === 0 ? 'green' : (RED_NUMBERS.includes(winNum) ? 'red' : 'black');

    Object.entries(bets).forEach(([type, amount]) => {
      if (parseInt(type) === winNum) totalWin += amount * 36;
      if (type === 'red' && winColor === 'red') totalWin += amount * 2;
      if (type === 'black' && winColor === 'black') totalWin += amount * 2;
      if (type === 'even' && winNum !== 0 && winNum % 2 === 0) totalWin += amount * 2;
      if (type === 'odd' && winNum !== 0 && winNum % 2 !== 0) totalWin += amount * 2;
      if (type === '1st12' && winNum >= 1 && winNum <= 12) totalWin += amount * 3;
      if (type === '2nd12' && winNum >= 13 && winNum <= 24) totalWin += amount * 3;
      if (type === '3rd12' && winNum >= 25 && winNum <= 36) totalWin += amount * 3;
    });

    if (totalWin > 0) {
      setBalance(prev => prev + totalWin);
      setMessage(`Ô ${winNum}. THẮNG! Duog nhận được $${totalWin.toLocaleString()}`);
    } else {
      setMessage(`Ô ${winNum}. Rất tiếc cho Duog!`);
    }
    setBets({});
  };

  return (
    <div className="min-h-screen bg-[#051005] text-white p-4 font-sans select-none overflow-x-hidden">
      {/* Header UI */}
      <div className="max-w-6xl mx-auto flex justify-between items-center mb-6 bg-black/60 p-4 rounded-2xl border border-emerald-500/20 backdrop-blur-xl shadow-2xl">
        <div className="flex items-center gap-6">
          <div className="flex flex-col">
            <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-widest">Tiền mặt</span>
            <span className="text-2xl font-black text-yellow-500 flex items-center gap-2">
              <Coins className="text-yellow-400" /> ${balance.toLocaleString()}
            </span>
          </div>
          <div className="h-10 w-px bg-white/10"></div>
          <div className="hidden lg:block">
            <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-widest">Trạng thái</span>
            <p className="text-sm font-semibold text-emerald-50 italic">{message}</p>
          </div>
        </div>
        <div className="flex flex-col items-end">
          <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-widest mb-1">Gần đây</span>
          <div className="flex gap-1">
            {history.map((h, i) => (
              <div key={i} className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black border border-white/10 ${getNumberColor(h)} shadow-lg`}>
                {h}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto grid grid-cols-1 xl:grid-cols-5 gap-10 items-start">
        <div className="xl:col-span-2 flex flex-col items-center">
          <div className="relative w-80 h-80 md:w-[460px] md:h-[460px]">
             {/* Gờ ngoài bằng gỗ */}
             <div className="absolute inset-[-25px] rounded-full border-[22px] border-[#2d1b0e] shadow-[inset_0_0_60px_rgba(0,0,0,1),0_20px_40px_rgba(0,0,0,0.8)] bg-[#3a2617] z-0"></div>
             
             {/* Rãnh bóng chạy (Track) */}
             <div className="absolute inset-0 rounded-full bg-gradient-to-b from-[#0a0a0a] to-[#1a1a1a] z-10 shadow-[inset_0_0_40px_rgba(0,0,0,1)] border-[10px] border-neutral-900/50"></div>
             
             {/* Wheel Content */}
             <div className="absolute inset-[30px] z-20">
               <div 
                 className="w-full h-full rounded-full relative transition-transform duration-[5500ms] cubic-bezier(0.15, 0, 0.15, 1)"
                 style={{ transform: `rotate(${wheelRotation}deg)` }}
               >
                  <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-2xl overflow-visible">
                    {ROULETTE_NUMBERS.map((num, i) => {
                      const angle = (i / 37) * 360;
                      const color = num === 0 ? '#065f46' : (RED_NUMBERS.includes(num) ? '#991b1b' : '#111');
                      
                      return (
                        <g key={`num-${i}`} transform={`rotate(${-angle} 50 50)`}>
                          <path 
                            d="M 50 50 L 50 2 A 48 48 0 0 1 58.2 2.7 Z" 
                            fill={color} 
                            stroke="#222" 
                            strokeWidth="0.1"
                            transform="rotate(-4.86 50 50)"
                          />
                          <text 
                            x="50" y="8" 
                            fill="rgba(255,255,255,0.9)" 
                            fontSize="3.8" 
                            fontWeight="900" 
                            textAnchor="middle"
                          >
                            {num}
                          </text>
                        </g>
                      );
                    })}

                    <circle cx="50" cy="50" r="35" fill="#1a1a1a" stroke="#d4af37" strokeWidth="0.5" />
                    
                    {ROULETTE_NUMBERS.map((num, i) => {
                      const angle = (i / 37) * 360;
                      const color = num === 0 ? '#059669' : (RED_NUMBERS.includes(num) ? '#ef4444' : '#262626');
                      return (
                        <g key={`pocket-${i}`} transform={`rotate(${-angle} 50 50)`}>
                           <path 
                              d="M 50 50 L 50 15 A 35 35 0 0 1 55.9 15.5 Z" 
                              fill={color}
                              transform="rotate(-4.86 50 50)"
                           />
                           <g transform="rotate(-4.86 50 50)">
                              <rect x="49.5" y="15" width="1" height="20" fill="url(#goldGradient)" />
                              <circle cx="50" cy="35" r="1.2" fill="#d4af37" />
                           </g>
                        </g>
                      );
                    })}

                    <defs>
                      <linearGradient id="goldGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" style={{ stopColor: '#854d0e' }} />
                        <stop offset="50%" style={{ stopColor: '#facc15' }} />
                        <stop offset="100%" style={{ stopColor: '#854d0e' }} />
                      </linearGradient>
                    </defs>
                  </svg>
                  <div className="absolute inset-0 m-auto w-[40%] h-[40%] rounded-full border-[8px] border-[#24160c] shadow-[inset_0_0_20px_rgba(0,0,0,0.8)] bg-gradient-to-br from-[#1a0f0a] to-[#0a0502] pointer-events-none"></div>
               </div>
             </div>

             {/* Dynamic Ball Entry Physics */}
             <div 
                className={`absolute inset-0 z-40 pointer-events-none transition-transform duration-[5000ms] 
                  ${ballStage === 'spinning' ? 'ease-out' : 'cubic-bezier(0.1, 0.5, 0.2, 1)'}`}
                style={{ 
                  transform: `rotate(${ballRotation}deg)`,
                  opacity: ballStage === 'idle' ? 0 : 1 
                }}
             >
                <div 
                  className={`absolute left-1/2 -translate-x-1/2 rounded-full bg-white shadow-[0_0_15px_white,inset_-1px_-1px_4px_rgba(0,0,0,0.4)] transition-all duration-[1500ms]`}
                  style={{ 
                    width: '14px', 
                    height: '14px',
                    top: ballStage === 'entry' ? '-15%' : // Bóng bắt đầu từ ngoài bàn quay
                         ballStage === 'spinning' ? '1%' : // Vào rãnh chạy ngoài
                         ballStage === 'dropping' ? '18%' : // Bắt đầu rơi vào trong
                         ballStage === 'hitting' ? '24%' : '29.5%', // Dừng lại ở hốc số
                    animation: ballStage === 'hitting' ? 'ball-bounce-pocket 0.6s ease-in-out' : 'none'
                  }}
                ></div>
             </div>

             <div className="absolute inset-0 m-auto w-24 h-24 z-50 flex items-center justify-center pointer-events-none">
                <div className="w-full h-full bg-gradient-to-br from-yellow-100 via-yellow-500 to-yellow-900 rounded-full border-4 border-[#854d0e] shadow-2xl flex items-center justify-center">
                   <div className="w-14 h-14 bg-neutral-900 rounded-full flex items-center justify-center border-2 border-yellow-400/50 shadow-[inset_0_0_15px_rgba(0,0,0,1)]">
                     <span className={`text-3xl font-black ${result !== null ? (result === 0 ? 'text-emerald-400' : (RED_NUMBERS.includes(result) ? 'text-red-500' : 'text-white')) : 'text-neutral-800'}`}>
                        {result !== null ? result : '?'}
                     </span>
                   </div>
                </div>
             </div>
          </div>

          <div className="mt-16 flex flex-col gap-4 w-full max-w-sm">
            <button 
              onClick={spinWheel}
              disabled={spinning || Object.keys(bets).length === 0}
              className={`w-full py-6 rounded-2xl font-black text-2xl tracking-[0.2em] shadow-2xl transition-all transform active:scale-95 border-b-8 ${
                spinning || Object.keys(bets).length === 0 
                ? 'bg-neutral-800 text-neutral-600 border-neutral-900 cursor-not-allowed' 
                : 'bg-gradient-to-b from-yellow-400 to-yellow-600 text-neutral-900 border-yellow-800 hover:brightness-110 hover:-translate-y-1'
              }`}
            >
              {spinning ? 'BÓNG ĐANG LĂN...' : 'THẢ BÓNG NGAY'}
            </button>
            <button 
              onClick={clearBets} 
              className="py-3 bg-red-900/10 hover:bg-red-900/30 rounded-xl text-[10px] font-black border border-red-500/20 text-red-500/60 uppercase tracking-widest transition-all"
            >
              Xóa cược
            </button>
          </div>
        </div>

        <div className="xl:col-span-3">
          <div className="bg-[#0b380b] p-6 rounded-3xl border-[12px] border-[#2d1b0e] shadow-[0_30px_60px_rgba(0,0,0,0.6)] relative overflow-hidden">
            <div className="absolute inset-0 opacity-10 pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/felt.png')]"></div>
            <div className="relative z-10">
              <div className="flex h-64">
                <div onClick={() => placeBet(0)} className="w-16 flex items-center justify-center font-black text-3xl border-2 border-white/20 bg-emerald-800 hover:bg-emerald-600 cursor-pointer transition-colors rounded-l-2xl relative">
                  0 {bets[0] && <Chip value={bets[0]} />}
                </div>
                <div className="flex-1 grid grid-rows-3 grid-flow-col border-y-2 border-r-2 border-white/20 overflow-hidden">
                  {BOARD_LAYOUT.map((row) => (
                    row.map((num) => (
                      <div key={num} onClick={() => placeBet(num)} className={`h-full border border-white/10 flex items-center justify-center font-black text-xl cursor-pointer transition-all hover:scale-[1.02] relative ${getNumberColor(num)}`}>
                        {num} {bets[num] && <Chip value={bets[num]} />}
                      </div>
                    ))
                  ))}
                </div>
              </div>
              {/* Extra Betting Options */}
              <div className="mt-4 grid grid-cols-3 gap-3 ml-16">
                {['1st12', '2nd12', '3rd12'].map((type, idx) => (
                  <button key={type} onClick={() => placeBet(type)} className="py-5 bg-emerald-900/40 border border-white/10 font-black text-xs relative rounded-xl uppercase">
                    {idx + 1}nd 12 {bets[type] && <Chip value={bets[type]} />}
                  </button>
                ))}
              </div>
            </div>
          </div>
          {/* Chips selection */}
          <div className="mt-10 flex flex-col items-center bg-black/30 p-8 rounded-[40px] border border-white/5">
             <div className="flex flex-wrap justify-center gap-6">
                {chips.map(val => (
                  <button key={val} onClick={() => setSelectedChip(val)} className={`relative w-20 h-20 rounded-full border-[6px] border-dashed transition-all transform hover:scale-110 flex items-center justify-center font-black shadow-xl ${selectedChip === val ? 'scale-110 border-white ring-8 ring-yellow-500/20' : 'border-white/20 opacity-60'} ${getChipColor(val)}`}>
                    <div className="w-14 h-14 rounded-full border-4 border-white/20 flex items-center justify-center bg-black/40">{val}</div>
                  </button>
                ))}
             </div>
          </div>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes ball-bounce-pocket {
          0% { transform: translate(-50%, -10px); }
          40% { transform: translate(-55%, 5px); }
          70% { transform: translate(-45%, -2px); }
          100% { transform: translate(-50%, 0); }
        }
      `}} />
    </div>
  );
};

const Chip = ({ value }) => (
  <div className={`absolute inset-0 m-auto w-10 h-10 rounded-full border-2 border-dashed border-white/60 flex items-center justify-center z-50 font-black text-[10px] ${getChipColor(value)}`}>
     <div className="w-7 h-7 rounded-full bg-black/40 text-white flex items-center justify-center">{value >= 1000 ? `${value/1000}K` : value}</div>
  </div>
);

const getChipColor = (val) => {
  if (val >= 1000) return 'bg-indigo-600';
  if (val >= 500) return 'bg-fuchsia-600';
  if (val >= 100) return 'bg-blue-600';
  if (val >= 50) return 'bg-amber-600';
  return 'bg-emerald-600';
};

export default App;