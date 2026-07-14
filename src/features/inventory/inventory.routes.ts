// src/features/inventory/routes/inventory.routes.ts
import { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { InventoryController } from "./controllers/inventory.controller";
import { authenticate } from "../../middlewares/auth.middleware";
import { adminMiddleware } from "../../middlewares/admin.middleware";
import { z } from "zod";
import {
  getInventoryQuerySchema,
  exportInventoryQuerySchema,
  importBulkBodySchema,
  createSingleBodySchema,
  updateInventoryBodySchema,
  inventoryIdParamSchema,
  inventoryModelSchema,
  errorInventory400Schema,
  errorInventory404Schema,
  errorInventory500Schema,
} from "../inventory/schemas/inventory.schema";

export async function inventoryRoutes(fastify: FastifyInstance) {
  const adminGuards = { preHandler: [authenticate, adminMiddleware] };

  // 1. Export dữ liệu định dạng file TXT
  fastify.withTypeProvider<ZodTypeProvider>().get(
    "/admin/inventory/export",
    {
      ...adminGuards,
      schema: {
        tags: ["Admin Inventory (Quản lý kho tài khoản)"],
        summary: "Xuất dữ liệu tài khoản (TXT Export)",
        querystring: exportInventoryQuerySchema,
        response: {
          200: z.any().describe("Trả về file stream văn bản text/plain"),
          400: errorInventory400Schema,
          500: errorInventory500Schema,
        },
      },
    },
    InventoryController.exportTxt,
  );

  // 2. Lấy toàn bộ danh sách kho hàng kèm bộ lọc công cụ
  fastify.withTypeProvider<ZodTypeProvider>().get(
    "/admin/inventory",
    {
      ...adminGuards,
      schema: {
        tags: ["Admin Inventory (Quản lý kho tài khoản)"],
        summary: "Lấy danh sách kho hàng",
        querystring: getInventoryQuerySchema,
        response: {
          200: z.object({
            success: z.boolean().default(true),
            data: z.array(inventoryModelSchema),
          }),
          400: errorInventory400Schema,
          500: errorInventory500Schema,
        },
      },
    },
    InventoryController.getAll,
  );

  // 3. Xem chi tiết thông tin 1 tài khoản
  fastify.withTypeProvider<ZodTypeProvider>().get(
    "/admin/inventory/:id",
    {
      ...adminGuards,
      schema: {
        tags: ["Admin Inventory (Quản lý kho tài khoản)"],
        summary: "Xem thông tin chi tiết một tài khoản",
        params: inventoryIdParamSchema,
        response: {
          200: z.object({
            success: z.boolean().default(true),
            data: inventoryModelSchema,
          }),
          404: errorInventory404Schema,
          500: errorInventory500Schema,
        },
      },
    },
    InventoryController.getOne,
  );

  // 4. Import tài khoản số lượng lớn từ nội dung file text
  fastify.withTypeProvider<ZodTypeProvider>().post(
    "/admin/inventory/import",
    {
      ...adminGuards,
      schema: {
        tags: ["Admin Inventory (Quản lý kho tài khoản)"],
        summary: "Nhập tài khoản hàng loạt (Bulk Import)",
        body: importBulkBodySchema,
        response: {
          201: z.object({
            success: z.boolean().default(true),
            message: z.string(),
            data: z.object({
              importedCount: z
                .number()
                .describe("Số lượng tài khoản đã thêm thành công vào DB"),
            }),
          }),
          400: errorInventory400Schema,
          500: errorInventory500Schema,
        },
      },
    },
    InventoryController.importBulk,
  );

  // 5. Tạo thủ công riêng lẻ 1 tài khoản
  fastify.withTypeProvider<ZodTypeProvider>().post(
    "/admin/inventory",
    {
      ...adminGuards,
      schema: {
        tags: ["Admin Inventory (Quản lý kho tài khoản)"],
        summary: "Thêm thủ công lẻ một tài khoản",
        body: createSingleBodySchema,
        response: {
          201: z.object({
            success: z.boolean().default(true),
            message: z.string(),
            data: inventoryModelSchema,
          }),
          400: errorInventory400Schema,
          500: errorInventory500Schema,
        },
      },
    },
    InventoryController.create,
  );

  // 6. Cập nhật thông tin hoặc đổi trạng thái tài khoản
  fastify.withTypeProvider<ZodTypeProvider>().put(
    "/admin/inventory/:id",
    {
      ...adminGuards,
      schema: {
        tags: ["Admin Inventory (Quản lý kho tài khoản)"],
        summary: "Cập nhật dữ liệu hoặc trạng thái tài khoản",
        params: inventoryIdParamSchema,
        body: updateInventoryBodySchema,
        response: {
          200: z.object({
            success: z.boolean().default(true),
            message: z.string(),
            data: inventoryModelSchema,
          }),
          400: errorInventory400Schema,
          500: errorInventory500Schema,
        },
      },
    },
    InventoryController.update,
  );

  // 7. Xóa tài khoản vĩnh viễn khỏi hệ thống
  fastify.withTypeProvider<ZodTypeProvider>().delete(
    "/admin/inventory/:id",
    {
      ...adminGuards,
      schema: {
        tags: ["Admin Inventory (Quản lý kho tài khoản)"],
        summary: "Xóa tài khoản khỏi kho",
        params: inventoryIdParamSchema,
        response: {
          200: z.object({
            success: z.boolean().default(true),
            message: z.string(),
          }),
          400: errorInventory400Schema,
          500: errorInventory500Schema,
        },
      },
    },
    InventoryController.delete,
  );
}
