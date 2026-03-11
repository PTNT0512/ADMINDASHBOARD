import React, { useEffect, useMemo, useState } from 'react';
import { useIpc, useToast } from './ToastContext';

const DEFAULT_BUTTONS = [
  { id: 'tx_cao', text: '\uD83C\uDFB2 Tai Xiu Cao', callbackData: 'game_tx_cao', webAppUrl: '', enabled: true, order: 1 },
  { id: 'tx_nan', text: '\uD83C\uDFB2 Tai Xiu Nan', callbackData: 'game_tx_nan', webAppUrl: '', enabled: true, order: 2 },
  { id: 'xocdia', text: '\uD83D\uDCBF Xoc Dia', callbackData: 'game_xocdia', webAppUrl: '', enabled: true, order: 3 },
  { id: 'baucua', text: '\uD83E\uDD80 Bau Cua', callbackData: 'game_baucua', webAppUrl: '', enabled: true, order: 4 },
  { id: 'tx_tele', text: '\uD83D\uDCC8 Tai Xiu Tele', callbackData: 'game_tx_tele', webAppUrl: '', enabled: true, order: 5 },
  { id: 'cl_tele', text: '\uD83D\uDCCA Chan Le Tele', callbackData: 'game_cl_tele', webAppUrl: '', enabled: true, order: 6 },
  { id: 'tx_dice', text: '\uD83C\uDFB2 TX Xuc Xac Tele', callbackData: 'game_tx_dice', webAppUrl: '', enabled: true, order: 7 },
  { id: 'cl_dice', text: '\uD83C\uDFB2 CL Xuc Xac Tele', callbackData: 'game_cl_dice', webAppUrl: '', enabled: true, order: 8 },
  { id: 'slot_tele', text: '\uD83C\uDFB0 Slot Tele', callbackData: 'game_slot', webAppUrl: '', enabled: true, order: 9 },
  { id: 'plinko', text: '\uD83C\uDFB1 Plinko', callbackData: 'game_plinko', webAppUrl: '', enabled: true, order: 10 },
  { id: 'booms', text: '\uD83D\uDCA3 Booms', callbackData: 'game_booms', webAppUrl: '', enabled: true, order: 11 },
  { id: 'xeng', text: '\uD83C\uDF52 Xeng', callbackData: 'game_xeng', webAppUrl: '', enabled: true, order: 12 },
];

const toSafeInt = (value, fallback = 0) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeCallbackData = (value, fallback = 'game_custom') => {
  const raw = String(value || '')
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9_]/g, '_')
    .toLowerCase();

  if (!raw) return fallback;
  return raw.startsWith('game_') ? raw : `game_${raw}`;
};

const normalizeButton = (input, index = 0) => {
  const callbackData = normalizeCallbackData(input?.callbackData || input?.callback_data, `game_custom_${index + 1}`);
  const text = String(input?.text || '').trim() || `Game ${index + 1}`;
  const enabled = input?.enabled !== false;
  const order = Math.max(1, toSafeInt(input?.order, index + 1));

  return {
    id: String(input?.id || callbackData || `btn_${Date.now()}_${index}`),
    text,
    callbackData,
    webAppUrl: String(input?.webAppUrl || input?.url || '').trim(),
    enabled,
    order,
  };
};

const normalizeButtons = (list) => {
  const source = Array.isArray(list) && list.length > 0 ? list : DEFAULT_BUTTONS;
  return source
    .map((item, index) => normalizeButton(item, index))
    .filter((item) => item.callbackData.startsWith('game_'))
    .sort((a, b) => a.order - b.order)
    .map((item, index) => ({ ...item, order: index + 1 }));
};

const isTeleButton = (button) => /tele/i.test(`${String(button?.text || '')} ${String(button?.callbackData || '')}`);
const isValidHttpUrl = (url) => /^https?:\/\//i.test(String(url || '').trim());

