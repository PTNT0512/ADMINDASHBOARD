import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useIpc, useToast } from './ToastContext';

const POLL_MS = 2000;

const DEFAULT_CONTROL = {
  mode: 'auto',
  direction: 'up',
  strength: 60,
  targetPrice: '',
};

const DEFAULT_ORDER_POLICY = {
  enabled: false,
  mode: 'kill_small',
  thresholdAmount: 200,
};

const EMPTY_ORDER_BOOK = {
  activeOrders: [],
  recentOrders: [],
  totalActiveOrders: 0,
  totalActiveAmount: 0,
  totalCallOrders: 0,
  totalPutOrders: 0,
  totalCallAmount: 0,
  totalPutAmount: 0,
};

const DEFAULT_SIDE_BREAK = {
  active: false,
  loseSide: null,
  startAt: 0,
  endAt: 0,
  remainingMs: 0,
  remainingSec: 0,
};

const DEFAULT_CANDLE_STATE = {
  durationMs: 60000,
  startAt: 0,
  endAt: 0,
  remainingMs: 0,
  remainingSec: 0,
};

const clamp = (value, min, max, fallback) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
};

const normalizeControlForm = (raw = {}) => {
  const modeRaw = String(raw?.mode || DEFAULT_CONTROL.mode).trim().toLowerCase();
  const mode = ['auto', 'bias', 'target'].includes(modeRaw) ? modeRaw : DEFAULT_CONTROL.mode;
  const direction = String(raw?.direction || DEFAULT_CONTROL.direction).toLowerCase() === 'down' ? 'down' : 'up';
  const strength = Math.round(clamp(raw?.strength, 1, 100, DEFAULT_CONTROL.strength));

  const targetRaw = Number(raw?.targetPrice);
  const targetPrice = Number.isFinite(targetRaw) && targetRaw > 0 ? String(targetRaw) : '';

  return {
    mode,
    direction,
    strength,
    targetPrice,
  };
};

const normalizeOrderPolicy = (raw = {}) => {
  const enabled = raw?.enabled === true;
  const modeRaw = String(raw?.mode || DEFAULT_ORDER_POLICY.mode).trim().toLowerCase();
  const mode = ['kill_small', 'kill_big'].includes(modeRaw) ? modeRaw : DEFAULT_ORDER_POLICY.mode;
  const thresholdRaw = Number(raw?.thresholdAmount);
  const thresholdAmount = Number.isFinite(thresholdRaw)
    ? Math.max(1, Math.floor(thresholdRaw))
    : DEFAULT_ORDER_POLICY.thresholdAmount;

  return {
    enabled,
    mode,
    thresholdAmount,
  };
};

const formatNumber = (value, digits = 2) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return '-';
  return n.toLocaleString('vi-VN', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
};

const formatWholeNumber = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return '-';
  return n.toLocaleString('vi-VN');
};

const formatPercent = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return '-';
  const sign = n > 0 ? '+' : '';
  return `${sign}${n.toFixed(2)}%`;
};

const getMarketRow = (snapshot) => {
  const marketId = snapshot?.defaultMarketId || 'okcoin';
  return snapshot?.markets?.[marketId] || null;
};

const normalizeOrderBook = (raw = {}) => {
  const activeOrders = Array.isArray(raw?.activeOrders) ? raw.activeOrders : [];
  const recentOrders = Array.isArray(raw?.recentOrders) ? raw.recentOrders : [];
  return {
    activeOrders,
    recentOrders,
    totalActiveOrders: Number(raw?.totalActiveOrders || activeOrders.length || 0),
    totalActiveAmount: Number(raw?.totalActiveAmount || 0),
    totalCallOrders: Number(raw?.totalCallOrders || 0),
    totalPutOrders: Number(raw?.totalPutOrders || 0),
    totalCallAmount: Number(raw?.totalCallAmount || 0),
    totalPutAmount: Number(raw?.totalPutAmount || 0),
  };
};

const normalizeSideBreak = (raw = {}) => {
  const loseSideRaw = String(raw?.loseSide || '').trim().toUpperCase();
  const loseSide = loseSideRaw === 'CALL' || loseSideRaw === 'PUT' ? loseSideRaw : null;
  const endAt = Number(raw?.endAt || 0);
  const startAt = Number(raw?.startAt || 0);
  const active = raw?.active === true && loseSide != null && endAt > 0;
  const remainingMsRaw = Number(raw?.remainingMs);
  const remainingMs = Number.isFinite(remainingMsRaw) && remainingMsRaw > 0 ? Math.floor(remainingMsRaw) : 0;

  return {
    active,
    loseSide: active ? loseSide : null,
    startAt: Number.isFinite(startAt) && startAt > 0 ? Math.floor(startAt) : 0,
    endAt: active ? Math.floor(endAt) : 0,
    remainingMs,
    remainingSec: Math.max(0, Math.ceil(remainingMs / 1000)),
  };
};

const normalizeCandleState = (raw = {}) => {
  const durationMsRaw = Number(raw?.durationMs || raw?.candleDurationMs || 60000);
  const durationMs = Number.isFinite(durationMsRaw) && durationMsRaw > 0 ? Math.floor(durationMsRaw) : 60000;
  const startAtRaw = Number(raw?.startAt || raw?.lastCandleAt || 0);
  const endAtRaw = Number(raw?.endAt || 0);
  const remainingMsRaw = Number(raw?.remainingMs || 0);
  const remainingMs = Number.isFinite(remainingMsRaw) && remainingMsRaw > 0 ? Math.floor(remainingMsRaw) : 0;

  return {
    durationMs,
    startAt: Number.isFinite(startAtRaw) && startAtRaw > 0 ? Math.floor(startAtRaw) : 0,
    endAt: Number.isFinite(endAtRaw) && endAtRaw > 0 ? Math.floor(endAtRaw) : 0,
    remainingMs,
    remainingSec: Math.max(0, Math.ceil(remainingMs / 1000)),
  };
};

