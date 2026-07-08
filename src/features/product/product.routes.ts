import { FastifyInstance } from "fastify";
import { ProductController } from "./controllers/product.controller";
import { adminMiddleware } from "../../middlewares/admin.middleware";
import { PurchaseService } from "./services/purchase.service";
import { authenticate } from "../../middlewares/auth.middleware";

export async function productRoutes(fastify: FastifyInstance) {
  // ==========================================================
  // 1. CÁC ROUTE TĨNH (STATIC ROUTES)
  // ==========================================================

  // API lấy toàn bộ sản phẩm công khai
  fastify.get("/products", ProductController.getAll);

  // API Khách hàng bấm MUA HÀNG (Đã dùng 'authenticate')
  fastify.post(
    "/products/purchase",
    { preHandler: [authenticate] },
    async (request, reply) => {
      try {
        const userId = (request.user as any).id;
        const { productId, quantity } = request.body as {
          productId: number;
          quantity: number;
        };

        const result = await PurchaseService.executePurchase(
          userId,
          productId,
          quantity,
        );

        return reply.send({
          success: true,
          message: "Mua hàng thành công! Tài khoản của bạn đã được xuất.",
          data: result,
        });
      } catch (error: any) {
        return reply
          .status(400)
          .send({ success: false, message: error.message });
      }
    },
  );

  // ==========================================================
  // 2. CÁC ROUTE ĐỘNG (DYNAMIC ROUTES)
  // ==========================================================
  fastify.get("/products/:id", ProductController.getOne);
  fastify.get(
    "/categories/:categoryId/products",
    ProductController.getByCategory,
  );

  // ==========================================================
  // 3. API DÀNH CHO ADMIN
  // ==========================================================
  // Bảo vệ nghiêm ngặt bằng cả authenticate và adminMiddleware
  const adminGuards = { preHandler: [authenticate, adminMiddleware] };

  fastify.post("/admin/products", adminGuards, ProductController.create);
  fastify.post(
    "/admin/products/:id/import",
    adminGuards,
    ProductController.importStock,
  );
  fastify.put("/admin/products/:id", adminGuards, ProductController.update);
  fastify.delete("/admin/products/:id", adminGuards, ProductController.delete);

  fastify.patch(
    "/admin/products/:id/status",
    adminGuards,
    ProductController.update,
  );
  fastify.patch(
    "/admin/products/:id/price",
    adminGuards,
    ProductController.update,
  );
}
