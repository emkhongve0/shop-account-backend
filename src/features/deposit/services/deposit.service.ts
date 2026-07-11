// src/features/deposit/services/deposit.service.ts
import { PrismaClient } from "@prisma/client";
import * as crypto from "crypto";

const prisma = new PrismaClient();

const BANK_CONFIG = {
  bankBin: process.env.BANK_BIN as string,
  accountNumber: process.env.BANK_ACCOUNT_NUMBER as string,
  accountName: process.env.BANK_ACCOUNT_NAME as string,
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
   * Sinh mã nạp dựa trên ID của User để đảm bảo tính định danh duy nhất, không bao giờ trùng lặp
   * Ví dụ: User ID = 5 -> DEP000005. Đảm bảo độ dài chuỗi cố định và dễ parse regex.
   */
  public static generateUserDepositCode(userId: number): string {
    const pad = String(userId).padStart(6, "0");
    return `DEP${pad}`;
  }

  /**
   * USER LẤY MÃ NẠP ĐỊNH DANH -> KHÔNG TẠO BẢN GHI TRƯỚC, CHỈ TRẢ VỀ QR LÀM SẴN
   */
  static async createDepositRequest(userId: number, method: string) {
    // Sinh mã cố định gắn liền với tài khoản của User suốt đời
    const depositCode = this.generateUserDepositCode(userId);

    const encodeAccountName = encodeURIComponent(BANK_CONFIG.accountName);
    const encodeMemo = encodeURIComponent(depositCode);

    const qrCodeTemplateUrl = `https://img.vietqr.io/image/${BANK_CONFIG.bankBin}-${BANK_CONFIG.accountNumber}-compact2.png?addInfo=${encodeMemo}&accountName=${encodeAccountName}`;

    return {
      id: userId, // Định danh theo ID User
      description: depositCode,
      expiredAt: null, // Không bao giờ hết hạn
      qrCodeUrl: qrCodeTemplateUrl,
      manualPaymentInfo: {
        bankBin: BANK_CONFIG.bankBin,
        accountNumber: BANK_CONFIG.accountNumber,
        accountName: BANK_CONFIG.accountName,
        content: depositCode,
      },
    };
  }

  /**
   * HÀM ĐỐI SOÁT: CHỈ KHI CÓ TIỀN VÀO MỚI TẠO BẢN GHI LỊCH SỬ VỚI TRẠNG THÁI SUCCESS
   */
  static async processAutoDeposit(
    bankTxId: string,
    amount: number,
    emailContent: string,
  ) {
    const match = emailContent.match(/(DEP[0-9]{6})/i);
    if (!match) {
      throw new Error(
        "Mã nội dung nạp tiền không hợp lệ hoặc không có trong email.",
      );
    }
    const depositCode = match[0].toUpperCase();

    // Trích xuất ngược lại User ID từ mã định danh (Ví dụ: DEP000005 -> 5)
    const userId = parseInt(depositCode.replace("DEP", ""), 10);

    return await prisma.$transaction(async (tx) => {
      // 1. Kiểm tra chống trùng lặp dựa trên Mã giao dịch Ngân hàng (bankTxId độc nhất)
      const duplicateTx = await tx.deposit.findUnique({ where: { bankTxId } });
      if (duplicateTx) {
        throw new Error("Giao dịch ngân hàng này đã được xử lý trước đó.");
      }

      // Kiểm tra xem User có tồn tại thực tế trong hệ thống không
      const user = await tx.user.findUnique({ where: { id: userId } });
      if (!user) {
        throw new Error("Người dùng không tồn tại trong hệ thống.");
      }

      // 2. CHỈ TẠO BẢN GHI LỊCH SỬ NẠP KHI THÀNH CÔNG (Mặc định status = SUCCESS)
      const newDeposit = await tx.deposit.create({
        data: {
          userId: user.id,
          amount: amount,
          method: "BANKING",
          status: "SUCCESS", // Trạng thái duy nhất, không có pending/expired
          description: `${depositCode}-${bankTxId}`, // Ghép thêm mã Tx để tránh lỗi trùng @unique trường description cũ
          bankTxId: bankTxId,
          expiredAt: new Date(), // Không giới hạn, lấy thời gian thực hiện làm mốc
        },
      });

      const balanceBefore = user.balance;
      const balanceAfter = user.balance + amount;

      // 3. Cập nhật số dư mới cho User
      await tx.user.update({
        where: { id: user.id },
        data: { balance: balanceAfter },
      });

      // 4. Ghi nhận lịch sử biến động số dư (Wallet Transaction)
      await tx.walletTransaction.create({
        data: {
          userId: user.id,
          type: "DEPOSIT",
          amount: amount,
          balanceBefore,
          balanceAfter,
          referenceId: depositCode,
          description: `Nạp tiền tự động thành công qua QR định danh (Mã GD: ${bankTxId})`,
        },
      });

      return {
        id: newDeposit.id,
        userId: user.id,
        depositCode,
        amount,
        balanceAfter,
      };
    });
  }
}
