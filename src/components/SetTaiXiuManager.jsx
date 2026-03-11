import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useIpc, useToast } from './ToastContext';

const POLL_MS = 2000;

const formatAmount = (value) => Number(value || 0).toLocaleString('vi-VN');

const GAME_META = {
  double: { label: 'T\u00e0i X\u1ec9u Double', mode: 'dice3' },
  md5: { label: 'T\u00e0i X\u1ec9u MD5', mode: 'dice3' },
  baucua: { label: 'B\u1ea7u Cua', mode: 'baucua' },
  xocdia: { label: 'X\u00f3c \u0110\u0129a', mode: 'xocdia' },
  minipoker: { label: 'MiniPoker', mode: 'minipoker' },
};

const DEFAULT_FORM = {
  double: { dice1: '1', dice2: '1', dice3: '1' },
  md5: { dice1: '1', dice2: '1', dice3: '1' },
  baucua: { dice1: '0', dice2: '1', dice3: '2', xPot: '0', xValue: '0' },
  xocdia: { dice1: '0', dice2: '1', dice3: '0', dice4: '1' },
  minipoker: { jackpotRatePercent: '0.02', winRatePercent: '43' },
};

const BAUCUA_DOORS = [
  { id: 0, label: 'B\u1ea7u' },
  { id: 1, label: 'Cua' },
  { id: 2, label: 'T\u00f4m' },
  { id: 3, label: 'C\u00e1' },
  { id: 4, label: 'G\u00e0' },
  { id: 5, label: 'Nai' },
];

const XOCDIA_QUICK_OPTIONS = [
  { key: 'chan', label: 'V\u1ec1 Ch\u1eb5n', diceIds: [1, 1, 0, 0] },
  { key: 'le', label: 'V\u1ec1 L\u1ebb', diceIds: [1, 1, 1, 0] },
  { key: '4_trang', label: '4 Tr\u1eafng', diceIds: [0, 0, 0, 0] },
  { key: '4_do', label: '4 \u0110\u1ecf', diceIds: [1, 1, 1, 1] },
  { key: '3_do_1_trang', label: '3 \u0110\u1ecf 1 Tr\u1eafng', diceIds: [1, 1, 1, 0] },
  { key: '3_trang_1_do', label: '3 Tr\u1eafng 1 \u0110\u1ecf', diceIds: [0, 0, 0, 1] },
];

