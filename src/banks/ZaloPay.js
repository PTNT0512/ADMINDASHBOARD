const axios = require('axios');

function parseDate(dateStr) {
    if (!dateStr) return new Date();
    try {
        // Hỗ trợ định dạng DD/MM/YYYY HH:mm:ss
        if (dateStr.includes('/')) {
            const [datePart, timePart] = dateStr.split(' ');
            const [day, month, year] = datePart.split('/');
            const [hour, minute, second] = timePart.split(':');
            return new Date(year, month - 1, day, hour, minute, second);
        }
        // Fallback cho các định dạng khác (ISO)
        return new Date(dateStr);
    } catch (e) {
        return new Date();
    }
}

async function getHistory(token) {
    try {
        // Gọi API lấy lịch sử giao dịch ZaloPay
        const response = await axios.get(`https://thueapibank.vn/historyapizalopayv2/${token}`, { 
            timeout: 15000,
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } // Thêm User-Agent để tránh bị chặn
        });
        const data = response.data;

        // Cập nhật theo cấu trúc mới: { status: 'success', transactions: [...] }
        // Hỗ trợ cả data.transactions và data.data (đề phòng API thay đổi)
        const transactions = data.transactions || data.data || [];
        
        if (Array.isArray(transactions)) {
            return transactions
                .filter(item => item.type === 'IN') // Chỉ lấy giao dịch nhận tiền (IN)
                .map(item => ({
                    transactionID: item.transactionID || item.transId, // Fallback ID
                    amount: parseInt(item.amount),
                    description: item.description || item.content || '',
                    date: parseDate(item.transactionDate || item.date)
                }));
        }
        return [];
    } catch (error) {
        console.error(`[ZaloPay API] Error (Token: ...${token ? token.slice(-5) : 'null'}):`, error.message);
        return [];
    }
}

async function checkToken(token) {
    if (!token) return { success: false, message: 'Token không được cung cấp' };
    try {
        // Sử dụng cùng API lấy lịch sử để kiểm tra, nếu thành công nghĩa là token còn sống
        const response = await axios.get(`https://thueapibank.vn/historyapizalopayv2/${token}`);
        const data = response.data;

        if (data && (data.success === true || data.status === 'success')) {
            return { success: true };
        }
        return { success: false, message: data.message || data.msg || 'Token không hợp lệ' };
    } catch (error) {
        // API có thể trả về lỗi 4xx, 5xx nếu token sai
        return { success: false, message: 'Token sai hoặc hết hạn' };
    }
}

module.exports = { getHistory, checkToken };