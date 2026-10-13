/**
 * 微信小程序登录流程测试脚本
 * Mock 微信 API 和数据库,验证 WechatAuthService 核心逻辑
 * 运行: npx tsx test-wechat-login.ts
 */
import 'reflect-metadata';
import 'dotenv/config';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { WechatAuthService } from './src/auth/wechat-auth.service';
import { UserRole } from '@prisma/client';

// ============ Mock PrismaService(内存用户存储) ============
class MockPrismaService {
  users: any[] = [];
  nextId = 1;

  get user() {
    const self = this;
    return {
      findUnique: async ({ where }: any) => {
        if (where.wechatOpenId) return self.users.find((u) => u.wechatOpenId === where.wechatOpenId) || null;
        if (where.id) return self.users.find((u) => u.id === where.id) || null;
        if (where.username) return self.users.find((u) => u.username === where.username) || null;
        return null;
      },
      findFirst: async ({ where }: any) => {
        if (where.studentNo) return self.users.find((u) => u.studentNo === where.studentNo && u.role === UserRole.STUDENT) || null;
        return null;
      },
      create: async ({ data }: any) => {
        const user = { id: self.nextId++, ...data, createdAt: new Date(), updatedAt: new Date() };
        self.users.push(user);
        return user;
      },
      update: async ({ where, data }: any) => {
        const idx = self.users.findIndex((u) => u.id === where.id);
        if (idx < 0) throw new Error('user not found');
        self.users[idx] = { ...self.users[idx], ...data };
        return self.users[idx];
      },
    };
  }
  get studentProfile() { return { create: async () => ({}) }; }
  get progressArchive() { return { create: async () => ({}) }; }
}

// ============ Mock OperationLogService ============
class MockOpLog {
  async record() { return true; }
}

// ============ Mock 微信 API(fetch) ============
const FAKE_OPENID = 'oABC123xyz_openid_mock';
const FAKE_SESSION_KEY = 'session_key_mock_123';
const FAKE_PHONE = '13800138000';

const originalFetch = (global as any).fetch;
(global as any).fetch = async (url: string, options?: any) => {
  if (url.includes('jscode2session')) {
    return { json: async () => ({ openid: FAKE_OPENID, session_key: FAKE_SESSION_KEY, errcode: 0 }) };
  }
  if (url.includes('cgi-bin/token')) {
    return { json: async () => ({ access_token: 'fake_token', expires_in: 7200, errcode: 0 }) };
  }
  if (url.includes('getuserphonenumber')) {
    return { json: async () => ({ errcode: 0, phone_info: { phoneNumber: FAKE_PHONE } }) };
  }
  return originalFetch(url, options);
};

