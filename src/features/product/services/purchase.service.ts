import { PrismaClient, ProductStatus, AccountStatus } from "@prisma/client";

const prisma = new PrismaClient();

export class PurchaseService {
  /**
   * HÀM XỬ LÝ MUA HÀNG TỰ ĐỘNG (ACID TRANSACTION)
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

      // 2. Kiểm tra số lượng tồn kho thực tế (AVAILABLE)
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

      // 3. Tính tổng tiền và kiểm tra số dư User
      const totalPrice = product.price * quantity;

      const user = await tx.user.findUnique({ where: { id: userId } });
      if (!user) throw new Error("Không tìm thấy thông tin người dùng.");

      if (user.balance < totalPrice) {
        throw new Error(
          `Số dư tài khoản không đủ. Bạn cần thêm ${totalPrice - user.balance}đ để hoàn tất giao dịch.`,
        );
      }

      const balanceBefore = user.balance;
      const balanceAfter = user.balance - totalPrice;

      // 4. THÊM LOGIC: TRỪ TIỀN USER
      await tx.user.update({
        where: { id: userId },
        data: { balance: balanceAfter },
      });

      // 5. GHI LỊCH SỬ VÍ (Nếu bảng WalletTransaction của bạn có trường khác, hãy điều chỉnh cho khớp nhé)
      // Nếu không cần ghi log ví ở đây, bạn có thể comment đoạn này lại
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

      // 6. GOM DỮ LIỆU TÀI KHOẢN VÀ ĐỔI TRẠNG THÁI TRONG KHO THÀNH "SOLD"
      const accountIds = availableAccounts.map((acc) => acc.id);
      const extractedData = availableAccounts
        .map((acc) => acc.accountData)
        .join("\n");

      await tx.account.updateMany({
        where: { id: { in: accountIds } },
        data: { status: AccountStatus.SOLD },
      });

      // 7. TẠO ĐƠN HÀNG (Lưu vào Model Order cũ của bạn)
      const order = await tx.order.create({
        data: {
          userId: userId,
          productId: product.id,
          totalPrice: totalPrice,
          status: "COMPLETED",
          accountDetails: extractedData, // Xuất toàn bộ danh sách clone dạng text xuống đây
        },
      });

      // 8. Xuất hàng trả về cho khách
      return {
        orderId: order.id,
        productName: product.name,
        quantity,
        totalPrice,
        balanceAfter,
        accounts: extractedData, // Trả chuỗi text phân tách bằng dấu xuống dòng để khách copy luôn
      };
    });
  }
}
