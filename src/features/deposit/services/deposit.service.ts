// src/features/deposit/services/deposit.service.ts
import { PrismaClient, TransactionType } from "@prisma/client";
import * as crypto from "crypto";

const prisma = new PrismaClient();

// Đọc cấu hình từ file .env
const BANK_CONFIG = {
  bankBin: process.env.BANK_BIN as string, // Ví dụ: 970446
  accountNumber: process.env.BANK_ACCOUNT_NUMBER as string, // Ví dụ: 1234567890
  accountName: process.env.BANK_ACCOUNT_NAME as string, // Ví dụ: NGUYEN XUAN THINH
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
   * Tạo mã nạp ngẫu nhiên dạng DEPXXXXXX
   */
  private static generateDepositCode(): string {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let code = "";
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(crypto.randomInt(0, chars.length));
    }
    return `DEP${code}`;
  }

  /**
   * USER BẤM NẠP TIỀN -> TẠO REQUEST PENDING & SINH LINK VIETQR
   */
  static async createDepositRequest(userId: number, method: string) {
    let depositCode = this.generateDepositCode();

    let isExist = await prisma.deposit.findUnique({
      where: { description: depositCode },
    });
    while (isExist) {
      depositCode = this.generateDepositCode();
      isExist = await prisma.deposit.findUnique({
        where: { description: depositCode },
      });
    }

    const expiredAt = new Date(Date.now() + 10 * 60 * 1000);

    const depositRequest = await prisma.deposit.create({
      data: {
        userId,
        method,
        description: depositCode,
        status: "PENDING",
        expiredAt,
      },
    });

    // Tạo link ảnh VietQR động theo chuẩn API VietQR.io
    // Định dạng: https://img.vietqr.io/image/<MÃ_BIN>-<SỐ_TÀI_KHOẢN>-<MẪU_GIAO_DIỆN>.png?addInfo=<NỘI_DUNG>&accountName=<TÊN_CHỦ_TK>
    // Mẫu ảnh sử dụng: 'compact2' (Mẫu QR tối giản kèm logo ngân hàng, rất đẹp và gọn)
    const encodeAccountName = encodeURIComponent(BANK_CONFIG.accountName);
    const encodeMemo = encodeURIComponent(depositCode);

    const qrCodeTemplateUrl = `https://img.vietqr.io/image/${BANK_CONFIG.bankBin}-${BANK_CONFIG.accountNumber}-compact2.png?addInfo=${encodeMemo}&accountName=${encodeAccountName}`;

    return {
      id: depositRequest.id,
      description: depositRequest.description,
      expiredAt: depositRequest.expiredAt,
      // Trả về dạng Link ảnh URL thay vì chuỗi Base64 dài dòng
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
   * HÀM ĐỐI SOÁT VÀ CỘNG TIỀN TỰ ĐỘNG (ĐÃ CẬP NHẬT LỊCH SỬ VÍ)
   */
  static async processAutoDeposit(
    bankTxId: string,
    amount: number,
    emailContent: string,
  ) {
    const match = emailContent.match(/(DEP[A-Z0-9]{6})/i);
    if (!match) {
      throw new Error(
        "Mã nội dung nạp tiền không hợp lệ hoặc không có trong email.",
      );
    }
    const depositCode = match[0].toUpperCase();

    return await prisma.$transaction(async (tx) => {
      const duplicateTx = await tx.deposit.findUnique({ where: { bankTxId } });
      if (duplicateTx) {
        throw new Error("Giao dịch ngân hàng này đã được xử lý trước đó.");
      }

      const depositRequest = await tx.deposit.findUnique({
        where: { description: depositCode },
      });
      if (!depositRequest) {
        throw new Error(
          "Không tìm thấy yêu cầu nạp tiền tương ứng với mã này.",
        );
      }

      if (depositRequest.status !== "PENDING") {
        throw new Error(
          `Yêu cầu nạp tiền này đã ở trạng thái: ${depositRequest.status}`,
        );
      }

      if (new Date() > new Date(depositRequest.expiredAt)) {
        await tx.deposit.update({
          where: { id: depositRequest.id },
          data: { status: "EXPIRED" },
        });
        throw new Error("Yêu cầu nạp tiền đã quá thời gian 10 phút quy định.");
      }

      // 1. Cập nhật trạng thái đơn nạp tiền
      await tx.deposit.update({
        where: { id: depositRequest.id },
        data: {
          status: "SUCCESS",
          amount: amount,
          bankTxId: bankTxId,
        },
      });

      // 2. Khóa và lấy thông tin user hiện tại để tính toán số dư chính xác
      const user = await tx.user.findUnique({
        where: { id: depositRequest.userId },
      });
      if (!user) {
        throw new Error("Người dùng không tồn tại trong hệ thống.");
      }

      const balanceBefore = user.balance;
      const balanceAfter = user.balance + amount;

      // 3. Cập nhật số dư mới cho User
      await tx.user.update({
        where: { id: depositRequest.userId },
        data: { balance: balanceAfter },
      });

      // 4. Ghi nhận lịch sử biến động số dư (Wallet Transaction)
      await tx.walletTransaction.create({
        data: {
          userId: depositRequest.userId,
          type: "DEPOSIT", // Loại giao dịch nạp tiền
          amount: amount,
          balanceBefore,
          balanceAfter,
          referenceId: depositCode,
          description: `Nạp tiền tự động qua ngân hàng (Mã GD: ${bankTxId})`,
        },
      });

      return { userId: depositRequest.userId, depositCode, amount, balanceAfter };
    });
  }
}