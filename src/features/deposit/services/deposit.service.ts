// src/features/deposit/services/deposit.service.ts
import { TransactionType } from "@prisma/client"; // Import Enum chuẩn từ Prisma Client
import { prisma } from "../../../shared/prisma"; // Sử dụng Singleton Prisma Client dùng chung

const BANK_CONFIG = {
  bankBin: process.env.BANK_BIN as string,
  accountNumber: process.env.BANK_ACCOUNT_NUMBER as string,
  accountName: process.env.BANK_ACCOUNT_NAME as string,
  // Cấu hình số tiền nạp tối thiểu (Mặc định là 10,000 VND nếu không cấu hình trong .env)
  minDepositAmount: Number(process.env.MIN_DEPOSIT_AMOUNT) || 10000,
};

if (
  !BANK_CONFIG.bankBin ||
  !BANK_CONFIG.accountNumber ||
  !BANK_CONFIG.accountName
) {
  throw new Error(
    "❌ [Cấu hình lỗi]: Thiếu thông tin BANK_BIN, BANK_ACCOUNT_NUMBER hoặc BANK_ACCOUNT_NAME trong file .env!",
  );
}

export class DepositService {
  /**
   * Sinh mã nạp dựa trên ID của User để đảm bảo tính định danh duy nhất
   * Ví dụ: User ID = 5 -> DEP000005
   */
  public static generateUserDepositCode(userId: number): string {
    const pad = String(userId).padStart(6, "0");
    return `DEP${pad}`;
  }

  /**
   * USER LẤY MÃ NẠP ĐỊNH DANH -> KHÔNG TẠO BẢN GHI TRƯỚC, CHỈ TRẢ VỀ QR LÀM SẴN
   */
  public static async createDepositRequest(userId: number, method: string) {
    const depositCode = this.generateUserDepositCode(userId);

    // Sinh link QR động chuẩn VietQR định danh theo User ID
    const qrCodeUrl = `https://img.vietqr.io/image/${BANK_CONFIG.bankBin}-${BANK_CONFIG.accountNumber}-qr_only.png?addMerchant=1&accountName=${encodeURIComponent(BANK_CONFIG.accountName)}&amount=0&addInfo=${depositCode}`;

    return {
      id: `DEP-REQ-${userId}-${Date.now()}`, // Tạo ID tạm thời phục vụ response client
      description: depositCode,
      qrCodeUrl: qrCodeUrl,
      manualPaymentInfo: {
        bankBin: BANK_CONFIG.bankBin,
        accountNumber: BANK_CONFIG.accountNumber,
        accountName: BANK_CONFIG.accountName,
        amount: null,
        description: depositCode,
      },
    };
  }

  /**
   * ENGINE XỬ LÝ NẠP TIỀN TỰ ĐỘNG (Webhook đối soát giao dịch thực tế)
   */
  public static async processAutoDeposit(
    bankTxId: string,
    amount: number,
    transactionRemark: string,
  ) {
    // 1. Kiểm tra số tiền nạp tối thiểu hợp lệ
    if (amount < BANK_CONFIG.minDepositAmount) {
      throw new Error(
        `Số tiền nạp tối thiểu là ${BANK_CONFIG.minDepositAmount.toLocaleString("vi-VN")}đ. Giao dịch ${bankTxId} (${amount}đ) không đủ điều kiện xử lý tự động.`,
      );
    }

    // 2. Trích xuất mã nạp định danh từ nội dung chuyển khoản
    const match = transactionRemark.match(/\bDEP([0-9]{6})\b/i);
    if (!match) {
      throw new Error(
        `Nội dung chuyển khoản không chứa mã nạp hợp lệ (DEPxxxxxx).`,
      );
    }

    const depositCode = match[0].toUpperCase(); // Ví dụ: DEP000005
    const userIdFromCode = parseInt(match[1], 10); // Lấy ra ID dạng số: 5

    // 3. Thực thi transaction an toàn tuyệt đối chống Race Condition & Double-Spending
    return await prisma.$transaction(async (tx) => {
      // BƯỚC A: Chặn trùng giao dịch tuyệt đối (Idempotency Check) ở cấp Database [cite: 45, 46]
      const duplicateTx = await tx.deposit.findUnique({
        where: { bankTxId: bankTxId },
      });

      if (duplicateTx) {
        throw new Error(
          `Mã giao dịch ngân hàng ${bankTxId} đã được xử lý nạp tiền trước đó.`,
        );
      }

      // BƯỚC B: Tìm thông tin User để lấy số dư trước nạp
      const user = await tx.user.findUnique({
        where: { id: userIdFromCode },
      });

      if (!user) {
        throw new Error(
          `Không tìm thấy thành viên sở hữu mã nạp ${depositCode} trong hệ thống.`,
        );
      }

      // Ép kiểu đảm bảo tính toán đồng bộ dữ liệu
      const balanceBefore = Number(user.balance); // user.balance là Int trong schema
      const balanceAfter = balanceBefore + amount;

      // BƯỚC C: Cập nhật tăng số dư mới an toàn bằng cơ chế Atomic update (Tránh Race Condition)
      const updatedUser = await tx.user.update({
        where: { id: user.id },
        data: {
          balance: {
            increment: amount, // Tăng trực tiếp tại database, không cộng tay ngoài NodeJS
          },
        },
      });

      const actualBalanceAfter = Number(updatedUser.balance);

      // BƯỚC D: Tạo bản ghi lịch sử nạp tiền thành công (Deposit model) [cite: 44, 45, 47]
      await tx.deposit.create({
        data: {
          userId: user.id,
          amount: amount, // Kiểu Int khớp với schema.prisma
          method: "BANKING",
          status: "SUCCESS", // Trạng thái SUCCESS
          description: `${depositCode}-${bankTxId}`, // Trường unique
          bankTxId: bankTxId, // Trường unique
          expiredAt: new Date(), // Lấy thời gian thực hiện làm mốc
          balanceBefore: balanceBefore, // Lưu dưới dạng Float? khớp với schema.prisma [cite: 47]
          balanceAfter: actualBalanceAfter, // Lưu dưới dạng Float? khớp với schema.prisma [cite: 47]
        },
      });

      // BƯỚC E: Ghi nhận lịch sử biến động số dư (WalletTransaction model) [cite: 38, 39, 40, 41]
      await tx.walletTransaction.create({
        data: {
          userId: user.id,
          type: TransactionType.DEPOSIT, // Sử dụng Enum TransactionType.DEPOSIT chuẩn hóa
          amount: amount, // Kiểu Int
          balanceBefore: balanceBefore, // Kiểu Float khớp với schema.prisma
          balanceAfter: actualBalanceAfter, // Kiểu Float khớp với schema.prisma
          referenceId: depositCode, // Mã đơn nạp [cite: 40]
          description: `Nạp tiền tự động thành công qua QR định danh (Mã GD: ${bankTxId})`, // [cite: 41]
        },
      });

      // Trả về dữ liệu chi tiết cho controller sử dụng để log và bắn WebSocket
      return {
        userId: user.id,
        depositCode: depositCode,
        balanceAfter: actualBalanceAfter,
      };
    });
  }
}
