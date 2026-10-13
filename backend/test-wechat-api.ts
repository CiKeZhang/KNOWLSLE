/**
 * 微信登录 HTTP 接口测试 - 通过 NestJS TestingModule 启动真实控制器
 * 验证 /auth/wechat/login、/auth/wechat/phone、/auth/wechat/complete 三个接口
 * 运行: npx tsx test-wechat-api.ts
 */
import 'reflect-metadata';
import 'dotenv/config';
import { Test } from '@nestjs/testing';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerModule } from '@nestjs/throttler';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AuthController } from './src/auth/auth.controller';
import { AuthService } from './src/auth/auth.service';
import { WechatAuthService } from './src/auth/wechat-auth.service';
import { PrismaService } from './src/prisma/prisma.service';
import { OperationLogService } from './src/common/services/operation-log.service';
import { JwtStrategy } from './src/auth/strategies/jwt.strategy';
import { JwtAuthGuard } from './src/auth/guards/jwt-auth.guard';
import { RolesGuard } from './src/common/guards/roles.guard';
import { TransformInterceptor } from './src/common/interceptors/transform.interceptor';
import { UserRole } from '@prisma/client';

import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-jwt';

// Mock JwtStrategy:直接从 JWT payload 返回用户
class MockJwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: (req: any) => req?.headers?.authorization?.replace('Bearer ', ''),
      ignoreExpiration: true,
      secretOrKey: 'test_secret',
    });
  }
  async validate(payload: any) {
    return { id: payload.sub, username: payload.username, name: '测试用户', role: payload.role };
  }
}

// ============ Mock Prisma ============
class MockPrisma {
  users: any[] = [];
  nextId = 1;
  get user() {
    const self = this;
    return {
      findUnique: async ({ where }: any) => {
        if (where.wechatOpenId) return self.users.find((u) => u.wechatOpenId === where.wechatOpenId) || null;
        if (where.id) {
          const u = self.users.find((u) => u.id === where.id);
          if (u) return { ...u, passwordHash: '', department: null, major: null, class: null, studentProfile: null };
          return null;
        }
        return null;
      },
      findFirst: async ({ where }: any) => {
        if (where.studentNo) return self.users.find((u) => u.studentNo === where.studentNo && u.role === 'STUDENT') || null;
        return null;
      },
      findUniqueOrThrow: async ({ where }: any) => {
        const u = self.users.find((x) => x.id === where.id);
        if (!u) throw new Error('not found');
        return u;
      },
      create: async ({ data }: any) => {
        const user = { id: self.nextId++, passwordHash: '', ...data, createdAt: new Date(), updatedAt: new Date() };
        self.users.push(user);
        return user;
      },
      update: async ({ where, data }: any) => {
        const idx = self.users.findIndex((u) => u.id === where.id);
        self.users[idx] = { ...self.users[idx], ...data };
        return self.users[idx];
      },
    };
  }
  get studentProfile() { return { create: async () => ({}) }; }
  get progressArchive() { return { create: async () => ({}) }; }
}

// ============ Mock OperationLog ============
class MockOpLog { async record() { return true; } }

// ============ Mock 微信 API ============
(global as any).fetch = async (url: string) => {
  if (url.includes('jscode2session')) return { json: async () => ({ openid: 'oMOCK_OPENID_123', session_key: 'sess_key', errcode: 0 }) };
  if (url.includes('cgi-bin/token')) return { json: async () => ({ access_token: 'tok', expires_in: 7200, errcode: 0 }) };
  if (url.includes('getuserphonenumber')) return { json: async () => ({ errcode: 0, phone_info: { phoneNumber: '13812345678' } }) };
  throw new Error('unmocked url: ' + url);
};

let app: INestApplication;

async function setupApp() {
  const configMock = {
    get: (key: string, def?: any) => {
      const map: any = { WECHAT_APPID: 'wx_test', WECHAT_SECRET: 'sec', JWT_SECRET: 'test_secret', JWT_EXPIRES_IN: '1h' };
      return map[key] ?? def;
    },
  };

  const module = await Test.createTestingModule({
    imports: [
      JwtModule.register({ secret: 'test_secret', signOptions: { expiresIn: '1h' } }),
      ThrottlerModule.forRoot([{ ttl: 60000, limit: 1000 }]),
    ],
    controllers: [AuthController],
    providers: [
      AuthService,
      WechatAuthService,
      { provide: JwtStrategy, useClass: MockJwtStrategy },
      JwtAuthGuard,
      RolesGuard,
      { provide: ConfigService, useValue: configMock },
      { provide: PrismaService, useValue: new MockPrisma() },
      { provide: OperationLogService, useValue: new MockOpLog() },
    ],
  }).compile();

  app = module.createNestApplication();
  app.useGlobalPipes(new ValidationPipe());
  app.useGlobalInterceptors(new TransformInterceptor());
  await app.init();
}

