import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useIpc, useToast } from './ToastContext';

const POLL_MS = 2000;

const GAME_META = {
  taixiucao: { label: 'Tai Xiu Cao', mode: 'dice' },
  taixiunan: { label: 'Tai Xiu Nan', mode: 'dice' },
  aviator: { label: 'Aviator', mode: 'crash' },
  baccarat: { label: 'Baccarat', mode: 'outcome', options: ['PLAYER', 'BANKER', 'TIE'] },
  xocdia: { label: 'Xoc Dia', mode: 'outcome', options: ['CHAN', 'LE'] },
  rongho: { label: 'Rong Ho', mode: 'outcome', options: ['DRAGON', 'TIGER', 'TIE'] },
};

const DEFAULT_FORMS = {
  taixiucao: { dice1: '1', dice2: '1', dice3: '1' },
  taixiunan: { dice1: '1', dice2: '1', dice3: '1' },
  aviator: { crashPoint: '2.00' },
  baccarat: { outcome: 'PLAYER' },
  xocdia: { outcome: 'CHAN' },
  rongho: { outcome: 'DRAGON' },
};

const gameOrder = Object.keys(GAME_META);
const BOT_CONTROL_GAMES = ['taixiucao', 'taixiunan'];
const BOT_CONTROL_DEFAULT = {
  enabled: true,
  botCount: 50,
  minAmount: 10000,
  maxAmount: 500000,
};

function normalizeBotControl(raw = {}) {
  const enabled = raw?.enabled !== false;
  const botCountRaw = Number(raw?.botCount ?? BOT_CONTROL_DEFAULT.botCount);
  const minAmountRaw = Number(raw?.minAmount ?? BOT_CONTROL_DEFAULT.minAmount);
  const maxAmountRaw = Number(raw?.maxAmount ?? BOT_CONTROL_DEFAULT.maxAmount);
  const botCount = Math.min(999, Math.max(50, Math.floor(Number.isFinite(botCountRaw) ? botCountRaw : BOT_CONTROL_DEFAULT.botCount)));
  const minAmount = Math.max(1000, Math.floor(Number.isFinite(minAmountRaw) ? minAmountRaw : BOT_CONTROL_DEFAULT.minAmount));
  const maxAmount = Math.max(minAmount, Math.floor(Number.isFinite(maxAmountRaw) ? maxAmountRaw : BOT_CONTROL_DEFAULT.maxAmount));
  return { enabled, botCount, minAmount, maxAmount };
}

function toBotControlPayload(cfg = BOT_CONTROL_DEFAULT) {
  const normalized = normalizeBotControl({
    enabled: cfg.enabled,
    botCount: cfg.botCount,
    minAmount: cfg.minAmount,
    maxAmount: cfg.maxAmount,
  });
  return {
    enabled: normalized.enabled,
    botCount: normalized.botCount,
    minAmount: normalized.minAmount,
    maxAmount: normalized.maxAmount,
  };
}

function statusText(state) {
  if (!state?.running) return 'STOPPED';
  return `${state.phase || 'RUNNING'} - ${state.timeLeft || 0}s`;
}

function renderPending(state) {
  const pending = state?.pendingForcedResult;
  if (!pending) return 'none';
  if (pending.dice1) return `${pending.dice1}-${pending.dice2}-${pending.dice3}`;
  if (pending.crashPoint) return `crash @ ${pending.crashPoint}x`;
  if (pending.outcome) return pending.outcome;
  return JSON.stringify(pending);
}

