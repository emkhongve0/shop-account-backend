// src/features/order/routes/order.routes.ts
import { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { OrderController } from "./controllers/order.controller";
import { authenticate } from "../../middlewares/auth.middleware";
import { adminMiddleware } from "../../middlewares/admin.middleware";
import { z } from "zod";
import {
  getUserOrdersQuerySchema,
  getAdminOrdersQuerySchema,
  orderIdParamSchema,
  orderModelSchema,
  errorOrder400Schema,
  errorOrder404Schema,
  errorOrder500Schema,
} from "../order/schemas/order.schema";

export async function orderRoutes(fastify: FastifyInstance) {
  const adminGuards = { preHandler: [authenticate, adminMiddleware] };

  // =========================================================================
  // NHÓM API DÀNH CHO USER ĐÃ ĐĂNG NHẬP
  // =========================================================================

  // 1. Lấy danh sách lịch sử đơn hàng của user
  fastify.withTypeProvider<ZodTypeProvider>().get(
    "/orders",
    {
      preHandler: [authenticate],
      schema: {
        tags: ["Orders (Đơn hàng người dùng)"],
        summary: "Xem lịch sử mua hàng cá nhân (Có bộ lọc tìm kiếm)",
        querystring: getUserOrdersQuerySchema,
        response: {
          200: z.object({
            success: z.boolean().default(true),
            data: z.array(orderModelSchema),
          }),
          400: errorOrder400Schema,
          500: errorOrder500Schema,
        },
      },
    },
    OrderController.getUserOrders,
  );

  // 2. Xem chi tiết đơn hàng (Có kèm thông tin tài khoản clone đã bàn giao)
  fastify.withTypeProvider<ZodTypeProvider>().get(
    "/orders/:orderId",
    {
      preHandler: [authenticate],
      schema: {
        tags: ["Orders (Đơn hàng người dùng)"],
        summary: "Xem chi tiết một đơn hàng theo mã đơn (OrderCode)",
        params: orderIdParamSchema,
        response: {
          200: z.object({
            success: z.boolean().default(true),
            data: orderModelSchema,
          }),
          404: errorOrder404Schema,
          500: errorOrder500Schema,
        },
      },
    },
    OrderController.getUserOrderDetail,
  );

  // =========================================================================
  // NHÓM API QUẢN TRỊ TỐI CAO (ADMIN)
  // =========================================================================

  // 3. Admin quét toàn bộ đơn hàng hệ thống
  fastify.withTypeProvider<ZodTypeProvider>().get(
    "/admin/orders",
    {
      ...adminGuards,
      schema: {
        tags: ["Admin Orders (Quản trị đơn hàng)"],
        summary: "Admin lấy danh sách toàn bộ đơn hàng hệ thống",
        querystring: getAdminOrdersQuerySchema,
        response: {
          200: z.object({
            success: z.boolean().default(true),
            data: z.array(orderModelSchema),
          }),
          400: errorOrder400Schema,
          500: errorOrder500Schema,
        },
      },
    },
    OrderController.getAdminOrders,
  );

  // 4. Admin xem chi tiết đơn hàng + email người mua + mã tài khoản kho
  fastify.withTypeProvider<ZodTypeProvider>().get(
    "/admin/orders/:orderId",
    {
      ...adminGuards,
      schema: {
        tags: ["Admin Orders (Quản trị đơn hàng)"],
        summary: "Admin xem chi tiết một hóa đơn hệ thống",
        params: orderIdParamSchema,
        response: {
          200: z.object({
            success: z.boolean().default(true),
            data: orderModelSchema,
          }),
          404: errorOrder404Schema,
          500: errorOrder500Schema,
        },
      },
    },
    OrderController.getAdminOrderDetail,
  );
}
