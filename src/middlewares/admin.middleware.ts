import { FastifyRequest, FastifyReply } from "fastify";

export async function adminMiddleware(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const user = request.user as any;

  // 📝 BẬT LOG NÀY LÊN: Xem ở terminal xem nó in ra cái gì khi bạn bấm Postman
  console.log(">>>> Dữ liệu User từ Token trong AdminMiddleware:", user);

  // Nếu user không tồn tại hoặc role không phải viết hoa chữ "ADMIN"
  if (!user || user.role !== "ADMIN") {
    return reply.status(403).send({
      success: false,
      message: "Truy cập bị từ chối. Bạn không có quyền Admin.",
    });
  }
}
