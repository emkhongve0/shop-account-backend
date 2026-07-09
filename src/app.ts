import Fastify, { FastifyInstance } from 'fastify';
import fastifyJwt from '@fastify/jwt';
import fastifyRateLimit from '@fastify/rate-limit';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import authRoutes from './features/auth/auth.routes';
import profileRoutes from './features/profile/profile.routes';
import voucherRoutes from './features/voucher/voucher.routes';
import depositRoutes from './features/deposit/deposit.routes';
import { walletRoutes } from "./features/wallet/wallet.routes";
import { categoryRoutes } from "./features/category/category.routes";
import { productRoutes } from "./features/product/product.routes";
import { inventoryRoutes } from "./features/inventory/inventory.routes";
import { orderRoutes } from "./features/order/order.routes";
import { PrismaClient } from "@prisma/client";
import { notificationRoutes } from "./features/notification/notification.routes";
import { adminUserRoutes } from "./features/user/admin-user.routes";
import { initCleanupJob } from "./jobs/cleanupLog.job";


const app: FastifyInstance = Fastify({
  logger: true // Bật log hệ thống để theo dõi request đầu vào và lỗi
});

const prisma = new PrismaClient();

// Hàm dọn dẹp chạy ngầm, gọi mỗi ngày một lần hoặc khi khởi động server
async function autoCleanupSoldAccounts() {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const deleted = await prisma.orderAccount.deleteMany({
    where: {
      createdAt: { lt: thirtyDaysAgo } // Tìm các hàng tạo trước 30 ngày trước
    }
  });
  console.log(`[BẢO MẬT] Đã tự động xóa sạch ${deleted.count} tài khoản đã giao quá hạn 30 ngày.`);
}

// tự động dọn dẹp các token đã đăng xuất sau 12h
initCleanupJob();

// ĐĂNG KÝ RATE LIMIT TOÀN CỤC
app.register(fastifyRateLimit, {
  max: 100,               // Tối đa 100 request
  timeWindow: '1 minute', // Trong vòng 1 phút
  errorResponseBuilder: (request, context) => {
    return {
      success: false,
      message: `Bạn đang thao tác quá nhanh. Vui lòng thử lại sau ${context.after}.`,
      statusCode: 429
    };
  }
});


// Cấu hình bộ dịch dữ liệu Zod cho Fastify
app.setValidatorCompiler(validatorCompiler);
app.setSerializerCompiler(serializerCompiler);

// Kích hoạt Rate Limit toàn cục (để global: false vì ta tự cấu hình riêng theo từng route)
app.register(fastifyRateLimit, {
  global: false
});

// Cấu hình JWT mã hóa token
app.register(fastifyJwt, {
  secret: process.env.JWT_SECRET || 'sieubao_mat_key_123_!'
});

// Đăng ký tính năng Auth với tiền tố URL: /api/v1/auth
app.register(authRoutes, { prefix: '/api/v1/auth' });

export default app;

// ĐĂNG KÝ PHÂN HỆ PROFILE TẠI ĐÂY:
app.register(profileRoutes, { prefix: '/api/v1/profile' });

// ĐĂNG KÝ PHÂN HỆ VOUCHER
app.register(voucherRoutes, { prefix: '/api/v1/vouchers' });

// ĐĂNG KÝ PHÂN HỆ NẠP TIỀN TỰ ĐỘNG
app.register(depositRoutes, { prefix: '/api/v1/deposits' });

// Đăng ký bên dưới phân đoạn chứa các route khác (như authRoutes, depositRoutes)
app.register(walletRoutes, { prefix: "/api/v1/wallet" });

// Đăng ký chung mâm v1 với ví tiền và nạp tiền
app.register(categoryRoutes, { prefix: "/api/v1/categories" });

// Đăng ký chung mâm v1
app.register(productRoutes, { prefix: "/api/v1" });

app.register(inventoryRoutes, { prefix: "/api/v1" });

app.register(orderRoutes, { prefix: "/api/v1" });

app.register(notificationRoutes, { prefix: "/api/v1" });

app.register(adminUserRoutes, { prefix: "/api/v1" });