// ============ 测试 ============
async function run() {
  await setupApp();
  let passed = 0, failed = 0;
  const assert = (name: string, cond: boolean, detail = '') => {
    if (cond) { console.log(`  ✓ ${name}`); passed++; }
    else { console.log(`  ✗ ${name} ${detail}`); failed++; }
  };

  console.log('\n========== 微信登录 HTTP 接口测试 ==========\n');

  // 接口1: /auth/wechat/login
  console.log('【接口1】POST /auth/wechat/login');
  const res1 = await request(app.getHttpServer())
    .post('/auth/wechat/login')
    .send({ code: 'wx_login_code_123' });
  assert('HTTP 200/201', res1.status === 200 || res1.status === 201, `got ${res1.status}`);
  assert('返回 openid', res1.body?.data?.openid === 'oMOCK_OPENID_123', `got ${res1.body?.data?.openid}`);
  assert('返回 sessionKey', !!res1.body?.data?.sessionKey);
  const openid = res1.body?.data?.openid;
  console.log(`    openid: ${openid}`);

  // 接口1 异常:缺少 code
  console.log('\n【接口1异常】缺少 code 参数');
  const res1b = await request(app.getHttpServer()).post('/auth/wechat/login').send({});
  assert('缺少 code 返回 400', res1b.status === 400, `got ${res1b.status}`);

  // 接口2: /auth/wechat/phone
  console.log('\n【接口2】POST /auth/wechat/phone');
  const res2 = await request(app.getHttpServer())
    .post('/auth/wechat/phone')
    .send({ code: 'phone_code_456' });
  assert('HTTP 200/201', res2.status === 200 || res2.status === 201, `got ${res2.status}`);
  assert('返回手机号', res2.body?.data === '13812345678', `got ${JSON.stringify(res2.body?.data)}`);
  console.log(`    phone: ${res2.body?.data}`);

  // 接口3: /auth/wechat/complete
  console.log('\n【接口3】POST /auth/wechat/complete');
  const res3 = await request(app.getHttpServer())
    .post('/auth/wechat/complete')
    .send({
      openid,
      phone: '13812345678',
      name: '李同学',
      studentNo: '202203045',
      nickname: '微信昵称',
      avatarUrl: 'https://example.com/avatar.png',
    });
  assert('HTTP 200/201', res3.status === 200 || res3.status === 201, `got ${res3.status}`);
  assert('返回 accessToken', !!res3.body?.data?.accessToken);
  assert('username = 姓名+学号', res3.body?.data?.user?.username === '李同学202203045', `got ${res3.body?.data?.user?.username}`);
  assert('角色 STUDENT', res3.body?.data?.user?.role === 'STUDENT');
  console.log(`    username: ${res3.body?.data?.user?.username}`);
  console.log(`    token: ${res3.body?.data?.accessToken?.slice(0, 30)}...`);

  // 接口3 异常:空姓名
  console.log('\n【接口3异常】空姓名');
  const res3b = await request(app.getHttpServer())
    .post('/auth/wechat/complete')
    .send({ openid, name: '', studentNo: '123' });
  assert('空姓名返回 400', res3b.status === 400, `got ${res3b.status}`);

  // 接口3 异常:空学号
  console.log('\n【接口3异常】空学号');
  const res3c = await request(app.getHttpServer())
    .post('/auth/wechat/complete')
    .send({ openid, name: '王同学', studentNo: '' });
  assert('空学号返回 400', res3c.status === 400, `got ${res3c.status}`);

  // 用返回的 token 访问受保护接口
  console.log('\n【JWT鉴权】使用返回的 token 访问 /auth/profile');
  const res4 = await request(app.getHttpServer())
    .get('/auth/profile')
    .set('Authorization', `Bearer ${res3.body?.data?.accessToken}`);
  assert('带 token 访问 profile 成功', res4.status === 200, `got ${res4.status}`);

  console.log('\n========== 测试结果 ==========');
  console.log(`通过: ${passed}, 失败: ${failed}`);
  console.log(failed === 0 ? '✅ HTTP 接口测试全部通过!' : '❌ 存在失败项');

  await app.close();
  process.exit(failed === 0 ? 0 : 1);
}

run().catch((e) => { console.error('异常:', e); process.exit(1); });
