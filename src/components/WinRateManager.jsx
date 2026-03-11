import React, { useEffect, useMemo, useState } from 'react';
import { useIpc, useToast } from './ToastContext';

const GAME_ITEMS = [
  { id: 'booms', name: 'Booms' },
  { id: 'plinko', name: 'Plinko' },
  { id: 'roulette', name: 'Roulette' },
  { id: 'xeng', name: 'Xeng' },
  { id: 'trading', name: 'Trading' },
  { id: 'lottery', name: 'Lottery' },
  { id: 'lode', name: 'Lo De' },
  { id: 'xoso1phut', name: 'Xo So 1 Phut' },
];

const DEFAULT_RATES = {
  booms: 35,
  plinko: 45,
  roulette: 38,
  xeng: 40,
  trading: 50,
  lottery: 42,
  lode: 45,
  xoso1phut: 44,
};

const clamp = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
};

export default function WinRateManager() {
  const { invoke } = useIpc();
  const { showToast } = useToast();

  const [rates, setRates] = useState(DEFAULT_RATES);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const average = useMemo(() => {
    const vals = Object.values(rates);
    return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 0;
  }, [rates]);

  const loadRates = async () => {
    setLoading(true);
    try {
      const result = await invoke('get-non-session-win-rates');
      if (result?.success && result?.data) {
        setRates({ ...DEFAULT_RATES, ...result.data });
      }
    } catch (error) {
      console.error('load win rates error:', error);
      showToast('Khong tai duoc ti le thang, dang dung gia tri mac dinh', 'warning');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRates();
  }, []);

  const setRate = (gameId, value) => {
    setRates((prev) => ({
      ...prev,
      [gameId]: clamp(value),
    }));
  };

  const resetDefaults = () => {
    setRates(DEFAULT_RATES);
  };

  const saveRates = async () => {
    setSaving(true);
    try {
      const payload = Object.fromEntries(
        Object.entries(rates).map(([k, v]) => [k, clamp(v)]),
      );
      const result = await invoke('save-non-session-win-rates', payload);
      if (!result?.success) throw new Error(result?.message || 'Unknown error');
      setRates({ ...DEFAULT_RATES, ...(result.data || payload) });
      showToast('Da luu ti le thang thanh cong', 'success');
    } catch (error) {
      showToast(`Luu that bai: ${error.message}`, 'danger');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ padding: 24 }}>
      <header style={{ marginBottom: 16 }}>
        <h1 style={{ marginBottom: 6 }}>Ti Le Thang - Game Khong Session</h1>
        <p style={{ margin: 0, color: '#64748b' }}>
          Dieu chinh xac suat ket qua co loi cho nguoi choi theo tung game. 0% la thua toan bo, 100% la thang toan bo.
        </p>
      </header>

      <div style={{
        marginBottom: 14,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 12px',
        background: '#f1f5f9',
        borderRadius: 8,
        border: '1px solid #e2e8f0',
      }}>
        <span style={{ color: '#334155', fontWeight: 700 }}>Trung binh:</span>
        <span style={{ color: '#2563eb', fontWeight: 800 }}>{average}%</span>
      </div>

      {loading ? (
        <div style={{ padding: 18, color: '#64748b' }}>Dang tai cau hinh...</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 14 }}>
          {GAME_ITEMS.map((item) => {
            const value = clamp(rates[item.id]);
            return (
              <div
                key={item.id}
                style={{
                  background: '#fff',
                  border: '1px solid #e2e8f0',
                  borderRadius: 12,
                  padding: 14,
                  boxShadow: '0 2px 8px rgba(15,23,42,0.04)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div style={{ fontWeight: 700 }}>{item.name}</div>
                  <div style={{ fontWeight: 800, color: '#0f172a' }}>{value}%</div>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={value}
                  onChange={(e) => setRate(item.id, e.target.value)}
                  style={{ width: '100%' }}
                />
                <div style={{ marginTop: 8 }}>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={1}
                    value={value}
                    onChange={(e) => setRate(item.id, e.target.value)}
                    style={{ width: 90, padding: '6px 8px', border: '1px solid #cbd5e1', borderRadius: 8 }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div style={{ marginTop: 18, display: 'flex', gap: 10 }}>
        <button
          onClick={saveRates}
          disabled={saving || loading}
          style={{
            border: 'none',
            borderRadius: 8,
            padding: '10px 16px',
            background: '#2563eb',
            color: '#fff',
            fontWeight: 800,
            cursor: saving || loading ? 'wait' : 'pointer',
            opacity: saving || loading ? 0.7 : 1,
          }}
        >
          {saving ? 'Dang luu...' : 'Luu cau hinh'}
        </button>
        <button
          onClick={resetDefaults}
          disabled={saving || loading}
          style={{
            border: '1px solid #ef4444',
            borderRadius: 8,
            padding: '10px 16px',
            background: '#fff',
            color: '#ef4444',
            fontWeight: 800,
            cursor: saving || loading ? 'wait' : 'pointer',
            opacity: saving || loading ? 0.7 : 1,
          }}
        >
          Dat mac dinh
        </button>
      </div>
    </div>
  );
}
