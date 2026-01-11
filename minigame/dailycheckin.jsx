import React, { useState, useEffect } from 'react';
import { Calendar, Check, Gift, Coins, RefreshCw, Star, Sparkles, Zap, Crown, Trophy } from 'lucide-react';

// --- Hiệu ứng pháo giấy tông Đỏ - Cam - Vàng ---
const Confetti = ({ active }) => {
  if (!active) return null;
  return (
    <div className="fixed inset-0 pointer-events-none z-[100] overflow-hidden">
      {[...Array(60)].map((_, i) => (
        <div
          key={i}
          className="absolute animate-confetti-fall"
          style={{
            left: `${Math.random() * 100}%`,
            top: `-20px`,
            animationDuration: `${Math.random() * 2 + 2}s`,
            animationDelay: `${Math.random() * 1.5}s`,
          }}
        >
          <div
            className="w-3 h-3 rotate-45"
            style={{
              backgroundColor: ['#FF4D4D', '#FF8C00', '#FFD700', '#FFFFFF', '#FF3300'][Math.floor(Math.random() * 5)],
              boxShadow: '0 0 10px rgba(255,140,0,0.5)'
            }}
          />
        </div>
      ))}
    </div>
  );
};

export default function App() {
  const rewardsConfig = [
    { day: 1, reward: 100 },
    { day: 2, reward: 150 },
    { day: 3, reward: 200 },
    { day: 4, reward: 250 },
    { day: 5, reward: 300 },
    { day: 6, reward: 500 },
    { day: 7, reward: 1000 },
  ];

  const [userCoins, setUserCoins] = useState(0);
  const [currentDay, setCurrentDay] = useState(1);
  const [checkedInDays, setCheckedInDays] = useState([]);
  const [showRewardModal, setShowRewardModal] = useState(false);
  const [rewardData, setRewardData] = useState({ amount: 0, day: 0 });
  const [justOpenedDay, setJustOpenedDay] = useState(null);
  const [showConfetti, setShowConfetti] = useState(false);

  useEffect(() => {
    const savedCoins = localStorage.getItem('userCoins');
    const savedDay = localStorage.getItem('currentDay');
    const savedCheckedIn = localStorage.getItem('checkedInDays');

    if (savedCoins) setUserCoins(parseInt(savedCoins));
    if (savedDay) setCurrentDay(parseInt(savedDay));
    if (savedCheckedIn) setCheckedInDays(JSON.parse(savedCheckedIn));
  }, []);

  const handleCheckIn = (dayOverride = null) => {
    const dayToProcess = dayOverride || currentDay;
    if (dayToProcess !== currentDay || checkedInDays.includes(dayToProcess)) return;

    const reward = rewardsConfig[currentDay - 1];
    setJustOpenedDay(currentDay);

    setTimeout(() => {
      const newCoins = userCoins + reward.reward;
      const newCheckedInDays = [...checkedInDays, currentDay];
      
      setUserCoins(newCoins);
      setCheckedInDays(newCheckedInDays);
      setRewardData({ amount: reward.reward, day: currentDay });
      setShowRewardModal(true);
      setShowConfetti(true);

      localStorage.setItem('userCoins', newCoins);
      localStorage.setItem('checkedInDays', JSON.stringify(newCheckedInDays));

      if (currentDay < 7) {
        const nextDay = currentDay + 1;
        setCurrentDay(nextDay);
        localStorage.setItem('currentDay', nextDay);
      }
      setTimeout(() => setJustOpenedDay(null), 1500);
    }, 1000);
  };

  const handleReset = () => {
    localStorage.clear();
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-[#110505] text-white font-sans overflow-x-hidden relative">
      {/* Background Ambient Light */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-red-600/5 blur-[150px] rounded-full animate-pulse-slow"></div>
        <div className="absolute bottom-0 right-1/4 w-[600px] h-[600px] bg-orange-600/5 blur-[150px] rounded-full animate-pulse-slow delay-1000"></div>
      </div>

      <Confetti active={showConfetti} />

      {/* Header */}
      <header className="sticky top-0 z-50 bg-[#110505]/60 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-md mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className="relative">
                <div className="absolute inset-0 bg-red-500 blur-lg opacity-20 animate-pulse"></div>
                <div className="relative p-2.5 bg-gradient-to-tr from-red-600 to-orange-500 rounded-2xl shadow-xl">
                    <Trophy size={20} className="text-white fill-white/10" />
                </div>
            </div>
            <div>
              <p className="text-[10px] font-black text-white/30 uppercase tracking-[0.25em] mb-0.5">Tài sản Duog</p>
              <div className="flex items-center gap-1.5">
                <span className="text-2xl font-black text-white tracking-tighter">{userCoins.toLocaleString()}</span>
                <div className="bg-orange-500/20 px-1.5 py-0.5 rounded-md">
                    <Coins size={14} className="text-orange-400" />
                </div>
              </div>
            </div>
          </div>
          <button onClick={handleReset} className="p-2.5 rounded-2xl bg-white/5 border border-white/10 hover:bg-red-500/10 transition-all active:scale-90 group">
            <RefreshCw size={18} className="text-white/40 group-hover:text-red-400 transition-colors" />
          </button>
        </div>
      </header>

      <main className="relative z-10 max-w-md mx-auto px-6 pt-8 pb-12">
        {/* Banner */}
        <div className="relative mb-10 group">
          <div className="absolute -inset-1 bg-gradient-to-r from-red-600 to-orange-600 rounded-[2.5rem] blur opacity-20 transition duration-1000"></div>
          <div className="relative p-8 rounded-[2.5rem] bg-gradient-to-br from-[#1c0a0a] to-[#0a0505] border border-white/5 shadow-3xl overflow-hidden">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-3xl font-black tracking-tighter mb-1 bg-clip-text text-transparent bg-gradient-to-r from-white to-white/60 italic">Hành Trình</h1>
                    <div className="flex items-center gap-2">
                         <div className="h-1.5 w-1.5 rounded-full bg-red-500 animate-ping"></div>
                         <p className="text-red-500 font-black text-xs uppercase tracking-widest">Day {currentDay} / 7</p>
                    </div>
                </div>
                <div className="p-4 bg-gradient-to-br from-white/10 to-transparent rounded-[1.5rem] border border-white/10">
                    <Calendar size={24} className="text-white" />
                </div>
            </div>
            
            <div className="space-y-3">
                <div className="w-full bg-white/5 h-4 rounded-full p-1 border border-white/5 shadow-inner">
                    <div className="h-full bg-gradient-to-r from-red-600 via-orange-500 to-yellow-400 rounded-full transition-all duration-1000 relative shadow-[0_0_20px_rgba(220,38,38,0.4)]" style={{ width: `${(currentDay / 7) * 100}%` }}>
                        <div className="absolute inset-0 bg-white/20 rounded-full blur-[1px]"></div>
                    </div>
                </div>
            </div>
          </div>
        </div>

        {/* New Grid Boxes Design */}
        <div className="grid grid-cols-3 gap-4 mb-10">
          {rewardsConfig.map((item, idx) => {
            const dayNum = idx + 1;
            const isCheckedIn = checkedInDays.includes(dayNum);
            const isCurrent = dayNum === currentDay && !isCheckedIn;
            const isLocked = dayNum > currentDay;
            const isOpening = justOpenedDay === dayNum;
            const isBigGift = dayNum === 7;

            return (
              <div 
                key={dayNum} 
                onClick={() => isCurrent && handleCheckIn()} 
                className={`relative group ${isBigGift ? 'col-span-3 h-36 mt-2' : 'h-32'}`}
              >
                {/* Box Container - Soft Neumorphism */}
                <div className={`
                    w-full h-full rounded-[2rem] transition-all duration-500 flex flex-col items-center justify-center relative overflow-hidden
                    ${isCheckedIn 
                        ? 'bg-white/5 border border-white/5 opacity-40 translate-y-1' 
                        : isCurrent 
                            ? 'bg-gradient-to-br from-red-500 to-orange-600 shadow-[0_20px_40px_rgba(220,38,38,0.3)] scale-105 z-20 border-t border-white/30' 
                            : isLocked 
                                ? 'bg-white/5 border border-white/5 opacity-30 scale-95' 
                                : 'bg-gradient-to-br from-orange-400/80 to-red-500 shadow-lg border-t border-white/20'}
                `}>
                  
                  {/* Decorative Light Streak for Current Day */}
                  {isCurrent && (
                    <div className="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-b from-white/20 to-transparent pointer-events-none"></div>
                  )}

                  {/* Icon/Content Area */}
                  <div className="relative z-10 flex flex-col items-center">
                    {isCheckedIn ? (
                        <div className="bg-white/10 p-2 rounded-2xl backdrop-blur-md">
                            <Check size={20} className="text-white/60" strokeWidth={3} />
                        </div>
                    ) : (
                        <div className={`transition-all duration-500 ${isOpening ? 'scale-0 opacity-0' : 'scale-100 opacity-100'}`}>
                            {isBigGift ? (
                                <div className="flex items-center gap-4">
                                    <Crown size={40} className="text-white drop-shadow-lg animate-bounce-slow" />
                                    <div className="text-left">
                                        <p className="text-[10px] font-black text-white/60 uppercase">Phần thưởng cuối</p>
                                        <p className="text-2xl font-black text-white">+{item.reward} Xu</p>
                                    </div>
                                </div>
                            ) : (
                                <div className="relative">
                                    <Gift size={dayNum <= 3 ? 24 : 32} className={`text-white drop-shadow-md ${isCurrent ? 'animate-box-shake' : ''}`} />
                                    {isCurrent && <div className="absolute -top-1 -right-1 w-2 h-2 bg-white rounded-full animate-ping"></div>}
                                </div>
                            )}
                        </div>
                    )}
                  </div>

                  {/* Day Label - Glass style */}
                  <div className={`
                    mt-2 px-3 py-1 rounded-xl text-[9px] font-black tracking-tighter uppercase
                    ${isCheckedIn ? 'bg-transparent text-white/30' : isCurrent ? 'bg-white/20 text-white' : 'bg-black/10 text-white/50'}
                  `}>
                    Ngày {dayNum}
                  </div>

                  {/* Flying Reward when opening */}
                  {isOpening && (
                    <div className="absolute inset-0 flex items-center justify-center z-30">
                        <div className="animate-reward-reveal">
                            <div className="bg-white p-3 rounded-full shadow-2xl">
                                <Coins size={24} className="text-orange-600" />
                            </div>
                        </div>
                    </div>
                  )}
                </div>

                {/* Perspective Lid Animation for Current/Big Day */}
                {isCurrent && !isCheckedIn && !isOpening && (
                    <div className={`absolute left-1/2 -translate-x-1/2 w-4/5 h-1 z-10 bg-white/40 blur-sm rounded-full transition-all duration-500 -bottom-1 group-hover:w-full`}></div>
                )}
              </div>
            );
          })}
        </div>

        {/* Action Button */}
        {!checkedInDays.includes(currentDay) && (
            <button 
                onClick={() => handleCheckIn()} 
                className="group relative w-full py-5 rounded-[2rem] bg-white text-red-600 font-black text-xl shadow-2xl hover:bg-orange-50 transition-all active:scale-95 flex items-center justify-center gap-4 overflow-hidden"
            >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-red-100 to-transparent skew-x-[-25deg] -translate-x-full group-hover:animate-shine-fast"></div>
                <div className="p-2 bg-red-100 rounded-xl group-hover:rotate-12 transition-transform">
                    <Zap size={20} fill="currentColor" />
                </div>
                NHẬN THƯỞNG NGAY
            </button>
        )}

        {checkedInDays.includes(currentDay) && (
             <div className="w-full py-6 rounded-[2rem] bg-white/5 border border-white/5 text-center flex flex-col items-center justify-center gap-2 backdrop-blur-md">
                <Sparkles size={24} className="text-orange-400 animate-pulse" />
                <p className="text-white/40 font-black text-[10px] uppercase tracking-[0.4em]">Quay lại vào ngày mai nhé Duog!</p>
            </div>
        )}
      </main>

      {/* REWARD MODAL - PREMIUM RED/ORANGE/WHITE */}
      {showRewardModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-[#0a0505]/95 backdrop-blur-2xl animate-in fade-in duration-500" onClick={() => setShowRewardModal(false)}></div>
          
          <div className="relative w-full max-w-sm transform animate-reward-popup">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[350px] h-[350px] bg-red-600/20 blur-[100px] rounded-full"></div>

            <div className="bg-white rounded-[3.5rem] p-1.5 shadow-3xl overflow-hidden border-t-8 border-orange-500">
                <div className="bg-white rounded-[3.3rem] p-10 text-center relative overflow-hidden shadow-inner">
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300%] h-[300%] bg-[conic-gradient(from_0deg,transparent_0_40deg,rgba(239,68,68,0.03)_40_80deg,transparent_80_120deg)] animate-spin-ultra-slow"></div>

                    <div className="relative z-10 flex flex-col items-center">
                        <div className="mb-10 relative">
                            <div className="absolute inset-0 bg-red-500/10 blur-3xl rounded-full"></div>
                            <div className="relative bg-gradient-to-tr from-red-600 to-orange-500 p-8 rounded-[3rem] shadow-2xl rotate-6 animate-bounce-slow">
                                <Coins size={70} className="text-white drop-shadow-2xl" />
                            </div>
                            <div className="absolute -bottom-2 -right-2 bg-white p-2 rounded-2xl shadow-lg border border-red-50">
                                <Check size={24} className="text-red-600" strokeWidth={4} />
                            </div>
                        </div>

                        <h2 className="text-5xl font-black text-slate-900 tracking-tighter mb-2 italic">NGON!</h2>
                        <p className="text-slate-400 text-[10px] mb-8 font-black uppercase tracking-[0.3em]">Ngày {rewardData.day} hoàn tất</p>

                        <div className="w-full bg-slate-50 rounded-[2.5rem] p-8 mb-10 flex flex-col items-center justify-center border border-slate-100">
                            <div className="flex items-center gap-2">
                                <span className="text-6xl font-black text-red-600 tracking-tighter">+{rewardData.amount}</span>
                                <span className="text-xl font-black text-red-400 mt-2">Xu</span>
                            </div>
                        </div>

                        <button 
                            onClick={() => {setShowRewardModal(false); setShowConfetti(false);}} 
                            className="w-full py-5 rounded-3xl bg-slate-900 text-white font-black text-xl hover:bg-red-600 transition-all shadow-xl active:scale-95 uppercase tracking-widest"
                        >
                            Đã Hiểu
                        </button>
                    </div>
                </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes box-shake {
            0%, 100% { transform: rotate(0deg) scale(1); }
            20% { transform: rotate(3deg) scale(1.05); }
            40% { transform: rotate(-3deg) scale(1.05); }
            60% { transform: rotate(3deg) scale(1.05); }
            80% { transform: rotate(-3deg) scale(1.05); }
        }
        
        @keyframes reward-reveal {
            0% { transform: translateY(20px) scale(0); opacity: 0; }
            50% { opacity: 1; }
            100% { transform: translateY(-80px) scale(2); opacity: 0; }
        }

        @keyframes confetti-fall {
            0% { transform: translateY(0) rotate(0) scale(1); opacity: 1; }
            100% { transform: translateY(100vh) rotate(720deg) scale(0.5); opacity: 0; }
        }

        @keyframes reward-popup {
            0% { transform: scale(0.8) translateY(100px) rotate(-5deg); opacity: 0; }
            100% { transform: scale(1) translateY(0) rotate(0deg); opacity: 1; }
        }

        @keyframes shine-fast {
            0% { transform: translateX(-150%) skewX(-25deg); }
            100% { transform: translateX(150%) skewX(-25deg); }
        }

        .animate-reward-reveal {
            animation: reward-reveal 1s cubic-bezier(0.17, 0.89, 0.32, 1.49) forwards;
        }

        .animate-reward-popup {
            animation: reward-popup 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
        }

        .animate-shine-fast {
            animation: shine-fast 0.9s ease-in-out;
        }

        .animate-box-shake {
            animation: box-shake 1s ease-in-out infinite;
        }

        .animate-spin-ultra-slow {
            animation: spin 60s linear infinite;
        }

        .animate-pulse-slow {
            animation: pulse 5s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
        
        .animate-bounce-slow {
            animation: bounce 3s infinite;
        }

        .perspective-1000 { perspective: 1000px; }
      `}</style>
    </div>
  );
}