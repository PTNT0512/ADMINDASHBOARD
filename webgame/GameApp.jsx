import React, { useEffect, useMemo, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes, Link } from 'react-router-dom';

import Booms from './game/booms';
import Plinko from './game/plinko';
import Aviator from './game/aviator';
import Baccarat from './game/baccarat';
import XocDia from './game/xocdia';
import TaiXiuNan from './game/taixiunan';
import TaiXiuCao from './game/taixiucao';
import CheckCauPage from './game/checkCauPage';
import CheckCauSessionPage from './game/checkCauSessionPage';
import Trading from './game/trading';
import Xeng from './game/xeng';
import Lode from './game/lode';
import Rongho from './game/rongho';

const resolveGameApiBase = () => {
  if (typeof window !== 'undefined') {
    const fromWindow = window.GAME_API_URL || window.API_BASE_URL || window.SOCKET_API_URL;
    if (typeof fromWindow === 'string' && fromWindow.trim()) {
      return fromWindow.trim().replace(/\/+$/, '');
    }
  }
  return 'http://localhost:4001';
};

const API_BASE = resolveGameApiBase();

const GAME_ROUTES = [
  { id: 'booms', path: '/booms', name: 'Booms', icon: '💣', color: 'hover:border-yellow-500', element: <Booms /> },
  { id: 'plinko', path: '/plinko', name: 'Plinko', icon: '🎯', color: 'hover:border-pink-500', element: <Plinko /> },
  { id: 'aviator', path: '/aviator', name: 'Aviator', icon: '🚀', color: 'hover:border-red-500', element: <Aviator /> },
  { id: 'baccarat', path: '/baccarat', name: 'Baccarat', icon: '🃏', color: 'hover:border-emerald-500', element: <Baccarat /> },
  { id: 'rongho', path: '/rongho', name: 'Rong Ho', icon: '🐉', color: 'hover:border-orange-500', element: <Rongho /> },
  { id: 'xocdia', path: '/xocdia', name: 'Xoc Dia', icon: '🔴', color: 'hover:border-red-600', element: <XocDia /> },
  { id: 'trading', path: '/trading', name: 'Trading', icon: '📈', color: 'hover:border-green-500', element: <Trading /> },
  { id: 'taixiunan', path: '/taixiunan', name: 'Tai Xiu Nan', icon: '🧿', color: 'hover:border-blue-500', element: <TaiXiuNan /> },
  { id: 'taixiucao', path: '/taixiucao', name: 'Tai Xiu Cao', icon: '🎲', color: 'hover:border-cyan-500', element: <TaiXiuCao /> },
  {
    id: 'check-cau-tx',
    path: '/check-cau-tx',
    name: 'Check Cau TX',
    icon: '📋',
    color: 'hover:border-red-400',
    menu: false,
    element: <CheckCauPage roomType="tx" title="Lầu Cua Game" />,
  },
  {
    id: 'check-cau-tx-detail',
    path: '/check-cau-tx/:sessionId',
    name: 'Check Cau TX Detail',
    icon: '📌',
    color: 'hover:border-red-300',
    menu: false,
    element: <CheckCauSessionPage roomType="tx" title="Lầu Cua Game" listPath="/check-cau-tx" />,
  },
  {
    id: 'check-cau-khongminh',
    path: '/check-cau-khongminh',
    name: 'Check Cau Khong Minh',
    icon: '📜',
    color: 'hover:border-orange-400',
    menu: false,
    element: <CheckCauPage roomType="khongminh" title="Lầu Cua Game" />,
  },
  {
    id: 'check-cau-khongminh-detail',
    path: '/check-cau-khongminh/:sessionId',
    name: 'Check Cau Khong Minh Detail',
    icon: '📍',
    color: 'hover:border-orange-300',
    menu: false,
    element: <CheckCauSessionPage roomType="khongminh" title="Lầu Cua Game" listPath="/check-cau-khongminh" />,
  },
  { id: 'xeng', path: '/xeng', name: 'Xeng', icon: '🍒', color: 'hover:border-violet-500', element: <Xeng /> },
  { id: 'lode', path: '/lode', name: 'Lode', icon: '🎟️', color: 'hover:border-fuchsia-500', element: <Lode /> },
];

function DisabledPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
      <div className="max-w-lg w-full rounded-2xl border border-slate-800 bg-slate-900 p-8 text-center">
        <h2 className="text-2xl font-black uppercase tracking-wide text-amber-400">Game tam tat</h2>
        <p className="mt-3 text-slate-300">Route nay dang bi tat tu Dashboard. Vui long quay lai sau.</p>
        <Link to="/" className="inline-block mt-6 rounded-lg bg-amber-500 px-4 py-2 font-bold text-slate-900 hover:bg-amber-400">
          Ve menu
        </Link>
      </div>
    </div>
  );
}

function GameMenu({ routes, loading }) {
  const menuRoutes = routes.filter((route) => route.menu !== false);
  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-4 font-mono">
      <h1 className="mb-8 text-4xl font-black uppercase tracking-widest text-yellow-500 drop-shadow-lg">Cong Game</h1>
      {loading && <p className="mb-4 text-xs text-slate-400">Dang dong bo route tu dashboard...</p>}
      <div className="grid w-full max-w-2xl grid-cols-2 gap-4 md:grid-cols-3">
        {menuRoutes.map((game) => (
          <Link
            key={game.id}
            to={game.path}
            className={`rounded-xl border border-slate-700 bg-slate-800 p-4 text-center font-bold transition-all ${game.color} hover:bg-slate-700 flex flex-col items-center gap-2`}
          >
            <span className="text-2xl">{game.icon}</span>
            {game.name}
          </Link>
        ))}
      </div>
      {!loading && menuRoutes.length === 0 && (
        <div className="mt-8 rounded-xl border border-slate-700 bg-slate-800 px-6 py-4 text-slate-300">
          Hien chua co game nao dang bat.
        </div>
      )}
    </div>
  );
}

export default function GameApp() {
  const [enabledMap, setEnabledMap] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const loadRoutes = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/webgame/routes`);
        const json = await res.json();
        const list = Array.isArray(json?.data) ? json.data : [];
        const nextMap = {};
        list.forEach((item) => {
          nextMap[item.id] = item.enabled !== false;
        });
        if (mounted) setEnabledMap(nextMap);
      } catch (error) {
        // fallback: allow all when API unavailable
        if (mounted) {
          const fallback = {};
          GAME_ROUTES.forEach((route) => {
            fallback[route.id] = true;
          });
          setEnabledMap(fallback);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    loadRoutes();
    const timer = setInterval(loadRoutes, 5000);

    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, []);

  const enabledRoutes = useMemo(() => {
    if (loading && Object.keys(enabledMap).length === 0) return [];
    return GAME_ROUTES.filter((route) => enabledMap[route.id] !== false);
  }, [enabledMap, loading]);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<GameMenu routes={enabledRoutes} loading={loading} />} />

        {GAME_ROUTES.map((route) => {
          const enabled = enabledMap[route.id] !== false;
          return (
            <Route
              key={route.id}
              path={route.path}
              element={enabled ? route.element : <DisabledPage />}
            />
          );
        })}

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
