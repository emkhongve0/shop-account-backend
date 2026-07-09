import { FastifyRequest, FastifyReply } from "fastify";
import { AdminUserService } from "../services/admin-user.service";

export class AdminUserController {
  static async list(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { page, limit, id, email, status, role, startDate, endDate } = request.query as any;
      const result = await AdminUserService.getAllUsers({
        page: page ? parseInt(page, 10) : 1,
        limit: limit ? parseInt(limit, 10) : 10,
        id: id ? parseInt(id, 10) : undefined,
        email, status, role, startDate, endDate
      });
      return reply.send({ success: true, data: result });
    } catch (error: any) {
      return reply.status(400).send({ success: false, message: error.message });
    }
  }

  static async detail(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = request.params as { id: string };
      const result = await AdminUserService.getUserDetails(parseInt(id, 10));
      return reply.send({ success: true, data: result });
    } catch (error: any) {
      return reply.status(404).send({ success: false, message: error.message });
    }
  }

  static async update(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = request.params as { id: string };
      const result = await AdminUserService.updateUser(parseInt(id, 10), request.body as any);
      return reply.send({ success: true, message: "Cập nhật người dùng thành công.", data: result });
    } catch (error: any) {
      return reply.status(400).send({ success: false, message: error.message });
    }
  }

  static async changePassword(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = request.params as { id: string };
      const { passwordNew } = request.body as { passwordNew: string };
      if (!passwordNew) throw new Error("Vui lòng cung cấp mật khẩu mới.");

      await AdminUserService.resetPassword(parseInt(id, 10), passwordNew);
      return reply.send({ success: true, message: "Đặt lại mật khẩu thành công." });
    } catch (error: any) {
      return reply.status(400).send({ success: false, message: error.message });
    }
  }

  static async changeBalance(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = request.params as { id: string };
      const { amount, description } = request.body as { amount: number; description: string };

      const result = await AdminUserService.adjustBalance(parseInt(id, 10), amount, description);
      return reply.send({ 
        success: true, 
        message: amount > 0 ? "Cộng tiền thành công." : "Trừ tiền thành công.", 
        data: result 
      });
    } catch (error: any) {
      return reply.status(400).send({ success: false, message: error.message });
    }
  }
}