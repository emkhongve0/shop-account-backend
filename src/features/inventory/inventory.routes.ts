import { FastifyInstance } from "fastify";
import { InventoryController } from "./controllers/inventory.controller";
import { authenticate } from "../../middlewares/auth.middleware"; // Sử dụng đúng tên middleware của bạn
import { adminMiddleware } from "../../middlewares/admin.middleware";

export async function inventoryRoutes(fastify: FastifyInstance) {
  // Toàn bộ API kho hàng đều thuộc quyền Admin độc quyền
  const adminGuards = { preHandler: [authenticate, adminMiddleware] };

  // Đặt route export tĩnh lên trước các route chứa params động
  fastify.get(
    "/admin/inventory/export",
    adminGuards,
    InventoryController.exportTxt,
  );

  fastify.get("/admin/inventory", adminGuards, InventoryController.getAll);
  fastify.get("/admin/inventory/:id", adminGuards, InventoryController.getOne);

  fastify.post(
    "/admin/inventory/import",
    adminGuards,
    InventoryController.importBulk,
  );
  fastify.post("/admin/inventory", adminGuards, InventoryController.create);

  fastify.put("/admin/inventory/:id", adminGuards, InventoryController.update);
  fastify.delete(
    "/admin/inventory/:id",
    adminGuards,
    InventoryController.delete,
  );
}
