import { PrismaClient, TransactionType } from "@prisma/client";
import { NotificationService } from "../../notification/services/notification.service";

const prisma = new PrismaClient();

export class WalletService {
  /**
   * Lấy số dư hiện tại của User (Giữ nguyên logic gốc)
   */
  static async getBalance(userId: number) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { balance: true },
    });
    if (!user) throw new Error("Người dùng không tồn tại.");
    return user.balance;
  }

  /**
   * Xem lịch sử biến động số dư (Phân trang) (Giữ nguyên logic gốc)
   */
  static async getHistory(
    userId: number,
    page: number = 1,
    limit: number = 10,
  ) {
    const skip = (page - 1) * limit;

    const [transactions, total] = await prisma.$transaction([
      prisma.walletTransaction.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.walletTransaction.count({ where: { userId } }),
    ]);

    return {
      transactions,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * TRỪ TIỀN KHI MUA HÀNG (An toàn tuyệt đối)
   */
  static async processPurchase(
    userId: number,
    totalPrice: number,
    itemDetails: string,
  ) {
    return await prisma.$transaction(async (tx) => {
      // 1. Khóa và đọc dòng dữ liệu user mới nhất
      const user = await tx.user.findUnique({ where: { id: userId } });
      if (!user) throw new Error("Người dùng không tồn tại.");

      // 2. Kiểm tra số dư trước khi mua
      if (user.balance < totalPrice) {
        throw new Error(
          `Không đủ tiền thanh toán. Số dư hiện tại: ${user.balance}, Giá sản phẩm: ${totalPrice}`,
        );
      }

      const balanceBefore = user.balance;
      const balanceAfter = user.balance - totalPrice;

      // 3. Trừ tiền User
      await tx.user.update({
        where: { id: userId },
        data: { balance: balanceAfter },
      });

      // 4. Ghi nhận nhật ký giao dịch ví
      const transaction = await tx.walletTransaction.create({
        data: {
          userId,
          type: TransactionType.BUY,
          amount: totalPrice,
          balanceBefore,
          balanceAfter,
          // Đã loại bỏ referenceId ăn theo mã Order giả định, ghi nhận trực tiếp mã log ví nếu cần
          description: `Thanh toán đơn hàng: ${itemDetails}`,
        },
      });

      // Trả ra balance sau khi trừ để đồng bộ thông tin ví
      return { transactionId: transaction.id, balanceAfter };
    });
  }

  /**
   * ADMIN ĐIỀU CHỈNH SỐ DƯ (Cộng / Trừ tiền tay từ trang quản trị)
   */
  static async adminAdjustBalance(
    userId: number,
    amount: number,
    actionType: "INCREMENT" | "DECREMENT",
    reason: string,
  ) {
    if (amount <= 0) throw new Error("Số tiền điều chỉnh phải lớn hơn 0.");

    // Sử dụng biến bọc ngoài transaction để hứng dữ liệu trả về trước khi bắn thông báo
    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({ where: { id: userId } });
      if (!user) throw new Error("Người dùng không tồn tại.");

      const balanceBefore = user.balance;
      let balanceAfter = user.balance;

      if (actionType === "INCREMENT") {
        balanceAfter += amount;
      } else {
        if (user.balance < amount)
          throw new Error(
            "Số dư tài khoản của user không đủ để thực hiện lệnh trừ.",
          );
        balanceAfter -= amount;
      }

      await tx.user.update({
        where: { id: userId },
        data: { balance: balanceAfter },
      });

      await tx.walletTransaction.create({
        data: {
          userId,
          type:
            actionType === "INCREMENT"
              ? TransactionType.ADMIN_INCREMENT
              : TransactionType.ADMIN_DECREMENT,
          amount: amount,
          balanceBefore,
          balanceAfter,
          description:
            reason ||
            (actionType === "INCREMENT"
              ? "Admin cộng tiền hệ thống"
              : "Admin trừ tiền hệ thống"),
        },
      });

      return { userId, balanceBefore, balanceAfter };
    });

    // 🔥 TÍCH HỢP LUỒNG TỰ ĐỘNG THÔNG BÁO Ở ĐÂY:
    // Đặt ở NGOÀI khối async (tx) để tránh làm chậm hoặc nghẽn giao dịch database (ACID transaction)
    if (actionType === "INCREMENT") {
      try {
        await NotificationService.sendToUser(
          userId,
          "🔔 Số dư thay đổi (Cộng tiền)",
          `Tài khoản của bạn đã được cộng thêm +${amount.toLocaleString()}đ vào ví. Số dư hiện tại: ${result.balanceAfter.toLocaleString()}đ.`,
        );
      } catch (notifError) {
        console.error("Lỗi gửi thông báo nạp tiền:", notifError);
        // Không throw lỗi ở đây để tránh làm rollback giao dịch cộng tiền thành công phía trên
      }
    }

    return result;
  }
}