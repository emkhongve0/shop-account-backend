import { PrismaClient, ProductStatus, AccountStatus } from "@prisma/client";

const prisma = new PrismaClient();

// Hàm tạo slug đơn giản cho SEO: "Facebook VIA 2018" -> "facebook-via-2018"
function slugify(text: string) {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-") // Thay khoảng trắng bằng dấu -
    .replace(/[^\w\-]+/g, "") // Xóa ký tự đặc biệt
    .replace(/\-\-+/g, "-");
}

export class ProductService {
  /**
   * ADMIN: TẠO SẢN PHẨM MỚI
   */
  static async createProduct(data: any) {
    return await prisma.product.create({
      data: {
        name: data.name,
        slug: data.slug || slugify(data.name),
        price: data.price,
        description: data.description, // Nhận chuỗi HTML từ Admin
        categoryId: data.categoryId,
        status: data.status || ProductStatus.ACTIVE,
      },
    });
  }

  /**
   * ADMIN: IMPORT KHO TÀI KHOẢN (Mỗi dòng là 1 nick)
   */
  static async importAccounts(productId: number, rawTxtData: string) {
    // Tách chuỗi txt theo từng dòng, lọc bỏ các dòng trống
    const lines = rawTxtData
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    if (lines.length === 0)
      throw new Error("File hoặc dữ liệu import không có tài khoản nào.");

    // Tạo hàng loạt tài khoản vào kho với trạng thái AVAILABLE
    const accountRecords = lines.map((line) => ({
      productId,
      accountData: line,
      status: AccountStatus.AVAILABLE,
    }));

    await prisma.account.createMany({ data: accountRecords });
    return { importedCount: lines.length };
  }

  /**
   * USER & ADMIN: LẤY DANH SÁCH SẢN PHẨM (Tự động tính tồn kho thật)
   */
  static async getProducts(filters: {
    categoryId?: number;
    status?: ProductStatus;
  }) {
    const products = await prisma.product.findMany({
      where: filters,
      include: {
        category: { select: { name: true } },
        accounts: {
          where: { status: AccountStatus.AVAILABLE }, // Chỉ đếm những acc còn bán được
          select: { id: true },
        },
      },
    });

    // Trả ra cấu trúc gọn gàng, tính tồn kho bằng độ dài mảng accounts AVAILABLE
    return products.map((p) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      price: p.price,
      description: p.description,
      status: p.status,
      categoryName: p.category.name,
      stock: p.accounts.length, // Số lượng tồn kho tự động
    }));
  }

  /**
   * USER: CHI TIẾT SẢN PHẨM THEO ID HOẶC SLUG (SEO)
   */
  static async getProductByIdOrSlug(idOrSlug: string) {
    const isId = !isNaN(Number(idOrSlug));
    const product = await prisma.product.findFirst({
      where: isId ? { id: Number(idOrSlug) } : { slug: idOrSlug },
      include: {
        category: { select: { name: true } },
        _count: {
          select: { accounts: { where: { status: AccountStatus.AVAILABLE } } },
        },
      },
    });

    if (!product) throw new Error("Sản phẩm không tồn tại.");

    return {
      id: product.id,
      name: product.name,
      slug: product.slug,
      price: product.price,
      description: product.description,
      status: product.status,
      categoryName: product.category.name,
      stock: product._count.accounts,
    };
  }

  /**
   * ADMIN: CẬP NHẬT SẢN PHẨM (Sửa nhanh giá, trạng thái, hoặc tổng thể)
   */
  static async updateProduct(id: number, data: any) {
    if (data.name && !data.slug) {
      data.slug = slugify(data.name);
    }
    return await prisma.product.update({
      where: { id },
      data,
    });
  }

  /**
   * ADMIN: XÓA CỨNG SẢN PHẨM
   */
  static async deleteProduct(id: number) {
    return await prisma.product.delete({ where: { id } });
  }
}