const VI = {
  pageSuffix: ' - Set T\u00e0i X\u1ec9u',
  pageIntro: '\u0110i\u1ec1u khi\u1ec3n k\u1ebft qu\u1ea3 phi\u00ean ti\u1ebfp theo theo game \u0111ang ch\u1ecdn. D\u1eef li\u1ec7u phi\u00ean v\u00e0 ng\u01b0\u1eddi ch\u01a1i \u0111\u01b0\u1ee3c c\u1eadp nh\u1eadt t\u1ef1 \u0111\u1ed9ng m\u1ed7i 2 gi\u00e2y.',
  refresh: 'L\u00e0m m\u1edbi',
  loading: '\u0110ang t\u1ea3i...',
  session: 'Phi\u00ean',
  phase: 'Tr\u1ea1ng th\u00e1i',
  remain: 'Th\u1eddi gian c\u00f2n',
  pendingResult: 'K\u1ebft qu\u1ea3 ch\u1edd \u00e1p',
  noPending: 'Kh\u00f4ng c\u00f3',
  currentRate: 'T\u1ec9 l\u1ec7 hi\u1ec7n t\u1ea1i',
  jackpotShort: 'N\u1ed5 h\u0169',
  winShort: '\u0102n th\u01b0\u1edfng',
  setupMini: 'Thi\u1ebft l\u1eadp t\u1ec9 l\u1ec7 MiniPoker',
  jackpotRate: 'T\u1ec9 l\u1ec7 n\u1ed5 h\u0169 (%)',
  winRate: 'T\u1ec9 l\u1ec7 \u0103n th\u01b0\u1edfng (%)',
  saveRate: 'L\u01b0u t\u1ec9 l\u1ec7',
  saving: '\u0110ang l\u01b0u...',
  loadCurrentRate: 'T\u1ea3i t\u1ec9 l\u1ec7 hi\u1ec7n t\u1ea1i',
  setupResult: 'Thi\u1ebft l\u1eadp k\u1ebft qu\u1ea3',
  toTai: 'V\u1ec1 T\u00e0i',
  toXiu: 'V\u1ec1 X\u1ec9u',
  tripleTai: 'Tam hoa T\u00e0i',
  tripleXiu: 'Tam hoa X\u1ec9u',
  xValue: 'Gi\u00e1 tr\u1ecb X (0-5)',
  xPot: 'C\u1eeda X (0-5)',
  white: 'Tr\u1eafng (0)',
  red: '\u0110\u1ecf (1)',
  setNextResult: 'Set k\u1ebft qu\u1ea3 phi\u00ean ti\u1ebfp',
  setting: '\u0110ang set...',
  clearForce: 'X\u00f3a can thi\u1ec7p',
  sessionInfo: 'Th\u00f4ng tin phi\u00ean',
  sessionTime: 'Th\u1eddi gian phi\u00ean',
  leftTime: 'C\u00f2n l\u1ea1i',
  result: 'K\u1ebft qu\u1ea3',
  noResult: 'Ch\u01b0a c\u00f3 k\u1ebft qu\u1ea3',
  totalBet: 'T\u1ed5ng ti\u1ec1n c\u01b0\u1ee3c',
  scope: 'Ph\u1ea1m vi',
  door: 'C\u1eeda',
  realBet: 'Ti\u1ec1n ng\u01b0\u1eddi ch\u01a1i \u0111\u1eb7t',
  noDoorData: 'Ch\u01b0a c\u00f3 d\u1eef li\u1ec7u ti\u1ec1n c\u1eeda trong phi\u00ean hi\u1ec7n t\u1ea1i',
  playersTitle: 'Ng\u01b0\u1eddi ch\u01a1i tham gia c\u01b0\u1ee3c (g\u1ed9p theo phi\u00ean)',
  top: 'Top',
  player: 'Ng\u01b0\u1eddi ch\u01a1i',
  total: 'T\u1ed5ng c\u01b0\u1ee3c',
  count: 'S\u1ed1 l\u1ea7n c\u01b0\u1ee3c',
  detail: 'Chi ti\u1ebft c\u1eeda',
  lastTime: 'L\u1ea7n cu\u1ed1i',
  noPlayerData: 'Ch\u01b0a c\u00f3 ng\u01b0\u1eddi ch\u01a1i \u0111\u1eb7t c\u01b0\u1ee3c trong phi\u00ean hi\u1ec7n t\u1ea1i',
  miniSaved: '[MiniPoker] \u0110\u00e3 l\u01b0u t\u1ec9 l\u1ec7 n\u1ed5 h\u0169 / \u0103n th\u01b0\u1edfng',
};

const clampInt = (value, min, max, fallback) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(n)));
};

const clampPercent = (value, fallback) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(100, Math.round(n * 10000) / 10000));
};

const randomDice1To6 = () => 1 + Math.floor(Math.random() * 6);

const pickTxDiceByDoor = (door) => {
  for (let i = 0; i < 300; i += 1) {
    const d1 = randomDice1To6();
    const d2 = randomDice1To6();
    const d3 = randomDice1To6();
    const total = d1 + d2 + d3;
    if (door === 'tai' && total >= 11) return [d1, d2, d3];
    if (door === 'xiu' && total <= 10) return [d1, d2, d3];
  }
  return door === 'tai' ? [4, 4, 3] : [1, 2, 3];
};

const buildTxQuickPayload = (game, quickType) => {
  let dice = [1, 1, 1];
  if (quickType === 'tai') dice = pickTxDiceByDoor('tai');
  else if (quickType === 'xiu') dice = pickTxDiceByDoor('xiu');
  else if (quickType === 'tam_hoa_tai') dice = [6, 6, 6];
  else if (quickType === 'tam_hoa_xiu') dice = [1, 1, 1];

  return { game, dice1: dice[0], dice2: dice[1], dice3: dice[2] };
};

const buildBauCuaQuickPayload = (game, doorId) => {
  const safeDoor = clampInt(doorId, 0, 5, 0);
  return {
    game,
    dice1: safeDoor,
    dice2: safeDoor,
    dice3: safeDoor,
    xValue: 0,
    xPot: 0,
  };
};

const buildXocDiaQuickPayload = (game, quickKey) => {
  const found = XOCDIA_QUICK_OPTIONS.find((item) => item.key === quickKey) || XOCDIA_QUICK_OPTIONS[0];
  return { game, diceIds: found.diceIds.slice(0, 4) };
};

