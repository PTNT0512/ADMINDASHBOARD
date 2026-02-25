const axios = require('axios');
const crypto = require('crypto');
const Setting = require('../models/Setting');
const Deposit = require('../models/Deposit');
const Account = require('../models/Account');

/**
 * Hàm polling kiểm tra trạng thái thẻ định kỳ
 */
async function pollCardStatus(requestId, telco, code, serial, amount, partnerId, partnerKey, depositId, userId, feePercent) {
    const maxAttempts = 60; // Thử tối đa 60 lần (5 phút)
    let attempts = 0;

    const intervalId = setInterval(async () => {
        attempts++;
        if (attempts > maxAttempts) {
            clearInterval(intervalId);
            console.log(`[CardService] Stop polling ${requestId} due to timeout.`);
            return;
        }

        try {
            // Tạo chữ ký cho lệnh check
            const rawSign = `${partnerKey}${code}${serial}`;
            const sign = crypto.createHash('md5').update(rawSign).digest('hex');

            const payload = {
                telco,
                code,
                serial,
                amount: String(amount),
                request_id: requestId,
                partner_id: partnerId,
                sign,
                command: 'check'
            };

            const apiUrl = 'https://gachthe1s.com/chargingws/v2';
            const response = await axios.post(apiUrl, payload, {
                headers: { 'Content-Type': 'application/json' },
                timeout: 10000
            });

            const responseData = response.data;
            const status = parseInt(responseData.status);
            
            console.log(`[CardService] Polling ${requestId} - Attempt ${attempts} - Status: ${status}`);

            if (status !== 99) {
                clearInterval(intervalId);
                
                const deposit = await Deposit.findById(depositId);
                if (!deposit || deposit.status !== 0) return; // Đã xử lý rồi thì bỏ qua

                let message = responseData.message || '';

                if (status === 1) {
                    deposit.status = 1;
                    deposit.description = 'Nạp thẻ thành công (Check).';
                    const receivedAmount = Math.floor(parseInt(amount) * (100 - feePercent) / 100);
                    await Account.findOneAndUpdate(
                        { userId: userId }, 
                        { $inc: { balance: receivedAmount, totalDeposit: parseInt(amount) } }
                    );
                } else if (status === 2) {
                    deposit.status = 1;
                    const realValue = parseInt(responseData.value || 0);
                    deposit.realAmount = realValue;
                    deposit.description = `Sai mệnh giá. Thực nhận: ${realValue} (Check)`;
                    const receivedRealAmount = Math.floor(realValue * (100 - feePercent) / 100);
                    if (realValue > 0) {
                        await Account.findOneAndUpdate(
                            { userId: userId }, 
                            { $inc: { balance: receivedRealAmount, totalDeposit: realValue } }
                        );
                    }
                } else {
                    deposit.status = 2;
                    deposit.description = message || 'Thẻ lỗi (Check)';
                }

                deposit.response = responseData;
                await deposit.save();
            }
        } catch (error) {
            console.error(`[CardService] Polling error for ${requestId}:`, error.message);
        }
    }, 5000); // Check mỗi 5 giây
}

/**
 * Service xử lý nạp tiền bằng thẻ cào
 * @param {string} userId - ID của người dùng nạp
 * @param {string} telco - Nhà mạng (VIETTEL, VINAPHONE, MOBIFONE)
 * @param {string} code - Mã thẻ
 * @param {string} serial - Số serial thẻ
 * @param {string|number} amount - Mệnh giá thẻ
 */
