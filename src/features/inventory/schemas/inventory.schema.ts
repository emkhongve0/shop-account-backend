// src/features/inventory/schemas/inventory.schema.ts
import { z } from "zod";

// Enum trạng thái tài khoản đồng bộ khớp cấu trúc cơ sở dữ liệu Prisma
export const AccountStatusEnum = z.enum([
  "AVAILABLE",
  "SOLD",
  "ERROR",
  "HOLDING",
]);

// Định nghĩa cấu trúc Model chi tiết của 1 Item trong kho hàng để hiển thị trên Swagger
export const inventoryModelSchema = z.object({
  id: z.number().describe("Mã định danh duy nhất của tài khoản trong kho"),
  productId: z.number().describe("Mã ID sản phẩm thuộc về"),
  accountData: z
    .string()
    .describe("Dữ liệu tài khoản (định dạng clone, via, mail...)"),
  status: z.string().describe("Trạng thái hiện tại của tài khoản"),
  createdAt: z.date().or(z.string()).describe("Thời gian nhập kho"),
  updatedAt: z.date().or(z.string()).describe("Thời gian cập nhật gần nhất"),
  product: z
    .object({
      name: z.string().describe("Tên sản phẩm tương ứng"),
    })
    .describe("Thông tin liên kết sản phẩm"),
});

// =========================================================================
// KHỐI SCHEMA ĐẦU VÀO PHỤC VỤ VALIDATE VÀ GENERATE SWAGGER UI
// =========================================================================

export const getInventoryQuerySchema = z.object({
  productId: z
    .string()
    .optional()
    .describe("Lọc danh sách theo ID sản phẩm (Chuỗi số)"),
  status: AccountStatusEnum.optional().describe(
    "Lọc danh sách theo trạng thái nick",
  ),
});

export const exportInventoryQuerySchema = z.object({
  productId: z
    .string()
    .describe("ID sản phẩm bắt buộc để lọc dữ liệu xuất file"),
  status: AccountStatusEnum.optional().describe(
    "Trạng thái nick cần lọc để export",
  ),
});

export const importBulkBodySchema = z.object({
  productId: z.number().describe("Mã ID sản phẩm cần nạp nick vào"),
  rawTxtData: z
    .string()
    .describe("Chuỗi dữ liệu thô, mỗi tài khoản nằm trên 1 dòng"),
});

export const createSingleBodySchema = z.object({
  productId: z.number().describe("Mã ID sản phẩm"),
  accountData: z.string().describe("Thông tin tài khoản thô"),
  status: AccountStatusEnum.optional().describe(
    "Trạng thái khởi tạo (Mặc định: AVAILABLE)",
  ),
});

export const updateInventoryBodySchema = z.object({
  productId: z.number().optional().describe("Mã ID sản phẩm mới nếu muốn đổi"),
  accountData: z.string().optional().describe("Dữ liệu tài khoản cập nhật"),
  status: AccountStatusEnum.optional().describe("Trạng thái mới cần cập nhật"),
});

export const inventoryIdParamSchema = z.object({
  id: z
    .string()
    .regex(/^\d+$/, "Mã ID phải là chuỗi số nguyên dương")
    .describe("ID dòng tài khoản cần xử lý"),
});

// =========================================================================
// HỆ THỐNG MÃ LỖI ĐỒNG BỘ 100% VỚI CONTROLLER VÀ ĐỊNH DẠNG SWAGGER UI
// =========================================================================

export const errorInventory400Schema = z.object({
  success: z.boolean().default(false),
  code: z.string().default("VALIDATION_ERROR"),
  message: z
    .string()
    .default("Dữ liệu gửi lên không hợp lệ hoặc sai nghiệp vụ hệ thống."),
});

export const errorInventory404Schema = z.object({
  success: z.boolean().default(false),
  code: z.string().default("NOT_FOUND"),
  message: z
    .string()
    .default("Không tìm thấy dữ liệu tài khoản yêu cầu trong hệ thống."),
});

export const errorInventory500Schema = z.object({
  success: z.boolean().default(false),
  code: z.string().default("SERVER_ERROR"),
  message: z.string().default("Lỗi hệ thống máy chủ khi xử lý kho hàng Admin."),
});
