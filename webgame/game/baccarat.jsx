import React, { useState, useEffect, useRef } from 'react';
import { Wallet, Trophy, Star, Clock, Coins, ChevronRight, History, User } from 'lucide-react';

const CHIPS = [
  { value: 10000, label: '10K', color: '#64748b' },
  { value: 50000, label: '50K', color: '#94a3b8' },
  { value: 100000, label: '100K', color: '#3b82f6' },
  { value: 500000, label: '500K', color: '#10b981' },
  { value: 1000000, label: '1M', color: '#f59e0b' },
  { value: 5000000, label: '5M', color: '#ef4444' },
];

const SUITS = [
  { symbol: '♠', color: 'black' },
  { symbol: '♣', color: 'black' },
  { symbol: '♥', color: 'red' },
  { symbol: '♦', color: 'red' }
];
const VALUES = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

const SESSION_TIME = 15;

const getCardValue = (card) => {
  if (!card) return 0;
  if (['10', 'J', 'Q', 'K'].includes(card.val)) return 0;
  if (card.val === 'A') return 1;
  return parseInt(card.val);
};

const calculateScore = (cards) => {
  const total = cards.reduce((sum, card) => sum + getCardValue(card), 0);
  return total % 10;
};

const Card = ({ card, isFlipped, index, isDealing }) => {
  const [arrived, setArrived] = useState(false);
  const isThirdCard = index === 2;

  useEffect(() => {
    if (isDealing && card) {
      const delay = index * 150; 
      const timer = setTimeout(() => setArrived(true), delay);
      return () => clearTimeout(timer);
    } else if (!isDealing) {
      setArrived(false);
    }
  }, [isDealing, card, index]);

  if (!card) return null;

  const cardStyle = {
    perspective: '1000px',
    transform: arrived 
      ? (isThirdCard ? 'rotate(90deg) translateY(-4px)' : 'translate(0, 0)') 
      : 'translate(200px, -400px) rotate(20deg)',
    opacity: arrived ? 1 : 0,
    zIndex: 10 + index,
    transition: 'transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.3s ease-out',
  };

  const textColor = card.color === 'red' ? 'text-red-600' : 'text-slate-900';

  return (
    <div className={`relative w-10 h-14 flex-shrink-0 ${isThirdCard ? 'ml-2' : '-ml-4 first:ml-0'}`} style={cardStyle}>
      <div className={`relative w-full h-full duration-700 preserve-3d transition-transform ${isFlipped ? 'rotate-y-180' : ''}`}>
        <div className="absolute inset-0 backface-hidden rounded-md border border-yellow-500/30 bg-[#1a1a1a] flex items-center justify-center shadow-lg">
           <div className="w-full h-full border-2 border-yellow-600/20 m-1 rounded-sm flex items-center justify-center">
              <Star className="text-yellow-600/20" size={12} />
           </div>
        </div>
        
        <div className="absolute inset-0 backface-hidden rotate-y-180 rounded-md bg-white border border-slate-200 shadow-xl text-black overflow-hidden p-0.5">
          <div className={`absolute top-0.5 left-0.5 flex flex-col items-center leading-none ${textColor}`}>
            <span className="text-[10px] font-black">{card.val}</span>
            <span className="text-[8px] -mt-0.5">{card.suit}</span>
          </div>
          
          <div className="absolute inset-0 flex items-center justify-center pt-2">
            <span className={`text-xl ${textColor}`}>{card.suit}</span>
          </div>

          <div className={`absolute bottom-0.5 right-0.5 flex flex-col items-center leading-none rotate-180 ${textColor}`}>
            <span className="text-[10px] font-black">{card.val}</span>
            <span className="text-[8px] -mt-0.5">{card.suit}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default function App() {
  const [balance, setBalance] = useState(100000000); 
  const [selectedChip, setSelectedChip] = useState(100000);
  const [bets, setBets] = useState({ PLAYER: 0, BANKER: 0, TIE: 0 });
  const [gameStatus, setGameStatus] = useState('IDLE'); 
  const [winner, setWinner] = useState(null);
  const [winAmount, setWinAmount] = useState(0);
  const [hands, setHands] = useState({ player: [], banker: [] });
  const [history, setHistory] = useState(['PLAYER', 'BANKER', 'PLAYER', 'PLAYER', 'TIE', 'BANKER', 'BANKER', 'PLAYER']);
  const [message, setMessage] = useState("MỜI ĐẶT CƯỢC");
  const [revealed, setRevealed] = useState({ player: false, banker: false, p3: false, b3: false });
  const [isDealing, setIsDealing] = useState(false);
  const [timeLeft, setTimeLeft] = useState(SESSION_TIME);
  const timerRef = useRef(null);

  useEffect(() => {
    if (gameStatus === 'IDLE') {
      setWinner(null);
      setWinAmount(0);
      setTimeLeft(SESSION_TIME);
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            clearInterval(timerRef.current);
            startDeal();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timerRef.current);
  }, [gameStatus]);

  const createCard = () => {
    const suit = SUITS[Math.floor(Math.random() * 4)];
    const val = VALUES[Math.floor(Math.random() * 13)];
    return { suit: suit.symbol, val, color: suit.color };
  };

  const startDeal = async () => {
    setIsDealing(false); 
    setHands({ player: [], banker: [] });
    setRevealed({ player: false, banker: false, p3: false, b3: false });
    setGameStatus('DEALING');
    
    await new Promise(r => setTimeout(r, 600));
    setIsDealing(true);
    setMessage("BẮT ĐẦU CHIA BÀI...");

    const p1 = createCard(); const b1 = createCard();
    const p2 = createCard(); const b2 = createCard();

    // Chia 2 lá đầu cho mỗi bên
    setHands(h => ({ ...h, player: [p1] })); await new Promise(r => setTimeout(r, 400));
    setHands(h => ({ ...h, banker: [b1] })); await new Promise(r => setTimeout(r, 400));
    setHands(h => ({ ...h, player: [p1, p2] })); await new Promise(r => setTimeout(r, 400));
    setHands(h => ({ ...h, banker: [b1, b2] })); await new Promise(r => setTimeout(r, 600));

    // Lật bài cơ bản
    setMessage("PLAYER LẬT...");
    setRevealed(prev => ({ ...prev, player: true })); await new Promise(r => setTimeout(r, 800));

    setMessage("BANKER LẬT...");
    setRevealed(prev => ({ ...prev, banker: true })); await new Promise(r => setTimeout(r, 1000));
    
    let pHand = [p1, p2];
    let bHand = [b1, b2];
    let pScore = calculateScore(pHand);
    let bScore = calculateScore(bHand);

    // Luật Baccarat: Thắng tự nhiên (8 hoặc 9) thì không rút thêm
    if (pScore < 8 && bScore < 8) {
      // 1. Kiểm tra Player rút lá thứ 3
      if (pScore <= 5) {
        setMessage("PLAYER RÚT THÊM...");
        const p3 = createCard();
        pHand.push(p3);
        setHands(h => ({ ...h, player: [...pHand] }));
        await new Promise(r => setTimeout(r, 800));
        setRevealed(prev => ({ ...prev, p3: true }));
        await new Promise(r => setTimeout(r, 1000));
        pScore = calculateScore(pHand);
      }
      
      // 2. Kiểm tra Banker rút lá thứ 3 (Đơn giản hóa luật Banker cho game)
      if (bScore <= 5) {
        setMessage("BANKER RÚT THÊM...");
        const b3 = createCard();
        bHand.push(b3);
        setHands(h => ({ ...h, banker: [...bHand] }));
        await new Promise(r => setTimeout(r, 800));
        setRevealed(prev => ({ ...prev, b3: true }));
        await new Promise(r => setTimeout(r, 1000));
        bScore = calculateScore(bHand);
      }
    }

    // Đảm bảo tất cả lá bài đã hiện điểm xong mới chốt kết quả
    setMessage("XÁC NHẬN KẾT QUẢ...");
    await new Promise(r => setTimeout(r, 1500));

    // Chỉ gọi handleResult sau khi quá trình rút bài hoàn tất 100%
    handleResult(pScore, bScore);
  };

  const handleResult = (p, b) => {
    let res = "TIE";
    if (p > b) res = "PLAYER";
    else if (b > p) res = "BANKER";

    // Set winner trước khi chuyển trạng thái RESULT để UI render overlay đúng dữ liệu
    setWinner(res);
    setHistory(prev => [...prev, res].slice(-50));

    let win = 0;
    if (res === "PLAYER") win = bets.PLAYER * 2;
    if (res === "BANKER") win = bets.BANKER * 1.95;
    if (res === "TIE") win = bets.TIE * 9;

    setWinAmount(win);
    if (win > 0) {
      setBalance(curr => curr + win);
      setMessage(`THẮNG +${Math.floor(win).toLocaleString()}₫`);
    } else {
      setMessage(res === "TIE" ? "HÒA - HOÀN TIỀN" : `${res} THẮNG`);
    }

    // Kích hoạt Overlay làm mờ
    setGameStatus('RESULT');

    // Sau 5 giây quay lại trạng thái IDLE
    setTimeout(() => {
      setBets({ PLAYER: 0, BANKER: 0, TIE: 0 });
      setGameStatus('IDLE');
      setIsDealing(false);
      setMessage("MỜI ĐẶT CƯỢC");
    }, 5000);
  };

  const handleBet = (type) => {
    if (gameStatus !== 'IDLE' || timeLeft === 0) return;
    if (balance >= selectedChip) {
      setBalance(b => b - selectedChip);
      setBets(prev => ({ ...prev, [type]: prev[type] + selectedChip }));
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#111318] flex items-center justify-center md:p-4">
      <style>{`
        .preserve-3d { transform-style: preserve-3d; }
        .backface-hidden { backface-visibility: hidden; }
        .rotate-y-180 { transform: rotateY(180deg); }
        .felt-surface { background: radial-gradient(circle at 50% 0%, #1e293b 0%, #0f172a 100%); }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .bet-box-active {
           box-shadow: 0 0 15px rgba(245, 158, 11, 0.3);
           border-color: #f59e0b !important;
        }

        @keyframes slideDownFade {
          from { transform: translate(-50%, -60%); opacity: 0; }
          to { transform: translate(-50%, -50%); opacity: 1; }
        }
        
        @media (min-width: 768px) {
          .phone-frame {
            width: 340px;
            height: 700px;
            background: #1f2937;
            border-radius: 40px;
            border: 8px solid #374151;
            box-shadow: 0 50px 100px -20px rgba(0, 0, 0, 0.7);
            position: relative;
            overflow: hidden;
            display: flex;
            flex-direction: column;
          }
          .physical-button { display: block; }
        }

        @media (max-width: 767px) {
          .phone-frame {
            width: 100%;
            height: 100vh;
            border: none;
            border-radius: 0;
            box-shadow: none;
          }
          .physical-button { display: none; }
        }
      `}</style>

      <div className="phone-frame">
        <div className="flex-grow flex flex-col bg-[#05070a] text-slate-100 font-sans select-none overflow-hidden relative">
          
          <header className="px-4 pt-8 md:pt-6 pb-3 flex justify-between items-center bg-[#0f172a]/95 backdrop-blur-md border-b border-white/5 z-50">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 bg-amber-500 rounded-full flex items-center justify-center">
                <User size={14} className="text-amber-950" />
              </div>
              <div className="flex flex-col">
                <span className="text-[8px] text-slate-400 font-bold uppercase">Số dư khả dụng</span>
                <span className="text-xs font-black text-amber-500 tracking-tight leading-none">{balance.toLocaleString()}</span>
              </div>
            </div>
            <div className="px-2 py-1 bg-white/5 rounded-md border border-white/10">
              <span className="text-[8px] font-mono text-slate-400"># 1002</span>
            </div>
          </header>

          <div className="px-4 py-2 bg-slate-900/30 border-b border-white/5 flex justify-between items-center">
             <div className="flex items-center gap-1.5">
                <Clock size={10} className={timeLeft <= 5 && gameStatus === 'IDLE' ? 'text-red-500 animate-pulse' : 'text-slate-500'} />
                <span className={`text-[8px] font-bold ${timeLeft <= 5 && gameStatus === 'IDLE' ? 'text-red-500' : 'text-slate-500'}`}>
                  {gameStatus === 'IDLE' ? `${timeLeft}s` : 'XỬ LÝ'}
                </span>
             </div>
             <div className="text-[9px] font-black text-amber-500 tracking-wider uppercase">{message}</div>
          </div>

          <main className="flex-grow flex flex-col p-3 overflow-y-auto no-scrollbar gap-3">
            {/* Table Area */}
            <div className="relative bg-slate-900/40 rounded-2xl p-4 border border-white/5 shadow-inner min-h-[220px] flex flex-col justify-center overflow-hidden">
              
              {/* Overlay làm mờ: Chỉ hiện khi gameStatus là RESULT và đã có winner */}
              {gameStatus === 'RESULT' && winner && (
                <div className="absolute inset-0 z-40 bg-black/50 backdrop-blur-[4px] flex items-center justify-center transition-all duration-700 animate-in fade-in">
                  <div 
                    className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full text-center py-8 bg-gradient-to-r from-transparent via-black/90 to-transparent border-y border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.8)]"
                    style={{ animation: 'slideDownFade 0.6s cubic-bezier(0.17, 0.67, 0.83, 0.67) forwards' }}
                  >
                    <div className="flex flex-col items-center gap-1">
                      <span className={`text-[11px] font-black tracking-[0.3em] uppercase ${winner === 'PLAYER' ? 'text-blue-400' : winner === 'BANKER' ? 'text-red-400' : 'text-emerald-400'}`}>
                        {winner} WINS
                      </span>
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-[2px] ${winner === 'PLAYER' ? 'bg-blue-500/40' : winner === 'BANKER' ? 'bg-red-500/40' : 'bg-emerald-500/40'}`}></div>
                        <span className="text-4xl font-black text-white italic tracking-tighter drop-shadow-[0_0_15px_rgba(255,255,255,0.4)]">
                          {calculateScore(hands.player)} - {calculateScore(hands.banker)}
                        </span>
                        <div className={`w-12 h-[2px] ${winner === 'PLAYER' ? 'bg-blue-500/40' : winner === 'BANKER' ? 'bg-red-500/40' : 'bg-emerald-500/40'}`}></div>
                      </div>
                      {winAmount > 0 && (
                         <div className="mt-4 flex items-center gap-2 px-4 py-1.5 bg-amber-500/20 border border-amber-500/40 rounded-full animate-bounce">
                            <Coins size={12} className="text-amber-400" />
                            <span className="text-sm font-black text-amber-400">+{winAmount.toLocaleString()}₫</span>
                         </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <div className="flex justify-between w-full relative z-10">
                <div className="flex flex-col items-center gap-2 w-1/2">
                   <div className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">PLAYER</div>
                   <div className="flex items-center h-16 relative">
                     {hands.player.map((c, i) => (
                       <Card key={`p-${i}`} card={c} isFlipped={i === 2 ? revealed.p3 : revealed.player} index={i} isDealing={isDealing} />
                     ))}
                   </div>

                </div>

                <div className="flex flex-col items-center gap-2 w-1/2">
                   <div className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">BANKER</div>
                   <div className="flex items-center h-16 relative">
                     {hands.banker.map((c, i) => (
                       <Card key={`b-${i}`} card={c} isFlipped={i === 2 ? revealed.b3 : revealed.banker} index={i} isDealing={isDealing} />
                     ))}
                   </div>

                </div>
              </div>
            </div>

            <div className="grid grid-cols-12 gap-2 h-20">
              <button onClick={() => handleBet('PLAYER')} className={`col-span-5 rounded-xl border border-white/5 felt-surface flex flex-col items-center justify-center relative transition-all active:scale-95 ${winner === 'PLAYER' ? 'bet-box-active' : ''}`}>
                <span className="text-xs font-black text-blue-500">PLAYER</span>
                <span className="text-[7px] text-slate-500 mt-0.5">{bets.PLAYER > 0 ? (bets.PLAYER/1000).toLocaleString()+'K' : '1.250.000'}</span>
                {bets.PLAYER > 0 && <div className="absolute -top-1 -right-1 bg-blue-600 w-4 h-4 rounded-full border border-white flex items-center justify-center text-[6px] font-bold">C</div>}
              </button>
              
              <button onClick={() => handleBet('TIE')} className={`col-span-2 rounded-xl border border-white/5 felt-surface flex flex-col items-center justify-center relative transition-all active:scale-95 ${winner === 'TIE' ? 'bet-box-active' : ''}`}>
                <span className="text-[10px] font-black text-emerald-500">TIE</span>
                <span className="text-[6px] text-slate-500 mt-0.5">{bets.TIE > 0 ? (bets.TIE/1000).toLocaleString()+'K' : '240.000'}</span>
              </button>
              
              <button onClick={() => handleBet('BANKER')} className={`col-span-5 rounded-xl border border-white/5 felt-surface flex flex-col items-center justify-center relative transition-all active:scale-95 ${winner === 'BANKER' ? 'bet-box-active' : ''}`}>
                <span className="text-xs font-black text-red-500">BANKER</span>
                <span className="text-[7px] text-slate-500 mt-0.5">{bets.BANKER > 0 ? (bets.BANKER/1000).toLocaleString()+'K' : '1.800.000'}</span>
              </button>
            </div>

            <div className="bg-black/40 rounded-xl p-3 border border-white/5">
              <div className="flex justify-between items-center mb-2">
                <span className="text-[7px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1">
                  <History size={8} /> ROAD MAP
                </span>
                <div className="flex gap-2 text-[7px] font-bold">
                  <span className="text-red-500">B: {history.filter(x=>x==='BANKER').length}</span>
                  <span className="text-blue-500">P: {history.filter(x=>x==='PLAYER').length}</span>
                  <span className="text-emerald-500">T: {history.filter(x=>x==='TIE').length}</span>
                </div>
              </div>
              <div className="grid grid-rows-6 grid-flow-col gap-1 h-20 overflow-x-auto no-scrollbar bg-white/[0.02] p-2 rounded-md">
                {history.map((h, i) => (
                  <div key={i} className={`w-2 h-2 rounded-full flex items-center justify-center text-[4px] font-black text-white ${h === 'PLAYER' ? 'bg-blue-600' : h === 'BANKER' ? 'bg-red-600' : 'bg-emerald-600'}`}>
                    {h[0]}
                  </div>
                ))}
                {[...Array(80)].map((_, i) => <div key={i} className="w-2 h-2 rounded-full border border-white/5 flex-shrink-0" />)}
              </div>
            </div>
          </main>

          <footer className="bg-slate-900/80 border-t border-white/5 p-4 pb-10">
            <div className="flex gap-2 justify-center">
              {CHIPS.map(chip => (
                <button 
                  key={chip.value}
                  onClick={() => setSelectedChip(chip.value)}
                  className={`w-10 h-10 rounded-full border-2 flex items-center justify-center transition-all ${selectedChip === chip.value ? 'scale-110 border-amber-400 ring-4 ring-amber-400/20' : 'border-white/10 grayscale-[0.5] opacity-40'}`}
                  style={{ background: `radial-gradient(circle at 35% 35%, ${chip.color}, #000 150%)` }}
                >
                  <span className="text-[7px] font-black text-white">{chip.label}</span>
                </button>
              ))}
            </div>
          </footer>
        </div>
        
        <div className="physical-button absolute right-[-10px] top-[100px] w-[2px] h-[40px] bg-[#374151] rounded-l-md hidden md:block"></div>
        <div className="physical-button absolute left-[-10px] top-[100px] w-[2px] h-[30px] bg-[#374151] rounded-r-md hidden md:block"></div>
        <div className="physical-button absolute left-[-10px] top-[140px] w-[2px] h-[50px] bg-[#374151] rounded-r-md hidden md:block"></div>
        <div className="physical-button absolute left-[-10px] top-[200px] w-[2px] h-[50px] bg-[#374151] rounded-r-md hidden md:block"></div>
      </div>
    </div>
  );
}