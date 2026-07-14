// src/features/product/schemas/product.schema.ts
import { z } from "zod";

export const ProductStatusEnum = z.enum(["ACTIVE", "INACTIVE"]);

// Định nghĩa cấu trúc Object Product để xuất tài liệu Swagger
export const productModelSchema = z.object({
  id: z.number().describe("Mã định danh duy nhất của sản phẩm"),
  name: z.string().describe("Tên sản phẩm (Ví dụ: Facebook VIA 2018)"),
  slug: z.string().describe("Đường dẫn thân thiện SEO tự động sinh"),
  price: z.number().describe("Giá bán sản phẩm"),
  description: z.string().describe("Mô tả chi tiết sản phẩm (Định dạng HTML)"),
  status: z.string().describe("Trạng thái hiển thị (ACTIVE / INACTIVE)"),
  categoryName: z.string().optional().describe("Tên danh mục cha tương ứng"),
  stock: z
    .number()
    .optional()
    .describe("Số lượng tài khoản khả dụng trong kho"),
});

// --- SCHEMA ĐẦU VÀO BIỂU MẪU (REQUEST VALIDATION) ---

export const purchaseBodySchema = z.object({
  productId: z
    .number({ required_error: "Mã sản phẩm bắt buộc phải có" })
    .int("ID phải là số nguyên dương"),
  quantity: z
    .number({ required_error: "Số lượng mua không được để trống" })
    .int()
    .min(1, "Số lượng mua tối thiểu là 1 tài khoản"),
});

export const createProductBodySchema = z.object({
  name: z
    .string({ required_error: "Tên sản phẩm không được trống" })
    .nonempty("Tên không được rỗng"),
  slug: z.string().optional().describe("Slug SEO (Tự động sinh nếu bỏ trống)"),
  price: z
    .number({ required_error: "Giá sản phẩm bắt buộc phải điền" })
    .min(0, "Giá không được âm"),
  description: z
    .string()
    .optional()
    .default("")
    .describe("Nội dung mô tả sản phẩm"),
  categoryId: z.number({
    required_error: "Phải chọn danh mục cha cho sản phẩm",
  }),
  status: ProductStatusEnum.optional().default("ACTIVE"),
});

export const importStockBodySchema = z.object({
  rawTxtData: z
    .string({ required_error: "Dữ liệu text tài khoản không được để trống" })
    .nonempty("Nội dung tài khoản trống"),
});

export const productIdParamSchema = z.object({
  id: z
    .string()
    .nonempty("Tham số ID sản phẩm không được để trống")
    .describe("Mã ID hoặc chuỗi Slug SEO"),
});

export const categoryIdParamSchema = z.object({
  categoryId: z
    .string()
    .regex(/^\d+$/, "Mã ID danh mục phải là số nguyên dương")
    .describe("ID của danh mục cần lọc sản phẩm"),
});

// --- HỆ THỐNG MÃ LỖI ĐỒNG BỘ PHÂN HỆ PRODUCT ---

export const errorProduct400Schema = z.object({
  success: z.boolean().default(false),
  code: z.string().default("VALIDATION_ERROR"),
  message: z
    .string()
    .default(
      "Dữ liệu đầu vào lỗi hoặc số dư tài khoản không đủ để thực hiện thanh toán.",
    ),
});

export const errorProduct404Schema = z.object({
  success: z.boolean().default(false),
  code: z.string().default("NOT_FOUND"),
  message: z
    .string()
    .default(
      "Không tìm thấy thông tin sản phẩm hoặc đường dẫn SEO không tồn tại.",
    ),
});

export const errorProduct500Schema = z.object({
  success: z.boolean().default(false),
  code: z.string().default("SERVER_ERROR"),
  message: z
    .string()
    .default("Lỗi máy chủ phát sinh trong quá trình xử lý mua hàng."),
});
