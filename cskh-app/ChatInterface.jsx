import React, { useState, useEffect, useRef } from 'react';
import { socket } from './socket';
import { useToast } from '../src/components/ToastContext';

const BASE_URL = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_URL)
  || (typeof process !== 'undefined' && process.env && process.env.REACT_APP_API_URL)
  || 'http://localhost:4001';
const API_URL = `${BASE_URL}/api/support`;

const formatRelativeTime = (dateInput) => {
  if (!dateInput) return '';
  const date = new Date(dateInput);
  const now = new Date();
  const diff = Math.floor((now - date) / 1000);
  if (diff < 60) return 'vua xong';
  if (diff < 3600) return `${Math.floor(diff / 60)} phut truoc`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} gio truoc`;
  return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
};

const ChatInterface = () => {
  const [activeSession, setActiveSession] = useState(null);
  const [pendingTicket, setPendingTicket] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [imagePreview, setImagePreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [typingUsers, setTypingUsers] = useState(new Set());
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const textAreaRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const isTypingRef = useRef(false);
  const { showToast } = useToast();

  const getCurrentAgent = () => {
    try {
      const raw = localStorage.getItem('cskhUser');
      const me = raw ? JSON.parse(raw) : null;
      return {
        id: me?._id || me?.id || '',
        username: me?.username || '',
        fullName: me?.fullName || '',
        name: me?.fullName || me?.username || ''
      };
    } catch (e) {
      return { id: '', username: '', fullName: '', name: '' };
    }
  };

  const registerPresence = () => {
    const me = getCurrentAgent();
    if (!me.name) return;
    socket.emit('cskh-agent-online', {
      id: me.id,
      username: me.username,
      fullName: me.fullName
    });
  };

  const fetchMessages = async (userId) => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/messages/${userId}`);
      const result = await response.json();
      if (result.success) setMessages(result.data || []);
    } catch (error) {
      showToast('Loi tai lich su tin nhan', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchUserSummary = async (userId) => {
    try {
      const response = await fetch(`${API_URL}/users`);
      const result = await response.json();
      if (!result.success) return null;
      return (result.data || []).find((u) => Number(u.userId) === Number(userId)) || null;
    } catch (e) {
      return null;
    }
  };

  const putPendingTicket = (ticket) => {
    if (!ticket || !ticket.userId) return;
    setPendingTicket((prev) => {
      if (prev && Number(prev.userId) === Number(ticket.userId)) {
        return { ...prev, ...ticket };
      }
      return ticket;
    });
  };

  const handleAcceptTicket = async () => {
    if (!pendingTicket) return;
    const me = getCurrentAgent();
    if (!me.name) return showToast('Khong xac dinh duoc nhan vien hien tai', 'error');

    try {
      const response = await fetch(`${API_URL}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: pendingTicket.userId, agentName: me.name })
      });
      const result = await response.json();
      if (!result.success) return showToast(result.message || 'Tiep nhan that bai', 'error');

      setActiveSession({
        userId: pendingTicket.userId,
        username: pendingTicket.username || `User ${pendingTicket.userId}`
      });
      setPendingTicket(null);
      setMessages([]);
      await fetchMessages(pendingTicket.userId);
      await fetch(`${API_URL}/mark-read`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: pendingTicket.userId })
      });
      showToast('Da tiep nhan phien chat', 'success');
    } catch (error) {
      showToast('Loi ket noi khi tiep nhan', 'error');
    }
  };

  const handleRejectTicket = async () => {
    if (!pendingTicket) return;
    const me = getCurrentAgent();
    try {
      await fetch(`${API_URL}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: pendingTicket.userId, agentName: me.name || '' })
      });
      setPendingTicket(null);
      showToast('Da huy bo yeu cau', 'info');
    } catch (error) {
      showToast('Loi ket noi khi huy bo', 'error');
    }
  };

  const handleCloseChatAndClear = async () => {
    if (!activeSession) return;
    if (!window.confirm('Dong cuoc tro chuyen va xoa lich su chat?')) return;

    const me = getCurrentAgent();
    const userId = activeSession.userId;
    try {
      await fetch(`${API_URL}/close-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, agentName: me.name || 'CSKH' })
      });
      await fetch(`${API_URL}/clear-history/${userId}`, { method: 'DELETE' });
      setActiveSession(null);
      setMessages([]);
      setInputText('');
      setImagePreview(null);
      showToast('Da dong chat va xoa lich su', 'success');
    } catch (error) {
      showToast('Loi khi dong va xoa lich su chat', 'error');
    }
  };

  useEffect(() => {
    if (!socket.connected) socket.connect();
    registerPresence();

    socket.on('connect', registerPresence);

    const onNewMessage = (newMessage) => {
      if (!newMessage || !newMessage.userId) return;
      const incomingUserId = Number(newMessage.userId);

      if (activeSession && Number(activeSession.userId) === incomingUserId) {
        setMessages((prev) => [...prev, newMessage]);
        fetch(`${API_URL}/mark-read`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: incomingUserId })
        });
      } else {
        putPendingTicket({
          userId: incomingUserId,
          username: newMessage.username || `User ${incomingUserId}`,
          preview: newMessage.content || '[Hinh anh]'
        });
        showToast(`Yeu cau ho tro moi tu ${newMessage.username || incomingUserId}`, 'info');
      }
    };

    const onSupportAssigned = async (payload) => {
      const me = getCurrentAgent();
      if (!payload || !payload.userId) return;
      const assignedToMe =
        (payload.assignedSocketId && payload.assignedSocketId === socket.id) ||
        (payload.assignedTo && me.name && payload.assignedTo === me.name);
      if (!assignedToMe) return;

      const summary = await fetchUserSummary(payload.userId);
      putPendingTicket({
        userId: Number(payload.userId),
        username: summary?.username || `User ${payload.userId}`,
        preview: summary?.lastMessage || 'Yeu cau ho tro moi'
      });
    };

    const onSupportClosed = (payload) => {
      if (!payload || !payload.userId) return;
      if (activeSession && Number(activeSession.userId) === Number(payload.userId)) {
        setActiveSession(null);
        setMessages([]);
      }
      if (pendingTicket && Number(pendingTicket.userId) === Number(payload.userId)) {
        setPendingTicket(null);
      }
    };

    const onTyping = ({ userId }) => {
      setTypingUsers((prev) => new Set(prev).add(userId));
    };

    const onStopTyping = ({ userId }) => {
      setTypingUsers((prev) => {
        const next = new Set(prev);
        next.delete(userId);
        return next;
      });
    };

    socket.on('new_message', onNewMessage);
    socket.on('support_assigned', onSupportAssigned);
    socket.on('support_closed', onSupportClosed);
    socket.on('typing', onTyping);
    socket.on('stop_typing', onStopTyping);

    return () => {
      socket.emit('cskh-agent-offline');
      socket.off('connect', registerPresence);
      socket.off('new_message', onNewMessage);
      socket.off('support_assigned', onSupportAssigned);
      socket.off('support_closed', onSupportClosed);
      socket.off('typing', onTyping);
      socket.off('stop_typing', onStopTyping);
    };
  }, [activeSession, pendingTicket]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (e) => {
    e.preventDefault();
    if ((!inputText.trim() && !imagePreview) || !activeSession) return;

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    isTypingRef.current = false;
    socket.emit('admin_stop_typing', { userId: activeSession.userId });

    const tempId = Date.now();
    const tempMsg = {
      _id: tempId,
      content: inputText,
      direction: 'out',
      createdAt: new Date(),
      imageBase64: imagePreview,
      isTemp: true
    };
    setMessages((prev) => [...prev, tempMsg]);
    setInputText('');
    setImagePreview(null);
    if (textAreaRef.current) {
      textAreaRef.current.style.height = '44px';
    }
    if (fileInputRef.current) fileInputRef.current.value = '';

    try {
      const response = await fetch(`${API_URL}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: activeSession.userId,
          text: tempMsg.content,
          imageBase64: tempMsg.imageBase64
        })
      });
      if (!response.ok) throw new Error('Send failed');
      setMessages((prev) => prev.filter((m) => !m.isTemp));
    } catch (error) {
      setMessages((prev) => prev.filter((m) => m._id !== tempId));
      showToast('Gui tin nhan that bai', 'error');
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file || !file.type.startsWith('image/')) return showToast('Vui long chon file anh', 'error');
    const reader = new FileReader();
    reader.onloadend = () => setImagePreview(reader.result);
    reader.readAsDataURL(file);
    e.target.value = null;
  };

  const handleInputChange = (e) => {
    const text = e.target.value;
    setInputText(text);
    if (textAreaRef.current) {
      textAreaRef.current.style.height = 'auto';
      textAreaRef.current.style.height = `${Math.min(textAreaRef.current.scrollHeight, 160)}px`;
    }
    if (!activeSession) return;
    if (!isTypingRef.current) {
      isTypingRef.current = true;
      socket.emit('admin_typing', { userId: activeSession.userId });
    }
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      isTypingRef.current = false;
      socket.emit('admin_stop_typing', { userId: activeSession.userId });
    }, 2000);
  };

  return (
    <div className="support-container" style={{ gridTemplateColumns: '1fr' }}>
      {!activeSession ? (
        <div className="empty-state">
          <i className="fas fa-headset"></i>
          <p style={{ fontWeight: 700, marginBottom: 6 }}>Màn hình chờ hỗ trợ</p>
          <p>Hệ thống sẽ hiển thị yêu cầu hỗ trợ khi có người dùng gửi tới bạn.</p>
        </div>
      ) : (
        <div className="chat-area">
          <div className="chat-header">
            <span>
              <i className="fas fa-terminal"></i> Dang chat voi: <b>{activeSession.username}</b> (ID: {activeSession.userId})
            </span>
            <button
              onClick={handleCloseChatAndClear}
              title="Dong va xoa lich su"
              style={{
                border: '1px solid #dc2626',
                borderRadius: 8,
                width: 34,
                height: 30,
                color: '#dc2626',
                background: '#fff',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              X
            </button>
          </div>

          <div className="chat-messages">
            {loading ? <p>Dang tai tin nhan...</p> : messages.map((msg, idx) => (
              <div key={msg._id || msg.id || idx} className={`message-bubble ${msg.direction === 'in' ? 'msg-in' : 'msg-out'}`}>
                {msg.imageBase64 && (
                  <img
                    src={msg.imageBase64}
                    alt="Attachment"
                    className="message-image"
                    onClick={() => window.open(msg.imageBase64, '_blank')}
                  />
                )}
                {msg.content && <div className="message-content">{msg.content}</div>}
                <span className="msg-time">{formatRelativeTime(msg.createdAt)}</span>
              </div>
            ))}
            {activeSession && typingUsers.has(activeSession.userId) && (
              <div className="message-bubble msg-in" style={{ fontStyle: 'italic', opacity: 0.7, padding: '8px 12px' }}>
                <i className="fas fa-ellipsis-h"></i> Dang nhap...
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <form className="chat-input-area" onSubmit={handleSend}>
            <input type="file" id="image-upload" ref={fileInputRef} style={{ display: 'none' }} accept="image/*" onChange={handleFileSelect} />
            <button type="button" className="btn-send btn-attach" onClick={() => fileInputRef.current?.click()}>
              <i className="fas fa-paperclip"></i>
            </button>
            <div className="chat-input-wrapper">
              {imagePreview && (
                <div className="image-preview-container">
                  <img src={imagePreview} alt="Preview" />
                  <button type="button" className="remove-preview-btn" onClick={() => setImagePreview(null)}>x</button>
                </div>
              )}
              <textarea
                ref={textAreaRef}
                className="chat-input"
                placeholder="Nhap tin nhan..."
                value={inputText}
                onChange={handleInputChange}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend(e);
                  }
                }}
                rows="1"
              />
            </div>
            <button type="submit" className="btn-send btn-submit">
              <i className="fas fa-paper-plane"></i>
            </button>
          </form>
        </div>
      )}

      {pendingTicket && !activeSession && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(2,6,23,0.45)',
            display: 'grid',
            placeItems: 'center',
            zIndex: 10000
          }}
        >
          <div
            style={{
              width: 'min(520px, 92vw)',
              background: '#fff',
              borderRadius: 14,
              border: '1px solid #dbe4ef',
              boxShadow: '0 20px 45px rgba(2,6,23,0.28)',
              padding: 16
            }}
          >
            <h3 style={{ margin: 0, marginBottom: 8, color: '#0f172a' }}>
              Yeu cau ho tro moi
            </h3>
            <p style={{ margin: '0 0 4px', color: '#334155' }}>
              <b>Khach hang:</b> {pendingTicket.username || `User ${pendingTicket.userId}`}
            </p>
            <p style={{ margin: '0 0 4px', color: '#334155' }}>
              <b>User ID:</b> {pendingTicket.userId}
            </p>
            <p style={{ margin: '0 0 12px', color: '#64748b' }}>
              {pendingTicket.preview || 'Can ho tro ngay'}
            </p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                onClick={handleRejectTicket}
                style={{
                  border: '1px solid #dc2626',
                  background: '#fff',
                  color: '#dc2626',
                  borderRadius: 8,
                  padding: '8px 12px',
                  cursor: 'pointer',
                  fontWeight: 700
                }}
              >
                Huy bo
              </button>
              <button
                onClick={handleAcceptTicket}
                style={{
                  border: '1px solid #0ea5e9',
                  background: '#0ea5e9',
                  color: '#fff',
                  borderRadius: 8,
                  padding: '8px 12px',
                  cursor: 'pointer',
                  fontWeight: 700
                }}
              >
                Tiep nhan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatInterface;
