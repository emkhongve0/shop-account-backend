import cron from "node-cron";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const initCleanupJob = () => {
  // Cấu hình chạy mỗi 12 giờ một lần (Cú pháp: Phút Giờ Ngày Tháng Thứ)
  // '0 */12 * * *' nghĩa là cứ cách 12 tiếng (ví dụ 0h và 12h) sẽ chạy
  cron.schedule("0 */12 * * *", async () => {
    console.log(
      "🧹 [Cron Job] Bắt đầu dọn dẹp danh sách token đã đăng xuất...",
    );

    try {
      const expirationLimit = new Date();
      // Vì token chỉ sống 30 phút, nên cứ bản ghi nào cũ hơn 30 phút là xóa được rồi
      expirationLimit.setMinutes(expirationLimit.getMinutes() - 30);

      const deleteResult = await prisma.authLog.deleteMany({
        where: {
          action: "LOGOUT_SUCCESS",
          userAgent: {
            startsWith: "REVOKED_",
          },
          createdAt: {
            lt: expirationLimit, // Xóa sạch các bản ghi đã tạo trước đó hơn 30 phút
          },
        },
      });

      console.log(
        `✅ [Cron Job] Định kỳ 12h hoàn tất! Đã giải phóng ${deleteResult.count} dòng log thừa.`,
      );
    } catch (error) {
      console.error("❌ [Cron Job] Lỗi dọn dẹp:", error);
    }
  });
};
