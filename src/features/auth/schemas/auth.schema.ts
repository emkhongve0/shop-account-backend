import { z } from 'zod';

export const registerBodySchema = z.object({
  displayName: z.string()
    .min(6, 'Tên hiển thị từ 6-30 ký tự')
    .max(30, 'Tên hiển thị từ 6-30 ký tự')
    .refine(val => val.trim() === val, 'Không chứa khoảng trắng đầu/cuối')
    .refine(val => !/^\d+$/.test(val), 'Tên không được toàn số'),
  email: z.string()
    .nonempty('Email không được rỗng')
    .email('Email không đúng định dạng')
    .max(255, 'Email quá dài'),
  password: z.string()
    .min(8, 'Mật khẩu tối thiểu 8 ký tự')
    .max(72, 'Mật khẩu tối đa 72 ký tự'),
  confirmPassword: z.string()
}).refine((data) => data.password === data.confirmPassword, {
  message: "Nhập lại mật khẩu phải giống mật khẩu",
  path: ["confirmPassword"],
});

// Xuất ra kiểu dữ liệu (Type) để dùng ở các file khác nếu cần
export type RegisterInput = z.infer<typeof registerBodySchema>;
//-------------------------------------------//
//login
export const loginBodySchema = z.object({
  email: z.string()
    .nonempty('Email không được rỗng')
    .email('Email không đúng định dạng'),
  password: z.string()
    .nonempty('Mật khẩu không được rỗng')
});

export type LoginInput = z.infer<typeof loginBodySchema>;

//---------------------------------------------------//
//xác thực email
export const verifyEmailQuerySchema = z.object({
  token: z.string().nonempty('Mã xác thực không được để trống')
});

export type VerifyEmailQuery = z.infer<typeof verifyEmailQuerySchema>;

//---------------------------------------//
// 1. Schema cho yêu cầu quên mật khẩu
export const forgotPasswordBodySchema = z.object({
  email: z.string()
    .nonempty('Email không được rỗng')
    .email('Email không đúng định dạng')
});

// 2. Schema cho việc đặt lại mật khẩu mới
export const resetPasswordBodySchema = z.object({
  token: z.string().nonempty('Mã token không được để trống'),
  password: z.string()
    .min(8, 'Mật khẩu tối thiểu 8 ký tự')
    .max(72, 'Mật khẩu tối đa 72 ký tự'),
  confirmPassword: z.string()
}).refine((data) => data.password === data.confirmPassword, {
  message: "Nhập lại mật khẩu phải giống mật khẩu",
  path: ["confirmPassword"],
});

export type ForgotPasswordInput = z.infer<typeof forgotPasswordBodySchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordBodySchema>;
//-----------------------------------------//

// đăng xuất
export const refreshTokenBodySchema = z.object({
  refreshToken: z.string().nonempty('Refresh Token không được để trống')
});

export type RefreshTokenInput = z.infer<typeof refreshTokenBodySchema>;
