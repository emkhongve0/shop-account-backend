// src/features/voucher/voucher.routes.ts
import { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { authenticate } from "../../middlewares/auth.middleware";
import { checkVoucherHandler } from "./controllers/voucher.controller";
import {
  checkVoucherBodySchema,
  checkVoucherSuccessResponseSchema,
  voucherErrorResponseSchema,
} from "./schemas/voucher.schema";

export default async function voucherRoutes(fastify: FastifyInstance) {
  // Bắt buộc khách hàng đăng nhập mới được check voucher mua hàng
  fastify.addHook("onRequest", authenticate);

  // Ép cấu trúc định tuyến sang sử dụng Zod Type Provider để Swagger tự bóc tách Schema
  const provider = fastify.withTypeProvider<ZodTypeProvider>();

  // API áp dụng voucher
  provider.post(
    "/check",
    {
      schema: {
        tags: ["Voucher / Khuyến mãi"],
        summary: "Kiểm tra và áp dụng mã giảm giá (Voucher)",
        description:
          "Xác thực tính hợp lệ của mã giảm giá dựa trên tổng tiền đơn hàng, thời hạn sử dụng, số lượt dùng còn lại của hệ thống và ghi nhận vào lịch sử Audit Log.",
        body: checkVoucherBodySchema,
        response: {
          200: checkVoucherSuccessResponseSchema, // Trả về thông tin voucher & số tiền được giảm
          400: voucherErrorResponseSchema, // Lỗi logic: Hết hạn (EXPIRED), Hết lượt dùng (MAX_USES)
          404: voucherErrorResponseSchema, // Lỗi logic: Không tìm thấy mã (NOT_FOUND)
        },
      },
      config: {
        rateLimit: { max: 5, timeWindow: "1 minute" }, // Giữ nguyên cấu trúc chống spam cũ của bạn
      },
    },
    checkVoucherHandler,
  );
}
