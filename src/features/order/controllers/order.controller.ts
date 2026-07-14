// src/features/order/controllers/order.controller.ts
import { FastifyRequest, FastifyReply } from "fastify";
import { OrderService } from "../services/order.service";

export class OrderController {
  // --- DÀNH CHO USER ---
  static async getUserOrders(request: FastifyRequest, reply: FastifyReply) {
    try {
      const userId = (request.user as any).id;
      const result = await OrderService.getUserOrders(
        userId,
        request.query as any,
      );
      return reply.send({ success: true, data: result });
    } catch (error: any) {
      return reply.status(400).send({
        success: false,
        code: "VALIDATION_ERROR",
        message: error.message,
      });
    }
  }

  static async getUserOrderDetail(
    request: FastifyRequest,
    reply: FastifyReply,
  ) {
    try {
      const userId = (request.user as any).id;
      const { orderId } = request.params as { orderId: string };
      const result = await OrderService.getUserOrderDetails(orderId, userId);
      return reply.send({ success: true, data: result });
    } catch (error: any) {
      return reply.status(404).send({
        success: false,
        code: "NOT_FOUND",
        message: error.message,
      });
    }
  }

  // --- DÀNH CHO ADMIN ---
  static async getAdminOrders(request: FastifyRequest, reply: FastifyReply) {
    try {
      const result = await OrderService.getAdminOrders(request.query as any);
      return reply.send({ success: true, data: result });
    } catch (error: any) {
      return reply.status(400).send({
        success: false,
        code: "VALIDATION_ERROR",
        message: error.message,
      });
    }
  }

  static async getAdminOrderDetail(
    request: FastifyRequest,
    reply: FastifyReply,
  ) {
    try {
      const { orderId } = request.params as { orderId: string };
      const result = await OrderService.getAdminOrderDetails(orderId);
      return reply.send({ success: true, data: result });
    } catch (error: any) {
      return reply.status(404).send({
        success: false,
        code: "NOT_FOUND",
        message: error.message,
      });
    }
  }
}
