import app from './app';
import { startEmailBot } from "./workers/email-reader.worker";

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '0.0.0.0';

const start = async () => {
  try {
    // 1. Khởi chạy Server Fastify đón Request từ Client
    await app.listen({ port: PORT, host: HOST });
    console.log(`🚀 Server của bạn đã khởi chạy thành công tại địa chỉ: http://127.0.0.1:${PORT}`);

    // 2. KÍCH HOẠT BOT ĐỌC EMAIL BIẾN ĐỘNG SỐ DƯ CHẠY NỀN SONG SONG
    startEmailBot();
    
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();