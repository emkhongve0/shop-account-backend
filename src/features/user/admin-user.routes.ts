import { FastifyInstance } from "fastify";
import { AdminUserController } from "./controllers/admin-user.controller";
import { authenticate } from "../../middlewares/auth.middleware";
import { adminMiddleware } from "../../middlewares/admin.middleware";

export async function adminUserRoutes(fastify: FastifyInstance) {
  // Toàn bộ các API này được bảo vệ nghiêm ngặt chỉ Admin mới kích hoạt được
  const adminGuards = { preHandler: [authenticate, adminMiddleware] };

  fastify.get("/admin/users", adminGuards, AdminUserController.list);
  fastify.get("/admin/users/:id", adminGuards, AdminUserController.detail);
  fastify.put("/admin/users/:id", adminGuards, AdminUserController.update);
  
  fastify.post("/admin/users/:id/reset-password", adminGuards, AdminUserController.changePassword);
  fastify.post("/admin/users/:id/adjust-balance", adminGuards, AdminUserController.changeBalance);
}