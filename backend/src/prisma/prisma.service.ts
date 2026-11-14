import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit() {
    await this.$connect();
    this.logger.log('✅ Prisma 已连接数据库');
  }

  /** 容器收到 SIGTERM 时由 Nest 的 shutdown hooks 调用,保证 SQLite 句柄正常释放 */
  async onModuleDestroy() {
    this.logger.log('关闭 Prisma 连接...');
    await this.$disconnect();
  }

  /**
   * @deprecated 改由 main.ts 的 app.enableShutdownHooks() 统一管理,保留仅为兼容旧调用。
   */
  enableShutdownHooks(_app: unknown) {
    // no-op
  }
}
