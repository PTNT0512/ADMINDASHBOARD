import React, { useCallback, useEffect, useState } from 'react';
import { Server, Cpu, Globe, Route, RefreshCw, Play, Square } from 'lucide-react';
import { useIpc, useToast } from './ToastContext';

const POLL_MS = 3000;

const INITIAL_SERVERS = {
  landingServer: {
    id: 'landing-server',
    name: 'Landing Page Server',
    port: 80,
    description: 'Server phuc vu trang Landing Page.',
    running: false,
    loading: false,
  },
  cskhApp: {
    id: 'cskh',
    name: 'CSKH App',
    port: 3001,
    description: 'Ung dung chat ho tro khach hang (CSKH).',
    running: false,
    loading: false,
  },
  webgame: {
    id: 'webgame',
    name: 'WebGame',
    port: 3005,
    description: 'Frontend game tong hop trong thu muc webgame.',
    running: false,
    loading: false,
  },
  taixiuBackend: {
    id: 'taixiu-backend',
    name: 'TaiXiu Backend',
    port: 18082,
    description: 'Backend API + WebSocket cho bo game tai xiu tach rieng.',
    running: false,
    loading: false,
  },
  taixiuCaoSession: {
    id: 'taixiucao-session',
    name: 'Tai Xiu Cao Session Server',
    port: 'SOCKET:4001',
    description: 'Server tao phien rieng cho game Tai Xiu Cao.',
    running: false,
    loading: false,
  },
  taixiuNanSession: {
    id: 'taixiunan-session',
    name: 'Tai Xiu Nan Session Server',
    port: 'SOCKET:4001',
    description: 'Server tao phien rieng cho game Tai Xiu Nan.',
    running: false,
    loading: false,
  },
  aviatorSession: {
    id: 'aviator-session',
    name: 'Aviator Session Server',
    port: 'SOCKET:4001',
    description: 'Server tao phien rieng cho game Aviator.',
    running: false,
    loading: false,
  },
  baccaratSession: {
    id: 'baccarat-session',
    name: 'Baccarat Session Server',
    port: 'SOCKET:4001',
    description: 'Server tao phien rieng cho game Baccarat.',
    running: false,
    loading: false,
  },
  xocdiaSession: {
    id: 'xocdia-session',
    name: 'Xoc Dia Session Server',
    port: 'SOCKET:4001',
    description: 'Server tao phien rieng cho game Xoc Dia.',
    running: false,
    loading: false,
  },
  ronghoSession: {
    id: 'rongho-session',
    name: 'Rong Ho Session Server',
    port: 'SOCKET:4001',
    description: 'Server tao phien rieng cho game Rong Ho.',
    running: false,
    loading: false,
  },
};

function normalizeArrayResponse(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
}

function normalizeStatusResponse(payload) {
  return !!payload?.running;
}

