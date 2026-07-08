import { FastifyInstance } from "fastify";
import { CategoryController } from "./controllers/category.controller";
import { authenticate } from "../../middlewares/auth.middleware";
import { adminMiddleware } from "../../middlewares/admin.middleware";

export async function categoryRoutes(fastify: FastifyInstance) {
  // Route công khai cho khách xem danh sách danh mục (Facebook, TikTok...)
  fastify.get("/", CategoryController.getCategories);

  // Các route quản trị Admin (Bạn có thể đính kèm thêm adminMiddleware nếu có)
  fastify.post(
    "/",
    { preHandler: [authenticate, adminMiddleware] },
    CategoryController.create,
  );
  fastify.put(
    "/:id",
    { preHandler: [authenticate, adminMiddleware] },
    CategoryController.update,
  );
  fastify.delete(
    "/:id",
    { preHandler: [authenticate, adminMiddleware] },
    CategoryController.delete,
  );
}
