import { FastifyInstance } from "fastify";
import swagger from "@fastify/swagger";
import swaggerUI from "@fastify/swagger-ui";
import { jsonSchemaTransform } from "fastify-type-provider-zod";

export async function registerSwagger(app: FastifyInstance) {
  // 1. Đăng ký lõi Swagger với cấu hình OpenAPI 3.1.0 và Zod Transform
  await app.register(swagger, {
    openapi: {
      openapi: "3.1.0",
      info: {
        title: "MMO Backend API System",
        description:
          "Tài liệu đặc tả toàn bộ hệ thống API phân hệ Auth & các nghiệp vụ MMO đi kèm.",
        version: "1.0.0",
      },
      servers: [
        {
          url: "http://localhost:3000",
          description: "Development Server",
        },
      ],
      components: {
        securitySchemes: {
          BearerAuth: {
            type: "http",
            scheme: "bearer",
            bearerFormat: "JWT",
            description:
              "Nhập mã Access Token (JWT) của bạn vào đây dưới dạng: Bearer <token>",
          },
        },
      },
    },
    transform: jsonSchemaTransform, // Bắt buộc để biến Zod Schema thành OpenAPI Schema chuẩn
  });

  // 2. Cấu hình giao diện hiển thị tài liệu trực quan UI
  await app.register(swaggerUI, {
    routePrefix: "/docs",
    uiConfig: {
      docExpansion: "list", // Mặc định mở rộng danh sách API khi tải trang
      deepLinking: true,
    },
    staticCSP: true,
    transformStaticCSP: (header) => header,
  });
}
