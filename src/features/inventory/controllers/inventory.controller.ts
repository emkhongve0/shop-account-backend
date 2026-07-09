import { FastifyRequest, FastifyReply } from "fastify";
import { InventoryService } from "../services/inventory.service";
import { AccountStatus } from "@prisma/client";

export class InventoryController {
  static async getAll(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { productId, status } = request.query as {
        productId?: string;
        status?: AccountStatus;
      };
      const result = await InventoryService.getAllInventory({
        productId: productId ? parseInt(productId, 10) : undefined,
        status,
      });
      return reply.send({ success: true, data: result });
    } catch (error: any) {
      return reply.status(400).send({ success: false, message: error.message });
    }
  }

  static async getOne(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = request.params as { id: string };
      const result = await InventoryService.getAccountById(parseInt(id, 10));
      return reply.send({ success: true, data: result });
    } catch (error: any) {
      return reply.status(404).send({ success: false, message: error.message });
    }
  }

  static async create(request: FastifyRequest, reply: FastifyReply) {
    try {
      const result = await InventoryService.createAccount(request.body as any);
      return reply
        .status(201)
        .send({
          success: true,
          message: "Thêm tài khoản thành công.",
          data: result,
        });
    } catch (error: any) {
      return reply.status(400).send({ success: false, message: error.message });
    }
  }

  static async importBulk(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { productId, rawTxtData } = request.body as {
        productId: number;
        rawTxtData: string;
      };
      const result = await InventoryService.importAccounts(
        productId,
        rawTxtData,
      );
      return reply.send({
        success: true,
        message: `Import thành công ${result.importedCount} tài khoản.`,
      });
    } catch (error: any) {
      return reply.status(400).send({ success: false, message: error.message });
    }
  }

  static async update(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = request.params as { id: string };
      const result = await InventoryService.updateAccount(
        parseInt(id, 10),
        request.body as any,
      );
      return reply.send({
        success: true,
        message: "Cập nhật tài khoản thành công.",
        data: result,
      });
    } catch (error: any) {
      return reply.status(400).send({ success: false, message: error.message });
    }
  }

  static async delete(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = request.params as { id: string };
      await InventoryService.deleteAccount(parseInt(id, 10));
      return reply.send({
        success: true,
        message: "Xóa tài khoản thành công.",
      });
    } catch (error: any) {
      return reply.status(400).send({ success: false, message: error.message });
    }
  }

  static async exportTxt(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { productId, status } = request.query as {
        productId: string;
        status?: AccountStatus;
      };
      if (!productId) throw new Error("Vui lòng cung cấp productId để export.");

      const txtContent = await InventoryService.exportToTxt(
        parseInt(productId, 10),
        status,
      );

      // Thiết lập header để trình duyệt/Postman hiểu đây là file tải về
      reply.header(
        "Content-Disposition",
        `attachment; filename="export_product_${productId}.txt"`,
      );
      reply.header("Content-Type", "text/plain; charset=utf-8");

      return reply.send(txtContent);
    } catch (error: any) {
      return reply.status(400).send({ success: false, message: error.message });
    }
  }
}
