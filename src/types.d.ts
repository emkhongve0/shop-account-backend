import { FastifyJWT } from '@fastify/jwt';
import { RateLimitOptions } from '@fastify/rate-limit';

declare module 'fastify' {
  interface FastifyInstance {
    jwt: {
      sign(payload: UserPayload, options?: any): string;
      verify<T>(token: string, options?: any): T;
    };
  }

  // Khai báo thuộc tính rateLimit nằm bên trong thuộc tính config của Route
  interface FastifyContextConfig {
    rateLimit?: RateLimitOptions;
  }
}

interface UserPayload {
  userId: number;
  email: string;
}