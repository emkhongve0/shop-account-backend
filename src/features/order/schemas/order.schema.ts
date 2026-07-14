// src/features/order/schemas/order.schema.ts
import { z } from "zod";

// Enum trạng thái đơn hàng đồng bộ Prisma
export const OrderStatusEnum = z.enum([
  "PENDING",
  "SUCCESS",
  "FAILED",
  "CANCELLED",
]);

// Cấu trúc Model Order chi tiết để hiển thị tài liệu Swagger
export const orderModelSchema = z.object({
  id: z.number(),
  orderCode: z.string().describe("Mã đơn hàng định danh duy nhất"),
  userId: z.number(),
  totalAmount: z.number().describe("Tổng số tiền của đơn hàng"),
  status: z.string().describe("Trạng thái đơn hàng"),
  createdAt: z.date().or(z.string()),
  updatedAt: z.date().or(z.string()),
  user: z
    .object({
      email: z.string(),
    })
    .optional()
    .describe("Thông tin tài khoản người mua (Admin hiển thị)"),
  items: z
    .array(
      z.object({
        id: z.number(),
        orderId: z.number(),
        productId: z.number(),
        productName: z.string(),
        quantity: z.number(),
        price: z.number(),
        subTotal: z.number(),
        accounts: z
          .array(
            z.object({
              accountData: z.string().describe("Dữ liệu nick/clone bàn giao"),
            }),
          )
          .optional(),
      }),
    )
    .optional()
    .describe("Danh sách sản phẩm trong đơn hàng"),
});

// --- SCHEMA ĐẦU VÀO CHO KHÁCH HÀNG (USER) ---

export const getUserOrdersQuerySchema = z.object({
  orderCode: z
    .string()
    .optional()
    .describe("Tìm kiếm chính xác hoặc một phần mã đơn hàng"),
  productName: z
    .string()
    .optional()
    .describe("Lọc đơn hàng có chứa tên sản phẩm này"),
  status: OrderStatusEnum.optional().describe("Lọc đơn hàng theo trạng thái"),
  timeRange: z
    .enum(["today", "7days", "30days"])
    .optional()
    .describe("Bộ lọc nhanh khoảng thời gian mua hàng"),
});

// --- SCHEMA ĐẦU VÀO CHO QUẢN TRỊ VIÊN (ADMIN) ---

export const getAdminOrdersQuerySchema = z.object({
  orderCode: z.string().optional().describe("Tìm kiếm theo mã đơn hàng"),
  searchKey: z
    .string()
    .optional()
    .describe("Tìm kiếm hỗn hợp theo Email người mua"),
});

// --- PARAM ID CHUNG CHO ĐƠN HÀNG ---
export const orderIdParamSchema = z.object({
  orderId: z
    .string()
    .nonempty("Mã đơn hàng không được để trống")
    .describe("Mã chuỗi string định danh đơn hàng (orderCode)"),
});

// --- HỆ THỐNG MÃ LỖI ĐỒNG BỘ PHÂN HỆ ORDER ---

export const errorOrder400Schema = z.object({
  success: z.boolean().default(false),
  code: z.string().default("VALIDATION_ERROR"),
  message: z
    .string()
    .default("Yêu cầu không hợp lệ hoặc tham số bộ lọc sai định dạng."),
});

export const errorOrder404Schema = z.object({
  success: z.boolean().default(false),
  code: z.string().default("NOT_FOUND"),
  message: z
    .string()
    .default("Không tìm thấy hóa đơn hoặc bạn không có quyền truy cập."),
});

export const errorOrder500Schema = z.object({
  success: z.boolean().default(false),
  code: z.string().default("SERVER_ERROR"),
  message: z.string().default("Lỗi máy chủ khi xử lý truy vấn đơn hàng."),
});
