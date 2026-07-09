import { FastifyReply, FastifyRequest } from 'fastify';
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
// Định nghĩa cấu trúc Payload có trong Access Token của bạn
interface JwtPayload {
  userId: number;
  email: string;
  role: string;
}

export const authenticate = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return reply.status(401).send({
        success: false,
        message: "Không tìm thấy mã xác thực. Vui lòng đăng nhập.",
      });
    }

    const token = authHeader.split(" ")[1];
    // SỬA TẠI ĐÂY: Ép kiểu tường minh bằng từ khóa "as"
    const decoded = request.server.jwt.verify(token) as JwtPayload;

    // 🔥 TRUY VẤN KIỂM TRA TRẠNG THÁI THỰC TẾ TRONG DATABASE
    const userInDb = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { status: true },
    });

    //CHẶN: Nếu user không tồn tại hoặc có trạng thái bị khóa/cấm
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
    // Lúc này TypeScript đã biết decoded chắc chắn có userId và email
    request.user = {
      id: decoded.userId,
      email: decoded.email,
      role: decoded.role,
    };
  } catch (error) {
    return reply.status(401).send({
      success: false,
      message: 'Mã xác thực đã hết hạn hoặc không hợp lệ.'
    });
  }
};