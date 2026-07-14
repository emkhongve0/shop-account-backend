// src/features/wallet/schemas/wallet.schema.ts
import { z } from "zod";

/**
 * SCHEMA INPUT: Định nghĩa cấu trúc Query tham số phân trang lịch sử ví
 */
export const walletHistoryQuerySchema = z.object({
  page: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 1))
    .refine((val) => val > 0, { message: "Trang phải lớn hơn 0" }),
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 10))
    .refine((val) => val > 0, { message: "Số lượng bản ghi phải lớn hơn 0" }),
});

/**
 * SCHEMA OUTPUT SUCCESS (200): Cấu trúc trả về chi tiết ví và lịch sử giao dịch chính thức
 */
export const walletDetailsSuccessResponseSchema = z.object({
  success: z.boolean().default(true),
  data: z.object({
    currentBalance: z.number().describe("Số dư khả dụng hiện tại trong ví"),
    history: z.array(
      z.object({
        id: z.number().describe("Mã định danh giao dịch"),
        userId: z.number().describe("Mã người dùng thực hiện"),
        type: z
          .string()
          .describe(
            "Loại biến động (Ví dụ: ADMIN_INCREMENT, ADMIN_DECREMENT, PURCHASE...)",
          ),
        amount: z.number().describe("Số tiền biến động"),
        balanceBefore: z.number().describe("Số dư trước khi giao dịch"),
        balanceAfter: z.number().describe("Số dư sau khi hoàn tất giao dịch"),
        description: z.string().describe("Nội dung, lý do biến động số dư"),
        createdAt: z.coerce.string().describe("Thời gian tạo giao dịch"),
      }),
    ),
    meta: z.object({
      total: z.number().describe("Tổng số lượng giao dịch"),
      page: z.number().describe("Trang hiện tại"),
      limit: z.number().describe("Số lượng bản ghi trên một trang"),
      totalPages: z.number().describe("Tổng số trang"),
    }),
  }),
});

/**
 * SCHEMA OUTPUT ERROR (400, 401): Định nghĩa cấu trúc phản hồi lỗi
 */
export const walletErrorResponseSchema = z.object({
  success: z.boolean().default(false),
  message: z
    .string()
    .describe(
      "Thông báo lỗi chi tiết từ hệ thống (Người dùng không tồn tại, Lỗi phân trang...)",
    ),
});
