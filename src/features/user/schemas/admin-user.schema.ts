// src/features/profile/schemas/admin-user.schema.ts
import { z } from "zod";

// Định nghĩa Enum cấu trúc Role giống trong Prisma Schema của bạn
const UserRoleEnum = z.enum(["USER", "ADMIN"]);

// 1. Schema phục vụ Validate Query parameters cho API List User
export const adminUserQuerySchema = z.object({
  page: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 1)),
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 10)),
  id: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : undefined)),
  email: z.string().optional(),
  status: z.string().optional(),
  role: UserRoleEnum.optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

// 2. Schema phục vụ Validate URL Params (ID của User)
export const adminUserIdParamSchema = z.object({
  id: z.string().regex(/^[0-9]+$/, "ID người dùng phải là số hợp lệ"),
});

// 3. Schema phục vụ Validate Body cho API cập nhật thông tin User
export const adminUpdateUserBodySchema = z.object({
  displayName: z.string().min(2, "Tên hiển thị tối thiểu 2 ký tự").optional(),
  status: z.string().optional(),
  role: UserRoleEnum.optional(),
});

// 4. Schema phục vụ Validate Body cho API Reset mật khẩu
export const adminResetPasswordBodySchema = z.object({
  passwordNew: z.string().min(6, "Mật khẩu mới tối thiểu phải có 6 ký tự"),
});

// 5. Schema phục vụ Validate Body cho API Điều chỉnh số dư ví
export const adminAdjustBalanceBodySchema = z.object({
  // Bắt buộc là số, và không được phép truyền số 0 (vì cộng/trừ 0 đồng là vô nghĩa)
  amount: z
    .number({
      required_error: "Vui lòng nhập số tiền",
      invalid_type_error: "Số tiền phải là định dạng số",
    })
    .refine((val) => val !== 0, {
      message: "Số tiền điều chỉnh không được bằng 0",
    }),

  // Yêu cầu Admin phải nhập lý do rõ ràng, độ dài tối thiểu 5 ký tự để tránh log rác như "a", "123"
  description: z
    .string({
      required_error: "Bắt buộc phải nhập lý do điều chỉnh số dư",
    })
    .min(5, "Lý do phải có ít nhất 5 ký tự")
    .max(255, "Lý do quá dài, tối đa 255 ký tự"),
});

// --- ĐỊNH NGHĨA CÁC ĐỐI TƯỢNG PHẢN HỒI CHUẨN ĐỂ ĐƯA VÀO SWAGGER DOCS ---
export const adminErrorSchema400 = z.object({
  success: z.boolean().default(false),
  code: z.string().default("VALIDATION_ERROR"),
  message: z.string(),
});

export const adminErrorSchema401 = z.object({
  success: z.boolean().default(false),
  code: z.string().default("UNAUTHORIZED"),
  message: z.string(),
});

export const adminErrorSchema403 = z.object({
  success: z.boolean().default(false),
  code: z.string().default("FORBIDDEN"),
  message: z.string(),
});

export const adminErrorSchema404 = z.object({
  success: z.boolean().default(false),
  code: z.string().default("NOT_FOUND"),
  message: z.string(),
});

export const adminAdjustBalanceHeaderSchema = z.object({
  "x-idempotency-key": z
    .string({
      required_error: "Thiếu Idempotency Key để chống trùng lặp giao dịch",
    })
    .uuid("Idempotency Key phải là định dạng UUID"),
});

