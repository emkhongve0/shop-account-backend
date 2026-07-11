import { FastifyReply, FastifyRequest } from "fastify";
import {
  RegisterInput,
  LoginInput,
  VerifyEmailQuery,
  ForgotPasswordInput,
  ResetPasswordInput,
  RefreshTokenInput,
} from "../schemas/auth.schema";
import { AuthService } from "../services/auth.service";

/**
 * XỬ LÝ ĐĂNG KÝ
 */
export const registerHandler = async (
  request: FastifyRequest<{ Body: RegisterInput }>,
  reply: FastifyReply,
) => {
  try {
    const context = {
      ip: request.ip,
      userAgent: request.headers["user-agent"] || "Unknown",
    };

    // Gọi thẳng sang service xử lý nghiệp vụ phức tạp
    const newUser = await AuthService.register(request.body, context);

    // Ký mã Token kích hoạt email (Hạn 30 phút)
    const verificationToken = request.server.jwt.sign(
      { userId: newUser.id, email: newUser.email },
      { expiresIn: "30m" },
    );
    request.server.log.info(
      `[MAIL] Gửi link kích hoạt kèm Token: ${verificationToken}`,
    );

    return reply.status(201).send({
      success: true,
      message: "Đăng ký thành công. Vui lòng kiểm tra email để xác thực.",
    });
  } catch (error: any) {
    if (error.message === "AUTH_EMAIL_EXISTS") {
      return reply
        .status(400)
        .send({ success: false, message: "Email đã được sử dụng." });
    }

    request.server.log.error(error);
    return reply
      .status(500)
      .send({ success: false, message: "Đã có lỗi hệ thống xảy ra." });
  }
};

/**
 * XỬ LÝ ĐĂNG NHẬP
 */
export const loginHandler = async (
  request: FastifyRequest<{ Body: LoginInput }>,
  reply: FastifyReply,
) => {
  try {
    const { email, password } = request.body;
    const context = {
      ip: request.ip,
      userAgent: request.headers["user-agent"] || "Unknown",
    };

    // Gọi service để xác thực thông tin
    const user = await AuthService.login(email, password, context);

    // Tạo cặp mã Access Token và Refresh Token
    const payload = { userId: user.id, email: user.email, role: user.role };
    const accessToken = request.server.jwt.sign(payload, { expiresIn: "30m" });
    const refreshToken = request.server.jwt.sign(payload, { expiresIn: "7d" });

    return reply.status(200).send({
      success: true,
      message: "Đăng nhập thành công.",
      data: { accessToken, refreshToken, user },
    });
  } catch (error: any) {
    if (error.message === "AUTH_ACCOUNT_UNVERIFIED") {
      return reply.status(403).send({
        success: false,
        message:
          "Tài khoản của bạn chưa kích hoạt email. Vui lòng kiểm tra hộp thư để xác thực trước khi đăng nhập.",
      });
    }
    if (error.message === "AUTH_INVALID_CREDENTIALS") {
      return reply
        .status(400)
        .send({
          success: false,
          message: "Tài khoản hoặc mật khẩu không chính xác.",
        });
    }
    if (error.message === "AUTH_ACCOUNT_BANNED") {
      return reply
        .status(403)
        .send({
          success: false,
          message: "Tài khoản của bạn đang bị khóa vĩnh viễn.",
        });
    }
    if (error.message === "AUTH_ACCOUNT_LOCKED") {
      return reply
        .status(403)
        .send({
          success: false,
          message: "Tài khoản của bạn đang bị tạm khóa.",
        });
    }

    request.server.log.error(error);
    return reply
      .status(500)
      .send({ success: false, message: "Đã có lỗi hệ thống xảy ra." });
  }
};

/**
 * XỬ LÝ XÁC THỰC EMAIL
 */
