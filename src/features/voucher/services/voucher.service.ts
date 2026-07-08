import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export class VoucherService {
  /**
   * KIỂM TRA VÀ TÍNH TOÁN GIÁ TRỊ VOUCHER
   */
  static async checkVoucher(code: string, orderAmount: number) {
    // 1. Tìm voucher trong Database
    const voucher = await prisma.voucher.findUnique({
      where: { code }
    });

    if (!voucher) {
      throw new Error('VOUCHER_NOT_FOUND');
    }

    // 2. Kiểm tra hạn sử dụng
    if (new Date() > new Date(voucher.expiryDate)) {
      throw new Error('VOUCHER_EXPIRED');
    }

    // 3. Kiểm tra số lần sử dụng tối đa toàn hệ thống
    if (voucher.usedCount >= voucher.maxUses) {
      throw new Error('VOUCHER_MAX_USES_REACHED');
    }

    // 4. Tính toán số tiền được giảm dựa theo loại Voucher
    let discountAmount = 0;

    if (voucher.type === 'FIXED') {
      // Giảm theo số tiền cố định (Ví dụ: Giảm thẳng 20.000đ)
      discountAmount = voucher.discount;
    } else if (voucher.type === 'PERCENT') {
      // Giảm theo phần trăm (Ví dụ: Giảm 10% đơn hàng)
      discountAmount = Math.floor((orderAmount * voucher.discount) / 100);
    }

    // Đảm bảo số tiền giảm không vượt quá giá trị đơn hàng
    if (discountAmount > orderAmount) {
      discountAmount = orderAmount;
    }

    const finalAmount = orderAmount - discountAmount;

    return {
      code: voucher.code,
      type: voucher.type,
      discountValue: voucher.discount, // Giá trị gốc của cấu hình voucher
      discountAmount,                 // Số tiền thực tế được giảm
      finalAmount                     // Số tiền cuối cùng user phải trả
    };
  }
}