export default function TradingMarketControl() {
  const { invoke } = useIpc();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [savingControl, setSavingControl] = useState(false);
  const [savingPolicy, setSavingPolicy] = useState(false);
  const [actingOrderId, setActingOrderId] = useState('');
  const [breakingSide, setBreakingSide] = useState('');
  const [clockNow, setClockNow] = useState(Date.now());

  const [snapshot, setSnapshot] = useState(null);
  const [currentControl, setCurrentControl] = useState(DEFAULT_CONTROL);
  const [sideBreak, setSideBreak] = useState(DEFAULT_SIDE_BREAK);
  const [candleState, setCandleState] = useState(DEFAULT_CANDLE_STATE);
  const [controlForm, setControlForm] = useState(DEFAULT_CONTROL);
  const [orderPolicy, setOrderPolicy] = useState(DEFAULT_ORDER_POLICY);
  const [policyForm, setPolicyForm] = useState(DEFAULT_ORDER_POLICY);
  const [orderBook, setOrderBook] = useState(EMPTY_ORDER_BOOK);
  const [snapshotSync, setSnapshotSync] = useState({ serverTime: 0, receivedAt: 0 });
  const [filterKeyword, setFilterKeyword] = useState('');
  const [filterSide, setFilterSide] = useState('all');
  const [filterControl, setFilterControl] = useState('all');
  const [filterMinAmount, setFilterMinAmount] = useState('');
  const [filterMaxAmount, setFilterMaxAmount] = useState('');

  const market = useMemo(() => getMarketRow(snapshot), [snapshot]);
  const controlActive = useMemo(() => currentControl?.mode && currentControl.mode !== 'auto', [currentControl]);
  const filteredActiveOrders = useMemo(() => {
    const source = Array.isArray(orderBook?.activeOrders) ? orderBook.activeOrders : [];
    if (source.length === 0) return [];

    const keyword = String(filterKeyword || '').trim().toLowerCase();
    const minRaw = Number(filterMinAmount);
    const maxRaw = Number(filterMaxAmount);
    const minAmount = Number.isFinite(minRaw) && minRaw > 0 ? Math.floor(minRaw) : null;
    const maxAmount = Number.isFinite(maxRaw) && maxRaw > 0 ? Math.floor(maxRaw) : null;

    return source.filter((order) => {
      const orderId = String(order?.orderId || '');
      const username = String(order?.username || '').toLowerCase();
      const userId = String(order?.userId || '');
      const side = String(order?.side || '').toUpperCase();
      const amount = Number(order?.amount || 0);
      const manualControl = String(order?.manualControl || '').toLowerCase();
      const controlState = manualControl === 'kill' || manualControl === 'nurture' ? manualControl : 'auto';

      if (keyword) {
        const orderIdText = orderId.toLowerCase();
        if (!orderIdText.includes(keyword) && !username.includes(keyword) && !userId.includes(keyword)) {
          return false;
        }
      }

      if (filterSide !== 'all' && side !== filterSide) {
        return false;
      }

      if (filterControl !== 'all' && controlState !== filterControl) {
        return false;
      }

      if (minAmount != null && amount < minAmount) {
        return false;
      }
      if (maxAmount != null && amount > maxAmount) {
        return false;
      }

      return true;
    });
  }, [orderBook?.activeOrders, filterKeyword, filterSide, filterControl, filterMinAmount, filterMaxAmount]);

  const sideSummary = useMemo(() => {
    const source = Array.isArray(orderBook?.activeOrders) ? orderBook.activeOrders : [];
    const fallback = source.reduce((acc, item) => {
      const side = String(item?.side || '').toUpperCase();
      const amount = Number(item?.amount || 0);
      if (side === 'CALL') {
        acc.totalCallOrders += 1;
        acc.totalCallAmount += amount;
      } else if (side === 'PUT') {
        acc.totalPutOrders += 1;
        acc.totalPutAmount += amount;
      }
      return acc;
    }, { totalCallOrders: 0, totalPutOrders: 0, totalCallAmount: 0, totalPutAmount: 0 });

    const totalCallOrdersRaw = Number(orderBook?.totalCallOrders);
    const totalPutOrdersRaw = Number(orderBook?.totalPutOrders);
    const totalCallAmountRaw = Number(orderBook?.totalCallAmount);
    const totalPutAmountRaw = Number(orderBook?.totalPutAmount);

    const totalCallOrders = Number.isFinite(totalCallOrdersRaw) && totalCallOrdersRaw >= 0
      ? totalCallOrdersRaw
      : fallback.totalCallOrders;
    const totalPutOrders = Number.isFinite(totalPutOrdersRaw) && totalPutOrdersRaw >= 0
      ? totalPutOrdersRaw
      : fallback.totalPutOrders;
    const totalCallAmount = Number.isFinite(totalCallAmountRaw) && totalCallAmountRaw >= 0
      ? totalCallAmountRaw
      : fallback.totalCallAmount;
    const totalPutAmount = Number.isFinite(totalPutAmountRaw) && totalPutAmountRaw >= 0
      ? totalPutAmountRaw
      : fallback.totalPutAmount;

    return {
      totalCallOrders,
      totalPutOrders,
      totalCallAmount,
      totalPutAmount,
    };
  }, [orderBook]);

  const estimatedServerNow = useMemo(() => {
    const serverTime = Number(snapshotSync?.serverTime || snapshot?.serverTime || 0);
    const receivedAt = Number(snapshotSync?.receivedAt || 0);
    if (Number.isFinite(serverTime) && serverTime > 0 && Number.isFinite(receivedAt) && receivedAt > 0) {
      return serverTime + Math.max(0, clockNow - receivedAt);
    }
    return clockNow;
  }, [snapshotSync, snapshot?.serverTime, clockNow]);

  const liveCandleState = useMemo(() => {
    const durationMsRaw = Number(snapshot?.candleDurationMs || candleState?.durationMs || 60000);
    const durationMs = Number.isFinite(durationMsRaw) && durationMsRaw > 0 ? Math.floor(durationMsRaw) : 60000;
    const startAtRaw = Number(snapshot?.lastCandleAt || candleState?.startAt || 0);
    if (!Number.isFinite(startAtRaw) || startAtRaw <= 0) {
      return {
        ...DEFAULT_CANDLE_STATE,
        durationMs,
      };
    }

    const elapsed = Math.max(0, estimatedServerNow - startAtRaw);
    const progressedMs = elapsed % durationMs;
    const remainingMs = progressedMs === 0 ? durationMs : (durationMs - progressedMs);
    return {
      durationMs,
      startAt: Math.floor(startAtRaw),
      endAt: Math.floor(estimatedServerNow + remainingMs),
      remainingMs,
      remainingSec: Math.max(0, Math.ceil(remainingMs / 1000)),
    };
  }, [snapshot, candleState, estimatedServerNow]);

  const liveSideBreak = useMemo(() => {
    const loseSideRaw = String(sideBreak?.loseSide || '').toUpperCase();
    const loseSide = loseSideRaw === 'CALL' || loseSideRaw === 'PUT' ? loseSideRaw : null;
    const endAt = Number(sideBreak?.endAt || 0);
    const active = sideBreak?.active === true && loseSide != null && endAt > estimatedServerNow;
    if (!active) {
      return DEFAULT_SIDE_BREAK;
    }
    const remainingMs = Math.max(0, endAt - estimatedServerNow);
    return {
      active: true,
      loseSide,
      startAt: Number(sideBreak?.startAt || 0),
      endAt,
      remainingMs,
      remainingSec: Math.max(0, Math.ceil(remainingMs / 1000)),
    };
  }, [sideBreak, estimatedServerNow]);

  const applyStatePayload = useCallback((data = {}, preserveControlForm = false, preservePolicyForm = false) => {
    const nextSnapshot = data?.snapshot || null;
    const nextControl = normalizeControlForm(data?.control || DEFAULT_CONTROL);
    const nextSideBreak = normalizeSideBreak(data?.sideBreak || data?.snapshot?.sideBreak || DEFAULT_SIDE_BREAK);
    const nextCandleState = normalizeCandleState(
      data?.candleState
      || data?.snapshot?.candleState
      || { durationMs: data?.snapshot?.candleDurationMs, startAt: data?.snapshot?.lastCandleAt },
    );
    const nextPolicy = normalizeOrderPolicy(data?.orderPolicy || data?.orderBook?.orderPolicy || DEFAULT_ORDER_POLICY);
    const nextOrderBook = normalizeOrderBook(data?.orderBook || EMPTY_ORDER_BOOK);

    setSnapshot(nextSnapshot);
    setCurrentControl(nextControl);
    setSideBreak(nextSideBreak);
    setCandleState(nextCandleState);
    setOrderPolicy(nextPolicy);
    setOrderBook(nextOrderBook);
    if (Number(nextSnapshot?.serverTime) > 0) {
      setSnapshotSync({
        serverTime: Number(nextSnapshot.serverTime),
        receivedAt: Date.now(),
      });
    }

    if (!preserveControlForm) {
      setControlForm(nextControl);
    }
    if (!preservePolicyForm) {
      setPolicyForm(nextPolicy);
    }
  }, []);

  const loadState = useCallback(async () => {
    try {
      const result = await invoke('get-trading-market-control-state');
      if (!result?.success) {
        throw new Error(result?.message || 'Khong tai duoc trang thai thi truong');
      }
      applyStatePayload(result?.data || {}, savingControl, savingPolicy);
    } catch (error) {
      showToast(`Loi tai trang thai thi truong: ${error.message}`, 'danger');
    } finally {
      setLoading(false);
    }
  }, [applyStatePayload, invoke, savingControl, savingPolicy, showToast]);

  useEffect(() => {
    loadState();
    const timer = setInterval(loadState, POLL_MS);
    return () => clearInterval(timer);
  }, [loadState]);

  useEffect(() => {
    const timer = setInterval(() => {
      setClockNow(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const setControlField = (key, value) => {
    setControlForm((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const setPolicyField = (key, value) => {
    setPolicyForm((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const buildControlPayload = () => {
    const payload = {
      mode: controlForm.mode,
      direction: controlForm.direction,
      strength: Math.round(clamp(controlForm.strength, 1, 100, DEFAULT_CONTROL.strength)),
    };

    if (controlForm.mode === 'target') {
      const targetPrice = Number(controlForm.targetPrice);
      if (!Number.isFinite(targetPrice) || targetPrice <= 0) {
        throw new Error('Target price phai lon hon 0');
      }
      payload.targetPrice = targetPrice;
    }

    return payload;
  };

  const applyControl = async () => {
    setSavingControl(true);
    try {
      const payload = buildControlPayload();
      const result = await invoke('set-trading-market-control', payload);
      if (!result?.success) {
        throw new Error(result?.message || 'Cap nhat that bai');
      }

      applyStatePayload(result?.data || {});
      showToast(result?.message || 'Da cap nhat can thiep thi truong', 'success');
    } catch (error) {
      showToast(`Loi cap nhat: ${error.message}`, 'danger');
    } finally {
      setSavingControl(false);
    }
  };

  const applyQuickDirection = async (direction) => {
    setSavingControl(true);
    try {
      const payload = {
        mode: 'bias',
        direction: direction === 'down' ? 'down' : 'up',
        strength: 85,
      };
      const result = await invoke('set-trading-market-control', payload);
      if (!result?.success) {
        throw new Error(result?.message || 'Cap nhat that bai');
      }
      applyStatePayload(result?.data || {});
      showToast(direction === 'down' ? 'Da dat che do GIAM nhanh' : 'Da dat che do TANG nhanh', 'success');
    } catch (error) {
      showToast(`Loi cap nhat nhanh: ${error.message}`, 'danger');
    } finally {
      setSavingControl(false);
    }
  };

  const clearControl = async () => {
    setSavingControl(true);
    try {
      const result = await invoke('clear-trading-market-control');
      if (!result?.success) {
        throw new Error(result?.message || 'Xoa can thiep that bai');
      }
      applyStatePayload(result?.data || {});
      showToast(result?.message || 'Da xoa can thiep thi truong', 'success');
    } catch (error) {
      showToast(`Loi xoa can thiep: ${error.message}`, 'danger');
    } finally {
      setSavingControl(false);
    }
  };

  const triggerSideBreak = async (loseSide) => {
    const side = String(loseSide || '').trim().toUpperCase();
    if (!['CALL', 'PUT'].includes(side)) return;
    setBreakingSide(side);
    try {
      const result = await invoke('set-trading-market-control', { sideBreak: side });
      if (!result?.success) {
        throw new Error(result?.message || 'Bat be lenh that bai');
      }
      applyStatePayload(result?.data || {}, true, true);
      showToast(result?.message || `Da bat be lenh ${side === 'CALL' ? 'MUA' : 'BAN'}`, 'success');
    } catch (error) {
      showToast(`Loi be lenh: ${error.message}`, 'danger');
    } finally {
      setBreakingSide('');
    }
  };

  const clearSideBreakControl = async () => {
    setBreakingSide('CLEAR');
    try {
      const result = await invoke('set-trading-market-control', { clearSideBreak: true });
      if (!result?.success) {
        throw new Error(result?.message || 'Tat be lenh that bai');
      }
      applyStatePayload(result?.data || {}, true, true);
      showToast('Da tat be lenh MUA/BAN', 'success');
    } catch (error) {
      showToast(`Loi tat be lenh: ${error.message}`, 'danger');
    } finally {
      setBreakingSide('');
    }
  };

  const saveOrderPolicy = async () => {
    setSavingPolicy(true);
    try {
      const payload = normalizeOrderPolicy(policyForm);
      const result = await invoke('set-trading-market-order-policy', payload);
      if (!result?.success) {
        throw new Error(result?.message || 'Cap nhat auto lenh that bai');
      }

      const data = result?.data || {};
      const nextPolicy = normalizeOrderPolicy(data?.orderPolicy || payload);
      const nextOrderBook = normalizeOrderBook(data?.orderBook || orderBook);
      setOrderPolicy(nextPolicy);
      setPolicyForm(nextPolicy);
      setOrderBook(nextOrderBook);
      showToast(result?.message || 'Da cap nhat auto xu ly lenh', 'success');
    } catch (error) {
      showToast(`Loi cap nhat auto xu ly lenh: ${error.message}`, 'danger');
    } finally {
      setSavingPolicy(false);
    }
  };

  const setOrderDecision = async (orderId, status) => {
    const id = String(orderId || '').trim();
    if (!id) return;
    setActingOrderId(id);
    try {
      const result = await invoke('set-trading-market-order-control', { orderId: id, status });
      if (!result?.success) {
        throw new Error(result?.message || 'Can thiep lenh that bai');
      }
      const data = result?.data || {};
      if (data?.orderBook) {
        setOrderBook(normalizeOrderBook(data.orderBook));
      } else {
        await loadState();
      }
    } catch (error) {
      showToast(`Loi can thiep lenh: ${error.message}`, 'danger');
    } finally {
      setActingOrderId('');
    }
  };

  const clearOrderDecision = async (orderId) => {
    const id = String(orderId || '').trim();
    if (!id) return;
    setActingOrderId(id);
    try {
      const result = await invoke('clear-trading-market-order-control', { orderId: id });
      if (!result?.success) {
        throw new Error(result?.message || 'Xoa can thiep lenh that bai');
      }
      const data = result?.data || {};
      if (data?.orderBook) {
        setOrderBook(normalizeOrderBook(data.orderBook));
      } else {
        await loadState();
      }
    } catch (error) {
      showToast(`Loi xoa can thiep lenh: ${error.message}`, 'danger');
    } finally {
      setActingOrderId('');
    }
  };

  const resetFilters = () => {
    setFilterKeyword('');
    setFilterSide('all');
    setFilterControl('all');
    setFilterMinAmount('');
    setFilterMaxAmount('');
  };

  const isBreakingBusy = breakingSide !== '';
  const breakLoseLabel = liveSideBreak?.loseSide === 'PUT' ? 'BAN' : 'MUA';

  return (
    <div style={{ padding: 24 }}>
      <header style={{ marginBottom: 16 }}>
        <h1 style={{ marginBottom: 6 }}>Can Thiep Ket Qua Thi Truong</h1>
        <p style={{ margin: 0, color: '#64748b' }}>
          Quan ly xu huong gia, danh sach lenh nguoi choi, va auto xu ly lenh nho/lenh lon cho OK COIN.
        </p>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))', gap: 14, marginBottom: 16 }}>
        <div
          style={{
            border: '1px solid #e2e8f0',
            borderRadius: 12,
            padding: 14,
            background: '#fff',
            boxShadow: '0 2px 8px rgba(15,23,42,0.04)',
          }}
        >
          <div style={{ fontSize: 12, color: '#64748b', marginBottom: 6 }}>Thi truong hien tai</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <div style={{ fontSize: 20, fontWeight: 800 }}>{market?.symbol || 'OK COIN'}</div>
            <div style={{ fontWeight: 700, color: '#0f172a' }}>
              {market ? formatNumber(market.price, market.precision ?? 2) : '-'}
            </div>
          </div>
          <div style={{ marginTop: 8, color: Number(market?.changePct || 0) >= 0 ? '#16a34a' : '#dc2626', fontWeight: 700 }}>
            Change: {market ? formatPercent(market.changePct) : '-'}
          </div>
          <div style={{ marginTop: 8, fontSize: 12, color: '#64748b' }}>
            Seq: {snapshot?.sequence ?? 0} | Server: {snapshot?.serverTime ? new Date(snapshot.serverTime).toLocaleTimeString('vi-VN') : '-'}
          </div>
          <div style={{ marginTop: 6, fontSize: 12, color: '#334155' }}>
            Nen 1 phut con lai: <strong style={{ color: '#0f172a' }}>{formatWholeNumber(liveCandleState?.remainingSec || 0)}s</strong>
          </div>
          <div style={{ marginTop: 6, fontSize: 12, color: '#334155' }}>
            MUA (CALL): <strong style={{ color: '#16a34a' }}>{formatWholeNumber(sideSummary.totalCallOrders)}</strong> lenh |{' '}
            <strong style={{ color: '#16a34a' }}>{formatWholeNumber(sideSummary.totalCallAmount)}</strong>
          </div>
          <div style={{ marginTop: 4, fontSize: 12, color: '#334155' }}>
            BAN (PUT): <strong style={{ color: '#dc2626' }}>{formatWholeNumber(sideSummary.totalPutOrders)}</strong> lenh |{' '}
            <strong style={{ color: '#dc2626' }}>{formatWholeNumber(sideSummary.totalPutAmount)}</strong>
          </div>
          <div style={{ marginTop: 6, fontSize: 12, color: liveSideBreak.active ? '#b45309' : '#64748b', fontWeight: liveSideBreak.active ? 700 : 500 }}>
            {liveSideBreak.active
              ? `Dang be lenh ${breakLoseLabel} (con ${formatWholeNumber(liveSideBreak.remainingSec)}s)`
              : 'Khong co be lenh MUA/BAN'}
          </div>
          <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              onClick={() => applyQuickDirection('up')}
              disabled={savingControl || isBreakingBusy}
              style={{
                border: 'none',
                borderRadius: 8,
                padding: '8px 12px',
                background: '#16a34a',
                color: '#fff',
                fontWeight: 800,
                cursor: savingControl || isBreakingBusy ? 'wait' : 'pointer',
                opacity: savingControl || isBreakingBusy ? 0.75 : 1,
              }}
            >
              + Tang
            </button>
            <button
              onClick={() => applyQuickDirection('down')}
              disabled={savingControl || isBreakingBusy}
              style={{
                border: 'none',
                borderRadius: 8,
                padding: '8px 12px',
                background: '#dc2626',
                color: '#fff',
                fontWeight: 800,
                cursor: savingControl || isBreakingBusy ? 'wait' : 'pointer',
                opacity: savingControl || isBreakingBusy ? 0.75 : 1,
              }}
            >
              - Giam
            </button>
            <button
              onClick={() => triggerSideBreak('CALL')}
              disabled={savingControl || isBreakingBusy}
              style={{
                border: 'none',
                borderRadius: 8,
                padding: '8px 12px',
                background: '#f59e0b',
                color: '#111827',
                fontWeight: 800,
                cursor: savingControl || isBreakingBusy ? 'wait' : 'pointer',
                opacity: savingControl || isBreakingBusy ? 0.75 : 1,
              }}
            >
              Be lenh Mua
            </button>
            <button
              onClick={() => triggerSideBreak('PUT')}
              disabled={savingControl || isBreakingBusy}
              style={{
                border: 'none',
                borderRadius: 8,
                padding: '8px 12px',
                background: '#f97316',
                color: '#fff',
                fontWeight: 800,
                cursor: savingControl || isBreakingBusy ? 'wait' : 'pointer',
                opacity: savingControl || isBreakingBusy ? 0.75 : 1,
              }}
            >
              Be lenh Ban
            </button>
            {liveSideBreak.active && (
              <button
                onClick={clearSideBreakControl}
                disabled={savingControl || isBreakingBusy}
                style={{
                  border: '1px solid #f59e0b',
                  borderRadius: 8,
                  padding: '8px 12px',
                  background: '#fff',
                  color: '#b45309',
                  fontWeight: 800,
                  cursor: savingControl || isBreakingBusy ? 'wait' : 'pointer',
                  opacity: savingControl || isBreakingBusy ? 0.75 : 1,
                }}
              >
                Tat be lenh
              </button>
            )}
          </div>
        </div>

        <div
          style={{
            border: '1px solid #e2e8f0',
            borderRadius: 12,
            padding: 14,
            background: '#fff',
            boxShadow: '0 2px 8px rgba(15,23,42,0.04)',
          }}
        >
          <div style={{ fontSize: 12, color: '#64748b', marginBottom: 6 }}>Trang thai can thiep</div>
          <div style={{ fontSize: 16, fontWeight: 800, color: controlActive ? '#b91c1c' : '#16a34a' }}>
            {controlActive ? 'DANG CAN THIEP' : 'TU DONG'}
          </div>
          <div style={{ marginTop: 8, fontSize: 13, color: '#334155' }}>
            Mode: <strong>{String(currentControl?.mode || 'auto').toUpperCase()}</strong>
          </div>
          <div style={{ marginTop: 4, fontSize: 13, color: '#334155' }}>
            Huong: <strong>{currentControl?.direction === 'down' ? 'GIAM' : 'TANG'}</strong>
          </div>
          <div style={{ marginTop: 4, fontSize: 13, color: '#334155' }}>
            Luc day: <strong>{Math.round(clamp(currentControl?.strength, 1, 100, 60))}%</strong>
          </div>
          <div style={{ marginTop: 4, fontSize: 13, color: '#334155' }}>
            Target: <strong>{currentControl?.targetPrice ? formatNumber(currentControl.targetPrice, market?.precision ?? 2) : '-'}</strong>
          </div>
          <div style={{ marginTop: 10, fontSize: 12, color: '#64748b' }}>
            Lenh dang chay: <strong style={{ color: '#0f172a' }}>{formatWholeNumber(orderBook.totalActiveOrders)}</strong>
            {' | '}
            Tong tien: <strong style={{ color: '#0f172a' }}>{formatWholeNumber(orderBook.totalActiveAmount)}</strong>
          </div>
          <div style={{ marginTop: 6, fontSize: 12, color: '#334155' }}>
            MUA: <strong style={{ color: '#16a34a' }}>{formatWholeNumber(sideSummary.totalCallOrders)}</strong> lenh /{' '}
            <strong style={{ color: '#16a34a' }}>{formatWholeNumber(sideSummary.totalCallAmount)}</strong>
          </div>
          <div style={{ marginTop: 4, fontSize: 12, color: '#334155' }}>
            BAN: <strong style={{ color: '#dc2626' }}>{formatWholeNumber(sideSummary.totalPutOrders)}</strong> lenh /{' '}
            <strong style={{ color: '#dc2626' }}>{formatWholeNumber(sideSummary.totalPutAmount)}</strong>
          </div>
        </div>
      </div>

      <div
        style={{
          border: '1px solid #e2e8f0',
          borderRadius: 12,
          padding: 16,
          background: '#fff',
          boxShadow: '0 2px 8px rgba(15,23,42,0.04)',
          marginBottom: 16,
        }}
      >
        {loading ? (
          <div style={{ color: '#64748b' }}>Dang tai cau hinh...</div>
        ) : (
          <>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, color: '#475569', marginBottom: 6 }}>Che do can thiep</div>
              <select
                value={controlForm.mode}
                onChange={(e) => setControlField('mode', e.target.value)}
                style={{ width: '100%', maxWidth: 320, padding: '8px 10px', border: '1px solid #cbd5e1', borderRadius: 8 }}
              >
                <option value="auto">Auto (khong can thiep)</option>
                <option value="bias">Bias trend (ep xu huong)</option>
                <option value="target">Target price (keo den gia muc tieu)</option>
              </select>
            </div>

            {controlForm.mode === 'bias' && (
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px,320px)', gap: 12, marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 12, color: '#475569', marginBottom: 6 }}>Huong</div>
                  <select
                    value={controlForm.direction}
                    onChange={(e) => setControlField('direction', e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', border: '1px solid #cbd5e1', borderRadius: 8 }}
                  >
                    <option value="up">Tang</option>
                    <option value="down">Giam</option>
                  </select>
                </div>

                <div>
                  <div style={{ fontSize: 12, color: '#475569', marginBottom: 6 }}>
                    Muc do ({Math.round(clamp(controlForm.strength, 1, 100, 60))}%)
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={100}
                    step={1}
                    value={Math.round(clamp(controlForm.strength, 1, 100, 60))}
                    onChange={(e) => setControlField('strength', Number(e.target.value))}
                    style={{ width: '100%' }}
                  />
                </div>
              </div>
            )}

            {controlForm.mode === 'target' && (
              <div style={{ marginBottom: 12, maxWidth: 320 }}>
                <div style={{ fontSize: 12, color: '#475569', marginBottom: 6 }}>Target price</div>
                <input
                  type="number"
                  min={0.01}
                  step={0.01}
                  value={controlForm.targetPrice}
                  onChange={(e) => setControlField('targetPrice', e.target.value)}
                  placeholder="Nhap gia muc tieu"
                  style={{ width: '100%', padding: '8px 10px', border: '1px solid #cbd5e1', borderRadius: 8 }}
                />
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button
                onClick={applyControl}
                disabled={savingControl}
                style={{
                  border: 'none',
                  borderRadius: 8,
                  padding: '10px 16px',
                  background: '#2563eb',
                  color: '#fff',
                  fontWeight: 800,
                  cursor: savingControl ? 'wait' : 'pointer',
                  opacity: savingControl ? 0.75 : 1,
                }}
              >
                {savingControl ? 'Dang cap nhat...' : 'Luu can thiep'}
              </button>
              <button
                onClick={clearControl}
                disabled={savingControl}
                style={{
                  border: '1px solid #ef4444',
                  borderRadius: 8,
                  padding: '10px 16px',
                  background: '#fff',
                  color: '#ef4444',
                  fontWeight: 800,
                  cursor: savingControl ? 'wait' : 'pointer',
                  opacity: savingControl ? 0.75 : 1,
                }}
              >
                Xoa can thiep
              </button>
            </div>
          </>
        )}
      </div>

      <div
        style={{
          border: '1px solid #e2e8f0',
          borderRadius: 12,
          padding: 16,
          background: '#fff',
          boxShadow: '0 2px 8px rgba(15,23,42,0.04)',
          marginBottom: 16,
        }}
      >
        <div style={{ fontWeight: 800, marginBottom: 10 }}>Auto Xu Ly Lenh</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 10, marginBottom: 12 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
            <input
              type="checkbox"
              checked={policyForm.enabled}
              onChange={(e) => setPolicyField('enabled', e.target.checked)}
            />
            Bat tu dong giu/giết lenh
          </label>
          <select
            value={policyForm.mode}
            onChange={(e) => setPolicyField('mode', e.target.value)}
            style={{ padding: '8px 10px', border: '1px solid #cbd5e1', borderRadius: 8 }}
          >
            <option value="kill_small">Giết lệnh nhỏ - cho ăn lệnh to</option>
            <option value="kill_big">Cho ăn lệnh nhỏ - giết lệnh to</option>
          </select>
          <input
            type="number"
            min={1}
            value={policyForm.thresholdAmount}
            onChange={(e) => setPolicyField('thresholdAmount', Number(e.target.value || 0))}
            style={{ padding: '8px 10px', border: '1px solid #cbd5e1', borderRadius: 8 }}
            placeholder="Nguong so tien"
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <button
            onClick={saveOrderPolicy}
            disabled={savingPolicy}
            style={{
              border: 'none',
              borderRadius: 8,
              padding: '10px 16px',
              background: '#0ea5e9',
              color: '#fff',
              fontWeight: 800,
              cursor: savingPolicy ? 'wait' : 'pointer',
              opacity: savingPolicy ? 0.75 : 1,
            }}
          >
            {savingPolicy ? 'Dang luu...' : 'Luu auto xu ly lenh'}
          </button>
          <div style={{ fontSize: 12, color: '#64748b' }}>
            Dang ap dung: <strong>{orderPolicy.enabled ? 'BAT' : 'TAT'}</strong>, mode <strong>{orderPolicy.mode}</strong>, nguong <strong>{formatWholeNumber(orderPolicy.thresholdAmount)}</strong>
          </div>
        </div>
      </div>

      <div
        style={{
          border: '1px solid #e2e8f0',
          borderRadius: 12,
          padding: 16,
          background: '#fff',
          boxShadow: '0 2px 8px rgba(15,23,42,0.04)',
        }}
      >
        <div style={{ fontWeight: 800, marginBottom: 10 }}>
          Danh Sach Lenh Nguoi Choi ({formatWholeNumber(filteredActiveOrders.length)}/{formatWholeNumber(orderBook.totalActiveOrders)})
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))',
            gap: 8,
            marginBottom: 12,
          }}
        >
          <input
            value={filterKeyword}
            onChange={(e) => setFilterKeyword(e.target.value)}
            placeholder="Tim user / order"
            style={{ padding: '8px 10px', border: '1px solid #cbd5e1', borderRadius: 8 }}
          />
          <select
            value={filterSide}
            onChange={(e) => setFilterSide(e.target.value)}
            style={{ padding: '8px 10px', border: '1px solid #cbd5e1', borderRadius: 8 }}
          >
            <option value="all">Tat ca cua</option>
            <option value="CALL">CALL</option>
            <option value="PUT">PUT</option>
          </select>
          <select
            value={filterControl}
            onChange={(e) => setFilterControl(e.target.value)}
            style={{ padding: '8px 10px', border: '1px solid #cbd5e1', borderRadius: 8 }}
          >
            <option value="all">Tat ca control</option>
            <option value="auto">AUTO</option>
            <option value="kill">KILL</option>
            <option value="nurture">NURTURE</option>
          </select>
          <input
            type="number"
            min={0}
            value={filterMinAmount}
            onChange={(e) => setFilterMinAmount(e.target.value)}
            placeholder="Tien tu"
            style={{ padding: '8px 10px', border: '1px solid #cbd5e1', borderRadius: 8 }}
          />
          <input
            type="number"
            min={0}
            value={filterMaxAmount}
            onChange={(e) => setFilterMaxAmount(e.target.value)}
            placeholder="Tien den"
            style={{ padding: '8px 10px', border: '1px solid #cbd5e1', borderRadius: 8 }}
          />
          <button
            onClick={resetFilters}
            style={{
              border: '1px solid #cbd5e1',
              borderRadius: 8,
              padding: '8px 10px',
              background: '#fff',
              color: '#334155',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Xoa loc
          </button>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 860 }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                <th style={{ textAlign: 'left', padding: '10px 8px', borderBottom: '1px solid #e2e8f0', fontSize: 12 }}>Order</th>
                <th style={{ textAlign: 'left', padding: '10px 8px', borderBottom: '1px solid #e2e8f0', fontSize: 12 }}>User</th>
                <th style={{ textAlign: 'left', padding: '10px 8px', borderBottom: '1px solid #e2e8f0', fontSize: 12 }}>Side</th>
                <th style={{ textAlign: 'right', padding: '10px 8px', borderBottom: '1px solid #e2e8f0', fontSize: 12 }}>Amount</th>
                <th style={{ textAlign: 'right', padding: '10px 8px', borderBottom: '1px solid #e2e8f0', fontSize: 12 }}>Entry</th>
                <th style={{ textAlign: 'right', padding: '10px 8px', borderBottom: '1px solid #e2e8f0', fontSize: 12 }}>Con lai</th>
                <th style={{ textAlign: 'left', padding: '10px 8px', borderBottom: '1px solid #e2e8f0', fontSize: 12 }}>Control</th>
                <th style={{ textAlign: 'left', padding: '10px 8px', borderBottom: '1px solid #e2e8f0', fontSize: 12 }}>Thao tac</th>
              </tr>
            </thead>
            <tbody>
              {filteredActiveOrders.map((order) => {
                const orderId = String(order?.orderId || '');
                const isBusy = actingOrderId === orderId;
                const manualControl = String(order?.manualControl || '').toLowerCase();
                return (
                  <tr key={orderId} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '10px 8px', fontFamily: 'monospace', fontSize: 12 }}>{orderId}</td>
                    <td style={{ padding: '10px 8px', fontSize: 12 }}>{order?.username || `User_${order?.userId || 0}`}</td>
                    <td style={{ padding: '10px 8px', fontSize: 12, fontWeight: 700, color: order?.side === 'CALL' ? '#16a34a' : '#dc2626' }}>
                      {order?.side || '-'}
                    </td>
                    <td style={{ padding: '10px 8px', textAlign: 'right', fontSize: 12, fontWeight: 700 }}>{formatWholeNumber(order?.amount || 0)}</td>
                    <td style={{ padding: '10px 8px', textAlign: 'right', fontSize: 12 }}>{formatNumber(order?.entryPrice || 0, market?.precision ?? 2)}</td>
                    <td style={{ padding: '10px 8px', textAlign: 'right', fontSize: 12 }}>{formatWholeNumber(order?.timeLeftSec || 0)}s</td>
                    <td style={{ padding: '10px 8px', fontSize: 12 }}>
                      {manualControl ? (
                        <span style={{ color: manualControl === 'kill' ? '#dc2626' : '#16a34a', fontWeight: 700 }}>
                          {manualControl === 'kill' ? 'KILL' : 'NURTURE'}
                        </span>
                      ) : (
                        <span style={{ color: '#64748b' }}>AUTO</span>
                      )}
                    </td>
                    <td style={{ padding: '10px 8px' }}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          onClick={() => setOrderDecision(orderId, 'nurture')}
                          disabled={isBusy}
                          style={{
                            border: 'none',
                            borderRadius: 6,
                            padding: '6px 8px',
                            background: '#16a34a',
                            color: '#fff',
                            fontWeight: 800,
                            cursor: isBusy ? 'wait' : 'pointer',
                            opacity: isBusy ? 0.7 : 1,
                          }}
                          title="Cho an lenh (Nurture)"
                        >
                          +
                        </button>
                        <button
                          onClick={() => setOrderDecision(orderId, 'kill')}
                          disabled={isBusy}
                          style={{
                            border: 'none',
                            borderRadius: 6,
                            padding: '6px 8px',
                            background: '#dc2626',
                            color: '#fff',
                            fontWeight: 800,
                            cursor: isBusy ? 'wait' : 'pointer',
                            opacity: isBusy ? 0.7 : 1,
                          }}
                          title="Giet lenh (Kill)"
                        >
                          -
                        </button>
                        <button
                          onClick={() => clearOrderDecision(orderId)}
                          disabled={isBusy}
                          style={{
                            border: '1px solid #cbd5e1',
                            borderRadius: 6,
                            padding: '6px 8px',
                            background: '#fff',
                            color: '#475569',
                            fontWeight: 700,
                            cursor: isBusy ? 'wait' : 'pointer',
                            opacity: isBusy ? 0.7 : 1,
                          }}
                          title="Xoa can thiep"
                        >
                          x
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredActiveOrders.length === 0 && orderBook.activeOrders.length === 0 && (
                <tr>
                  <td colSpan={8} style={{ padding: 14, textAlign: 'center', color: '#64748b', fontSize: 13 }}>
                    Chua co lenh nao dang chay.
                  </td>
                </tr>
              )}
              {filteredActiveOrders.length === 0 && orderBook.activeOrders.length > 0 && (
                <tr>
                  <td colSpan={8} style={{ padding: 14, textAlign: 'center', color: '#64748b', fontSize: 13 }}>
                    Khong co lenh nao phu hop bo loc hien tai.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
