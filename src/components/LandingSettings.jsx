import React, { useState, useEffect } from 'react';
import { Settings, Save, RotateCcw, Image, Type, Palette } from 'lucide-react';
import { useIpc, useToast } from './ToastContext';

const LandingSettings = () => {
  const { invoke } = useIpc();
  const { showToast } = useToast();
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [originalSettings, setOriginalSettings] = useState(null);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const result = await invoke('get-landing-settings');
      if (result.success) {
        setSettings(result.data);
        setOriginalSettings(JSON.parse(JSON.stringify(result.data)));
      } else {
        showToast('Lỗi tải cài đặt landing', 'danger');
      }
    } catch (error) {
      console.error('Error fetching landing settings:', error);
      showToast('Lỗi kết nối: ' + error.message, 'danger');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field, value) => {
    setSettings(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleArrayChange = (field, index, key, value) => {
    setSettings(prev => ({
      ...prev,
      [field]: prev[field].map((item, i) => 
        i === index ? { ...item, [key]: value } : item
      )
    }));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const result = await invoke('save-landing-settings', settings);
      if (result.success) {
        setOriginalSettings(JSON.parse(JSON.stringify(settings)));
        showToast('Cài đặt landing đã được lưu thành công', 'success');
      } else {
        showToast('Lỗi lưu cài đặt: ' + result.message, 'danger');
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      showToast('Lỗi kết nối: ' + error.message, 'danger');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setSettings(JSON.parse(JSON.stringify(originalSettings)));
    showToast('Đã hủy các thay đổi', 'info');
  };

  const hasChanges = JSON.stringify(settings) !== JSON.stringify(originalSettings);

  if (loading) {
    return (
      <div className="p-6 bg-slate-50 min-h-screen flex items-center justify-center">
        <div className="animate-spin">
          <Settings className="w-8 h-8 text-blue-600" />
        </div>
      </div>
    );
  }

  if (!settings) {
    return <div className="p-6 text-center text-red-600">Lỗi tải cài đặt</div>;
  }

  return (
    <div className="p-6 bg-slate-50 min-h-screen font-sans">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
            <Settings className="text-blue-600" size={32} />
            Cài Đặt Trang Landing
          </h1>
          <p className="text-slate-500 mt-2">Chỉnh các thông số hiển thị trên trang landing page</p>
        </div>

        {/* Main Form */}
        <div className="bg-white rounded-xl shadow-sm p-8 border border-slate-200">
          <div className="space-y-8">
            
            {/* Branding Section */}
            <section>
              <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
                <Image size={20} className="text-purple-600" />
                Branding & Logo
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Logo URL
                  </label>
                  <input
                    type="text"
                    value={settings.logoUrl || ''}
                    onChange={(e) => handleChange('logoUrl', e.target.value)}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="https://..."
                  />
                  <p className="text-xs text-slate-500 mt-1">URL của hình ảnh logo</p>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Tiêu Đề Chính
                  </label>
                  <input
                    type="text"
                    value={settings.mainTitle || ''}
                    onChange={(e) => handleChange('mainTitle', e.target.value)}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="OK999.SITE"
                  />
                  <p className="text-xs text-slate-500 mt-1">Tiêu đề chính của trang</p>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Mô Tả Phụ (Subtitle)
                  </label>
                  <input
                    type="text"
                    value={settings.subtitle || ''}
                    onChange={(e) => handleChange('subtitle', e.target.value)}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Đẳng cấp Casino Quốc Tế"
                  />
                </div>
              </div>
            </section>

            {/* Bot Settings */}
            <section className="border-t border-slate-200 pt-8">
              <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
                <Type size={20} className="text-green-600" />
                Cài Đặt Bot
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Tên Bot
                  </label>
                  <input
                    type="text"
                    value={settings.botName || ''}
                    onChange={(e) => handleChange('botName', e.target.value)}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="MIG30 Support Bot"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Link Bot Telegram
                  </label>
                  <input
                    type="text"
                    value={settings.botLink || ''}
                    onChange={(e) => handleChange('botLink', e.target.value)}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="t.me/MIG30VIP_bot"
                  />
                </div>
              </div>
            </section>

            {/* CTA Button */}
            <section className="border-t border-slate-200 pt-8">
              <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
                <Palette size={20} className="text-pink-600" />
                Nút Gọi Hành Động (CTA Button)
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Text Nút
                  </label>
                  <input
                    type="text"
                    value={settings.ctaButtonText || ''}
                    onChange={(e) => handleChange('ctaButtonText', e.target.value)}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="TRUY CẬP BOT NGAY"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    URL Nút
                  </label>
                  <input
                    type="text"
                    value={settings.ctaButtonUrl || ''}
                    onChange={(e) => handleChange('ctaButtonUrl', e.target.value)}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="https://t.me/bot_link"
                  />
                  <p className="text-xs text-slate-500 mt-1">URL hoặc link bot Telegram</p>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Màu Nút (Hex)
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      value={settings.ctaButtonColor || '#229ED9'}
                      onChange={(e) => handleChange('ctaButtonColor', e.target.value)}
                      className="w-12 h-10 border border-slate-300 rounded-lg cursor-pointer"
                    />
                    <input
                      type="text"
                      value={settings.ctaButtonColor || '#229ED9'}
                      onChange={(e) => handleChange('ctaButtonColor', e.target.value)}
                      className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Màu Hover (Hex)
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      value={settings.ctaButtonHoverColor || '#1e8bc0'}
                      onChange={(e) => handleChange('ctaButtonHoverColor', e.target.value)}
                      className="w-12 h-10 border border-slate-300 rounded-lg cursor-pointer"
                    />
                    <input
                      type="text"
                      value={settings.ctaButtonHoverColor || '#1e8bc0'}
                      onChange={(e) => handleChange('ctaButtonHoverColor', e.target.value)}
                      className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                    />
                  </div>
                </div>
              </div>
            </section>

            {/* Gift Code Section */}
            <section className="border-t border-slate-200 pt-8">
              <h2 className="text-xl font-bold text-slate-800 mb-4">Mã Quà Tặng & Nút Hỗ Trợ</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Mã Code
                  </label>
                  <input
                    type="text"
                    value={settings.giftCode || ''}
                    onChange={(e) => handleChange('giftCode', e.target.value)}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="MIG30VIP"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Text Nút Nhận Code
                  </label>
                  <input
                    type="text"
                    value={settings.giftButtonText || ''}
                    onChange={(e) => handleChange('giftButtonText', e.target.value)}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Nhận Code"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    URL Nút Nhận Code
                  </label>
                  <input
                    type="text"
                    value={settings.giftButtonUrl || ''}
                    onChange={(e) => handleChange('giftButtonUrl', e.target.value)}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="https://..."
                  />
                  <p className="text-xs text-slate-500 mt-1">URL hoặc link điều hướng khi click nút</p>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Text Nút Hỗ Trợ
                  </label>
                  <input
                    type="text"
                    value={settings.supportButtonText || ''}
                    onChange={(e) => handleChange('supportButtonText', e.target.value)}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Hỗ Trợ"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    URL Nút Hỗ Trợ
                  </label>
                  <input
                    type="text"
                    value={settings.supportButtonUrl || ''}
                    onChange={(e) => handleChange('supportButtonUrl', e.target.value)}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="https://t.me/support_bot"
                  />
                  <p className="text-xs text-slate-500 mt-1">URL hoặc link bot hỗ trợ</p>
                </div>
              </div>
            </section>

            {/* Footer */}
            <section className="border-t border-slate-200 pt-8">
              <h2 className="text-xl font-bold text-slate-800 mb-4">Chân Trang</h2>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Text Bản Quyền
                </label>
                <textarea
                  value={settings.copyrightText || ''}
                  onChange={(e) => handleChange('copyrightText', e.target.value)}
                  rows="3"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="© 2025 MIG30.VIP Entertainment. All rights reserved."
                />
              </div>
            </section>

          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 mt-10 pt-8 border-t border-slate-200">
            <button
              onClick={handleSave}
              disabled={!hasChanges || saving}
              className={`flex items-center gap-2 px-6 py-3 rounded-lg font-bold transition-all ${
                hasChanges && !saving
                  ? 'bg-green-600 text-white hover:bg-green-700 shadow-lg shadow-green-600/20'
                  : 'bg-slate-200 text-slate-500 cursor-not-allowed'
              }`}
            >
              <Save size={18} />
              {saving ? 'Đang lưu...' : 'Lưu Cài Đặt'}
            </button>

            <button
              onClick={handleReset}
              disabled={!hasChanges}
              className={`flex items-center gap-2 px-6 py-3 rounded-lg font-bold transition-all ${
                hasChanges
                  ? 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                  : 'bg-slate-100 text-slate-400 cursor-not-allowed'
              }`}
            >
              <RotateCcw size={18} />
              Hủy Bỏ
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LandingSettings;
