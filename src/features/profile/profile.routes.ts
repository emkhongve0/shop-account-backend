import { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { changePasswordBodySchema } from './schemas/profile.schema';
import { authenticate } from '../../middlewares/auth.middleware';
import { updateProfileBodySchema } from './schemas/profile.schema';
import {
  getMyProfileHandler,
  updateProfileHandler,
  changePasswordHandler,
  getLoginHistoryHandler,
  getActiveSessionsHandler,
  getDepositHistoryHandler,
  getPurchaseHistoryHandler,
  getNotificationsHandler,
  markAllNotificationsAsReadHandler,
  markNotificationAsReadHandler,
} from "./controllers/profile.controller";

export default async function profileRoutes(fastify: FastifyInstance) {
  // Áp dụng middleware check token cho toàn bộ các route trong file này
  fastify.addHook("onRequest", authenticate);

  // 1. API Lấy thông tin cá nhân & Số dư
  fastify.get("/me", getMyProfileHandler);

  // 2. API Cập nhật thông tin cá nhân
  fastify
    .withTypeProvider<ZodTypeProvider>()
    .put(
      "/me",
      { schema: { body: updateProfileBodySchema } },
      updateProfileHandler,
    );

  // 3. ĐỔI MẬT KHẨU (Bổ sung logic cấu hình hoàn chỉnh ở đây)
  fastify.withTypeProvider<ZodTypeProvider>().post(
    "/change-password",
    {
      schema: {
        body: changePasswordBodySchema,
      },
      config: {
        rateLimit: { max: 5, timeWindow: "1 minute" },
      },
    },
    changePasswordHandler,
  );

  // 4. API Lấy lịch sử bảo mật (Security Log)
  fastify.get("/security-log", getLoginHistoryHandler);

  // 5. API Lấy danh sách thiết bị/phiên đang đăng nhập
  fastify.get("/sessions", getActiveSessionsHandler);

  // 6. API Lấy lịch sử nạp tiền
  fastify.get("/deposit-history", getDepositHistoryHandler);

  // 7. API Lấy lịch sử mua hàng
  fastify.get("/purchase-history", getPurchaseHistoryHandler);

  // 8. API Lấy danh sách thông báo
  fastify.get("/notifications", getNotificationsHandler);

  // 9. API Đánh dấu đọc tất cả thông báo
  fastify.patch("/notifications/read-all", markAllNotificationsAsReadHandler);

  // 9.5 API Đánh dấu đọc một thông báo cụ thể (BỔ SUNG DÒNG NÀY VÀO)
  fastify.patch("/notifications/:id/read", markNotificationAsReadHandler);
}