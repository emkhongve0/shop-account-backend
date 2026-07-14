import { PrismaClient } from '@prisma/client';
import * as argon2 from "argon2";
import axios from "axios";

const prisma = new PrismaClient();

interface AuthContext {
  ip: string;
  userAgent: string;
}

export class AuthService {
  // 1. Chuẩn hóa Email về chữ thường
  /**
   * 1. CHUẨN HÓA EMAIL - Triệt tiêu hoàn toàn các biến thể clone của Gmail
   * Bảo vệ hệ thống khỏi lỗ hổng lách luật tạo hàng loạt tài khoản clone trỏ về cùng 1 hòm thư.
   */
  static normalizeEmail(email: string): string {
    // Chuyển về chữ thường và cắt khoảng trắng hai đầu
    const lowercaseEmail = email.trim().toLowerCase();

    // Nếu không phải đuôi Gmail, áp dụng chuẩn hóa cơ bản
    if (!lowercaseEmail.endsWith("@gmail.com")) {
      return lowercaseEmail;
    }

    // Tách phần tên (local part) và tên miền (domain)
    const [localPart, domain] = lowercaseEmail.split("@");

    // Loại bỏ phần ký tự mở rộng từ sau dấu cộng "+" (Ví dụ: "abc+clone@gmail.com" -> "abc")
    let cleanLocalPart = localPart.split("+")[0];

    // Loại bỏ toàn bộ dấu chấm "." (Ví dụ: "a.b.c@gmail.com" -> "abc")
    cleanLocalPart = cleanLocalPart.replace(/\./g, "");

    // Ghép lại thành chuỗi email làm sạch duy nhất
    return `${cleanLocalPart}@${domain}`;
  }

  // 2. Tìm kiếm User theo Email (Tự động dùng logic normalize mới ở trên)
  static async findUserByEmail(email: string) {
    return await prisma.user.findUnique({
      where: { email: this.normalizeEmail(email) }, // Đã đồng bộ
    });
  }

  // 3. Ghi Nhật ký hệ thống (Log)
  static async createAuthLog(
    userId: number,
    action: string,
    context: AuthContext,
  ) {
    const device = context.userAgent.includes("Mobile") ? "Mobile" : "Desktop"; //
    await prisma.authLog.create({
      data: {
        userId,
        action,
        ip: context.ip,
        userAgent: context.userAgent,
        device,
        country: "Unknown",
      }, //
    });
  }

  /**
   * Xác thực mã Captcha (Turnstile) gửi từ Frontend lên server Cloudflare
   */
  private static async verifyTurnstileToken(
    token: string,
    ip?: string,
  ): Promise<boolean> {
    // Bỏ qua khi phát triển
    if (
      process.env.NODE_ENV !== "production" ||
      process.env.SKIP_TURNSTILE === "true"
    ) {
      console.log("🟡 Turnstile được bỏ qua (Development Mode)");
      return true;
    }

    const secretKey = process.env.TURNSTILE_SECRET_KEY?.replace(/^"|"$/g, "");

    if (!secretKey) {
      console.error("❌ TURNSTILE_SECRET_KEY chưa được cấu hình.");
      return false;
    }

    if (!token) {
      console.warn("⚠️ Không nhận được Turnstile token.");
      return false;
    }

    try {
      const formData = new URLSearchParams();
      formData.append("secret", secretKey);
      formData.append("response", token);

      // remoteip là tùy chọn
      if (ip && ip !== "::1" && ip !== "127.0.0.1") {
        formData.append("remoteip", ip);
      }

      const { data } = await axios.post(
        "https://challenges.cloudflare.com/turnstile/v0/siteverify",
        formData,
        {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          timeout: 5000,
        },
      );

      if (!data.success) {
        console.warn("❌ Turnstile verify thất bại:", data["error-codes"]);
      }

      return data.success === true;
    } catch (error: any) {
      console.error("❌ Lỗi Turnstile:", error.response?.data || error.message);
      return false;
    }
  }

