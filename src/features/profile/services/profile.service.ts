import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import { ChangePasswordInput } from '../schemas/profile.schema';

const prisma = new PrismaClient();

export class ProfileService {
  /**
   * Lấy thông tin chi tiết Profile kèm số dư
   */
  static async getProfile(userId: number) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        displayName: true,
        email: true,
        status: true,
        balance: true, // Lấy luôn số dư tài khoản
        createdAt: true,
      },
    });

    if (!user) {
      throw new Error("USER_NOT_FOUND");
    }

    return user;
  }

  /**
   * Cập nhật thông tin cá nhân
   */
  static async updateProfile(userId: number, data: { displayName: string }) {
    return await prisma.user.update({
      where: { id: userId },
      data: { displayName: data.displayName },
      select: {
        id: true,
        displayName: true,
        email: true,
        balance: true,
      },
    });
  }

  /**
   * LOGIC ĐỔI MẬT KHẨU (GIỚI HẠN 1 GIỜ / LẦN)
   */
  static async changePassword(
    userId: number,
    data: ChangePasswordInput,
    context: { ip: string; userAgent: string },
  ) {
    // 1. Kiểm tra log đổi mật khẩu thành công gần nhất của user này
    const lastChangeLog = await prisma.authLog.findFirst({
      where: {
        userId,
        action: "CHANGE_PASSWORD_SUCCESS",
      },
      orderBy: { createdAt: "desc" },
    });

    if (lastChangeLog) {
      const oneHourInMs = 60 * 60 * 1000;
      const timeSinceLastChange =
        Date.now() - new Date(lastChangeLog.createdAt).getTime();

      if (timeSinceLastChange < oneHourInMs) {
        const minutesLeft = Math.ceil(
          (oneHourInMs - timeSinceLastChange) / (60 * 1000),
        );
        throw new Error(`AUTH_CHANGE_PASSWORD_COOLDOWN:${minutesLeft}`);
      }
    }

    // 2. Tìm user để lấy mật khẩu hiện tại trong DB
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error("USER_NOT_FOUND");

    // 3. So sánh mật khẩu cũ xem đúng không
    const isPasswordValid = await bcrypt.compare(
      data.oldPassword,
      user.passwordHash,
    );
    if (!isPasswordValid) {
      throw new Error("AUTH_INVALID_OLD_PASSWORD");
    }

    // 4. Băm mật khẩu mới và cập nhật vào Database
    const saltRounds = 12;
    const newPasswordHash = await bcrypt.hash(data.newPassword, saltRounds);

    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newPasswordHash },
    });

    // 5. Ghi nhận log đổi mật khẩu thành công
    const device = context.userAgent.includes("Mobile") ? "Mobile" : "Desktop";
    await prisma.authLog.create({
      data: {
        userId,
        action: "CHANGE_PASSWORD_SUCCESS",
        ip: context.ip,
        userAgent: context.userAgent,
        device,
        country: "Unknown",
      },
    });
  }

  /**
   * 1. LẤY LỊCH SỬ ĐĂNG NHẬP (SECURITY LOG)
   * Hiển thị danh sách tất cả các hành động bảo mật của user
   */
  static async getLoginHistory(userId: number) {
    return await prisma.authLog.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" }, // Mới nhất xếp lên đầu
      take: 10, // Giới hạn lấy 10 bản ghi gần nhất để tránh nặng hệ thống
      select: {
        id: true,
        action: true,
        ip: true,
        userAgent: true,
        device: true,
        createdAt: true,
      },
    });
  }

  /**
   * 2. LẤY DANH SÁCH PHIÊN ĐANG HOẠT ĐỘNG (ACTIVE SESSIONS)
   * Nhận diện dựa trên thiết bị (userAgent) có Login gần nhất mà chưa Logout
   */
  static async getActiveSessions(userId: number) {
    // Lấy tất cả log liên quan đến trạng thái đăng nhập/xuất của user
    const logs = await prisma.authLog.findMany({
      where: {
        userId,
        action: { in: ["LOGIN_SUCCESS", "LOGOUT_SUCCESS"] },
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    });

    const activeSessions = [];
    const processedDevices = new Set<string>();

    // Duyệt từ mới nhất đến cũ nhất để gom nhóm theo thiết bị
    for (const log of logs) {
      const deviceKey = `${log.device}-${log.ip}`;

      if (!processedDevices.has(deviceKey)) {
        processedDevices.add(deviceKey);

        // Nếu log mới nhất của thiết bị này là LOGIN_SUCCESS -> Phiên đó vẫn đang sống!
        if (log.action === "LOGIN_SUCCESS") {
          activeSessions.push({
            id: log.id,
            ip: log.ip,
            userAgent: log.userAgent,
            device: log.device,
            lastActive: log.createdAt,
          });
        }
      }
    }

    return activeSessions;
  }
  /**
   * 1. LẤY LỊCH SỬ NẠP TIỀN
   */
  static async getDepositHistory(userId: number) {
    return await prisma.deposit.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        amount: true,
        method: true,
        status: true,
        description: true,
        createdAt: true,
        balanceBefore: true,
        balanceAfter: true,
      },
    });
  }

  /**
   * 2. LẤY LỊCH SỬ MUA HÀNG
   */
  static async getPurchaseHistory(userId: number) {
    return await prisma.order.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        orderCode: true, // ✨ Thêm mã đơn hiển thị (ORD-...) cho đẹp frontend
        totalAmount: true, //  Đổi thành tên cột mới chuẩn database
        totalQuantity: true, // ✨ Thêm tổng số lượng nếu cần
        status: true,
        createdAt: true,
      },
    });
  }

  /**
   * 1. LẤY DANH SÁCH THÔNG BÁO CỦA USER
   */
  static async getNotifications(userId: number) {
    // Ép chắc chắn userId đầu vào là số
    const currentUserId = Number(userId);

    const notifications = await prisma.notification.findMany({
      where: {
        OR: [
          { userId: currentUserId }, // Thông báo đích danh cho user này
          { userId: null }, // Thông báo toàn hệ thống
        ],
      },
      orderBy: { createdAt: "desc" },
    });

    const readGlobalLogs = await prisma.globalNotificationRead.findMany({
      where: { userId: currentUserId },
      select: { notificationId: true },
    });

    const readGlobalIds = new Set(
      readGlobalLogs.map((log) => log.notificationId),
    );

    return notifications.map((notification) => {
      const isGlobal = notification.userId === null;

      return {
        id: notification.id,
        title: notification.title,
        content: notification.content,
        isGlobal,
        createdAt: notification.createdAt,
        isRead: isGlobal
          ? readGlobalIds.has(notification.id)
          : notification.isRead,
      };
    });
  }

  /**
   * 2. ĐÁNH DẤU ĐỌC MỘT THÔNG BÁO CỤ THỂ (Bổ sung mới)
   */
  static async markAsRead(userId: number, notificationId: number) {
    const notification = await prisma.notification.findUnique({
      where: { id: notificationId },
    });

    if (!notification) throw new Error("NOTIFICATION_NOT_FOUND");

    if (notification.userId === null) {
      // Nếu là thông báo Hệ thống -> Ghi nhận vào bảng trung gian
      return await prisma.globalNotificationRead.upsert({
        where: {
          notificationId_userId: { notificationId, userId },
        },
        update: {},
        create: { notificationId, userId },
      });
    } else {
      // Nếu là thông báo cá nhân -> Chỉ update cho chính user đó nếu đúng quyền
      if (notification.userId !== userId) throw new Error("UNAUTHORIZED");
      return await prisma.notification.update({
        where: { id: notificationId },
        data: { isRead: true },
      });
    }
  }

  /**
   * 3. ĐÁNH DẤU TẤT CẢ THÔNG BÁO LÀ ĐÃ ĐỌC
   */
  static async markAllAsRead(userId: number) {
    // 3.1 Cập nhật toàn bộ thông báo cá nhân thành đã đọc
    await prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });

    // 3.2 Lấy danh sách các thông báo Global chưa đọc của user này
    const unreadGlobalNotis = await prisma.notification.findMany({
      where: {
        userId: null,
        globalReads: {
          none: { userId }, // Tìm các thông báo global chưa có vết user này đọc
        },
      },
      select: { id: true },
    });

    // 3.3 Ghi nhận toàn bộ thông báo Global đó vào bảng trung gian
    if (unreadGlobalNotis.length > 0) {
      const dataCreate = unreadGlobalNotis.map((n) => ({
        notificationId: n.id,
        userId: userId,
      }));

      await prisma.globalNotificationRead.createMany({
        data: dataCreate,
        skipDuplicates: true,
      });
    }
  }
}

