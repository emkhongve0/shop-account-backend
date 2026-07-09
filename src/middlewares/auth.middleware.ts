import { FastifyReply, FastifyRequest } from "fastify";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Định nghĩa cấu trúc Payload có trong Access Token của bạn
interface JwtPayload {
  userId: number;
  email: string;
  role: string;
}

export const authenticate = async (
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  try {
    const authHeader = request.headers.authorization;

    // 1. SỬA LỖI: Kiểm tra nếu không có Header hoặc sai định dạng Bearer thì chặn ngay lập tức
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return reply.status(401).send({
        success: false,
        message: "Không tìm thấy mã xác thực. Vui lòng đăng nhập.",
      });
    }

    // Tách chuỗi lấy Access Token
    const token = authHeader.split(" ")[1];
    const tokenTail = token.slice(-30);

    // 2. 🔥 KIỂM TRA BLACKLIST: Quét mã vết trong bảng authLog
    const isRevoked = await prisma.authLog.findFirst({
      where: {
        action: "LOGOUT_SUCCESS",
        userAgent: {
          contains: `REVOKED_${tokenTail}`,
        },
      },
    });

    if (isRevoked) {
      return reply.status(401).send({
        success: false,
        message: "Mã xác thực đã hết hạn hoặc đã đăng xuất trước đó.",
      });
    }

    // 3. GIẢI MÃ JWT: Ép kiểu tường minh bằng từ khóa "as"
    const decoded = request.server.jwt.verify(token) as JwtPayload;

    // 4. TRUY VẤN KIỂM TRA TRẠNG THÁI THỰC TẾ TRONG DATABASE
    const userInDb = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { status: true },
    });

    // CHẶN: Nếu user không tồn tại hoặc có trạng thái bị khóa/cấm
    if (
      !userInDb ||
      userInDb.status === "LOCKED" ||
      userInDb.status === "BANNED"
    ) {
      return reply.status(403).send({
        success: false,
        message: "Tài khoản của bạn đã bị khóa hoặc cấm truy cập hệ thống.",
      });
    }

    // Gán thông tin người dùng vào request để các API phía sau sử dụng
    request.user = {
      id: decoded.userId,
      email: decoded.email,
      role: decoded.role,
    };
  } catch (error) {
    return reply.status(401).send({
      success: false,
      message: "Mã xác thực đã hết hạn hoặc không hợp lệ.",
    });
  }
};
