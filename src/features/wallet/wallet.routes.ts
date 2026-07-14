// src/features/wallet/wallet.routes.ts
import { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { WalletController } from "./controllers/wallet.controller";
import { authenticate } from "../../middlewares/auth.middleware";
import {
  walletHistoryQuerySchema,
  walletDetailsSuccessResponseSchema,
  walletErrorResponseSchema,
} from "./schemas/wallet.schema";

export async function walletRoutes(fastify: FastifyInstance) {
  // Tất cả các tuyến đường liên quan tới ví yêu cầu bắt buộc phải truyền Bearer Token hợp lệ
  fastify.addHook("preHandler", authenticate);

  // Chuyển định tuyến sang Type Provider của Zod để tự động hóa tài liệu OpenAPI/Swagger UI
  const provider = fastify.withTypeProvider<ZodTypeProvider>();

  const SWAGGER_TAG = ["Wallet / Ví điện tử"];

  // API duy nhất thức tế: Lấy thông tin số dư và tra cứu lịch sử giao dịch ví cá nhân
  provider.get(
    "/me",
    {
      schema: {
        tags: SWAGGER_TAG,
        summary: "Xem số dư hiện tại và lịch sử biến động số dư ví",
        description:
          "Lấy số dư khả dụng thực tế của tài khoản hiện tại và liệt kê danh sách lịch sử nạp/trừ tiền theo cấu trúc phân trang.",
        query: walletHistoryQuerySchema,
        response: {
          200: walletDetailsSuccessResponseSchema, // Trả về thông tin số dư kèm phân trang lịch sử giao dịch
          400: walletErrorResponseSchema, // Lỗi nghiệp vụ dữ liệu đầu vào không hợp lệ
          401: walletErrorResponseSchema, // Lỗi xác thực Token không chính xác/hết hạn
        },
      },
    },
    WalletController.getWalletDetails,
  );
}
