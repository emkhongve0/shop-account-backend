import { FastifyRequest, FastifyReply } from "fastify";
import { CategoryService } from "../services/category.service";

export class CategoryController {
  static async getCategories(request: FastifyRequest, reply: FastifyReply) {
    try {
      // Nếu có query isAdmin=true (và qua check quyền admin), lấy hết. Ngược lại chỉ lấy ACTIVE.
      const { isAdmin } = request.query as { isAdmin?: string };
      const result = await CategoryService.getAllCategories(isAdmin === "true");
      return reply.send({ success: true, data: result });
    } catch (error: any) {
      return reply.status(400).send({ success: false, message: error.message });
    }
  }

  static async create(request: FastifyRequest, reply: FastifyReply) {
    try {
      const result = await CategoryService.createCategory(request.body);
      return reply
        .status(201)
        .send({
          success: true,
          message: "Thêm danh mục thành công",
          data: result,
        });
    } catch (error: any) {
      return reply.status(400).send({ success: false, message: error.message });
    }
  }

  static async update(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = request.params as { id: string };
      const result = await CategoryService.updateCategory(
        parseInt(id, 10),
        request.body,
      );
      return reply.send({
        success: true,
        message: "Cập nhật danh mục thành công",
        data: result,
      });
    } catch (error: any) {
      return reply.status(400).send({ success: false, message: error.message });
    }
  }

  static async delete(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = request.params as { id: string };
      await CategoryService.deleteCategory(parseInt(id, 10));
      return reply.send({
        success: true,
        message: "Xóa danh mục thành công cứng hoàn toàn.",
      });
    } catch (error: any) {
      return reply.status(400).send({ success: false, message: error.message });
    }
  }
}