// ============ 运行测试 ============
async function runTests() {
  console.log('\n========== 微信小程序登录流程测试 ==========\n');

  const config = new ConfigService({
    WECHAT_APPID: 'wx_test_appid',
    WECHAT_SECRET: 'test_secret',
    JWT_SECRET: 'test_jwt_secret_for_testing_only',
    JWT_EXPIRES_IN: '1h',
  });

  const jwt = new JwtService({ secret: 'test_jwt_secret_for_testing_only' });
  const prisma = new MockPrismaService();
  const opLog = new MockOpLog();

  const wechatService = new WechatAuthService(prisma as any, config, jwt, opLog as any);

  let passed = 0;
  let failed = 0;

  function assert(name: string, condition: boolean, detail = '') {
    if (condition) { console.log(`  ✓ ${name}`); passed++; }
    else { console.log(`  ✗ ${name} ${detail ? `- ${detail}` : ''}`); failed++; }
  }

  // ---- 第一步:code2Session ----
  console.log('【第一步】wx.login code 换取 openid');
  let sessionResult: any;
  try {
    sessionResult = await wechatService.code2Session('mock_wx_login_code');
    assert('返回 openid', sessionResult.openid === FAKE_OPENID, `got: ${sessionResult.openid}`);
    assert('返回 sessionKey', !!sessionResult.sessionKey);
    console.log(`    openid: ${sessionResult.openid}`);
  } catch (e: any) {
    console.log(`  ✗ code2Session 失败: ${e.message}`);
    failed++;
  }

  // ---- 第二步:getPhoneNumber ----
  console.log('\n【第二步】获取手机号');
  let phone: string;
  try {
    phone = await wechatService.getPhoneNumber('mock_phone_code');
    assert('返回手机号', phone === FAKE_PHONE, `got: ${phone}`);
    console.log(`    phone: ${phone}`);
  } catch (e: any) {
    console.log(`  ✗ getPhoneNumber 失败: ${e.message}`);
    failed++;
  }

  // ---- 第三步:completeLogin(新用户注册) ----
  console.log('\n【第三步】补全姓名+学号,完成登录/注册');
  const testName = '张三';
  const testStudentNo = '202101001';
  const expectedUsername = `${testName}${testStudentNo}`;

  let loginResult: any;
  try {
    loginResult = await wechatService.completeLogin({
      openid: sessionResult.openid,
      phone,
      name: testName,
      studentNo: testStudentNo,
      nickname: '微信昵称测试',
      avatarUrl: 'https://example.com/avatar.png',
    });

    assert('返回 accessToken', !!loginResult.accessToken);
    assert('返回 user 对象', !!loginResult.user);
    assert('username = 姓名+学号', loginResult.user.username === expectedUsername, `got: ${loginResult.user.username}`);
    assert('name 正确', loginResult.user.name === testName);
    assert('studentNo 正确', loginResult.user.studentNo === testStudentNo);
    assert('phone 正确', loginResult.user.phone === phone);
    assert('角色为 STUDENT', loginResult.user.role === UserRole.STUDENT);
    console.log(`    username: ${loginResult.user.username}`);
    console.log(`    role: ${loginResult.user.role}`);
  } catch (e: any) {
    console.log(`  ✗ completeLogin 失败: ${e.message}`);
    failed++;
  }

  // ---- 验证 JWT ----
  console.log('\n【验证】JWT Token 有效性');
  try {
    const payload: any = await jwt.verifyAsync(loginResult.accessToken);
    assert('JWT sub 为用户ID', payload.sub === loginResult.user.id);
    assert('JWT username 正确', payload.username === expectedUsername);
    assert('JWT role 为 STUDENT', payload.role === UserRole.STUDENT);
    console.log(`    JWT payload: ${JSON.stringify(payload)}`);
  } catch (e: any) {
    console.log(`  ✗ JWT 验证失败: ${e.message}`);
    failed++;
  }

  // ---- 重复登录 ----
  console.log('\n【重复登录】同一微信用户再次登录');
  try {
    const loginResult2 = await wechatService.completeLogin({
      openid: sessionResult.openid,
      phone: '13900139000',
      name: testName,
      studentNo: testStudentNo,
    });
    assert('复用已有账号(不重复创建)', loginResult2.user.id === loginResult.user.id);
    assert('更新手机号', loginResult2.user.phone === '13900139000');
    console.log(`    复用用户ID: ${loginResult2.user.id}`);
  } catch (e: any) {
    console.log(`  ✗ 重复登录失败: ${e.message}`);
    failed++;
  }

  // ---- 学号冲突检测 ----
  console.log('\n【安全检测】同学号被其他微信绑定');
  try {
    await wechatService.completeLogin({ openid: 'oDIFFERENT_OPENID', name: '李四', studentNo: testStudentNo });
    console.log(`  ✗ 未拦截学号冲突`);
    failed++;
  } catch (e: any) {
    assert('拦截学号重复绑定', e.message.includes('学号'), `got: ${e.message}`);
  }

  // ---- 空姓名/学号校验 ----
  console.log('\n【参数校验】空姓名/空学号');
  try {
    await wechatService.completeLogin({ openid: 'oX1', name: '', studentNo: '123' });
    console.log(`  ✗ 未拦截空姓名`); failed++;
  } catch (e: any) {
    assert('拦截空姓名', e.message.includes('姓名'));
  }
  try {
    await wechatService.completeLogin({ openid: 'oX2', name: '王五', studentNo: '' });
    console.log(`  ✗ 未拦截空学号`); failed++;
  } catch (e: any) {
    assert('拦截空学号', e.message.includes('学号'));
  }

  // ---- 结果 ----
  console.log('\n========== 测试结果 ==========');
  console.log(`通过: ${passed}, 失败: ${failed}`);
  if (failed === 0) { console.log('✅ 微信登录流程全部通过!'); process.exit(0); }
  else { console.log('❌ 存在失败项,请检查'); process.exit(1); }
}

runTests().catch((e) => { console.error('测试运行异常:', e); process.exit(1); });
