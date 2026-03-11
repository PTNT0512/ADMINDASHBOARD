import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
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

const getDiceImage = (value) => DICE_IMAGES[toSafeNumber(value, 0)] || null;

const formatAmount = (value) => `${toSafeNumber(value, 0).toLocaleString('vi-VN')} đ`;

const maskUserId = (userId) => {
  const raw = String(userId || '').replace(/\D/g, '');
  if (!raw) return '***';
  if (raw.length <= 3) return `${raw}***`;
  return `${raw.slice(0, 5)}***`;
};

const normalizeBetList = (list) => {
  if (!Array.isArray(list)) return [];
  return list
    .map((item) => {
      const row = item && typeof item === 'object' ? item : {};
      return {
        userId: String(row.userId || ''),
        username: String(row.username || ''),
        amount: toSafeNumber(row.amount, 0),
      };
    })
    .filter((row) => row.amount > 0)
    .sort((a, b) => b.amount - a.amount);
};

export default function CheckCauSessionPage({
  roomType = 'tx',
  title = 'OK999.SITE',
  listPath = '/check-cau-tx',
}) {
  const { sessionId: encodedSessionId } = useParams();
  const sessionId = decodeURIComponent(String(encodedSessionId || '').trim());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState(null);

  const fetchDetail = useCallback(async () => {
    if (!sessionId) {
      setError('Thiếu mã phiên.');
      setLoading(false);
      return;
    }

    try {
      const query = new URLSearchParams({
        roomType,
        sessionId,
      });
      const res = await fetch(`${API_BASE}/api/check-cau/session?${query.toString()}`);
      const json = await res.json();
      if (!json?.success || !json?.data) {
        throw new Error(json?.message || 'Không tìm thấy thông tin phiên.');
      }
      setData(json.data);
      setError('');
    } catch (err) {
      setError(err?.message || 'Có lỗi khi tải chi tiết phiên.');
    } finally {
      setLoading(false);
    }
  }, [roomType, sessionId]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  const resultLabel = useMemo(() => {
    const result = String(data?.result || '').toLowerCase();
    if (result === 'tai') return 'TÀI';
    if (result === 'xiu') return 'XỈU';
    return '-';
  }, [data]);

  const taiBets = normalizeBetList(data?.taiBets);
  const xiuBets = normalizeBetList(data?.xiuBets);
  const dice = Array.isArray(data?.dice) ? data.dice : [];

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#e4f9ea] via-[#f1fbf4] to-white text-slate-900">
      <header className="relative overflow-hidden rounded-b-[28px] bg-gradient-to-r from-[#159a4c] to-[#16a34a] px-4 pb-12 pt-6 text-white shadow-[0_14px_35px_rgba(22,163,74,0.35)] sm:px-5 sm:pb-14 sm:pt-8">
        <div className="absolute -bottom-10 -left-6 h-28 w-44 rounded-full bg-white/15" />
        <div className="absolute -bottom-12 right-3 h-24 w-32 rounded-full bg-white/15" />
        <p className="relative text-xs font-semibold tracking-wide text-emerald-100 sm:text-sm">Thiên đường giải trí</p>
        <h1 className="relative mt-1 text-3xl font-black tracking-tight sm:text-4xl">{title}</h1>
      </header>

      <main className="-mt-7 px-3 pb-8 sm:-mt-8 sm:px-4 sm:pb-10">
        <div className="mx-auto w-full max-w-3xl">
          <Link to={listPath} className="inline-flex items-center gap-2 rounded-full px-1 py-2 text-xl font-black text-emerald-900 sm:gap-3 sm:text-3xl">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white text-lg shadow sm:h-10 sm:w-10 sm:text-xl">‹</span>
            <span className="text-2xl leading-none sm:text-4xl">Quay lại</span>
          </Link>

          <section className="mt-3 overflow-hidden rounded-[22px] bg-white shadow-[0_20px_44px_rgba(22,163,74,0.16)] sm:rounded-[28px]">
            <div className="px-3 py-3 text-lg font-black uppercase tracking-wide text-emerald-900 sm:px-4 sm:py-4 sm:text-3xl">
              PHIÊN ({sessionId || '-'})
            </div>
            <div className="overflow-x-auto px-3 pb-3 sm:px-4 sm:pb-4">
              <table className="w-full min-w-[320px]">
                <thead>
                  <tr className="border-b border-emerald-100 text-center text-xs font-black sm:text-2xl">
                    <th className="px-2 py-2 sm:px-2 sm:py-3">Kết quả</th>
                    <th className="px-2 py-2 sm:px-2 sm:py-3">Tổng tài</th>
                    <th className="px-2 py-2 sm:px-2 sm:py-3">Tổng xỉu</th>
                    <th className="px-2 py-2 sm:px-2 sm:py-3">Cái</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="text-center text-sm sm:text-2xl">
                    <td className="px-2 py-2 sm:px-2 sm:py-3">
                      {resultLabel} ({toSafeNumber(data?.total, 0)})
                    </td>
                    <td className="px-2 py-2 sm:px-2 sm:py-3">{toSafeNumber(data?.taiTotal, 0).toLocaleString('vi-VN')}</td>
                    <td className="px-2 py-2 sm:px-2 sm:py-3">{toSafeNumber(data?.xiuTotal, 0).toLocaleString('vi-VN')}</td>
                    <td className="px-2 py-2 sm:px-2 sm:py-3">{toSafeNumber(data?.bankerAmount, 0).toLocaleString('vi-VN')}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section className="mt-4 rounded-[20px] bg-white p-3 shadow-[0_16px_36px_rgba(22,163,74,0.1)] sm:rounded-[24px] sm:p-4">
            <p className="text-sm font-bold text-emerald-800 sm:text-lg">Xúc xắc</p>
            <div className="mt-3 flex flex-wrap items-center gap-2 sm:gap-4">
              {dice.length > 0 ? (
                dice.map((value, idx) => (
                  <div key={`${idx}-${value}`} className="rounded-xl bg-emerald-50 px-2 py-2 shadow sm:px-3 sm:py-2">
                    {getDiceImage(value) ? (
                      <img
                        src={getDiceImage(value)}
                        alt={`Xúc xắc ${toSafeNumber(value, 0)}`}
                        className="h-10 w-10 object-contain sm:h-14 sm:w-14"
                        loading="lazy"
                      />
                    ) : (
                      <span className="text-xl font-bold text-slate-400 sm:text-2xl">-</span>
                    )}
                  </div>
                ))
              ) : (
                <span className="text-sm italic text-slate-500 sm:text-lg">Không có dữ liệu xúc xắc</span>
              )}
            </div>
          </section>

          <section className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
            <div className="rounded-[20px] bg-white p-3 shadow-[0_16px_36px_rgba(22,163,74,0.1)] sm:rounded-[24px] sm:p-4">
              <h3 className="text-lg font-black text-emerald-900 sm:text-2xl">Cửa Tài</h3>
              {taiBets.length === 0 ? (
                <p className="mt-6 text-center text-base italic text-slate-500 sm:mt-8 sm:text-xl">Không có ai đặt cược</p>
              ) : (
                <div className="mt-3 space-y-2">
                  {taiBets.slice(0, 12).map((bet) => (
                    <div key={`${bet.userId}-${bet.amount}`} className="rounded-lg bg-emerald-50 px-3 py-2 text-sm">
                      <div className="font-semibold">{bet.username || `Người dùng ${maskUserId(bet.userId)}`}</div>
                      <div className="text-slate-600">{formatAmount(bet.amount)}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-[20px] bg-white p-3 shadow-[0_16px_36px_rgba(22,163,74,0.1)] sm:rounded-[24px] sm:p-4">
              <h3 className="text-lg font-black text-emerald-900 sm:text-2xl">Cửa Xỉu</h3>
              {xiuBets.length === 0 ? (
                <p className="mt-6 text-center text-base italic text-slate-500 sm:mt-8 sm:text-xl">Không có ai đặt cược</p>
              ) : (
                <div className="mt-3 space-y-2">
                  {xiuBets.slice(0, 12).map((bet) => (
                    <div key={`${bet.userId}-${bet.amount}`} className="rounded-lg bg-emerald-50 px-3 py-2 text-sm">
                      <div className="font-semibold">{bet.username || `Người dùng ${maskUserId(bet.userId)}`}</div>
                      <div className="text-slate-600">{formatAmount(bet.amount)}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          {(loading || error) && (
            <section className="mt-4 rounded-xl bg-white px-3 py-2 text-sm text-slate-700 shadow sm:px-4 sm:py-3 sm:text-base">
              {loading ? 'Đang tải dữ liệu phiên...' : error}
            </section>
          )}
        </div>
      </main>
    </div>
  );
}
