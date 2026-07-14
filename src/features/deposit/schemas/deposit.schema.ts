import { z } from "zod";

// --- SCHEMA VALIDATE BODY CHO REQUEST NẠP TIỀN ---
export const createDepositBodySchema = z.object({
  method: z
    .string({ required_error: "Phương thức nạp tiền không được để trống" })
    .nonempty("Phương thức nạp tiền không được rỗng")
    .describe("Phương thức nạp tiền (Ví dụ: BANKING, MOMO...)"),
});

// --- SCHEMA VALIDATE PARAMS TRÊN URL ---
export const depositStatusParamSchema = z.object({
  id: z
    .string()
    .regex(/^\d+$/, "Mã ID người dùng phải là một số nguyên dương")
    .describe("Mã định danh userId phục vụ Real-time Polling"),
});

// --- SCHEMA VALIDATE WEBHOOK BODY (TỪ BOT EMAIL CÀO) ---
export const emailWebhookBodySchema = z.object({
  bankTxId: z
    .string({ required_error: "Thiếu mã giao dịch ngân hàng" })
    .nonempty(),
  amount: z
    .number({ required_error: "Thiếu số tiền nạp" })
    .positive("Số tiền nạp phải lớn hơn 0"),
  transactionRemark: z
    .string({ required_error: "Thiếu nội dung chuyển khoản" })
    .nonempty(),
});

export type CreateDepositInput = z.infer<typeof createDepositBodySchema>;
export type EmailWebhookInput = z.infer<typeof emailWebhookBodySchema>;

// =========================================================================
// CHUẨN HÓA KHỐI PHẢN HỒI THÀNH CÔNG VÀ LỖI DẠNG ZOD NGUYÊN BẢN (TRÁNH LỖI 500)
// =========================================================================

// Phản hồi 200 lấy thông tin QR định danh thành công
export const createDepositSuccessResponse = z.object({
  success: z.boolean().default(true),
  message: z.string().default("Lấy thông tin QR định danh thành công."),
  data: z.object({
    depositId: z.string().describe("Mã định danh yêu cầu nạp tiền"),
    reference: z
      .string()
      .describe("Mã nạp tiền định danh (Nội dung chuyển khoản chuẩn)"),
    expiredAt: z
      .null()
      .describe("Thời gian hết hạn (null vì QR định danh dùng vĩnh viễn)"),
    qrCodeUrl: z
      .string()
      .url()
      .describe("URL ảnh QR dùng để hiển thị lên thẻ img"),
    manualPaymentInfo: z.object({
      bankBin: z.string(),
      accountNumber: z.string(),
      accountName: z.string(),
      amount: z.null(),
      description: z.string(),
    }),
    guide: z.string(),
  }),
});

// Phản hồi 200 kiểm tra trạng thái Polling
export const getDepositStatusSuccessResponse = z.object({
  success: z.boolean().default(true),
  data: z.object({
    status: z
      .string()
      .default("NONE") // Thay đổi giá trị mặc định từ "SUCCESS" thành "NONE"
      .describe("Trạng thái nạp tiền mới nhất (Ví dụ: SUCCESS, NONE)"),
    amount: z
      .number()
      .describe("Số tiền của giao dịch nạp thành công gần nhất"),
    newBalance: z.number().describe("Số dư ví thật hiện tại của User"),
  }),
});

// Khối phản hồi lỗi nghiệp vụ (Business Errors) cho phân hệ Deposit
export const errorDeposit400Schema = z
  .object({
    success: z.boolean().default(false),
    code: z.string().default("INVALID_METHOD"),
    message: z
      .string()
      .default("Phương thức nạp tiền hoặc dữ liệu giao dịch không hợp lệ."),
  })
  .describe("Lỗi do truyền sai phương thức hoặc thiếu dữ liệu webhook");


  // Khối phản hồi lỗi xác thực 401
export const errorDeposit401Schema = z
  .object({
    success: z.boolean().default(false),
    code: z.string().default("UNAUTHORIZED"),
    message: z
      .string()
      .default("Không có quyền truy cập hệ thống nạp / Webhook Secret sai."),
  })
  .describe("Lỗi xác thực Token người dùng hoặc Token Webhook");


  // Khối phản hồi lỗi hệ thống 500 (Bổ sung mới để tránh lỗi Swagger hiển thị sai cấu trúc)
export const errorDeposit500Schema = z
  .object({
    success: z.boolean().default(false),
    message: z.string().default("Lỗi hệ thống khi xử lý kiểm tra số dư."),
  })
  .describe("Lỗi không xác định phát sinh từ máy chủ");