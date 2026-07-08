import { FastifyReply, FastifyRequest } from 'fastify';
import { VoucherService } from '../services/voucher.service';
import { CheckVoucherInput } from '../schemas/voucher.schema';
import { AuditLogService } from '../../audit-log/services/audit-log.service';

export const checkVoucherHandler = async (
  request: FastifyRequest<{ Body: CheckVoucherInput }>,
  reply: FastifyReply
) => {
  try {
    const { code, orderAmount } = request.body;

    const user = (request as any).user;
    
    const result = await VoucherService.checkVoucher(code, orderAmount);

    // GHI AUDIT LOG TẠI ĐÂY
    await AuditLogService.createLog({
      userId: user?.id,
      module: 'VOUCHER',
      action: 'CHECK_VOUCHER',
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'],
      newValues: {
        code,
        orderAmount,
        discountAmount: result.discountAmount
      }
    });

    return reply.status(200).send({
      success: true,
      message: 'Áp dụng mã giảm giá thành công.',
      data: result
    });
  } catch (error: any) {
    if (error.message === 'VOUCHER_NOT_FOUND') {
      return reply.status(404).send({ success: false, message: 'Mã giảm giá không tồn tại hoặc đã nhập sai.' });
    }
    if (error.message === 'VOUCHER_EXPIRED') {
      return reply.status(400).send({ success: false, message: 'Mã giảm giá này đã hết hạn sử dụng.' });
    }
    if (error.message === 'VOUCHER_MAX_USES_REACHED') {
      return reply.status(400).send({ success: false, message: 'Mã giảm giá đã đạt giới hạn lượt sử dụng.' });
    }

    request.server.log.error(error);
    return reply.status(500).send({ success: false, message: 'Đã có lỗi hệ thống xảy ra.' });
  }
};