const express = require('express');
const SupportMessage = require('../models/SupportMessage');

/**
 * createSupportRouter(io, sendCskhReply, checkCskhConnection)
 * - io: Socket.IO server for real-time events
 * - sendCskhReply: function(userId, text, imageBase64) used to send reply via CSKH bot
 * - checkCskhConnection: optional function to check CSKH bot status
 * - deleteCskhMessage: optional function to delete message via CSKH bot (NEW)
 */
module.exports = function createSupportRouter(io, sendCskhReply, checkCskhConnection, deleteCskhMessage) {
  const router = express.Router();

  // Danh sách user (tóm tắt) cho admin
  router.get('/users', async (req, res) => {
    try {
      const users = await SupportMessage.aggregate([
        { $sort: { createdAt: -1 } },
        { $group: {
            _id: '$userId',
            username: { $first: '$username' },
            lastMessage: { $first: '$content' },
            lastMessageImage: { $first: '$imageBase64' },
            createdAt: { $first: '$createdAt' },
            unreadCount: { $sum: { $cond: [{ $and: [{ $eq: ['$direction', 'in'] }, { $eq: ['$isRead', false] }] }, 1, 0] } }
        }},
        { $sort: { createdAt: -1 } }
      ]);
      const result = users.map(u => ({ userId: u._id, username: u.username, lastMessage: u.lastMessageImage ? '[Hình ảnh]' : u.lastMessage, unreadCount: u.unreadCount, createdAt: u.createdAt }));
      res.json({ success: true, data: result });
    } catch (e) {
      res.status(500).json({ success: false, message: e.message });
    }
  });

  // Lấy tin nhắn của 1 user
  router.get('/messages/:userId', async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      const messages = await SupportMessage.find({ userId }).sort({ createdAt: 1 }).limit(500);
      res.json({ success: true, data: messages });
    } catch (e) {
      res.status(500).json({ success: false, message: e.message });
    }
  });

  // Đánh dấu đã đọc
  router.post('/mark-read', async (req, res) => {
    try {
      const { userId } = req.body;
      await SupportMessage.updateMany({ userId: parseInt(userId), direction: 'in', isRead: false }, { $set: { isRead: true } });
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ success: false, message: e.message });
    }
  });

  // Admin trả lời user
  router.post('/reply', async (req, res) => {
    try {
      const { userId, text, imageBase64 } = req.body;
      if (!userId) return res.status(400).json({ success: false, message: 'Missing userId' });

      let telegramMessageId = null;
      // Gọi hàm gửi của CSKH bot nếu có
      if (typeof sendCskhReply === 'function') {
        try {
          const sentMsg = await sendCskhReply(parseInt(userId), text || '', imageBase64 || null);
          if (sentMsg && sentMsg.message_id) telegramMessageId = sentMsg.message_id;
        } catch (err) {
          // Continue to save message even if sending fails
          console.error('[Support Router] sendCskhReply error:', err.message || err);
        }
      }

      const newMessage = await SupportMessage.create({
        userId: parseInt(userId),
        username: 'Admin',
        content: text || '',
        imageBase64: imageBase64 || null,
        direction: 'out',
        isRead: true,
        telegramMessageId // Lưu ID tin nhắn Telegram để thu hồi sau này
      });

      // Phát sự kiện realtime cho client admin
      if (io) io.emit('admin_replied', newMessage);

      res.json({ success: true, data: newMessage });
    } catch (e) {
      res.status(500).json({ success: false, message: e.message });
    }
  });

  // Thu hồi tin nhắn
  router.post('/unsend', async (req, res) => {
    try {
      const { messageId } = req.body;
      if (!messageId) return res.status(400).json({ success: false, message: 'Missing messageId' });

      // Tìm tin nhắn để lấy userId (để notify đúng room/user)
      const message = await SupportMessage.findById(messageId);
      if (!message) {
        return res.status(404).json({ success: false, message: 'Message not found' });
      }

      // Nếu có ID Telegram và hàm xóa, thực hiện xóa bên Bot
      if (message.telegramMessageId && typeof deleteCskhMessage === 'function') {
        try {
          // userId ở đây chính là Chat ID Telegram
          await deleteCskhMessage(message.userId, message.telegramMessageId);
        } catch (err) {
          console.error('Lỗi xóa tin nhắn Telegram:', err.message);
        }
      }

      // Xóa tin nhắn (hoặc update nội dung thành "Tin nhắn đã được thu hồi")
      await SupportMessage.findByIdAndDelete(messageId);

      // Thông báo cho client (cả admin và user nếu cần)
      if (io) {
          // Giả sử room socket được đặt theo userId
          io.to(message.userId.toString()).emit('message_unsent', messageId); 
          // Cũng emit cho admin panel để cập nhật UI realtime
          io.emit('message_unsent', messageId); 
      }

      res.json({ success: true });
    } catch (e) {
      console.error('Lỗi thu hồi tin nhắn:', e);
      res.status(500).json({ success: false, message: e.message });
    }
  });

  // API: DELETE /api/support/messages/:id
  router.delete('/messages/:id', async (req, res) => {
    try {
      const { id } = req.params;

      // Kiểm tra ID có hợp lệ không (nếu dùng MongoDB ObjectId)
      // if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      //   return res.status(400).json({ success: false, message: 'ID không hợp lệ' });
      // }

      // Tìm và xóa tin nhắn trong Database (Giả sử model tên là Message)
      const deletedMessage = await SupportMessage.findByIdAndDelete(id);

      if (!deletedMessage) {
        return res.status(404).json({ 
          success: false, 
          message: 'Tin nhắn không tồn tại hoặc đã bị xóa trước đó.' 
        });
      }

      // (Tùy chọn) Nếu bạn muốn xóa cả ảnh đính kèm trên server/cloud nếu có
      // if (deletedMessage.imageBase64 && ...) { ...xử lý xóa ảnh... }

      // Trả về kết quả thành công cho Frontend
      return res.json({ 
        success: true, 
        message: 'Đã xóa tin nhắn thành công.' 
      });

    } catch (error) {
      console.error('Lỗi API xóa tin nhắn:', error);
      return res.status(500).json({ 
        success: false, 
        message: 'Lỗi server nội bộ.' 
      });
    }
  });

  // Trạng thái kết nối CSKH bot
  router.get('/status', async (req, res) => {
    try {
      if (typeof checkCskhConnection === 'function') {
        const status = await checkCskhConnection();
        return res.json({ success: true, data: status });
      }
      return res.json({ success: true, data: { success: false, message: 'No check function provided' } });
    } catch (e) {
      res.status(500).json({ success: false, message: e.message });
    }
  });

  return router;
};
