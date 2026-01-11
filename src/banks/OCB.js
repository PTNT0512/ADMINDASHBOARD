async function getHistory(token) {
    if (!token) return [];
    try {
        const url = `${process.env.API_BANK_OCB}/${token}`;
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
        const resData = await response.json();
        
        const rawTransactions = resData.transactions || resData.data || (Array.isArray(resData) ? resData : []);
        return rawTransactions
            .filter(item => item.type === 'IN')
            .map(item => ({
                transactionID: item.transactionID,
                amount: parseInt(item.amount),
                description: item.description,
                date: item.transactionDate
            }));
    } catch (error) {
        console.error(`[OCB] Lỗi lấy lịch sử:`, error.message);
        return [];
    }
}
module.exports = { getHistory };