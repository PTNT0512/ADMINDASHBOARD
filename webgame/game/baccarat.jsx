import React, { useEffect, useRef, useState } from 'react';
import { Clock, Coins, History, Star, User } from 'lucide-react';
import { io } from 'socket.io-client';
import { bootstrapGameAuth } from './authBootstrap';

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
  { symbol: '♦', color: 'red' },
];

const CARD_LABEL_BY_POINT = {
  0: ['10', 'J', 'Q', 'K'],
  1: ['A'],
  2: ['2'],
  3: ['3'],
  4: ['4'],
  5: ['5'],
  6: ['6'],
  7: ['7'],
  8: ['8'],
  9: ['9'],
};

const OUTCOMES = ['PLAYER', 'BANKER', 'TIE'];
const SESSION_TIME = 15;
const RESULT_HOLD_MS = 4800;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

const normalizeOutcome = (value) => {
  const raw = String(value || '').toUpperCase();
  if (OUTCOMES.includes(raw)) return raw;
  return OUTCOMES[randInt(0, OUTCOMES.length - 1)];
};

const getCardValue = (card) => {
  if (!card || !card.val) return 0;
  if (['10', 'J', 'Q', 'K'].includes(card.val)) return 0;
  if (card.val === 'A') return 1;
  const parsed = Number(card.val);
  return Number.isFinite(parsed) ? parsed : 0;
};

const calculateScore = (cards = []) => {
  const total = cards.reduce((sum, card) => sum + getCardValue(card), 0);
  return total % 10;
};

const createCardFromPoint = (point) => {
  const suit = SUITS[randInt(0, SUITS.length - 1)];
  const labels = CARD_LABEL_BY_POINT[Math.max(0, Math.min(9, point))] || ['K'];
  const val = labels[randInt(0, labels.length - 1)];
  return { suit: suit.symbol, val, color: suit.color };
};

const buildHandForScore = (score) => {
  const firstPoint = randInt(0, 9);
  const secondPoint = (score - firstPoint + 10) % 10;
  return [createCardFromPoint(firstPoint), createCardFromPoint(secondPoint)];
};

const pickScorePairByOutcome = (outcome) => {
  if (outcome === 'TIE') {
    const score = randInt(0, 9);
    return { playerScore: score, bankerScore: score };
  }

  if (outcome === 'PLAYER') {
    const bankerScore = randInt(0, 8);
    const playerScore = randInt(bankerScore + 1, 9);
    return { playerScore, bankerScore };
  }

  const playerScore = randInt(0, 8);
  const bankerScore = randInt(playerScore + 1, 9);
  return { playerScore, bankerScore };
};

const buildHandsByOutcome = (outcome) => {
  const pair = pickScorePairByOutcome(outcome);
  return {
    playerCards: buildHandForScore(pair.playerScore),
    bankerCards: buildHandForScore(pair.bankerScore),
    playerScore: pair.playerScore,
    bankerScore: pair.bankerScore,
  };
};

