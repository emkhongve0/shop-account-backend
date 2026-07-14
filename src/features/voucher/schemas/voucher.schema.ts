// src/features/voucher/schemas/voucher.schema.ts
import { z } from "zod";

/**
 * SCHEMA INPUT: Định nghĩa cấu trúc dữ liệu đầu vào khi kiểm tra mã giảm giá
 * (Giữ nguyên logic kiểm tra độ dài và tự động viết hoa mã cũ)
 */
export const checkVoucherBodySchema = z.object({
  code: z
    .string()
    .trim()
    .min(2, "Mã voucher quá ngắn")
    .max(20, "Mã voucher quá dài")
    .toUpperCase(), // Tự động viết hoa mã khi kiểm tra
  orderAmount: z.number().min(0, "Giá trị đơn hàng không hợp lệ"),
});

export type CheckVoucherInput = z.infer<typeof checkVoucherBodySchema>;

/**
 * SCHEMA OUTPUT SUCCESS (200): Định nghĩa dữ liệu trả về khi áp dụng thành công
 */
export const checkVoucherSuccessResponseSchema = z.object({
  success: z.boolean().default(true),
  message: z.string().default("Áp dụng mã giảm giá thành công."),
  data: z.object({
    id: z.number(),
    code: z.string(),
    type: z.enum(["FIXED", "PERCENT"]),
    discount: z.number(),
    discountAmount: z
      .number()
      .describe("Số tiền thực tế được giảm trừ cho đơn hàng"),
    maxUses: z.number(),
    usedCount: z.number(),
    expiryDate: z.string(),
    createdAt: z.string(),
  }),
});

/**
 * SCHEMA OUTPUT ERROR (400, 404): Định nghĩa cấu trúc trả về khi gặp lỗi nghiệp vụ
 * * Các mã lỗi (code) được trả về cụ thể từ Controller bao gồm:
 * - 'VOUCHER_NOT_FOUND': Mã giảm giá không tồn tại hoặc đã nhập sai.
 * - 'VOUCHER_EXPIRED': Mã giảm giá đã hết hạn sử dụng.
 * - 'VOUCHER_MAX_USES_REACHED': Mã giảm giá đã đạt giới hạn lượt sử dụng tối đa.
 */
export const voucherErrorResponseSchema = z.object({
  success: z.boolean().default(false),
  message: z
    .string()
    .describe(
      "Thông báo lỗi chi tiết (VOUCHER_NOT_FOUND, VOUCHER_EXPIRED, VOUCHER_MAX_USES_REACHED...)",
    ),
});
