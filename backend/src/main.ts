import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import compression from 'compression';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { CryptoUtil } from './common/utils/crypto.util';

// 数据库快照以 base64 放在 JSON body 里回灌,默认的 100kb 限制不够用。
// 关闭 Nest 内置 bodyParser,自行注册一个放宽上限的(仅放宽体积,行为不变)。
// 用 require 避免为了这一处额外引入 @types/express 依赖。
const express = require('express');

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
    cors: true,
    bodyParser: false,
  });
  app.use(express.json({ limit: '48mb' }));
  app.use(express.urlencoded({ extended: true, limit: '48mb' }));

  const config = app.get(ConfigService);
  const port = config.get<number>('PORT', 3000);

  // 初始化敏感数据加密密钥(AES-256-GCM)
  const encKey = config.get<string>('ENCRYPTION_KEY', 'please_change_encryption_key_in_production');
  CryptoUtil.init(encKey);

  // 全局前缀
  app.setGlobalPrefix('api');

  // 健康检查(不在 /api 前缀下,云托管健康检查用)
  app.use('/health', (req, res) => res.json({ ok: true, time: Date.now() }));

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

  // 收到 SIGTERM/SIGINT 时走 Nest 生命周期,让 Prisma 正常断开连接
  app.enableShutdownHooks();

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
  logger.log(`📦 数据库: ${config.get<string>('DATABASE_URL', 'file:/app/data/kygl.db')}`);
  logger.log(`📖 接口文档: http://localhost:${port}/api/docs`);
}

bootstrap();
