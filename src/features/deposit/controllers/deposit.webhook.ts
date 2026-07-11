import { FastifyReply, FastifyRequest } from "fastify";
import { DepositService } from "../services/deposit.service";
import { AuditLogService } from "../../audit-log/services/audit-log.service";
import { websocketClients } from "../../../app";

interface EmailWebhookBody {
  bankTxId: string; // Mã giao dịch từ ngân hàng
  amount: number; // Số tiền thực tế ghi có từ Email
  transactionRemark: string; // Nội dung chuyển khoản (chứa mã nạp tiền)
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

    // 2. Xử lý đối soát, chạy Prisma Transaction và cộng tiền vào Ví tài khoản
    const result = await DepositService.processAutoDeposit(
      bankTxId,
      amount,
      transactionRemark,
    );

    // 3. Ghi Audit Log theo dõi dòng tiền nạp tự động hệ thống
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

    // 4. CẬP NHẬT: Đẩy gói tin chứa SỐ TIỀN THẬT và SỐ DƯ THẬT về Frontend qua WebSocket
    try {
      const userSocket = websocketClients.get(result.userId);

      if (userSocket && userSocket.readyState === 1) {
        // 1 là trạng thái OPEN
        userSocket.send(
          JSON.stringify({
            event: "DEPOSIT_SUCCESS",
            data: {
              status: "SUCCESS",
              // Truyền số tiền thực tế cào được từ Email ngân hàng (Ví dụ: 2000)
              amountReceived: amount,
              // Truyền số dư ví thật sau khi đã cộng thành công trong Database
              newBalance: result.balanceAfter || 0,
            },
          }),
        );
        request.server.log.info(
          `⚡ [WEBSOCKET] Đã truyền dữ liệu nạp thực tế (+${amount}đ, Số dư mới: ${result.balanceAfter}đ) tới User ID: ${result.userId}`,
        );
      }
    } catch (wsError) {
      request.server.log.error(
        wsError,
        "Gặp sự cố khi bắn tín hiệu WebSocket.",
      );
    }

    return reply.status(200).send({
      success: true,
      message: `Cộng tiền thành công cho tài khoản ID: ${result.userId}`,
    });
  } catch (error: any) {
    request.server.log.error(error);
    return reply.status(400).send({
      success: false,
      message: error.message || "Lỗi xử lý đối soát giao dịch.",
    });
  }
};
