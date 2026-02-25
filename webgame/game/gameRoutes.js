const express = require('express');
const router = express.Router();

// Hàm này nhận aviatorEngine instance để sử dụng trong các route
module.exports = (aviatorEngine) => {

    // Route đặt cược
    router.post('/bet', async (req, res) => {
        const { id, amount } = req.body;
        if (!id || !amount) return res.status(400).json({ success: false, message: "Thiếu thông tin." });
        
        const result = await aviatorEngine.handleBet(id, amount);
        res.json(result);
    });

    // Route chốt lời
    router.post('/cashout', async (req, res) => {
        const { userId } = req.body;
        if (!userId) return res.status(400).json({ success: false, message: "Thiếu thông tin." });

        const result = await aviatorEngine.handleCashOut(userId);
        res.json(result);
    });

    // Route hủy cược (MỚI)
    router.post('/cancel-bet', async (req, res) => {
        try {
            // Lấy userId từ body (hoặc req.user nếu có middleware auth)
            const { userId } = req.body;

            if (!userId) {
                return res.status(400).json({ success: false, message: "Thiếu thông tin User ID." });
            }

            // Gọi hàm xử lý hủy cược từ engine
            const result = await aviatorEngine.handleCancelBet(userId);
            res.json(result);
        } catch (error) {
            console.error("[API] Cancel Bet Error:", error);
            res.status(500).json({ success: false, message: "Lỗi server." });
        }
    });

    return router;
};