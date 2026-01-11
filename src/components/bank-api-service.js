/**
 * Service xử lý gọi API ngân hàng (ThueApiBank)
 * API URL: https://thueapibank.vn/historyapivcbv2/{token}
 */

async function getBankHistory(token) {
    if (!token) return [];
    
    try {
        // Sử dụng API VCB V2 theo yêu cầu
        const url = `${process.env.API_BANK_VCB}/${token}`;
        
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP Error: ${response.status}`);
        }
        
        const resData = await response.json();
        
        // Chuẩn hóa dữ liệu: API thường trả về { transactions: [...] } hoặc { data: [...] }
        const rawTransactions = resData.transactions || resData.data || (Array.isArray(resData) ? resData : []);
        
        // Lọc chỉ lấy giao dịch nhận tiền (IN) và map dữ liệu cần thiết
        const transactions = rawTransactions
            .filter(item => item.type === 'IN')
            .map(item => ({
                transactionID: item.transactionID, // Mã giao dịch (VD: FT26009070590865)
                amount: parseInt(item.amount),     // Số tiền
                description: item.description,     // Nội dung (VD: ...donate 12345678...)
                date: item.transactionDate
            }));
            
        return transactions;
    } catch (error) {
        console.error(`[Bank API] Lỗi lấy lịch sử (Token: ...${token.slice(-5)}):`, error.message);
        return [];
    }
}

module.exports = { getBankHistory };