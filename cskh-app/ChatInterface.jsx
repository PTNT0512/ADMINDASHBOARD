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

  if (diff < 60) return 'vừa xong';
  if (diff < 3600) return `${Math.floor(diff / 60)} phút trước`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} giờ trước`;
  return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
};

const ChatInterface = () => {
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [imagePreview, setImagePreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [typingUsers, setTypingUsers] = useState(new Set());
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const selectedUserRef = useRef(selectedUser);
  const typingTimeoutRef = useRef(null);
  const isTypingRef = useRef(false);
  const { showToast } = useToast();
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => forceUpdate(n => n + 1), 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    selectedUserRef.current = selectedUser;
    return () => {
      if (isTypingRef.current && selectedUser) {
        socket.emit('admin_stop_typing', { userId: selectedUser.userId });
      }
      isTypingRef.current = false;
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, [selectedUser]);

  const playNotificationSound = () => {
    const audio = new Audio('/notification.mp3'); // Đặt file âm thanh trong thư mục public
    audio.play().catch(e => console.error("Error playing sound:", e));
  };

  useEffect(() => {
    if (!socket.connected) socket.connect();
    
    socket.on('connect', () => console.log('✅ Socket CSKH Connected:', socket.id));
    socket.on('disconnect', () => console.log('❌ Socket CSKH Disconnected'));
    socket.on('connect_error', (err) => console.error('⚠️ Socket Connection Error:', err));

    fetchUsers();

    function onNewMessage(newMessage) {
      console.log('📩 New Message Received:', newMessage);
      setUsers(prevUsers => {
        const userIndex = prevUsers.findIndex(u => u.userId === newMessage.userId);
        let updatedUsers;
        if (userIndex > -1) {
          const userToUpdate = { ...prevUsers[userIndex] };
          userToUpdate.lastMessage = newMessage.imageBase64 ? '[Hình ảnh]' : newMessage.content;
          userToUpdate.createdAt = newMessage.createdAt;
          if (selectedUserRef.current?.userId !== newMessage.userId) {
            userToUpdate.unreadCount = (userToUpdate.unreadCount || 0) + 1;
          }
          updatedUsers = [userToUpdate, ...prevUsers.filter(u => u.userId !== newMessage.userId)];
        } else {
          updatedUsers = [{
            userId: newMessage.userId,
            username: newMessage.username,
            lastMessage: newMessage.imageBase64 ? '[Hình ảnh]' : newMessage.content,
            unreadCount: selectedUserRef.current?.userId === newMessage.userId ? 0 : 1,
            createdAt: newMessage.createdAt
          }, ...prevUsers];
        }
        return updatedUsers;
      });

      if (selectedUserRef.current?.userId === newMessage.userId) {
        setMessages(prevMessages => {
          const incomingId = newMessage._id || newMessage.id;
          if (prevMessages.some(m => String(m._id || m.id) === String(incomingId))) return prevMessages;
          return [...prevMessages, newMessage];
        });
        // Mark as read immediately if chat is open
        fetch(`${API_URL}/mark-read`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: newMessage.userId })
        });
      } else {
        playNotificationSound();
        showToast(`Tin nhắn mới từ ${newMessage.username || newMessage.userId}: ${newMessage.content || '[Hình ảnh]'}`, 'info');
      }
    }

    function onAdminReplied(newMessage) {
        if (selectedUserRef.current?.userId === newMessage.userId) {
            setMessages(prevMessages => {
                const newMessages = prevMessages.filter(m => !m.isTemp);
                const incomingId = newMessage._id || newMessage.id;
                if (newMessages.some(m => String(m._id || m.id) === String(incomingId))) return newMessages;
                return [...newMessages, newMessage];
            });
        }
    }

    function onMessageUnsent(unsentMessageId) {
        if (selectedUserRef.current) {
            setMessages(prevMessages => prevMessages.filter(m => (m._id || m.id) !== unsentMessageId));
        }
    }

    function onTyping({ userId }) {
        setTypingUsers(prev => new Set(prev).add(userId));
    }

    function onStopTyping({ userId }) {
        setTypingUsers(prev => {
            const next = new Set(prev);
            next.delete(userId);
            return next;
        });
    }

    socket.on('new_message', onNewMessage);
    socket.on('admin_replied', onAdminReplied);
    socket.on('message_unsent', onMessageUnsent);
    socket.on('typing', onTyping);
    socket.on('stop_typing', onStopTyping);

    return () => {
      socket.off('new_message', onNewMessage);
      socket.off('admin_replied', onAdminReplied);
      socket.off('message_unsent', onMessageUnsent);
      socket.off('typing', onTyping);
      socket.off('stop_typing', onStopTyping);
    };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchUsers = async () => {
    try {
      const response = await fetch(`${API_URL}/users`);
      const result = await response.json();
      if (result.success) {
        setUsers(result.data);
      }
    } catch (error) {
      console.error("Lỗi tải danh sách người dùng:", error);
    }
  };

  const fetchMessages = async (userId) => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/messages/${userId}`);
      const result = await response.json();
      if (result.success) {
        // Lọc trùng lặp dựa trên _id để đảm bảo danh sách tin nhắn là duy nhất
        const uniqueMessages = result.data.filter((msg, index, self) =>
            index === self.findIndex((t) => (
                String(t._id || t.id) === String(msg._id || msg.id)
            ))
        );
        setMessages(uniqueMessages);
      }
    } catch (error) {
      console.error(`Lỗi tải tin nhắn cho user ${userId}:`, error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectUser = (user) => {
    setSelectedUser(user);
    setMessages([]);
    fetchMessages(user.userId);
    fetch(`${API_URL}/mark-read`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.userId })
    });
    setUsers(users.map(u => u.userId === user.userId ? { ...u, unreadCount: 0 } : u));
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if ((!inputText.trim() && !imagePreview) || !selectedUser) return;

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    isTypingRef.current = false;
    socket.emit('admin_stop_typing', { userId: selectedUser.userId });

    const tempId = Date.now();
    const tempMsg = {
      _id: tempId,
      content: inputText,
      direction: 'out',
      createdAt: new Date(),
      imageBase64: imagePreview,
      isTemp: true
    };
    setMessages(prev => [...prev, tempMsg]);
    setInputText('');
    setImagePreview(null);
    if(fileInputRef.current) fileInputRef.current.value = "";

    try {
      const response = await fetch(`${API_URL}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          userId: selectedUser.userId, 
          text: tempMsg.content,
          imageBase64: tempMsg.imageBase64
        })
      });
      if (!response.ok) {
        throw new Error('Lỗi mạng hoặc server');
      }
    } catch (error) {
      console.error("Lỗi gửi tin nhắn:", error);
      setMessages(prev => prev.filter(m => m._id !== tempId));
      alert('Gửi tin nhắn thất bại. Vui lòng thử lại.');
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
    } else {
      alert('Vui lòng chọn một file ảnh.');
    }
    e.target.value = null;
  };

  const handleInputChange = (e) => {
    const text = e.target.value;
    setInputText(text);

    if (!selectedUser) return;

    if (!isTypingRef.current) {
        isTypingRef.current = true;
        socket.emit('admin_typing', { userId: selectedUser.userId });
    }

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

    typingTimeoutRef.current = setTimeout(() => {
        isTypingRef.current = false;
        socket.emit('admin_stop_typing', { userId: selectedUser.userId });
    }, 2000);
  };

  const handleDeleteMessage = async (msgId) => {
    if (!msgId) return;
    if (!window.confirm('Bạn có chắc muốn xóa tin nhắn này?')) return;

    try {
      const response = await fetch(`${API_URL}/messages/${msgId}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        showToast(`Lỗi server: ${response.status}`, 'error');
        return;
      }

      const result = await response.json();
      
      if (result.success) {
        setMessages(prev => prev.filter(m => (m._id || m.id) !== msgId));
        showToast('Đã xóa tin nhắn', 'success');
      } else {
        showToast('Xóa thất bại: ' + (result.message || 'Lỗi server'), 'error');
      }
    } catch (error) {
      console.error("Lỗi xóa tin nhắn:", error);
      showToast('Lỗi kết nối', 'error');
    }
  };

  const handleUnsendMessage = async (msgId) => {
    if (!msgId) return;
    if (!window.confirm('Bạn có chắc muốn thu hồi tin nhắn này?')) return;

    try {
      const response = await fetch(`${API_URL}/unsend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageId: msgId })
      });

      if (!response.ok) {
        showToast(`Lỗi server: ${response.status}`, 'error');
        return;
      }

      const result = await response.json();

      if (result.success) {
        // Optimistically remove the message or update it to show "unsent"
        setMessages(prev => prev.filter(m => (m._id || m.id) !== msgId));
        showToast('Đã thu hồi tin nhắn', 'success');
      } else {
        showToast('Thu hồi thất bại: ' + (result.message || 'Lỗi server'), 'error');
      }
    } catch (error) {
      console.error("Lỗi thu hồi tin nhắn:", error);
      showToast('Lỗi kết nối', 'error');
    }
  };

  return (
    <div className="support-container">
      <div className="user-list">
        <div className="user-list-header">
          <i className="fas fa-users"></i> Khách Hàng
        </div>
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {users.map(user => (
            <div 
              key={user.userId} 
              className={`user-item ${selectedUser?.userId === user.userId ? 'active' : ''}`}
              onClick={() => handleSelectUser(user)}
            >
              <div className="user-info">
                <h4>{user.username || `User ${user.userId}`}</h4>
                <p>
                  {typingUsers.has(user.userId) ? (
                    <span style={{ color: '#0ea5e9', fontStyle: 'italic', fontSize: '12px' }}>
                      <i className="fas fa-pen-nib"></i> Đang nhập...
                    </span>
                  ) : user.lastMessage}
                </p>
              </div>
              {user.unreadCount > 0 && (
                <span className="unread-badge">{user.unreadCount}</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {selectedUser ? (
        <div className="chat-area">
          <div className="chat-header">
            <span>
              <i className="fas fa-terminal"></i> Đang chat với: <b>{selectedUser.username}</b> (ID: {selectedUser.userId})
            </span>
            <button onClick={() => fetchMessages(selectedUser.userId)} style={{padding: '5px 10px', fontSize: '10px', background: 'transparent', border: '1px solid #555', color: '#888', cursor: 'pointer'}}>
              <i className="fas fa-sync"></i> Refresh
            </button>
          </div>

          <div className="chat-messages">
            {loading ? <p>Đang tải tin nhắn...</p> : messages.map((msg, idx) => (
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
                <span className="msg-time">
                  {formatRelativeTime(msg.createdAt)}
                </span>
                {!msg.isTemp && msg.direction === 'out' && (
                  <button 
                    className="delete-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleUnsendMessage(msg._id || msg.id);
                    }}
                    title="Thu hồi tin nhắn"
                  >
                    <i className="fas fa-trash-alt"></i>
                  </button>
                )}
              </div>
            ))}
            {selectedUser && typingUsers.has(selectedUser.userId) && (
              <div className="message-bubble msg-in" style={{ fontStyle: 'italic', opacity: 0.7, padding: '8px 12px' }}>
                <i className="fas fa-ellipsis-h"></i> Đang nhập...
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <form className="chat-input-area" onSubmit={handleSend}>
            <input type="file" id="image-upload" ref={fileInputRef} style={{ display: 'none' }} accept="image/*" onChange={handleFileSelect} />
            <button type="button" className="btn-send" onClick={() => fileInputRef.current.click()} style={{padding: '0 15px', alignSelf: 'flex-end'}}>
              <i className="fas fa-paperclip"></i>
            </button>
            <div className="chat-input-wrapper">
              {imagePreview && (
                <div className="image-preview-container">
                  <img src={imagePreview} alt="Preview" />
                  <button type="button" className="remove-preview-btn" onClick={() => setImagePreview(null)}>×</button>
                </div>
              )}
              <textarea 
                className="chat-input" 
                placeholder="Nhập tin nhắn..." 
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
            <button type="submit" className="btn-send">
              <i className="fas fa-paper-plane"></i> GỬI
            </button>
          </form>
        </div>
      ) : (
        <div className="empty-state">
          <i className="fas fa-satellite-dish"></i>
          <p>Chọn một người dùng để bắt đầu cuộc trò chuyện</p>
        </div>
      )}
    </div>
  );
};

export default ChatInterface;