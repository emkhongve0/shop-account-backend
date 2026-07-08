import { FastifyInstance } from "fastify";
import { WalletController } from "./controllers/wallet.controller";
import { authenticate } from "../../middlewares/auth.middleware";

export async function walletRoutes(fastify: FastifyInstance) {
  // Bắt buộc tất cả các route trong nhóm này phải có Bearer Token hợp lệ
  fastify.addHook("preHandler", authenticate);

  // Xem số dư & lịch sử ví
  fastify.get("/me", WalletController.getWalletDetails);

  // Nạp/trừ tiền trực tiếp cho User sở hữu Token
  fastify.post("/deposit-test", WalletController.modifyMyWallet);

  // Thực hiện mua hàng (Trừ tiền ví)
  fastify.post("/purchase", WalletController.testPurchase);
}
