// src/features/profile/admin-user.routes.ts
import { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { AdminUserController } from "./controllers/admin-user.controller";
import { authenticate } from "../../middlewares/auth.middleware";
import { adminMiddleware } from "../../middlewares/admin.middleware";

// Import các Zod Schemas vừa tạo ở Bước 1
import {
  adminUserQuerySchema,
  adminUserIdParamSchema,
  adminUpdateUserBodySchema,
  adminResetPasswordBodySchema,
  adminAdjustBalanceBodySchema,
  adminAdjustBalanceHeaderSchema,
  adminErrorSchema400,
  adminErrorSchema401,
  adminErrorSchema403,
  adminErrorSchema404,
} from "./schemas/admin-user.schema";

export async function adminUserRoutes(fastify: FastifyInstance) {
  // Toàn bộ các API này được bảo vệ nghiêm ngặt chỉ Admin mới kích hoạt được
  const adminGuards = { preHandler: [authenticate, adminMiddleware] };

  // Chuyển đổi scope sang sử dụng Zod Type Provider phục vụ render Swagger
  const provider = fastify.withTypeProvider<ZodTypeProvider>();

  const SWAGGER_TAG = ["Admin - User Management (Quản lý thành viên)"];

  // 1. API Lấy danh sách User + Phân trang + Bộ lọc nâng cao
  provider.get(
    "/admin/users",
    {
      ...adminGuards,
      schema: {
        tags: SWAGGER_TAG,
        summary: "Xem danh sách toàn bộ người dùng hệ thống",
        query: adminUserQuerySchema,
        response: {
          200: z.object({
            success: z.boolean().default(true),
            data: z.object({
              total: z.number(),
              users: z.array(z.any()),
              page: z.number(),
              limit: z.number(),
              totalPages: z.number(),
            }),
          }),
          400: adminErrorSchema400,
          401: adminErrorSchema401,
          403: adminErrorSchema403,
        },
      },
    },
    AdminUserController.list,
  );

  // 2. API Xem chi tiết 1 người dùng cụ thể kèm các lịch sử giao dịch
  provider.get(
    "/admin/users/:id",
    {
      ...adminGuards,
      schema: {
        tags: SWAGGER_TAG,
        summary: "Xem thông tin chi tiết cấu hình và số dư của 1 User",
        params: adminUserIdParamSchema,
        response: {
          200: z.object({
            success: z.boolean().default(true),
            data: z.any(),
          }),
          401: adminErrorSchema401,
          403: adminErrorSchema403,
          404: adminErrorSchema404,
        },
      },
    },
    AdminUserController.detail,
  );

  // 3. API Thay đổi hồ sơ thông tin của User (Tên hiển thị, Trạng thái, Quyền hạn)
  provider.put(
    "/admin/users/:id",
    {
      ...adminGuards,
      schema: {
        tags: SWAGGER_TAG,
        summary: "Cập nhật thông tin cơ bản / Trạng thái / Quyền hạn User",
        params: adminUserIdParamSchema,
        body: adminUpdateUserBodySchema,
        response: {
          200: z.object({
            success: z.boolean().default(true),
            message: z.string(),
            data: z.any(),
          }),
          400: adminErrorSchema400,
          401: adminErrorSchema401,
          403: adminErrorSchema403,
        },
      },
    },
    AdminUserController.update,
  );

  // 4. API Ép đổi mật khẩu của một User bất kỳ
  provider.post(
    "/admin/users/:id/reset-password",
    {
      ...adminGuards,
      schema: {
        tags: SWAGGER_TAG,
        summary: "Đặt lại (Reset) mật khẩu mới cho người dùng",
        params: adminUserIdParamSchema,
        body: adminResetPasswordBodySchema,
        response: {
          200: z.object({
            success: z.boolean().default(true),
            message: z.string(),
          }),
          400: adminErrorSchema400,
          401: adminErrorSchema401,
          403: adminErrorSchema403,
        },
      },
    },
    AdminUserController.changePassword,
  );

  // 5. API Cộng / Trừ tiền trực tiếp vào tài khoản User
  provider.post(
    "/admin/users/:id/adjust-balance",
    {
      ...adminGuards,
      schema: {
        tags: SWAGGER_TAG,
        summary: "Cộng tiền hoặc trừ tiền ví tài khoản của User",
        params: adminUserIdParamSchema,
        body: adminAdjustBalanceBodySchema,
        headers: adminAdjustBalanceHeaderSchema,
        response: {
          200: z.object({
            success: z.boolean().default(true),
            message: z.string(),
            data: z.any(),
          }),
          400: adminErrorSchema400,
          401: adminErrorSchema401,
          403: adminErrorSchema403,
        },
      },
    },
    AdminUserController.changeBalance,
  );
}
