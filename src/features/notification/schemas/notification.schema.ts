// src/features/notification/schemas/notification.schema.ts
import { z } from "zod";

// Định nghĩa cấu trúc Model thông báo chuẩn để hiển thị trên Swagger
export const notificationModelSchema = z.object({
  id: z.number().describe("Mã định danh duy nhất của thông báo"),
  userId: z
    .number()
    .nullable()
    .describe("ID của User nhận thông báo (null nếu là toàn hệ thống)"),
  title: z.string().describe("Tiêu đề thông báo"),
  content: z.string().describe("Nội dung chi tiết thông báo"),
  isRead: z
    .boolean()
    .describe("Trạng thái đã đọc (Chỉ áp dụng cho thông báo cá nhân)"),
  createdAt: z.date().or(z.string()).describe("Thời gian tạo thông báo"),
  updatedAt: z.date().or(z.string()).describe("Thời gian cập nhật"),
});

// --- SCHEMA ĐẦU VÀO CHO VALIDATE VÀ SWAGGER ---

export const getNotificationsQuerySchema = z.object({
  page: z
    .string()
    .optional()
    .default("1")
    .describe("Số trang hiện tại phục vụ phân trang"),
  limit: z
    .string()
    .optional()
    .default("10")
    .describe("Số lượng bản ghi trên một trang"),
});

export const readOneParamSchema = z.object({
  id: z
    .string()
    .regex(/^\d+$/, "Mã ID thông báo phải là số nguyên dương")
    .describe("Mã ID thông báo cần đánh dấu đọc"),
});

export const adminSendNotificationBodySchema = z.object({
  userId: z
    .number()
    .optional()
    .describe(
      "Mã ID của User nhận thông báo đích danh (Bắt buộc nếu isGlobal = false)",
    ),
  title: z
    .string({ required_error: "Tiêu đề không được để trống" })
    .nonempty("Tiêu đề không được rỗng"),
  content: z
    .string({ required_error: "Nội dung không được để trống" })
    .nonempty("Nội dung không được rỗng"),
  isGlobal: z
    .boolean()
    .optional()
    .default(false)
    .describe("Đánh dấu gửi cho toàn bộ người dùng hệ thống"),
});

// --- HỆ THỐNG MÃ LỖI ĐỒNG BỘ CHUẨN ---

export const errorNotification400Schema = z.object({
  success: z.boolean().default(false),
  code: z.string().default("VALIDATION_ERROR"),
  message: z
    .string()
    .default("Dữ liệu gửi lên không hợp lệ hoặc sai nghiệp vụ."),
});

export const errorNotification404Schema = z.object({
  success: z.boolean().default(false),
  code: z.string().default("NOT_FOUND"),
  message: z
    .string()
    .default("Không tìm thấy thông báo hoặc bạn không có quyền sở hữu."),
});

export const errorNotification500Schema = z.object({
  success: z.boolean().default(false),
  code: z.string().default("SERVER_ERROR"),
  message: z.string().default("Lỗi hệ thống máy chủ khi xử lý thông báo."),
});