export default function ServerManager() {
  const { invoke } = useIpc();
  const { showToast } = useToast();

  const [servers, setServers] = useState(INITIAL_SERVERS);
  const [extraGames, setExtraGames] = useState([]);
  const [webgameRoutes, setWebgameRoutes] = useState([]);
  const [routeLoadingMap, setRouteLoadingMap] = useState({});

  const fetchStatuses = useCallback(async () => {
    try {
      const [
        landingServerStatus,
        cskhStatus,
        webgameStatus,
        taixiuBackendStatus,
        taixiuCaoSessionStatus,
        taixiuNanSessionStatus,
        aviatorSessionStatus,
        baccaratSessionStatus,
        xocdiaSessionStatus,
        ronghoSessionStatus,
        extraGamesStatus,
        webgameRoutesStatus,
      ] = await Promise.all([
        invoke('get-landing-server-status').catch(() => ({ running: false })),
        invoke('get-cskh-status').catch(() => ({ running: false })),
        invoke('get-webgame-status').catch(() => ({ running: false })),
        invoke('get-taixiu-backend-status').catch(() => ({ running: false })),
        invoke('get-taixiucao-session-status').catch(() => ({ running: false })),
        invoke('get-taixiunan-session-status').catch(() => ({ running: false })),
        invoke('get-aviator-session-status').catch(() => ({ running: false })),
        invoke('get-baccarat-session-status').catch(() => ({ running: false })),
        invoke('get-xocdia-session-status').catch(() => ({ running: false })),
        invoke('get-rongho-session-status').catch(() => ({ running: false })),
        invoke('get-extra-games-status').catch(() => ({ data: [] })),
        invoke('get-webgame-routes').catch(() => ({ data: [] })),
      ]);

      setServers((prev) => ({
        ...prev,
        landingServer: { ...prev.landingServer, running: normalizeStatusResponse(landingServerStatus) },
        cskhApp: { ...prev.cskhApp, running: normalizeStatusResponse(cskhStatus) },
        webgame: { ...prev.webgame, running: normalizeStatusResponse(webgameStatus) },
        taixiuBackend: { ...prev.taixiuBackend, running: normalizeStatusResponse(taixiuBackendStatus) },
        taixiuCaoSession: { ...prev.taixiuCaoSession, running: normalizeStatusResponse(taixiuCaoSessionStatus) },
        taixiuNanSession: { ...prev.taixiuNanSession, running: normalizeStatusResponse(taixiuNanSessionStatus) },
        aviatorSession: { ...prev.aviatorSession, running: normalizeStatusResponse(aviatorSessionStatus) },
        baccaratSession: { ...prev.baccaratSession, running: normalizeStatusResponse(baccaratSessionStatus) },
        xocdiaSession: { ...prev.xocdiaSession, running: normalizeStatusResponse(xocdiaSessionStatus) },
        ronghoSession: { ...prev.ronghoSession, running: normalizeStatusResponse(ronghoSessionStatus) },
      }));

      setExtraGames(normalizeArrayResponse(extraGamesStatus));
      setWebgameRoutes(normalizeArrayResponse(webgameRoutesStatus));
    } catch (error) {
      console.error('Error fetching server status:', error);
    }
  }, [invoke]);

  useEffect(() => {
    fetchStatuses();
    const timer = setInterval(fetchStatuses, POLL_MS);
    return () => clearInterval(timer);
  }, [fetchStatuses]);

  const toggleServer = async (serverKey, serverInfo) => {
    const action = serverInfo.running ? 'stop' : 'start';
    const channel = `${action}-${serverInfo.id}`;

    setServers((prev) => ({
      ...prev,
      [serverKey]: { ...prev[serverKey], loading: true },
    }));

    try {
      const result = await invoke(channel);
      if (result?.success === false) {
        throw new Error(result.message || 'Unknown error');
      }

      showToast(
        `Da gui lenh ${action === 'start' ? 'BAT' : 'TAT'} ${serverInfo.name}`,
        'success',
      );
      setTimeout(fetchStatuses, 800);
    } catch (error) {
      console.error(`Failed to ${action} ${serverInfo.name}:`, error);
      showToast(
        `Loi khi ${action === 'start' ? 'BAT' : 'TAT'} ${serverInfo.name}: ${error.message}`,
        'danger',
      );
    } finally {
      setServers((prev) => ({
        ...prev,
        [serverKey]: { ...prev[serverKey], loading: false },
      }));
    }
  };

  const toggleExtraGame = async (gameId) => {
    try {
      const result = await invoke('toggle-extra-game', gameId);
      if (result?.success === false) {
        throw new Error(result.message || 'Unknown error');
      }
      showToast(`Da gui lenh chuyen trang thai cho ${gameId}`, 'success');
      setTimeout(fetchStatuses, 800);
    } catch (error) {
      console.error(`Failed to toggle extra game ${gameId}:`, error);
      showToast(`Loi khi thao tac voi ${gameId}: ${error.message}`, 'danger');
    }
  };

  const toggleWebgameRoute = async (routeId, nextEnabled) => {
    setRouteLoadingMap((prev) => ({ ...prev, [routeId]: true }));

    try {
      const result = await invoke('set-webgame-route', { id: routeId, enabled: nextEnabled });
      if (result?.success === false) {
        throw new Error(result.message || 'Unknown error');
      }

      const updated = normalizeArrayResponse(result);
      if (updated.length > 0) {
        setWebgameRoutes(updated);
      } else {
        await fetchStatuses();
      }

      showToast(`Da cap nhat route ${routeId}: ${nextEnabled ? 'BAT' : 'TAT'}`, 'success');
    } catch (error) {
      console.error(`Failed to update route ${routeId}:`, error);
      showToast(`Loi cap nhat route ${routeId}: ${error.message}`, 'danger');
    } finally {
      setRouteLoadingMap((prev) => ({ ...prev, [routeId]: false }));
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6 font-sans text-slate-800">
      <div className="mb-8">
        <h1 className="flex items-center gap-3 text-3xl font-bold text-slate-900">
          <Server className="text-blue-600" size={32} />
          Quan Ly Server
        </h1>
        <p className="mt-2 text-slate-500">
          Dieu khien trang thai hoat dong cua backend va frontend game.
        </p>
      </div>

      <div className="mb-10">
        <h2 className="mb-4 flex items-center gap-2 text-xl font-bold text-slate-800">
          <Cpu size={20} className="text-indigo-600" /> Backend Servers
        </h2>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {Object.entries(servers).map(([key, server]) => (
            <div
              key={key}
              className={`rounded-xl border-l-4 bg-white p-6 shadow-sm transition hover:shadow-md ${
                server.running ? 'border-green-500' : 'border-slate-300'
              }`}
            >
              <div className="mb-4 flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-lg font-bold text-slate-800">{server.name}</h3>
                  <p className="mt-1 text-sm text-slate-500">{server.description}</p>
                </div>
                <div
                  className={`flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold ${
                    server.running ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  <div
                    className={`h-2 w-2 rounded-full ${
                      server.running ? 'animate-pulse bg-green-500' : 'bg-slate-400'
                    }`}
                  />
                  {server.running ? 'RUNNING' : 'STOPPED'}
                </div>
              </div>

              <div className="mt-6 flex items-center justify-between">
                <div className="rounded border border-slate-200 bg-slate-100 px-2 py-1 font-mono text-xs text-slate-600">
                  PORT: {server.port}
                </div>
                <button
                  onClick={() => toggleServer(key, server)}
                  disabled={server.loading}
                  className={`flex items-center gap-2 rounded-lg px-5 py-2 text-sm font-bold transition active:scale-95 ${
                    server.running
                      ? 'bg-red-100 text-red-600 hover:bg-red-200'
                      : 'bg-blue-600 text-white shadow-lg shadow-blue-600/20 hover:bg-blue-700'
                  } ${server.loading ? 'cursor-wait opacity-70' : ''}`}
                >
                  {server.loading ? (
                    <RefreshCw className="animate-spin" size={16} />
                  ) : server.running ? (
                    <Square size={16} fill="currentColor" />
                  ) : (
                    <Play size={16} fill="currentColor" />
                  )}
                  {server.loading ? 'Dang xu ly...' : server.running ? 'Tat Server' : 'Bat Server'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mb-10">
        <h2 className="mb-4 flex items-center gap-2 text-xl font-bold text-slate-800">
          <Route size={20} className="text-amber-600" /> WebGame Routes
        </h2>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {webgameRoutes.map((route) => {
            const loading = !!routeLoadingMap[route.id];
            return (
              <div
                key={route.id}
                className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm"
              >
                <div>
                  <p className="text-sm font-bold text-slate-800">{route.name || route.id}</p>
                  <p className="font-mono text-xs text-slate-500">{route.path}</p>
                </div>
                <button
                  onClick={() => toggleWebgameRoute(route.id, !route.enabled)}
                  disabled={loading}
                  className={`min-w-[88px] rounded-md px-3 py-1.5 text-xs font-bold transition ${
                    route.enabled
                      ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                      : 'bg-rose-100 text-rose-700 hover:bg-rose-200'
                  } ${loading ? 'cursor-wait opacity-70' : ''}`}
                >
                  {loading ? 'Dang doi' : route.enabled ? 'Dang bat' : 'Dang tat'}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <div>
        <h2 className="mb-4 flex items-center gap-2 text-xl font-bold text-slate-800">
          <Globe size={20} className="text-teal-600" /> Game Clients (Frontend)
        </h2>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {extraGames.map((game) => (
            <div
              key={game.id}
              className="group relative overflow-hidden rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md"
            >
              {game.running && (
                <div className="absolute -mr-10 -mt-10 right-0 top-0 z-0 h-20 w-20 rounded-bl-[100px] bg-green-500/5 transition group-hover:bg-green-500/10" />
              )}

              <div className="relative z-10">
                <div className="mb-3 flex items-start justify-between">
                  <h3 className="text-lg font-bold text-slate-800">{game.title || game.id}</h3>
                  <div
                    className={`h-3 w-3 rounded-full ${
                      game.running ? 'bg-green-500 shadow-[0_0_8px_#22c55e]' : 'bg-slate-300'
                    }`}
                  />
                </div>

                <div className="mb-5 flex items-center gap-2 font-mono text-xs text-slate-500">
                  <span className="rounded border border-slate-200 bg-slate-100 px-2 py-0.5">
                    Port: {game.port}
                  </span>
                </div>

                <button
                  onClick={() => toggleExtraGame(game.id)}
                  className={`flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-bold transition ${
                    game.running
                      ? 'border-2 border-red-100 bg-white text-red-500 hover:border-red-200 hover:bg-red-50'
                      : 'bg-slate-800 text-white shadow-lg shadow-slate-800/20 hover:bg-slate-700'
                  }`}
                >
                  {game.running ? <Square size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" />}
                  {game.running ? 'Dung Client' : 'Chay Client'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

