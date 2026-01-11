async function getHistory(token) {
    if (!token) return [];
    
    try {
        // Sử dụng API VCB V2
        const url = `${process.env.API_BANK_VCB}/${token}`;
        
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP Error: ${response.status}`);
        }
        
        const resData = await response.json();
        
        // Chuẩn hóa dữ liệu đầu ra để Cron Service xử lý chung
        const rawTransactions = resData.transactions || resData.data || (Array.isArray(resData) ? resData : []);
        
        // Lọc chỉ lấy giao dịch nhận tiền (IN) và map dữ liệu chuẩn
        const transactions = rawTransactions
            .filter(item => item.type === 'IN')
            .map(item => ({
                transactionID: item.transactionID, // Mã giao dịch
                amount: parseInt(item.amount),     // Số tiền
                description: item.description,     // Nội dung
                date: item.transactionDate         // Ngày giao dịch
            }));
            
        return transactions;
    } catch (error) {
        console.error(`[Vietcombank] Lỗi lấy lịch sử (Token: ...${token.slice(-5)}):`, error.message);
        return [];
    }
}

module.exports = { getHistory };