const formatPending = (snapshot, game) => {
  const pending = snapshot?.forcedNextResult;
  if (!pending) return VI.noPending;

  if (game === 'xocdia') {
    if (Array.isArray(pending.diceIds)) return pending.diceIds.join('-');
    return JSON.stringify(pending);
  }

  if (game === 'baucua') {
    return `${pending.dice1}-${pending.dice2}-${pending.dice3} | xPot=${pending.xPot || 0}, xValue=${pending.xValue || 0}`;
  }

  if (pending.dice1 != null && pending.dice2 != null && pending.dice3 != null) {
    return `${pending.dice1}-${pending.dice2}-${pending.dice3}`;
  }

  return JSON.stringify(pending);
};

const hasNumericRates = (data) => Number.isFinite(Number(data?.jackpotRatePercent)) && Number.isFinite(Number(data?.winRatePercent));

const cardStyle = {
  border: '1px solid #e2e8f0',
  borderRadius: 14,
  background: '#ffffff',
  padding: 16,
  boxShadow: '0 2px 8px rgba(15,23,42,0.04)',
};

const primaryButton = {
  border: 'none',
  borderRadius: 9,
  padding: '9px 14px',
  background: '#2563eb',
  color: '#fff',
  fontWeight: 700,
  cursor: 'pointer',
};

const secondaryButton = {
  border: '1px solid #cbd5e1',
  borderRadius: 9,
  padding: '9px 14px',
  background: '#fff',
  color: '#0f172a',
  fontWeight: 600,
  cursor: 'pointer',
};

