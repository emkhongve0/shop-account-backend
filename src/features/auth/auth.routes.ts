import { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import {
  registerBodySchema,
  loginBodySchema,
  verifyEmailQuerySchema,
  forgotPasswordBodySchema,
  resetPasswordBodySchema,
  refreshTokenBodySchema,
  successCommonResponseSchema,
  errorEmailExistsSchema,
  errorInvalidCredentialsSchema,
  errorAccountUnverifiedSchema,
  errorTokenExpiredSchema,
  errorTokenRevokedSchema,
  error429ResponseSchema,
} from "./schemas/auth.schema";
import {
  registerHandler,
  loginHandler,
  verifyEmailHandler,
  forgotPasswordHandler,
  resetPasswordHandler,
  refreshTokenHandler,
  logoutHandler,
} from "./controllers/auth.controller";
import { z } from "zod";

export default async function authRoutes(fastify: FastifyInstance) {
  const registerRateLimit = {
    max: 3,
    timeWindow: "1 minute",
    errorResponseBuilder: (_: any, { after }: any) => ({
      success: false,
      code: "TOO_MANY_REQUESTS",
      message: `Quá nhiều yêu cầu đăng ký. Vui lòng thử lại sau ${after}.`,
    }),
  };

  const loginRateLimit = {
    max: 5,
    timeWindow: "1 minute",
    errorResponseBuilder: (_: any, { after }: any) => ({
      success: false,
      code: "TOO_MANY_REQUESTS",
      message: `Thao tác đăng nhập quá nhanh. Vui lòng thử lại sau ${after}.`,
    }),
  };

  const commonRateLimit = {
    max: 3,
    timeWindow: "1 minute",
    errorResponseBuilder: (_: any, { after }: any) => ({
      success: false,
      code: "TOO_MANY_REQUESTS",
      message: `Thao tác quá nhanh. Vui lòng thử lại sau ${after}.`,
    }),
  };

  // 1. Tuyến đường Đăng ký
  fastify.withTypeProvider<ZodTypeProvider>().post(
    "/register",
    {
      config: { rateLimit: registerRateLimit }, // Logic gốc được giữ nguyên vẹn
      schema: {
        tags: ["Authentication & Session"],
        summary: "Đăng ký tài khoản người dùng",
        description:
          "Tạo tài khoản mới trạng thái PENDING, mã hóa Argon2 mật khẩu để tối ưu hiệu năng và bảo mật.", // Cập nhật mô tả sang Argon2 cho chính xác với thực tế
        body: registerBodySchema,
        response: {
          201: successCommonResponseSchema,
          400: errorEmailExistsSchema,
          429: error429ResponseSchema, // Trả về lỗi 429 khi hacker spam quá 3 lần/phút
        },
      } as any,
    },
    registerHandler,
  );

  // 2. Tuyến đường Đăng nhập
  fastify.withTypeProvider<ZodTypeProvider>().post(
    "/login",
    {
      config: { rateLimit: loginRateLimit },
      schema: {
        tags: ["Authentication & Session"],
        summary: "Đăng nhập hệ thống lấy cặp Token",
        description:
          "Xác thực thông tin người dùng. Cấp Access Token (30 phút) và Refresh Token (7 ngày).",
        body: loginBodySchema,
        response: {
          200: z.object({
            success: z.boolean().default(true),
            message: z.string().default("Đăng nhập thành công."),
            data: z.object({
              accessToken: z.string(),
              refreshToken: z.string(),
              user: z.object({
                id: z.number(),
                displayName: z.string(),
                email: z.string(),
                status: z.string(),
                role: z.string(),
              }),
            }),
          }),
          400: errorInvalidCredentialsSchema,
          403: errorAccountUnverifiedSchema,
          429: error429ResponseSchema,
        },
      } as any,
    },
    loginHandler,
  );

  // 3. Route Xác thực Email
  fastify.withTypeProvider<ZodTypeProvider>().get(
    "/verify-email",
    {
      schema: {
        tags: ["Authentication & Session"],
        summary: "Xác thực tài khoản qua link kích hoạt Email",
        description: "Giải mã JWT, đổi trạng thái User từ PENDING sang ACTIVE.",
        querystring: verifyEmailQuerySchema,
        response: {
          200: successCommonResponseSchema,
          400: errorTokenExpiredSchema,
        },
      } as any,
    },
    verifyEmailHandler,
  );

  // 4. API Gửi yêu cầu quên mật khẩu
  fastify.withTypeProvider<ZodTypeProvider>().post(
    "/forgot-password",
    {
      config: { rateLimit: commonRateLimit },
      schema: {
        tags: ["Authentication & Session"],
        summary: "Yêu cầu khôi phục lại mật khẩu qua email",
        description:
          "Kiểm tra tài khoản, sinh token khôi phục mật khẩu ngắn (15 phút).",
        body: forgotPasswordBodySchema,
        response: {
          200: successCommonResponseSchema,
          429: error429ResponseSchema,
        },
      } as any,
    },
    forgotPasswordHandler,
  );

  // 5. API Cập nhật lại mật khẩu mới
  fastify.withTypeProvider<ZodTypeProvider>().post(
    "/reset-password",
    {
      config: { rateLimit: commonRateLimit },
      schema: {
        tags: ["Authentication & Session"],
        summary: "Cập nhật mật khẩu mới bằng token khôi phục",
        description:
          'Giải mã kiểm tra thời hạn và kiểm tra bắt buộc mục đích purpose === "reset_password".',
        body: resetPasswordBodySchema,
        response: {
          200: successCommonResponseSchema,
          400: errorTokenExpiredSchema,
          429: error429ResponseSchema,
        },
      } as any,
    },
    resetPasswordHandler,
  );

  // 6. API Đăng xuất
  fastify.withTypeProvider<ZodTypeProvider>().post(
    "/logout",
    {
      schema: {
        tags: ["Authentication & Session"],
        summary: "Đăng xuất tài khoản",
        description:
          "Vô hiệu hóa phiên hiện tại bằng cách tạo một bản ghi chặn lưu vết 30 ký tự cuối của Access Token.",
        body: refreshTokenBodySchema,
        headers: z
          .object({
            authorization: z.string().optional(),
          })
          .passthrough(),
        response: {
          200: successCommonResponseSchema,
        },
      } as any,
    },
    logoutHandler,
  );

  // 7. API Gia hạn Access Token
  fastify.withTypeProvider<ZodTypeProvider>().post(
    "/refresh-token",
    {
      schema: {
        tags: ["Authentication & Session"],
        summary: "Làm mới Access Token (Gia hạn phiên làm việc)",
        description:
          "Xác thực chuỗi Refresh Token. Đối chiếu nhật ký hệ thống phòng chống replay attack.",
        body: refreshTokenBodySchema,
        response: {
          200: z.object({
            success: z.boolean().default(true),
            message: z.string().default("Gia hạn token thành công."),
            data: z.object({
              accessToken: z.string(),
            }),
          }),
          401: errorTokenRevokedSchema,
          403: errorAccountUnverifiedSchema,
        },
      } as any,
    },
    refreshTokenHandler,
  );
}
