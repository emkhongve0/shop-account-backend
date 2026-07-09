import {
  PrismaClient,
  ProductStatus,
  AccountStatus,
  OrderStatus,
} from "@prisma/client";

const prisma = new PrismaClient();

// Hàm tiện ích sinh mã đơn hàng chuyên nghiệp dạng ORD-YYMMDDXXXX
function generateOrderCode(): string {
  const date = new Date();
  const yy = date.getFullYear().toString().slice(-2);
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const random = Math.floor(1000 + Math.random() * 9000); // 4 số ngẫu nhiên ngẫu hứng
  return `ORD-${yy}${mm}${dd}${random}`;
}

export class PurchaseService {
  /**
   * HÀM XỬ LÝ MUA HÀNG TỰ ĐỘNG (ACID TRANSACTION) - CẬP NHẬT LOGIC ĐƠN HÀNG NÂNG CAO
   */
  static async executePurchase(
    userId: number,
    productId: number,
    quantity: number,
  ) {
    if (quantity <= 0) throw new Error("Số lượng mua phải lớn hơn 0.");

    // Chạy toàn bộ luồng trong transaction để tránh bị trùng lặp nick khi nhiều người mua cùng lúc
    return await prisma.$transaction(async (tx) => {
      // 1. Kiểm tra sản phẩm có tồn tại và đang ACTIVE không
      const product = await tx.product.findUnique({
        where: { id: productId },
      });

      if (!product || product.status !== ProductStatus.ACTIVE) {
        throw new Error("Sản phẩm không tồn tại hoặc đã bị ẩn.");
      }

      // 2. Tìm các tài khoản đang AVAILABLE để chuẩn bị mua
      const availableAccounts = await tx.account.findMany({
        where: { productId: productId, status: AccountStatus.AVAILABLE },
        take: quantity, // Chỉ lấy đúng số lượng khách cần mua
        orderBy: { id: "asc" }, // Ưu tiên các nick nhập kho trước
      });

      if (availableAccounts.length < quantity) {
        throw new Error(
          `Kho hàng không đủ. Hiện chỉ còn ${availableAccounts.length} tài khoản.`,
        );
      }

      const accountIds = availableAccounts.map((acc) => acc.id);

      // 🔥 BƯỚC KHÓA (LOCK): Chuyển trạng thái sang RESERVED ngay lập tức
      // Tránh tuyệt đối trường hợp 2 user mua trùng tài khoản tại cùng một mili giây
      await tx.account.updateMany({
        where: { id: { in: accountIds } },
        data: { status: AccountStatus.RESERVED },
      });

      // 3. Kiểm tra tiền ví User
      const totalPrice = product.price * quantity;
      const user = await tx.user.findUnique({ where: { id: userId } });

      if (!user || user.balance < totalPrice) {
        // ❌ THẤT BẠI: Hủy giữ chỗ, trả RESERVED về lại AVAILABLE
        await tx.account.updateMany({
          where: { id: { in: accountIds } },
          data: { status: AccountStatus.AVAILABLE },
        });
        throw new Error(
          `Số dư tài khoản không đủ. Bạn cần thêm ${totalPrice - (user?.balance || 0)}đ.`,
        );
      }

      try {
        const balanceBefore = user.balance;
        const balanceAfter = user.balance - totalPrice;

        // 4. TRỪ TIỀN
        await tx.user.update({
          where: { id: userId },
          data: { balance: balanceAfter },
        });

        // 5. GHI LỊCH SỬ VÍ (Giữ nguyên logic cũ của bạn với type "BUY")
        await tx.walletTransaction.create({
          data: {
            userId: userId,
            type: "BUY",
            amount: totalPrice,
            balanceBefore,
            balanceAfter,
            description: `Mua ${quantity}x sản phẩm: ${product.name}`,
          },
        });

        // 5. THÀNH CÔNG: Chuyển RESERVED -> SOLD
        const extractedData = availableAccounts
          .map((acc) => acc.accountData)
          .join("\n");

        await tx.account.updateMany({
          where: { id: { in: accountIds } },
          data: { status: AccountStatus.SOLD },
        });

        // 6. TẠO ĐƠN HÀNG (🔥 Cập nhật từ Model cũ sang cấu trúc 3 bảng phân tách mới)
        const orderCode = generateOrderCode();

        const order = await tx.order.create({
          data: {
            orderCode: orderCode,
            userId: userId,
            totalAmount: totalPrice,
            totalQuantity: quantity,
            status: OrderStatus.COMPLETED,
            completedAt: new Date(),
            items: {
              create: {
                productId: product.id,
                productName: product.name, // Khóa cứng tên sản phẩm tại thời điểm mua
                quantity: quantity,
                unitPrice: product.price, // Khóa cứng giá sản phẩm tại thời điểm mua
                totalPrice: totalPrice,
              },
            },
            accounts: {
              create: availableAccounts.map((acc) => ({
                accountData: acc.accountData, // Lưu trữ danh sách acc phục vụ bảo mật 30 ngày tự xóa
              })),
            },
          },
        });

        // 8. Xuất hàng trả về cho khách (Giữ nguyên cấu trúc trả về, đổi orderId cũ thành orderCode chuyên nghiệp)
        return {
          orderId: order.id, // Vẫn là id của Order (bây giờ là chuỗi UUID)
          orderCode: order.orderCode, // Bổ sung mã ORD- để hiển thị phía Frontend
          productName: product.name,
          quantity,
          totalPrice,
          balanceAfter,
          accounts: extractedData, // Trả chuỗi text phân tách bằng dấu xuống dòng để khách sao chép tiện lợi
        };
      } catch (error) {
        // ❌ HOÀN TÁC (FALLBACK): Nếu có bất kỳ lỗi hệ thống nào xảy ra khi trừ tiền/tạo order
        await tx.account.updateMany({
          where: { id: { in: accountIds } },
          data: { status: AccountStatus.AVAILABLE },
        });
        throw error;
      }
    });
  }
}
