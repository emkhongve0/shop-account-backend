import { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { registerBodySchema, loginBodySchema, verifyEmailQuerySchema, forgotPasswordBodySchema, resetPasswordBodySchema, refreshTokenBodySchema } from './schemas/auth.schema';
import { registerHandler, loginHandler, verifyEmailHandler, forgotPasswordHandler, resetPasswordHandler, refreshTokenHandler, logoutHandler } from './controllers/auth.controller';

export default async function authRoutes(fastify: FastifyInstance) {
  
  // Rate limit cho đăng ký
  const registerRateLimit = {
    max: 5,
    timeWindow: '1 minute',
    errorResponseBuilder: () => ({ success: false, message: 'Quá nhiều yêu cầu. Vui lòng thử lại sau.' })
  };

  // Rate limit cho đăng nhập
  const loginRateLimit = {
    max: 10,
    timeWindow: '1 minute',
    errorResponseBuilder: () => ({ success: false, message: 'Thao tác quá nhanh. Vui lòng thử lại sau 1 phút.' })
  };

  const commonRateLimit = {
    max: 3,
    timeWindow: '1 minute',
    errorResponseBuilder: () => ({ success: false, message: 'Thao tác quá nhanh. Vui lòng thử lại sau.' })
  };

  // 1. Tuyến đường Đăng ký
  fastify.withTypeProvider<ZodTypeProvider>().post(
    '/register',
    { 
      config: { rateLimit: registerRateLimit }, 
      schema: { body: registerBodySchema } 
    },
    registerHandler
  );

  // 2. Tuyến đường Đăng nhập (Kiểm tra kỹ xem có dòng này chưa bạn nhé)
  fastify.withTypeProvider<ZodTypeProvider>().post(
    '/login',
    {
      config: { rateLimit: loginRateLimit },
      schema: { body: loginBodySchema }
    },
    loginHandler
  );

  // Route Xác thực Email Mới (Sử dụng phương thức GET)
  fastify.withTypeProvider<ZodTypeProvider>().get(
    '/verify-email',
    {
      schema: {
        querystring: verifyEmailQuerySchema // Ép kiểm tra token truyền lên URL
      }
    },
    verifyEmailHandler
  );

  // 1. API Gửi yêu cầu quên mật khẩu
  fastify.withTypeProvider<ZodTypeProvider>().post(
    '/forgot-password',
    { config: { rateLimit: commonRateLimit }, schema: { body: forgotPasswordBodySchema } },
    forgotPasswordHandler
  );

  // 2. API Cập nhật lại mật khẩu mới
  fastify.withTypeProvider<ZodTypeProvider>().post(
    '/reset-password',
    { config: { rateLimit: commonRateLimit }, schema: { body: resetPasswordBodySchema } },
    resetPasswordHandler
  );


  // 1. API Đăng xuất
  fastify.withTypeProvider<ZodTypeProvider>().post(
    '/logout',
    { schema: { body: refreshTokenBodySchema } },
    logoutHandler
  );

  // 2. API Gia hạn Access Token
  fastify.withTypeProvider<ZodTypeProvider>().post(
    '/refresh-token',
    { schema: { body: refreshTokenBodySchema } },
    refreshTokenHandler
  );
}