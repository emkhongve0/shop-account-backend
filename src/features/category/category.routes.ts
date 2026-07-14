import { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { CategoryController } from "./controllers/category.controller";
import { authenticate } from "../../middlewares/auth.middleware";
import { adminMiddleware } from "../../middlewares/admin.middleware";
import {
  createCategoryBodySchema,
  updateCategoryBodySchema,
  getCategoriesQuerySchema,
  categoryIdParamSchema,
  getCategoriesSuccessResponse,
  singleCategorySuccessResponse,
  errorCategoryValidationSchema,
  errorCategoryNotFoundSchema,
  errorCategoryHasProductsSchema,
  errorCategory401Schema,
  errorCategory403Schema,
} from "./schemas/category.schema";
import { z } from "zod";

export async function categoryRoutes(fastify: FastifyInstance) {
  // 1. Tuyến đường xem danh sách danh mục công khai
  fastify.withTypeProvider<ZodTypeProvider>().get(
    "/",
    {
      schema: {
        tags: ["Category Management"],
        summary: "Lấy danh sách tất cả danh mục sản phẩm",
        description:
          "Khách hàng thông thường chỉ xem được danh mục ACTIVE sắp xếp theo displayOrder. Admin truyền `isAdmin=true` sẽ lấy được toàn bộ.",
        querystring: getCategoriesQuerySchema,
        response: {
          200: getCategoriesSuccessResponse,
        },
      } as any,
    },
    CategoryController.getCategories,
  );

  // 2. Tuyến đường Thêm mới Danh mục (Yêu cầu Admin)
  fastify.withTypeProvider<ZodTypeProvider>().post(
    "/",
    {
      preHandler: [authenticate, adminMiddleware],
      schema: {
        tags: ["Category Management"],
        summary: "Tạo danh mục sản phẩm mới (Admin)",
        description:
          "Yêu cầu quyền quản trị viên. Cho phép tạo nhóm danh mục và thiết lập từ khóa SEO.",
        body: createCategoryBodySchema,
        response: {
          201: singleCategorySuccessResponse,
          400: errorCategoryValidationSchema,
          401: errorCategory401Schema,
          403: errorCategory403Schema,
        },
      } as any,
    },
    CategoryController.create,
  );

  // 3. Tuyến đường Sửa đổi thông tin danh mục (Yêu cầu Admin)
  fastify.withTypeProvider<ZodTypeProvider>().put(
    "/:id",
    {
      preHandler: [authenticate, adminMiddleware],
      schema: {
        tags: ["Category Management"],
        summary: "Cập nhật dữ liệu danh mục theo ID (Admin)",
        description:
          "Cập nhật linh hoạt các trường dữ liệu. Kiểm tra tồn tại trước khi cập nhật.",
        params: categoryIdParamSchema,
        body: updateCategoryBodySchema,
        response: {
          200: singleCategorySuccessResponse,
          400: errorCategoryNotFoundSchema,
          401: errorCategory401Schema,
          403: errorCategory403Schema,
        },
      } as any,
    },
    CategoryController.update,
  );

  // 4. Tuyến đường Xóa cứng danh mục (Yêu cầu Admin)
  fastify.withTypeProvider<ZodTypeProvider>().delete(
    "/:id",
    {
      preHandler: [authenticate, adminMiddleware],
      schema: {
        tags: ["Category Management"],
        summary: "Xóa danh mục sản phẩm ra khỏi hệ thống (Admin)",
        description:
          "Cơ chế xóa cứng bảo mật. Hệ thống tự động quét và chặn hành vi xóa nếu danh mục đang chứa sản phẩm liên quan.",
        params: categoryIdParamSchema,
        response: {
          200: z.object({
            success: z.boolean().default(true),
            message: z.string().default("Xóa danh mục thành công hoàn toàn."),
          }),
          400: errorCategoryHasProductsSchema,
          401: errorCategory401Schema,
          403: errorCategory403Schema,
        },
      } as any,
    },
    CategoryController.delete,
  );
}