function GameMenuButtonManager() {
  const { invoke } = useIpc();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settingsSnapshot, setSettingsSnapshot] = useState({});
  const [buttons, setButtons] = useState(() => normalizeButtons(DEFAULT_BUTTONS));
  const [menuImageUrl, setMenuImageUrl] = useState('');

  const enabledCount = useMemo(
    () => buttons.filter((item) => item.enabled !== false).length,
    [buttons],
  );

  const loadSettings = async () => {
    try {
      setLoading(true);
      const result = await invoke('get-settings');
      if (!result?.success) {
        showToast(result?.message || 'Khong tai duoc cau hinh nut game', 'error');
        return;
      }

      const data = result?.data || {};
      setSettingsSnapshot(data);
      setButtons(normalizeButtons(data.gameMenuButtons));
      setMenuImageUrl(String(data.gameListImage || '').trim());
    } catch (error) {
      console.error('[GameMenuButtonManager] loadSettings error:', error);
      showToast(`Khong tai duoc cau hinh: ${error.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const patchButton = (index, patch) => {
    setButtons((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], ...patch };
      return next;
    });
  };

  const handleAddButton = () => {
    setButtons((prev) => {
      const nextIndex = prev.length + 1;
      return [
        ...prev,
        {
          id: `custom_${Date.now()}_${nextIndex}`,
          text: `Game ${nextIndex}`,
          callbackData: `game_custom_${nextIndex}`,
          webAppUrl: '',
          enabled: true,
          order: nextIndex,
        },
      ];
    });
  };

  const handleDeleteButton = (index) => {
    setButtons((prev) => {
      const filtered = prev.filter((_, i) => i !== index);
      return filtered.map((item, i) => ({ ...item, order: i + 1 }));
    });
  };

  const handleMove = (index, direction) => {
    setButtons((prev) => {
      const target = index + direction;
      if (target < 0 || target >= prev.length) return prev;

      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next.map((item, i) => ({ ...item, order: i + 1 }));
    });
  };

  const handleResetDefault = () => {
    setButtons(normalizeButtons(DEFAULT_BUTTONS));
    showToast('Da reset ve danh sach mac dinh', 'info');
  };

  const handleSave = async () => {
    const normalizedMenuImageUrl = String(menuImageUrl || '').trim();
    if (normalizedMenuImageUrl && !isValidHttpUrl(normalizedMenuImageUrl)) {
      showToast('Link anh menu phai bat dau bang http:// hoac https://', 'error');
      return;
    }

    const prepared = normalizeButtons(buttons).map((item, index) => {
      const isTele = isTeleButton(item);
      return {
        ...item,
        order: index + 1,
        callbackData: normalizeCallbackData(item.callbackData, `game_custom_${index + 1}`),
        webAppUrl: isTele ? '' : String(item.webAppUrl || '').trim(),
      };
    });

    const duplicateMap = new Set();
    for (const button of prepared) {
      if (duplicateMap.has(button.callbackData)) {
        showToast(`Trung callback_data: ${button.callbackData}`, 'error');
        return;
      }
      duplicateMap.add(button.callbackData);

      if (!isTeleButton(button) && button.webAppUrl && !isValidHttpUrl(button.webAppUrl)) {
        showToast(`Link sai dinh dang (${button.text})`, 'error');
        return;
      }
    }

    try {
      setSaving(true);
      const payload = {
        ...(settingsSnapshot || {}),
        gameMenuButtons: prepared,
        gameListImage: normalizedMenuImageUrl,
      };
      const result = await invoke('save-settings', payload);
      if (!result?.success) {
        showToast(result?.message || 'Khong luu duoc cau hinh nut game', 'error');
        return;
      }

      setSettingsSnapshot(payload);
      setButtons(prepared);
      setMenuImageUrl(normalizedMenuImageUrl);
      showToast('Da luu cau hinh nut game', 'success');
    } catch (error) {
      console.error('[GameMenuButtonManager] save error:', error);
      showToast(`Khong luu duoc cau hinh: ${error.message}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <header style={{ marginBottom: '16px' }}>
        <h1><i className="fas fa-gamepad" style={{ marginRight: '10px' }}></i>Quan Ly Nut Danh Sach Game</h1>
        <div style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '8px' }}>
          Tong so nut: <b>{buttons.length}</b> | Dang bat: <b>{enabledCount}</b>
        </div>
      </header>

      <div className="settings-container" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button className="btn" onClick={handleAddButton}>Them nut</button>
          <button className="btn" onClick={handleResetDefault}>Mac dinh</button>
          <button className="btn" onClick={loadSettings} disabled={loading}>Tai lai</button>
          <button className="btn" onClick={handleSave} disabled={loading || saving}>
            {saving ? 'Dang luu...' : 'Luu thay doi'}
          </button>
        </div>

        <div
          style={{
            border: '1px solid rgba(15, 23, 42, 0.08)',
            borderRadius: '10px',
            padding: '12px',
            background: 'var(--card-bg)',
          }}
        >
          <div className="input-group" style={{ margin: 0 }}>
            <label style={{ marginBottom: '6px' }}>Link anh menu gui trong bot</label>
            <input
              type="text"
              value={menuImageUrl}
              onChange={(e) => setMenuImageUrl(e.target.value)}
              placeholder="https://domain.com/menu.jpg"
            />
          </div>
          <div style={{ marginTop: '8px', color: 'var(--text-secondary)', fontSize: '12px' }}>
            De trong neu ban chi muon gui menu dang text.
          </div>
        </div>

        {loading ? (
          <div style={{ padding: '16px 0', color: 'var(--text-secondary)' }}>Dang tai du lieu...</div>
        ) : (
          buttons.map((button, index) => {
            const teleButton = isTeleButton(button);
            return (
              <div
                key={button.id}
                style={{
                  border: '1px solid rgba(15, 23, 42, 0.08)',
                  borderRadius: '10px',
                  padding: '12px',
                  background: 'var(--card-bg)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', marginBottom: '10px', alignItems: 'center' }}>
                  <div style={{ fontWeight: 700 }}>Nut #{index + 1}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', margin: 0 }}>
                      <input
                        type="checkbox"
                        checked={button.enabled !== false}
                        onChange={(e) => patchButton(index, { enabled: e.target.checked })}
                        style={{ width: 'auto' }}
                      />
                      Bat
                    </label>
                    <button className="btn" onClick={() => handleMove(index, -1)} disabled={index === 0}>Len</button>
                    <button className="btn" onClick={() => handleMove(index, 1)} disabled={index === buttons.length - 1}>Xuong</button>
                    <button className="btn" onClick={() => handleDeleteButton(index)} disabled={buttons.length <= 1}>Xoa</button>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px' }}>
                  <div className="input-group" style={{ margin: 0 }}>
                    <label style={{ marginBottom: '6px' }}>Ten nut</label>
                    <input
                      type="text"
                      value={button.text}
                      onChange={(e) => patchButton(index, { text: e.target.value })}
                      placeholder="Ten hien thi tren nut"
                    />
                  </div>

                  <div className="input-group" style={{ margin: 0 }}>
                    <label style={{ marginBottom: '6px' }}>Callback data</label>
                    <input
                      type="text"
                      value={button.callbackData}
                      onChange={(e) => patchButton(index, { callbackData: e.target.value })}
                      onBlur={() => patchButton(index, { callbackData: normalizeCallbackData(button.callbackData, `game_custom_${index + 1}`) })}
                      placeholder="game_xxx"
                    />
                  </div>

                  <div className="input-group" style={{ margin: 0 }}>
                    <label style={{ marginBottom: '6px' }}>Link Web App</label>
                    <input
                      type="text"
                      value={button.webAppUrl}
                      onChange={(e) => patchButton(index, { webAppUrl: e.target.value })}
                      placeholder={teleButton ? 'Nut Tele khong can link' : 'https://your-web-app'}
                      disabled={teleButton}
                    />
                  </div>

                  <div className="input-group" style={{ margin: 0 }}>
                    <label style={{ marginBottom: '6px' }}>Thu tu</label>
                    <input
                      type="number"
                      min={1}
                      value={button.order}
                      onChange={(e) => patchButton(index, { order: Math.max(1, toSafeInt(e.target.value, index + 1)) })}
                    />
                  </div>
                </div>

                {teleButton && (
                  <div style={{ marginTop: '8px', color: 'var(--text-secondary)', fontSize: '12px' }}>
                    Nut co chu "Tele" se khong mo Web App link.
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </>
  );
}

export default GameMenuButtonManager;
