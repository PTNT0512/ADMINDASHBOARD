const amqp = require('amqplib');

const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://localhost';
const QUEUE_NAME = 'zalopay_notifications';

let connection = null;
let channel = null;

/**
 * Khởi động Consumer lắng nghe RabbitMQ
 * @param {Object} io - Đối tượng Socket.IO server để emit sự kiện
 * @param {Object} mainBotService - Service bot telegram để gửi thông báo
 */
async function startRabbitMQConsumer(io, mainBotService) {
    console.log('🚀 [RabbitMQ Consumer] Đang khởi tạo...');
    try {
        console.log(`🐰 [RabbitMQ] Đang kết nối tới ${RABBITMQ_URL}...`);
        
        connection = await amqp.connect(RABBITMQ_URL, { 
            clientProperties: { connection_name: 'GameAdminServer-Consumer' },
            timeout: 10000 // Timeout 10s để tránh treo
        });

        // Xử lý khi mất kết nối
        connection.on('error', (err) => {
            console.error('❌ [RabbitMQ] Lỗi kết nối:', err.message);
            reconnect(io);
        });

        connection.on('close', () => {
            console.warn('⚠️ [RabbitMQ] Mất kết nối. Đang thử kết nối lại...');
            reconnect(io);
        });

        channel = await connection.createChannel();
        
        // Đảm bảo hàng đợi tồn tại
        await channel.assertQueue(QUEUE_NAME, { durable: false });
        
        console.log(`✅ [RabbitMQ] Đã sẵn sàng nhận tin nhắn từ hàng đợi: ${QUEUE_NAME}`);
        
        // Bắt đầu lắng nghe tin nhắn
        channel.consume(QUEUE_NAME, (msg) => {
            if (msg !== null) {
                const content = msg.content.toString();
                try {
                    const data = JSON.parse(content);
                    console.log('📥 [RabbitMQ] Nhận thông báo nạp tiền:', data);
                    
                    // Gửi sự kiện qua Socket.IO tới Dashboard (để hiện thông báo cho Admin/User)
                    if (io) {
                        io.emit('zalopay_deposit_success', data);
                        console.log('📡 [RabbitMQ] -> Socket.IO: Đã gửi sự kiện zalopay_deposit_success');
                    }

                    // Gửi thông báo Telegram trực tiếp (Backup nếu Dashboard không mở)
                    if (mainBotService && mainBotService.notifyZaloPaySuccess) {
                        await mainBotService.notifyZaloPaySuccess(data);
                        console.log('📱 [RabbitMQ] -> Telegram: Đã gửi thông báo cho user');
                    } else {
                        console.warn('⚠️ [RabbitMQ] Socket.IO chưa sẵn sàng, không thể gửi thông báo.');
                    }
                } catch (parseError) {
                    console.error('❌ [RabbitMQ] Lỗi parse JSON:', content);
                }
                
                // Xác nhận đã xử lý xong tin nhắn (để RabbitMQ xóa khỏi hàng đợi)
                channel.ack(msg);
            }
        });

    } catch (err) {
        console.error('❌ [RabbitMQ] Không thể kết nối:', err.message);
        reconnect(io);
    }
}

function reconnect(io) {
    setTimeout(() => {
        console.log('🔄 [RabbitMQ] Đang thử kết nối lại...');
        startRabbitMQConsumer(io);
    }, 5000);
}

module.exports = { startRabbitMQConsumer };