// src/features/notification/routes/notification.routes.ts
import { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { NotificationController } from "./controllers/notification.controller";
import { authenticate } from "../../middlewares/auth.middleware";
import { adminMiddleware } from "../../middlewares/admin.middleware";
import { z } from "zod";
import {
  getNotificationsQuerySchema,
  readOneParamSchema,
  adminSendNotificationBodySchema,
  notificationModelSchema,
  errorNotification400Schema,
  errorNotification404Schema,
  errorNotification500Schema,
} from "../notification/schemas/notification.schema";

export async function notificationRoutes(fastify: FastifyInstance) {
  // 1. User lấy danh sách thông báo của bản thân (cá nhân + hệ thống)
  fastify.withTypeProvider<ZodTypeProvider>().get(
    "/notifications",
    {
      preHandler: [authenticate],
      schema: {
        tags: ["Notifications (Thông báo)"],
        summary: "Lấy danh sách thông báo của tôi (Có phân trang)",
        querystring: getNotificationsQuerySchema,
        response: {
          200: z.object({
            success: z.boolean().default(true),
            data: z.object({
              total: z.number().describe("Tổng số lượng thông báo hiện có"),
              notifications: z
                .array(z.any())
                .describe("Danh sách thông báo đã định dạng trạng thái đọc"),
            }),
          }),
          400: errorNotification400Schema,
          500: errorNotification500Schema,
        },
      },
    },
    NotificationController.getMyNotifications,
  );

  // 2. User đánh dấu đọc toàn bộ thông báo
  fastify.withTypeProvider<ZodTypeProvider>().post(
    "/notifications/read-all",
    {
      preHandler: [authenticate],
      schema: {
        tags: ["Notifications (Thông báo)"],
        summary: "Đánh dấu đã đọc tất cả thông báo",
        response: {
          200: z.object({
            success: z.boolean().default(true),
            message: z.string(),
          }),
          400: errorNotification400Schema,
          500: errorNotification500Schema,
        },
      },
    },
    NotificationController.readAll,
  );

  // 3. User đánh dấu đọc một thông báo cụ thể theo ID
  fastify.withTypeProvider<ZodTypeProvider>().patch(
    "/notifications/:id/read",
    {
      preHandler: [authenticate],
      schema: {
        tags: ["Notifications (Thông báo)"],
        summary: "Đánh dấu đã đọc một thông báo theo ID",
        params: readOneParamSchema,
        response: {
          200: z.object({
            success: z.boolean().default(true),
            message: z.string(),
          }),
          400: errorNotification400Schema,
          404: errorNotification404Schema,
          500: errorNotification500Schema,
        },
      },
    },
    NotificationController.readOne,
  );

  // 4. Admin gửi thông báo (Đích danh hoặc Toàn hệ thống)
  fastify.withTypeProvider<ZodTypeProvider>().post(
    "/admin/notifications",
    {
      preHandler: [authenticate, adminMiddleware],
      schema: {
        tags: ["Admin Notifications (Quản trị thông báo)"],
        summary: "Admin gửi thông báo (Đích danh hoặc Toàn hệ thống)",
        body: adminSendNotificationBodySchema,
        response: {
          201: z.object({
            success: z.boolean().default(true),
            message: z.string(),
            data: notificationModelSchema,
          }),
          400: errorNotification400Schema,
          500: errorNotification500Schema,
        },
      },
    },
    NotificationController.adminSendNotification,
  );
}
