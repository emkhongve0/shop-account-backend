import { PrismaClient, UserRole } from "@prisma/client";
import * as argon2 from "argon2";

const prisma = new PrismaClient();

export class AdminUserService {
  /**
   * 1. DANH SÁCH USER + PHÂN TRANG + BỘ LỌC CHUYÊN SÂU (Bám sát Schema cũ)
   */
  static async getAllUsers(query: {
    page?: number;
    limit?: number;
    id?: number;
    email?: string;
    status?: string; // Dạng String theo Schema của bạn
    role?: UserRole; // Dạng Enum UserRole [USER, ADMIN]
    startDate?: string;
    endDate?: string;
  }) {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const skip = (page - 1) * limit;

    const whereClause: any = {};

    if (query.id) whereClause.id = query.id;
    if (query.email) whereClause.email = { contains: query.email };
    if (query.status) whereClause.status = query.status;
    if (query.role) whereClause.role = query.role;

    if (query.startDate || query.endDate) {
      whereClause.createdAt = {};
      if (query.startDate)
        whereClause.createdAt.gte = new Date(query.startDate);
      if (query.endDate) whereClause.createdAt.lte = new Date(query.endDate);
    }

    const [total, users] = await prisma.$transaction([
      prisma.user.count({ where: whereClause }),
      prisma.user.findMany({
        where: whereClause,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          email: true,
          displayName: true,
          balance: true,
          role: true,
          status: true,
          createdAt: true,
        },
      }),
    ]);

    return {
      users,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  /**
   * 2. CHI TIẾT NGƯỜI DÙNG (Gộp thông tin lịch sử hệ thống của bạn)
   */
  static async getUserDetails(userId: number) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        displayName: true,
        balance: true,
        role: true,
        status: true,
        createdAt: true,
      },
    });

    if (!user) throw new Error("Người dùng không tồn tại.");

    // Lấy song song các lịch sử dựa trên các model quan hệ sẵn có của bạn
    const [walletHistory, orderHistory, authLogs] = await Promise.all([
      prisma.walletTransaction.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
      prisma.order.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 10,
        include: { items: true },
      }),
      // Sử dụng bảng authLogs sẵn có của bạn để lấy địa chỉ IP gần nhất và nhật ký
      prisma.authLog.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
    ]);

    return {
      profile: user,
      latestIp: authLogs[0]?.ip || "Chưa có dữ liệu IP",
      walletHistory,
      orderHistory,
      authLogs,
    };
  }

  /**
   * 3. SỬA THÔNG TIN CƠ BẢN & TRẠNG THÁI (Bao gồm khóa tài khoản bằng cách đổi trạng thái thành "LOCKED")
   */
  static async updateUser(
    userId: number,
    data: {
      email?: string;
      displayName?: string;
      role?: UserRole;
      status?: string;
    },
  ) {
    return await prisma.user.update({
      where: { id: userId },
      data,
      select: {
        id: true,
        email: true,
        displayName: true,
        role: true,
        status: true,
      },
    });
  }

  /**
   * 4. ĐẶT LẠI MẬT KHẨU (Khớp trường passwordHash)
   */
  static async resetPassword(userId: number, passwordNew: string) {
    // TỐI ƯU CPU: Băm mật khẩu mới bằng Argon2 cực nhanh và bảo mật hơn Bcrypt
    const hashedPassword = await argon2.hash(passwordNew);
    
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash: hashedPassword }, // 👉 Sử dụng chính xác passwordHash
    });
    
    return { success: true };
  }

  /**
   * 5. ĐIỀU CHỈNH SỐ DƯ (Bảo mật: Phép toán nguyên tử - Atomic Operation)
   */
  static async adjustBalance(
    userId: number,
    amount: number,
    description: string,
    adminId: number,
    idempotencyKey: string, // <- Bổ sung tham số
  ) {
    if (amount === 0) throw new Error("Số tiền điều chỉnh phải khác 0.");

    try {
      return await prisma.$transaction(async (tx) => {
        // 1. Cộng/trừ tiền bằng Atomic Operation
        const updatedUser = await tx.user.update({
          where: { id: userId },
          data: { balance: { increment: amount } },
          select: { id: true, displayName: true, balance: true },
        });

        if (updatedUser.balance < 0) {
          throw new Error(
            "Thao tác thất bại. Số dư sau khi trừ không được âm.",
          );
        }

        const balanceAfter = updatedUser.balance;
        const balanceBefore = balanceAfter - amount;
        const type = amount > 0 ? "ADMIN_INCREMENT" : "ADMIN_DECREMENT";
        const secureDescription = `[Thực hiện bởi Admin #${adminId}] ${description || "Điều chỉnh số dư"}`;

        // 2. Ghi lịch sử giao dịch CÙNG VỚI idempotencyKey
        await tx.walletTransaction.create({
          data: {
            userId,
            type,
            amount: Math.abs(amount),
            balanceBefore,
            balanceAfter,
            description: secureDescription,
            idempotencyKey, // <- Gắn chìa khóa vào đây
          },
        });

        return updatedUser;
      });
    } catch (error: any) {
      // 3. Xử lý lỗi trùng lặp do bấm đúp (Prisma Error Code P2002)
      if (
        error.code === "P2002" &&
        error.meta?.target?.includes("idempotencyKey")
      ) {
        throw new Error("DUPLICATE_REQUEST");
      }

      // Nếu là lỗi khác (như âm tiền), ném ra ngoài bình thường
      throw error;
    }
  }
}