export const verifyEmailHandler = async (
  request: FastifyRequest<{ Querystring: VerifyEmailQuery }>,
  reply: FastifyReply,
) => {
  try {
    const { token } = request.query;
    const context = {
      ip: request.ip,
      userAgent: request.headers["user-agent"] || "Unknown",
    };

    // 1. Giải mã và kiểm tra tính hợp lệ của Token bằng Fastify JWT
    let decoded: { userId: number; email: string };
    try {
      decoded = request.server.jwt.verify(token);
    } catch (jwtError: any) {
      // Bắt trường hợp mã lỗi JWT hết hạn hoặc mã giả mạo
      const msg =
        jwtError.name === "TokenExpiredError"
          ? "Mã xác thực đã hết hạn (30 phút). Vui lòng yêu cầu gửi lại mã mới."
          : "Mã xác thực không hợp lệ.";
      return reply.status(400).send({ success: false, message: msg });
    }

    // 2. Gọi Service cập nhật trạng thái tài khoản
    await AuthService.activateUser(decoded.userId, context);

    return reply.status(200).send({
      success: true,
      message:
        "Tài khoản của bạn đã được xác thực thành công. Bây giờ bạn có thể đăng nhập.",
    });
  } catch (error: any) {
    if (error.message === "AUTH_USER_NOT_FOUND") {
      return reply
        .status(404)
        .send({
          success: false,
          message: "Tài khoản không tồn tại trên hệ thống.",
        });
    }

    request.server.log.error(error);
    return reply
      .status(500)
      .send({ success: false, message: "Đã có lỗi hệ thống xảy ra." });
  }
};

/**
 * XỬ LÝ YÊU CẦU QUÊN MẬT KHẨU
 */
export const forgotPasswordHandler = async (
  request: FastifyRequest<{ Body: ForgotPasswordInput }>,
  reply: FastifyReply,
) => {
  try {
    const { email } = request.body;

    const user = await AuthService.verifyEmailForReset(email);

    // Sinh mã token khôi phục mật khẩu (Hạn ngắn: 15 phút)
    const resetToken = request.server.jwt.sign(
      { userId: user.id, purpose: "reset_password" },
      { expiresIn: "15m" },
    );

    // Log ra terminal để phục vụ kiểm thử dưới local
    request.server.log.info(
      `[MAIL] Link khôi phục mật khẩu Token: ${resetToken}`,
    );

    return reply.status(200).send({
      success: true,
      message: "Hướng dẫn khôi phục mật khẩu đã được gửi tới email của bạn.",
    });
  } catch (error: any) {
    // Để bảo mật, không nên cho hacker biết email có tồn tại hay không.
    // Nhưng ở đây hệ thống trả thông báo chung chung hoặc xử lý tùy nhu cầu của bạn
    if (error.message === "AUTH_USER_NOT_FOUND") {
      return reply.status(200).send({
        success: true,
        message: "Hướng dẫn khôi phục mật khẩu đã được gửi tới email của bạn.",
      });
    }
    if (error.message === "AUTH_ACCOUNT_BANNED") {
      return reply
        .status(403)
        .send({ success: false, message: "Tài khoản đang bị khóa vĩnh viễn." });
    }

    request.server.log.error(error);
    return reply
      .status(500)
      .send({ success: false, message: "Đã có lỗi hệ thống xảy ra." });
  }
};

/**
 * XỬ LÝ ĐẶT LẠI MẬT KHẨU MỚI
 */
export const resetPasswordHandler = async (
  request: FastifyRequest<{ Body: ResetPasswordInput }>,
  reply: FastifyReply,
) => {
  try {
    const { token, password } = request.body;
    const context = {
      ip: request.ip,
      userAgent: request.headers["user-agent"] || "Unknown",
    };

    // 1. Giải mã kiểm tra token
    let decoded: { userId: number; purpose: string };
    try {
      decoded = request.server.jwt.verify(token);
    } catch (jwtError: any) {
      const msg =
        jwtError.name === "TokenExpiredError"
          ? "Liên kết khôi phục đã hết hạn (15 phút)."
          : "Mã khôi phục không hợp lệ.";
      return reply.status(400).send({ success: false, message: msg });
    }

    // Kiểm tra mục đích sử dụng của Token tránh lấy Token kích hoạt email đem đi đổi pass
    if (decoded.purpose !== "reset_password") {
      return reply
        .status(400)
        .send({ success: false, message: "Mã khôi phục không hợp lệ." });
    }

    // 2. Đổi mật khẩu trong database thông qua Service
    await AuthService.resetPassword(decoded.userId, password, context);

    return reply.status(200).send({
      success: true,
      message:
        "Đặt lại mật khẩu thành công. Bạn có thể đăng nhập bằng mật khẩu mới.",
    });
  } catch (error: any) {
    request.server.log.error(error);
    return reply
      .status(500)
      .send({ success: false, message: "Đã có lỗi hệ thống xảy ra." });
  }
};

