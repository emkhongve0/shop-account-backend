import { z } from "zod";

// --- ĐĂNG KÝ (REGISTER) ---
export const registerBodySchema = z
  .object({
    displayName: z
      .string()
      .min(6, "Tên hiển thị từ 6-30 ký tự")
      .max(30, "Tên hiển thị từ 6-30 ký tự")
      .refine((val) => val.trim() === val, "Không chứa khoảng trắng đầu/cuối")
      .refine((val) => !/^\d+$/.test(val), "Tên không được toàn số")
      .describe("Tên hiển thị của người dùng mới"),
    email: z
      .string()
      .nonempty("Email không được rỗng")
      .email("Email không đúng định dạng")
      .max(255, "Email quá dài")
      .describe(
        "Địa chỉ Email duy nhất. Hệ thống sẽ tự động loại bỏ dấu '.' và '+...' nếu là Gmail.",
      ),
    password: z
      .string()
      .min(8, "Mật khẩu tối thiểu 8 ký tự")
      .max(72, "Mật khẩu tối đa 72 ký tự")
      .describe("Mật khẩu đăng nhập hệ thống"),
    confirmPassword: z
      .string()
      .describe("Xác nhận lại mật khẩu phải trùng khớp"),
    // 🔥 THÊM VÀO ĐÂY: Trường captchaToken bắt buộc gửi từ Frontend lên
    captchaToken: z
      .string({
        required_error: "Thiếu mã xác thực Captcha",
      })
      .min(1, "Mã Captcha không được để trống")
      .describe("Mã token Cloudflare Turnstile sinh ra từ frontend"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Nhập lại mật khẩu phải giống mật khẩu",
    path: ["confirmPassword"],
  });

export type RegisterInput = z.infer<typeof registerBodySchema>;

// --- ĐĂNG NHẬP (LOGIN) ---
export const loginBodySchema = z.object({
  email: z
    .string()
    .nonempty("Email không được rỗng")
    .trim()
    .toLowerCase()
    .email("Email không đúng định dạng")
    .describe("Email đăng nhập"),
  password: z
    .string()
    .nonempty("Mật khẩu không được rỗng")
    .describe("Mật khẩu tài khoản"),
});

export type LoginInput = z.infer<typeof loginBodySchema>;

// --- XÁC THỰC EMAIL ---
export const verifyEmailQuerySchema = z.object({
  token: z
    .string()
    .nonempty("Mã xác thực không được để trống")
    .describe("Mã kích hoạt dạng JWT gửi qua hòm thư"),
});

export type VerifyEmailQuery = z.infer<typeof verifyEmailQuerySchema>;

// --- QUÊN MẬT KHẨU ---
export const forgotPasswordBodySchema = z.object({
  email: z
    .string()
    .nonempty("Email không được rỗng")
    .trim()
    .toLowerCase()
    .email("Email không đúng định dạng")
    .describe("Email nhận link reset"),
});

export type ForgotPasswordInput = z.infer<typeof forgotPasswordBodySchema>;

// --- ĐẶT LẠI MẬT KHẨU MỚI ---
export const resetPasswordBodySchema = z
  .object({
    token: z
      .string()
      .nonempty("Mã token không được để trống")
      .describe("Mã xác nhận khôi phục mật khẩu nhận từ Email"),
    password: z
      .string()
      .min(8, "Mật khẩu tối thiểu 8 ký tự")
      .max(72, "Mật khẩu tối đa 72 ký tự")
      .describe("Mật khẩu mới"),
    confirmPassword: z.string().describe("Xác nhận mật khẩu mới"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Nhập lại mật khẩu phải giống mật khẩu",
    path: ["confirmPassword"],
  });

export type ResetPasswordInput = z.infer<typeof resetPasswordBodySchema>;

// --- REFRESH TOKEN VÀ LOGOUT ---
export const refreshTokenBodySchema = z.object({
  refreshToken: z
    .string()
    .nonempty("Refresh Token không được để trống")
    .describe("Chuỗi Refresh Token được cấp khi Login"),
});

export type RefreshTokenInput = z.infer<typeof refreshTokenBodySchema>;

// =========================================================================
// CHUẨN HÓA CẤU TRÚC PHẢN HỒI LỖI DOANH NGHIỆP (ENTERPRISE STANDARD RESPONSES)
// =========================================================================

export const successCommonResponseSchema = z.object({
  success: z.boolean().default(true).describe("Trạng thái thành công"),
  message: z.string().describe("Thông báo kết quả xử lý thành công"),
});

// 1. Định nghĩa Schema lỗi 400 cụ thể cho trường hợp Trùng Email (Register)
export const errorEmailExistsSchema = z
  .object({
    success: z.boolean().default(false),
    code: z
      .string()
      .default("EMAIL_EXISTS")
      .describe("Mã định danh lỗi phân hệ hệ thống"),
    message: z
      .string()
      .default("Email đã được sử dụng.")
      .describe("Thông báo lỗi chi tiết"),
  })
  .describe("Trường hợp Email đăng ký bị trùng lặp");

// 2. Định nghĩa Schema lỗi 400 cụ thể cho trường hợp Sai thông tin mật khẩu (Login)
export const errorInvalidCredentialsSchema = z
  .object({
    success: z.boolean().default(false),
    code: z.string().default("INVALID_CREDENTIALS"),
    message: z.string().default("Tài khoản hoặc mật khẩu không chính xác."),
  })
  .describe("Sai thông tin tài khoản hoặc mật khẩu đăng nhập");

// 3. Định nghĩa Schema lỗi 403 cho trường hợp tài khoản chưa kích hoạt
export const errorAccountUnverifiedSchema = z
  .object({
    success: z.boolean().default(false),
    code: z.string().default("AUTH_ACCOUNT_UNVERIFIED"),
    message: z
      .string()
      .default("Tài khoản chưa được kích hoạt thông qua Email."),
  })
  .describe("Tài khoản đang trạng thái PENDING chưa xác thực");

// 4. Định nghĩa Schema lỗi 400 cho trường hợp Token kích hoạt/khôi phục bị hết hạn
export const errorTokenExpiredSchema = z
  .object({
    success: z.boolean().default(false),
    code: z.string().default("TOKEN_EXPIRED"),
    message: z
      .string()
      .default("Mã xác thực/khôi phục đã hết hạn hoặc không hợp lệ."),
  })
  .describe("Mã Token hết hạn sử dụng");

// 5. Định nghĩa Schema lỗi 401 khi Token bị thu hồi (Logout rồi)
export const errorTokenRevokedSchema = z
  .object({
    success: z.boolean().default(false),
    code: z.string().default("AUTH_TOKEN_REVOKED"),
    message: z
      .string()
      .default(
        "Phiên làm việc đã kết thúc do người dùng đã thực hiện Đăng xuất.",
      ),
  })
  .describe("Token đã bị vô hiệu hóa chéo trên hệ thống");

// 6. Định nghĩa Schema lỗi 429 vượt ngưỡng tần suất (Rate Limit)
export const error429ResponseSchema = z
  .object({
    success: z.boolean().default(false),
    code: z.string().default("TOO_MANY_REQUESTS"),
    message: z
      .string()
      .default("Thao tác quá nhanh. Vui lòng thử lại sau ít phút."),
  })
  .describe("Vượt quá tần suất gửi yêu cầu cho phép");


  // 💡 THÊM VÀO ĐÂY: Thêm schema phản hồi cho trường hợp xác thực Captcha thất bại
export const errorCaptchaFailedResponseSchema = z
  .object({
    success: z.boolean().default(false),
    code: z.string().default("AUTH_CAPTCHA_FAILED"),
    message: z
      .string()
      .default("Mã xác thực an toàn không hợp lệ hoặc đã hết hạn (Turnstile)."),
  })
  .describe("Yêu cầu bị hệ thống từ chối do phát hiện nghi vấn bot tự động");