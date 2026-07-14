// src/features/profile/schemas/profile.schema.ts
import { z } from "zod";

// --- MÔ HÌNH DỮ LIỆU ĐẦU RA (SWAGGER MODELS) ---
export const userProfileResponseSchema = z.object({
  id: z.number().describe("Mã ID tài khoản"),
  displayName: z.string().describe("Tên hiển thị người dùng"),
  email: z.string().email().describe("Địa chỉ Email đăng ký"),
  status: z.string().describe("Trạng thái tài khoản (ACTIVE / BANNED)"),
  balance: z.number().describe("Số dư ví hiện tại (VND)"),
  createdAt: z.date().or(z.string()).describe("Ngày tham gia hệ thống"),
});

export const securityLogSchema = z.object({
  id: z.number(),
  ipAddress: z.string().nullable(),
  userAgent: z.string().nullable(),
  action: z.string().describe("Hành động (Ví dụ: LOGIN, CHANGE_PASSWORD)"),
  createdAt: z.date().or(z.string()),
});

export const activeSessionSchema = z.object({
  id: z.number(),
  tokenHint: z.string().describe("Gợi ý token viết tắt bảo mật"),
  ipAddress: z.string().nullable(),
  userAgent: z.string().nullable(),
  lastActive: z.date().or(z.string()),
});

// --- VALIDATION REQUEST BODY ---
export const updateProfileBodySchema = z.object({
  displayName: z
    .string()
    .min(2, "Tên hiển thị tối thiểu 2 ký tự")
    .max(50, "Tên hiển thị tối đa 50 ký tự")
    .regex(/^[\p{L}\s0-9]+$/u, "Tên hiển thị không được chứa ký tự đặc biệt"),
});

export const changePasswordBodySchema = z
  .object({
    oldPassword: z.string().nonempty("Mật khẩu cũ không được để trống"),
    newPassword: z
      .string()
      .min(8, "Mật khẩu mới tối thiểu 8 ký tự")
      .max(72, "Mật khẩu mới tối đa 72 ký tự"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword !== data.oldPassword, {
    message: "Mật khẩu mới không được trùng với mật khẩu cũ",
    path: ["newPassword"],
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Nhập lại mật khẩu mới không khớp",
    path: ["confirmPassword"],
  });

export const notificationParamSchema = z.object({
  id: z
    .string()
    .regex(/^\d+$/, "Mã thông báo phải là số nguyên dương")
    .describe("ID thông báo"),
});

// --- CHUẨN HÓA MÃ LỖI ĐỒNG BỘ PHÂN HỆ PROFILE ---
export const errorProfile400Schema = z.object({
  success: z.boolean().default(false),
  code: z.string().default("VALIDATION_ERROR"),
  message: z.string(),
});

export const errorProfile401Schema = z.object({
  success: z.boolean().default(false),
  code: z.string().default("UNAUTHORIZED"),
  message: z
    .string()
    .default("Phiên làm việc hết hạn hoặc không có quyền truy cập."),
});

export const errorProfile404Schema = z.object({
  success: z.boolean().default(false),
  code: z.string().default("NOT_FOUND"),
  message: z.string().default("Không tìm thấy dữ liệu yêu cầu."),
});

export type UpdateProfileInput = z.infer<typeof updateProfileBodySchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordBodySchema>;
