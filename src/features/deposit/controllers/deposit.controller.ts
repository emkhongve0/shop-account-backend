// src/features/deposit/controllers/deposit.controller.ts
import { FastifyReply, FastifyRequest } from "fastify";
import { DepositService } from "../services/deposit.service";

export const createDepositHandler = async (
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  try {
    const user = (request as any).user;
    const { method } = request.body as { method: string };

    if (!method) {
      return reply.status(400).send({
        success: false,
        message: "Phương thức nạp tiền không hợp lệ.",
      });
    }

    const depositResponse = await DepositService.createDepositRequest(
      user.id,
      method.toUpperCase(),
    );

    return reply.status(200).send({
      success: true,
      message: "Lấy thông tin QR định danh thành công.",
      data: {
        depositId: depositResponse.id,
        reference: depositResponse.description,
        expiredAt: null, // Không giới hạn thời gian

        // Nhúng thẳng url này vào thẻ <img src="..."> ở giao diện
        qrCodeUrl: depositResponse.qrCodeUrl,

        // Thông tin chuyển khoản thủ công nếu không quét mã
        manualPaymentInfo: depositResponse.manualPaymentInfo,

        guide: `Tài khoản của bạn được định danh bằng nội dung chuyển khoản duy nhất: ${depositResponse.description}. Mã này không bao giờ hết hạn, bạn có thể lưu lại ảnh QR để nạp nhiều lần.`,
      },
    });
  } catch (error) {
    request.server.log.error(error);
    return reply.status(500).send({
      success: false,
      message: "Lỗi hệ thống khi lấy thông tin nạp tiền.",
    });
  }
};
