import { FastifyInstance } from 'fastify';
import { authenticate } from '../../middlewares/auth.middleware';
import { createDepositHandler } from './controllers/deposit.controller';
import { emailWebhookHandler } from './controllers/deposit.webhook';

export default async function depositRoutes(fastify: FastifyInstance) {
  // Tuyến đường cho User tạo lệnh nạp tiền
  fastify.post('/request', { preHandler: [authenticate] }, createDepositHandler);

  // 2. Tuyến đường Webhook dành riêng cho Script đọc Email đẩy dữ liệu về
  fastify.post('/webhook-email', emailWebhookHandler);

  // ROUTE MÔ PHỎNG NẠP TIỀN ĐỂ TEST
  fastify.post('/test-simulation', async (request, reply) => {
    const { depositCode } = request.body as { depositCode: string };
    
    if (!depositCode) {
      return reply.status(400).send({ success: false, message: 'Thiếu mã depositCode để mô phỏng' });
    }

    // Nội dung Email lấy chính xác từ ảnh CIMB bạn cung cấp
    const emailContentFake = `
      Kính gửi Quý Khách
      Ngân Hàng TNHH MTV CIMB Việt Nam xin trân trọng thông báo...
      Mã giao dịch/ Transaction code:          2026070800003988504
      Ngày giờ giao dịch/Transaction date, time:  08-07-2026 12:20
      Số tiền ghi có/Credit Amount:              2.000
      Nội dung giao dịch/Transaction remark:      1367115892229 0369990253 NAP1244 ${depositCode}
    `;

    // Tìm và gọi hàm parseEmailBody từ file worker của bạn để nó tự chạy luồng bóc tách dữ liệu
    // Lưu ý: Đảm bảo hàm parseEmailBody trong file email-reader.worker.ts của bạn đã được export (thêm chữ export phía trước)
    const { parseEmailBody } = require('../../workers/email-reader.worker');
    parseEmailBody(emailContentFake);

    return reply.send({ success: true, message: 'Đã kích hoạt mô phỏng gửi mail về hệ thống thành công!' });
  });
}