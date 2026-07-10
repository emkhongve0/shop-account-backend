import { FastifyReply, FastifyRequest } from "fastify";
import { DepositService } from "../services/deposit.service";
import { AuditLogService } from "../../audit-log/services/audit-log.service";
import { websocketClients } from "../../../app"; // <-- THÊM MỚI: Import Map lưu giữ kết nối từ file app.ts

interface EmailWebhookBody {
  bankTxId: string; // Mã giao dịch từ email (Ví dụ: "2026070800003988504")
  amount: number; // Số tiền ghi có (Ví dụ: 2000)
  transactionRemark: string; // Nội dung chuyển khoản chứa mã DEP-XXXXXX
}

export const emailWebhookHandler = async (
  request: FastifyRequest<{ Body: EmailWebhookBody }>,
  reply: FastifyReply,
) => {
  try {
    // 1. Kiểm tra Secret Key bảo mật giữa Script đọc Email và Backend
    const webhookSecret = request.headers["x-webhook-secret"];
    const systemSecret = process.env.EMAIL_WEBHOOK_SECRET;

    if (!systemSecret || webhookSecret !== systemSecret) {
      return reply
        .status(401)
        .send({ success: false, message: "Không có quyền truy cập." });
    }

    const { bankTxId, amount, transactionRemark } = request.body;

    if (!bankTxId || !amount || !transactionRemark) {
      return reply
        .status(400)
        .send({ success: false, message: "Thiếu dữ liệu giao dịch." });
    }

    // 2. Gọi Service xử lý đối soát, chạy Prisma Transaction và cộng tiền
    const result = await DepositService.processAutoDeposit(
      bankTxId,
      amount,
      transactionRemark,
    );

    // 3. Ghi Audit Log để quản trị viên dễ dàng theo dõi dòng tiền nạp tự động
    await AuditLogService.createLog({
      userId: result.userId,
      module: "DEPOSIT_AUTOMATION",
      action: "AUTO_DEPOSIT_SUCCESS",
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"],
      newValues: {
        bankTxId,
        amount,
        depositCode: result.depositCode,
      },
    });

    // 4. THÊM MỚI: Đẩy thông tin real-time báo thành công ngay lập tức sang Frontend qua WebSocket
    try {
      const userSocket = websocketClients.get(result.userId);

      // Nếu trạng thái kết nối socket đang mở (readyState === 1)
      if (userSocket && userSocket.readyState === 1) {
        userSocket.send(
          JSON.stringify({
            event: "DEPOSIT_SUCCESS",
            data: {
              status: "SUCCESS",
              // SỬA TẠI ĐÂY: Thay newBalance bằng balanceAfter theo đúng Type của Service trả về
              newBalance: result.balanceAfter || 0,
            },
          }),
        );
        request.server.log.info(
          `⚡ [WEBSOCKET] Đã đẩy thông báo nạp thành công real-time tới User ID: ${result.userId}`,
        );
      }
    } catch (wsError) {
      request.server.log.error(
        wsError,
        "Lỗi xảy ra khi bắn tín hiệu WebSocket.",
      );
    }

    return reply.status(200).send({
      success: true,
      message: `Cộng tiền thành công cho tài khoản ID: ${result.userId}`,
    });
  } catch (error: any) {
    request.server.log.error(error);

    // Trả về lỗi chi tiết từ Service (Trùng mã, Hết hạn, Sai mã...) để script log lại
    return reply.status(400).send({
      success: false,
      message: error.message || "Lỗi xử lý đối soát giao dịch.",
    });
  }
};
