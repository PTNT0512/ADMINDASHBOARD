import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Share2, Volume2, VolumeX, History, Play, Square } from 'lucide-react';

// --- Constants & Config ---
const GRAVITY = 0.25;
const BOUNCE_DAMPENING = 0.6;
const HORIZONTAL_RANDOMNESS = 0.5;
const AUTO_DROP_INTERVAL = 200; // ms between drops in auto mode

const COLORS = {
  bg: '#050505',
  pin: '#374151',
  ball: '#ef4444',
  ballSuper: '#3b82f6',
  ballHyper: '#a855f7',
  highMult: '#b91c1c',
  medMult: '#b45309',
  lowMult: '#15803d',
  gate: '#06b6d4',
  text: '#10b981'
};

const MULTIPLIER_VALUES = {
  low: {
    8: [5.6, 2.1, 1.1, 1, 0.5, 1, 1.1, 2.1, 5.6],
    12: [10, 3, 1.6, 1.4, 1.1, 1, 0.5, 1, 1.1, 1.4, 1.6, 3, 10],
    14: [12, 4, 2, 1.5, 1.2, 1.1, 1, 0.5, 1, 1.1, 1.2, 1.5, 2, 4, 12],
    16: [16, 9, 2, 1.4, 1.4, 1.2, 1.1, 1, 0.5, 1, 1.1, 1.2, 1.4, 1.4, 2, 9, 16]
  },
  medium: {
    8: [13, 3, 1.3, 0.7, 0.4, 0.7, 1.3, 3, 13],
    12: [33, 11, 4, 2, 1.1, 0.6, 0.3, 0.6, 1.1, 2, 4, 11, 33],
    14: [58, 15, 7, 4, 1.9, 1, 0.5, 0.2, 0.5, 1, 1.9, 4, 7, 15, 58],
    16: [110, 41, 10, 5, 3, 1.5, 1, 0.5, 0.3, 0.5, 1, 1.5, 3, 5, 10, 41, 110]
  },
  high: {
    8: [29, 4, 1.5, 0.3, 0.2, 0.3, 1.5, 4, 29],
    12: [170, 24, 8.1, 2, 0.7, 0.2, 0.2, 0.2, 0.7, 2, 8.1, 24, 170],
    14: [420, 56, 18, 5, 1.9, 0.3, 0.2, 0.2, 0.2, 0.3, 1.9, 5, 18, 56, 420],
    16: [1000, 130, 26, 9, 4, 2, 0.2, 0.2, 0.2, 0.2, 0.2, 2, 4, 9, 26, 130, 1000]
  }
};

