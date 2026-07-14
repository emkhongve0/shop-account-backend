// src/features/product/routes/product.routes.ts
import { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { ProductController } from "./controllers/product.controller";
import { adminMiddleware } from "../../middlewares/admin.middleware";
import { authenticate } from "../../middlewares/auth.middleware";
import { z } from "zod";
import {
  purchaseBodySchema,
  createProductBodySchema,
  importStockBodySchema,
  productIdParamSchema,
  categoryIdParamSchema,
  productModelSchema,
  ProductStatusEnum,
  errorProduct400Schema,
  errorProduct404Schema,
  errorProduct500Schema,
} from "../product/schemas/product.schema";

export async function productRoutes(fastify: FastifyInstance) {
  const adminGuards = { preHandler: [authenticate, adminMiddleware] };

  // ==========================================================\
  // 1. CÁC ROUTE CÔNG KHAI & MUA HÀNG (USER / GUEST)
  // ==========================================================\

  // Lấy toàn bộ sản phẩm đang ACTIVE công khai ngoài trang chủ
  fastify.withTypeProvider<ZodTypeProvider>().get(
    "/products",
    {
      schema: {
        tags: ["Products (Sản phẩm cửa hàng)"],
        summary: "Lấy danh sách sản phẩm công khai",
        response: {
          200: z.object({
            success: z.boolean().default(true),
            data: z.array(productModelSchema),
          }),
          400: errorProduct400Schema,
          500: errorProduct500Schema,
        },
      },
    },
    ProductController.getAll,
  );

  // API Khách hàng bấm MUA HÀNG tự động trừ tiền ví
  fastify.withTypeProvider<ZodTypeProvider>().post(
    "/products/purchase",
    {
      preHandler: [authenticate],
      schema: {
        tags: ["Products (Sản phẩm cửa hàng)"],
        summary: "Thực hiện mua tài khoản tự động (Khấu trừ số dư ví)",
        body: purchaseBodySchema,
        response: {
          200: z.object({
            success: z.boolean().default(true),
            message: z.string(),
            data: z.object({
              orderId: z.number(),
              orderCode: z.string(),
              productName: z.string(),
              quantity: z.number(),
              totalPrice: z.number(),
              balanceAfter: z.number(),
              accounts: z
                .string()
                .describe(
                  "Chuỗi các tài khoản bàn giao cách nhau bằng dấu xuống dòng",
                ),
            }),
          }),
          400: errorProduct400Schema,
          500: errorProduct500Schema,
        },
      },
    },
    ProductController.handlePurchase,
  );

  // Lấy chi tiết một sản phẩm theo ID hoặc chuỗi định danh Slug SEO
  fastify.withTypeProvider<ZodTypeProvider>().get(
    "/products/:id",
    {
      schema: {
        tags: ["Products (Sản phẩm cửa hàng)"],
        summary: "Lấy thông tin chi tiết một sản phẩm theo ID hoặc Slug SEO",
        params: productIdParamSchema,
        response: {
          200: z.object({
            success: z.boolean().default(true),
            data: productModelSchema,
          }),
          404: errorProduct404Schema,
          500: errorProduct500Schema,
        },
      },
    },
    ProductController.getOne,
  );

  // Lấy danh sách sản phẩm theo mã ID danh mục cha
  fastify.withTypeProvider<ZodTypeProvider>().get(
    "/categories/:categoryId/products",
    {
      schema: {
        tags: ["Products (Sản phẩm cửa hàng)"],
        summary: "Lấy danh sách các sản phẩm thuộc một danh mục cụ thể",
        params: categoryIdParamSchema,
        response: {
          200: z.object({
            success: z.boolean().default(true),
            data: z.array(productModelSchema),
          }),
          400: errorProduct400Schema,
          500: errorProduct500Schema,
        },
      },
    },
    ProductController.getByCategory,
  );

  // ==========================================================\
  // 2. CÁC API QUẢN TRỊ VIÊN (ADMIN ONLY)
  // ==========================================================\

  // Admin tạo sản phẩm mới
  fastify.withTypeProvider<ZodTypeProvider>().post(
    "/admin/products",
    {
      ...adminGuards,
      schema: {
        tags: ["Admin Products (Quản trị sản phẩm)"],
        summary: "Admin tạo mới một mã sản phẩm",
        body: createProductBodySchema,
        response: {
          201: z.object({
            success: z.boolean().default(true),
            message: z.string(),
            data: productModelSchema,
          }),
          400: errorProduct400Schema,
          500: errorProduct500Schema,
        },
      },
    },
    ProductController.create,
  );

  // Admin nạp thêm clone/via hàng loạt vào sản phẩm qua raw text
  fastify.withTypeProvider<ZodTypeProvider>().post(
    "/admin/products/:id/import",
    {
      ...adminGuards,
      schema: {
        tags: ["Admin Products (Quản trị sản phẩm)"],
        summary:
          "Admin nhập kho tài khoản hàng loạt cho sản phẩm (Mỗi hàng 1 nick)",
        params: productIdParamSchema,
        body: importStockBodySchema,
        response: {
          200: z.object({
            success: z.boolean().default(true),
            message: z.string(),
            data: z.object({ importedCount: z.number() }),
          }),
          400: errorProduct400Schema,
          500: errorProduct500Schema,
        },
      },
    },
    ProductController.importStock,
  );

  // Admin sửa đổi thông tin tổng quan sản phẩm
  fastify.withTypeProvider<ZodTypeProvider>().put(
    "/admin/products/:id",
    {
      ...adminGuards,
      schema: {
        tags: ["Admin Products (Quản trị sản phẩm)"],
        summary: "Admin chỉnh sửa thông tin chi tiết của sản phẩm",
        params: productIdParamSchema,
        body: createProductBodySchema.partial(), // Cho phép gửi các trường tùy chọn để update
        response: {
          200: z.object({
            success: z.boolean().default(true),
            message: z.string(),
            data: productModelSchema,
          }),
          400: errorProduct400Schema,
          500: errorProduct500Schema,
        },
      },
    },
    ProductController.update,
  );

  // Admin xóa bỏ hoàn toàn sản phẩm
  fastify.withTypeProvider<ZodTypeProvider>().delete(
    "/admin/products/:id",
    {
      ...adminGuards,
      schema: {
        tags: ["Admin Products (Quản trị sản phẩm)"],
        summary: "Admin xóa cứng một sản phẩm",
        params: productIdParamSchema,
        response: {
          200: z.object({
            success: z.boolean().default(true),
            message: z.string(),
          }),
          400: errorProduct400Schema,
          500: errorProduct500Schema,
        },
      },
    },
    ProductController.delete,
  );

  // Admin bật tắt nhanh trạng thái ẩn hiện sản phẩm (ACTIVE / INACTIVE)
  fastify.withTypeProvider<ZodTypeProvider>().patch(
    "/admin/products/:id/status",
    {
      ...adminGuards,
      schema: {
        tags: ["Admin Products (Quản trị sản phẩm)"],
        summary: "Admin bật/tắt nhanh trạng thái ACTIVE/INACTIVE của sản phẩm",
        params: productIdParamSchema,
        body: z.object({ status: ProductStatusEnum }),
        response: {
          200: z.object({
            success: z.boolean().default(true),
            message: z.string(),
            data: productModelSchema,
          }),
          400: errorProduct400Schema,
          500: errorProduct500Schema,
        },
      },
    },
    ProductController.updateStatus,
  );
}