export default function SetTaiXiuManager({ game }) {
  const meta = GAME_META[game] || GAME_META.double;
  const { invoke } = useIpc();
  const { showToast } = useToast();

  const [snapshot, setSnapshot] = useState(null);
  const [form, setForm] = useState(DEFAULT_FORM[game] || DEFAULT_FORM.double);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [miniRateDirty, setMiniRateDirty] = useState(false);

  const isMiniPoker = meta.mode === 'minipoker';
  const sessionInfo = snapshot?.sessionInfo || null;
  const playerBets = Array.isArray(snapshot?.playerBets) ? snapshot.playerBets : [];

  const setField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (isMiniPoker && (key === 'jackpotRatePercent' || key === 'winRatePercent')) {
      setMiniRateDirty(true);
    }
  };

  const loadControlState = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const result = await invoke('get-taixiu-set-control-state', { game });
      if (!result?.success) {
        throw new Error(result?.message || 'Kh\u00f4ng t\u1ea3i \u0111\u01b0\u1ee3c tr\u1ea1ng th\u00e1i \u0111i\u1ec1u khi\u1ec3n');
      }
      const data = result?.data || null;
      setSnapshot(data);

      if (isMiniPoker && data && hasNumericRates(data) && (!silent || !miniRateDirty)) {
        setForm((prev) => ({
          ...prev,
          jackpotRatePercent: String(data.jackpotRatePercent),
          winRatePercent: String(data.winRatePercent),
        }));
      }
    } catch (error) {
      if (!silent) showToast(`[${meta.label}] ${error.message}`, 'error');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [game, invoke, isMiniPoker, meta.label, miniRateDirty, showToast]);

  const loadMiniPokerRates = useCallback(async (silent = false) => {
    if (!isMiniPoker) return;
    try {
      const result = await invoke('get-taixiu-minipoker-rates');
      if (!result?.success) {
        throw new Error(result?.message || 'Kh\u00f4ng t\u1ea3i \u0111\u01b0\u1ee3c t\u1ec9 l\u1ec7 MiniPoker');
      }
      const data = result?.data || null;
      if (data && hasNumericRates(data)) {
        setSnapshot((prev) => ({ ...(prev || {}), ...data }));
        setForm((prev) => ({
          ...prev,
          jackpotRatePercent: String(data.jackpotRatePercent),
          winRatePercent: String(data.winRatePercent),
        }));
        setMiniRateDirty(false);
      }
    } catch (error) {
      if (!silent) showToast(`[MiniPoker] ${error.message}`, 'error');
    }
  }, [invoke, isMiniPoker, showToast]);

  useEffect(() => {
    setForm(DEFAULT_FORM[game] || DEFAULT_FORM.double);
    setSnapshot(null);
    setMiniRateDirty(false);
    void loadControlState(false);
    if (isMiniPoker) void loadMiniPokerRates(true);

    const timer = setInterval(() => {
      void loadControlState(true);
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [game, isMiniPoker, loadControlState, loadMiniPokerRates]);

  const payloadForForce = useMemo(() => {
    if (meta.mode === 'dice3') {
      return {
        game,
        dice1: clampInt(form.dice1, 1, 6, 1),
        dice2: clampInt(form.dice2, 1, 6, 1),
        dice3: clampInt(form.dice3, 1, 6, 1),
      };
    }

    if (meta.mode === 'baucua') {
      const xValue = clampInt(form.xValue, 0, 5, 0);
      const payload = {
        game,
        dice1: clampInt(form.dice1, 0, 5, 0),
        dice2: clampInt(form.dice2, 0, 5, 1),
        dice3: clampInt(form.dice3, 0, 5, 2),
        xValue,
      };
      if (xValue > 1) payload.xPot = clampInt(form.xPot, 0, 5, 0);
      return payload;
    }

    if (meta.mode === 'xocdia') {
      return {
        game,
        diceIds: [
          clampInt(form.dice1, 0, 1, 0),
          clampInt(form.dice2, 0, 1, 1),
          clampInt(form.dice3, 0, 1, 0),
          clampInt(form.dice4, 0, 1, 1),
        ],
      };
    }

    return { game };
  }, [form, game, meta.mode]);

  const applyForcePayload = async (payload, successText) => {
    setSubmitting(true);
    try {
      const result = await invoke('set-taixiu-set-force-result', payload);
      if (!result?.success) throw new Error(result?.message || '\u0110\u1eb7t k\u1ebft qu\u1ea3 th\u1ea5t b\u1ea1i');
      setSnapshot((prev) => ({ ...(prev || {}), ...(result?.data || {}) }));
      showToast(`[${meta.label}] ${successText}`, 'success');
      await loadControlState(true);
    } catch (error) {
      showToast(`[${meta.label}] ${error.message}`, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const onQuickSetTxResult = async (quickType) => {
    if (meta.mode !== 'dice3') return;
    const payload = buildTxQuickPayload(game, quickType);
    setForm((prev) => ({ ...prev, dice1: String(payload.dice1), dice2: String(payload.dice2), dice3: String(payload.dice3) }));
    await applyForcePayload(payload, `\u0110\u00e3 \u0111\u1eb7t nhanh: ${quickType.toUpperCase()}`);
  };

  const onQuickSetBauCua = async (doorId, doorLabel) => {
    if (meta.mode !== 'baucua') return;
    const payload = buildBauCuaQuickPayload(game, doorId);
    setForm((prev) => ({ ...prev, dice1: String(payload.dice1), dice2: String(payload.dice2), dice3: String(payload.dice3), xValue: '0', xPot: '0' }));
    await applyForcePayload(payload, `\u0110\u00e3 \u0111\u1eb7t nhanh: V\u1ec1 ${doorLabel}`);
  };

  const onQuickSetXocDia = async (quickKey) => {
    if (meta.mode !== 'xocdia') return;
    const payload = buildXocDiaQuickPayload(game, quickKey);
    const diceIds = Array.isArray(payload.diceIds) ? payload.diceIds : [0, 1, 0, 1];
    setForm((prev) => ({ ...prev, dice1: String(diceIds[0]), dice2: String(diceIds[1]), dice3: String(diceIds[2]), dice4: String(diceIds[3]) }));
    const option = XOCDIA_QUICK_OPTIONS.find((item) => item.key === quickKey);
    await applyForcePayload(payload, `\u0110\u00e3 \u0111\u1eb7t nhanh: ${option?.label || quickKey}`);
  };

  const onSetForce = async () => {
    await applyForcePayload(payloadForForce, '\u0110\u00e3 set k\u1ebft qu\u1ea3 phi\u00ean ti\u1ebfp theo');
  };

  const onClearForce = async () => {
    setSubmitting(true);
    try {
      const result = await invoke('clear-taixiu-set-force-result', { game });
      if (!result?.success) throw new Error(result?.message || 'X\u00f3a can thi\u1ec7p th\u1ea5t b\u1ea1i');
      setSnapshot((prev) => ({ ...(prev || {}), ...(result?.data || {}) }));
      showToast(`[${meta.label}] \u0110\u00e3 x\u00f3a can thi\u1ec7p k\u1ebft qu\u1ea3`, 'success');
      await loadControlState(true);
    } catch (error) {
      showToast(`[${meta.label}] ${error.message}`, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const onSaveMiniPokerRates = async () => {
    setSubmitting(true);
    try {
      const jackpotRatePercent = clampPercent(form.jackpotRatePercent, 0.02);
      let winRatePercent = clampPercent(form.winRatePercent, 43);
      if (winRatePercent < jackpotRatePercent) winRatePercent = jackpotRatePercent;

      const payload = { jackpotRatePercent, winRatePercent };
      const result = await invoke('save-taixiu-minipoker-rates', payload);
      if (!result?.success) throw new Error(result?.message || 'L\u01b0u t\u1ec9 l\u1ec7 th\u1ea5t b\u1ea1i');

      const data = result?.data || payload;
      setSnapshot((prev) => ({ ...(prev || {}), ...data }));
      setForm((prev) => ({
        ...prev,
        jackpotRatePercent: String(data.jackpotRatePercent ?? jackpotRatePercent),
        winRatePercent: String(data.winRatePercent ?? winRatePercent),
      }));
      setMiniRateDirty(false);

      showToast(VI.miniSaved, 'success');
      await loadControlState(true);
    } catch (error) {
      showToast(`[MiniPoker] ${error.message}`, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ marginBottom: 8 }}>{meta.label}{VI.pageSuffix}</h1>
      <p style={{ marginBottom: 16, color: '#64748b' }}>{VI.pageIntro}</p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))', gap: 16, marginBottom: 16 }}>
        <div style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div style={{ fontWeight: 700 }}>{meta.label}</div>
            <button
              onClick={() => loadControlState(false)}
              disabled={loading}
              style={{ ...secondaryButton, padding: '6px 10px', cursor: loading ? 'wait' : 'pointer' }}
            >
              {loading ? VI.loading : VI.refresh}
            </button>
          </div>

          <div style={{ fontSize: 13, color: '#334155', lineHeight: 1.7 }}>
            <div><b>{VI.session}:</b> #{snapshot?.referenceId || 0}</div>
            <div><b>{VI.phase}:</b> {snapshot?.phase || '-'}</div>
            <div><b>{VI.remain}:</b> {snapshot?.remainTime || 0}s</div>
            {!isMiniPoker ? <div><b>{VI.pendingResult}:</b> {formatPending(snapshot, game)}</div> : null}
            {isMiniPoker ? <div><b>{VI.currentRate}:</b> {VI.jackpotShort} {snapshot?.jackpotRatePercent ?? '-'}% | {VI.winShort} {snapshot?.winRatePercent ?? '-'}%</div> : null}
          </div>
        </div>

        <div style={cardStyle}>
          {isMiniPoker ? (
            <>
              <h3 style={{ marginTop: 0, marginBottom: 10 }}>{VI.setupMini}</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                <div>
                  <div style={{ fontSize: 12, color: '#475569', marginBottom: 4 }}>{VI.jackpotRate}</div>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={0.0001}
                    value={form.jackpotRatePercent}
                    onChange={(e) => setField('jackpotRatePercent', e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', border: '1px solid #cbd5e1', borderRadius: 8 }}
                  />
                </div>
                <div>
                  <div style={{ fontSize: 12, color: '#475569', marginBottom: 4 }}>{VI.winRate}</div>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={0.01}
                    value={form.winRatePercent}
                    onChange={(e) => setField('winRatePercent', e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', border: '1px solid #cbd5e1', borderRadius: 8 }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                <button
                  onClick={onSaveMiniPokerRates}
                  disabled={submitting}
                  style={{ ...primaryButton, cursor: submitting ? 'wait' : 'pointer', opacity: submitting ? 0.7 : 1 }}
                >
                  {submitting ? VI.saving : VI.saveRate}
                </button>
                <button
                  onClick={() => loadMiniPokerRates(false)}
                  disabled={submitting}
                  style={{ ...secondaryButton, cursor: submitting ? 'wait' : 'pointer', opacity: submitting ? 0.7 : 1 }}
                >
                  {VI.loadCurrentRate}
                </button>
              </div>
            </>
          ) : (
            <>
              <h3 style={{ marginTop: 0, marginBottom: 10 }}>{VI.setupResult}</h3>

              {meta.mode === 'dice3' && (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 10 }}>
                    {['dice1', 'dice2', 'dice3'].map((key) => (
                      <input
                        key={key}
                        type="number"
                        min={1}
                        max={6}
                        value={form[key]}
                        onChange={(e) => setField(key, e.target.value)}
                        style={{ width: '100%', padding: '8px 10px', border: '1px solid #cbd5e1', borderRadius: 8 }}
                      />
                    ))}
                  </div>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                    <button onClick={() => onQuickSetTxResult('tai')} disabled={submitting} style={{ ...primaryButton, background: '#0ea5e9', opacity: submitting ? 0.7 : 1 }}>{VI.toTai}</button>
                    <button onClick={() => onQuickSetTxResult('xiu')} disabled={submitting} style={{ ...primaryButton, background: '#f59e0b', opacity: submitting ? 0.7 : 1 }}>{VI.toXiu}</button>
                    <button onClick={() => onQuickSetTxResult('tam_hoa_tai')} disabled={submitting} style={{ ...secondaryButton, color: '#0ea5e9', borderColor: '#0ea5e9', opacity: submitting ? 0.7 : 1 }}>{VI.tripleTai}</button>
                    <button onClick={() => onQuickSetTxResult('tam_hoa_xiu')} disabled={submitting} style={{ ...secondaryButton, color: '#b45309', borderColor: '#f59e0b', opacity: submitting ? 0.7 : 1 }}>{VI.tripleXiu}</button>
                  </div>
                </>
              )}

              {meta.mode === 'baucua' && (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 10 }}>
                    {['dice1', 'dice2', 'dice3'].map((key) => (
                      <input
                        key={key}
                        type="number"
                        min={0}
                        max={5}
                        value={form[key]}
                        onChange={(e) => setField(key, e.target.value)}
                        style={{ width: '100%', padding: '8px 10px', border: '1px solid #cbd5e1', borderRadius: 8 }}
                      />
                    ))}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
                    <input type="number" min={0} max={5} value={form.xValue} onChange={(e) => setField('xValue', e.target.value)} placeholder={VI.xValue} style={{ width: '100%', padding: '8px 10px', border: '1px solid #cbd5e1', borderRadius: 8 }} />
                    <input type="number" min={0} max={5} value={form.xPot} onChange={(e) => setField('xPot', e.target.value)} placeholder={VI.xPot} style={{ width: '100%', padding: '8px 10px', border: '1px solid #cbd5e1', borderRadius: 8 }} />
                  </div>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                    {BAUCUA_DOORS.map((door) => (
                      <button key={door.id} onClick={() => onQuickSetBauCua(door.id, door.label)} disabled={submitting} style={{ ...secondaryButton, opacity: submitting ? 0.7 : 1 }}>
                        {`V\u1ec1 ${door.label}`}
                      </button>
                    ))}
                  </div>
                </>
              )}

              {meta.mode === 'xocdia' && (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, marginBottom: 10 }}>
                    {['dice1', 'dice2', 'dice3', 'dice4'].map((key) => (
                      <select key={key} value={form[key]} onChange={(e) => setField(key, e.target.value)} style={{ width: '100%', padding: '8px 10px', border: '1px solid #cbd5e1', borderRadius: 8 }}>
                        <option value="0">{VI.white}</option>
                        <option value="1">{VI.red}</option>
                      </select>
                    ))}
                  </div>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                    {XOCDIA_QUICK_OPTIONS.map((item) => (
                      <button key={item.key} onClick={() => onQuickSetXocDia(item.key)} disabled={submitting} style={{ ...secondaryButton, opacity: submitting ? 0.7 : 1 }}>{item.label}</button>
                    ))}
                  </div>
                </>
              )}

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                <button onClick={onSetForce} disabled={submitting} style={{ ...primaryButton, cursor: submitting ? 'wait' : 'pointer', opacity: submitting ? 0.7 : 1 }}>
                  {submitting ? VI.setting : VI.setNextResult}
                </button>
                <button onClick={onClearForce} disabled={submitting} style={{ ...secondaryButton, borderColor: '#ef4444', color: '#ef4444', cursor: submitting ? 'wait' : 'pointer', opacity: submitting ? 0.7 : 1 }}>
                  {VI.clearForce}
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <div style={{ ...cardStyle, maxWidth: 1080 }}>
        <h3 style={{ marginTop: 0, marginBottom: 12 }}>{VI.sessionInfo}</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 10, marginBottom: 12 }}>
          <div><b>{VI.session}:</b> #{sessionInfo?.referenceId || 0}</div>
          <div><b>{VI.sessionTime}:</b> {sessionInfo?.sessionTime || '-'}</div>
          <div><b>{VI.phase}:</b> {sessionInfo?.phase || '-'}</div>
          <div><b>{VI.leftTime}:</b> {sessionInfo?.remainTime || 0}s</div>
          <div style={{ gridColumn: '1 / -1' }}><b>{VI.result}:</b> {sessionInfo?.result || VI.noResult}</div>
          <div><b>{VI.totalBet}:</b> {formatAmount(sessionInfo?.totalBet || 0)}</div>
          {sessionInfo?.scope ? <div><b>{VI.scope}:</b> {sessionInfo.scope}</div> : null}
        </div>

        <div style={{ overflowX: 'auto', marginBottom: 16 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 360 }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                <th style={{ textAlign: 'left', padding: 8, border: '1px solid #e2e8f0' }}>{VI.door}</th>
                <th style={{ textAlign: 'right', padding: 8, border: '1px solid #e2e8f0' }}>{VI.realBet}</th>
              </tr>
            </thead>
            <tbody>
              {(Array.isArray(sessionInfo?.doorTotals) ? sessionInfo.doorTotals : []).map((door) => (
                <tr key={`${door.doorId}-${door.label}`}>
                  <td style={{ padding: 8, border: '1px solid #e2e8f0' }}>{door.label}</td>
                  <td style={{ padding: 8, border: '1px solid #e2e8f0', textAlign: 'right', fontWeight: 700 }}>{formatAmount(door.totalBet || 0)}</td>
                </tr>
              ))}
              {(!sessionInfo?.doorTotals || sessionInfo.doorTotals.length === 0) ? (
                <tr>
                  <td colSpan={2} style={{ padding: 8, border: '1px solid #e2e8f0', textAlign: 'center', color: '#64748b' }}>{VI.noDoorData}</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <h3 style={{ marginTop: 0, marginBottom: 10 }}>{VI.playersTitle}</h3>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 840 }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                <th style={{ textAlign: 'center', padding: 8, border: '1px solid #e2e8f0' }}>{VI.top}</th>
                <th style={{ textAlign: 'left', padding: 8, border: '1px solid #e2e8f0' }}>{VI.player}</th>
                <th style={{ textAlign: 'right', padding: 8, border: '1px solid #e2e8f0' }}>{VI.total}</th>
                <th style={{ textAlign: 'right', padding: 8, border: '1px solid #e2e8f0' }}>{VI.count}</th>
                <th style={{ textAlign: 'left', padding: 8, border: '1px solid #e2e8f0' }}>{VI.detail}</th>
                <th style={{ textAlign: 'left', padding: 8, border: '1px solid #e2e8f0' }}>{VI.lastTime}</th>
              </tr>
            </thead>
            <tbody>
              {playerBets.map((row, index) => {
                const details = (Array.isArray(row.doorBets) ? row.doorBets : [])
                  .filter((item) => Number(item.totalBet || 0) > 0)
                  .map((item) => `${item.label}: ${formatAmount(item.totalBet || 0)}`)
                  .join(' | ');

                return (
                  <tr key={`${row.userId || row.nickname}-${index}`}>
                    <td style={{ textAlign: 'center', padding: 8, border: '1px solid #e2e8f0' }}>{index + 1}</td>
                    <td style={{ padding: 8, border: '1px solid #e2e8f0' }}>{row.nickname || '-'}</td>
                    <td style={{ textAlign: 'right', padding: 8, border: '1px solid #e2e8f0', fontWeight: 700 }}>{formatAmount(row.totalBet || 0)}</td>
                    <td style={{ textAlign: 'right', padding: 8, border: '1px solid #e2e8f0' }}>{row.betCount || 0}</td>
                    <td style={{ padding: 8, border: '1px solid #e2e8f0' }}>{details || '-'}</td>
                    <td style={{ padding: 8, border: '1px solid #e2e8f0' }}>{row.lastBetTime || '-'}</td>
                  </tr>
                );
              })}
              {playerBets.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: 8, border: '1px solid #e2e8f0', textAlign: 'center', color: '#64748b' }}>{VI.noPlayerData}</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

