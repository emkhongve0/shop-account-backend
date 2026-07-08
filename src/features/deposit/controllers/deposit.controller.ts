import { FastifyReply, FastifyRequest } from "fastify";
import { DepositService } from "../services/deposit.service";

export const createDepositHandler = async (
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  try {
    const user = (request as any).user;
    // Bổ sung nhận thêm trường 'amount' từ body (nếu có, mặc định là 0 để khách tự nhập)
    const { method, amount } = request.body as {
      method: string;
      amount?: number;
    };

    if (!method) {
      return reply.status(400).send({
        success: false,
        message: "Phương thức nạp tiền không hợp lệ.",
      });
    }

    // SỬA TẠI ĐÂY: Gọi thẳng qua Class Static và truyền thêm tham số 'method' theo đúng hàm trong Service
    const depositResponse = await DepositService.createDepositRequest(
      user.id,
      method.toUpperCase()
    );

    return reply.status(201).send({
      success: true,
      message:
        "Tạo yêu cầu nạp tiền thành công. Vui lòng quét mã QR hoặc chuyển khoản thủ công.",
      data: {
        // SỬA TẠI ĐÂY: Khớp tên thuộc tính trả về từ Service (id và description)
        depositId: depositResponse.id,
        reference: depositResponse.description,
        expiredAt: depositResponse.expiredAt,

        // 1. Luồng tự động: Frontend chỉ cần nhúng qrCodeUrl vào thẻ <img src="...">
        qrCodeUrl: depositResponse.qrCodeUrl,

        // 2. Luồng thủ công: Dùng hiển thị text và nút Copy cho khách ở Frontend
        manualPaymentInfo: depositResponse.manualPaymentInfo,

        // Giữ lại hướng dẫn cũ để hệ thống đồng bộ
        guide: `Vui lòng chuyển khoản với nội dung chính xác là: ${depositResponse.description}`,
      },
    });
  } catch (error) {
    request.server.log.error(error);
    return reply.status(500).send({
      success: false,
      message: "Lỗi hệ thống khi tạo yêu cầu nạp tiền.",
    });
  }
};