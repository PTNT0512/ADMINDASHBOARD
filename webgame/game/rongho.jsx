import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Coins, RotateCcw, Hash, History, User } from 'lucide-react';

const CARD_VALUES = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const SUITS = ['♠', '♥', '♣', '♦'];
const CHIP_VALUES = [5000, 10000, 50000, 100000, 200000, 500000, 1000000, 5000000, 10000000];

const DragonTigerPro = () => {
  const [balance, setBalance] = useState(100000000);
  const [roundId, setRoundId] = useState(1001);
  const [gameState, setGameState] = useState('betting');
  const [timer, setTimer] = useState(15);
  const [selectedChip, setSelectedChip] = useState(5000);
  const [bets, setBets] = useState({ dragon: 0, tiger: 0, tie: 0 });
  const [totalPool, setTotalPool] = useState({ dragon: 1250000, tiger: 1080000, tie: 240000 });
  const [cards, setCards] = useState({ dragon: null, tiger: null });
  const [revealState, setRevealState] = useState({ dragon: false, tiger: false });
  const [isDealing, setIsDealing] = useState(false);
  const [history, setHistory] = useState(['D', 'D', 'D', 'T', 'T', 'D', 'E', 'D', 'T', 'T', 'T', 'T', 'D', 'D', 'T', 'D', 'D', 'D', 'D', 'T', 'T', 'E', 'T', 'D', 'D', 'D', 'T', 'T', 'T', 'D', 'D', 'T', 'T', 'E', 'D', 'D', 'T', 'T', 'D', 'D', 'E', 'D', 'T', 'T']);
  const [lastWin, setLastWin] = useState(null);
  const [message, setMessage] = useState('Mời đặt cược');
  
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollLeft = scrollRef.current.scrollWidth;
    }
  }, [history]);

  const bigRoadData = useMemo(() => {
    const matrix = [];
    let currentColumn = [];
    let lastType = null;

    history.forEach((res) => {
      const type = res === 'E' ? lastType : res; 
      if (type !== lastType && lastType !== null) {
        matrix.push(currentColumn);
        currentColumn = [res];
      } else {
        if (currentColumn.length < 6) {
          currentColumn.push(res);
        } else {
          matrix.push(currentColumn);
          currentColumn = [res];
        }
      }
      lastType = type;
    });
    matrix.push(currentColumn);
    const MIN_COLS = 20;
    const currentCols = matrix.length;
    if (currentCols < MIN_COLS) {
      for (let i = 0; i < MIN_COLS - currentCols; i++) {
        matrix.push([]);
      }
    }
    return matrix;
  }, [history]);

  useEffect(() => {
    let interval;
    if (gameState === 'betting' && timer > 0) {
      interval = setInterval(() => setTimer(t => t - 1), 1000);
    } else if (timer === 0 && gameState === 'betting') {
      startDealing();
    }
    return () => clearInterval(interval);
  }, [timer, gameState]);

  const startDealing = () => {
    setGameState('dealing');
    setMessage('Ngừng đặt cược!');
    setTimeout(() => {
      setIsDealing(true);
      const dCard = getRandomCard();
      const tCard = getRandomCard();
      setCards({ dragon: dCard, tiger: tCard });
      setTimeout(() => {
        setGameState('revealing');
        setRevealState(prev => ({ ...prev, dragon: true }));
        setTimeout(() => {
          setRevealState(prev => ({ ...prev, tiger: true }));
          setTimeout(() => {
            determineWinner(dCard, tCard);
          }, 1200);
        }, 1000);
      }, 1000); 
    }, 500);
  };

  const getRandomCard = () => {
    const vIdx = Math.floor(Math.random() * CARD_VALUES.length);
    const sIdx = Math.floor(Math.random() * SUITS.length);
    return {
      value: CARD_VALUES[vIdx],
      suit: SUITS[sIdx],
      rank: vIdx + 1,
      isRed: SUITS[sIdx] === '♥' || SUITS[sIdx] === '♦'
    };
  };

  const determineWinner = (dragon, tiger) => {
    let winner = '';
    let winAmount = 0;
    let historyChar = '';
    if (dragon.rank > tiger.rank) {
      winner = 'dragon'; winAmount = bets.dragon * 2; historyChar = 'D';
    } else if (tiger.rank > dragon.rank) {
      winner = 'tiger'; winAmount = bets.tiger * 2; historyChar = 'T';
    } else {
      winner = 'tie'; winAmount = bets.tie * 8 + (bets.dragon + bets.tiger) / 2; historyChar = 'E';
    }
    setLastWin(winner);
    setBalance(prev => prev + winAmount);
    setHistory(prev => [...prev, historyChar]);
    setGameState('result');
    if (winAmount > 0) setMessage(`+${winAmount.toLocaleString()} ₫`);
    else setMessage(winner === 'dragon' ? 'Rồng thắng' : winner === 'tiger' ? 'Hổ thắng' : 'Hòa');
    setTimeout(() => nextRound(), 3000);
  };

  const nextRound = () => {
    setRoundId(prev => prev + 1);
    setGameState('betting');
    setIsDealing(false);
    setRevealState({ dragon: false, tiger: false });
    setTimer(15);
    setBets({ dragon: 0, tiger: 0, tie: 0 });
    setCards({ dragon: null, tiger: null });
    setLastWin(null);
    setMessage('Mời đặt cược');
  };

  const handlePlaceBet = (side) => {
    if (gameState !== 'betting') return;
    if (balance < selectedChip) { setMessage('Số dư không đủ!'); return; }
    setBalance(prev => prev - selectedChip);
    setBets(prev => ({ ...prev, [side]: prev[side] + selectedChip }));
  };

  const formatChipValue = (val) => {
    if (val >= 1000000) return `${val / 1000000}M`;
    if (val >= 1000) return `${val / 1000}K`;
    return val;
  };

  return (
    <div className="min-h-screen bg-[#05070a] flex justify-center items-center font-sans">
      {/* Khung điện thoại - Đã bỏ Notch */}
      <div className="relative w-full max-w-[430px] h-screen md:h-[90vh] md:max-h-[850px] bg-[#0b0e14] text-white overflow-hidden flex flex-col select-none md:rounded-[2.5rem] md:border-[8px] md:border-slate-800 md:shadow-2xl">
        
        {/* Header */}
        <div className="h-14 px-5 flex justify-between items-center bg-black/40 border-b border-white/5 backdrop-blur-md z-50">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-yellow-600 to-yellow-400 flex items-center justify-center shadow-lg border border-white/10">
              <User size={16} className="text-black" />
            </div>
            <div className="flex flex-col">
              <span className="text-[9px] text-white/40 uppercase font-bold tracking-tighter">Số dư</span>
              <span className="text-sm font-black text-yellow-500 leading-none">{balance.toLocaleString()}</span>
            </div>
          </div>
          <div className="px-3 py-1 rounded-full bg-white/5 border border-white/10 flex items-center gap-1.5">
            <Hash size={10} className="text-white/40" />
            <span className="text-[10px] font-mono font-bold text-white/70">{roundId}</span>
          </div>
        </div>

        {/* Game Body */}
        <main className="flex-1 overflow-y-auto no-scrollbar flex flex-col pt-4 pb-32">
          
          {/* Arena Chia Bài */}
          <div className="px-4 mb-4">
            <div className="relative h-40 bg-gradient-to-b from-white/5 to-transparent rounded-[2rem] border border-white/10 flex items-center justify-around overflow-hidden shadow-inner">
              <div className="flex flex-col items-center gap-2">
                 <span className={`text-[11px] font-black transition-all tracking-widest ${lastWin === 'tiger' ? 'opacity-20' : 'text-red-500'}`}>DRAGON</span>
                 <CardView card={cards.dragon} isRevealed={revealState.dragon} isDealing={isDealing} side="dragon" />
              </div>

              <div className="relative w-14 h-14 flex items-center justify-center">
                 <div className={`absolute inset-0 rounded-full border-2 border-white/5 border-t-yellow-500 ${timer > 0 ? 'animate-spin' : ''}`}></div>
                 <span className={`text-2xl font-black ${timer <= 5 ? 'text-red-500 animate-pulse' : 'text-yellow-500'}`}>{timer}</span>
              </div>

              <div className="flex flex-col items-center gap-2">
                 <span className={`text-[11px] font-black transition-all tracking-widest ${lastWin === 'dragon' ? 'opacity-20' : 'text-blue-500'}`}>TIGER</span>
                 <CardView card={cards.tiger} isRevealed={revealState.tiger} isDealing={isDealing} side="tiger" />
              </div>
              
              {gameState === 'result' && (
                <div className="absolute inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-20 animate-in fade-in zoom-in duration-300">
                  <span className="text-2xl font-black text-yellow-400 drop-shadow-[0_0_15px_rgba(234,179,8,0.6)] tracking-[0.2em]">{message}</span>
                </div>
              )}
            </div>
          </div>

          <div className="px-4 h-6 mb-2 flex items-center justify-center">
             {gameState !== 'result' && <p className="text-[10px] font-bold text-white/30 uppercase tracking-[0.4em]">{message}</p>}
          </div>

          {/* Ô Đặt Cược */}
          <div className="px-4 mb-4">
            <div className="grid grid-cols-12 gap-2 h-24">
              <div className="col-span-5 h-full">
                <BetZone label="DRAGON" active={lastWin === 'dragon'} color="red" myBet={bets.dragon} total={totalPool.dragon} onClick={() => handlePlaceBet('dragon')} disabled={gameState !== 'betting'} formatChip={formatChipValue} />
              </div>
              <div className="col-span-2 h-full">
                <BetZone label="TIE" active={lastWin === 'tie'} color="green" myBet={bets.tie} total={totalPool.tie} onClick={() => handlePlaceBet('tie')} disabled={gameState !== 'betting'} formatChip={formatChipValue} />
              </div>
              <div className="col-span-5 h-full">
                <BetZone label="TIGER" active={lastWin === 'tiger'} color="blue" myBet={bets.tiger} total={totalPool.tiger} onClick={() => handlePlaceBet('tiger')} disabled={gameState !== 'betting'} formatChip={formatChipValue} />
              </div>
            </div>
          </div>

          {/* Bảng soi cầu */}
          <div className="px-4">
            <div className="bg-[#161b22]/80 border border-white/5 rounded-2xl p-3 shadow-2xl backdrop-blur-sm">
              <div className="flex items-center justify-between mb-2.5 px-1">
                <div className="flex items-center gap-1.5 opacity-50">
                  <History size={11} className="text-white" />
                  <span className="text-[8px] font-black uppercase tracking-[0.2em]">Lịch sử</span>
                </div>
                <div className="flex gap-2 text-[8px] font-bold">
                   <span className="text-red-500">D: {history.filter(h => h==='D').length}</span>
                   <span className="text-blue-500">T: {history.filter(h => h==='T').length}</span>
                   <span className="text-green-500">E: {history.filter(h => h==='E').length}</span>
                </div>
              </div>
              
              <div ref={scrollRef} className="w-full bg-black/60 rounded-xl p-2 py-3 overflow-x-auto no-scrollbar border border-white/5 shadow-inner">
                 <div className="flex gap-1.5 min-w-max">
                    {bigRoadData.map((column, colIdx) => (
                      <div key={colIdx} className="flex flex-col gap-1">
                        {[0, 1, 2, 3, 4, 5].map((rowIdx) => {
                          const res = column[rowIdx];
                          return (
                            <div key={rowIdx} className="w-5.5 h-5.5 rounded-sm flex items-center justify-center relative">
                              {res && (
                                <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[12px] font-black border
                                  ${res === 'D' ? 'border-red-500/80 text-red-500 bg-red-500/5 shadow-[0_0_5px_rgba(239,68,68,0.2)]' : 
                                    res === 'T' ? 'border-blue-500/80 text-blue-500 bg-blue-500/5 shadow-[0_0_5px_rgba(59,130,246,0.2)]' : 
                                    'border-green-500/80 text-green-500 bg-green-500/5 shadow-[0_0_5px_rgba(34,197,94,0.2)]'}`}
                                >
                                  {res}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ))}
                 </div>
              </div>
            </div>
          </div>
        </main>

        {/* Chips Panel */}
        <div className="absolute bottom-0 left-0 right-0 bg-[#0a0d12]/95 backdrop-blur-3xl border-t border-white/10 z-[60] pb-2 pt-2 px-3">
          <div className="flex items-center gap-4 overflow-x-auto no-scrollbar px-2 pb-2 py-4">
            {CHIP_VALUES.map(val => (
              <button
                key={val}
                onClick={() => setSelectedChip(val)}
                className={`flex-shrink-0 w-14 h-14 rounded-full border-2 transition-all duration-300 flex flex-col items-center justify-center font-black text-[10px] text-white shadow-2xl relative
                  ${selectedChip === val ? 'border-yellow-400 scale-115 ring-8 ring-yellow-400/10 z-10 translate-y-[-4px]' : 'border-white/5 opacity-40 hover:opacity-100'}
                  ${val < 50000 ? 'bg-slate-800' : 
                    val < 200000 ? 'bg-blue-900' : 
                    val < 1000000 ? 'bg-purple-950' : 
                    val < 5000000 ? 'bg-red-950' : 'bg-yellow-800'}`}
              >
                <span>{formatChipValue(val)}</span>
                {selectedChip === val && (
                  <div className="absolute -bottom-2 w-1.5 h-1.5 bg-yellow-400 rounded-full shadow-[0_0_10px_#facc15]"></div>
                )}
              </button>
            ))}
          </div>
        </div>

      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        .deal-dragon { animation: dealDragon 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards; }
        .deal-tiger { animation: dealTiger 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) 0.1s forwards; }
        @keyframes dealDragon { 0% { transform: translate(60vw, -200px) rotate(90deg) scale(0.5); opacity: 0; } 100% { transform: translate(0, 0) rotate(0) scale(1); opacity: 1; } }
        @keyframes dealTiger { 0% { transform: translate(-60vw, -200px) rotate(-90deg) scale(0.5); opacity: 0; } 100% { transform: translate(0, 0) rotate(0) scale(1); opacity: 1; } }
        .reveal-anim { animation: revealIn 0.4s cubic-bezier(0.4, 0, 0.2, 1) forwards; }
        @keyframes revealIn { 0% { transform: perspective(1000px) rotateY(-180deg); } 100% { transform: perspective(1000px) rotateY(0deg); } }
      `}} />
    </div>
  );
};

const CardView = ({ card, isRevealed, isDealing, side }) => {
  const animationClass = side === 'dragon' ? 'deal-dragon' : 'deal-tiger';
  return (
    <div className={`relative w-[65px] h-[90px] ${isDealing ? animationClass : 'opacity-0'}`}>
      {!isRevealed ? (
        <div className="w-full h-full bg-[#1e293b] border-2 border-slate-700/50 rounded-xl flex items-center justify-center shadow-2xl overflow-hidden relative">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-slate-500/20 to-transparent"></div>
          <div className="w-full h-full opacity-10 flex items-center justify-center p-2">
             <div className="grid grid-cols-2 gap-1 w-full h-full border border-white/20 p-1">
                {[1,2,3,4].map(i => <div key={i} className="bg-white/20 rounded-sm"></div>)}
             </div>
          </div>
        </div>
      ) : (
        <div className="w-full h-full bg-white rounded-xl flex flex-col shadow-[0_10px_30px_rgba(0,0,0,0.5)] text-black reveal-anim border border-slate-200 overflow-hidden relative">
          {card && (
            <>
              <div className={`absolute top-1 left-1.5 flex flex-col items-center leading-none ${card.isRed ? 'text-red-600' : 'text-slate-900'}`}>
                <span className="text-sm font-black tracking-tighter">{card.value}</span>
                <span className="text-[10px]">{card.suit}</span>
              </div>
              <div className={`flex-1 flex items-center justify-center text-3xl drop-shadow-sm ${card.isRed ? 'text-red-600' : 'text-slate-900'}`}>
                {card.suit}
              </div>
              <div className={`absolute bottom-1 right-1.5 flex flex-col items-center rotate-180 leading-none ${card.isRed ? 'text-red-600' : 'text-slate-900'}`}>
                <span className="text-sm font-black tracking-tighter">{card.value}</span>
                <span className="text-[10px]">{card.suit}</span>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

const BetZone = ({ label, active, color, myBet, total, onClick, disabled, formatChip }) => {
  const styles = {
    red: 'from-red-600/30 via-red-900/40 to-black border-red-500/50 text-red-500',
    blue: 'from-blue-600/30 via-blue-900/40 to-black border-blue-500/50 text-blue-500',
    green: 'from-green-600/30 via-green-900/40 to-black border-green-500/50 text-green-400'
  };
  return (
    <button onClick={onClick} disabled={disabled}
      className={`relative w-full h-full rounded-2xl border-2 bg-gradient-to-b transition-all duration-200 flex flex-col items-center justify-center overflow-hidden shadow-lg
        ${styles[color]} ${active ? 'ring-4 ring-yellow-400 scale-[0.96] border-yellow-400 bg-white/10 z-10' : ''}
        ${disabled ? 'opacity-30' : 'active:scale-90 hover:brightness-125'}`}
    >
      <span className="text-[11px] font-black tracking-widest mb-1 drop-shadow-md">{label}</span>
      <span className="text-[8px] font-bold font-mono text-white/40">{(total + myBet).toLocaleString()}</span>
      
      {myBet > 0 && (
        <div className="mt-1.5 px-2 py-0.5 rounded-full bg-yellow-500 text-black font-black text-[9px] shadow-[0_0_10px_rgba(234,179,8,0.4)] animate-in bounce-in duration-300">
          {formatChip(myBet)}
        </div>
      )}
      
      <div className="absolute inset-0 opacity-[0.05] pointer-events-none flex items-center justify-center text-6xl font-black">
        {label[0]}
      </div>
    </button>
  );
};

export default function App() { return <DragonTigerPro />; }