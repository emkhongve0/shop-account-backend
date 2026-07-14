// src/features/profile/routes/profile.routes.ts
import { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { authenticate } from "../../middlewares/auth.middleware";
import {
  changePasswordBodySchema,
  updateProfileBodySchema,
} from "./schemas/profile.schema";

// Import trực tiếp các hàm handler biệt lập từ controller công năng gốc
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

// --- ĐỊNH NGHĨA CÁC ĐỐI TƯỢNG PHẢN HỒI CHUẨN ĐỂ ĐƯA VÀO SWAGGER DOCS ---
const errorSchema400 = z.object({
  success: z.boolean().default(false),
  code: z.string().default("VALIDATION_ERROR"),
  message: z.string(),
});

const errorSchema401 = z.object({
  success: z.boolean().default(false),
  code: z.string().default("UNAUTHORIZED"),
  message: z.string(),
});

export default async function profileRoutes(fastify: FastifyInstance) {
  // Áp dụng middleware check token cho toàn bộ các route trong file này
  fastify.addHook("onRequest", authenticate);

  // Ép toàn bộ scope sang Zod Type Provider để hỗ trợ OpenAPI tự động gom schema
  const provider = fastify.withTypeProvider<ZodTypeProvider>();

  // 1. API Lấy thông tin cá nhân & Số dư
  provider.get(
    "/me",
    {
      schema: {
        tags: ["User Profile (Hồ sơ cá nhân)"],
        summary: "Lấy thông tin tài khoản hiện tại & số dư ví",
        response: {
          200: z.object({ success: z.boolean().default(true), data: z.any() }),
          401: errorSchema401,
        },
      },
    },
    getMyProfileHandler,
  );

  // 2. API Cập nhật thông tin cá nhân
  provider.put(
    "/me",
    {
      schema: {
        tags: ["User Profile (Hồ sơ cá nhân)"],
        summary: "Cập nhật tên hiển thị của tài khoản",
        body: updateProfileBodySchema,
        response: {
          200: z.object({
            success: z.boolean().default(true),
            message: z.string(),
            data: z.any(),
          }),
          400: errorSchema400,
          401: errorSchema401,
        },
      },
    },
    updateProfileHandler,
  );

  // 3. ĐỔI MẬT KHẨU
  provider.post(
    "/change-password",
    {
      schema: {
        tags: ["User Profile (Hồ sơ cá nhân)"],
        summary: "Thay đổi mật khẩu tài khoản",
        body: changePasswordBodySchema,
        response: {
          200: z.object({
            success: z.boolean().default(true),
            message: z.string(),
          }),
          400: errorSchema400,
          401: errorSchema401,
        },
      },
      config: {
        rateLimit: { max: 5, timeWindow: "1 minute" },
      },
    },
    changePasswordHandler,
  );

  // 4. API Lấy lịch sử bảo mật (Security Log)
  provider.get(
    "/security-log",
    {
      schema: {
        tags: ["User Profile (Hồ sơ cá nhân)"],
        summary: "Xem lịch sử đăng nhập bảo mật hệ thống",
        response: {
          200: z.object({
            success: z.boolean().default(true),
            data: z.array(z.any()),
          }),
          401: errorSchema401,
        },
      },
    },
    getLoginHistoryHandler,
  );

  // 5. API Lấy danh sách thiết bị/phiên đang đăng nhập
  provider.get(
    "/sessions",
    {
      schema: {
        tags: ["User Profile (Hồ sơ cá nhân)"],
        summary: "Xem danh sách các phiên thiết bị đang hoạt động",
        response: {
          200: z.object({
            success: z.boolean().default(true),
            data: z.array(z.any()),
          }),
          401: errorSchema401,
        },
      },
    },
    getActiveSessionsHandler,
  );

  // 6. API Lấy lịch sử nạp tiền
  provider.get(
    "/deposit-history",
    {
      schema: {
        tags: ["User Profile (Hồ sơ cá nhân)"],
        summary: "Xem lịch sử nạp tiền vào ví cá nhân",
        response: {
          200: z.object({
            success: z.boolean().default(true),
            data: z.array(z.any()),
          }),
          401: errorSchema401,
        },
      },
    },
    getDepositHistoryHandler,
  );

  // 7. API Lấy lịch sử mua hàng
  provider.get(
    "/purchase-history",
    {
      schema: {
        tags: ["User Profile (Hồ sơ cá nhân)"],
        summary: "Xem danh sách các đơn hàng đã mua",
        response: {
          200: z.object({
            success: z.boolean().default(true),
            data: z.array(z.any()),
          }),
          401: errorSchema401,
        },
      },
    },
    getPurchaseHistoryHandler,
  );

  // 8. API Lấy toàn bộ thông báo của User
  provider.get(
    "/notifications",
    {
      schema: {
        tags: ["User Profile (Hồ sơ cá nhân)"],
        summary: "Lấy hòm thư thông báo của người dùng",
        response: {
          200: z.object({ success: z.boolean().default(true), data: z.any() }),
          401: errorSchema401,
        },
      },
    },
    getNotificationsHandler,
  );

  // 9. API Đánh dấu đọc tất cả thông báo
  provider.post(
    "/notifications/read-all",
    {
      schema: {
        tags: ["User Profile (Hồ sơ cá nhân)"],
        summary: "Đánh dấu tất cả thông báo hiện có thành ĐÃ ĐỌC",
        response: {
          200: z.object({
            success: z.boolean().default(true),
            message: z.string(),
          }),
          401: errorSchema401,
        },
      },
    },
    markAllNotificationsAsReadHandler,
  );

  // 10. API Đánh dấu đọc một thông báo cụ thể
  provider.patch(
    "/notifications/:id/read",
    {
      schema: {
        tags: ["User Profile (Hồ sơ cá nhân)"],
        summary: "Đánh dấu đọc một mã thông báo đích danh",
        params: z.object({
          id: z.string().describe("ID của thông báo cần đọc"),
        }),
        response: {
          200: z.object({
            success: z.boolean().default(true),
            message: z.string(),
          }),
          400: errorSchema400,
          401: errorSchema401,
          404: z.object({
            success: z.boolean().default(false),
            code: z.string(),
            message: z.string(),
          }),
        },
      },
    },
    markNotificationAsReadHandler,
  );
}