  /**
   * LOGIC ĐĂNG KÝ TÀI KHOẢN (ĐÃ TỐI ƯU TỐC ĐỘ + BẢO MẬT CAPTCHA)
   */
  static async register(
    data: {
      displayName: string;
      email: string;
      password: string;
      captchaToken: string;
    }, // Bổ sung nhận captchaToken từ Schema mới
    context: AuthContext,
  ) {
    // 1. CHẶN BOT TỪ CỬA: Xác thực Captcha trước khi xử lý các logic nặng tốn CPU
    const isHuman = await this.verifyTurnstileToken(
      data.captchaToken,
      context.ip,
    );
    if (!isHuman) {
      throw new Error("AUTH_CAPTCHA_FAILED"); // Trả về lỗi lập tức nếu phát hiện Bot/Script tool
    }

    // 2. CHUẨN HÓA EMAIL (Bẻ gãy trò clone Gmail)
    const normalizedEmail = this.normalizeEmail(data.email);

    // 3. TỐI ƯU CPU: Chỉ tốn sức băm mật khẩu khi đã chắc chắn đây là người thật
    const passwordHash = await argon2.hash(data.password);

    try {
      // 4. TỐI ƯU TỐC ĐỘ: Rút ngắn transaction, chỉ giữ lại phần Core ghi DB
      const newUser = await prisma.$transaction(async (tx) => {
        return await tx.user.create({
          data: {
            displayName: data.displayName,
            email: normalizedEmail,
            passwordHash,
            status: "PENDING",
            role: "USER",
          },
          select: {
            id: true,
            displayName: true,
            email: true,
            status: true,
            role: true,
            createdAt: true,
          },
        });
      });

      // 5. TỐI ƯU PHẢN HỒI (FIRE-AND-FORGET):
      // Không dùng `await` ở đây để Server trả kết quả về cho người dùng NGAY LẬP TỨC.
      this.createAuthLog(newUser.id, "REGISTER", context).catch((err) => {
        console.error("Ghi log đăng ký thất bại ngầm:", err);
      });

      return newUser;
    } catch (error: any) {
      if (error.code === "P2002" && error.meta?.target?.includes("email")) {
        throw new Error("AUTH_EMAIL_EXISTS");
      }
      throw error;
    }
  }

  /**
   * LOGIC ĐĂNG NHẬP (LOGIN)
   */
  static async login(email: string, password: string, context: AuthContext) {
    // 1. Chuẩn hóa email ngay từ đầu để tăng tính chính xác khi tìm kiếm
    const normalizedEmail = this.normalizeEmail(email);
    const user = await this.findUserByEmail(normalizedEmail);

    // Kiểm tra tài khoản tồn tại
    if (!user) {
      throw new Error("AUTH_INVALID_CREDENTIALS");
    }

    // 2. Chặn đăng nhập nếu tài khoản ở trạng thái PENDING
    if (user.status === "PENDING") {
      // TỐI ƯU: Ghi log ngầm không await để tăng tốc độ phản hồi API
      this.createAuthLog(user.id, "LOGIN_ATTEMPT_PENDING", context).catch(
        (err) => console.error("Ghi log PENDING thất bại ngầm:", err),
      );
      throw new Error("AUTH_ACCOUNT_UNVERIFIED");
    }

    // 3. Kiểm tra trạng thái tài khoản bị khóa/cấm khác
    if (user.status === "BANNED" || user.status === "LOCKED") {
      this.createAuthLog(
        user.id,
        `LOGIN_ATTEMPT_${user.status}`,
        context,
      ).catch((err) =>
        console.error(`Ghi log ${user.status} thất bại ngầm:`, err),
      );
      throw new Error(`AUTH_ACCOUNT_${user.status}`);
    }

    // 4. TỐI ƯU CPU: So sánh mật khẩu bằng Argon2 cực nhanh (~30ms)
    const isPasswordValid = await argon2.verify(user.passwordHash, password);
    if (!isPasswordValid) {
      this.createAuthLog(user.id, "LOGIN_FAIL", context).catch((err) =>
        console.error("Ghi log LOGIN_FAIL thất bại ngầm:", err),
      );
      throw new Error("AUTH_INVALID_CREDENTIALS");
    }

    // 5. Đăng nhập thành công -> Ghi log thành công ngầm
    this.createAuthLog(user.id, "LOGIN_SUCCESS", context).catch((err) =>
      console.error("Ghi log LOGIN_SUCCESS thất bại ngầm:", err),
    );

    // Trả về dữ liệu sạch cho Controller, loại bỏ hoàn toàn nguy cơ lộ passwordHash
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
    // 1. TỐI ƯU CPU: Băm mật khẩu mới bằng Argon2 cực nhanh (~30ms) và bảo mật hơn Bcrypt
    const passwordHash = await argon2.hash(newPassword);

    // 2. Cập nhật mật khẩu mới vào DB
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    // 3. TỐI ƯU PHẢN HỒI (FIRE-AND-FORGET):
    // Không dùng `await` để người dùng nhận được thông báo đổi mật khẩu thành công ngay lập tức.
    // Việc ghi log hệ thống sẽ được đẩy xuống chạy ngầm ở chế độ nền.
    this.createAuthLog(userId, "RESET_PASSWORD_SUCCESS", context).catch(
      (err) => {
        console.error("Ghi log đổi mật khẩu thất bại ngầm:", err);
      },
    );
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

    if (user.status === "PENDING") {
      // Thay "PENDING" bằng giá trị enum chính xác trong DB của bạn
      throw new Error("AUTH_ACCOUNT_UNVERIFIED");
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