export default function PlinkoTactical() {
  // --- React State ---
  const [balance, setBalance] = useState(10000);
  const [bet, setBet] = useState(10);
  const [risk, setRisk] = useState('medium');
  const [rowCount, setRowCount] = useState(14);
  const [logs, setLogs] = useState([]);
  const [fps, setFps] = useState(60);
  const [isMuted, setIsMuted] = useState(false);
  const [isAuto, setIsAuto] = useState(false); // Auto mode state

  // --- Game Engine Refs (Mutable, no re-render) ---
  const canvasRef = useRef(null);
  const requestRef = useRef(null);
  const audioCtxRef = useRef(null);
  const logIdCounter = useRef(0);
  
  // Game Objects & Physics State
  const gameState = useRef({
    width: 0,
    height: 0,
    balls: [],
    particles: [],
    pins: [],
    multipliers: [],
    gates: [],
    layoutGap: 20,
    layoutStartX: 0,
    layoutTotalW: 0,
    borderOffset: 10,
    pegSize: 2,
    ballSize: 5,
    lastTime: 0,
    // Auto drop vars
    autoEnabled: false,
    lastAutoDrop: 0,
    currentBalance: 10000, // Synced balance for physics loop
    currentBet: 10
  });

  // Sync React state to Mutable Refs for Game Loop
  useEffect(() => { gameState.current.currentBalance = balance; }, [balance]);
  useEffect(() => { gameState.current.currentBet = bet; }, [bet]);
  useEffect(() => { gameState.current.autoEnabled = isAuto; }, [isAuto]);

  // --- Audio System ---
  const initAudio = () => {
    if (!audioCtxRef.current) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      audioCtxRef.current = new AudioContext();
    }
    if (audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }
  };

  const playSound = useCallback((type) => {
    if (isMuted || !audioCtxRef.current) return;
    
    const ctx = audioCtxRef.current;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    const now = ctx.currentTime;

    if (type === 'hit') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(800, now);
      osc.frequency.exponentialRampToValueAtTime(100, now + 0.05);
      gain.gain.setValueAtTime(0.05, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
      osc.start(now);
      osc.stop(now + 0.05);
    } else if (type === 'score') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1200, now);
      gain.gain.setValueAtTime(0.05, now);
      gain.gain.linearRampToValueAtTime(0, now + 0.3);
      osc.start(now);
      osc.stop(now + 0.3);
    } else if (type === 'powerup') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(400, now);
      osc.frequency.linearRampToValueAtTime(800, now + 0.1);
      gain.gain.setValueAtTime(0.05, now);
      gain.gain.linearRampToValueAtTime(0, now + 0.1);
      osc.start(now);
      osc.stop(now + 0.1);
    }
  }, [isMuted]);

  // --- Game Logic ---

  const generateLayout = useCallback(() => {
    const state = gameState.current;
    if (!state.width || !state.height) return;

    const { width, height } = state;
    state.pins = [];
    state.multipliers = [];
    state.gates = [];

    // Auto-fit Layout Calculation
    const maxPinsInRow = rowCount + 3;
    const paddingX = 40;
    const paddingY = 120;
    const availW = width - paddingX;
    const availH = height - paddingY;

    const gapW = availW / maxPinsInRow;
    const gapH = availH / rowCount;

    let gap = Math.min(gapW, gapH);
    if (gap > 40) gap = 40;
    if (gap < 15) gap = 15;

    state.layoutGap = gap;
    state.borderOffset = Math.max(8, gap / 2);
    state.pegSize = Math.max(2, gap * 0.08);
    state.ballSize = Math.max(3, gap * 0.18);

    const totalPyramidHeight = rowCount * gap;
    const startY = 80 + (availH - totalPyramidHeight) / 4;

    // 1. Generate Pins
    for (let r = 0; r < rowCount; r++) {
      const pinsInRow = r + 3;
      const rowWidth = (pinsInRow - 1) * gap;
      const startX = (width - rowWidth) / 2;

      for (let c = 0; c < pinsInRow; c++) {
        state.pins.push({
          x: startX + c * gap,
          y: startY + r * gap,
          pulse: 0
        });
      }
    }

    // 2. Gates
    let gatesToAdd = 0;
    if (risk === 'medium') gatesToAdd = 1;
    if (risk === 'high') gatesToAdd = 2;

    if (gatesToAdd > 0 && rowCount > 6) {
      for (let i = 0; i < gatesToAdd; i++) {
        const r = Math.floor(Math.random() * (rowCount - 6)) + 3;
        const pinsInRow = r + 3;
        const c = Math.floor(Math.random() * (pinsInRow - 2)) + 1;

        const rowWidth = (pinsInRow - 1) * gap;
        const rowStartX = (width - rowWidth) / 2;
        const pinX = rowStartX + c * gap;

        const gateX = pinX + (gap / 2);
        const gateY = startY + r * gap + (gap / 2);
        const gw = gap * 0.8;
        const gh = gap * 0.4;

        state.gates.push({
          x: gateX - gw / 2,
          y: gateY - gh / 2,
          w: gw,
          h: gh,
          pulse: 0
        });
      }
    }

    // 3. Multipliers
    const mults = MULTIPLIER_VALUES[risk][rowCount] || MULTIPLIER_VALUES['medium'][14];
    const bucketCount = mults.length;
    const bucketW = gap;
    
    state.layoutTotalW = bucketCount * bucketW;
    state.layoutStartX = (width - state.layoutTotalW) / 2;

    for (let i = 0; i < bucketCount; i++) {
      let val = mults[i];
      let color = COLORS.lowMult;
      if (val >= 2) color = COLORS.medMult;
      if (val >= 10) color = COLORS.highMult;

      state.multipliers.push({
        x: state.layoutStartX + i * bucketW,
        y: height - 40,
        w: bucketW,
        h: 40,
        value: val,
        color: color,
        pulse: 0
      });
    }

  }, [risk, rowCount]);

  // Core drop logic reused by manual and auto
  const executeDrop = (betAmount) => {
    const state = gameState.current;
    const startX = state.width / 2 + (Math.random() * (state.layoutGap / 2) - (state.layoutGap / 4));
    
    state.balls.push({
      x: startX,
      y: 45,
      vx: (Math.random() - 0.5),
      vy: 0,
      radius: state.ballSize,
      betValue: betAmount,
      currentMult: 1,
      active: true,
      hitGates: [],
      trail: []
    });
  }

  const dropBallManual = () => {
    initAudio();
    if (balance < bet) return;
    setBalance(prev => prev - bet);
    executeDrop(bet);
  };

  const toggleAuto = () => {
    initAudio();
    setIsAuto(!isAuto);
  };

  const handleWin = (winAmount, multiplier, gateMult) => {
    setBalance(prev => prev + winAmount);
    
    logIdCounter.current += 1;
    const newLog = {
      id: `${Date.now()}-${logIdCounter.current}`, 
      mult: multiplier,
      win: winAmount,
      isGate: gateMult > 1,
      gateMult: gateMult
    };
    
    setLogs(prev => [newLog, ...prev].slice(0, 20));
  };

  // --- Physics & Render Loop ---

  const update = (time) => {
    const state = gameState.current;
    const { width, height, balls, pins, gates, multipliers, layoutStartX, layoutTotalW, layoutGap, borderOffset, pegSize } = state;

    // --- Auto Drop Logic ---
    if (state.autoEnabled) {
        if (time - state.lastAutoDrop > AUTO_DROP_INTERVAL) {
            if (state.currentBalance >= state.currentBet) {
                // Deduct balance locally for physics/logic immediately
                state.currentBalance -= state.currentBet;
                // Sync to React state
                setBalance(state.currentBalance);
                
                executeDrop(state.currentBet);
                state.lastAutoDrop = time;
            } else {
                // Not enough money, stop auto
                setIsAuto(false);
            }
        }
    }

    // Safety borders
    const borderL = layoutStartX - borderOffset;
    const borderR = layoutStartX + layoutTotalW + borderOffset;

    for (let i = balls.length - 1; i >= 0; i--) {
      let b = balls[i];
      
      // Physics
      b.vy += GRAVITY;
      b.x += b.vx;
      b.y += b.vy;
      b.vx *= 0.999;
      b.vy *= 0.999;

      // Trail logic
      if (balls.length < 20) {
        b.trail.push({ x: b.x, y: b.y });
        if (b.trail.length > 6) b.trail.shift();
      }

      // Border Collision
      if (b.x < borderL + b.radius) {
        b.x = borderL + b.radius;
        b.vx *= -0.5;
      }
      if (b.x > borderR - b.radius) {
        b.x = borderR - b.radius;
        b.vx *= -0.5;
      }

      // Gate Collision
      for (let k = 0; k < gates.length; k++) {
        let g = gates[k];
        if (b.x > g.x && b.x < g.x + g.w && b.y > g.y && b.y < g.y + g.h) {
          if (!b.hitGates.includes(k)) {
            b.hitGates.push(k);
            b.currentMult *= 2;
            playSound('powerup');
            g.pulse = 1.0;
            // Particles
            for(let p=0; p<5; p++) {
                state.particles.push({
                    x: b.x, y: b.y, 
                    vx: (Math.random()-0.5)*4, vy: (Math.random()-0.5)*4,
                    life: 1.0, color: COLORS.gate
                });
            }
          }
        }
      }

      // Pin Collision
      for (let p of pins) {
        if (Math.abs(b.x - p.x) > layoutGap / 1.5 || Math.abs(b.y - p.y) > layoutGap / 1.5) continue;

        let dx = b.x - p.x;
        let dy = b.y - p.y;
        let distSq = dx * dx + dy * dy;
        let minDist = b.radius + pegSize;

        if (distSq < minDist * minDist) {
          playSound('hit');
          p.pulse = 1.0;

          let angle = Math.atan2(dy, dx);
          let speed = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
          let randomAngle = (Math.random() - 0.5) * HORIZONTAL_RANDOMNESS;

          b.vx = Math.cos(angle + randomAngle) * speed * BOUNCE_DAMPENING;
          b.vy = Math.sin(angle + randomAngle) * speed * BOUNCE_DAMPENING;

          let overlap = minDist - Math.sqrt(distSq);
          b.x += Math.cos(angle) * overlap;
          b.y += Math.sin(angle) * overlap;
          
          if(state.particles.length < 50) {
              let pc = b.currentMult > 1 ? (b.currentMult > 2 ? COLORS.ballHyper : COLORS.ballSuper) : '#10b981';
              state.particles.push({
                  x: p.x, y: p.y, 
                  vx: (Math.random()-0.5)*4, vy: (Math.random()-0.5)*4,
                  life: 1.0, color: pc
              });
          }
        }
      }

      // Resolution
      if (b.y > height - 40) {
        b.active = false;
        const relativeX = b.x - layoutStartX;
        let index = Math.floor(relativeX / layoutGap);
        if (index < 0) index = 0;
        if (index >= multipliers.length) index = multipliers.length - 1;

        const m = multipliers[index];
        const totalMult = m.value * b.currentMult;
        const win = b.betValue * totalMult;

        handleWin(win, totalMult, b.currentMult);
        playSound('score');
        m.pulse = 1.0;
        
        for(let p=0; p<5; p++) {
            state.particles.push({
                x: b.x, y: height-20, 
                vx: (Math.random()-0.5)*4, vy: (Math.random()-0.5)*4,
                life: 1.0, color: m.color
            });
        }
        
        balls.splice(i, 1);
      }
    }
    
    // Update Particles
    for(let i = state.particles.length - 1; i >= 0; i--) {
        let p = state.particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life -= 0.05;
        if(p.life <= 0) state.particles.splice(i, 1);
    }
  };

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false });
    const state = gameState.current;
    const { width, height, balls, pins, multipliers, gates, layoutGap, layoutStartX, layoutTotalW, borderOffset, pegSize } = state;

    // Clear
    ctx.fillStyle = 'rgba(5, 5, 5, 0.4)'; // Trail effect
    ctx.fillRect(0, 0, width, height);

    // 1. Launcher
    const nozzleSize = layoutGap || 20;
    ctx.fillStyle = '#1f2937';
    ctx.beginPath();
    ctx.moveTo(width / 2 - nozzleSize / 1.5, 0);
    ctx.lineTo(width / 2 + nozzleSize / 1.5, 0);
    ctx.lineTo(width / 2 + nozzleSize / 2, 40);
    ctx.lineTo(width / 2 - nozzleSize / 2, 40);
    ctx.fill();
    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 1;
    ctx.stroke();

    // 2. Borders
    ctx.strokeStyle = 'rgba(16, 185, 129, 0.2)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    const drawL = layoutStartX - borderOffset;
    const drawR = layoutStartX + layoutTotalW + borderOffset;
    ctx.moveTo(drawL, height - 40);
    ctx.lineTo(drawL, 50);
    ctx.lineTo(drawL + 10, 50);
    ctx.moveTo(drawR, height - 40);
    ctx.lineTo(drawR, 50);
    ctx.lineTo(drawR - 10, 50);
    ctx.stroke();
    ctx.lineWidth = 1;

    // 3. Gates
    for (let g of gates) {
      ctx.save();
      ctx.shadowColor = COLORS.gate;
      ctx.shadowBlur = g.pulse > 0 ? 15 : 5;
      ctx.strokeStyle = COLORS.gate;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.rect(g.x, g.y, g.w, g.h);
      ctx.stroke();
      ctx.fillStyle = `rgba(6, 182, 212, ${0.1 + g.pulse * 0.4})`;
      ctx.fill();
      if (g.w > 12) {
        ctx.fillStyle = '#fff';
        ctx.font = `${Math.floor(g.h * 0.8)}px "Share Tech Mono"`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText("x2", g.x + g.w / 2, g.y + g.h / 2);
      }
      if (g.pulse > 0) g.pulse -= 0.05;
      ctx.restore();
    }

    // 4. Pins
    for (let p of pins) {
      if (p.pulse <= 0) {
        ctx.fillStyle = COLORS.pin;
        ctx.beginPath();
        ctx.arc(p.x, p.y, pegSize, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = `rgba(16, 185, 129, ${p.pulse})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, pegSize + 1, 0, Math.PI * 2);
        ctx.fill();
        p.pulse -= 0.1;
      }
    }

    // 5. Multipliers
    for (let m of multipliers) {
      ctx.fillStyle = m.color;
      if (m.pulse > 0) {
        ctx.globalAlpha = 0.8;
        m.pulse -= 0.05;
      } else {
        ctx.globalAlpha = 0.3;
      }
      ctx.fillRect(m.x + 0.5, m.y, m.w - 1, m.h);
      
      if (balls.length < 50) {
          ctx.globalAlpha = 1;
          ctx.fillStyle = '#fff';
          const fontSize = Math.min(9, Math.floor(m.w * 0.4));
          ctx.font = `bold ${fontSize}px "Share Tech Mono"`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(m.value + 'x', m.x + m.w / 2, m.y + m.h / 2);
      }
    }

    // 6. Balls
    for (let b of balls) {
        let mainColor = COLORS.ball;
        if (b.betValue <= 50) mainColor = '#facc15';
        if (b.currentMult >= 2) mainColor = COLORS.ballSuper;
        if (b.currentMult >= 4) mainColor = COLORS.ballHyper;

        if (balls.length < 20) {
            ctx.beginPath();
            for (let i = 0; i < b.trail.length; i++) {
                ctx.globalAlpha = (i / b.trail.length) * 0.4;
                ctx.fillStyle = mainColor;
                ctx.arc(b.trail[i].x, b.trail[i].y, b.radius * (i / b.trail.length), 0, Math.PI * 2);
                ctx.fill();
            }
        }
        
        ctx.globalAlpha = 1;
        ctx.beginPath();
        ctx.fillStyle = '#fff';
        ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
        ctx.fill();
        
        if(b.currentMult >= 2) {
             ctx.shadowBlur = 10;
             ctx.shadowColor = mainColor;
             ctx.strokeStyle = mainColor;
             ctx.stroke();
             ctx.shadowBlur = 0;
        }
    }
    
    // 7. Particles
    for(let p of state.particles) {
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x, p.y, 2, 2);
    }
    ctx.globalAlpha = 1;
  };

  const animate = (time) => {
    update(time);
    draw();
    
    const dt = time - gameState.current.lastTime;
    if(dt > 0) {
        const currentFps = Math.round(1000/dt);
        if(time % 10 === 0) setFps(currentFps); 
    }
    gameState.current.lastTime = time;

    requestRef.current = requestAnimationFrame(animate);
  };

  useEffect(() => {
    const handleResize = () => {
      const container = canvasRef.current?.parentElement;
      if (container) {
        const dpr = window.devicePixelRatio || 1;
        canvasRef.current.width = Math.floor(container.clientWidth * dpr);
        canvasRef.current.height = Math.floor(container.clientHeight * dpr);
        canvasRef.current.style.width = `${container.clientWidth}px`;
        canvasRef.current.style.height = `${container.clientHeight}px`;
        
        const ctx = canvasRef.current.getContext('2d');
        ctx.scale(dpr, dpr);

        gameState.current.width = container.clientWidth;
        gameState.current.height = container.clientHeight;
        generateLayout();
      }
    };

    window.addEventListener('resize', handleResize);
    handleResize(); 

    requestRef.current = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(requestRef.current);
    };
  }, [generateLayout]);

  // --- UI Components ---
  return (
    <div className="flex flex-col w-full h-screen bg-[#050505] text-[#e0f2fe] font-mono overflow-hidden select-none touch-none">
        <style>{`
            @import url('https://fonts.googleapis.com/css2?family=Share+Tech+Mono&display=swap');
            body { font-family: 'Share Tech Mono', monospace; }
            .scanline {
                background: linear-gradient(0deg, rgba(0,0,0,0) 0%, rgba(16, 185, 129, 0.1) 50%, rgba(0,0,0,0) 100%);
                animation: scanline 10s linear infinite;
            }
            @keyframes scanline { 0% { bottom: 100%; } 100% { bottom: -100px; } }
            .glow-text { text-shadow: 0 0 5px rgba(16, 185, 129, 0.7); }
            /* Custom Scrollbar */
            ::-webkit-scrollbar { width: 4px; }
            ::-webkit-scrollbar-track { background: #0f172a; }
            ::-webkit-scrollbar-thumb { background: #10b981; border-radius: 4px; }
        `}</style>
        
        {/* Overlay Effects */}
        <div className="absolute inset-0 z-10 pointer-events-none scanline w-full h-[100px] bottom-full opacity-10"></div>
        <div className="absolute inset-0 z-20 pointer-events-none bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0IiBoZWlnaHQ9IjQiPgo8cmVjdCB3aWR0aD0iNCIgaGVpZ2h0PSI0IiBmaWxsPSIjMDAwIiBmaWxsLW9wYWNpdHk9IjAuMSIvPgo8L3N2Zz4=')] opacity-20"></div>

        <div className="flex flex-1 flex-col-reverse md:flex-row h-full z-30 p-2 gap-2">
            
            {/* Control Panel */}
            <div className="w-full md:w-80 flex flex-col gap-2 bg-slate-900/90 p-3 border border-slate-800 shadow-[0_0_10px_rgba(16,185,129,0.1)] backdrop-blur-md shrink-0 relative">
                 {/* Corners */}
                 <div className="absolute top-[-1px] left-[-1px] w-2 h-2 border-t-2 border-l-2 border-emerald-500"></div>
                 <div className="absolute top-[-1px] right-[-1px] w-2 h-2 border-t-2 border-r-2 border-emerald-500"></div>
                 <div className="absolute bottom-[-1px] left-[-1px] w-2 h-2 border-b-2 border-l-2 border-emerald-500"></div>
                 <div className="absolute bottom-[-1px] right-[-1px] w-2 h-2 border-b-2 border-r-2 border-emerald-500"></div>

                <div className="flex justify-between items-center mb-1 border-b border-emerald-900/50 pb-1">
                    <h1 className="text-lg md:text-xl font-bold text-emerald-400 glow-text">/// TACTICAL OPS</h1>
                    <button onClick={() => setIsMuted(!isMuted)} className="text-emerald-500 hover:text-emerald-300">
                        {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
                    </button>
                </div>

                <div className="flex justify-between items-center bg-black/40 p-2 border border-emerald-900/50 mb-1">
                    <div className="text-[10px] text-slate-400">TÀI KHOẢN</div>
                    <div className="text-lg text-emerald-400 font-bold">{balance.toLocaleString('en-US', { minimumFractionDigits: 2 })} $</div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-1 gap-2 md:gap-4">
                    <div className="col-span-2 md:col-span-1">
                        <label className="text-[10px] text-slate-400 block mb-1">MỨC CƯỢC</label>
                        <div className="flex gap-1 h-10">
                            <input 
                                type="number" 
                                value={bet} 
                                onChange={(e) => setBet(Math.max(1, parseFloat(e.target.value) || 0))}
                                className="flex-1 bg-black/60 border border-emerald-800 text-white px-2 text-right focus:outline-none focus:border-emerald-500 text-sm"
                            />
                            <button onClick={() => setBet(Math.max(1, Math.floor(bet/2)))} className="w-12 bg-slate-800 border border-emerald-900 active:bg-emerald-900 text-xs font-bold hover:bg-slate-700">1/2</button>
                            <button onClick={() => setBet(bet * 2)} className="w-12 bg-slate-800 border border-emerald-900 active:bg-emerald-900 text-xs font-bold hover:bg-slate-700">x2</button>
                        </div>
                    </div>

                    <div>
                        <label className="text-[10px] text-slate-400 block mb-1">RỦI RO</label>
                        <select 
                            value={risk} 
                            onChange={(e) => setRisk(e.target.value)}
                            className="w-full h-10 bg-black/60 border border-emerald-800 text-white px-2 text-sm focus:outline-none focus:border-emerald-500"
                        >
                            <option value="low">THẤP (0 Cổng)</option>
                            <option value="medium">TRUNG BÌNH (1 Cổng)</option>
                            <option value="high">CAO (2 Cổng)</option>
                        </select>
                    </div>

                    <div>
                        <label className="text-[10px] text-slate-400 block mb-1">SỐ DÒNG: <span className="text-emerald-400">{rowCount}</span></label>
                        <div className="h-10 flex items-center bg-black/60 border border-emerald-800 px-2">
                            <input 
                                type="range" 
                                min="8" max="16" 
                                value={rowCount} 
                                onChange={(e) => setRowCount(parseInt(e.target.value))}
                                className="w-full accent-emerald-500 h-1 bg-slate-700 appearance-none cursor-pointer"
                            />
                        </div>
                    </div>
                </div>

                {/* Combined Action Buttons */}
                <div className="flex gap-1 mt-1 h-14">
                    <button 
                        onClick={dropBallManual}
                        disabled={isAuto}
                        className={`relative overflow-hidden transition-all flex-grow font-bold text-lg md:text-xl shadow-[0_0_15px_rgba(16,185,129,0.3)] active:scale-[0.98] clip-path-polygon ${isAuto ? 'bg-slate-800 text-slate-500' : 'bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-400 text-black'}`}
                        style={{ clipPath: 'polygon(5px 0, 100% 0, 100% calc(100% - 5px), calc(100% - 5px) 100%, 0 100%, 0 5px)' }}
                    >
                        TRIỂN KHAI
                    </button>
                    
                    <button 
                        onClick={toggleAuto}
                        className={`w-24 relative overflow-hidden transition-all font-bold text-sm shadow-[0_0_15px_rgba(16,185,129,0.3)] active:scale-[0.98] clip-path-polygon flex flex-col items-center justify-center ${isAuto ? 'bg-red-600 hover:bg-red-500 text-white animate-pulse' : 'bg-slate-800 hover:bg-slate-700 text-emerald-500 border border-emerald-900'}`}
                        style={{ clipPath: 'polygon(5px 0, 100% 0, 100% calc(100% - 5px), calc(100% - 5px) 100%, 0 100%, 0 5px)' }}
                    >
                        {isAuto ? <Square size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}
                        <span>{isAuto ? "DỪNG" : "AUTO"}</span>
                    </button>
                </div>

                <div className="hidden md:flex mt-auto h-32 flex-col overflow-hidden">
                    <div className="text-[10px] text-slate-500 mb-1 border-b border-slate-800 flex items-center gap-1">
                        <History size={10} /> NHẬT KÝ TÁC CHIẾN
                    </div>
                    <div className="overflow-y-auto flex-1 flex flex-col gap-1 text-[10px] font-mono scrollbar-thin">
                        {logs.map(log => (
                            <div key={log.id} className={`flex justify-between border-b border-slate-900 py-1 ${log.gateMult > 1 ? 'text-cyan-400 font-bold' : (log.mult >= 10 ? 'text-red-500 font-bold' : (log.win >= bet ? 'text-emerald-400' : 'text-slate-500'))}`}>
                                <span>{log.gateMult > 1 ? `[x${log.gateMult}] ` : ''}{log.mult}x</span>
                                <span>+{log.win.toFixed(2)}$</span>
                            </div>
                        ))}
                    </div>
                </div>
                
                {/* Mobile Last Result */}
                <div className="md:hidden flex justify-between text-[10px] text-slate-500 border-t border-slate-800 pt-1 mt-1">
                    <span>KẾT QUẢ:</span>
                    {logs.length > 0 ? (
                        <span className={logs[0].gateMult > 1 ? 'text-cyan-400 font-bold' : (logs[0].mult >= 10 ? 'text-red-500' : (logs[0].win >= bet ? 'text-emerald-400' : 'text-slate-500'))}>
                            {logs[0].gateMult > 1 ? `[x${logs[0].gateMult}] ` : ''}{logs[0].mult}x (+{logs[0].win.toFixed(0)}$)
                        </span>
                    ) : <span>--</span>}
                </div>
            </div>

            {/* Game Canvas Area */}
            <div className="flex-1 bg-black relative border border-slate-800 shadow-[0_0_10px_rgba(16,185,129,0.1)] overflow-hidden flex items-center justify-center min-h-0">
                 {/* Corners */}
                 <div className="absolute top-[-1px] left-[-1px] w-2 h-2 border-t-2 border-l-2 border-emerald-500 z-20"></div>
                 <div className="absolute top-[-1px] right-[-1px] w-2 h-2 border-t-2 border-r-2 border-emerald-500 z-20"></div>
                 <div className="absolute bottom-[-1px] left-[-1px] w-2 h-2 border-b-2 border-l-2 border-emerald-500 z-20"></div>
                 <div className="absolute bottom-[-1px] right-[-1px] w-2 h-2 border-b-2 border-r-2 border-emerald-500 z-20"></div>

                <div className="absolute inset-0 opacity-30" style={{ backgroundImage: 'radial-gradient(#1f2937 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>
                
                <canvas ref={canvasRef} className="relative z-10 block w-full h-full"></canvas>
                
                <div className="absolute top-2 right-2 text-right pointer-events-none opacity-50 z-20">
                    <div className="text-[8px] md:text-[10px] text-emerald-500">SYS.STATUS: ONLINE</div>
                    <div className="text-[8px] md:text-[10px] text-emerald-500">FPS: {fps}</div>
                </div>
            </div>
        </div>
    </div>
  );
}