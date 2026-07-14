// src/features/deposit/routes/deposit.routes.ts
import { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { prisma } from "../../shared/prisma";
import { authenticate } from "../../middlewares/auth.middleware"; //
import { createDepositHandler } from "./controllers/deposit.controller"; //
import { emailWebhookHandler } from "./controllers/deposit.webhook"; //
import {
  createDepositBodySchema,
  emailWebhookBodySchema,
  createDepositSuccessResponse,
  errorDeposit400Schema,
  errorDeposit401Schema,
  errorDeposit500Schema,
  getDepositStatusSuccessResponse,
} from "./schemas/deposit.schema"; // Import duy nhất từ file schema chuẩn hóa

export default async function depositRoutes(fastify: FastifyInstance) {
  // KÍCH HOẠT: Bộ cung cấp kiểu dữ liệu Zod cho Fastify
  const fastifyWithZod = fastify.withTypeProvider<ZodTypeProvider>(); //

  // =========================================================================
  // 1. API KHỞI TẠO YÊU CẦU NẠP TIỀN (LẤY MÃ QR ĐỊNH DANH)
  // =========================================================================
  fastifyWithZod.post(
    "/request", //
    {
      preHandler: [authenticate], 
      schema: {
        tags: ["Deposit & Wallet"], 
        summary: "Lấy thông tin QR định danh nạp tiền", 
        body: createDepositBodySchema,
        response: {
          200: createDepositSuccessResponse,
          400: errorDeposit400Schema,
          401: errorDeposit401Schema,
        },
      },
    },
    createDepositHandler, //
  );

  // =========================================================================
  // 2. API KIỂM TRA TRẠNG THÁI NẠP TIỀN CÁ NHÂN (REAL-TIME POLLING)
  // =========================================================================
  fastifyWithZod.get(
    "/status", //
    {
      preHandler: [authenticate],
      schema: {
        tags: ["Deposit & Wallet"],
        summary: "Kiểm tra trạng thái nạp tiền cá nhân (Real-time Polling)", 
        response: {
          200: getDepositStatusSuccessResponse,
          400: errorDeposit400Schema, 
          500: errorDeposit500Schema, 
        },
      },
    },
    async (request, reply) => {
      //
      try {
        const user = (request as any).user;
        const userIdNumber = Number(user.id);

        if (!userIdNumber || isNaN(userIdNumber)) {
          //
          return reply.status(400).send({
            //
            success: false, //
            message: "Mã định danh tài khoản không hợp lệ.",
          });
        }

        // Truy vấn song song xuống database
        const [latestDeposit, userObj] = await Promise.all([
          //
          prisma.deposit.findFirst({
            //
            where: { userId: userIdNumber, status: "SUCCESS" },
            orderBy: { createdAt: "desc" },
          }),
          prisma.user.findUnique({
            //
            where: { id: userIdNumber },
            select: { balance: true },
          }),
        ]);

        // ÉP KIỂU NUMBER: Triệt tiêu hoàn toàn object Decimal của Prisma để khớp với z.number()
        return reply.status(200).send({
          //
          success: true, //
          data: {
            status: latestDeposit ? latestDeposit.status : "NONE", //
            amount: latestDeposit ? Number(latestDeposit.amount) : 0, //
            newBalance: userObj ? Number(userObj.balance) : 0, //
          },
        });
      } catch (error: any) {
        fastify.log.error(error); //
        return reply.status(500).send({
          //
          success: false, //
          message: "Lỗi hệ thống khi xử lý kiểm tra số dư.", //
        });
      }
    },
  );

  // =========================================================================
  // 3. API NHẬN THÔNG BÁO WEBHOOK TỪ EMAIL BOT (FIX LỖI 404 NOT FOUND)
  // =========================================================================
  fastifyWithZod.post(
    "/webhook-email",
    {
      schema: {
        tags: ["Deposit & Wallet"],
        summary: "Nhận dữ liệu thông báo biến động số dư từ Email Bot",
        body: emailWebhookBodySchema,
      },
    },
    emailWebhookHandler,
  );
}
