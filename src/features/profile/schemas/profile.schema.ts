import { z } from 'zod';

export const updateProfileBodySchema = z.object({
  displayName: z.string()
    .min(2, 'Tên hiển thị tối thiểu 2 ký tự')
    .max(50, 'Tên hiển thị tối đa 50 ký tự')
    .regex(/^[\p{L}\s0-9]+$/u, 'Tên hiển thị không được chứa ký tự đặc biệt')
});

export type UpdateProfileInput = z.infer<typeof updateProfileBodySchema>;

//kiểm tra mật khẩu cũ, mật khẩu mới
export const changePasswordBodySchema = z.object({
  oldPassword: z.string().nonempty('Mật khẩu cũ không được để trống'),
  newPassword: z.string()
    .min(8, 'Mật khẩu mới tối thiểu 8 ký tự')
    .max(72, 'Mật khẩu mới tối đa 72 ký tự'),
  confirmPassword: z.string()
}).refine((data) => data.newPassword !== data.oldPassword, {
  message: "Mật khẩu mới không được trùng với mật khẩu cũ",
  path: ["newPassword"],
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Nhập lại mật khẩu mới không khớp",
  path: ["confirmPassword"],
});

export type ChangePasswordInput = z.infer<typeof changePasswordBodySchema>;