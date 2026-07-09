import { PrismaClient, AccountStatus } from "@prisma/client";

const prisma = new PrismaClient();

export class InventoryService {
  /**
   * 1. ADMIN: IMPORT TÀI KHOẢN TỪ TEXT (Mỗi dòng 1 nick)
   */
  static async importAccounts(productId: number, rawTxtData: string) {
    const lines = rawTxtData
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
    if (lines.length === 0) throw new Error("Dữ liệu nạp kho trống.");

    const accountRecords = lines.map((line) => ({
      productId,
      accountData: line,
      status: AccountStatus.AVAILABLE,
    }));

    await prisma.account.createMany({ data: accountRecords });
    return { importedCount: lines.length };
  }

  /**
   * 2. ADMIN: LẤY DANH SÁCH KHO (Xem được thông tin nhạy cảm)
   */
  static async getAllInventory(filters: {
    productId?: number;
    status?: AccountStatus;
  }) {
    return await prisma.account.findMany({
      where: filters,
      include: {
        product: { select: { name: true } },
      },
      orderBy: { id: "desc" },
    });
  }

  /**
   * 3. ADMIN: LẤY CHI TIẾT 1 TÀI KHOẢN
   */
  static async getAccountById(id: number) {
    const account = await prisma.account.findUnique({
      where: { id },
      include: { product: { select: { name: true } } },
    });
    if (!account) throw new Error("Tài khoản không tồn tại.");
    return account;
  }

  /**
   * 4. ADMIN: THÊM THỦ CÔNG 1 TÀI KHOẢN
   */
  static async createAccount(data: {
    productId: number;
    accountData: string;
    status?: AccountStatus;
  }) {
    return await prisma.account.create({
      data: {
        productId: data.productId,
        accountData: data.accountData,
        status: data.status || AccountStatus.AVAILABLE,
      },
    });
  }

  /**
   * 5. ADMIN: CẬP NHẬT TRẠNG THÁI / DỮ LIỆU TÀI KHOẢN
   */
  static async updateAccount(
    id: number,
    data: { accountData?: string; status?: AccountStatus; productId?: number },
  ) {
    return await prisma.account.update({
      where: { id },
      data,
    });
  }

  /**
   * 6. ADMIN: XÓA CỨNG TÀI KHOẢN (DELETE)
   */
  static async deleteAccount(id: number) {
    return await prisma.account.delete({ where: { id } });
  }

  /**
   * 7. ADMIN: EXPORT FILE TXT THEO SẢN PHẨM VÀ TRẠNG THÁI
   */
  static async exportToTxt(productId: number, status?: AccountStatus) {
    const accounts = await prisma.account.findMany({
      where: { productId, status },
      select: { accountData: true },
    });

    // Nối các tài khoản lại với nhau bằng dấu xuống dòng để tạo nội dung file .txt
    return accounts.map((acc) => acc.accountData).join("\n");
  }
}
