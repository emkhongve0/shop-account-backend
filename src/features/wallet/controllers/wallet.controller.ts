import { FastifyRequest, FastifyReply } from "fastify";
import { WalletService } from "../services/wallet.service";

export class WalletController {
  /**
   * API lấy thông tin số dư và lịch sử giao dịch ví của User hiện tại (Dùng Token)
   */
  static async getWalletDetails(request: FastifyRequest, reply: FastifyReply) {
    try {
      const userId = (request.user as any).id; // Lấy ID trực tiếp từ Bearer Token
      const query = request.query as { page?: string; limit?: string };

      const page = parseInt(query.page || "1", 10);
      const limit = parseInt(query.limit || "10", 10);

      const balance = await WalletService.getBalance(userId);
      const historyData = await WalletService.getHistory(userId, page, limit);

      return reply.status(200).send({
        success: true,
        data: {
          currentBalance: balance,
          history: historyData.transactions,
          meta: historyData.meta,
        },
      });
    } catch (error: any) {
      return reply.status(400).send({ success: false, message: error.message });
    }
  }

  /**
   * API Nạp/Trừ tiền vào ví của chính User (Xác thực qua Bearer Token)
   */
  static async modifyMyWallet(request: FastifyRequest, reply: FastifyReply) {
    try {
      const userId = (request.user as any).id; // Lấy ID trực tiếp từ Bearer Token
      const { amount, type, reason } = request.body as {
        amount: number;
        type: "INCREMENT" | "DECREMENT";
        reason: string;
      };

      if (!amount || amount <= 0) {
        return reply
          .status(400)
          .send({ success: false, message: "Số tiền không hợp lệ." });
      }

      const result = await WalletService.adminAdjustBalance(
        userId,
        amount,
        type,
        reason,
      );
      return reply.status(200).send({
        success: true,
        message:
          type === "INCREMENT"
            ? "Cộng tiền thành công."
            : "Trừ tiền thành công.",
        data: result,
      });
    } catch (error: any) {
      return reply.status(400).send({ success: false, message: error.message });
    }
  }

  /**
   * API Mua hàng trừ tiền ví (Xác thực qua Bearer Token)
   */
  static async testPurchase(request: FastifyRequest, reply: FastifyReply) {
    try {
      const userId = (request.user as any).id; // Lấy ID trực tiếp từ Bearer Token
      const { totalPrice, itemDetails } = request.body as {
        totalPrice: number;
        itemDetails: string;
      };

      if (!totalPrice || totalPrice <= 0) {
        return reply
          .status(400)
          .send({ success: false, message: "Giá trị sản phẩm không hợp lệ." });
      }

      const result = await WalletService.processPurchase(
        userId,
        totalPrice,
        itemDetails,
      );
      return reply.status(200).send({
        success: true,
        message: "Thanh toán đơn hàng thành công.",
        data: result,
      });
    } catch (error: any) {
      return reply.status(400).send({ success: false, message: error.message });
    }
  }
}