const Card = ({ card, isFlipped, index, isDealing }) => {
  const [arrived, setArrived] = useState(false);

  useEffect(() => {
    if (!card) {
      setArrived(false);
      return undefined;
    }
    if (!isDealing) {
      setArrived(true);
      return undefined;
    }
    const timer = setTimeout(() => setArrived(true), index * 130);
    return () => clearTimeout(timer);
  }, [card, isDealing, index]);

  if (!card) return null;
  const textColor = card.color === 'red' ? 'text-red-600' : 'text-slate-900';

  return (
    <div
      className={`relative w-12 h-16 flex-shrink-0 ${index > 0 ? '-ml-3' : ''}`}
      style={{
        transform: arrived ? 'translateY(0)' : 'translateY(12px)',
        opacity: arrived ? 1 : 0,
        transition: 'transform 280ms ease, opacity 280ms ease',
      }}
    >
      <div className={`relative w-full h-full duration-500 preserve-3d ${isFlipped ? 'rotate-y-180' : ''}`}>
        <div className="absolute inset-0 backface-hidden rounded-md border border-yellow-500/30 bg-[#171717] shadow-lg flex items-center justify-center">
          <Star size={14} className="text-yellow-500/40" />
        </div>
        <div className="absolute inset-0 backface-hidden rotate-y-180 rounded-md bg-white border border-slate-200 shadow-lg text-black overflow-hidden p-1">
          <div className={`absolute top-1 left-1 flex flex-col items-center leading-none ${textColor}`}>
            <span className="text-[10px] font-black">{card.val}</span>
            <span className="text-[8px] -mt-0.5">{card.suit}</span>
          </div>
          <div className="absolute inset-0 flex items-center justify-center pt-1">
            <span className={`text-xl ${textColor}`}>{card.suit}</span>
          </div>
          <div className={`absolute bottom-1 right-1 flex flex-col items-center leading-none rotate-180 ${textColor}`}>
            <span className="text-[10px] font-black">{card.val}</span>
            <span className="text-[8px] -mt-0.5">{card.suit}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default function Baccarat() {
  const [balance, setBalance] = useState(100000000);
  const [roundId, setRoundId] = useState(1);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [selectedChip, setSelectedChip] = useState(100000);
  const [bets, setBets] = useState({ PLAYER: 0, BANKER: 0, TIE: 0 });
  const [gameStatus, setGameStatus] = useState('IDLE');
  const [winner, setWinner] = useState(null);
  const [winAmount, setWinAmount] = useState(0);
  const [hands, setHands] = useState({ player: [], banker: [] });
  const [resultScore, setResultScore] = useState({ player: 0, banker: 0 });
  const [history, setHistory] = useState(['PLAYER', 'BANKER', 'PLAYER', 'PLAYER', 'TIE', 'BANKER', 'BANKER', 'PLAYER']);
  const [message, setMessage] = useState('MOI DAT CUOC');
  const [revealed, setRevealed] = useState({ player: false, banker: false });
  const [isDealing, setIsDealing] = useState(false);
  const [timeLeft, setTimeLeft] = useState(SESSION_TIME);

  const countdownRef = useRef(null);
  const autoResetRef = useRef(null);
  const handledResultSessionRef = useRef(0);
  const animationFlowRef = useRef(0);
  const betsRef = useRef(bets);

  useEffect(() => {
    bootstrapGameAuth({ onBalance: setBalance }).catch((error) => {
      console.error('Game auth bootstrap failed:', error);
    });
  }, []);

  useEffect(() => {
    betsRef.current = bets;
  }, [bets]);

  const clearCountdown = () => {
    if (!countdownRef.current) return;
    clearInterval(countdownRef.current);
    countdownRef.current = null;
  };

  const clearAutoReset = () => {
    if (!autoResetRef.current) return;
    clearTimeout(autoResetRef.current);
    autoResetRef.current = null;
  };

  const invalidateCurrentAnimation = () => {
    animationFlowRef.current += 1;
  };

  const resetForBettingPhase = (seconds = SESSION_TIME) => {
    invalidateCurrentAnimation();
    clearAutoReset();
    setGameStatus('IDLE');
    setTimeLeft(Number(seconds || SESSION_TIME));
    setMessage('MOI DAT CUOC');
    setHands({ player: [], banker: [] });
    setRevealed({ player: false, banker: false });
    setIsDealing(false);
    setWinner(null);
    setWinAmount(0);
    setResultScore({ player: 0, banker: 0 });
    setBets({ PLAYER: 0, BANKER: 0, TIE: 0 });
  };

  const finalizeRound = (outcome, playerScore, bankerScore) => {
    const result = normalizeOutcome(outcome);
    const safePlayer = Number(playerScore) || 0;
    const safeBanker = Number(bankerScore) || 0;

    setWinner(result);
    setResultScore({ player: safePlayer, banker: safeBanker });
    setHistory((prev) => [...prev, result].slice(-60));

    let win = 0;
    if (result === 'PLAYER') win = betsRef.current.PLAYER * 2;
    if (result === 'BANKER') win = betsRef.current.BANKER * 1.95;
    if (result === 'TIE') win = betsRef.current.TIE * 9;
    setWinAmount(win);

    if (win > 0) {
      setBalance((current) => current + win);
      setMessage(`THANG +${Math.floor(win).toLocaleString()} VND`);
    } else if (result === 'TIE') {
      setMessage('HOA');
    } else {
      setMessage(`${result} THANG`);
    }

    setGameStatus('RESULT');
    clearAutoReset();
    autoResetRef.current = setTimeout(() => {
      setBets({ PLAYER: 0, BANKER: 0, TIE: 0 });
      setGameStatus('IDLE');
      setMessage('MOI DAT CUOC');
      setIsDealing(false);
    }, RESULT_HOLD_MS);
  };

  const runDealAnimation = async (forcedOutcome = null) => {
    const flowId = animationFlowRef.current + 1;
    animationFlowRef.current = flowId;

    const isFlowActive = () => animationFlowRef.current === flowId;
    const guardedSleep = async (ms) => {
      await sleep(ms);
      return isFlowActive();
    };

    clearAutoReset();
    setGameStatus('DEALING');
    setIsDealing(false);
    setWinner(null);
    setWinAmount(0);
    setMessage('BAT DAU CHIA BAI...');
    setHands({ player: [], banker: [] });
    setRevealed({ player: false, banker: false });
    setResultScore({ player: 0, banker: 0 });

    if (!(await guardedSleep(240))) return;

    const outcome = normalizeOutcome(forcedOutcome || OUTCOMES[randInt(0, OUTCOMES.length - 1)]);
    const round = buildHandsByOutcome(outcome);
    const p1 = round.playerCards[0];
    const p2 = round.playerCards[1];
    const b1 = round.bankerCards[0];
    const b2 = round.bankerCards[1];

    setIsDealing(true);
    setHands({ player: [p1], banker: [] });
    if (!(await guardedSleep(260))) return;

    setHands({ player: [p1], banker: [b1] });
    if (!(await guardedSleep(260))) return;

    setHands({ player: [p1, p2], banker: [b1] });
    if (!(await guardedSleep(260))) return;

    setHands({ player: [p1, p2], banker: [b1, b2] });
    if (!(await guardedSleep(360))) return;

    setMessage('PLAYER LAT BAI...');
    setRevealed((prev) => ({ ...prev, player: true }));
    if (!(await guardedSleep(460))) return;

    setMessage('BANKER LAT BAI...');
    setRevealed((prev) => ({ ...prev, banker: true }));
    if (!(await guardedSleep(520))) return;

    setIsDealing(false);
    finalizeRound(outcome, round.playerScore, round.bankerScore);
  };

  useEffect(() => {
    if (!isDemoMode || gameStatus !== 'IDLE') {
      clearCountdown();
      return undefined;
    }

    clearCountdown();
    countdownRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearCountdown();
          runDealAnimation();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearCountdown();
  }, [gameStatus, isDemoMode]);

  useEffect(() => {
    const socket = io('http://localhost:4001', { transports: ['websocket'] });

    socket.on('connect', () => {
      setIsDemoMode(false);
    });

    socket.on('connect_error', () => {
      setIsDemoMode(true);
    });

    socket.on('baccarat_update', (data = {}) => {
      const sessionId = Number(data.sessionId || 0);
      if (sessionId > 0) setRoundId(sessionId);

      if (data.phase === 'BETTING') {
        if (sessionId > 0) handledResultSessionRef.current = 0;
        resetForBettingPhase(Number(data.timeLeft || SESSION_TIME));
        return;
      }

      if (data.phase === 'RESULT') {
        if (sessionId > 0 && handledResultSessionRef.current === sessionId) return;
        if (sessionId > 0) handledResultSessionRef.current = sessionId;
        setTimeLeft(0);
        runDealAnimation(normalizeOutcome(data.result));
      }
    });

    return () => {
      clearCountdown();
      clearAutoReset();
      invalidateCurrentAnimation();
      socket.disconnect();
    };
  }, []);

  const handleBet = (type) => {
    if (gameStatus !== 'IDLE' || timeLeft <= 0) return;
    if (balance < selectedChip) return;
    setBalance((current) => current - selectedChip);
    setBets((prev) => ({ ...prev, [type]: prev[type] + selectedChip }));
  };

  const playerTableScore = revealed.player ? calculateScore(hands.player) : '?';
  const bankerTableScore = revealed.banker ? calculateScore(hands.banker) : '?';

  return (
    <div className="min-h-[100dvh] w-full bg-[#020617]">
      <style>{`
        .preserve-3d { transform-style: preserve-3d; }
        .backface-hidden { backface-visibility: hidden; }
        .rotate-y-180 { transform: rotateY(180deg); }
        .no-scrollbar::-webkit-scrollbar { display: none; }
      `}</style>

      <div className="mx-auto w-full max-w-md min-h-[100dvh] bg-[#05070a] text-slate-100 font-sans select-none flex flex-col">
        <header
          className="sticky top-0 z-30 px-4 pb-3 flex justify-between items-center bg-[#0f172a]/95 backdrop-blur-md border-b border-white/5"
          style={{ paddingTop: 'max(12px, env(safe-area-inset-top))' }}
        >
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-amber-500 rounded-full flex items-center justify-center">
              <User size={15} className="text-amber-950" />
            </div>
            <div className="flex flex-col">
              <span className="text-[9px] text-slate-400 font-bold uppercase">So du kha dung</span>
              <span className="text-sm font-black text-amber-400 tracking-tight leading-none">{balance.toLocaleString()}</span>
            </div>
          </div>
          <div className="px-2.5 py-1 bg-white/5 rounded-md border border-white/10">
            <span className="text-[10px] font-mono text-slate-300"># {roundId}</span>
          </div>
        </header>

        <div className="px-4 py-2 bg-slate-900/30 border-b border-white/5 flex justify-between items-center">
          <div className="flex items-center gap-1.5">
            <Clock size={11} className={timeLeft <= 5 && gameStatus === 'IDLE' ? 'text-red-500 animate-pulse' : 'text-slate-500'} />
            <span className={`text-[10px] font-bold ${timeLeft <= 5 && gameStatus === 'IDLE' ? 'text-red-500' : 'text-slate-400'}`}>
              {gameStatus === 'IDLE' ? `${timeLeft}s` : 'DANG XU LY'}
            </span>
          </div>
          <div className="text-[10px] font-black text-amber-400 tracking-wider uppercase">{message}</div>
        </div>

        <main className="flex-1 overflow-y-auto no-scrollbar p-3 space-y-3">
          <section className="relative bg-slate-900/50 rounded-2xl p-4 border border-white/5 shadow-inner min-h-[220px] overflow-hidden">
            {gameStatus === 'RESULT' && winner && (
              <div className="absolute inset-0 z-20 bg-black/45 backdrop-blur-[2px] flex items-center justify-center">
                <div className="w-full text-center py-5 bg-gradient-to-r from-transparent via-black/85 to-transparent border-y border-white/10">
                  <div className="text-xs font-black tracking-[0.35em] text-slate-200 mb-2">{winner}</div>
                  <div className="text-4xl font-black text-white tracking-tight">
                    {resultScore.player} - {resultScore.banker}
                  </div>
                  {winAmount > 0 && (
                    <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/20 border border-amber-500/40 rounded-full">
                      <Coins size={12} className="text-amber-300" />
                      <span className="text-xs font-black text-amber-300">+{Math.floor(winAmount).toLocaleString()} VND</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="relative z-10 grid grid-cols-2 gap-4">
              <div className="flex flex-col items-center gap-2">
                <div className="text-[10px] font-black text-blue-400 uppercase tracking-widest">PLAYER</div>
                <div className="h-20 w-full rounded-lg bg-black/20 border border-white/5 flex items-center justify-center">
                  {hands.player.length === 0 ? (
                    <span className="text-xs text-slate-500 font-semibold">Dang cho chia bai</span>
                  ) : (
                    <div className="flex items-center justify-center">
                      {hands.player.map((card, index) => (
                        <Card key={`player-${index}`} card={card} isFlipped={revealed.player} index={index} isDealing={isDealing} />
                      ))}
                    </div>
                  )}
                </div>
                <div className="px-2 py-0.5 rounded bg-blue-500/15 border border-blue-500/30 text-xs font-black text-blue-300">
                  {playerTableScore}
                </div>
              </div>

              <div className="flex flex-col items-center gap-2">
                <div className="text-[10px] font-black text-red-400 uppercase tracking-widest">BANKER</div>
                <div className="h-20 w-full rounded-lg bg-black/20 border border-white/5 flex items-center justify-center">
                  {hands.banker.length === 0 ? (
                    <span className="text-xs text-slate-500 font-semibold">Dang cho chia bai</span>
                  ) : (
                    <div className="flex items-center justify-center">
                      {hands.banker.map((card, index) => (
                        <Card key={`banker-${index}`} card={card} isFlipped={revealed.banker} index={index} isDealing={isDealing} />
                      ))}
                    </div>
                  )}
                </div>
                <div className="px-2 py-0.5 rounded bg-red-500/15 border border-red-500/30 text-xs font-black text-red-300">
                  {bankerTableScore}
                </div>
              </div>
            </div>
          </section>

          <section className="grid grid-cols-12 gap-2">
            <button
              onClick={() => handleBet('PLAYER')}
              className={`col-span-5 rounded-xl border px-2 py-3 transition-all active:scale-[0.98] ${
                winner === 'PLAYER'
                  ? 'border-blue-400/80 bg-blue-500/15 shadow-[0_0_0_1px_rgba(96,165,250,0.35)]'
                  : 'border-white/10 bg-blue-500/10'
              }`}
            >
              <div className="text-sm font-black text-blue-300">PLAYER</div>
              <div className="text-[11px] text-slate-300 mt-1">{bets.PLAYER.toLocaleString()} VND</div>
            </button>

            <button
              onClick={() => handleBet('TIE')}
              className={`col-span-2 rounded-xl border px-1 py-3 transition-all active:scale-[0.98] ${
                winner === 'TIE'
                  ? 'border-emerald-400/80 bg-emerald-500/15 shadow-[0_0_0_1px_rgba(52,211,153,0.35)]'
                  : 'border-white/10 bg-emerald-500/10'
              }`}
            >
              <div className="text-xs font-black text-emerald-300">TIE</div>
              <div className="text-[10px] text-slate-300 mt-1">{bets.TIE.toLocaleString()}</div>
            </button>

            <button
              onClick={() => handleBet('BANKER')}
              className={`col-span-5 rounded-xl border px-2 py-3 transition-all active:scale-[0.98] ${
                winner === 'BANKER'
                  ? 'border-red-400/80 bg-red-500/15 shadow-[0_0_0_1px_rgba(248,113,113,0.35)]'
                  : 'border-white/10 bg-red-500/10'
              }`}
            >
              <div className="text-sm font-black text-red-300">BANKER</div>
              <div className="text-[11px] text-slate-300 mt-1">{bets.BANKER.toLocaleString()} VND</div>
            </button>
          </section>

          <section className="bg-black/35 rounded-xl p-3 border border-white/5">
            <div className="flex justify-between items-center mb-2">
              <span className="text-[10px] font-black text-slate-300 uppercase tracking-wider flex items-center gap-1">
                <History size={10} /> Road Map
              </span>
              <div className="flex gap-2 text-[10px] font-bold">
                <span className="text-red-400">B: {history.filter((v) => v === 'BANKER').length}</span>
                <span className="text-blue-400">P: {history.filter((v) => v === 'PLAYER').length}</span>
                <span className="text-emerald-400">T: {history.filter((v) => v === 'TIE').length}</span>
              </div>
            </div>

            <div className="grid grid-flow-col auto-cols-[12px] gap-1 overflow-x-auto no-scrollbar bg-white/[0.03] p-2 rounded-md">
              {history.slice(-30).map((item, index) => (
                <div
                  key={`${item}-${index}`}
                  className={`w-3 h-3 rounded-full ${
                    item === 'PLAYER' ? 'bg-blue-500' : item === 'BANKER' ? 'bg-red-500' : 'bg-emerald-500'
                  }`}
                ></div>
              ))}
            </div>
          </section>
        </main>

        <footer
          className="border-t border-white/5 bg-slate-900/80 px-3 pt-3"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 12px)' }}
        >
          <div className="grid grid-cols-6 gap-2">
            {CHIPS.map((chip) => (
              <button
                key={chip.value}
                onClick={() => setSelectedChip(chip.value)}
                className={`h-11 rounded-xl border text-[11px] font-black transition-all ${
                  selectedChip === chip.value
                    ? 'border-amber-400 text-amber-300 bg-amber-500/10 shadow-[0_0_0_1px_rgba(251,191,36,0.35)]'
                    : 'border-white/10 text-slate-300 bg-white/[0.03]'
                }`}
                style={{
                  backgroundImage: selectedChip === chip.value
                    ? `radial-gradient(circle at 30% 20%, ${chip.color}55, transparent 60%)`
                    : undefined,
                }}
              >
                {chip.label}
              </button>
            ))}
          </div>
        </footer>
      </div>
    </div>
  );
}
