import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export class NotificationService {
  /**
   * 1. USER: LẤY DANH SÁCH THÔNG BÁO (CÓ PHÂN TRANG)
   */
  static async getUserNotifications(userId: number, page = 1, limit = 10) {
    const skip = (page - 1) * limit;

    // Lọc: Thông báo của chính user ĐÓ hoặc thông báo TOÀN HỆ THỐNG (userId: null)
    const whereClause = {
      OR: [{ userId: userId }, { userId: null }],
    };

    const [total, notifications] = await prisma.$transaction([
      prisma.notification.count({ where: whereClause }),
      prisma.notification.findMany({
        where: whereClause,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          globalReads: {
            where: { userId }, // Kiểm tra xem user hiện tại đã đọc thông báo global này chưa
          },
        },
      }),
    ]);

    // Format dữ liệu trả về: Mix giữa isRead cũ (cá nhân) và globalReads mới (hệ thống)
    const formattedData = notifications.map((notif) => {
      let isReadStatus = notif.isRead;

      // Nếu là thông báo Toàn hệ thống, trạng thái đọc phụ thuộc vào bảng phụ globalReads
      if (notif.userId === null) {
        isReadStatus = notif.globalReads.length > 0;
      }

      return {
        id: notif.id,
        title: notif.title,
        content: notif.content,
        isGlobal: notif.userId === null,
        isRead: isReadStatus,
        createdAt: notif.createdAt,
      };
    });

    return {
      notifications: formattedData,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * 2. USER: ĐÁNH DẤU MỘT THÔNG BÁO LÀ ĐÃ ĐỌC
   */
  static async markAsRead(notificationId: number, userId: number) {
    const notif = await prisma.notification.findFirst({
      where: {
        id: notificationId,
        OR: [{ userId }, { userId: null }],
      },
    });

    if (!notif) throw new Error("Thông báo không tồn tại.");

    if (notif.userId === null) {
      // Nếu là thông báo hệ thống -> Ghi nhận vào bảng phụ đọc bài global
      await prisma.globalNotificationRead.upsert({
        where: { notificationId_userId: { notificationId: notif.id, userId } },
        update: {},
        create: { notificationId: notif.id, userId },
      });
    } else {
      // Nếu là thông báo cá nhân -> Cập nhật trực tiếp cột isRead cũ của bạn
      await prisma.notification.update({
        where: { id: notificationId },
        data: { isRead: true },
      });
    }

    return { success: true };
  }

  /**
   * 3. USER: ĐÁNH DẤU TẤT CẢ LÀ ĐÃ ĐỌC
   */
  static async markAllAsRead(userId: number) {
    // A. Đối với thông báo cá nhân: Chuyển toàn bộ isRead sang true
    await prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });

    // B. Đối với thông báo hệ thống: Tìm các thông báo global mà user chưa đọc để chèn vào bảng phụ
    const unreadGlobalNotifs = await prisma.notification.findMany({
      where: {
        userId: null,
        globalReads: { none: { userId } },
      },
      select: { id: true },
    });

    if (unreadGlobalNotifs.length > 0) {
      const recordsToInsert = unreadGlobalNotifs.map((notif) => ({
        notificationId: notif.id,
        userId: userId,
      }));
      await prisma.globalNotificationRead.createMany({ data: recordsToInsert });
    }

    return { success: true };
  }

  /**
   * 4. SYSTEM / AUTOMATION: TỰ ĐỘNG GỬI KHI NẠP TIỀN THÀNH CÔNG (GIỮ LOGIC CŨ)
   */
  static async sendToUser(userId: number, title: string, content: string) {
    const userExists = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });

    if (!userExists) {
      throw new Error(
        `Gửi thông báo thất bại: Người dùng (ID: ${userId}) không tồn tại trong hệ thống.`,
      );
    }

    return await prisma.notification.create({
      data: {
        userId,
        title,
        content,
        isRead: false,
      },
    });
  }

  /**
   * 5. ADMIN: GỬI THÔNG BÁO TOÀN HỆ THỐNG (Bằng cách set userId = null)
   */
  static async sendToAll(title: string, content: string) {
    return await prisma.notification.create({
      data: {
        userId: null, // Gắn bằng null để định danh đây là thông báo Global
        title,
        content,
        isRead: false,
      },
    });
  }
}
