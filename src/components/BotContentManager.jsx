import React, { useEffect, useState } from 'react';
import { useIpc, useToast } from './ToastContext';

const DEFAULT_NEW_USER_MESSAGE = '👋 Chao mung <b>{username}</b>!\nTai khoan da duoc tao.\nID: <code>{userId}</code>\nToken: <code>{token}</code>\n\nChon mot chuc nang ben duoi de bat dau:';
const DEFAULT_RETURNING_MESSAGE = '👋 Chao mung tro lai, <b>{username}</b>!\n\nBan muon thuc hien tac vu nao?';

const isValidHttpUrl = (url) => /^https?:\/\//i.test(String(url || '').trim());

function BotContentManager() {
  const { invoke } = useIpc();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settingsSnapshot, setSettingsSnapshot] = useState({});
  const [startWelcomeImage, setStartWelcomeImage] = useState('');
  const [startWelcomeNewUserMessage, setStartWelcomeNewUserMessage] = useState(DEFAULT_NEW_USER_MESSAGE);
  const [startWelcomeReturningMessage, setStartWelcomeReturningMessage] = useState(DEFAULT_RETURNING_MESSAGE);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const result = await invoke('get-settings');
      if (!result?.success) {
        showToast(result?.message || 'Khong tai duoc noi dung bot', 'error');
        return;
      }

      const data = result?.data || {};
      setSettingsSnapshot(data);
      setStartWelcomeImage(String(data.startWelcomeImage || '').trim());
      setStartWelcomeNewUserMessage(
        String(data.startWelcomeNewUserMessage || '').trim() || DEFAULT_NEW_USER_MESSAGE,
      );
      setStartWelcomeReturningMessage(
        String(data.startWelcomeReturningMessage || '').trim() || DEFAULT_RETURNING_MESSAGE,
      );
    } catch (error) {
      console.error('[BotContentManager] load error:', error);
      showToast(`Khong tai duoc du lieu: ${error.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const handleResetDefault = () => {
    setStartWelcomeImage('');
    setStartWelcomeNewUserMessage(DEFAULT_NEW_USER_MESSAGE);
    setStartWelcomeReturningMessage(DEFAULT_RETURNING_MESSAGE);
    showToast('Da khoi phuc noi dung mac dinh', 'info');
  };

  const handleSave = async () => {
    const imageUrl = String(startWelcomeImage || '').trim();
    const newUserMessage = String(startWelcomeNewUserMessage || '').trim();
    const returningMessage = String(startWelcomeReturningMessage || '').trim();

    if (imageUrl && !isValidHttpUrl(imageUrl)) {
      showToast('Link anh chao mung khong hop le (http/https)', 'error');
      return;
    }
    if (!newUserMessage) {
      showToast('Noi dung chao mung nguoi moi khong duoc de trong', 'error');
      return;
    }
    if (!returningMessage) {
      showToast('Noi dung chao mung nguoi cu khong duoc de trong', 'error');
      return;
    }

    try {
      setSaving(true);
      const payload = {
        ...(settingsSnapshot || {}),
        startWelcomeImage: imageUrl,
        startWelcomeNewUserMessage: newUserMessage,
        startWelcomeReturningMessage: returningMessage,
      };
      const result = await invoke('save-settings', payload);
      if (!result?.success) {
        showToast(result?.message || 'Khong luu duoc noi dung bot', 'error');
        return;
      }

      setSettingsSnapshot(payload);
      setStartWelcomeImage(imageUrl);
      setStartWelcomeNewUserMessage(newUserMessage);
      setStartWelcomeReturningMessage(returningMessage);
      showToast('Da luu noi dung bot thanh cong', 'success');
    } catch (error) {
      console.error('[BotContentManager] save error:', error);
      showToast(`Khong luu duoc cau hinh: ${error.message}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <header style={{ marginBottom: '16px' }}>
        <h1>
          <i className="fas fa-comment-dots" style={{ marginRight: '10px' }}></i>
          Quan Ly Noi Dung Bot
        </h1>
        <div style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '8px' }}>
          Cac bien ho tro: <code>{'{username}'}</code> <code>{'{userId}'}</code> <code>{'{token}'}</code> <code>{'{balance}'}</code>
        </div>
      </header>

      <div className="settings-container" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button className="btn" onClick={loadSettings} disabled={loading || saving}>Tai lai</button>
          <button className="btn" onClick={handleResetDefault} disabled={saving}>Mac dinh</button>
          <button className="btn" onClick={handleSave} disabled={loading || saving}>
            {saving ? 'Dang luu...' : 'Luu thay doi'}
          </button>
        </div>

        {loading ? (
          <div style={{ padding: '16px 0', color: 'var(--text-secondary)' }}>Dang tai du lieu...</div>
        ) : (
          <>
            <div className="input-group" style={{ margin: 0 }}>
              <label style={{ marginBottom: '6px' }}>Link anh chao mung /start</label>
              <input
                type="text"
                value={startWelcomeImage}
                onChange={(e) => setStartWelcomeImage(e.target.value)}
                placeholder="https://domain.com/welcome.jpg"
              />
              <div style={{ marginTop: '6px', color: 'var(--text-secondary)', fontSize: '12px' }}>
                De trong neu chi muon gui chu.
              </div>
            </div>

            <div className="input-group" style={{ margin: 0 }}>
              <label style={{ marginBottom: '6px' }}>Noi dung /start cho nguoi moi</label>
              <textarea
                rows={8}
                value={startWelcomeNewUserMessage}
                onChange={(e) => setStartWelcomeNewUserMessage(e.target.value)}
                placeholder={DEFAULT_NEW_USER_MESSAGE}
              />
            </div>

            <div className="input-group" style={{ margin: 0 }}>
              <label style={{ marginBottom: '6px' }}>Noi dung /start cho nguoi da co tai khoan</label>
              <textarea
                rows={6}
                value={startWelcomeReturningMessage}
                onChange={(e) => setStartWelcomeReturningMessage(e.target.value)}
                placeholder={DEFAULT_RETURNING_MESSAGE}
              />
            </div>
          </>
        )}
      </div>
    </>
  );
}

export default BotContentManager;