async function processCardDeposit(userId, telco, code, serial, amount) {
    try {
        // 1. Lấy cấu hình Partner từ Database
        const settings = await Setting.findOne({});
        if (!settings) {
            return { success: false, message: 'Lỗi hệ thống: Không tìm thấy cấu hình.' };
        }

        // Giả định các trường này đã được thêm vào Model Setting
        // cardChargingUrl tương ứng với {{domain_post}}
        const { partnerId, partnerKey, cardFee } = settings;
        const feePercent = cardFee || 0;

        if (!partnerId || !partnerKey) {
            return { success: false, message: 'Hệ thống nạp thẻ chưa được cấu hình đầy đủ.' };
        }

        // 2. Tạo request_id (Số hoá đơn thứ tự tăng dần)
        // Sử dụng timestamp kết hợp random để đảm bảo tính duy nhất và tăng dần
        const requestId = `${Date.now()}${Math.floor(Math.random() * 1000)}`;

        // 3. Tạo chữ ký (Sign) MD5
        // Công thức: md5(partner_key + code + serial)
        const rawSign = `${partnerKey}${code}${serial}`;
        const sign = crypto.createHash('md5').update(rawSign).digest('hex');

        // 4. Lưu đơn nạp vào DB (Trạng thái Pending/Đang xử lý)
        const newDeposit = await Deposit.create({
            userId: userId,
            amount: parseInt(amount),
            method: 'Card',
            status: 0, // 0: Đang xử lý
            requestId: requestId,
            extraData: {
                telco,
                code,
                serial,
                request_id: requestId,
                partner_id: partnerId
            }
        });

        // 5. Chuẩn bị dữ liệu gửi API (Theo cấu trúc yêu cầu)
        const payload = {
            telco: telco,
            code: code,
            serial: serial,
            amount: String(amount),
            request_id: requestId,
            partner_id: partnerId,
            sign: sign,
            command: 'charging'
        };

        // 6. Gọi API gạch thẻ
        // URL: http://{{domain_post}}/chargingws/v2
        const apiUrl = 'https://gachthe1s.com/chargingws/v2';
        
        console.log(`[CardService] Sending request to ${apiUrl}`, payload);

        const response = await axios.post(apiUrl, payload, {
            headers: {
                'Content-Type': 'application/json'
            },
            timeout: 30000 // Timeout 30s
        });

        const responseData = response.data;
        console.log(`[CardService] Response:`, responseData);

        // Xử lý trạng thái trả về từ API
        const status = parseInt(responseData.status);
        let message = responseData.message || '';
        let isSuccess = false;

        // Cập nhật transId từ phản hồi nếu có
        if (responseData.trans_id) {
            newDeposit.transId = responseData.trans_id;
        }

        switch (status) {
            case 1: // Thẻ thành công đúng mệnh giá
                newDeposit.status = 1;
                message = 'Nạp thẻ thành công đúng mệnh giá.';
                isSuccess = true;
                
                const receivedAmount = Math.floor(parseInt(amount) * (100 - feePercent) / 100);

                // Cộng tiền ngay cho user
                await Account.findOneAndUpdate(
                    { userId: userId }, 
                    { $inc: { balance: receivedAmount, totalDeposit: parseInt(amount) } }
                );
                break;

            case 2: // Thẻ thành công sai mệnh giá
                newDeposit.status = 1;
                const realValue = parseInt(responseData.value || 0);
                newDeposit.realAmount = realValue;
                message = `Nạp thẻ thành công sai mệnh giá. Thực nhận: ${realValue}`;
                isSuccess = true;

                const receivedRealAmount = Math.floor(realValue * (100 - feePercent) / 100);

                // Cộng tiền thực nhận (nếu có)
                if (realValue > 0) {
                    await Account.findOneAndUpdate(
                        { userId: userId }, 
                        { $inc: { balance: receivedRealAmount, totalDeposit: realValue } }
                    );
                }
                break;

            case 3: // Thẻ lỗi
                newDeposit.status = 2; // Thất bại
                message = 'Thẻ lỗi hoặc không hợp lệ.';
                isSuccess = false;
                break;

            case 4: // Hệ thống bảo trì
                newDeposit.status = 2;
                message = 'Hệ thống nạp thẻ đang bảo trì.';
                isSuccess = false;
                break;

            case 99: // Thẻ chờ xử lý
                newDeposit.status = 0; // Pending
                message = 'Thẻ đang chờ xử lý. Hệ thống sẽ tự động kiểm tra.';
                isSuccess = true; // Trả về true để bot báo user đợi
                pollCardStatus(requestId, telco, code, serial, amount, partnerId, partnerKey, newDeposit._id, userId, feePercent);
                break;

            case 100: // Gửi thẻ thất bại
                newDeposit.status = 2;
                message = `Gửi thẻ thất bại: ${message}`;
                isSuccess = false;
                break;

            default:
                newDeposit.status = 2;
                message = `Lỗi không xác định (Status: ${status})`;
                isSuccess = false;
        }

        // Cập nhật thông tin vào đơn nạp
        newDeposit.response = responseData; // Lưu log phản hồi (nếu schema hỗ trợ)
        newDeposit.description = message;
        await newDeposit.save();

        return { 
            success: isSuccess, 
            message: message, 
            data: responseData,
            depositId: newDeposit._id
        };

    } catch (error) {
        console.error('[CardService] Error:', error.message);
        return { success: false, message: 'Lỗi kết nối đến cổng nạp thẻ: ' + error.message };
    }
}

module.exports = { processCardDeposit };