import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface CreateLogInput {
  userId?: number;
  action: string;
  module: string;
  ipAddress?: string;
  userAgent?: string;
  oldValues?: any;
  newValues?: any;
}

export class AuditLogService {
  static async createLog(data: CreateLogInput) {
    try {
      // Hãy chắc chắn chữ a viết thường: auditLog
      await prisma.auditLog.create({
        data: {
          userId: data.userId,
          action: data.action,
          module: data.module,
          ipAddress: data.ipAddress,
          userAgent: data.userAgent,
          oldValues: data.oldValues ? JSON.parse(JSON.stringify(data.oldValues)) : null,
          newValues: data.newValues ? JSON.parse(JSON.stringify(data.newValues)) : null,
        }
      });
    } catch (error) {
      console.error('Lỗi khi ghi Audit Log:', error);
    }
  }
}