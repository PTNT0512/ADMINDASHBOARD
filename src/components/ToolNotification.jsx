import React, { useState, useEffect } from 'react';

function ToolNotification() {
  const [content, setContent] = useState('');
  const [history, setHistory] = useState([]);
  const [mediaPath, setMediaPath] = useState(null);
  const [targetType, setTargetType] = useState('all'); // 'all', 'group', 'user'
  const [targetValue, setTargetValue] = useState('');

  const fetchHistory = async () => {
    if (window.require) {
      const { ipcRenderer } = window.require('electron');
      const result = await ipcRenderer.invoke('get-notifications');
      if (result.success) setHistory(result.data);
    }
  };

  useEffect(() => { fetchHistory(); }, []);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!content) return;
    if (window.require) {
      const { ipcRenderer } = window.require('electron');
      const result = await ipcRenderer.invoke('send-notification', { content, mediaPath, targetType, targetValue });
      if (result.success) {
        alert('Đã gửi thông báo lên Telegram thành công!');
        setContent('');
        fetchHistory();
        setMediaPath(null);
        setTargetValue('');
      } else {
        alert('Lỗi: ' + result.message);
      }
    }
  };

  return (
    <>
      <header><h1>Tool Gửi Thông Báo Telegram</h1></header>
      <div className="settings-container" style={{ marginBottom: '20px', flex: '0 0 auto' }}>
        <form onSubmit={handleSend}>
          <div className="input-group">
            <label>Đối tượng nhận</label>
            <div style={{ display: 'flex', gap: '20px', marginBottom: '15px' }}>
              <label><input type="radio" name="target" value="all" checked={targetType === 'all'} onChange={() => setTargetType('all')} /> Gửi tất cả (Nhóm hệ thống)</label>
              <label><input type="radio" name="target" value="group" checked={targetType === 'group'} onChange={() => setTargetType('group')} /> Gửi tới nhóm</label>
              <label><input type="radio" name="target" value="user" checked={targetType === 'user'} onChange={() => setTargetType('user')} /> Gửi tới User ID</label>
            </div>
            {(targetType === 'group' || targetType === 'user') && (
              <div className="input-group">
                <input 
                  type="text" 
                  value={targetValue} 
                  onChange={(e) => setTargetValue(e.target.value)} 
                  placeholder={targetType === 'group' ? 'Nhập ID Nhóm...' : 'Nhập User ID...'} 
                  required 
                />
              </div>
            )}
          </div>
          <div className="input-group">
            <label>Nội dung thông báo</label>
            <button type="button" style={{width: 'auto', padding: '5px 15px', fontSize: '12px', background: '#78909c', marginBottom: '10px'}} onClick={async () => {
              if (window.require) {
                const { ipcRenderer } = window.require('electron');
                const path = await ipcRenderer.invoke('open-file-dialog');
                if (path) setMediaPath(path);
              }
            }}>Chọn Ảnh/Video...</button>
            {mediaPath && (
              mediaPath.match(/\.(jpeg|jpg|gif|png)$/) 
              ? <img src={`file:///${mediaPath.replace(/\\/g, '/')}`} alt="Preview" style={{ maxWidth: '200px', display: 'block', marginBottom: '10px', borderRadius: '4px' }} />
              : <div style={{ marginBottom: '10px', fontSize: '12px', color: '#666' }}>Đã chọn video: {mediaPath.split(/[\\/]/).pop()}</div>
            )}
            <textarea 
              rows="4" 
              style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #dce0e4', fontFamily: 'inherit' }}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Nhập nội dung thông báo..."
            ></textarea>
          </div>
          <button type="submit" style={{ width: 'auto', padding: '10px 30px' }}>Gửi Telegram</button>
        </form>
      </div>
      <div className="table-container">
        <table>
          <thead><tr><th>Thời gian</th><th>Nội dung</th></tr></thead>
          <tbody>
            {history.map(item => (<tr key={item.id}><td style={{ width: '200px' }}>{new Date(item.date).toLocaleString('vi-VN')}</td><td>{item.content}</td></tr>))}
          </tbody>
        </table>
      </div>
    </>
  );
}

export default ToolNotification;