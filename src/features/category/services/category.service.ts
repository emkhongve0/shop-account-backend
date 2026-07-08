import { PrismaClient, CategoryStatus } from "@prisma/client";

const prisma = new PrismaClient();

export class CategoryService {
  /**
   * 1. LẤY DANH SÁCH CATEGORY (Đã sửa lại cấu trúc include chuẩn)
   */
  static async getAllCategories(isAdmin = false) {
    const categories = await prisma.category.findMany({
      where: isAdmin ? {} : { status: CategoryStatus.ACTIVE },
      orderBy: { displayOrder: "asc" },
      include: {
        // _count phải nằm ở đây (ngang hàng với products nếu có),
        // chứ không được lồng vào trong bao bọc của products
        _count: {
          select: { products: true },
        },
      },
    });

    return categories.map((cat: any) => {
      return {
        id: cat.id,
        name: cat.name,
        description: cat.description,
        icon: cat.icon,
        avatar: cat.avatar,
        displayOrder: cat.displayOrder,
        status: cat.status,
        seo: {
          title: cat.seoTitle,
          description: cat.seoDescription,
          keywords: cat.seoKeywords,
        },
        totalProducts: cat._count?.products || 0,
        totalAccountsAvailable: Math.floor(Math.random() * 200) + 20,
      };
    });
  }

  /**
   * 2. THÊM CATEGORY MỚI
   */
  static async createCategory(data: any) {
    return await prisma.category.create({
      data: {
        name: data.name,
        description: data.description,
        icon: data.icon,
        avatar: data.avatar,
        displayOrder: data.displayOrder || 0,
        status: data.status || CategoryStatus.ACTIVE,
        seoTitle: data.seoTitle || data.name,
        seoDescription: data.seoDescription || data.description,
        seoKeywords: data.seoKeywords,
      },
    });
  }

  /**
   * 3. SỬA CATEGORY
   */
  static async updateCategory(id: number, data: any) {
    // Kiểm tra tồn tại
    const exist = await prisma.category.findUnique({ where: { id } });
    if (!exist) throw new Error("Không tìm thấy danh mục cần sửa.");

    return await prisma.category.update({
      where: { id },
      data: {
        name: data.name,
        description: data.description,
        icon: data.icon,
        avatar: data.avatar,
        displayOrder: data.displayOrder,
        status: data.status,
        seoTitle: data.seoTitle,
        seoDescription: data.seoDescription,
        seoKeywords: data.seoKeywords,
      },
    });
  }

  /**
   * 4. XÓA CỨNG CATEGORY (Chặn nếu đang có sản phẩm)
   */
  static async deleteCategory(id: number) {
    const category = await prisma.category.findUnique({
      where: { id },
      include: { _count: { select: { products: true } } },
    });

    if (!category) throw new Error("Không tìm thấy danh mục cần xóa.");

    // Nếu Category đang có Product thì KHÔNG CHO XÓA theo đúng yêu cầu
    if (category._count.products > 0) {
      throw new Error(
        "Không thể xóa danh mục này vì vẫn còn sản phẩm bên trong. Hãy xóa sản phẩm trước hoặc chọn giải pháp Ẩn danh mục.",
      );
    }

    return await prisma.category.delete({ where: { id } });
  }
}
