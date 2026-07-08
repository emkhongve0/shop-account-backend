import { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { authenticate } from '../../middlewares/auth.middleware';
import { checkVoucherBodySchema } from './schemas/voucher.schema';
import { checkVoucherHandler } from './controllers/voucher.controller';

export default async function voucherRoutes(fastify: FastifyInstance) {
  // Bắt buộc đăng nhập mới được check voucher mua hàng
  fastify.addHook('onRequest', authenticate);

  // API áp dụng voucher
  fastify.withTypeProvider<ZodTypeProvider>().post(
    '/check',
    { 
    schema: { body: checkVoucherBodySchema },
    config: {
      rateLimit: { max: 5, timeWindow: '1 minute' }
    }
    },
    checkVoucherHandler
  );
}