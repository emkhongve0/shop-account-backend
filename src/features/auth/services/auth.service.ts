import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

interface AuthContext {
  ip: string;
  userAgent: string;
}

export class AuthService {
  // 1. Chuẩn hóa Email về chữ thường
  static normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  // 2. Tìm kiếm User theo Email
  static async findUserByEmail(email: string) {
    return await prisma.user.findUnique({
      where: { email: this.normalizeEmail(email) },
    });
  }

  // 3. Ghi Nhật ký hệ thống (Log)
  static async createAuthLog(
    userId: number,
    action: string,
    context: AuthContext,
  ) {
    const device = context.userAgent.includes("Mobile") ? "Mobile" : "Desktop";
    await prisma.authLog.create({
      data: {
        userId,
        action,
        ip: context.ip,
        userAgent: context.userAgent,
        device,
        country: "Unknown",
      },
    });
  }

  /**
   * LOGIC ĐĂNG KÝ (REGISTER)
   */
  static async register(
    data: { displayName: string; email: string; password: string },
    context: AuthContext,
  ) {
    // Kiểm tra trùng email
    const isEmailUsed = await this.findUserByEmail(data.email);
    if (isEmailUsed) {
      throw new Error("AUTH_EMAIL_EXISTS");
    }

    // Băm mật khẩu bằng bcrypt (Salt rounds = 12)
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(data.password, saltRounds);

    // Lưu vào database
    const newUser = await prisma.user.create({
      data: {
        displayName: data.displayName,
        email: this.normalizeEmail(data.email),
        passwordHash,
        status: "PENDING",
        role: "USER",
      },
    });

    // Ghi log đăng ký thành công
    await this.createAuthLog(newUser.id, "REGISTER", context);

    return newUser;
  }

  /**
   * LOGIC ĐĂNG NHẬP (LOGIN)
   */
  static async login(email: string, password: string, context: AuthContext) {
    const user = await this.findUserByEmail(email);

    // Kiểm tra tài khoản tồn tại
    if (!user) {
      throw new Error("AUTH_INVALID_CREDENTIALS");
    }

    // Kiểm tra trạng thái tài khoản
    if (user.status === "BANNED" || user.status === "LOCKED") {
      await this.createAuthLog(
        user.id,
        `LOGIN_ATTEMPT_${user.status}`,
        context,
      );
      throw new Error(`AUTH_ACCOUNT_${user.status}`);
    }

    // So sánh mật khẩu
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      await this.createAuthLog(user.id, "LOGIN_FAIL", context);
      throw new Error("AUTH_INVALID_CREDENTIALS");
    }

    // Đăng nhập thành công -> Ghi log thành công
    await this.createAuthLog(user.id, "LOGIN_SUCCESS", context);

    return {
      id: user.id,
      displayName: user.displayName,
      email: user.email,
      status: user.status,
      role: user.role,
    };
  }

  /**
   * LOGIC XÁC THỰC EMAIL
   */
  static async activateUser(
    userId: number,
    context: { ip: string; userAgent: string },
  ) {
    // 1. Tìm user xem có tồn tại không
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new Error("AUTH_USER_NOT_FOUND");
    }

    // 2. Nếu đã ACTIVE rồi thì không cần làm lại
    if (user.status === "ACTIVE") {
      return user;
    }

    // 3. Cập nhật trạng thái thành ACTIVE
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { status: "ACTIVE" },
    });

    // 4. Ghi log kích hoạt thành công
    await this.createAuthLog(user.id, "VERIFY_EMAIL_SUCCESS", context);

    return updatedUser;
  }

  /**
   * LOGIC QUÊN MẬT KHẨU (FORGOT PASSWORD)
   */
  static async verifyEmailForReset(email: string) {
    const user = await this.findUserByEmail(email);
    // Nếu không thấy user, ném lỗi để controller xử lý bảo mật
    if (!user) {
      throw new Error("AUTH_USER_NOT_FOUND");
    }
    // Tránh cho phép đổi mật khẩu khi tài khoản bị khóa
    if (user.status === "BANNED") {
      throw new Error("AUTH_ACCOUNT_BANNED");
    }
    return user;
  }

  /**
   * LOGIC ĐẶT LẠI MẬT KHẨU (RESET PASSWORD)
   */
  static async resetPassword(
    userId: number,
    newPassword: string,
    context: { ip: string; userAgent: string },
  ) {
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(newPassword, saltRounds);

    // Cập nhật mật khẩu mới vào DB
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    // Ghi log đổi mật khẩu thành công
    await this.createAuthLog(userId, "RESET_PASSWORD_SUCCESS", context);
  }

  /**
   * CẬP NHẬT LOGIC KIỂM TRA REFRESH TOKEN (Chống dùng lại token đã logout)
   */
  static async validateUserForTokenRefresh(
    userId: number,
    token: string,
    context: any,
  ) {
    const user = await prisma.user.findUnique({ where: { id: userId } });

    if (!user) throw new Error("AUTH_USER_NOT_FOUND");
    if (user.status === "BANNED" || user.status === "LOCKED") {
      throw new Error(`AUTH_ACCOUNT_${user.status}`);
    }

    // [BẢO MẬT]: Kiểm tra xem sau lần Login gần nhất, người dùng đã ấn Logout chưa.
    // Tìm log mới nhất của user này liên quan đến Đăng nhập hoặc Đăng xuất
    const lastLog = await prisma.authLog.findFirst({
      where: { userId, action: { in: ["LOGIN_SUCCESS", "LOGOUT_SUCCESS"] } },
      orderBy: { createdAt: "desc" },
    });

    // Nếu hành động gần đây nhất là LOGOUT_SUCCESS, thì token này đã bị khai tử!
    if (lastLog && lastLog.action === "LOGOUT_SUCCESS") {
      throw new Error("AUTH_TOKEN_REVOKED");
    }

    return user;
  }

  /**
   * LOGIC ĐĂNG XUẤT (LOGOUT)
   */
  static async logout(
    userId: number,
    tokens: { accessToken: string | null; refreshToken: string },
    context: any,
  ) {
    // Hoạt động log cũ của bạn
    try {
      await this.createAuthLog(userId, "LOGOUT_SUCCESS", context);
    } catch (e) {}

    // Ghi đè bản ghi chặn bằng 30 ký tự cuối của token
    if (tokens.accessToken) {
      const tokenTail = tokens.accessToken.slice(-30); // Lấy 30 ký tự cuối

      await prisma.authLog.create({
        data: {
          userId: userId,
          action: "LOGOUT_SUCCESS",
          userAgent: `REVOKED_${tokenTail}`, // Lưu gọn gàng vào đây
          ip: context.ip || "0.0.0.0",
        },
      });
    }
  }
}
