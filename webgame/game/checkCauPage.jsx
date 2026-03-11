import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import dice1 from '../img/1.png';
import dice2 from '../img/2.png';
import dice3 from '../img/3.png';
import dice4 from '../img/4.png';
import dice5 from '../img/5.png';
import dice6 from '../img/6.png';

const API_BASE = 'http://localhost:4001';
const DICE_IMAGES = {
  1: dice1,
  2: dice2,
  3: dice3,
  4: dice4,
  5: dice5,
  6: dice6,
};

const toSafeNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeRows = (rows) => {
  if (!Array.isArray(rows)) return [];
  return rows
    .map((item) => {
      const row = item && typeof item === 'object' ? item : {};
      const rawDice = Array.isArray(row.dice) ? row.dice : [];
      const dice = [0, 1, 2].map((idx) => toSafeNumber(rawDice[idx], 0));
      const sumFromDice = dice.reduce((sum, value) => sum + value, 0);
      const total = toSafeNumber(row.total, sumFromDice);
      return {
        sessionId: String(row.sessionId || '---'),
        total,
        dice,
      };
    });
};

const getDiceImage = (value) => DICE_IMAGES[toSafeNumber(value, 0)] || null;

export default function CheckCauPage({ roomType = 'tx', title = 'Check Cầu' }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null);

  const fetchHistory = useCallback(async () => {
    try {
      const query = new URLSearchParams({
        roomType,
        limit: '80',
      });
      const res = await fetch(`${API_BASE}/api/check-cau/history?${query.toString()}`);
      const json = await res.json();
      if (!json?.success) throw new Error(json?.message || 'Không lấy được dữ liệu.');

      setRows(normalizeRows(json.data));
      setError('');
      setLastUpdatedAt(new Date());
    } catch (err) {
      setError(err?.message || 'Có lỗi khi tải dữ liệu.');
    } finally {
      setLoading(false);
    }
  }, [roomType]);

  useEffect(() => {
    fetchHistory();
    const timer = setInterval(fetchHistory, 10000);
    return () => clearInterval(timer);
  }, [fetchHistory]);

  const subtitle = useMemo(() => (
    roomType === 'khongminh'
      ? 'Lịch sử phiên Khổng Minh'
      : 'Lịch sử phiên Tài Xỉu thường'
  ), [roomType]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#e4f9ea] via-[#f1fbf4] to-white text-slate-900">
      <header className="relative overflow-hidden rounded-b-[28px] bg-gradient-to-r from-[#159a4c] to-[#16a34a] px-4 pb-12 pt-6 text-white shadow-[0_14px_35px_rgba(22,163,74,0.35)] sm:px-5 sm:pb-16 sm:pt-8">
        <div className="absolute -bottom-10 -left-6 h-28 w-44 rounded-full bg-white/15" />
        <div className="absolute -bottom-12 right-3 h-24 w-32 rounded-full bg-white/15" />
        <p className="relative text-xs font-semibold tracking-wide text-emerald-100 sm:text-sm">Thiên đường giải trí</p>
        <h1 className="relative mt-1 text-3xl font-black tracking-tight sm:text-4xl">{title}</h1>
        <div className="relative mt-4 inline-flex rounded-full bg-white/20 px-3 py-1.5 text-[11px] font-bold tracking-wide text-emerald-50 sm:mt-5 sm:px-4 sm:py-2 sm:text-sm">
          {subtitle}
        </div>
      </header>

      <main className="-mt-7 px-3 pb-6 sm:-mt-9 sm:px-4 sm:pb-8">
        <section className="mx-auto w-full max-w-3xl overflow-hidden rounded-[22px] bg-white shadow-[0_24px_46px_rgba(22,163,74,0.14)] sm:rounded-[28px]">
          <div className="border-b border-emerald-100 px-3 py-2 text-[11px] text-emerald-700 sm:px-5 sm:py-3 sm:text-xs">
            {lastUpdatedAt
              ? `Cập nhật lúc ${lastUpdatedAt.toLocaleTimeString('vi-VN')}.`
              : 'Đang đồng bộ dữ liệu...'}
          </div>

          {error && (
            <div className="border-b border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 sm:px-5 sm:py-3 sm:text-sm">
              {error}
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full min-w-[340px] table-fixed sm:min-w-[640px]">
              <thead>
                <tr className="border-b border-emerald-100 bg-emerald-50/70 text-[11px] font-black uppercase tracking-wide text-emerald-900 sm:text-sm">
                  <th className="w-[42%] px-2 py-3 text-left sm:px-6 sm:py-4">Phiên</th>
                  <th className="w-[14%] px-1 py-3 text-center sm:px-4 sm:py-4">KQ</th>
                  <th className="w-[14%] px-1 py-3 text-center sm:px-4 sm:py-4">XX1</th>
                  <th className="w-[14%] px-1 py-3 text-center sm:px-4 sm:py-4">XX2</th>
                  <th className="w-[14%] px-1 py-3 text-center sm:px-4 sm:py-4">XX3</th>
                </tr>
              </thead>
              <tbody>
                {loading && rows.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-3 py-8 text-center text-xs font-semibold text-slate-500 sm:px-6 sm:py-10 sm:text-sm">
                      Đang tải lịch sử phiên...
                    </td>
                  </tr>
                )}

                {!loading && rows.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-3 py-8 text-center text-xs font-semibold text-slate-500 sm:px-6 sm:py-10 sm:text-sm">
                      Chưa có dữ liệu lịch sử.
                    </td>
                  </tr>
                )}

                {rows.map((row, rowIndex) => (
                  <tr key={`${row.sessionId}-${row.total}-${rowIndex}`} className="border-b border-emerald-100/80 text-xs last:border-b-0 sm:text-base">
                    <td className="px-2 py-3 font-semibold text-emerald-700 sm:px-6 sm:py-5">
                      {row.sessionId && row.sessionId !== '---' ? (
                        <Link
                          to={`/${roomType === 'khongminh' ? 'check-cau-khongminh' : 'check-cau-tx'}/${encodeURIComponent(row.sessionId)}`}
                          className="break-all leading-tight hover:text-emerald-900 hover:underline"
                        >
                          {row.sessionId}
                        </Link>
                      ) : (
                        row.sessionId
                      )}
                    </td>
                    <td className="px-1 py-3 text-center font-bold sm:px-4 sm:py-5">{row.total}</td>
                    {row.dice.map((diceValue, idx) => (
                      <td key={`${row.sessionId}-${rowIndex}-${idx}`} className="px-1 py-3 text-center sm:px-4 sm:py-5">
                        {getDiceImage(diceValue) ? (
                          <img
                            src={getDiceImage(diceValue)}
                            alt={`Xúc xắc ${toSafeNumber(diceValue, 0)}`}
                            className="mx-auto h-7 w-7 object-contain sm:h-11 sm:w-11"
                            loading="lazy"
                          />
                        ) : (
                          <span className="text-sm font-semibold text-slate-400 sm:text-lg">-</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
