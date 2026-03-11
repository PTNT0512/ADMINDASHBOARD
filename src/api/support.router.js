const express = require('express');
const SupportMessage = require('../models/SupportMessage');

module.exports = function createSupportRouter(io, sendCskhReply, checkCskhConnection, deleteCskhMessage) {
  const router = express.Router();
  const supportSessions = new Map();

  const getSession = (userId) => supportSessions.get(String(userId)) || null;
  const setSession = (userId, data) => supportSessions.set(String(userId), data);
  const clearSession = (userId) => supportSessions.delete(String(userId));

  router.get('/users', async (req, res) => {
    try {
      const users = await SupportMessage.aggregate([
        { $sort: { createdAt: -1 } },
        {
          $group: {
            _id: '$userId',
            username: { $first: '$username' },
            lastMessage: { $first: '$content' },
            lastMessageImage: { $first: '$imageBase64' },
            createdAt: { $first: '$createdAt' },
            unreadCount: {
              $sum: {
                $cond: [
                  { $and: [{ $eq: ['$direction', 'in'] }, { $eq: ['$isRead', false] }] },
                  1,
                  0
                ]
              }
            },
            assignedTo: { $first: '$assignedTo' }
          }
        },
        { $sort: { createdAt: -1 } }
      ]);

      const data = users.map((u) => {
        const session = getSession(u._id);
        return {
          userId: u._id,
          username: u.username,
          lastMessage: u.lastMessageImage ? '[Hinh anh]' : u.lastMessage,
          unreadCount: u.unreadCount,
          createdAt: u.createdAt,
          assignedTo: session?.assignedTo || u.assignedTo || '',
          sessionStatus: session?.status || 'open'
        };
      });

      res.json({ success: true, data });
    } catch (e) {
      res.status(500).json({ success: false, message: e.message });
    }
  });

  router.get('/messages/:userId', async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      const messages = await SupportMessage.find({ userId }).sort({ createdAt: 1 }).limit(500);
      res.json({ success: true, data: messages });
    } catch (e) {
      res.status(500).json({ success: false, message: e.message });
    }
  });

  router.post('/mark-read', async (req, res) => {
    try {
      const { userId } = req.body;
      await SupportMessage.updateMany(
        { userId: parseInt(userId), direction: 'in', isRead: false },
        { $set: { isRead: true } }
      );
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ success: false, message: e.message });
    }
  });

  router.post('/reply', async (req, res) => {
    try {
      const { userId, text, imageBase64 } = req.body;
      if (!userId) return res.status(400).json({ success: false, message: 'Missing userId' });

      if (typeof sendCskhReply === 'function') {
        try {
          await sendCskhReply(parseInt(userId), text || '', imageBase64 || null);
        } catch (err) {
          console.error('[Support Router] sendCskhReply error:', err.message || err);
        }
      }

      const newMessage = await SupportMessage.create({
        userId: parseInt(userId),
        username: 'Admin',
        content: text || '',
        imageBase64: imageBase64 || null,
        direction: 'out',
        isRead: true
      });

      if (io) io.emit('admin_replied', newMessage);
      res.json({ success: true, data: newMessage });
    } catch (e) {
      res.status(500).json({ success: false, message: e.message });
    }
  });

  router.post('/assign', async (req, res) => {
    try {
      const { userId, agentName } = req.body || {};
      if (!userId || !agentName) {
        return res.status(400).json({ success: false, message: 'Missing userId or agentName' });
      }

      const normalizedUserId = parseInt(userId);
      setSession(normalizedUserId, {
        status: 'active',
        assignedTo: agentName,
        assignedAt: Date.now()
      });

      await SupportMessage.updateMany(
        { userId: normalizedUserId, assignedTo: { $in: ['', null] } },
        { $set: { assignedTo: agentName } }
      );

      if (typeof sendCskhReply === 'function') {
        await sendCskhReply(
          normalizedUserId,
          `Nhân viên ${agentName} đã tiếp nhận thông tin và hỗ trợ quý khách ngay.`,
          null
        );
      }

      if (io) {
        io.emit('support_assigned', {
          userId: normalizedUserId,
          assignedTo: agentName,
          sessionStatus: 'active'
        });
      }

      return res.json({ success: true });
    } catch (e) {
      return res.status(500).json({ success: false, message: e.message });
    }
  });

  router.post('/reject', async (req, res) => {
    try {
      const { userId, agentName } = req.body || {};
      if (!userId) return res.status(400).json({ success: false, message: 'Missing userId' });

      const normalizedUserId = parseInt(userId);
      clearSession(normalizedUserId);

      await SupportMessage.updateMany(
        { userId: normalizedUserId, assignedTo: agentName || { $exists: true } },
        { $set: { assignedTo: '', assignedSocketId: '' } }
      );

      if (io) {
        io.emit('support_rejected', {
          userId: normalizedUserId,
          sessionStatus: 'open'
        });
      }

      return res.json({ success: true });
    } catch (e) {
      return res.status(500).json({ success: false, message: e.message });
    }
  });

  router.post('/close-session', async (req, res) => {
    try {
      const { userId, agentName } = req.body || {};
      if (!userId) return res.status(400).json({ success: false, message: 'Missing userId' });

      const normalizedUserId = parseInt(userId);
      clearSession(normalizedUserId);

      if (typeof sendCskhReply === 'function') {
        await sendCskhReply(
          normalizedUserId,
          `Nhân viên ${agentName || 'CSKH'} đã kết thúc phiên chat. Nếu quý khách gặp vấn đề khác, vui lòng bấm /start để tạo yêu cầu mới.`,
          null
        );
      }

      if (io) {
        io.emit('support_closed', {
          userId: normalizedUserId,
          sessionStatus: 'closed'
        });
      }

      return res.json({ success: true });
    } catch (e) {
      return res.status(500).json({ success: false, message: e.message });
    }
  });

  router.delete('/clear-history/:userId', async (req, res) => {
    try {
      const normalizedUserId = parseInt(req.params.userId);
      if (!normalizedUserId) {
        return res.status(400).json({ success: false, message: 'Invalid userId' });
      }
      await SupportMessage.deleteMany({ userId: normalizedUserId });
      return res.json({ success: true, message: 'Da xoa lich su chat' });
    } catch (e) {
      return res.status(500).json({ success: false, message: e.message });
    }
  });

  router.post('/unsend', async (req, res) => {
    try {
      const { messageId } = req.body;
      if (!messageId) return res.status(400).json({ success: false, message: 'Missing messageId' });

      const message = await SupportMessage.findById(messageId);
      if (!message) return res.status(404).json({ success: false, message: 'Message not found' });

      if (message.telegramMessageId && typeof deleteCskhMessage === 'function') {
        try {
          await deleteCskhMessage(message.userId, message.telegramMessageId);
        } catch (err) {
          console.error('[Support Router] delete telegram message error:', err.message || err);
        }
      }

      await SupportMessage.findByIdAndDelete(messageId);
      if (io) io.emit('message_unsent', messageId);
      res.json({ success: true });
    } catch (e) {
      console.error('[Support Router] unsend error:', e);
      res.status(500).json({ success: false, message: e.message });
    }
  });

  router.delete('/messages/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const deleted = await SupportMessage.findByIdAndDelete(id);
      if (!deleted) return res.status(404).json({ success: false, message: 'Tin nhan khong ton tai' });
      res.json({ success: true, message: 'Da xoa tin nhan thanh cong' });
    } catch (e) {
      res.status(500).json({ success: false, message: 'Loi server noi bo' });
    }
  });

  router.get('/status', async (req, res) => {
    try {
      if (typeof checkCskhConnection === 'function') {
        const status = await checkCskhConnection();
        return res.json({ success: true, data: status });
      }
      return res.json({ success: true, data: { success: false, message: 'No check function provided' } });
    } catch (e) {
      return res.status(500).json({ success: false, message: e.message });
    }
  });

  return router;
};
