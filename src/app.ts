import Fastify, { FastifyInstance } from "fastify";
import fastifyJwt from "@fastify/jwt";
import fastifyRateLimit from "@fastify/rate-limit";
import {
  serializerCompiler,
  validatorCompiler,
} from "fastify-type-provider-zod";
import authRoutes from "./features/auth/auth.routes";
import profileRoutes from "./features/profile/profile.routes";
import voucherRoutes from "./features/voucher/voucher.routes";
import depositRoutes from "./features/deposit/deposit.routes";
import { walletRoutes } from "./features/wallet/wallet.routes";
import { categoryRoutes } from "./features/category/category.routes";
import { productRoutes } from "./features/product/product.routes";
import { inventoryRoutes } from "./features/inventory/inventory.routes";
import { orderRoutes } from "./features/order/order.routes";
import { PrismaClient } from "@prisma/client";
import { notificationRoutes } from "./features/notification/notification.routes";
import { adminUserRoutes } from "./features/user/admin-user.routes";
import { initCleanupJob } from "./jobs/cleanupLog.job";
import cors from "@fastify/cors";
import fastifyWebsocket from "@fastify/websocket"; // <-- THÊM MỚI LINE NÀY

const app: FastifyInstance = Fastify({
  logger: true,
});

// 1. Đăng ký Cấu hình CORS bảo mật đa kênh
app.register(cors, {
  origin: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
});

// 2. Đăng ký Plugin WebSocket của Fastify hệ thống (Quan trọng: Đặt TRƯỚC khi đăng ký các route phân hệ)
app.register(fastifyWebsocket);

// 3. Khởi tạo một bộ nhớ Map dùng chung toàn cục để lưu trữ Socket của từng User theo ID tài khoản
export const websocketClients = new Map<number, any>();

// 4. Mở cổng định tuyến sự kiện WebSocket lắng nghe từ Frontend kết nối lên
app.register(async function (fastify) {
  fastify.get("/ws/deposit", { websocket: true }, (connection, req) => {
    const urlParams = new URLSearchParams(req.url.split("?")[1]);
    const userId = Number(urlParams.get("userId"));

    if (userId && !isNaN(userId)) {
      // ĐÚNG CHUẨN: Bản thân connection chính là socket stream, hoặc lấy qua connection.socket tùy phiên bản.
      // Giải pháp an toàn nhất: Thử lấy connection.socket trước, nếu không có thì dùng chính connection
      const socket = connection.socket ? connection.socket : connection;

      websocketClients.set(userId, socket);
      fastify.log.info(
        `🔌 [WEBSOCKET] Tài khoản ID: ${userId} đã mở kết nối thành công.`,
      );

      // FIX LỖI (reading 'on'): Đăng ký sự kiện close trên đối tượng socket vừa tìm được
      socket.on("close", () => {
        websocketClients.delete(userId);
        fastify.log.info(
          `❌ [WEBSOCKET] Tài khoản ID: ${userId} đã ngắt kết nối.`,
        );
      });
    }
  });
});

const prisma = new PrismaClient();

// Hàm dọn dẹp chạy ngầm, gọi mỗi ngày một lần hoặc khi khởi động server
async function autoCleanupSoldAccounts() {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const deleted = await prisma.orderAccount.deleteMany({
    where: {
      createdAt: { lt: thirtyDaysAgo },
    },
  });
  console.log(
    `[BẢO MẬT] Đã tự động xóa sạch ${deleted.count} tài khoản đã giao quá hạn 30 ngày.`,
  );
}

// tự động dọn dẹp các token đã đăng xuất sau 12h
initCleanupJob();

// ĐĂNG KÝ RATE LIMIT TOÀN CỤC
app.register(fastifyRateLimit, {
  max: 100,
  timeWindow: "1 minute",
  errorResponseBuilder: (request, context) => {
    return {
      success: false,
      message: `Bạn đang thao tác quá nhanh. Vui lòng thử lại sau ${context.after}.`,
      statusCode: 429,
    };
  },
});

app.setValidatorCompiler(validatorCompiler);
app.setSerializerCompiler(serializerCompiler);

app.register(fastifyRateLimit, {
  global: false,
});

app.register(fastifyJwt, {
  secret: process.env.JWT_SECRET || "sieubao_mat_key_123_!",
});

// Đăng ký các phân hệ tuyến đường hệ thống
app.register(authRoutes, { prefix: "/api/v1/auth" });
app.register(profileRoutes, { prefix: "/api/v1/profile" });
app.register(voucherRoutes, { prefix: "/api/v1/vouchers" });
app.register(depositRoutes, { prefix: "/api/v1/deposits" }); // Phân hệ nạp tiền
app.register(walletRoutes, { prefix: "/api/v1/wallet" });
app.register(categoryRoutes, { prefix: "/api/v1/categories" });
app.register(productRoutes, { prefix: "/api/v1" });
app.register(inventoryRoutes, { prefix: "/api/v1" });
app.register(orderRoutes, { prefix: "/api/v1" });
app.register(notificationRoutes, { prefix: "/api/v1" });
app.register(adminUserRoutes, { prefix: "/api/v1" });

export default app;
