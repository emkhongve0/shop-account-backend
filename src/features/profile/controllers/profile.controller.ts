import { FastifyReply, FastifyRequest } from "fastify";
import { ProfileService } from "../services/profile.service";
import { UpdateProfileInput } from "../schemas/profile.schema";
import {
  changePasswordBodySchema,
  ChangePasswordInput,
} from "../schemas/profile.schema";

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
export const getLoginHistoryHandler = async (
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  try {
    const authRequest = request as AuthenticatedRequest;
    const history = await ProfileService.getLoginHistory(authRequest.user.id);

    return reply.status(200).send({
      success: true,
      data: history,
    });
  } catch (error: any) {
    request.server.log.error(error);
    return reply.status(400).send({
      success: false,
      code: "VALIDATION_ERROR",
      message: error.message || "Đã có lỗi hệ thống xảy ra.",
    });
  }
};

/**
 * XỬ LÝ LẤY DANH SÁCH PHIÊN HOẠT ĐỘNG
 */
export const getActiveSessionsHandler = async (
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  try {
    const authRequest = request as AuthenticatedRequest;
    const sessions = await ProfileService.getActiveSessions(
      authRequest.user.id,
    );

    return reply.status(200).send({
      success: true,
      data: sessions,
    });
  } catch (error: any) {
    request.server.log.error(error);
    return reply.status(400).send({
      success: false,
      code: "VALIDATION_ERROR",
      message: error.message || "Đã có lỗi hệ thống xảy ra.",
    });
  }
};

/**
 * XỬ LÝ LẤY LỊCH SỬ NẠP TIỀN
 */
export const getDepositHistoryHandler = async (
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  try {
    const authRequest = request as AuthenticatedRequest;
    const history = await ProfileService.getDepositHistory(authRequest.user.id);

    return reply.status(200).send({
      success: true,
      data: history,
    });
  } catch (error: any) {
    request.server.log.error(error);
    return reply.status(400).send({
      success: false,
      code: "VALIDATION_ERROR",
      message: error.message || "Đã có lỗi hệ thống xảy ra.",
    });
  }
};

/**
 * XỬ LÝ LẤY LỊCH SỬ MUA HÀNG
 */
export const getPurchaseHistoryHandler = async (
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  try {
    const authRequest = request as AuthenticatedRequest;
    const history = await ProfileService.getPurchaseHistory(
      authRequest.user.id,
    );

    return reply.status(200).send({
      success: true,
      data: history,
    });
  } catch (error: any) {
    request.server.log.error(error);
    return reply.status(400).send({
      success: false,
      code: "VALIDATION_ERROR",
      message: error.message || "Đã có lỗi hệ thống xảy ra.",
    });
  }
};

/**
 * XỬ LÝ LẤY HÒM THƯ THÔNG BÁO
 */
export const getNotificationsHandler = async (
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  try {
    const authRequest = request as AuthenticatedRequest;
    const notifications = await ProfileService.getNotifications(
      authRequest.user.id,
    );

    return reply.status(200).send({
      success: true,
      data: notifications,
    });
  } catch (error: any) {
    request.server.log.error(error);
    return reply.status(400).send({
      success: false,
      code: "VALIDATION_ERROR",
      message: error.message || "Đã có lỗi hệ thống xảy ra.",
    });
  }
};

/**
 * XỬ LÝ LẤY THÔNG TIN CÁ NHÂN & SỐ DƯ
 */
export const getMyProfileHandler = async (
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  try {
    const authRequest = request as AuthenticatedRequest;
    const user = await ProfileService.getProfile(authRequest.user.id);
    return reply.status(200).send({ success: true, data: user });
  } catch (error: any) {
    return reply.status(404).send({
      success: false,
      code: "NOT_FOUND",
      message: "Không tìm thấy thông tin tài khoản người dùng.",
    });
  }
};

/**
 * XỬ LÝ CẬP NHẬT THÔNG TIN CÁ NHÂN
 */
export const updateProfileHandler = async (
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  try {
    const authRequest = request as AuthenticatedRequest;
    const result = await ProfileService.updateProfile(
      authRequest.user.id,
      request.body as UpdateProfileInput,
    );
    return reply.status(200).send({
      success: true,
      message: "Cập nhật thông tin cá nhân thành công.",
      data: result,
    });
  } catch (error: any) {
    return reply.status(400).send({
      success: false,
      code: "VALIDATION_ERROR",
      message: error.message || "Cập nhật thông tin thất bại.",
    });
  }
};

/**
 * XỬ LÝ ĐỔI MẬT KHẨU
 */
export const changePasswordHandler = async (
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  try {
    const authRequest = request as AuthenticatedRequest;
    const body = request.body as ChangePasswordInput;

    // Lấy IP và User Agent từ request để truyền làm context cho Service
    const ip = request.ip || "Unknown IP";
    const userAgent = request.headers["user-agent"] || "Unknown Agent";

    // TRUYỀN ĐÚNG CẤU TRÚC OBJECT MÀ SERVICE YÊU CẦU
    await ProfileService.changePassword(authRequest.user.id, body, {
      ip,
      userAgent,
    });

    return reply.status(200).send({
      success: true,
      message:
        "Đổi mật khẩu thành công! Vui lòng sử dụng mật khẩu mới cho lần đăng nhập sau.",
    });
  } catch (error: any) {
    return reply.status(400).send({
      success: false,
      code: "VALIDATION_ERROR",
      message: error.message || "Đổi mật khẩu thất bại.",
    });
  }
};

/**
 * XỬ LÝ ĐÁNH DẤU ĐỌC MỘT THÔNG BÁO CỤ THỂ
 */
export const markNotificationAsReadHandler = async (
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  try {
    const authRequest = request as AuthenticatedRequest;
    const { id } = request.params as { id: string };
    const notificationId = parseInt(id, 10);

    if (isNaN(notificationId)) {
      return reply.status(400).send({
        success: false,
        code: "VALIDATION_ERROR",
        message: "ID thông báo không hợp lệ.",
      });
    }

    await ProfileService.markAsRead(authRequest.user.id, notificationId);

    return reply.status(200).send({
      success: true,
      message: "Đã đánh dấu đọc thông báo này.",
    });
  } catch (error: any) {
    if (error.message === "NOTIFICATION_NOT_FOUND") {
      return reply.status(404).send({
        success: false,
        code: "NOT_FOUND",
        message: "Thông báo không tồn tại.",
      });
    }
    if (error.message === "UNAUTHORIZED") {
      return reply.status(403).send({
        success: false,
        code: "FORBIDDEN",
        message: "Bạn không có quyền đọc thông báo này.",
      });
    }
    request.server.log.error(error);
    return reply.status(500).send({
      success: false,
      code: "SERVER_ERROR",
      message: "Đã có lỗi hệ thống xảy ra.",
    });
  }
};

/**
 * XỬ LÝ ĐÁNH DẤU ĐÃ ĐỌC TOÀN BỘ THÔNG BÁO
 */
export const markAllNotificationsAsReadHandler = async (
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  try {
    const authRequest = request as AuthenticatedRequest;

    // Gọi sang dịch vụ để update DB
    await ProfileService.markAllAsRead(authRequest.user.id);

    return reply.status(200).send({
      success: true,
      message: "Đã đánh dấu đọc tất cả thông báo thành công.",
    });
  } catch (error: any) {
    request.server.log.error(error);
    return reply.status(500).send({
      success: false,
      code: "SERVER_ERROR",
      message: "Không thể cập nhật trạng thái thông báo.",
    });
  }
};
