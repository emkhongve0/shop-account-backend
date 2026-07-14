// src/features/product/controllers/product.controller.ts
import { FastifyRequest, FastifyReply } from "fastify";
import { ProductService } from "../services/product.service";
import { PurchaseService } from "../services/purchase.service";
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
      return reply.status(400).send({
        success: false,
        code: "VALIDATION_ERROR",
        message: error.message,
      });
    }
  }

  static async getOne(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = request.params as { id: string };
      const result = await ProductService.getProductByIdOrSlug(id);
      return reply.send({ success: true, data: result });
    } catch (error: any) {
      return reply.status(404).send({
        success: false,
        code: "NOT_FOUND",
        message: error.message,
      });
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
      return reply.status(400).send({
        success: false,
        code: "VALIDATION_ERROR",
        message: error.message,
      });
    }
  }

  static async handlePurchase(request: FastifyRequest, reply: FastifyReply) {
    try {
      const userId = (request.user as any).id;
      const { productId, quantity } = request.body as {
        productId: number;
        quantity: number;
      };

      const result = await PurchaseService.executePurchase(
        userId,
        productId,
        quantity,
      );

      return reply.send({
        success: true,
        message: "Mua hàng thành công! Tài khoản của bạn đã được xuất.",
        data: result,
      });
    } catch (error: any) {
      return reply.status(400).send({
        success: false,
        code: "VALIDATION_ERROR",
        message: error.message,
      });
    }
  }

  // --- ADMIN APIS ---
  static async create(request: FastifyRequest, reply: FastifyReply) {
    try {
      const result = await ProductService.createProduct(request.body);
      return reply.status(201).send({
        success: true,
        message: "Thêm sản phẩm thành công.",
        data: result,
      });
    } catch (error: any) {
      return reply.status(400).send({
        success: false,
        code: "VALIDATION_ERROR",
        message: error.message,
      });
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
      return reply.status(400).send({
        success: false,
        code: "VALIDATION_ERROR",
        message: error.message,
      });
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
      return reply.status(400).send({
        success: false,
        code: "VALIDATION_ERROR",
        message: error.message,
      });
    }
  }

  static async delete(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = request.params as { id: string };
      await ProductService.deleteProduct(parseInt(id, 10));
      return reply.send({
        success: true,
        message: "Xóa sản phẩm thành công.",
      });
    } catch (error: any) {
      return reply.status(400).send({
        success: false,
        code: "VALIDATION_ERROR",
        message: error.message,
      });
    }
  }

  static async updateStatus(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = request.params as { id: string };
      const { status } = request.body as { status: ProductStatus };
      const result = await ProductService.updateStatus(
        parseInt(id, 10),
        status,
      );
      return reply.send({
        success: true,
        message: "Cập nhật trạng thái thành công.",
        data: result,
      });
    } catch (error: any) {
      return reply.status(400).send({
        success: false,
        code: "VALIDATION_ERROR",
        message: error.message,
      });
    }
  }
}
