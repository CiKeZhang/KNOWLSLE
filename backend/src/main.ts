import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import compression from 'compression';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { PrismaService } from './prisma/prisma.service';
import { CryptoUtil } from './common/utils/crypto.util';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
    cors: true,
  });
  const config = app.get(ConfigService);
  const port = config.get<number>('PORT', 3000);

  // 初始化敏感数据加密密钥(AES-256-GCM)
  const encKey = config.get<string>('ENCRYPTION_KEY', 'please_change_encryption_key_in_production');
  CryptoUtil.init(encKey);

  // 全局前缀
  app.setGlobalPrefix('api');

  // 安全与压缩中间件
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(compression());

  // 全局管道
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // 全局过滤器与拦截器
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new TransformInterceptor());

  // Prisma 生命周期
  const prisma = app.get(PrismaService);
  prisma.enableShutdownHooks(app);

  // Swagger 文档
  const swaggerConfig = new DocumentBuilder()
    .setTitle('考研进度管控与智能辅导系统 API')
    .setDescription('高校学院考研进度管控与智能辅导双端系统接口文档')
    .setVersion('1.0.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  await app.listen(port, '0.0.0.0');
  logger.log(`🚀 服务启动: http://0.0.0.0:${port}/api`);
  logger.log(`📖 接口文档: http://localhost:${port}/api/docs`);
}

bootstrap();
