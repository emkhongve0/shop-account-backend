import { PrismaClient, OrderStatus } from "@prisma/client";

const prisma = new PrismaClient();

export class OrderService {
  /**
   * 1. USER: LẤY DANH SÁCH ĐƠN HÀNG + TÌM KIẾM + LỌC THEO THỜI GIAN
   */
  static async getUserOrders(
    userId: number,
    query: {
      orderCode?: string;
      productName?: string;
      status?: OrderStatus;
      timeRange?: "today" | "7days" | "30days";
    },
  ) {
    const whereClause: any = { userId };

    if (query.orderCode) {
      whereClause.orderCode = { contains: query.orderCode };
    }

    if (query.status) {
      whereClause.status = query.status;
    }

    if (query.productName) {
      whereClause.items = {
        some: { productName: { contains: query.productName } },
      };
    }

    // Lọc khoảng thời gian nâng cao
    if (query.timeRange) {
      const now = new Date();
      let startDate = new Date();

      if (query.timeRange === "today") {
        startDate.setHours(0, 0, 0, 0);
      } else if (query.timeRange === "7days") {
        startDate.setDate(now.getDate() - 7);
      } else if (query.timeRange === "30days") {
        startDate.setDate(now.getDate() - 30);
      }

      whereClause.createdAt = { gte: startDate };
    }

    return await prisma.order.findMany({
      where: whereClause,
      include: {
        items: true, // Hiển thị sản phẩm đã mua
      },
      orderBy: { createdAt: "desc" },
    });
  }

  /**
   * 2. USER: XEM CHI TIẾT ĐƠN HÀNG MÌNH ĐÃ MUA
   */
  static async getUserOrderDetails(orderId: string, userId: number) {
    const order = await prisma.order.findFirst({
      where: { id: orderId, userId },
      include: {
        items: true,
        accounts: { select: { accountData: true } }, // Trả về tài khoản đã giao
      },
    });

    if (!order)
      throw new Error(
        "Không tìm thấy đơn hàng hoặc bạn không có quyền xem đơn này.",
      );
    return order;
  }

  /**
   * 3. ADMIN: XEM TOÀN BỘ ĐƠN HÀNG + TÌM KIẾM THEO USER/EMAIL/MÃ ĐƠN
   */
  static async getAdminOrders(query: {
    orderCode?: string;
    searchKey?: string;
  }) {
    const whereClause: any = {};

    if (query.orderCode) {
      whereClause.orderCode = { contains: query.orderCode };
    }

    // Tìm kiếm hỗn hợp theo cả tên User hoặc Email của người mua
    if (query.searchKey) {
      whereClause.user = {
        OR: [
          { email: { contains: query.searchKey } },
        ],
      };
    }

    return await prisma.order.findMany({
      where: whereClause,
      include: {
        user: { select: { email: true } },
        items: true,
      },
      orderBy: { createdAt: "desc" },
    });
  }

  /**
   * 4. ADMIN: XEM CHI TIẾT ĐƠN HÀNG + THÔNG TIN THANH TOÁN (LOGS)
   */
  static async getAdminOrderDetails(orderId: string) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        user: {
          select: { id: true, email: true, balance: true },
        },
        items: true,
        accounts: true, // Danh sách tài khoản đã giao
      },
    });

    if (!order) throw new Error("Đơn hàng không tồn tại.");
    return order;
  }
}
