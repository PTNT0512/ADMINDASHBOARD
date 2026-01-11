import React, { useState, useEffect, useRef } from 'react';
import { useIpc, useToast } from './ToastContext';

const SupportPage = () => {
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [imagePreview, setImagePreview] = useState(null); // State để xem trước ảnh base64
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);
  
  const { invoke } = useIpc();
  const { showToast } = useToast();

  // Polling để lấy danh sách user và tin nhắn mới
  useEffect(() => {
    fetchUsers();
    const interval = setInterval(() => {
      fetchUsers();
      if (selectedUser) {
        fetchMessages(selectedUser.userId, false);
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [selectedUser]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchUsers = async () => {
    const result = await invoke('get-support-users'); 
    if (result.success) {
      setUsers(result.data);
    }
  };

  const fetchMessages = async (userId, showLoading = true) => {
    if (showLoading) setLoading(true);
    const result = await invoke('get-support-messages', userId);
    if (result.success) {
      setMessages(result.data);
    }
    if (showLoading) setLoading(false);
  };

  const handleSelectUser = (user) => {
    setSelectedUser(user);
    fetchMessages(user.userId);
    invoke('mark-support-read', user.userId);
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!inputText.trim() || !selectedUser) return;

    const tempMsg = {
      content: inputText,
      direction: 'out',
      createdAt: new Date(),
      isTemp: true
    };
    setMessages([...messages, tempMsg]);
    setInputText('');

    const result = await invoke('send-support-reply', { userId: selectedUser.userId, text: tempMsg.content });
    
    if (!result.success) {
      showToast('Gửi thất bại: ' + result.message, 'error');
    } else {
      fetchMessages(selectedUser.userId, false);
    }
  };

  return (
    <div className="support-container">
      <style>{`
        .support-container {
          display: flex;
          height: calc(100vh - 80px);
          background: transparent;
          border: 1px solid rgba(15,23,42,0.03);
          margin: 20px;
          border-radius: 12px;
          overflow: hidden;
        }
        .user-list {
          width: 300px;
          border-right: 1px solid rgba(15,23,42,0.03);
          background: var(--card-bg);
          display: flex;
          flex-direction: column;
        }
        .user-list-header {
          padding: 15px;
          border-bottom: 1px solid rgba(15,23,42,0.03);
          color: var(--text);
          font-weight: 700;
          background: transparent;
        }
        .user-item {
          padding: 12px 14px;
          border-bottom: 1px solid rgba(15,23,42,0.03);
          cursor: pointer;
          transition: all 0.12s;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .user-item:hover { background: rgba(15,23,42,0.03); }
        .user-item.active {
          background: linear-gradient(90deg, rgba(96,165,250,0.06), rgba(125,211,252,0.02));
          border-left: 3px solid var(--primary);
        }
        .user-info h4 { margin: 0; color: var(--text); font-size: 14px; }
        .user-info p { margin: 5px 0 0; color: var(--muted); font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 180px; }
        .unread-badge { background: var(--danger); color: white; font-size: 10px; padding: 2px 6px; border-radius: 10px; font-weight: 700; }
        .chat-area { flex: 1; display: flex; flex-direction: column; background: transparent; }
        .chat-header { padding: 15px; border-bottom: 1px solid rgba(15,23,42,0.03); color: var(--text); display: flex; justify-content: space-between; align-items: center; }
        .chat-messages { flex: 1; padding: 20px; overflow-y: auto; display: flex; flex-direction: column; gap: 10px; }
        .message-bubble { max-width: 70%; padding: 10px 15px; border-radius: 8px; font-size: 13px; line-height: 1.4; position: relative; }
        .msg-in { align-self: flex-start; background: var(--card-bg); color: var(--text); border: 1px solid rgba(15,23,42,0.04); border-left: 3px solid rgba(15,23,42,0.06); }
        .msg-out { align-self: flex-end; background: rgba(96,165,250,0.12); color: var(--text); border: 1px solid rgba(96,165,250,0.12); border-right: 3px solid var(--primary); }
        .msg-time { font-size: 10px; opacity: 0.6; margin-top: 5px; display: block; text-align: right; }
        .chat-input-area { padding: 15px; border-top: 1px solid rgba(15,23,42,0.03); display: flex; gap: 10px; background: var(--card-bg); }
        .chat-input { flex: 1; background: var(--card-bg); border: 1px solid rgba(15,23,42,0.04); color: var(--text); padding: 10px; border-radius: 8px; outline: none; }
        .chat-input:focus { border-color: var(--primary); }
        .btn-send { padding: 8px 14px; }
        .empty-state { flex: 1; display: flex; align-items: center; justify-content: center; color: var(--muted); flex-direction: column; }
        .empty-state i { font-size: 40px; margin-bottom: 10px; color: rgba(15,23,42,0.2); }
      `}</style>

      <div className="user-list">
        <div className="user-list-header"><i className="fas fa-users-cog"></i> Danh sách hỗ trợ</div>
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {users.map(user => (
            <div key={user.userId} className={`user-item ${selectedUser?.userId === user.userId ? 'active' : ''}`} onClick={() => handleSelectUser(user)}>
              <div className="user-info">
                <h4>{user.username || `User ${user.userId}`}</h4>
                <p>{user.lastMessage}</p>
              </div>
              {user.unreadCount > 0 && <span className="unread-badge">{user.unreadCount}</span>}
            </div>
          ))}
        </div>
      </div>

      {selectedUser ? (
        <div className="chat-area">
          <div className="chat-header">
            <span><i className="fas fa-comments"></i> Chat: <b>{selectedUser.username}</b> ({selectedUser.userId})</span>
            <button onClick={() => fetchMessages(selectedUser.userId)} className="btn secondary" aria-label="Refresh messages">
              <i className="fas fa-sync"></i>
            </button>
          </div>
          <div className="chat-messages">
            {messages.map((msg, idx) => (
              <div key={idx} className={`message-bubble ${msg.direction === 'in' ? 'msg-in' : 'msg-out'}`}>
                {msg.content}
                <span className="msg-time">{new Date(msg.createdAt).toLocaleTimeString('vi-VN', {hour: '2-digit', minute:'2-digit'})}</span>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
          <form className="chat-input-area" onSubmit={handleSend}>
            <input type="text" className="chat-input" placeholder="Nhập tin nhắn..." value={inputText} onChange={(e) => setInputText(e.target.value)} />
            <button type="submit" className="btn btn-send"><i className="fas fa-paper-plane"></i> Gửi</button>
          </form>
        </div>
      ) : (
        <div className="empty-state"><i className="fas fa-satellite-dish"></i><p>Chọn người dùng để chat</p></div>
      )}
    </div>
  );
};

export default SupportPage;