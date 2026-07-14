// src/prisma.ts
import { PrismaClient } from "@prisma/client";

// Thiết lập tránh lỗi trùng lặp khi Hot-Reload ở môi trường Development
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Cấu hình log linh hoạt (Stdout tự động gán kiểu ngầm định tương thích với Prisma)
const logOptions =
  process.env.NODE_ENV === "development"
    ? [
        { emit: "stdout" as const, level: "query" as const },
        { emit: "stdout" as const, level: "error" as const },
        { emit: "stdout" as const, level: "warn" as const },
      ]
    : [{ emit: "stdout" as const, level: "error" as const }];

// Khởi tạo Singleton Instance
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: logOptions,
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

/**
 * Các hàm hỗ trợ kiểm tra trạng thái kết nối Database khi khởi chạy Server
 */
export const PrismaHelper = {
  /**
   * Kiểm tra ping tới Database khi server khởi động
   */
  async testConnection() {
    try {
      await prisma.$queryRaw`SELECT 1`;
      console.log(
        "📊 [Prisma Database]: Kết nối tới Cơ sở dữ liệu thành công và ổn định.",
      );
    } catch (error) {
      console.error(
        "❌ [Prisma Database Error]: Không thể kết nối tới Database!",
        error,
      );
      process.exit(1);
    }
  },

  /**
   * Ngắt kết nối an toàn khi tắt ứng dụng
   */
  async disconnect() {
    await prisma.$disconnect();
    console.log("🔌 [Prisma Database]: Đã ngắt kết nối an toàn.");
  },
};
