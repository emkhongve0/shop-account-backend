import { FastifyRequest, FastifyReply } from "fastify";
import { NotificationService } from "../services/notification.service";

export class NotificationController {
  static async getMyNotifications(
    request: FastifyRequest,
    reply: FastifyReply,
  ) {
    try {
      const userId = (request.user as any).id;
      const { page, limit } = request.query as {
        page?: string;
        limit?: string;
      };

      const result = await NotificationService.getUserNotifications(
        userId,
        page ? parseInt(page, 10) : 1,
        limit ? parseInt(limit, 10) : 10,
      );
      return reply.send({ success: true, data: result });
    } catch (error: any) {
      return reply.status(400).send({ success: false, message: error.message });
    }
  }

  static async readOne(request: FastifyRequest, reply: FastifyReply) {
    try {
      const userId = (request.user as any).id;
      const { id } = request.params as { id: string }; // id nhận từ URL dạng string

      await NotificationService.markAsRead(parseInt(id, 10), userId); // Ép sang kiểu số Int
      return reply.send({ success: true, message: "Đã đọc thông báo." });
    } catch (error: any) {
      return reply.status(400).send({ success: false, message: error.message });
    }
  }

  static async readAll(request: FastifyRequest, reply: FastifyReply) {
    try {
      const userId = (request.user as any).id;
      await NotificationService.markAllAsRead(userId);
      return reply.send({
        success: true,
        message: "Đã đánh dấu đọc tất cả thông báo.",
      });
    } catch (error: any) {
      return reply.status(400).send({ success: false, message: error.message });
    }
  }

  static async adminSendNotification(
    request: FastifyRequest,
    reply: FastifyReply,
  ) {
    try {
      const { userId, title, content, isGlobal } = request.body as {
        userId?: number;
        title: string;
        content: string;
        isGlobal?: boolean;
      };

      let result;
      if (isGlobal) {
        result = await NotificationService.sendToAll(title, content);
      } else {
        if (!userId)
          throw new Error("Vui lòng cung cấp userId để gửi đích danh.");
        result = await NotificationService.sendToUser(userId, title, content);
      }

      return reply
        .status(201)
        .send({
          success: true,
          message: "Gửi thông báo thành công.",
          data: result,
        });
    } catch (error: any) {
      return reply.status(400).send({ success: false, message: error.message });
    }
  }
}
