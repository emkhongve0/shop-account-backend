import { z } from 'zod';

export const checkVoucherBodySchema = z.object({
  code: z.string()
    .trim()
    .min(2, 'Mã voucher quá ngắn')
    .max(20, 'Mã voucher quá dài')
    .toUpperCase(), // Tự động viết hoa mã khi kiểm tra
  orderAmount: z.number().min(0, 'Giá trị đơn hàng không hợp lệ')
});

export type CheckVoucherInput = z.infer<typeof checkVoucherBodySchema>;