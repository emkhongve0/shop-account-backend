import { FastifyRequest, FastifyReply } from "fastify";
import { ProductService } from "../services/product.service";
import { ProductStatus } from "@prisma/client";

export class ProductController {
  // --- USER APIS ---
  static async getAll(request: FastifyRequest, reply: FastifyReply) {
    try {
      const result = await ProductService.getProducts({
        status: ProductStatus.ACTIVE,
      });
      return reply.send({ success: true, data: result });
    } catch (error: any) {
      return reply.status(400).send({ success: false, message: error.message });
    }
  }

  static async getOne(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = request.params as { id: string };
      const result = await ProductService.getProductByIdOrSlug(id);
      return reply.send({ success: true, data: result });
    } catch (error: any) {
      return reply.status(404).send({ success: false, message: error.message });
    }
  }

  static async getByCategory(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { categoryId } = request.params as { categoryId: string };
      const result = await ProductService.getProducts({
        categoryId: parseInt(categoryId, 10),
        status: ProductStatus.ACTIVE,
      });
      return reply.send({ success: true, data: result });
    } catch (error: any) {
      return reply.status(400).send({ success: false, message: error.message });
    }
  }

  // --- ADMIN APIS ---
  static async create(request: FastifyRequest, reply: FastifyReply) {
    try {
      const result = await ProductService.createProduct(request.body);
      return reply
        .status(201)
        .send({
          success: true,
          message: "Tạo sản phẩm thành công.",
          data: result,
        });
    } catch (error: any) {
      return reply.status(400).send({ success: false, message: error.message });
    }
  }

  static async importStock(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = request.params as { id: string };
      const { rawTxtData } = request.body as { rawTxtData: string };
      const result = await ProductService.importAccounts(
        parseInt(id, 10),
        rawTxtData,
      );
      return reply.send({
        success: true,
        message: `Đã nhập thêm ${result.importedCount} tài khoản vào kho.`,
        data: result,
      });
    } catch (error: any) {
      return reply.status(400).send({ success: false, message: error.message });
    }
  }

  static async update(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = request.params as { id: string };
      const result = await ProductService.updateProduct(
        parseInt(id, 10),
        request.body,
      );
      return reply.send({
        success: true,
        message: "Cập nhật sản phẩm thành công.",
        data: result,
      });
    } catch (error: any) {
      return reply.status(400).send({ success: false, message: error.message });
    }
  }

  static async delete(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = request.params as { id: string };
      await ProductService.deleteProduct(parseInt(id, 10));
      return reply.send({
        success: true,
        message: "Đã xóa cứng sản phẩm thành công.",
      });
    } catch (error: any) {
      return reply.status(400).send({ success: false, message: error.message });
    }
  }
}
