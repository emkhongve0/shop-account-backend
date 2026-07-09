import { FastifyInstance } from "fastify";
import { NotificationController } from "./controllers/notification.controller";
import { authenticate } from "../../middlewares/auth.middleware";
import { adminMiddleware } from "../../middlewares/admin.middleware";

export async function notificationRoutes(fastify: FastifyInstance) {
  // Các API tĩnh phục vụ khách hàng bọc qua authenticate
  fastify.get(
    "/notifications",
    { preHandler: [authenticate] },
    NotificationController.getMyNotifications,
  );
  fastify.post(
    "/notifications/read-all",
    { preHandler: [authenticate] },
    NotificationController.readAll,
  );
  fastify.patch(
    "/notifications/:id/read",
    { preHandler: [authenticate] },
    NotificationController.readOne,
  );

  // API Admin gửi thông báo
  fastify.post(
    "/admin/notifications",
    { preHandler: [authenticate, adminMiddleware] },
    NotificationController.adminSendNotification,
  );
}
