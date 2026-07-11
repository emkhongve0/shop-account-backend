// src/features/deposit/routes/deposit.routes.ts
import { FastifyInstance } from "fastify";
import { PrismaClient } from "@prisma/client";
import { authenticate } from "../../middlewares/auth.middleware";
import { createDepositHandler } from "./controllers/deposit.controller";
import { emailWebhookHandler } from "./controllers/deposit.webhook";

const prisma = new PrismaClient();

export default async function depositRoutes(fastify: FastifyInstance) {
  // 1. Lấy thông tin cấu hình cổng nạp định danh
  fastify.post(
    "/request",
    { preHandler: [authenticate] },
    createDepositHandler,
  );

  // 2. Tuyến đường Webhook nhận tín hiệu cào từ email bot
  fastify.post("/webhook-email", emailWebhookHandler);

  // 3. API Kiểm tra trạng thái thực tế phục vụ cơ chế Real-time Polling ở Frontend
  fastify.get(
    "/status/:id",
    { preHandler: [authenticate] },
    async (request, reply) => {
      try {
        const { id } = request.params as { id: string };
        const userIdNumber = Number(id); // ID nhận vào từ client chính là userId

        if (isNaN(userIdNumber)) {
          return reply.status(400).send({
            success: false,
            message: "Mã định danh tài khoản không hợp lệ.",
          });
        }

        // Tìm kiếm giao dịch thành công mới nhất của User này để trả về trạng thái hiển thị
        const latestDeposit = await prisma.deposit.findFirst({
          where: { userId: userIdNumber, status: "SUCCESS" },
          orderBy: { createdAt: "desc" },
        });

        const userObj = await prisma.user.findUnique({
          where: { id: userIdNumber },
          select: { balance: true },
        });

        return reply.status(200).send({
          success: true,
          data: {
            // Nếu chưa từng nạp thành công phát nào thì trả về mặc định để UI không bị trống, ngược lại luôn là SUCCESS
            status: latestDeposit ? latestDeposit.status : "SUCCESS",
            amount: latestDeposit ? latestDeposit.amount : 0,
            newBalance: userObj?.balance || 0,
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
