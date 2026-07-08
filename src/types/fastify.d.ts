import '@fastify/jwt';

declare module 'fastify' {
  interface FastifyRequest {
    user: {
      id: number;
      email: string;
    };
  }
}