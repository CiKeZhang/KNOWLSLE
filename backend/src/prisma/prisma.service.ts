import { Injectable, OnModuleInit, INestApplication, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit() {
    await this.$connect();
    this.logger.log('✅ Prisma 已连接数据库');
  }

  enableShutdownHooks(app: INestApplication) {
    process.on('beforeExit', async () => {
      this.logger.log('关闭 Prisma 连接...');
      await this.$disconnect();
      await app.close();
    });
  }
}