export default function SessionControlManager() {
  const { invoke } = useIpc();
  const { showToast } = useToast();

  const [states, setStates] = useState([]);
  const [loadingMap, setLoadingMap] = useState({});
  const [forms, setForms] = useState(DEFAULT_FORMS);
  const [botControlMap, setBotControlMap] = useState({
    taixiucao: BOT_CONTROL_DEFAULT,
    taixiunan: BOT_CONTROL_DEFAULT,
  });
  const [botSavingMap, setBotSavingMap] = useState({});
  const [botSectionExpandedMap, setBotSectionExpandedMap] = useState({});

  const stateMap = useMemo(() => {
    const map = new Map();
    states.forEach((item) => map.set(item.gameType, item));
    return map;
  }, [states]);

  const fetchStates = useCallback(async () => {
    const result = await invoke('get-session-control-states');
    if (result?.success) {
      setStates(Array.isArray(result.data) ? result.data : []);
    }
  }, [invoke]);

  const loadBotControls = useCallback(async () => {
    try {
      const [caoRes, nanRes] = await Promise.all([
        invoke('get-tx-auto-bot-setting', 'taixiucao'),
        invoke('get-tx-auto-bot-setting', 'taixiunan'),
      ]);
      setBotControlMap({
        taixiucao: normalizeBotControl(caoRes?.data || {}),
        taixiunan: normalizeBotControl(nanRes?.data || {}),
      });
    } catch (error) {
      showToast(`Loi tai cau hinh bot: ${error.message}`, 'danger');
    }
  }, [invoke, showToast]);

  useEffect(() => {
    fetchStates();
    loadBotControls();
    const timer = setInterval(fetchStates, POLL_MS);
    return () => clearInterval(timer);
  }, [fetchStates, loadBotControls]);

  const setField = (gameType, key, value) => {
    setForms((prev) => ({
      ...prev,
      [gameType]: {
        ...prev[gameType],
        [key]: value,
      },
    }));
  };

  const setBotControlField = (gameType, key, value) => {
    setBotControlMap((prev) => ({
      ...prev,
      [gameType]: (() => {
        const current = prev[gameType] || BOT_CONTROL_DEFAULT;
        return normalizeBotControl({
          enabled: key === 'enabled' ? value : current.enabled,
          botCount: key === 'botCount' ? value : current.botCount,
          minAmount: key === 'minAmount' ? value : current.minAmount,
          maxAmount: key === 'maxAmount' ? value : current.maxAmount,
        });
      })(),
    }));
  };

  const saveBotControl = async (gameType) => {
    if (!BOT_CONTROL_GAMES.includes(gameType)) return;
    const meta = GAME_META[gameType];
    const currentBotControl = botControlMap[gameType] || BOT_CONTROL_DEFAULT;
    setBotSavingMap((prev) => ({ ...prev, [gameType]: true }));
    try {
      const saveRes = await invoke('save-tx-auto-bot-setting', {
        roomType: gameType,
        data: toBotControlPayload(currentBotControl),
      });
      if (!saveRes?.success) {
        throw new Error(saveRes?.message || 'Luu that bai');
      }

      setBotControlMap((prev) => ({
        ...prev,
        [gameType]: normalizeBotControl(saveRes?.data || currentBotControl),
      }));
      showToast(`[${meta.label}] Da luu thong so bot`, 'success');
    } catch (error) {
      showToast(`[${meta.label}] Loi luu thong so bot: ${error.message}`, 'danger');
    } finally {
      setBotSavingMap((prev) => ({ ...prev, [gameType]: false }));
    }
  };

  const toggleBotSection = (gameType) => {
    setBotSectionExpandedMap((prev) => ({
      ...prev,
      [gameType]: !prev[gameType],
    }));
  };

  const applyForcedResult = async (gameType) => {
    const meta = GAME_META[gameType];
    if (!meta) return;

    const payload = { gameType };
    const form = forms[gameType] || {};

    if (meta.mode === 'dice') {
      payload.dice1 = Number(form.dice1);
      payload.dice2 = Number(form.dice2);
      payload.dice3 = Number(form.dice3);
    } else if (meta.mode === 'crash') {
      payload.crashPoint = Number(form.crashPoint);
    } else {
      payload.outcome = String(form.outcome || '').toUpperCase();
    }

    setLoadingMap((prev) => ({ ...prev, [gameType]: true }));
    try {
      const result = await invoke('set-next-session-result', payload);
      if (!result?.success) throw new Error(result?.message || 'Unknown error');
      showToast(`[${meta.label}] Da dat ket qua phien tiep theo`, 'success');
      await fetchStates();
    } catch (error) {
      showToast(`[${meta.label}] Loi dat ket qua: ${error.message}`, 'danger');
    } finally {
      setLoadingMap((prev) => ({ ...prev, [gameType]: false }));
    }
  };

  const clearForcedResult = async (gameType) => {
    const meta = GAME_META[gameType];
    if (!meta) return;

    setLoadingMap((prev) => ({ ...prev, [gameType]: true }));
    try {
      const result = await invoke('clear-next-session-result', { gameType });
      if (!result?.success) throw new Error(result?.message || 'Unknown error');
      showToast(`[${meta.label}] Da xoa can thiep ket qua`, 'success');
      await fetchStates();
    } catch (error) {
      showToast(`[${meta.label}] Loi xoa cau hinh: ${error.message}`, 'danger');
    } finally {
      setLoadingMap((prev) => ({ ...prev, [gameType]: false }));
    }
  };

  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ marginBottom: 8 }}>Session Result Control</h1>
      <p style={{ marginBottom: 20, color: '#64748b' }}>
        Can thiep ket qua cho phien tiep theo. Neu khong can thiep, server se random tu dong.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))', gap: 16 }}>
        {gameOrder.map((gameType) => {
          const meta = GAME_META[gameType];
          const state = stateMap.get(gameType) || { gameType, running: false, phase: 'STOPPED', timeLeft: 0, sessionId: 0 };
          const loading = !!loadingMap[gameType];
          const botControl = BOT_CONTROL_GAMES.includes(gameType) ? (botControlMap[gameType] || BOT_CONTROL_DEFAULT) : null;
          const botSaving = !!botSavingMap[gameType];
          const botExpanded = !!botSectionExpandedMap[gameType];

          return (
            <div
              key={gameType}
              style={{
                border: '1px solid #e2e8f0',
                borderRadius: 12,
                padding: 16,
                background: '#fff',
                boxShadow: '0 2px 8px rgba(15,23,42,0.04)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div style={{ fontWeight: 700 }}>{meta.label}</div>
                <div style={{ fontSize: 12, color: state.running ? '#16a34a' : '#ef4444' }}>{statusText(state)}</div>
              </div>

              <div style={{ fontSize: 12, color: '#64748b', marginBottom: 10 }}>
                Session: #{state.sessionId || 0} | Pending: {renderPending(state)}
              </div>

              {meta.mode === 'dice' && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 12 }}>
                  {[1, 2, 3].map((idx) => (
                    <input
                      key={idx}
                      type="number"
                      min={1}
                      max={6}
                      value={forms[gameType][`dice${idx}`]}
                      onChange={(e) => setField(gameType, `dice${idx}`, e.target.value)}
                      style={{ width: '100%', padding: '8px 10px', border: '1px solid #cbd5e1', borderRadius: 8 }}
                    />
                  ))}
                </div>
              )}

              {meta.mode === 'crash' && (
                <div style={{ marginBottom: 12 }}>
                  <input
                    type="number"
                    min={1.01}
                    step={0.01}
                    value={forms[gameType].crashPoint}
                    onChange={(e) => setField(gameType, 'crashPoint', e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', border: '1px solid #cbd5e1', borderRadius: 8 }}
                  />
                </div>
              )}

              {meta.mode === 'outcome' && (
                <div style={{ marginBottom: 12 }}>
                  <select
                    value={forms[gameType].outcome}
                    onChange={(e) => setField(gameType, 'outcome', e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', border: '1px solid #cbd5e1', borderRadius: 8 }}
                  >
                    {meta.options.map((item) => (
                      <option key={item} value={item}>{item}</option>
                    ))}
                  </select>
                </div>
              )}

              {botControl && (
                <div
                  style={{
                    marginBottom: 12,
                    border: '1px dashed #93c5fd',
                    borderRadius: 8,
                    padding: 12,
                    background: '#f8fbff',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => toggleBotSection(gameType)}
                    style={{
                      width: '100%',
                      border: 'none',
                      background: 'transparent',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: 'pointer',
                      padding: 0,
                      marginBottom: 8,
                    }}
                  >
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#1d4ed8' }}>
                      Thong so bot tu dong
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#1e293b' }}>
                      {botExpanded ? 'Thu gon ▲' : 'Mo rong ▼'}
                    </div>
                  </button>

                  <div style={{ fontSize: 11, color: '#475569', marginBottom: botExpanded ? 10 : 0 }}>
                    Trang thai: {botControl.enabled ? 'BAT' : 'TAT'} | So luong: {botControl.botCount} | Min: {botControl.minAmount.toLocaleString()} | Max: {botControl.maxAmount.toLocaleString()}
                  </div>

                  {botExpanded && (
                    <>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, fontSize: 12 }}>
                        <input
                          type="checkbox"
                          checked={!!botControl.enabled}
                          onChange={(e) => setBotControlField(gameType, 'enabled', e.target.checked)}
                        />
                        Bat/tat bot
                      </label>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
                        <div>
                          <div style={{ fontSize: 11, color: '#475569', marginBottom: 4 }}>So luong bot moi dot</div>
                          <input
                            type="number"
                            min={50}
                            max={999}
                            value={botControl.botCount}
                            onChange={(e) => setBotControlField(gameType, 'botCount', Number(e.target.value || 0))}
                            style={{ width: '100%', padding: '8px 10px', border: '1px solid #cbd5e1', borderRadius: 8 }}
                          />
                        </div>
                        <div>
                          <div style={{ fontSize: 11, color: '#475569', marginBottom: 4 }}>Tien cuoc toi thieu</div>
                          <input
                            type="number"
                            min={1000}
                            step={1000}
                            value={botControl.minAmount}
                            onChange={(e) => setBotControlField(gameType, 'minAmount', Number(e.target.value || 0))}
                            style={{ width: '100%', padding: '8px 10px', border: '1px solid #cbd5e1', borderRadius: 8 }}
                          />
                        </div>
                        <div style={{ gridColumn: '1 / -1' }}>
                          <div style={{ fontSize: 11, color: '#475569', marginBottom: 4 }}>Tien cuoc toi da</div>
                          <input
                            type="number"
                            min={1000}
                            step={1000}
                            value={botControl.maxAmount}
                            onChange={(e) => setBotControlField(gameType, 'maxAmount', Number(e.target.value || 0))}
                            style={{ width: '100%', padding: '8px 10px', border: '1px solid #cbd5e1', borderRadius: 8 }}
                          />
                        </div>
                      </div>
                      <button
                        onClick={() => saveBotControl(gameType)}
                        disabled={botSaving}
                        style={{
                          width: '100%',
                          border: 'none',
                          borderRadius: 8,
                          padding: '8px 10px',
                          background: '#0ea5e9',
                          color: '#fff',
                          fontWeight: 700,
                          cursor: botSaving ? 'wait' : 'pointer',
                          opacity: botSaving ? 0.75 : 1,
                        }}
                      >
                        {botSaving ? 'Dang luu...' : 'Luu thong so bot'}
                      </button>
                    </>
                  )}
                </div>
              )}

              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => applyForcedResult(gameType)}
                  disabled={loading}
                  style={{
                    flex: 1,
                    border: 'none',
                    borderRadius: 8,
                    padding: '9px 12px',
                    background: '#2563eb',
                    color: '#fff',
                    fontWeight: 700,
                    cursor: loading ? 'wait' : 'pointer',
                    opacity: loading ? 0.7 : 1,
                  }}
                >
                  Dat ket qua
                </button>
                <button
                  onClick={() => clearForcedResult(gameType)}
                  disabled={loading}
                  style={{
                    flex: 1,
                    border: '1px solid #ef4444',
                    borderRadius: 8,
                    padding: '9px 12px',
                    background: '#fff',
                    color: '#ef4444',
                    fontWeight: 700,
                    cursor: loading ? 'wait' : 'pointer',
                    opacity: loading ? 0.7 : 1,
                  }}
                >
                  Xoa can thiep
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
