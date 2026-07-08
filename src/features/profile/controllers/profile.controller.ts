import { FastifyReply, FastifyRequest } from 'fastify';
import { ProfileService } from '../services/profile.service';
import { UpdateProfileInput } from '../schemas/profile.schema';
import { changePasswordBodySchema, ChangePasswordInput } from '../schemas/profile.schema';

// 1. Định nghĩa một Interface Request custom riêng cho các API cần đăng nhập
interface AuthenticatedRequest extends FastifyRequest {
  user: {
    id: number;
    email: string;
  };
}

/**
 * XỬ LÝ LẤY LỊCH SỬ ĐĂNG NHẬP (SECURITY LOG)
 */
export const getLoginHistoryHandler = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const authRequest = request as AuthenticatedRequest;
    const history = await ProfileService.getLoginHistory(authRequest.user.id);

    return reply.status(200).send({
      success: true,
      data: history
    });
  } catch (error) {
    request.server.log.error(error);
    return reply.status(500).send({ success: false, message: 'Đã có lỗi hệ thống xảy ra.' });
  }
};

/**
 * XỬ LÝ LẤY DANH SÁCH PHIÊN HOẠT ĐỘNG
 */
export const getActiveSessionsHandler = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const authRequest = request as AuthenticatedRequest;
    const sessions = await ProfileService.getActiveSessions(authRequest.user.id);

    return reply.status(200).send({
      success: true,
      data: sessions
    });
  } catch (error) {
    request.server.log.error(error);
    return reply.status(500).send({ success: false, message: 'Đã có lỗi hệ thống xảy ra.' });
  }
};

/**
 * LẤY THÔNG TIN PROFILE CỦA TÔI
 */
export const getMyProfileHandler = async (
  request: FastifyRequest, 
  reply: FastifyReply
) => {
  try {
    // Ép kiểu trực tiếp cho request ở đây
    const authRequest = request as AuthenticatedRequest;
    const userId = authRequest.user.id; 
    
    const profile = await ProfileService.getProfile(userId);

    return reply.status(200).send({
      success: true,
      data: profile
    });
  } catch (error: any) {
    if (error.message === 'USER_NOT_FOUND') {
      return reply.status(404).send({ success: false, message: 'Người dùng không tồn tại.' });
    }
    request.server.log.error(error);
    return reply.status(500).send({ success: false, message: 'Đã có lỗi hệ thống xảy ra.' });
  }
};

/**
 * CẬP NHẬT THÔNG TIN PROFILE
 */
export const updateProfileHandler = async (
  request: FastifyRequest<{ Body: UpdateProfileInput }>,
  reply: FastifyReply
) => {
  try {
    // Ép kiểu tương tự cho API update
    const authRequest = request as unknown as AuthenticatedRequest & { body: UpdateProfileInput };
    const userId = authRequest.user.id;
    
    const updatedProfile = await ProfileService.updateProfile(userId, request.body);

    return reply.status(200).send({
      success: true,
      message: 'Cập nhật thông tin cá nhân thành công.',
      data: updatedProfile
    });
  } catch (error) {
    request.server.log.error(error);
    return reply.status(500).send({ success: false, message: 'Đã có lỗi hệ thống xảy ra.' });
  }
};

/**
 * XỬ LÝ ĐỔI MẬT KHẨU
 */
export const changePasswordHandler = async (
  request: FastifyRequest<{ Body: ChangePasswordInput }>,
  reply: FastifyReply
) => {
  try {
    const authRequest = request as unknown as AuthenticatedRequest & { body: ChangePasswordInput };
    const userId = authRequest.user.id;
    const context = { ip: request.ip, userAgent: request.headers['user-agent'] || 'Unknown' };

    // Gọi Service xử lý toàn bộ logic phức tạp
    await ProfileService.changePassword(userId, request.body, context);

    return reply.status(200).send({
      success: true,
      message: 'Đổi mật khẩu thành công.'
    });

  } catch (error: any) {
    if (error.message.startsWith('AUTH_CHANGE_PASSWORD_COOLDOWN')) {
      const minutes = error.message.split(':')[1];
      return reply.status(429).send({
        success: false,
        message: `Bạn đã đổi mật khẩu gần đây. Vui lòng thử lại sau ${minutes} phút (Giới hạn 1 giờ/lần).`
      });
    }

    if (error.message === 'AUTH_INVALID_OLD_PASSWORD') {
      return reply.status(400).send({ success: false, message: 'Mật khẩu cũ không chính xác.' });
    }

    if (error.message === 'USER_NOT_FOUND') {
      return reply.status(404).send({ success: false, message: 'Tài khoản không tồn tại.' });
    }

    request.server.log.error(error);
    return reply.status(500).send({ success: false, message: 'Đã có lỗi hệ thống xảy ra.' });
  }
};

/**
 * XỬ LÝ LẤY LỊCH SỬ NẠP TIỀN
 */
export const getDepositHistoryHandler = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const authRequest = request as AuthenticatedRequest;
    const history = await ProfileService.getDepositHistory(authRequest.user.id);

    return reply.status(200).send({
      success: true,
      data: history
    });
  } catch (error) {
    request.server.log.error(error);
    return reply.status(500).send({ success: false, message: 'Đã có lỗi hệ thống xảy ra.' });
  }
};

/**
 * XỬ LÝ LẤY LỊCH SỬ MUA HÀNG
 */
export const getPurchaseHistoryHandler = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const authRequest = request as AuthenticatedRequest;
    const history = await ProfileService.getPurchaseHistory(authRequest.user.id);

    return reply.status(200).send({
      success: true,
      data: history
    });
  } catch (error) {
    request.server.log.error(error);
    return reply.status(500).send({ success: false, message: 'Đã có lỗi hệ thống xảy ra.' });
  }
};

/**
 * XỬ LÝ LẤY DANH SÁCH THÔNG BÁO
 */
export const getNotificationsHandler = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const authRequest = request as AuthenticatedRequest;
    const notifications = await ProfileService.getNotifications(authRequest.user.id);

    return reply.status(200).send({
      success: true,
      data: notifications
    });
  } catch (error) {
    request.server.log.error(error);
    return reply.status(500).send({ success: false, message: 'Đã có lỗi hệ thống xảy ra.' });
  }
};

/**
 * XỬ LÝ ĐÁNH DẤU ĐÃ ĐỌC TOÀN BỘ THÔNG BÁO
 */
export const markAllNotificationsAsReadHandler = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const authRequest = request as AuthenticatedRequest;
    await ProfileService.markAllAsRead(authRequest.user.id);

    return reply.status(200).send({
      success: true,
      message: 'Đã đánh dấu đọc tất cả thông báo.'
    });
  } catch (error) {
    request.server.log.error(error);
    return reply.status(500).send({ success: false, message: 'Đã có lỗi hệ thống xảy ra.' });
  }
};