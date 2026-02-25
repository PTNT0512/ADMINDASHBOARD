import React from 'react';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';

// Import các game component
import Booms from './game/booms';
import Plinko from './game/plinko';
import Aviator from './game/aviator';
import Baccarat from './game/baccarat';
import XocDia from './game/xocdia';
import TaiXiuNan from './game/taixiunan';
import TaiXiuCao from './game/taixiucao';
import Trading from './game/trading';
import Xeng from './game/xeng';
import Lode from './game/lode';
import Rongho from './game/rongho';

const GameMenu = () => (
  <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-4 font-mono">
    <h1 className="text-4xl font-black text-yellow-500 mb-8 uppercase tracking-widest drop-shadow-lg">Cổng Game</h1>
    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 w-full max-w-2xl">
      <Link to="/booms" className="p-4 bg-slate-800 border border-slate-700 rounded-xl hover:bg-slate-700 hover:border-yellow-500 transition-all text-center font-bold flex flex-col items-center gap-2">
        <span className="text-2xl">💣</span> Booms
      </Link>
      <Link to="/plinko" className="p-4 bg-slate-800 border border-slate-700 rounded-xl hover:bg-slate-700 hover:border-pink-500 transition-all text-center font-bold flex flex-col items-center gap-2">
        <span className="text-2xl">🎯</span> Plinko
      </Link>
      <Link to="/aviator" className="p-4 bg-slate-800 border border-slate-700 rounded-xl hover:bg-slate-700 hover:border-red-500 transition-all text-center font-bold flex flex-col items-center gap-2">
        <span className="text-2xl">🚀</span> Aviator
      </Link>
      <Link to="/baccarat" className="p-4 bg-slate-800 border border-slate-700 rounded-xl hover:bg-slate-700 hover:border-emerald-500 transition-all text-center font-bold flex flex-col items-center gap-2">
        <span className="text-2xl">🃏</span> Baccarat
      </Link>
            <Link to="/rongho" className="p-4 bg-slate-800 border border-slate-700 rounded-xl hover:bg-slate-700 hover:border-emerald-500 transition-all text-center font-bold flex flex-col items-center gap-2">
        <span className="text-2xl">🃏</span> Rồng Hổ
      </Link>
      <Link to="/xocdia" className="p-4 bg-slate-800 border border-slate-700 rounded-xl hover:bg-slate-700 hover:border-red-600 transition-all text-center font-bold flex flex-col items-center gap-2">
        <span className="text-2xl">🔴</span> Xóc Đĩa
      </Link>
      <Link to="/trading" className="p-4 bg-slate-800 border border-slate-700 rounded-xl hover:bg-slate-700 hover:border-green-500 transition-all text-center font-bold flex flex-col items-center gap-2">
        <span className="text-2xl">📈</span> Trading
      </Link>
      <Link to="/taixiunan" className="p-4 bg-slate-800 border border-slate-700 rounded-xl hover:bg-slate-700 hover:border-blue-500 transition-all text-center font-bold flex flex-col items-center gap-2">
        <span className="text-2xl">🤏</span> Tài Xỉu Nặn
      </Link>
      <Link to="/taixiucao" className="p-4 bg-slate-800 border border-slate-700 rounded-xl hover:bg-slate-700 hover:border-cyan-500 transition-all text-center font-bold flex flex-col items-center gap-2">
        <span className="text-2xl">🎲</span> Tài Xỉu Cào
      </Link>
      <Link to="/xeng" className="p-4 bg-slate-800 border border-slate-700 rounded-xl hover:bg-slate-700 hover:border-purple-500 transition-all text-center font-bold flex flex-col items-center gap-2">
        <span className="text-2xl">🍒</span> Xèng
      </Link>
      <Link to="/lode" className="p-4 bg-slate-800 border border-slate-700 rounded-xl hover:bg-slate-700 hover:border-purple-500 transition-all text-center font-bold flex flex-col items-center gap-2">
        <span className="text-2xl">🍒</span> lode
      </Link>      
    </div>
  </div>
);

export default function GameApp() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<GameMenu />} />
        <Route path="/booms" element={<Booms />} />
        <Route path="/plinko" element={<Plinko />} />
        <Route path="/aviator" element={<Aviator />} />
        <Route path="/baccarat" element={<Baccarat />} />
        <Route path="/xocdia" element={<XocDia />} />
        <Route path="/trading" element={<Trading />} />
        <Route path="/taixiunan" element={<TaiXiuNan />} />
        <Route path="/taixiucao" element={<TaiXiuCao />} />
        <Route path="/xeng" element={<Xeng />} />
        <Route path="/lode" element={<Lode />} />
        <Route path="/rongho" element={<Rongho />} />
      </Routes>
    </BrowserRouter>
  );
}
