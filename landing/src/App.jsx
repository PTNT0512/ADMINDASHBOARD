import React, { useState, useEffect, useRef } from 'react';
import { MessageSquare, Gift, Headset, CheckCircle, Send } from 'lucide-react';

const App = () => {
  const [messages, setMessages] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const chatBoxRef = useRef(null);
  const canvasRef = useRef(null);

  // Fetch landing settings from API
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        // Try to get from Electron IPC first
        if (window.require) {
          const { ipcRenderer } = window.require('electron');
          const result = await ipcRenderer.invoke('get-landing-settings');
          if (result.success && result.data) {
            setSettings(result.data);
            setLoading(false);
            return;
          }
        }
        
        // Fallback: fetch from HTTP API
        const response = await fetch('/api/get-landing-settings');
        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            setSettings(data.data);
          } else {
            setSettings(getDefaultSettings());
          }
        } else {
          setSettings(getDefaultSettings());
        }
      } catch (error) {
        console.error('Error fetching landing settings:', error);
        setSettings(getDefaultSettings());
      } finally {
        setLoading(false);
      }
    };
    
    fetchSettings();
  }, []);

  // Default settings fallback
  const getDefaultSettings = () => ({
    logoUrl: 'https://i.imgur.com/vazRsQJ.png',
    mainTitle: 'OK999.SITE',
    subtitle: 'Đẳng cấp Casino Quốc Tế',
    botName: 'MIG30 Support Bot',
    ctaButtonText: 'TRUY CẬP BOT NGAY',
    ctaButtonColor: '#229ED9',
    ctaButtonHoverColor: '#1e8bc0',
    ctaButtonUrl: 't.me/MIG30VIP_bot',
    giftCode: 'MIG30VIP',
    giftButtonText: 'Nhận Code',
    giftButtonUrl: 'javascript:void(0)',
    supportButtonText: 'Hỗ Trợ',
    supportButtonUrl: 't.me/MIG30VIP_bot',
    botLink: 't.me/MIG30VIP_bot',
    trustBadges: [
      { label: 'Nạp Rút', value: '24/7', color: 'text-yellow-500' },
      { label: 'Tốc độ', value: '1s', color: 'text-green-500' },
      { label: 'Bảo mật', value: '100%', color: 'text-blue-500' }
    ],
    copyrightText: '© 2025 MIG30.VIP Entertainment. All rights reserved.'
  });

  // 1. Particle Background Logic
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    const ctx = canvas.getContext('2d');
    if (!ctx) return undefined;

    let width = 0;
    let height = 0;
    let particles = [];
    let rafId = 0;
    let stopped = false;

    const resize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };

    class Particle {
      constructor() {
        this.reset();
      }
      reset() {
        this.x = Math.random() * width;
        this.y = Math.random() * height;
        this.vx = (Math.random() - 0.5) * 0.5;
        this.vy = (Math.random() - 0.5) * 0.5;
        this.size = Math.random() * 2;
        this.color = Math.random() > 0.5 ? 'rgba(255, 215, 0, ' : 'rgba(34, 158, 217, ';
        this.alpha = Math.random() * 0.5;
      }
      update() {
        this.x += this.vx;
        this.y += this.vy;
        if (this.x < 0 || this.x > width) this.vx *= -1;
        if (this.y < 0 || this.y > height) this.vy *= -1;
      }
      draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fillStyle = this.color + this.alpha + ')';
        ctx.fill();
      }
    }

    const init = () => {
      resize();
      particles = Array.from({ length: 50 }, () => new Particle());
    };

    const animate = () => {
      if (stopped) return;
      ctx.clearRect(0, 0, width, height);
      particles.forEach((p) => {
        p.update();
        p.draw();
      });
      rafId = requestAnimationFrame(animate);
    };

    window.addEventListener('resize', resize);
    init();
    animate();

    return () => {
      stopped = true;
      if (rafId) cancelAnimationFrame(rafId);
      window.removeEventListener('resize', resize);
    };
  }, [loading, settings]);

  // 2. Chat Simulation Logic
  useEffect(() => {
    const chatScript = [
      { text: "Chào mừng bạn đến với MIG30.VIP! 🎲", sender: "bot", delay: 800 },
      { text: "/start", sender: "user", delay: 1200 },
      { text: "Hệ thống nạp rút tự động 1-1 🚀", sender: "bot", delay: 1500 },
      { text: "🎁 Tặng ngay Giftcode 50K cho thành viên mới!", sender: "bot", delay: 1500 },
      { text: "Bấm nút bên dưới để tham gia ngay 👇", sender: "bot", delay: 1500 }
    ];

    let currentTimeout;
    const runChat = async () => {
      for (const msg of chatScript) {
        if (msg.sender === 'bot') setIsTyping(true);
        await new Promise(resolve => currentTimeout = setTimeout(resolve, msg.delay));
        setIsTyping(false);
        setMessages(prev => [...prev, msg]);
      }
    };

    runChat();
    return () => clearTimeout(currentTimeout);
  }, []);

  // Auto scroll chat
  useEffect(() => {
    if (chatBoxRef.current) {
      chatBoxRef.current.scrollTop = chatBoxRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  const copyCode = (code) => {
    const textArea = document.createElement("textarea");
    textArea.value = code;
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand("Copy");
    document.body.removeChild(textArea);

    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  // Show loading state
  if (loading || !settings) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-black text-white">
        <div className="animate-spin w-12 h-12 border-4 border-blue-500/30 border-t-blue-500 rounded-full"></div>
        <p className="mt-4 text-gray-400">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center relative bg-black text-white font-sans overflow-hidden">
      {/* Background */}
      <canvas ref={canvasRef} className="fixed top-0 left-0 w-full h-full -z-10 bg-[radial-gradient(circle_at_center,#1a1a2e_0%,#000000_100%)]" />

      {/* Main UI */}
      <main className="w-full max-w-md p-4 relative z-10 flex flex-col gap-6 animate-in fade-in duration-1000">
        
        {/* Header Section */}
        <div className="flex flex-col items-center">
          <div className="relative p-1 rounded-full bg-gradient-to-tr from-yellow-500 via-transparent to-blue-400 animate-[spin_4s_linear_infinite] shadow-[0_0_30px_rgba(234,179,8,0.2)]">
            <div className="w-32 h-32 rounded-full overflow-hidden bg-black flex items-center justify-center">
              <img 
                src={settings.logoUrl} 
                alt="Logo" 
                className="w-full h-full object-cover hover:scale-110 transition duration-500"
              />
            </div>
          </div>
          <h1 className="mt-4 text-4xl font-extrabold tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-yellow-600 via-yellow-200 to-yellow-600 drop-shadow-md font-['Orbitron',sans-serif]">
            {settings.mainTitle}
          </h1>
          <p className="text-gray-400 text-xs tracking-[0.3em] uppercase mt-1">{settings.subtitle}</p>
        </div>

        {/* Telegram Chat Simulation */}
        <div className="bg-slate-900/70 backdrop-blur-md rounded-2xl p-4 w-full h-80 flex flex-col shadow-2xl border border-yellow-500/10 relative overflow-hidden">
          <div className="flex items-center gap-3 border-b border-gray-700 pb-3 mb-3">
            <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{backgroundColor: settings.ctaButtonColor}}>
              <Send size={20} className="text-white fill-white" />
            </div>
            <div>
              <h3 className="font-bold text-sm">{settings.botName}</h3>
              <p className="text-blue-400 text-xs">bot</p>
            </div>
            <div className="ml-auto text-green-400 text-xs flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span> Online
            </div>
          </div>

          <div ref={chatBoxRef} className="flex-1 overflow-y-auto space-y-3 pr-1 scrollbar-thin scrollbar-thumb-gray-700">
            {messages.map((msg, idx) => (
              <div 
                key={idx} 
                className={`max-w-[85%] p-3 text-sm rounded-xl animate-in slide-in-from-bottom-2 duration-300 ${
                  msg.sender === 'bot' 
                  ? 'bg-slate-800 text-white self-start rounded-tl-none border border-gray-700' 
                  : 'bg-[#229ED9] text-white self-end rounded-tr-none ml-auto'
                }`}
              >
                {msg.text}
              </div>
            ))}
            {isTyping && (
              <div className="text-xs text-gray-500 italic animate-pulse">Bot đang nhập...</div>
            )}
          </div>
        </div>

        {/* Buttons */}
        <div className="flex flex-col gap-3">
          <a 
            href={`https://${settings.ctaButtonUrl}`.replace('https://https://', 'https://')}
            target="_blank"
            rel="noopener noreferrer"
            className="relative overflow-hidden py-4 rounded-xl flex items-center justify-center gap-3 font-bold text-lg shadow-lg transition-all active:scale-95 group"
            style={{
              backgroundColor: settings.ctaButtonColor,
              boxShadow: `0 0 20px ${settings.ctaButtonColor}33`
            }}
            onMouseEnter={(e) => e.target.style.backgroundColor = settings.ctaButtonHoverColor}
            onMouseLeave={(e) => e.target.style.backgroundColor = settings.ctaButtonColor}
          >
            <Send size={24} className="group-hover:rotate-12 transition-transform" />
            <span>{settings.ctaButtonText}</span>
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
          </a>

          <div className="grid grid-cols-2 gap-3">
            <a 
              href={`https://${settings.giftButtonUrl}`.replace('https://javascript:', 'javascript:')}
              target={settings.giftButtonUrl.startsWith('javascript:') ? '_self' : '_blank'}
              rel={settings.giftButtonUrl.startsWith('javascript:') ? '' : 'noopener noreferrer'}
              onClick={settings.giftButtonUrl === 'javascript:void(0)' ? () => copyCode(settings.giftCode) : null}
              className="bg-slate-900/50 hover:bg-slate-800/50 py-3 rounded-xl border border-yellow-500/30 text-yellow-400 font-semibold flex items-center justify-center gap-2 transition cursor-pointer"
            >
              <Gift size={18} /> {settings.giftButtonText}
            </a>
            <a 
              href={`https://${settings.supportButtonUrl}`.replace('https://https://', 'https://')}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-slate-900/50 hover:bg-slate-800/50 py-3 rounded-xl border border-gray-600 text-gray-300 font-semibold flex items-center justify-center gap-2 transition"
            >
              <Headset size={18} /> {settings.supportButtonText}
            </a>
          </div>
        </div>

        {/* Trust Badges */}
        <div className="flex justify-between items-center px-4 py-3 bg-slate-900/70 backdrop-blur-sm rounded-xl border border-white/5">
          {settings.trustBadges && settings.trustBadges.map((item, i) => (
            <React.Fragment key={i}>
              <div className="text-center">
                <div className={`${item.color} font-bold text-lg`}>{item.value}</div>
                <div className="text-[10px] text-gray-500 uppercase">{item.label}</div>
              </div>
              {i < settings.trustBadges.length - 1 && <div className="w-px h-8 bg-gray-800" />}
            </React.Fragment>
          ))}
        </div>

        <p className="text-center text-gray-600 text-[10px] mt-2">
          {settings.copyrightText}
        </p>
      </main>

      {/* Toast Notification */}
      <div className={`fixed top-5 right-5 bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 transition-transform duration-300 z-50 ${showToast ? 'translate-x-0' : 'translate-x-[150%]'}`}>
        <CheckCircle size={18} />
        <span className="text-sm font-medium">Đã sao chép mã Code!</span>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@700&display=swap');
        .scrollbar-thin::-webkit-scrollbar { width: 4px; }
        .scrollbar-thin::-webkit-scrollbar-thumb { background: #334155; border-radius: 10px; }
      `}} />
    </div>
  );
};

export default App;