/**
 * XỬ LÝ LÀM MỚI TOKEN (REFRESH TOKEN)
 */
export const refreshTokenHandler = async (
  request: FastifyRequest<{ Body: RefreshTokenInput }>,
  reply: FastifyReply,
) => {
  try {
    const { refreshToken } = request.body;
    const context = {
      ip: request.ip,
      userAgent: request.headers["user-agent"] || "Unknown",
    };

    // 1. Giải mã kiểm tra chữ ký và hạn dùng cơ bản
    let decoded: { userId: number; email: string; role: string };
    try {
      decoded = request.server.jwt.verify(refreshToken);
    } catch (jwtError) {
      return reply
        .status(401)
        .send({
          success: false,
          message: "Phiên đăng nhập không hợp lệ hoặc đã hết hạn.",
        });
    }

    // 2. Kiểm tra trạng thái user và token đã bị hủy ở DB chưa
    const user = await AuthService.validateUserForTokenRefresh(
      decoded.userId,
      refreshToken,
      context,
    );

    // 3. Cấp Access Token mới - ĐỒNG NHẤT PAYLOAD VỚI LOGIN (Bao gồm cả role)
    const payload = { userId: user.id, email: user.email, role: user.role };
    const newAccessToken = request.server.jwt.sign(payload, {
      expiresIn: "30m", // Thời gian ngắn hợp lý cho Access Token
    });

    return reply.status(200).send({
      success: true,
      message: "Làm mới token thành công.",
      data: { accessToken: newAccessToken },
    });
  } catch (error: any) {
    if (error.message === "AUTH_TOKEN_REVOKED") {
      return reply.status(401).send({
        success: false,
        message:
          "Token đã bị vô hiệu hóa do bạn đã đăng xuất trước đó. Vui lòng đăng nhập lại.",
      });
    }

    if (
      error.message === "AUTH_USER_NOT_FOUND" ||
      error.message.startsWith("AUTH_ACCOUNT_")
    ) {
      return reply
        .status(403)
        .send({
          success: false,
          message: "Tài khoản không đủ điều kiện hoặc bị khóa.",
        });
    }

    request.server.log.error(error);
    return reply
      .status(500)
      .send({ success: false, message: "Đã có lỗi hệ thống xảy ra." });
  }
};

/**
 * XỬ LÝ ĐĂNG XUẤT (LOGOUT)
 */
export const logoutHandler = async (
  request: FastifyRequest<{ Body: RefreshTokenInput }>,
  reply: FastifyReply,
) => {
  try {
    const { refreshToken } = request.body;
    const authHeader = request.headers.authorization;

    // Lấy accessToken từ Header (nếu có)
    const accessToken =
      authHeader && authHeader.startsWith("Bearer ")
        ? authHeader.split(" ")[1]
        : null;

    const context = {
      ip: request.ip,
      userAgent: request.headers["user-agent"] || "Unknown",
    };

    // Giải mã để lấy userId phục vụ ghi log đăng xuất
    try {
      const decoded: { userId: number } =
        request.server.jwt.verify(refreshToken);

      // Cập nhật: Truyền thêm cả accessToken và refreshToken vào hàm logout để xử lý hủy
      await AuthService.logout(
        decoded.userId,
        { accessToken, refreshToken },
        context,
      );
    } catch (error) {
      // Nếu refreshToken sai hoặc hết hạn sẵn rồi, thử giải mã accessToken để lấy userId ghi log
      try {
        if (accessToken) {
          const decodedAccess: { userId: number } =
            request.server.jwt.verify(accessToken);
          await AuthService.logout(
            decodedAccess.userId,
            { accessToken, refreshToken },
            context,
          );
        }
      } catch (err) {
      }
    }

    return reply.status(200).send({
      success: true,
      message: "Đăng xuất thành công.",
    });
  } catch (error) {
    request.server.log.error(error);
    return reply
      .status(500)
      .send({ success: false, message: "Đã có lỗi hệ thống xảy ra." });
  }
};