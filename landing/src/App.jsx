import React, { useState, useEffect, useRef } from 'react';
import { MessageSquare, Gift, Headset, CheckCircle, Send } from 'lucide-react';

const App = () => {
  const [messages, setMessages] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const chatBoxRef = useRef(null);
  const canvasRef = useRef(null);

  // 1. Particle Background Logic
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let width, height;
    let particles = [];

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
      ctx.clearRect(0, 0, width, height);
      particles.forEach((p) => {
        p.update();
        p.draw();
      });
      requestAnimationFrame(animate);
    };

    window.addEventListener('resize', resize);
    init();
    animate();

    return () => window.removeEventListener('resize', resize);
  }, []);

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
                src="https://i.imgur.com/vazRsQJ.png" 
                alt="MIG30 Logo" 
                className="w-full h-full object-cover hover:scale-110 transition duration-500"
              />
            </div>
          </div>
          <h1 className="mt-4 text-4xl font-extrabold tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-yellow-600 via-yellow-200 to-yellow-600 drop-shadow-md font-['Orbitron',sans-serif]">
            MIG30.VIP
          </h1>
          <p className="text-gray-400 text-xs tracking-[0.3em] uppercase mt-1">Đẳng cấp Casino Quốc Tế</p>
        </div>

        {/* Telegram Chat Simulation */}
        <div className="bg-slate-900/70 backdrop-blur-md rounded-2xl p-4 w-full h-80 flex flex-col shadow-2xl border border-yellow-500/10 relative overflow-hidden">
          <div className="flex items-center gap-3 border-b border-gray-700 pb-3 mb-3">
            <div className="w-10 h-10 rounded-full bg-[#229ED9] flex items-center justify-center">
              <Send size={20} className="text-white fill-white" />
            </div>
            <div>
              <h3 className="font-bold text-sm">MIG30 Support Bot</h3>
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
          <button className="relative overflow-hidden bg-[#229ED9] hover:bg-[#1e8bc0] py-4 rounded-xl flex items-center justify-center gap-3 font-bold text-lg shadow-lg shadow-blue-500/20 transition-all active:scale-95 group">
            <Send size={24} className="group-hover:rotate-12 transition-transform" />
            <span>TRUY CẬP BOT NGAY</span>
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
          </button>

          <div className="grid grid-cols-2 gap-3">
            <button 
              onClick={() => copyCode('MIG30VIP')}
              className="bg-slate-900/50 hover:bg-slate-800/50 py-3 rounded-xl border border-yellow-500/30 text-yellow-400 font-semibold flex items-center justify-center gap-2 transition"
            >
              <Gift size={18} /> Nhận Code
            </button>
            <button className="bg-slate-900/50 hover:bg-slate-800/50 py-3 rounded-xl border border-gray-600 text-gray-300 font-semibold flex items-center justify-center gap-2 transition">
              <Headset size={18} /> Hỗ Trợ
            </button>
          </div>
        </div>

        {/* Trust Badges */}
        <div className="flex justify-between items-center px-4 py-3 bg-slate-900/70 backdrop-blur-sm rounded-xl border border-white/5">
          {[
            { label: 'Nạp Rút', val: '24/7', color: 'text-yellow-500' },
            { label: 'Tốc độ', val: '1s', color: 'text-green-500' },
            { label: 'Bảo mật', val: '100%', color: 'text-blue-500' }
          ].map((item, i) => (
            <React.Fragment key={i}>
              <div className="text-center">
                <div className={`${item.color} font-bold text-lg`}>{item.val}</div>
                <div className="text-[10px] text-gray-500 uppercase">{item.label}</div>
              </div>
              {i < 2 && <div className="w-px h-8 bg-gray-800" />}
            </React.Fragment>
          ))}
        </div>

        <p className="text-center text-gray-600 text-[10px] mt-2">
          &copy; 2025 MIG30.VIP Entertainment. All rights reserved.
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