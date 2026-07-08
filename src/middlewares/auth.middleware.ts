import { FastifyReply, FastifyRequest } from 'fastify';

// Định nghĩa cấu trúc Payload có trong Access Token của bạn
interface JwtPayload {
  userId: number;
  email: string;
  role: string;
}

export const authenticate = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return reply.status(401).send({
        success: false,
        message: 'Không tìm thấy mã xác thực. Vui lòng đăng nhập.'
      });
    }

    const token = authHeader.split(' ')[1];
    
    // SỬA TẠI ĐÂY: Ép kiểu tường minh bằng từ khóa "as"
    const decoded = request.server.jwt.verify(token) as JwtPayload;

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