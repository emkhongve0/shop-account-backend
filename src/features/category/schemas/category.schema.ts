import { z } from "zod";

// Định nghĩa Enum trạng thái danh mục theo Prisma Model
export const CategoryStatusEnum = z.enum(["ACTIVE", "INACTIVE"]);

// --- SCHEMA VALIDATE BODY KHI THÊM MỚI ---
export const createCategoryBodySchema = z.object({
  name: z
    .string({ required_error: "Tên danh mục không được để trống" })
    .min(2, "Tên danh mục tối thiểu 2 ký tự")
    .max(50, "Tên danh mục tối đa 50 ký tự")
    .describe(
      "Tên danh mục sản phẩm (Ví dụ: Tài khoản Facebook, Nguyên liệu TikTok...)",
    ),
  description: z
    .string()
    .max(500, "Mô tả không được vượt quá 500 ký tự")
    .optional()
    .describe("Mô tả ngắn về danh mục"),
  icon: z
    .string()
    .max(255)
    .optional()
    .describe("Chuỗi ký tự tên Class Icon (FontAwesome/Lucide)"),
  avatar: z
    .string()
    .url("Đường dẫn ảnh đại diện không hợp lệ (Phải là URL)")
    .optional()
    .or(z.string().max(0))
    .describe("URL hình ảnh minh họa danh mục"),
  displayOrder: z
    .number()
    .int()
    .default(0)
    .describe("Thứ tự sắp xếp hiển thị tăng dần"),
  status: CategoryStatusEnum.default("ACTIVE").describe("Trạng thái hoạt động"),
  seoTitle: z
    .string()
    .max(100)
    .optional()
    .describe("Tiêu đề phục vụ cấu hình SEO"),
  seoDescription: z
    .string()
    .max(200)
    .optional()
    .describe("Mô tả phục vụ cấu hình SEO"),
  seoKeywords: z
    .string()
    .max(200)
    .optional()
    .describe("Từ khóa SEO, phân tách bằng dấu phẩy"),
});

// --- SCHEMA VALIDATE BODY KHI CẬP NHẬT (UPDATE) ---
export const updateCategoryBodySchema = createCategoryBodySchema.partial();

// --- SCHEMA CHẶN QUERY STRING KHI LẤY DANH SÁCH ---
export const getCategoriesQuerySchema = z.object({
  isAdmin: z
    .string()
    .optional()
    .describe(
      'Truyền "true" nếu là Admin để lấy toàn bộ danh mục (bao gồm cả INACTIVE)',
    ),
});

// --- SCHEMA THAM SỐ TRÊN URL (PARAMS) ---
export const categoryIdParamSchema = z.object({
  id: z
    .string()
    .regex(/^\d+$/, "ID danh mục phải là một số nguyên dương")
    .describe("Mã định danh ID của danh mục"),
});

export type CreateCategoryInput = z.infer<typeof createCategoryBodySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategoryBodySchema>;

// =========================================================================
// CHUẨN HÓA KHỐI PHẢN HỒI THÀNH CÔNG VÀ LỖI DẠNG ZOD NGUYÊN BẢN (FIX LỖI 500)
// =========================================================================

// Cấu trúc một Item Category trả về cho Frontend
export const categoryResponseObject = z.object({
  id: z.number(),
  name: z.string(),
  description: z.string().nullable(),
  icon: z.string().nullable(),
  avatar: z.string().nullable(),
  displayOrder: z.number(),
  status: z.string(),
  seo: z.object({
    title: z.string().nullable(),
    description: z.string().nullable(),
    keywords: z.string().nullable(),
  }),
  totalProducts: z
    .number()
    .describe("Tổng số lượng sản phẩm thuộc danh mục này"),
  totalAccountsAvailable: z
    .number()
    .describe("Số lượng tài khoản (Acc) đang tồn kho sẵn sàng bán"),
});

// Phản hồi 200 danh sách danh mục
export const getCategoriesSuccessResponse = z.object({
  success: z.boolean().default(true),
  data: z.array(categoryResponseObject),
});

// Phản hồi 200/201 khi thao tác sửa đổi Single Record dữ liệu thành công
export const singleCategorySuccessResponse = z.object({
  success: z.boolean().default(true),
  message: z.string().default("Thao tác danh mục thành công."),
  data: z
    .object({
      id: z.number(),
      name: z.string(),
      status: z.string(),
    })
    .passthrough(),
});

// --- KHỐI LỖI DOANH NGHIỆP DẠNG ZOD (ENTERPRISE ERROR) ---
export const errorCategoryValidationSchema = z
  .object({
    success: z.boolean().default(false),
    code: z.string().default("VALIDATION_ERROR"),
    message: z
      .string()
      .default("Dữ liệu gửi lên không vượt qua bộ lọc kiểm tra."),
  })
  .describe("Lỗi dữ liệu đầu vào không hợp lệ");

export const errorCategoryNotFoundSchema = z
  .object({
    success: z.boolean().default(false),
    code: z.string().default("CATEGORY_NOT_FOUND"),
    message: z
      .string()
      .default("Không tìm thấy danh mục yêu cầu trong Cơ sở dữ liệu."),
  })
  .describe("Lỗi không tìm thấy ID danh mục");

export const errorCategoryHasProductsSchema = z
  .object({
    success: z.boolean().default(false),
    code: z.string().default("CATEGORY_HAS_PRODUCTS"),
    message: z
      .string()
      .default(
        "Không thể xóa danh mục này vì vẫn còn sản phẩm bên trong. Hãy giải phóng sản phẩm trước.",
      ),
  })
  .describe("Lỗi ràng buộc dữ liệu sản phẩm");

export const errorCategory401Schema = z
  .object({
    success: z.boolean().default(false),
    code: z.string().default("UNAUTHORIZED"),
    message: z.string().default("Yêu cầu Token xác thực quyền truy cập."),
  })
  .describe("Lỗi chưa đăng nhập hoặc phiên làm việc hết hạn");

export const errorCategory403Schema = z
  .object({
    success: z.boolean().default(false),
    code: z.string().default("FORBIDDEN_ADMIN_ONLY"),
    message: z
      .string()
      .default("Tài khoản của bạn không có đặc quyền quản trị viên (Admin)."),
  })
  .describe("Lỗi từ chối phân quyền truy cập");
