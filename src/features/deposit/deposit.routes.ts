import { FastifyInstance } from "fastify";
import { PrismaClient } from "@prisma/client";
import { authenticate } from "../../middlewares/auth.middleware";
import { createDepositHandler } from "./controllers/deposit.controller";
import { emailWebhookHandler } from "./controllers/deposit.webhook";

const prisma = new PrismaClient();

export default async function depositRoutes(fastify: FastifyInstance) {
  // 1. Tuyến đường cho User tạo lệnh nạp tiền (Yêu cầu phải Đăng nhập)
  fastify.post(
    "/request",
    { preHandler: [authenticate] },
    createDepositHandler,
  );

  // 2. Tuyến đường Webhook dành riêng cho Script đọc Email đẩy dữ liệu đối soát về
  fastify.post("/webhook-email", emailWebhookHandler);

  // 3. LOGIC CẬP NHẬT: API Kiểm tra trạng thái thực tế phục vụ cơ chế tự động (Real-time Polling) ở Frontend
  fastify.get(
    "/status/:id",
    { preHandler: [authenticate] },
    async (request, reply) => {
      try {
        const { id } = request.params as { id: string };

        // SỬA LỖI 2: Ép kiểu biến 'id' từ string sang number để khớp với kiểu Int của DB
        const depositIdNumber = Number(id);
        if (isNaN(depositIdNumber)) {
          return reply.status(400).send({
            success: false,
            message: "Mã đơn nạp tiền không hợp lệ (Phải là số).",
          });
        }

        // Tìm kiếm thông tin đơn nạp tiền trong Database bằng ID (Số nguyên)
        const deposit = await prisma.deposit.findUnique({
          where: { id: depositIdNumber },
        });

        // Nếu không tồn tại đơn nạp này trong hệ thống
        if (!deposit) {
          return reply.status(404).send({
            success: false,
            message: "Không tìm thấy đơn nạp tiền này.",
          });
        }

        // SỬA LỖI 1: Tách truy vấn lấy số dư User độc lập để loại bỏ hoàn toàn lỗi Type 'user does not exist'
        const userObj = await prisma.user.findUnique({
          where: { id: deposit.userId },
          select: { balance: true },
        });

        // Trả về dữ liệu trạng thái thật từ Database cho Frontend xử lý
        return reply.status(200).send({
          success: true,
          data: {
            status: deposit.status, // "PENDING", "SUCCESS", "EXPIRED", hoặc "FAILED"
            amount: deposit.amount, // Số tiền của đơn nạp
            newBalance: userObj?.balance || 0, // Số dư ví thật lấy từ bảng User sau khi cộng tiền thành công
          },
        });
      } catch (error: any) {
        fastify.log.error(error);
        return reply.status(500).send({
          success: false,
          message: "Lỗi hệ thống khi kiểm tra trạng thái giao dịch.",
        });
      }
    },
  );
}
