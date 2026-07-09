import { FastifyInstance } from "fastify";
import { OrderController } from "./controllers/order.controller";
import { authenticate } from "../../middlewares/auth.middleware";
import { adminMiddleware } from "../../middlewares/admin.middleware";

export async function orderRoutes(fastify: FastifyInstance) {
  // Nhóm API dành cho khách hàng đăng nhập
  fastify.get(
    "/orders",
    { preHandler: [authenticate] },
    OrderController.getUserOrders,
  );
  fastify.get(
    "/orders/:orderId",
    { preHandler: [authenticate] },
    OrderController.getUserOrderDetail,
  );

  // Nhóm API dành riêng cho quản trị viên Admin
  const adminGuards = { preHandler: [authenticate, adminMiddleware] };
  fastify.get("/admin/orders", adminGuards, OrderController.getAdminOrders);
  fastify.get(
    "/admin/orders/:orderId",
    adminGuards,
    OrderController.getAdminOrderDetail,
  );
}
